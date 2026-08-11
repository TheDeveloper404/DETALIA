// Repo detalii — singurul loc cu acces Drizzle pentru `details` și `detail_resources`.
// Services-urile cheamă repo-ul; UI-ul NU atinge DB direct.
import { and, desc, eq, exists, inArray, isNull, ne, or, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  categories,
  comments,
  detailCategories,
  detailResources,
  details,
  projectMembers,
  projects,
  roles,
  savedDetails,
  sketches,
  supplierOffers,
  users,
  validations,
} from "@/db/schema";
import { DETAIL_STATUS, type DetailResourceInput } from "@/server/domain/detail";

// Creează detaliul + categoriile + resursele într-un SINGUR `db.batch` (atomic). Neon HTTP nu are
// tranzacții interactive, dar `batch` trimite toate query-urile într-o singură rundă atomică — posibil
// aici pentru că id-ul detaliului e generat CLIENT-SIDE (crypto.randomUUID()), nu de `defaultRandom()`
// al coloanei, deci detailCategories/detailResources pot referi id-ul înainte ca insert-ul să se fi
// „întors" cu `.returning()`. Înlocuiește vechiul flux secvențial (detail → categorii → resurse), unde
// o eroare la mijloc putea lăsa un detaliu fără categorii/resurse.
export async function insertDetailWithRelations(input: {
  title: string;
  description: string | null;
  authorId: string;
  imageUrl: string | null;
  location: string;
  climateZone: string | null;
  seismicAg: string;
  seismicTc: string;
  snowLoad: string;
  windLoad: string;
  categoryIds: string[];
  resources: DetailResourceInput[];
  // Implicit PUBLISHED (moderare post-publicare) — DRAFT doar la „Salvează ciornă".
  status?: typeof DETAIL_STATUS.DRAFT | typeof DETAIL_STATUS.PUBLISHED;
  // Proiecte (2026-08-09): setat DOAR când detaliul se publică într-un proiect (vezi
  // server/domain/project.ts, resolveDetailPlacement) — validat de apelant (membru activ), nu aici.
  projectId?: string | null;
}): Promise<{ id: string }> {
  const id = crypto.randomUUID();

  const insertDetailStatement = db
    .insert(details)
    .values({
      id,
      title: input.title,
      description: input.description,
      authorId: input.authorId,
      imageUrl: input.imageUrl,
      location: input.location,
      climateZone: input.climateZone,
      seismicAg: input.seismicAg,
      seismicTc: input.seismicTc,
      snowLoad: input.snowLoad,
      windLoad: input.windLoad,
      status: input.status ?? DETAIL_STATUS.PUBLISHED,
      projectId: input.projectId ?? null,
    })
    .returning({ id: details.id });

  // `db.batch` cere doar un array NEVID (`Readonly<[U, ...U[]]>`), nu un tuplu de lungime fixă 2/3 —
  // insertDetailStatement e mereu prezent, deci array-ul e mereu nevid; nu e nevoie de ramuri separate
  // pe combinația categorii/resurse (relații opționale viitoare se adaugă la fel, fără combinatorică nouă).
  const optionalStatements = [
    input.categoryIds.length
      ? db
          .insert(detailCategories)
          .values(input.categoryIds.map((categoryId) => ({ detailId: id, categoryId })))
      : null,
    input.resources.length
      ? db.insert(detailResources).values(
          input.resources.map((r) => ({
            detailId: id,
            type: r.type,
            url: r.url ?? null,
            body: r.body ?? null,
          })),
        )
      : null,
  ].filter((s): s is NonNullable<typeof s> => s !== null);

  const [detailResult] = await db.batch([insertDetailStatement, ...optionalStatements]);
  if (detailResult.length === 0) {
    throw new Error("insertDetailWithRelations: insertul detaliului nu a produs niciun rând");
  }
  return { id };
}

// EXISTS pe join-ul detail_categories — „acest detaliu are bifată cel puțin una din categoriile date".
function hasAnyCategory(categoryIds: string[]) {
  return exists(
    db
      .select({ one: sql`1` })
      .from(detailCategories)
      .where(
        and(eq(detailCategories.detailId, details.id), inArray(detailCategories.categoryId, categoryIds)),
      ),
  );
}

// Actualizează câmpurile editabile ale unui detaliu (titlu, descriere, imagine, parametri tehnici).
// Ownership-ul se verifică ÎNAINTE, în service. `updated_at` se împinge la now.
export async function updateDetailRow(
  detailId: string,
  input: {
    title: string;
    description: string | null;
    imageUrl: string | null;
    location: string;
    climateZone: string | null;
    seismicAg: string;
    seismicTc: string;
    snowLoad: string;
    windLoad: string;
  },
) {
  await db
    .update(details)
    .set({
      title: input.title,
      description: input.description,
      imageUrl: input.imageUrl,
      location: input.location,
      climateZone: input.climateZone,
      seismicAg: input.seismicAg,
      seismicTc: input.seismicTc,
      snowLoad: input.snowLoad,
      windLoad: input.windLoad,
      updatedAt: new Date(),
    })
    .where(eq(details.id, detailId));
}

