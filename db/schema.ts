// Schema Drizzle — sursa de adevăr a modelului de date (vezi docs/SCHEMA.md ca design doc).
// Convenții: tabele snake_case plural, coloane snake_case (via `casing: "snake_case"`),
// PK uuid gen_random_uuid(), created_at/updated_at standard, toate FK indexate.
//
// Conține: (A) tabelele cerute de adapterul Auth.js Drizzle (users/accounts/sessions/verification_tokens)
// — cu cheile TS exacte pe care le cere adapterul — și (B) tabelele de domeniu DETALIA.

import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// ───────────────────────────── Enum-uri ─────────────────────────────
export const userStatus = pgEnum("user_status", ["ACTIVE", "SUSPENDED", "DELETED"]);
export const roleMain = pgEnum("role_main", [
  "PROIECTANT",
  "EXECUTANT",
  "FURNIZOR",
  "BENEFICIAR",
]);
export const verificationStatus = pgEnum("verification_status", [
  "DECLARED",
  "PENDING",
  "VERIFIED",
  "REJECTED",
]);
export const targetType = pgEnum("target_type", ["DETAIL", "SKETCH"]);
export const validationPosition = pgEnum("validation_position", ["APPROVE", "DISAPPROVE"]);
export const commentVoteDirection = pgEnum("comment_vote_direction", ["UP", "DOWN"]);
export const sketchStatus = pgEnum("sketch_status", [
  "DRAFT",
  "PENDING_ACCEPTANCE",
  "PUBLISHED",
  "REJECTED",
]);
export const detailResourceType = pgEnum("detail_resource_type", [
  "IMAGE",
  "LINK",
  "TEXT",
  "PDF",
  "CAD",
]);
export const notificationType = pgEnum("notification_type", [
  "SKETCH_PROPOSED",
  // SKETCH_ACCEPTED / SKETCH_REJECTED — moștenite din fluxul vechi cu coadă de acceptare (eliminat
  // 2026-06-30: schițele se publică direct). Păstrate în enum (valori existente în DB), nemaiproduse.
  "SKETCH_ACCEPTED",
  "SKETCH_REJECTED",
  // Autorul detaliului a șters o schiță de pe detaliul lui (moderare post-publicare).
  "SKETCH_DELETED",
  // Un FURNIZOR a „ridicat mâna" (poate oferta materiale) pe detaliul autorului — doar la primul click.
  "SUPPLIER_OFFERED",
]);

// ════════════════════ (A) Tabele Auth.js (adapter Drizzle) ════════════════════
// Cheile TS (emailVerified, sessionToken, userId, providerAccountId, ...) trebuie să rămână
// exact așa — adapterul le accesează după nume. Coloanele din DB devin snake_case prin `casing`.

export const users = pgTable("users", {
  id: uuid().defaultRandom().primaryKey(),
  name: text(),
  email: text().notNull().unique(),
  emailVerified: timestamp({ withTimezone: true, mode: "date" }),
  image: text(),
  // Extensii DETALIA peste tabelul standard Auth.js:
  status: userStatus().notNull().default("ACTIVE"),
  // Profil extins (colectat la onboarding, editabil din /profile). `name` rămâne (Auth.js) și e
  // compus din firstName + lastName la onboarding pentru compatibilitate cu codul care-l citește.
  firstName: text(),
  lastName: text(),
  headline: text(),
  about: text(),
  location: text(),
  website: text(),
  // Firma pe care o reprezintă userul (opțional, auto-declarat — ca locația/website-ul).
  company: text(),
  // Contact opțional (2026-07-16) — ajută doi useri să se conecteze direct. PRIVAT implicit:
  // vizibil altor useri DOAR dacă userul bifează explicit vizibilitatea (opt-in, nu opt-out). Emailul
  // (coloana `email` de mai sus, deja folosită la login) capătă propriul flag separat — până acum nu era
  // afișat nicăieri public; rămâne privat implicit și după acest flag, dacă userul nu-l activează.
  phone: text(),
  phoneVisible: boolean().notNull().default(false),
  emailVisible: boolean().notNull().default(false),
  coverImage: text(),
  // Poziția verticală a imaginii de cover (object-position Y, 0..100). Permite mutarea sus/jos a benzii.
  coverPosition: integer().notNull().default(50),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  // Ultimul set de badge-uri VĂZUT de user (Record<BadgeId, BadgeTier>), pentru pop-up-ul „ai primit un
  // badge nou" — badge-urile sunt calculate LIVE din statistici (server/domain/badges.ts), fără tabelă
  // proprie, deci avem nevoie de un singur snapshot ca să detectăm ce e NOU față de ultima vizită pe
  // propriul profil (nu doar ce e câștigat). Actualizat de `markBadgesSeen`, DOAR pe propriul profil.
  seenBadges: jsonb().notNull().default({}),
  // Ultima versiune VĂZUTĂ a panoului „Ce e nou" (server/domain/announcements.ts). `null` pentru useri
  // vechi = nu au văzut nimic încă. Actualizată de `markAnnouncementSeen`, doar pe propriul cont.
  lastSeenAnnouncementVersion: text(),
  // Turul ghidat de pe pagina de detaliu (components/detail-product-tour.tsx) a fost arătat vreodată?
  // Spre deosebire de turul din feed (`?tour=1`, declanșat o singură dată din onboarding — un singur
  // punct de intrare), pagina de detaliu se poate deschide din zeci de locuri diferite → nu există un
  // moment unic „utilizator nou" de agățat un query param; de-aia flag persistat, nu URL.
  seenDetailTour: boolean().notNull().default(false),
});

