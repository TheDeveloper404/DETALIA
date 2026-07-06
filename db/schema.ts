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
  coverImage: text(),
  // Poziția verticală a imaginii de cover (object-position Y, 0..100). Permite mutarea sus/jos a benzii.
  coverPosition: integer().notNull().default(50),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
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
    // Zona climatică n-are variantă neutră în lista Edi (Zona I..IV) → nullable, fără default.
    climateZone: text(),
    // Ceilalți parametri tehnici au „General" ca variantă neutră în listă (lista_categorii.md).
    seismicAg: text().notNull().default("General"),
    seismicTc: text().notNull().default("General"),
    snowLoad: text().notNull().default("General"),
    windLoad: text().notNull().default("General"),
    imageUrl: text().notNull(),
    status: text().notNull().default("PUBLISHED"),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("details_author_id_idx").on(t.authorId)],
);

// Categorii bifate pe un detaliu — many-to-many (Edi: „bifezi oricâte", stil tag Pinterest).
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
    thumbnailUrl: text(),
    status: sketchStatus().notNull().default("DRAFT"),
    // Schiță pornită din „Dezaprob → fac o schiță": la publicare materializează automat o poziție
    // DISAPPROVE pe detaliul-mamă + comentariul-justificare (vezi sketchService.publish). Altfel rămâne
    // o simplă contribuție (fără poziție). Default false = schiță neutră.
    disapprovesParent: boolean().notNull().default(false),
    // Moment publicare (DRAFT→PUBLISHED). Numele „acceptedAt" e moștenit din fluxul vechi cu acceptare.
    acceptedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("sketches_detail_id_idx").on(t.detailId),
    index("sketches_author_id_idx").on(t.authorId),
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
    originValidationId: uuid().references(() => validations.id, { onDelete: "set null" }),
    // Persistă DINCOLO de retragere (originValidationId devine null la retract, onDelete: set null) —
    // ca UI-ul să poată eticheta un comentariu drept „fostă dezaprobare, retrasă" în loc să dispară orice
    // urmă și să pară un comentariu obișnuit (2026-07-06, clarificare cerută de Liviu).
    wasDisapproval: boolean().notNull().default(false),
    // Reply (2026-07-06, idee Edi) — UN SINGUR nivel: un reply nu poate avea el însuși reply-uri
    // (enforce în commentService, nu doar aici). null = comentariu rădăcină. Cascade: comentariul-părinte
    // șters → reply-urile lui dispar odată cu el (nu rămân orfane).
    parentCommentId: uuid().references((): AnyPgColumn => comments.id, { onDelete: "cascade" }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("comments_target_idx").on(t.targetType, t.targetId),
    index("comments_author_id_idx").on(t.authorId),
    index("comments_origin_validation_id_idx").on(t.originValidationId),
    index("comments_parent_comment_id_idx").on(t.parentCommentId),
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
// STRICT privat la MVP — ownership enforce în plansaService (NU RLS). `state` = CanvasDocument
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