// Înlocuiește complet setul de categorii al unui detaliu (delete-all + insert). Neon HTTP n-are
// tranzacții interactive → batch atomic când există și inserare.
export async function replaceDetailCategories(detailId: string, categoryIds: string[]) {
  if (categoryIds.length === 0) {
    await db.delete(detailCategories).where(eq(detailCategories.detailId, detailId));
    return;
  }
  await db.batch([
    db.delete(detailCategories).where(eq(detailCategories.detailId, detailId)),
    db.insert(detailCategories).values(categoryIds.map((categoryId) => ({ detailId, categoryId }))),
  ]);
}

// Înlocuiește complet resursele unui detaliu (delete-all + insert).
export async function replaceDetailResources(detailId: string, resources: DetailResourceInput[]) {
  if (resources.length === 0) {
    await db.delete(detailResources).where(eq(detailResources.detailId, detailId));
    return;
  }
  await db.batch([
    db.delete(detailResources).where(eq(detailResources.detailId, detailId)),
    db.insert(detailResources).values(
      resources.map((r) => ({
        detailId,
        type: r.type,
        url: r.url ?? null,
        body: r.body ?? null,
      })),
    ),
  ]);
}

// Ciornele de DETALIU ale unui user (pt „Ciornele mele", unificat cu ciornele de schiță).
export function listDetailDraftsByAuthor(authorId: string) {
  return db
    .select({ id: details.id, title: details.title, imageUrl: details.imageUrl, createdAt: details.createdAt })
    .from(details)
    .where(and(eq(details.authorId, authorId), eq(details.status, DETAIL_STATUS.DRAFT)))
    .orderBy(desc(details.createdAt));
}

// Categoriile bifate pe un detaliu, ca array JSON — subquery corelat (nu join), ca să nu dublăm
// rândurile detaliului când sunt mai multe categorii (regula e „bifezi oricâte").
const detailCategoriesJson = sql<{ id: string; name: string; slug: string }[]>`(
  select coalesce(json_agg(json_build_object('id', ${categories.id}, 'name', ${categories.name}, 'slug', ${categories.slug}) order by ${categories.name}), '[]'::json)
  from ${detailCategories}
  join ${categories} on ${categories.id} = ${detailCategories.categoryId}
  where ${detailCategories.detailId} = ${details.id}
)`;

// Forma de afișare a unui detaliu cu autor (nume+rol) și categorii — folosită pe pagina de detaliu și în feed.
const detailWithAuthorColumns = {
  id: details.id,
  title: details.title,
  description: details.description,
  imageUrl: details.imageUrl,
  location: details.location,
  climateZone: details.climateZone,
  seismicAg: details.seismicAg,
  seismicTc: details.seismicTc,
  snowLoad: details.snowLoad,
  windLoad: details.windLoad,
  status: details.status,
  views: details.views,
  // Proiecte (2026-08-09): NU se maschează — un detaliu de proiect NU ar trebui să ajungă aici
  // pentru un non-membru (poarta de acces se verifică în service, ÎNAINTE de a expune restul
  // câmpurilor), dar coloana rămâne vizibilă la nivel de repo ca serviciul să poată decide.
  projectId: details.projectId,
  createdAt: details.createdAt,
  categories: detailCategoriesJson,
  // ── Autor, cu anonimizarea impusă ÎN SQL ──
  // Un detaliu din care autorul s-a retras (`anonymized_at`) nu mai trebuie să poarte nume/poză/link de
  // profil NICĂIERI — nici într-un payload de Server Component, nici într-un răspuns de acțiune. De aceea
  // masca stă AICI, în singurul loc prin care trec toate citirile de detaliu, nu în componente: o
  // ascundere doar în UI ar lăsa identitatea în datele trimise clientului.
  //
  // `details.author_id` RĂMÂNE în tabel (audit/abuz) — doar nu mai iese de aici.
  isAnonymized: sql<boolean>`${details.anonymizedAt} is not null`,
  // `authorId` = identitatea AFIȘABILĂ: null după retragere, ca UUID-ul autorului să nu ajungă la client
  // (din el s-ar deschide direct /profile/<id> — anonimizarea ar fi fost decorativă).
  authorId: sql<string | null>`case when ${details.anonymizedAt} is null then ${details.authorId} end`,
  // `ownerId` = proprietarul REAL, needitat de anonimizare. STRICT pentru logica de server (autorizare,
  // notificări, „e adnotarea propriului autor?"). NU se trimite spre client — componentele de afișare
  // citesc `authorId`/`isAnonymized`, niciodată asta.
  ownerId: details.authorId,
  authorName: sql<string | null>`case when ${details.anonymizedAt} is null then ${users.name} end`,
  authorImage: sql<string | null>`case when ${details.anonymizedAt} is null then ${users.image} end`,
  authorLocation: sql<string | null>`case when ${details.anonymizedAt} is null then ${users.location} end`,
  authorHeadline: sql<string | null>`case when ${details.anonymizedAt} is null then ${users.headline} end`,
  // Rolul SUPRAVIEȚUIEȘTE retragerii (cerința: „Autor șters · rol") — după anonimizare nu-l mai putem
  // citi din contul userului, deci vine din snapshot-ul înghețat la momentul retragerii.
  authorRoleMain: sql<string | null>`case when ${details.anonymizedAt} is null then ${roles.roleMain}::text
    else ${details.authorRoleSnapshot}->>'roleMain' end`,
  authorSubRole: sql<string | null>`case when ${details.anonymizedAt} is null then ${roles.subRole}
    else ${details.authorRoleSnapshot}->>'subRole' end`,
  authorVerification: sql<string | null>`case when ${details.anonymizedAt} is null then ${roles.verificationStatus}::text
    else ${details.authorRoleSnapshot}->>'verificationStatus' end`,
} as const;