export const accounts = pgTable(
  "accounts",
  {
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text().notNull(),
    provider: text().notNull(),
    providerAccountId: text().notNull(),
    refresh_token: text(),
    access_token: text(),
    expires_at: integer(),
    token_type: text(),
    scope: text(),
    id_token: text(),
    session_state: text(),
  },
  (t) => [
    primaryKey({ columns: [t.provider, t.providerAccountId] }),
    index("accounts_user_id_idx").on(t.userId),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    sessionToken: text().primaryKey(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expires: timestamp({ withTimezone: true, mode: "date" }).notNull(),
  },
  (t) => [index("sessions_user_id_idx").on(t.userId)],
);

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text().notNull(),
    token: text().notNull(),
    expires: timestamp({ withTimezone: true, mode: "date" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.identifier, t.token] })],
);

// ════════════════════════ (B) Tabele de domeniu DETALIA ════════════════════════

// Rol declarat de user la signup (un singur rol/user). Vezi docs/SCHEMA.md.
export const roles = pgTable(
  "roles",
  {
    id: uuid().defaultRandom().primaryKey(),
    userId: uuid()
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: "cascade" }),
    roleMain: roleMain().notNull(),
    subRole: text(),
    secondaryRole: text(), // rol aditiv opțional (Administrativ/Educație) — peste meseria de bază
    verificationStatus: verificationStatus().notNull().default("DECLARED"),
    verificationEvidence: text(), // nr. OAR / CUI — PII, nu se loghează
    verifiedByAdminId: uuid().references(() => users.id),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("roles_verified_by_admin_id_idx").on(t.verifiedByAdminId)],
);

// Categorii (arbore, self-FK, până la 3 niveluri: secțiune → capitol → sub-capitol) pentru filtre.
export const categories = pgTable(
  "categories",
  {
    id: uuid().defaultRandom().primaryKey(),
    parentId: uuid(),
    name: text().notNull(),
    slug: text().notNull().unique(),
    // Ordinea din document (lista_categorii.md) — NU alfabetic. Vezi db/seed.ts.
    position: integer().notNull().default(0),
    // true = grupare vizuală, neselectabilă (secțiunile de nivel 1 ȘI „capitolele" care doar
    // se împart în sub-categorii, ex. „Instalații" → Electrice/Sanitare/Termice/HVAC — capitolul
    // însuși nu e un tag bifabil, vezi lista_categorii.md). false = categorie reală, bifabilă.
    isGroup: boolean().notNull().default(false),
  },
  (t) => [index("categories_parent_id_idx").on(t.parentId)],
);

