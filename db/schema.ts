// Schema Drizzle — sursa de adevăr a modelului de date (vezi docs/SCHEMA.md ca design doc).
// Convenții: tabele snake_case plural, coloane snake_case (via `casing: "snake_case"`),
// PK uuid gen_random_uuid(), created_at/updated_at standard, toate FK indexate.
//
// Conține: (A) tabelele cerute de adapterul Auth.js Drizzle (users/accounts/sessions/verification_tokens)
// — cu cheile TS exacte pe care le cere adapterul — și (B) tabelele de domeniu DETALIA.

import {
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

// Categorii (arbore, self-FK) pentru filtre.
export const categories = pgTable(
  "categories",
  {
    id: uuid().defaultRandom().primaryKey(),
    parentId: uuid(),
    name: text().notNull(),
    slug: text().notNull().unique(),
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
    categoryId: uuid()
      .notNull()
      .references(() => categories.id),
    climateZone: text().notNull().default("General"),
    seismicZone: text().notNull().default("General"),
    imageUrl: text().notNull(),
    status: text().notNull().default("PUBLISHED"),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("details_author_id_idx").on(t.authorId),
    index("details_category_id_idx").on(t.categoryId),
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
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("comments_target_idx").on(t.targetType, t.targetId),
    index("comments_author_id_idx").on(t.authorId),
    index("comments_origin_validation_id_idx").on(t.originValidationId),
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

// Notă: FK `target_id` (polimorfic, validări/comentarii) nu are .references() forțat
// — integritatea lui se asigură în services (vezi docs/SECURITATE.md §4).