export async function getDetailResources(detailId: string) {
  return db
    .select({
      id: detailResources.id,
      type: detailResources.type,
      url: detailResources.url,
      body: detailResources.body,
    })
    .from(detailResources)
    .where(eq(detailResources.detailId, detailId));
}

// Incrementează atomic contorul de vizualizări al unui detaliu PUBLICAT.
//
// `views = views + 1` la nivel de DB (nu citire-apoi-scriere din aplicație) → fără condiție de cursă
// când mai mulți useri deschid pagina simultan.
//
// SQL brut, NU `db.update(details).set(...)`, DINADINS: `updatedAt` are `$onUpdate` în schema Drizzle,
// deci orice update trecut prin query builder ar rescrie și „ultima modificare" a detaliului — o simplă
// vizualizare ar fi arătat ca o editare a autorului.
export async function incrementDetailViews(id: string): Promise<void> {
  await db.execute(
    sql`update ${details} set ${sql.identifier("views")} = ${sql.identifier("views")} + 1
        where ${details.id} = ${id} and ${details.status} = ${DETAIL_STATUS.PUBLISHED}`,
  );
}

export async function getDetailById(id: string) {
  const [row] = await db
    .select(detailWithAuthorColumns)
    .from(details)
    .leftJoin(users, eq(users.id, details.authorId))
    .leftJoin(roles, eq(roles.userId, details.authorId))
    .where(and(eq(details.id, id), eq(details.status, DETAIL_STATUS.PUBLISHED)))
    .limit(1);
  return row ?? null;
}

// Fetch pt pagina de EDITARE — spre deosebire de `getDetailById`, NU filtrează pe status (owner-ul
// trebuie să-și poată edita atât un detaliu publicat, cât și o ciornă DRAFT). Scoping-ul pe owner e
// AICI, în query (nu doar verificat după) — un DRAFT al altui user nu trebuie niciodată să ajungă la
// client, nici măcar ca răspuns „not found după citire".
export async function getDetailForEdit(id: string, ownerId: string) {
  const [row] = await db
    .select(detailWithAuthorColumns)
    .from(details)
    .leftJoin(users, eq(users.id, details.authorId))
    .leftJoin(roles, eq(roles.userId, details.authorId))
    // `anonymized_at is null`: un detaliu din care autorul s-a retras nu se mai editează de nimeni
    // (decizie de produs 2026-08-06 — nu poți edita ceva de care te-ai desprins public). Blocat AICI,
    // în poarta prin care trec ȘI încărcarea formularului de editare, ȘI ștergerea ciornei, ȘI update-ul
    // — nu în UI, unde ar fi rămas doar cosmetic.
    .where(and(eq(details.id, id), eq(details.authorId, ownerId), isNull(details.anonymizedAt)))
    .limit(1);
  return row ?? null;
}

// Tranziția DRAFT → PUBLISHED (materializează publicarea unei ciorne de detaliu).
export async function publishDetailRow(detailId: string) {
  await db
    .update(details)
    .set({ status: DETAIL_STATUS.PUBLISHED, updatedAt: new Date() })
    .where(and(eq(details.id, detailId), eq(details.status, DETAIL_STATUS.DRAFT)));
}

// SEC-011 (audit securitate 2026-08-11): batch — pentru scrub-ul notificărilor la citire (userul care
// a pierdut accesul la un proiect nu mai trebuie să vadă titlul detaliului în clopoțel). Doar id+projectId,
// fără join-uri suplimentare.
export async function listProjectIdForDetails(detailIds: string[]): Promise<Map<string, string | null>> {
  if (detailIds.length === 0) return new Map();
  const rows = await db
    .select({ id: details.id, projectId: details.projectId })
    .from(details)
    .where(inArray(details.id, detailIds));
  return new Map(rows.map((r) => [r.id, r.projectId]));
}

// Detaliile PUBLICATE ale unui proiect — „feed"-ul intern, vizibil doar membrilor (autorizarea se
// verifică ÎNAINTE, în service — acest query nu ia userId, doar proiectul). Strict cronologic, ca
// listFeed.
export async function listProjectDetails(projectId: string) {
  return db
    .select({
      ...detailWithAuthorColumns,
      validationCount,
      commentCount,
      sketchCount,
    })
    .from(details)
    .leftJoin(users, eq(users.id, details.authorId))
    .leftJoin(roles, eq(roles.userId, details.authorId))
    .where(and(eq(details.status, DETAIL_STATUS.PUBLISHED), eq(details.projectId, projectId)))
    .orderBy(desc(details.createdAt));
}

