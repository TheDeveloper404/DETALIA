// Repo profil — agregări pentru pagina de profil (stats + taburi Detalii/Schițe/Activitate).
// Totul DERIVAT din tabelele existente (fără tabel de evenimente separat): validations/comments/details/sketches
// au deja `created_at`. Citiri, fără mutații.
import { alias } from "drizzle-orm/pg-core";
import { and, count, desc, eq, exists, gte, inArray, isNull, ne, or, sql, type SQL } from "drizzle-orm";
import { type PgColumn } from "drizzle-orm/pg-core";

import { db } from "@/db";
import { categories, comments, detailCategories, details, sketches, validations } from "@/db/schema";

// Ziua (UTC) a unui timestamp, ca 'YYYY-MM-DD' — cheie pentru heatmap-ul de contribuții.
function dayUtc(col: PgColumn): SQL<string> {
  return sql<string>`to_char(${col} at time zone 'UTC', 'YYYY-MM-DD')`;
}

// Ținta unei validări / unui comentariu NU atârnă de un detaliu de proiect: fie e un detaliu fără
// `project_id`, fie o schiță de pe un astfel de detaliu. Scris ca NOT EXISTS pe cazul PRIVAT (mult mai
// selectiv decât un IN peste toate detaliile publice).
// Coloanele tabelului EXTERIOR sunt calificate explicit cu `sql.identifier` — vezi capcana recidivantă
// din detailsRepo.ts: un subquery corelat pe un tabel cu coloană omonimă se corelează silențios cu el
// însuși, nu cu exteriorul.
function targetNotInProject(outerTable: "validations" | "comments"): SQL {
  const targetId = sql`${sql.identifier(outerTable)}.${sql.identifier("target_id")}`;
  const targetType = sql`${sql.identifier(outerTable)}.${sql.identifier("target_type")}`;
  return sql`not exists (
      select 1 from ${details}
       where ${targetType} = 'DETAIL' and ${details.id} = ${targetId}
         and ${details.projectId} is not null)
    and not exists (
      select 1 from ${sketches}
       join ${details} on ${details.id} = ${sketches.detailId}
       where ${targetType} = 'SKETCH' and ${sketches.id} = ${targetId}
         and ${details.projectId} is not null)`;
}

// Contribuții pe zi (UTC) din momentul `since`: validări date + comentarii + detalii publicate + schițe trimise.
// DERIVAT din tabele (fără activity log). Întoarce Map zi→număr total de contribuții.
export async function getContributionCounts(
  userId: string,
  since: Date,
): Promise<Map<string, number>> {
  const vDay = dayUtc(validations.createdAt);
  const cDay = dayUtc(comments.createdAt);
  const dDay = dayUtc(details.createdAt);
  const sDay = dayUtc(sketches.createdAt);

  const [v, c, d, s] = await Promise.all([
    db
      .select({ day: vDay, c: count() })
      .from(validations)
      .where(
        and(
          eq(validations.userId, userId),
          gte(validations.createdAt, since),
          // Proiecte (2026-08-09): o validare dată înăuntrul unui proiect privat nu aprinde ziua în
          // heatmap-ul public — altfel volumul de activitate privată ar fi vizibil oricui.
          targetNotInProject("validations"),
        ),
      )
      .groupBy(vDay),
    db
      .select({ day: cDay, c: count() })
      .from(comments)
      .where(
        and(
          eq(comments.authorId, userId),
          gte(comments.createdAt, since),
          // Proiecte (2026-08-09): idem — comentariu într-un proiect privat, invizibil în heatmap.
          targetNotInProject("comments"),
        ),
      )
      .groupBy(cDay),
    db
      .select({ day: dDay, c: count() })
      .from(details)
      .where(
        and(
          eq(details.authorId, userId),
          eq(details.status, "PUBLISHED"),
          gte(details.createdAt, since),
          // Proiecte (2026-08-09): un detaliu de proiect nu apare NICĂIERI pe profilul public —
          // nici măcar ca număr anonim în heatmap-ul de contribuții. Vezi restul fișierului.
          isNull(details.projectId),
        ),
      )
      .groupBy(dDay),
    db
      .select({ day: sDay, c: count() })
      .from(sketches)
      .where(
        and(
          eq(sketches.authorId, userId),
          ne(sketches.status, "DRAFT"),
          gte(sketches.createdAt, since),
          // Identitate retrasă → nici în heatmap. Altfel ar rămâne o zi de activitate fără corespondent
          // nici în contor, nici în listă (ambele filtrează deja) — o urmă a legăturii tocmai retrase.
          eq(sketches.authorRemoved, false),
          // SEC-002 (2026-08-10): schiță ascunsă la „Scoate în comunitate" → nu apare în heatmap-ul public.
          eq(sketches.hiddenAfterRelease, false),
          // Proiecte (2026-08-09): schiță pe un detaliu de proiect → nu apare în heatmap-ul public.
          exists(
            db.select({ one: sql`1` }).from(details).where(
              and(eq(details.id, sketches.detailId), isNull(details.projectId)),
            ),
          ),
        ),
      )
      .groupBy(sDay),
  ]);

  const map = new Map<string, number>();
  for (const rows of [v, c, d, s]) {
    for (const r of rows) map.set(r.day, (map.get(r.day) ?? 0) + Number(r.c));
  }
  return map;
}