// Detaliu («repository»). Upload seed-only în v1.
export const details = pgTable(
  "details",
  {
    id: uuid().defaultRandom().primaryKey(),
    title: text().notNull(),
    // Text liber „deasupra" imaginii (stil post LinkedIn). Opțional — titlul rămâne obligatoriu.
    description: text(),
    authorId: uuid()
      .notNull()
      .references(() => users.id),
    // Locație (2026-07-16): „România" (implicit) = context tehnic RO complet valabil.
    // Orice altă valoare (text liber „Țară, oraș", introdus de user la pill-ul „Altă locație") =
    // context tehnic RO INVALID pt acel detaliu (enforce în validateDetailInput, nu doar UI) — nu
    // afișăm/acceptăm clasificări românești pe un detaliu din afara României.
    location: text().notNull().default("România"),
    // Zona climatică n-are variantă neutră în listă (Zona I..IV) → nullable, fără default.
    climateZone: text(),
    // Ceilalți parametri tehnici au „General" ca variantă neutră în listă (lista_categorii.md).
    seismicAg: text().notNull().default("General"),
    seismicTc: text().notNull().default("General"),
    snowLoad: text().notNull().default("General"),
    windLoad: text().notNull().default("General"),
    // Nullable din 2026-07-06: o ciornă (status DRAFT) poate fi salvată înainte ca userul să ajungă
    // la upload. La PUBLISHED, imaginea e mereu obligatorie (enforce în validateDetailInput strict).
    imageUrl: text(),
    status: text().notNull().default("PUBLISHED"),
    // ── Ștergere cu retragerea identității (2026-08-06) ──
    // Un detaliu care a strâns interacțiuni (comentarii / poziții / schițe de la alții) NU se mai poate
    // șterge complet — ar rupe discuția pentru toți ceilalți. În locul ștergerii, autorul se poate
    // RETRAGE: numele și poza lui dispar din afișare, ROLUL și conținutul rămân, ca discuția să continue.
    //
    // `authorId` rămâne intact în DB (audit/abuz) — anonimizarea e la nivel de AFIȘARE, impusă pe server
    // (repo-ul nu mai selectează nume/poză pentru rândurile anonimizate), nu ascunsă doar în UI.
    anonymizedAt: timestamp({ withTimezone: true }),
    // Rolul autorului îngheţat în momentul retragerii — după anonimizare nu-l mai putem citi din contul
    // userului (n-am mai avea de unde să știm care era ATUNCI). Același model (și aceeași formă jsonb)
    // ca `validations.roleSnapshot`.
    authorRoleSnapshot: jsonb(),
    // Contor de vizualizări (2026-08-06): „vizualizare" = FIECARE încărcare a paginii
    // detaliului, ca la StackOverflow — NU vizitatori unici (decizie de produs).
    // Incrementat atomic (`views = views + 1`), deci fără condiție de cursă la acces concurent.
    views: integer().notNull().default(0),
    // Proiecte — colaborare restrânsă (2026-08-09). Un detaliu stă mereu într-un SINGUR loc din trei,
    // combinând `status` (existent) cu această coloană: DRAFT+null = ciornă; PUBLISHED+<id> = vizibil
    // DOAR membrilor proiectului; PUBLISHED+null = public, comunitate (ca azi). „Scoate în comunitate"
    // = `projectId = null`, mutație ireversibilă (regulă de business, nu constrângere DB). `onDelete:
    // cascade` prinde doar rândul din `details` (cele deja scoase în comunitate au `projectId = null`,
    // deci nu sunt atinse) — NU e suficient la ștergerea proiectului: validările și comentariile sunt
    // polimorfice (fără FK) și fișierele din Blob nu au cum să cadă în cascadă. Ștergerea completă e
    // orchestrată în projectService.deleteProject, prin deleteDetailCascade pentru fiecare detaliu.
    projectId: uuid().references(() => projects.id, { onDelete: "cascade" }),
    // Proiecte, Faza B (2026-08-11): originea unui detaliu ELIBERAT în comunitate (`projectId = null`
    // acum), păstrată separat ca să rămână un card-preview vizibil în proiectul de unde a plecat — fără
    // asta, „scoate în comunitate" ar face detaliul să dispară complet din proiect, fără urmă. Setată O
    // SINGURĂ DATĂ, la eliberare (niciodată la creare — un detaliu creat direct în proiect n-a fost încă
    // „eliberat" de nicăieri) — vezi `releaseDetailToCommunity`. `ON DELETE SET NULL`: dacă proiectul-sursă
    // dispare, cardul-preview n-are unde să mai trăiască — detaliul rămâne, doar legătura istorică pică.
    releasedFromProjectId: uuid().references(() => projects.id, { onDelete: "set null" }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("details_author_id_idx").on(t.authorId),
    index("details_project_id_idx").on(t.projectId),
    index("details_released_from_project_id_idx").on(t.releasedFromProjectId),
    // Index parțial: acoperă direct feed-ul (listFeed, cronologic pe PUBLISHED) — scan pe index, nu
    // pe tot tabelul, și mai mic decât un index complet (exclude rândurile DRAFT). Feed-ul comunității
    // filtrează ȘI pe `project_id IS NULL` — detaliile de proiect nu trebuie să apară acolo.
    index("details_published_created_idx")
      .on(t.createdAt.desc())
      .where(sql`${t.status} = 'PUBLISHED' AND ${t.projectId} IS NULL`),
  ],
);

// Categorii bifate pe un detaliu — many-to-many (regulă de produs: „bifezi oricâte", stil tag Pinterest).
export const detailCategories = pgTable(
  "detail_categories",
  {
    detailId: uuid()
      .notNull()
      .references(() => details.id, { onDelete: "cascade" }),
    categoryId: uuid()
      .notNull()
      .references(() => categories.id),
  },
  (t) => [
    primaryKey({ columns: [t.detailId, t.categoryId] }),
    index("detail_categories_category_id_idx").on(t.categoryId),
  ],
);

// Max 3 resurse opționale/detaliu (limita „max 3" se aplică în DetailService).
export const detailResources = pgTable(
  "detail_resources",
  {
    id: uuid().defaultRandom().primaryKey(),
    detailId: uuid()
      .notNull()
      .references(() => details.id, { onDelete: "cascade" }),
    type: detailResourceType().notNull(),
    url: text(),
    body: text(),
  },
  (t) => [index("detail_resources_detail_id_idx").on(t.detailId)],
);

// Schiță («fork + PR» — o foaie din teanc). Stroke-uri vectoriale, coordonate normalizate 0..1.
export const sketches = pgTable(
  "sketches",
  {
    id: uuid().defaultRandom().primaryKey(),
    detailId: uuid()
      .notNull()
      .references(() => details.id, { onDelete: "cascade" }),
    authorId: uuid()
      .notNull()
      .references(() => users.id),
    strokesJson: jsonb(),
    // Explicație a autorului în cuvinte, SEPARATĂ de desen (2026-07-16) — vezi MAX_SKETCH_NOTE_LENGTH.
    // Nu e un stroke pe canvas: userul dorea să scrie „ce a vrut să zică prin desen", nu o etichetă
    // plasată pe/lângă foaie (tool-ul de Text cu ancoră în margine arăta prost în practică).
    note: text(),
    thumbnailUrl: text(),
    status: sketchStatus().notNull().default("DRAFT"),
    // Schiță pornită din „Dezaprob → fac o schiță": la publicare materializează automat o poziție
    // DISAPPROVE pe detaliul-mamă + comentariul-justificare (vezi sketchService.publish). Altfel rămâne
    // o simplă contribuție (fără poziție). Default false = schiță neutră.
    disapprovesParent: boolean().notNull().default(false),
    // Adnotarea autorului (2026-08-11): TRUE doar pe rândul creat prin `createAnnotation()`, din
    // formularul de Adaugă/Editează detaliu — explicația autorului pe propria imagine, nu o schiță
    // primită. Înlocuiește derivarea veche din `authorId = detail.authorId` (adevărată pentru ORICE
    // desen al autorului pe propriul detaliu, oricând, nu doar cel de la publicare — bug real).
    isAnnotation: boolean().notNull().default(false),
    // Moment publicare (DRAFT→PUBLISHED). Numele „acceptedAt" e moștenit din fluxul vechi cu acceptare.
    acceptedAt: timestamp({ withTimezone: true }),
    // ── Stack de foi (2026-08-08) ─────────────────────────────────────────────────────────────
    // Rețeta fundalului: id-urile schițelor care erau APRINSE pe ecran când s-a apăsat „Schițează
    // peste", în ordine de jos în sus. Null/gol = pornită de pe detaliul gol (și starea tuturor
    // schițelor dinaintea migrării). Nu se rezolvă recursiv — lista e deja aplatizată la capturare.
    baseSketchIds: jsonb(),
    // Rolul autorului la momentul PUBLICĂRII, pentru afișare istorică după ce identitatea dispare
    // („Autor șters · rol"). Model copiat de la `validations.roleSnapshot`. Se capturează la publish,
    // nu la ștergere: altfel schițele publicate înainte de a exista regula ar rămâne fără rol.
    roleSnapshot: jsonb(),
    // Ștergere „parțială": identitatea autorului a fost retrasă, desenul rămâne pe masă.
    authorRemoved: boolean().notNull().default(false),
    // Setat o SINGURĂ dată, la „Scoate în comunitate" (SEC-002, 2026-08-10): schițele altor membri decât
    // autorul detaliului NU devin publice odată cu detaliul — regula „release publică doar conținutul
    // autorului". Rămâne setat definitiv (nu se poate reintra în proiect din detaliu de comunitate),
    // altfel n-are efect pe schițele autorului sau pe cele create ulterior pe un detaliu deja public.
    hiddenAfterRelease: boolean().notNull().default(false),
    // Setat o SINGURĂ dată, când o ALTĂ schiță care o conține în `baseSketchIds` e PUBLICATĂ (nu la
    // simpla apăsare a butonului). Rămâne setat definitiv, chiar dacă schița care a blocat-o e
    // ștearsă ulterior — altfel ștergerea ar redeveni posibilă retroactiv peste o dezbatere reală.
    lockedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("sketches_detail_id_idx").on(t.detailId),
    index("sketches_author_id_idx").on(t.authorId),
    // Acoperă sketchCount din listFeed/listTopDebated/listRelatedDetails: WHERE detailId = ? AND
    // status = 'PUBLISHED' — indexul single-column pe detailId nu include filtrul de status.
    index("sketches_detail_status_idx").on(t.detailId, t.status),
  ],
);

// ── Proiecte — colaborare restrânsă (2026-08-09) ──────────────────────────────────────────────
// Al treilea strat, pe lângă Detaliu (public) și Planșă (strict privată): un spațiu de colaborare
// restrânsă, tip Google Drive — userul invită oameni printr-un link și lucrează cu ei la detalii
// înainte de a le scoate (opțional, ireversibil) în comunitate. Doar 2 poziții: Autor (owner) și
// Invitați — Invitații se comportă identic cu owner-ul, în rest (nu există Viewer/Editor).
export const projects = pgTable(
  "projects",
  {
    id: uuid().defaultRandom().primaryKey(),
    ownerId: uuid()
      .notNull()
      .references(() => users.id),
    name: text().notNull(),
    // Token opac de invitație — stocat BRUT, intenționat (nu hash, spre deosebire de
    // admin_sessions/admin_login_tokens): e un link de partajare persistent (owner-ul trebuie să-l
    // poată revedea/recopia oricând din pagina proiectului, ca la Slack/Notion/GitHub — nu o
    // credențială de autentificare one-time). Entropie mare (32 bytes random, lib/invite-token.ts)
    // ține locul unde hash-ul ar fi protejat: un token neghicibil, nu unul needevoalabil.
    // Regenerare link = UPDATE pe această coloană (vechiul token devine instant invalid).
    inviteToken: text().notNull(),
    // SEC-006 (audit 2026-08-11): momentul (re)generării tokenului — separat de `updatedAt` (care se
    // schimbă și la alte modificări ale proiectului, ex. redenumire, deci nu poate fi ancora de TTL).
    // Verificat la /projects/join/[token] (lib/invite-token.ts) — expirat = tratat ca token invalid.
    inviteTokenCreatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    unique("projects_invite_token_unique").on(t.inviteToken),
    index("projects_owner_id_idx").on(t.ownerId),
  ],
);

// Membru al unui proiect. UN SINGUR rând per (project, user) — nu istoric de intrări/ieșiri multiple:
// la eliminare, `removedAt` se setează; la re-alăturare (link nou/vechi), ACELAȘI rând se reactivează
// (`removedAt = null`), nu se inserează unul nou. „Autor eliminat" pe conținut se decide prin verificare
// LIVE (există un rând ACTIV pentru acel user+proiect?) — dacă userul revine, redevine automat vizibil
// cu numele lui pe TOT ce a scris în proiect, inclusiv conținut vechi (comportament dorit: e din nou
// membru). Owner-ul NU are neapărat un rând aici — verificarea de acces e membru activ SAU
// `projects.ownerId`, vezi server/services/projectService.ts.
export const projectMembers = pgTable(
  "project_members",
  {
    id: uuid().defaultRandom().primaryKey(),
    projectId: uuid()
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    userId: uuid()
      .notNull()
      .references(() => users.id),
    joinedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    removedAt: timestamp({ withTimezone: true }),
  },
  (t) => [
    unique("project_members_project_user_unique").on(t.projectId, t.userId),
    index("project_members_project_id_idx").on(t.projectId),
    index("project_members_user_id_idx").on(t.userId),
  ],
);

// Partajare planșă în proiect — Faza B (§6B, 2026-08-11): COPIE ÎNGHEȚATĂ, needitabilă, a unei planșe
// personale, la momentul partajării. NU referă `canvases.id` — planșa sursă poate fi editată/ștearsă
// după aceea fără să afecteze partajarea (`imageUrl` e un blob NOU, re-încărcat la export, nu doar
// URL-ul `thumbnailUrl` al planșei sursă — dacă planșa se șterge, `deleteCanvas` șterge blob-ul EI,
// nu pe-al nostru). Pot exista mai multe partajări ale aceleiași planșe, fiecare cu `name`-ul/momentul
// ei (decizie de produs, §6B) — de-asta nu există un unique pe (projectId, sharedByUserId).
export const projectCanvasShares = pgTable(
  "project_canvas_shares",
  {
    id: uuid().defaultRandom().primaryKey(),
    projectId: uuid()
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    sharedByUserId: uuid()
      .notNull()
      .references(() => users.id),
    name: text().notNull(),
    imageUrl: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("project_canvas_shares_project_id_idx").on(t.projectId),
    index("project_canvas_shares_shared_by_user_id_idx").on(t.sharedByUserId),
  ],
);

// Validare («code review» — INIMA). Polimorfică pe Detail SAU Sketch.
export const validations = pgTable(
  "validations",
  {
    id: uuid().defaultRandom().primaryKey(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    targetType: targetType().notNull(),
    targetId: uuid().notNull(),
    position: validationPosition().notNull(),
    roleSnapshot: jsonb(), // rolul userului la momentul poziției (afișare istorică)
    // SEC-001 (audit securitate 2026-08-11): la „Scoate în comunitate", pozițiile ALTOR membri decât
    // autorul detaliului nu trebuie să devină publice — oglindește exact `sketches.hiddenAfterRelease`
    // (vezi acolo). Setat o SINGURĂ dată, în același batch atomic cu nularea `projectId`.
    hiddenAfterRelease: boolean().notNull().default(false),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    // O singură poziție per user per țintă, reversibilă — garantat de DB.
    unique("validations_user_target_unique").on(t.userId, t.targetType, t.targetId),
    index("validations_target_idx").on(t.targetType, t.targetId),
  ],
);

// Comentariu (polimorfic). Dezaprobarea obligatorie intră aici via origin_validation_id.
export const comments = pgTable(
  "comments",
  {
    id: uuid().defaultRandom().primaryKey(),
    targetType: targetType().notNull(),
    targetId: uuid().notNull(),
    authorId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: text().notNull(),
    // Imagine atașată la comentariu (2026-08-06) — MAXIM UNA, opțională („uite, aici la
    // îmbinarea asta"). URL de Vercel Blob, trecut prin ACELAȘI pipeline de re-encodare/curățare ca
    // imaginile de detalii (`reprocessBlobImage`), sub `u/<userId>/comments/...`. La ștergerea
    // comentariului se șterge și fișierul, altfel rămân orfani în storage.
    imageUrl: text(),
    originValidationId: uuid().references(() => validations.id, { onDelete: "set null" }),
    // Persistă DINCOLO de retragere (originValidationId devine null la retract, onDelete: set null) —
    // ca UI-ul să poată eticheta un comentariu drept „fostă dezaprobare, retrasă" în loc să dispară orice
    // urmă și să pară un comentariu obișnuit (2026-07-06).
    wasDisapproval: boolean().notNull().default(false),
    // Schița de origine a unei justificări de dezaprobare scrise de pe tabul unei schițe (2026-07-16).
    // Comentariul însuși stă mereu pe targetType DETAIL (dezbatere unificată) — coloana asta e DOAR ca
    // UI-ul să poată eticheta „pe schița N" și să sară la tab. null = comentariu obișnuit / dezaprobare
    // pe detaliul de bază. Schița ștearsă → set null (nu pierdem comentariul, doar eticheta).
    sketchContextId: uuid().references(() => sketches.id, { onDelete: "set null" }),
    // Reply (2026-07-06) — UN SINGUR nivel: un reply nu poate avea el însuși reply-uri
    // (enforce în commentService, nu doar aici). null = comentariu rădăcină. Cascade: comentariul-părinte
    // șters → reply-urile lui dispar odată cu el (nu rămân orfane).
    parentCommentId: uuid().references((): AnyPgColumn => comments.id, { onDelete: "cascade" }),
    // SEC-001 (audit securitate 2026-08-11): la „Scoate în comunitate", comentariile ALTOR membri decât
    // autorul detaliului nu trebuie să devină publice — oglindește exact `sketches.hiddenAfterRelease`
    // (vezi acolo). Setat o SINGURĂ dată, în același batch atomic cu nularea `projectId`.
    hiddenAfterRelease: boolean().notNull().default(false),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("comments_target_idx").on(t.targetType, t.targetId),
    index("comments_author_id_idx").on(t.authorId),
    index("comments_origin_validation_id_idx").on(t.originValidationId),
    index("comments_parent_comment_id_idx").on(t.parentCommentId),
    index("comments_sketch_context_id_idx").on(t.sketchContextId),
  ],
);

// Vot pe comentariu — un user dă up sau down unui comentariu. Compus (userId, commentId) = PK → o
// singură poziție per user per comentariu, reversibilă (toggle) sau comutabilă (up→down), garantată de
// DB. Autorul nu-și poate vota propriul comentariu — enforce în commentService (CANNOT_LIKE_OWN), nu
// aici. Numele tabelului/coloanelor a rămas `comment_likes` (2026-08-20, adăugat doar `direction`) —
// redenumirea completă la „votes" ar fi atins baseline-ul de subquery-uri corelate + e2e fără beneficiu
// funcțional, doar cosmetic.
export const commentLikes = pgTable(
  "comment_likes",
  {
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    commentId: uuid()
      .notNull()
      .references(() => comments.id, { onDelete: "cascade" }),
    // UP = apreciere (fostul „like"), DOWN = dezaprobare pe comentariu (2026-08-20). Default UP la
    // adăugare → rândurile existente (toate erau like-uri) rămân corecte fără backfill separat.
    direction: commentVoteDirection().notNull().default("UP"),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.commentId] }),
    index("comment_likes_comment_id_idx").on(t.commentId),
  ],
);