// Card-preview: detalii care AU FOST în acest proiect și au fost eliberate în comunitate (§6A, Faza B
// „Proiect", 2026-08-11) — `projectId` e deja null (public), dar `releasedFromProjectId` păstrează
// originea. Fără asta, „scoate în comunitate" ar face detaliul să dispară complet din vederea
// proiectului, fără nicio urmă. Doar câmpurile de preview — cardul duce spre pagina publică, nu
// duplică toată logica listei principale (validationCount/commentCount etc. nu au sens aici).
export async function listReleasedProjectDetails(projectId: string) {
  return db
    .select({ id: details.id, title: details.title, imageUrl: details.imageUrl })
    .from(details)
    .where(
      and(
        eq(details.status, DETAIL_STATUS.PUBLISHED),
        eq(details.releasedFromProjectId, projectId),
        isNull(details.projectId),
      ),
    )
    .orderBy(desc(details.createdAt));
}

// Toate detaliile unui proiect, INDIFERENT de status (inclusiv DRAFT) — folosit la ștergerea
// proiectului. Nu se poate folosi `listProjectDetails` (filtrează PUBLISHED): un draft rămas în proiect
// trebuie și el trecut prin cascada completă. `imageUrl` vine odată cu id-ul, ca să nu se piardă
// fișierul din Blob după ce rândul dispare.
export async function listAllProjectDetails(projectId: string) {
  return db
    .select({ id: details.id, imageUrl: details.imageUrl })
    .from(details)
    .where(eq(details.projectId, projectId));
}

// „Scoate în comunitate" — mutație ireversibilă (regulă de business, nu constrângere DB; vezi
// resolveDetailPlacement în server/domain/project.ts). Autorizarea (regula „orfan") se verifică
// ÎNAINTE, în service.
//
// SEC-002 (2026-08-10): release publică DOAR conținutul autorului detaliului. Schițele PUBLISHED ale
// altor membri se marchează `hiddenAfterRelease` ÎN ACELAȘI batch, atomic cu nularea `projectId` —
// altfel ar exista o fereastră (sau, la eroare pe jumătate, o stare permanentă) cu detaliul deja public
// și contribuțiile altora încă vizibile nefiltrat.
export async function releaseDetailToCommunity(
  detailId: string,
  detailAuthorId: string,
  releasedFromProjectId: string,
) {
  // SEC-001 (audit securitate 2026-08-11): comentariile/validările ALTOR membri decât autorul, fie pe
  // detaliu direct, fie pe oricare din schițele lui, se ascund în ACELAȘI batch atomic — altfel ar
  // exista o fereastră (sau, la eroare pe jumătate, o stare permanentă) cu detaliul deja public și
  // conținutul altora încă vizibil nefiltrat. Subquery pe schițele detaliului, nu doar targetId=detailId.
  const sketchIdsOfDetail = db.select({ id: sketches.id }).from(sketches).where(eq(sketches.detailId, detailId));
  const onThisDetailOrItsSketches = (targetType: typeof comments.targetType | typeof validations.targetType, targetId: typeof comments.targetId | typeof validations.targetId) =>
    or(
      and(eq(targetType, "DETAIL"), eq(targetId, detailId)),
      and(eq(targetType, "SKETCH"), inArray(targetId, sketchIdsOfDetail)),
    );

  await db.batch([
    // `releasedFromProjectId` setat AICI, o singură dată (regula ireversibilă — nu se rescrie la o
    // eventuală re-intrare într-un alt proiect, ceea ce oricum nu se poate întâmpla: un detaliu deja
    // eliberat e `projectId=null`, nu mai poate reintra). Rămâne cardul-preview în proiectul de origine.
    db
      .update(details)
      .set({ projectId: null, releasedFromProjectId })
      .where(eq(details.id, detailId)),
    db
      .update(sketches)
      .set({ hiddenAfterRelease: true })
      .where(
        and(
          eq(sketches.detailId, detailId),
          eq(sketches.status, "PUBLISHED"),
          ne(sketches.authorId, detailAuthorId),
        ),
      ),
    db
      .update(comments)
      .set({ hiddenAfterRelease: true })
      .where(
        and(
          ne(comments.authorId, detailAuthorId),
          onThisDetailOrItsSketches(comments.targetType, comments.targetId),
        ),
      ),
    db
      .update(validations)
      .set({ hiddenAfterRelease: true })
      .where(
        and(
          ne(validations.userId, detailAuthorId),
          onThisDetailOrItsSketches(validations.targetType, validations.targetId),
        ),
      ),
  ]);
}