// ── Statistici (4 contoare mici, indexate) ──────────────────────────────────
export async function getProfileStats(userId: string) {
  // Proiecte (2026-08-09): un detaliu de proiect nu se numără în statisticile publice — nici măcar
  // indirect, prin validările primite pe el.
  const myDetailIds = db
    .select({ id: details.id })
    .from(details)
    .where(and(eq(details.authorId, userId), isNull(details.projectId)));
  // Proiecte (gol găsit la /code-review, 2026-08-09): lipsea filtrul isNull(details.projectId), spre
  // deosebire de myDetailIds de mai sus — validările primite pe o schiță de pe un detaliu de proiect
  // se numărau în statistica publică `received`, deși schița în sine nu e vizibilă public.
  const mySketchIds = db
    .select({ id: sketches.id })
    .from(sketches)
    .innerJoin(details, eq(details.id, sketches.detailId))
    .where(
      and(
        eq(sketches.authorId, userId),
        isNull(details.projectId),
        // SEC-002: validările primite pe o schiță ascunsă la release nu se numără public.
        eq(sketches.hiddenAfterRelease, false),
      ),
    );

  const [published, sketchesProposed, given, received] = await Promise.all([
    db
      .select({ c: count() })
      .from(details)
      // Detaliile din care autorul s-a retras nu se mai numără aici — altfel contorul ar spune 5 și
      // lista de dedesubt ar arăta 4, iar diferența ar semnala exact ce a fost ascuns.
      .where(
        and(
          eq(details.authorId, userId),
          eq(details.status, "PUBLISHED"),
          isNull(details.anonymizedAt),
          // Proiecte (2026-08-09): idem — vezi comentariul de la myDetailIds.
          isNull(details.projectId),
        ),
      ),
    // „Schițe propuse" = trimise (orice în afară de DRAFT), pe detaliile ALTORA. Adnotarea pe
    // propriul detaliu nu e o propunere către cineva → exclusă (mirror SQL al `isSelfAnnotation`).
    db
      .select({ c: count() })
      .from(sketches)
      .innerJoin(details, eq(details.id, sketches.detailId))
      .where(
        and(
          eq(sketches.authorId, userId),
          ne(sketches.status, "DRAFT"),
          ne(sketches.authorId, details.authorId),
          // Identitate retrasă → nu se mai numără ca realizare a userului (mirror al filtrului din
          // `listAuthorSketches`; altfel contorul ar contrazice lista de sub el).
          eq(sketches.authorRemoved, false),
          // SEC-002: schiță ascunsă la release → nu se numără printre „Schițe propuse".
          eq(sketches.hiddenAfterRelease, false),
          // Proiecte (2026-08-09): schiță pe un detaliu de proiect → nu se numără public.
          isNull(details.projectId),
        ),
      ),
    // „Dat" — proiecte (2026-08-09): validările date înăuntrul unui proiect privat nu se numără în
    // statistica publică, simetric cu `received` de mai jos.
    db
      .select({ c: count() })
      .from(validations)
      .where(and(eq(validations.userId, userId), targetNotInProject("validations"))),
    // Validări primite = poziții luate de alții pe detaliile/schițele acestui user.
    db
      .select({ c: count() })
      .from(validations)
      .where(
        or(
          and(
            eq(validations.targetType, "DETAIL"),
            inArray(validations.targetId, myDetailIds),
          ),
          and(
            eq(validations.targetType, "SKETCH"),
            inArray(validations.targetId, mySketchIds),
          ),
        ),
      ),
  ]);

  return {
    published: published[0]?.c ?? 0,
    sketches: sketchesProposed[0]?.c ?? 0,
    validationsGiven: given[0]?.c ?? 0,
    validationsReceived: received[0]?.c ?? 0,
  };
}