// Detaliu salvat (bookmark) — un user marchează un detaliu pentru „citește mai târziu".
// Compus (userId, detailId) = PK → unicitate garantată de DB (nu se salvează de două ori).
// Ambele FK cad în cascadă (userul șters / detaliul șters → bookmark-ul dispare).
export const savedDetails = pgTable(
  "saved_details",
  {
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    detailId: uuid()
      .notNull()
      .references(() => details.id, { onDelete: "cascade" }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.detailId] }),
    index("saved_details_detail_id_idx").on(t.detailId),
  ],
);

// „Ridic mâna" — un FURNIZOR semnalează public că poate oferta materiale pt acest detaliu (2026-07-16).
// Entitate SEPARATĂ de `validations` (deliberat): semantica de aprobare/dezaprobare
// (contoare, justificare obligatorie) n-are legătură cu asta — e doar vizibilitate comercială.
// Compus (userId, detailId) = PK, identic modelul „o poziție per user per țintă, reversibilă" ca la
// bookmark (savedDetails): al doilea click = retragere (DELETE), nu o a doua ramură de stare.
export const supplierOffers = pgTable(
  "supplier_offers",
  {
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    detailId: uuid()
      .notNull()
      .references(() => details.id, { onDelete: "cascade" }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.detailId] }),
    index("supplier_offers_detail_id_idx").on(t.detailId),
  ],
);