// Șterge un detaliu + tot ce atârnă de el, ATOMIC. `detail_resources` și `sketches` cad în cascadă
// (FK onDelete: cascade). DAR validările și comentariile sunt POLIMORFICE (target_type/target_id, fără
// FK către details/sketches) → trebuie șterse manual: cele de pe detaliu ȘI cele de pe schițele lui.
// Neon HTTP n-are tranzacții interactive → folosim `db.batch` (un singur batch atomic).
// Întoarce URL-urile de blob de curățat best-effort din service (thumbnail-uri schițe + resurse IMAGE/PDF/CAD;
// LINK/TEXT nu au fișier în Blob-ul nostru — LINK e URL extern).
// Câte interacțiuni a PRIMIT un detaliu de la ALȚI useri — folosit ca să decidem dacă ștergerea îl
// elimină complet sau doar retrage identitatea autorului. Un singur query, trei subquery-uri corelate
// (nu 3 round-trip-uri).
//
// Toate trei exclud autorul (`<> details.author_id`): comentariile lui pe propriul detaliu, pozițiile
// lui (posibile din 2026-08-06, item 6) și ORICE desen al lui pe propriul detaliu (adnotare SAU
// self-sketch ulterior) nu sunt interacțiuni PRIMITE. Fără excluderea asta, autorul care își dă Aprob pe
// propriul detaliu și-ar bloca singur ștergerea completă, ireversibil (decizie de produs 2026-08-06).
// RĂMÂNE pe identitate, INTENȚIONAT NESCHIMBAT de redefinirea `isAnnotation` (2026-08-11): scopul aici
// e „a interacționat ALTCINEVA", nu „e adnotarea" — diferă de `sketchCount`/teanc, unde swap-ul spre
// `isAnnotation` e corect. Vezi comentariul din `sketchCount` mai jos în acest fișier.
export async function countDetailInteractions(detailId: string): Promise<{
  comments: number;
  validations: number;
  sketchesFromOthers: number;
}> {
  // BUG REAL găsit la debugging e2e (2026-08-06): fără calificare explicită, `${details.authorId}`
  // necalificat SE REZOLVĂ la coloana subquery-ului (`comments.author_id`/`validations.user_id`/
  // `sketches.author_id`), nu la `details.author_id` — Postgres tratează identificatorul necalificat
  // ca aparținând scope-ului cel mai apropiat (FROM-ul subquery-ului). Rezultat: `x <> x`, mereu FALS,
  // contor mereu 0 — exact capcana deja documentată la `sketchCount`/`detailsAuthorId` mai jos în acest
  // fișier. Refolosim ACEEAȘI referință calificată explicit, nu una nouă.
  const [row] = await db
    .select({
      comments: sql<number>`(select count(*)::int from ${comments}
        where ${comments.targetType} = 'DETAIL' and ${comments.targetId} = ${detailsId}
          and ${comments.authorId} <> ${detailsAuthorId})`,
      validations: sql<number>`(select count(*)::int from ${validations}
        where ${validations.targetType} = 'DETAIL' and ${validations.targetId} = ${detailsId}
          and ${validations.userId} <> ${detailsAuthorId})`,
      sketchesFromOthers: sql<number>`(select count(*)::int from ${sketches}
        where ${sketches.detailId} = ${detailsId}
          and ${sketches.status} = 'PUBLISHED'
          and ${sketches.authorId} <> ${detailsAuthorId})`,
    })
    .from(details)
    .where(eq(details.id, detailId))
    .limit(1);

  return row ?? { comments: 0, validations: 0, sketchesFromOthers: 0 };
}

// Retrage identitatea autorului dintr-un detaliu: îngheață rolul curent în snapshot și marchează
// momentul. Conținutul, schițele, comentariile și pozițiile rămân neatinse — doar afișarea autorului
// se schimbă (masca e aplicată la CITIRE, în `detailWithAuthorColumns`).
//
// Condiționat pe `author_id` (fără IDOR) ȘI pe `anonymized_at is null` (idempotent: două cereri
// concurente nu rescriu snapshot-ul cu un rol schimbat între timp). True dacă acest apel a anonimizat.
export async function anonymizeDetailAuthor(
  detailId: string,
  authorId: string,
  roleSnapshot: { roleMain: string; subRole: string | null; verificationStatus: string },
): Promise<boolean> {
  const rows = await db
    .update(details)
    .set({ anonymizedAt: new Date(), authorRoleSnapshot: roleSnapshot })
    .where(
      and(
        eq(details.id, detailId),
        eq(details.authorId, authorId),
        isNull(details.anonymizedAt),
      ),
    )
    .returning({ id: details.id });
  return rows.length > 0;
}

export async function deleteDetailCascade(detailId: string): Promise<string[]> {
  const sketchRows = await db
    .select({ id: sketches.id, thumbnailUrl: sketches.thumbnailUrl })
    .from(sketches)
    .where(eq(sketches.detailId, detailId));
  const sketchIds = sketchRows.map((s) => s.id);

  const resourceRows = await db
    .select({ url: detailResources.url })
    .from(detailResources)
    .where(
      and(
        eq(detailResources.detailId, detailId),
        inArray(detailResources.type, ["IMAGE", "PDF", "CAD"]),
      ),
    );

  const valWhere = sketchIds.length
    ? or(
        and(eq(validations.targetType, "DETAIL"), eq(validations.targetId, detailId)),
        and(eq(validations.targetType, "SKETCH"), inArray(validations.targetId, sketchIds)),
      )
    : and(eq(validations.targetType, "DETAIL"), eq(validations.targetId, detailId));

  const comWhere = sketchIds.length
    ? or(
        and(eq(comments.targetType, "DETAIL"), eq(comments.targetId, detailId)),
        and(eq(comments.targetType, "SKETCH"), inArray(comments.targetId, sketchIds)),
      )
    : and(eq(comments.targetType, "DETAIL"), eq(comments.targetId, detailId));

  // Imaginile atașate comentariilor care urmează să dispară — citite ÎNAINTE de delete, altfel URL-urile
  // s-ar pierde odată cu rândurile și fișierele ar rămâne orfane în Blob, plătite la nesfârșit.
  const commentImageRows = await db
    .select({ imageUrl: comments.imageUrl })
    .from(comments)
    .where(comWhere);

  await db.batch([
    db.delete(validations).where(valWhere),
    db.delete(comments).where(comWhere),
    db.delete(details).where(eq(details.id, detailId)), // cascade → detail_resources + sketches
  ]);

  return [
    ...sketchRows.map((s) => s.thumbnailUrl),
    ...resourceRows.map((r) => r.url),
    ...commentImageRows.map((c) => c.imageUrl),
  ].filter((u): u is string => !!u);
}