// ── Tab Detalii — detaliile PUBLISHED ale userului, cu contoare. ─────────────
// BUG găsit 2026-07-23: fără JOIN în query-ul exterior, Drizzle NU calificiază `${details.id}` cu
// numele tabelului ("id" simplu, nu "details"."id") — în subquery-uri care au ELE ÎNSELE o coloană
// `id` (validations.id, comments.id, categories.id...), Postgres rezolvă referința ambiguă la coloana
// PROPRIE a subquery-ului, nu la details.id din exterior. Rezultat: corelarea se rupe silențios, count-ul
// iese aproape mereu 0 (sau categoria mereu null). Cu JOIN prezent (ex. detailsRepo.ts — join pe
// users/roles), Drizzle calificiază corect — de-aia feed-ul era corect și profilul nu. Fix: calificăm
// EXPLICIT outer-ul cu sql.identifier (nu string brut), indiferent dacă query-ul are join sau nu.
const detailsId = sql`${sql.identifier("details")}.${sql.identifier("id")}`;
// ACEEAȘI capcană pentru `author_id`, și mai perfidă: subquery-ul de mai jos e pe `sketches`, care are
// ȘI EL o coloană `author_id` → un `${details.authorId}` necalificat s-ar rezolva la `sketches.author_id`,
// iar condiția ar deveni `sketches.author_id <> sketches.author_id` = mereu FALSĂ (contor mereu 0).
const detailsAuthorId = sql`${sql.identifier("details")}.${sql.identifier("author_id")}`;

const detailValidationCount = sql<number>`(select count(*)::int from ${validations}
   where ${validations.targetType} = 'DETAIL' and ${validations.targetId} = ${detailsId})`;
const detailCommentCount = sql<number>`(select count(*)::int from ${comments}
   where ${comments.targetType} = 'DETAIL' and ${comments.targetId} = ${detailsId})`;
// Ca în detailsRepo: contorul arată contribuțiile ALTORA, nu adnotarea proprie a autorului.
const detailSketchCount = sql<number>`(select count(*)::int from ${sketches}
   where ${sketches.detailId} = ${detailsId} and ${sketches.status} = 'PUBLISHED'
     and ${sketches.authorId} <> ${detailsAuthorId}
     and ${sketches.hiddenAfterRelease} = false)`;

// Prima categorie (alfabetic) bifată pe detaliu — suficient pt badge-ul de card (regula e „bifezi oricâte",
// dar cardul de profil arată doar un rezumat, nu toate categoriile).
const firstCategoryName = sql<string | null>`(
  select ${categories.name}
  from ${detailCategories}
  join ${categories} on ${categories.id} = ${detailCategories.categoryId}
  where ${detailCategories.detailId} = ${detailsId}
  order by ${categories.name}
  limit 1
)`;

export function listAuthorDetails(userId: string) {
  return db
    .select({
      id: details.id,
      title: details.title,
      imageUrl: details.imageUrl,
      categoryName: firstCategoryName,
      validationCount: detailValidationCount,
      commentCount: detailCommentCount,
      sketchCount: detailSketchCount,
    })
    .from(details)
    // `anonymized_at is null`: un detaliu din care autorul s-a RETRAS nu mai apare pe profilul lui —
    // altfel oricine ar deschide profilul ar reface legătura pe care retragerea tocmai a rupt-o
    // („Autor șters" pe pagina detaliului, dar listat pe profilul lui X = anonimizare doar de fațadă).
    .where(
      and(
        eq(details.authorId, userId),
        eq(details.status, "PUBLISHED"),
        isNull(details.anonymizedAt),
        // Proiecte (2026-08-09): un detaliu de proiect NU apare pe profilul public (nici titlu, nici
        // imagine) — vizibil DOAR pe pagina proiectului, pentru membri. Vezi server/domain/project.ts.
        isNull(details.projectId),
      ),
    )
    .orderBy(desc(details.createdAt));
}