// Notificare (in-app + email).
export const notifications = pgTable(
  "notifications",
  {
    id: uuid().defaultRandom().primaryKey(),
    recipientUserId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: notificationType().notNull(),
    payloadJson: jsonb(),
    readAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("notifications_recipient_user_id_idx").on(t.recipientUserId)],
);

// ════════════════════════ (C) Admin — autentificare SEPARATĂ de useri ════════════════════════
// Adminii NU sunt useri ai platformei: login propriu prin MAGIC LINK pe email, sesiune proprie
// (cookie dedicat, validat prin admin_sessions). Acces izolat la /admin-page.
// CINE e admin = allowlist `ADMIN_EMAILS` (env) — fără tabel de conturi, fără parole.

// Token one-time pentru magic link-ul de admin (emis la cererea de login, consumat la /admin-page/verify).
export const adminLoginTokens = pgTable(
  "admin_login_tokens",
  {
    token: text().primaryKey(),
    email: text().notNull(), // emailul (din allowlist) către care s-a trimis linkul
    expires: timestamp({ withTimezone: true, mode: "date" }).notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("admin_login_tokens_email_idx").on(t.email)],
);

// Sesiuni de admin (token opac random în cookie HttpOnly). Lookup în DB → revocabil. Expiră.
// Cheia identității = emailul (din allowlist) — nu există tabel de conturi de admin.
export const adminSessions = pgTable(
  "admin_sessions",
  {
    token: text().primaryKey(),
    email: text().notNull(),
    expires: timestamp({ withTimezone: true, mode: "date" }).notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("admin_sessions_email_idx").on(t.email)],
);