// Counts de interacțiune per detaliu (polimorfice, pe DETAIL) — subquery-uri corelate (nu join-uri)
// ca să nu dublăm rândurile când există mai multe interacțiuni. `::int` ca să vină number, nu string.
//
// BUG REAL, CRITIC găsit la debugging e2e (2026-08-06, verificat direct pe date de producție —
// un detaliu cu 5 comentarii reale întorcea 0): fără calificare explicită, `${details.id}` necalificat
// într-un subquery pe `comments`/`validations`/`sketches` SE REZOLVĂ la coloana `id` a SUBQUERY-ULUI
// (toate tabelele au o coloană `id`), nu la `details.id` din exterior — Postgres tratează
// identificatorul necalificat ca aparținând scope-ului cel mai apropiat. Rezultat: corelarea devine
// `comments.target_id = comments.id`, aproape mereu FALS → contor mereu 0, silențios, fără eroare SQL.
// A afectat feed-ul ÎNTREG (contoare de comentarii/validări/schițe greșite) ȘI `interactionScore`
// (sortarea „cele mai dezbătute" era efectiv doar pe dată, scorul fiind mereu 0 pentru toți).
// ACEEAȘI capcană fusese deja găsită și reparată în `profileRepo.ts` (2026-07-23) — fix-ul NU fusese
// propagat aici. Reparat cu ACELAȘI pattern: `sql.identifier` calificat explicit, nu interpolare directă.
const detailsId = sql`${sql.identifier("details")}.${sql.identifier("id")}`;
const detailsAuthorId = sql`${sql.identifier("details")}.${sql.identifier("author_id")}`;
const validationCount = sql<number>`(select count(*)::int from ${validations}
   where ${validations.targetType} = 'DETAIL' and ${validations.targetId} = ${detailsId}
     and ${validations.hiddenAfterRelease} = false)`;
const commentCount = sql<number>`(select count(*)::int from ${comments}
   where ${comments.targetType} = 'DETAIL' and ${comments.targetId} = ${detailsId}
     and ${comments.hiddenAfterRelease} = false)`;
// „N schițe" = ce apare ca tab în teanc. Adnotarea (isAnnotation=true, 2026-08-11 — vezi
// server/domain/sketch.ts) e exclusă; un desen ULTERIOR al autorului pe propriul detaliu, prin
// „Schițează peste" normal, INTRĂ aici (nu mai e derivat din identitatea autorului).
const sketchCount = sql<number>`(select count(*)::int from ${sketches}
   where ${sketches.detailId} = ${detailsId} and ${sketches.status} = 'PUBLISHED'
     and ${sketches.isAnnotation} = false)`;

// Scor de interacțiune = suma celor trei (caracter de comunitate, pentru sortare).
const interactionScore = sql<number>`(${validationCount} + ${commentCount} + ${sketchCount})`;

// Avatarele validatorilor (max 5, cei mai recenți) pentru stiva de pe cardul de feed —
// „cine a luat poziție". Subquery corelat → array JSON, ca să nu dublăm rândurile detaliului.
// Overflow-ul (+N) îl calculează UI-ul din validationCount, nu îl aducem aici.
const validatorAvatars = sql<{ name: string | null; image: string | null }[]>`(
  select coalesce(json_agg(json_build_object('name', sub.name, 'image', sub.image)), '[]'::json)
  from (
    select ${users.name} as name, ${users.image} as image
    from ${validations}
    join ${users} on ${users.id} = ${validations.userId}
    where ${validations.targetType} = 'DETAIL' and ${validations.targetId} = ${detailsId}
    order by ${validations.createdAt} desc
    limit 5
  ) sub
)`;

// Câte detalii sunt vizibile ACUM pe feed-ul public, indiferent de categorie/căutare — ACEEAȘI condiție
// de vizibilitate ca `listFeed` (PUBLISHED + fără proiect). „Toate detaliile" din sidebar trebuie să
// numere direct asta, NU derivat din suma badge-urilor de categorie (fragilă: un detaliu necategorizat
// n-ar intra în nicio sumă, unul cu 2 categorii ar intra de 2 ori — vezi listCategoriesWithCounts).
export async function countPublishedDetails(): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(details)
    .where(and(eq(details.status, DETAIL_STATUS.PUBLISHED), isNull(details.projectId)));
  return row?.count ?? 0;
}