// ── Tab Schițe — schițele trimise ale userului (non-DRAFT), cu titlul detaliului-mamă. ──
export function listAuthorSketches(userId: string) {
  return db
    .select({
      id: sketches.id,
      status: sketches.status,
      detailId: sketches.detailId,
      parentTitle: details.title,
      thumbnailUrl: sketches.thumbnailUrl,
    })
    .from(sketches)
    .innerJoin(details, eq(details.id, sketches.detailId))
    .where(
      and(
        eq(sketches.authorId, userId),
        ne(sketches.status, "DRAFT"),
        // Adnotarea pe propriul detaliu se vede pe detaliu (tabul Detalii), nu ca schiță separată aici.
        ne(sketches.authorId, details.authorId),
        // Identitate RETRASĂ (ștergere parțială, 2026-08-08): desenul rămâne pe detaliu ca parte din
        // dezbatere, dar legătura cu autorul dispare — inclusiv de pe profilul lui, unde userul se
        // așteaptă cel mai tare să nu mai apară. `author_id` rămâne în DB doar ca ancoră tehnică.
        eq(sketches.authorRemoved, false),
        // SEC-002: schiță ascunsă la release → nu apare pe tabul „Schițe" al profilului.
        eq(sketches.hiddenAfterRelease, false),
        // Proiecte (2026-08-09): schiță pe un detaliu de proiect → nu apare pe profilul public
        // (parentTitle ar dezvălui titlul unui detaliu privat).
        isNull(details.projectId),
      ),
    )
    .orderBy(desc(sketches.createdAt));
}

// ── Tab Activitate — flux derivat (validări + comentarii + publicări), cel mai recent sus. ──
// Titlul țintei polimorfice se rezolvă prin join-uri: DETAIL direct, SKETCH → detaliul-mamă.
const sketchParent = alias(details, "sketch_parent_detail");

export async function listAuthorActivity(userId: string, limit: number) {
  // Validări (aprob/dezaprob) + titlul țintei.
  const vRows = await db
    .select({
      id: validations.id,
      position: validations.position,
      createdAt: validations.createdAt,
      roleSnapshot: validations.roleSnapshot, // rolul la momentul votului (afișare istorică)
      detailTitle: details.title,
      sketchParentTitle: sketchParent.title,
    })
    .from(validations)
    .leftJoin(
      details,
      and(eq(validations.targetType, "DETAIL"), eq(details.id, validations.targetId)),
    )
    .leftJoin(
      sketches,
      and(eq(validations.targetType, "SKETCH"), eq(sketches.id, validations.targetId)),
    )
    .leftJoin(sketchParent, eq(sketchParent.id, sketches.detailId))
    .where(
      and(
        eq(validations.userId, userId),
        // Proiecte (2026-08-09): țintă DETAIL într-un proiect → `details` s-a potrivit prin join,
        // exclus. Țintă SKETCH pe un detaliu de proiect → `sketchParent` s-a potrivit, exclus. Pentru
        // rândul „celălalt" tip de țintă, join-ul nepotrivit lasă coloana null → condiția e no-op
        // (vezi nota similară din listAuthorSketches pentru schema de join).
        isNull(details.projectId),
        isNull(sketchParent.projectId),
      ),
    )
    .orderBy(desc(validations.createdAt))
    .limit(limit);

  // Comentarii + titlul țintei.
  const cRows = await db
    .select({
      id: comments.id,
      createdAt: comments.createdAt,
      isJustification: sql<boolean>`${comments.originValidationId} is not null`,
      detailTitle: details.title,
      sketchParentTitle: sketchParent.title,
    })
    .from(comments)
    .leftJoin(
      details,
      and(eq(comments.targetType, "DETAIL"), eq(details.id, comments.targetId)),
    )
    .leftJoin(
      sketches,
      and(eq(comments.targetType, "SKETCH"), eq(sketches.id, comments.targetId)),
    )
    .leftJoin(sketchParent, eq(sketchParent.id, sketches.detailId))
    .where(
      and(
        eq(comments.authorId, userId),
        // Proiecte (2026-08-09): vezi nota identică de la vRows, mai sus.
        isNull(details.projectId),
        isNull(sketchParent.projectId),
      ),
    )
    .orderBy(desc(comments.createdAt))
    .limit(limit);

  // Detalii publicate.
  const dRows = await db
    .select({ id: details.id, title: details.title, createdAt: details.createdAt })
    .from(details)
    // Activitatea afișează TITLUL detaliului — un detaliu din care autorul s-a retras l-ar lega direct
    // înapoi de el. Exclus, ca peste tot pe profil.
    .where(
      and(
        eq(details.authorId, userId),
        eq(details.status, "PUBLISHED"),
        isNull(details.anonymizedAt),
        // Proiecte (2026-08-09): idem — vezi listAuthorDetails.
        isNull(details.projectId),
      ),
    )
    .orderBy(desc(details.createdAt))
    .limit(limit);

  return { vRows, cRows, dRows };
}