// Setări de platformă — tabel SINGLE-ROW (config global, administrat din /admin-page).
// DOUĂ controale INDEPENDENTE de mentenanță (citit pe căi fierbinți → un singur rând, query ieftin):
//   (1) ANUNȚ programat — banner în feed cu data; platforma funcționează normal (avertizare în avans).
//   (2) LOCKDOWN — toți văd „site în lucru" (gate global în proxy); DOAR adminul intră pe /admin-page.
export const platformSettings = pgTable("platform_settings", {
  id: uuid().defaultRandom().primaryKey(),
  // (1) Anunț programat — banner în feed pentru userii logați.
  announcementEnabled: boolean().notNull().default(false),
  announcementDate: date({ mode: "string" }), // data anunțată (opțională)
  announcementMessage: text(), // mesaj custom opțional (override text implicit)
  // (2) Lockdown total — platforma închisă pentru toți, mai puțin adminul.
  lockdownEnabled: boolean().notNull().default(false),
  lockdownMessage: text(), // mesaj opțional pe ecranul „site în lucru"
  // Emailul adminului care a făcut ultima schimbare (din allowlist, NU user).
  updatedBy: text(),
  updatedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

// Planșă v2 (canvas privat, ENGINE PROPRIU — nu Excalidraw/tldraw) — spațiu de lucru per user: adună
// detalii din platformă, le aranjează (mută/scalează/z-order) și desenează freehand peste ansamblu.
// STRICT privat — ownership enforce în plansaService (NU RLS). `state` = CanvasDocument
// ({ version, items, strokes } — vezi server/domain/plansa.ts), opac pt Drizzle, validat structural
// pe server la fiecare save; `canvas_items` = index relațional planșă↔detalii.
export const canvases = pgTable(
  "canvases",
  {
    id: uuid().defaultRandom().primaryKey(),
    ownerId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text().notNull(),
    state: jsonb(), // CanvasDocument (items + strokes); null = planșă nou-creată, încă fără conținut
    thumbnailUrl: text(), // PNG compus client-side la salvare (pt „Planșele mele")
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("canvases_owner_id_idx").on(t.ownerId)],
);

// Relația planșă ↔ detalii/schițe (index de apartenență + integritate). `sketchId` opțional (2026-07-06):
// null = item „detaliu-mamă" (comportamentul original); prezent = item „schiță" (imaginea COMPUSĂ deja
// randată la publicarea schiței, sketches.thumbnailUrl — nu se randează a doua oară). PK surogat (nu mai
// compus pe canvasId+detailId) pentru că același detaliu poate apărea de mai multe ori pe o planșă — o dată
// ca detaliu-mamă, plus câte o dată pentru fiecare schiță trimisă separat. Unicitate reală enforce prin cei
// doi indecși parțiali de mai jos (un detaliu-mamă o singură dată; o schiță o singură dată — per planșă).
// Ambele FK (detail/sketch) cad în cascadă (detaliul/schița șters(ă) → item-ul dispare din index; geometria
// din `state.items` se reconciliază la load → placeholder „Detaliu indisponibil").
export const canvasItems = pgTable(
  "canvas_items",
  {
    id: uuid().defaultRandom().primaryKey(),
    canvasId: uuid()
      .notNull()
      .references(() => canvases.id, { onDelete: "cascade" }),
    detailId: uuid()
      .notNull()
      .references(() => details.id, { onDelete: "cascade" }),
    sketchId: uuid().references(() => sketches.id, { onDelete: "cascade" }),
    addedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("canvas_items_detail_id_idx").on(t.detailId),
    index("canvas_items_sketch_id_idx").on(t.sketchId),
    uniqueIndex("canvas_items_detail_only_uidx")
      .on(t.canvasId, t.detailId)
      .where(sql`sketch_id is null`),
    uniqueIndex("canvas_items_sketch_uidx")
      .on(t.canvasId, t.sketchId)
      .where(sql`sketch_id is not null`),
  ],
);

// Notă: FK `target_id` (polimorfic, validări/comentarii) nu are .references() forțat
// — integritatea lui se asigură în services (vezi docs/SECURITATE.md §4).