// Feed finit: doar PUBLISHED, opțional filtrat pe categorie, limitat.
// Sortare strict cronologică (cele mai noi primele) — interacțiunile sunt afișate per card
// (validationCount/commentCount/sketchCount) dar NU dictează ordinea. Rail-ul „cele mai dezbătute"
// (listTopDebated) e cel care sortează pe scor de interacțiune, global, independent de acest feed.
export async function listFeed(input: { categoryId?: string | null; q?: string | null; limit: number }) {
  // Proiecte (2026-08-09): feed-ul comunității nu include NICIODATĂ detalii de proiect, indiferent
  // cine e viewer-ul — asta e explicit vederea PUBLICĂ. Membrii unui proiect îl văd pe pagina lui,
  // nu aici (vezi projectService.listProjectDetails).
  const conds = [eq(details.status, DETAIL_STATUS.PUBLISHED), isNull(details.projectId)];
  if (input.categoryId) conds.push(hasAnyCategory([input.categoryId]));
  // Căutare simplă pe titlu (ILIKE, case-insensitive). `%` din input e escapat ca să fie literal.
  if (input.q) {
    const term = `%${input.q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
    conds.push(sql`${details.title} ilike ${term}`);
  }
  const where = and(...conds);

  return db
    .select({
      ...detailWithAuthorColumns,
      validationCount,
      commentCount,
      sketchCount,
      validatorAvatars,
      interactionCount: interactionScore,
    })
    .from(details)
    .leftJoin(users, eq(users.id, details.authorId))
    .leftJoin(roles, eq(roles.userId, details.authorId))
    .where(where)
    .orderBy(desc(details.createdAt))
    .limit(input.limit);
}

// „Cele mai dezbătute" (rail-ul din feed) — top N global pe scor de interacțiune (validări+comentarii+
// schițe), independent de filtrele/paginarea feed-ului principal (altfel rail-ul ar reflecta doar un
// subset, nu adevăratul top). Feed-ul principal e strict cronologic — vezi `listFeed`.
export async function listTopDebated(limit: number) {
  return db
    .select({
      id: details.id,
      title: details.title,
      categories: detailCategoriesJson,
      // Aceeași mască de anonimizare ca în `detailWithAuthorColumns` — altfel rail-ul „cele mai
      // dezbătute" ar fi continuat să afișeze numele unui autor care s-a retras.
      isAnonymized: sql<boolean>`${details.anonymizedAt} is not null`,
      authorName: sql<string | null>`case when ${details.anonymizedAt} is null then ${users.name} end`,
      authorImage: sql<string | null>`case when ${details.anonymizedAt} is null then ${users.image} end`,
      authorRoleMain: sql<string | null>`case when ${details.anonymizedAt} is null then ${roles.roleMain}::text
        else ${details.authorRoleSnapshot}->>'roleMain' end`,
      authorSubRole: sql<string | null>`case when ${details.anonymizedAt} is null then ${roles.subRole}
        else ${details.authorRoleSnapshot}->>'subRole' end`,
      authorVerification: sql<string | null>`case when ${details.anonymizedAt} is null then ${roles.verificationStatus}::text
        else ${details.authorRoleSnapshot}->>'verificationStatus' end`,
      validationCount,
      commentCount,
      sketchCount,
    })
    .from(details)
    .leftJoin(users, eq(users.id, details.authorId))
    .leftJoin(roles, eq(roles.userId, details.authorId))
    // Proiecte (2026-08-09): rail public, exclude detaliile de proiect — vezi nota de la listFeed.
    .where(and(eq(details.status, DETAIL_STATUS.PUBLISHED), isNull(details.projectId)))
    .orderBy(sql`${interactionScore} desc`, desc(details.createdAt))
    .limit(limit);
}

// Detalii înrudite = cel puțin o categorie comună (regula e „bifezi oricâte"), PUBLISHED, exclus self.
// Pentru sidebar-ul paginii de detaliu. Sortare după interacțiuni, tie-break pe dată.
export async function listRelatedDetails(input: {
  detailId: string;
  categoryIds: string[];
  limit: number;
}) {
  if (input.categoryIds.length === 0) return [];
  return db
    .select({
      id: details.id,
      title: details.title,
      // Vezi nota de la `listTopDebated`: masca de anonimizare se aplică pe FIECARE cale de citire.
      authorName: sql<string | null>`case when ${details.anonymizedAt} is null then ${users.name} end`,
      authorRoleMain: sql<string | null>`case when ${details.anonymizedAt} is null then ${roles.roleMain}::text
        else ${details.authorRoleSnapshot}->>'roleMain' end`,
      authorSubRole: sql<string | null>`case when ${details.anonymizedAt} is null then ${roles.subRole}
        else ${details.authorRoleSnapshot}->>'subRole' end`,
      authorVerification: sql<string | null>`case when ${details.anonymizedAt} is null then ${roles.verificationStatus}::text
        else ${details.authorRoleSnapshot}->>'verificationStatus' end`,
      commentCount,
      sketchCount,
    })
    .from(details)
    .leftJoin(users, eq(users.id, details.authorId))
    .leftJoin(roles, eq(roles.userId, details.authorId))
    .where(
      and(
        eq(details.status, DETAIL_STATUS.PUBLISHED),
        // Proiecte (2026-08-09): sidebar public, exclude detaliile de proiect — vezi nota de la listFeed.
        isNull(details.projectId),
        hasAnyCategory(input.categoryIds),
        ne(details.id, input.detailId),
      ),
    )
    .orderBy(sql`${interactionScore} desc`, desc(details.createdAt))
    .limit(input.limit);
}

// ───────────────────────── Bookmark (saved_details) ─────────────────────────

// Salvează un detaliu pentru un user. Idempotent: dacă e deja salvat, nu face nimic (PK compus).
export async function insertSavedDetail(userId: string, detailId: string) {
  await db
    .insert(savedDetails)
    .values({ userId, detailId })
    .onConflictDoNothing({ target: [savedDetails.userId, savedDetails.detailId] });
}

// Scoate un detaliu din salvate (doar rândul userului curent).
export async function deleteSavedDetail(userId: string, detailId: string) {
  await db
    .delete(savedDetails)
    .where(and(eq(savedDetails.userId, userId), eq(savedDetails.detailId, detailId)));
}

// „Userul a salvat acest detaliu?" — pentru starea butonului din meniul de detaliu.
export async function isDetailSavedByUser(userId: string, detailId: string): Promise<boolean> {
  const [row] = await db
    .select({ one: sql`1` })
    .from(savedDetails)
    .where(and(eq(savedDetails.userId, userId), eq(savedDetails.detailId, detailId)))
    .limit(1);
  return !!row;
}

// Care dintre detaliile date sunt deja salvate de user — batch (feed), evită N+1 (pattern identic cu
// getMyPositions din validationService).
export async function listSavedDetailIds(userId: string, detailIds: string[]): Promise<string[]> {
  if (detailIds.length === 0) return [];
  const rows = await db
    .select({ detailId: savedDetails.detailId })
    .from(savedDetails)
    .where(and(eq(savedDetails.userId, userId), inArray(savedDetails.detailId, detailIds)));
  return rows.map((r) => r.detailId);
}

// Proiecte (2026-08-09): „acest user mai are voie să vadă acest detaliu?" — pentru liste PRIVATE ale
// userului (/saved, „Ofertele mele") unde un detaliu de proiect e legitim dacă userul ÎNCĂ e owner/
// membru activ al proiectului lui. Un detaliu în comunitate (projectId null) trece mereu. Diferit de
// listFeed/listTopDebated/listRelatedDetails (acelea sunt PUBLICE, orice detaliu de proiect e exclus
// necondiționat, indiferent de viewer) — aici viewerul e chiar proprietarul listei.
export function hasProjectAccessForUser(userId: string) {
  return or(
    isNull(details.projectId),
    exists(
      db
        .select({ one: sql`1` })
        .from(projects)
        .where(and(eq(projects.id, details.projectId), eq(projects.ownerId, userId))),
    ),
    exists(
      db
        .select({ one: sql`1` })
        .from(projectMembers)
        .where(
          and(
            eq(projectMembers.projectId, details.projectId),
            eq(projectMembers.userId, userId),
            isNull(projectMembers.removedAt),
          ),
        ),
    ),
  );
}

// Detaliile salvate de un user, în forma de card (FeedItem) — refolosește DetailCard din feed.
// Doar PUBLISHED (un detaliu șters cade oricum din saved_details prin FK cascade). Ordine: cele mai
// recent salvate primele (după saved_details.created_at, nu după data detaliului).
export async function listSavedDetails(userId: string) {
  return db
    .select({
      ...detailWithAuthorColumns,
      validationCount,
      commentCount,
      sketchCount,
      validatorAvatars,
      interactionCount: interactionScore,
    })
    .from(savedDetails)
    .innerJoin(details, eq(details.id, savedDetails.detailId))
    .leftJoin(users, eq(users.id, details.authorId))
    .leftJoin(roles, eq(roles.userId, details.authorId))
    .where(
      and(
        eq(savedDetails.userId, userId),
        eq(details.status, DETAIL_STATUS.PUBLISHED),
        // Proiecte: un membru eliminat nu mai vede pe /saved ce a salvat cât era încă membru.
        hasProjectAccessForUser(userId),
      ),
    )
    .orderBy(desc(savedDetails.createdAt));
}

// Detaliile pe care userul (Furnizor) a ridicat mâna — pagina PRIVATĂ „Ofertele mele". Aceeași formă de
// card ca la /saved, dar sursa e `supplier_offers`, nu `saved_details` — sunt entități separate (auto-save-ul
// din toggleSupplierOffer NU înseamnă că userul e listat aici prin bookmark, ci prin oferta reală).
export async function listOfferedDetails(userId: string) {
  return db
    .select({
      ...detailWithAuthorColumns,
      validationCount,
      commentCount,
      sketchCount,
      validatorAvatars,
      interactionCount: interactionScore,
    })
    .from(supplierOffers)
    .innerJoin(details, eq(details.id, supplierOffers.detailId))
    .leftJoin(users, eq(users.id, details.authorId))
    .leftJoin(roles, eq(roles.userId, details.authorId))
    .where(
      and(
        eq(supplierOffers.userId, userId),
        eq(details.status, DETAIL_STATUS.PUBLISHED),
        // Proiecte: idem — vezi hasProjectAccessForUser / listSavedDetails.
        hasProjectAccessForUser(userId),
      ),
    )
    .orderBy(desc(supplierOffers.createdAt));
}

export type FeedItem = Awaited<ReturnType<typeof listFeed>>[number];
