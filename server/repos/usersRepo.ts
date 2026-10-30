// Repo users — extensii DETALIA peste tabelul gestionat de Auth.js. Singurul loc cu acces Drizzle pe `users`.
// Auth.js gestionează crearea/sesiunile; aici doar actualizăm câmpuri de profil (ex: poza).
import { and, desc, eq, gt, isNull, ne, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { db } from "@/db";
import { accounts, details, notifications, roles, sessions, userStatus, users } from "@/db/schema";
import type { ActivityEmailMode } from "@/server/domain/notification";

import { verifiedCondition } from "@/server/repos/repoHelpers";
import type { RoleMain } from "@/server/domain/roles";

export async function updateUserImage(userId: string, imageUrl: string | null) {
  await db.update(users).set({ image: imageUrl }).where(eq(users.id, userId));
}

// Existența unui cont după email — folosit la login/signup ca să distingem cele două fluxuri
// (Auth.js normalizează emailul cu `.toLowerCase().trim()` înainte de a-l stoca, replicăm aici).
export async function userExistsByEmail(email: string): Promise<boolean> {
  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email.toLowerCase().trim()))
    .limit(1);
  return !!row;
}

// Poarta de sesiune din proxy.ts (SEC-002, 2026-08-09) — status + rol PROASPETE din DB, într-un
// singur SELECT (LEFT JOIN pe roles, care oricum e unic per user). Înlocuiește gating-ul anterior pe
// `authToken.status` (înghețat la login, poate fi ore/zile stale) cu o verificare reală, la costul unui
// query deja plătit oricum de poarta de onboarding (userHasRole) — nu adaugă round-trip nou.
export async function getUserGateInfo(
  userId: string,
  sessionId: string,
): Promise<{ status: (typeof userStatus.enumValues)[number]; hasRole: boolean } | null> {
  const [row] = await db
    .select({ status: users.status, hasRole: sql<boolean>`${roles.userId} is not null` })
    .from(users)
    .innerJoin(sessions, and(eq(sessions.userId, users.id), eq(sessions.sessionToken, sessionId), gt(sessions.expires, new Date())))
    .leftJoin(roles, eq(roles.userId, users.id))
    .where(eq(users.id, userId))
    .limit(1);
  return row ?? null;
}

// Profilul si rolul devin vizibile impreuna. O cerere care pierde conflictul pe rol nu modifica profilul.
export async function completeOnboardingProfileAndRole(
  userId: string,
  fields: {
    firstName: string;
    lastName: string;
    name: string;
    headline: string | null;
    location: string | null;
    county: string | null;
    website: string | null;
    company: string | null;
    roleMain: (typeof roles.$inferInsert)["roleMain"];
    subRole: string | null;
    secondaryRole: string | null;
    image?: string;
    coverImage?: string;
    coverPosition: number;
  },
): Promise<boolean> {
  const result = await db.execute<{ id: string }>(sql`
    with claimed_role as (
      insert into ${roles} (user_id, role_main, sub_role, secondary_role)
      values (${userId}, ${fields.roleMain}, ${fields.subRole}, ${fields.secondaryRole})
      on conflict (user_id) do nothing
      returning user_id
    )
    update ${users}
    set first_name = ${fields.firstName}, last_name = ${fields.lastName}, name = ${fields.name},
        headline = ${fields.headline}, location = ${fields.location}, county = ${fields.county}, website = ${fields.website}, company = ${fields.company},
        image = coalesce(${fields.image ?? null}, ${users.image}),
        cover_image = coalesce(${fields.coverImage ?? null}, ${users.coverImage}),
        cover_position = case when ${fields.coverImage ?? null}::text is null then ${users.coverPosition} else ${fields.coverPosition} end
    from claimed_role
    where ${users.id} = claimed_role.user_id
    returning ${users.id}
  `);
  return result.rows.length > 0;
}

// Setează URL-ul cover-ului după upload (best-effort, ca și avatarul).
export async function updateUserCoverImage(userId: string, coverUrl: string | null) {
  await db.update(users).set({ coverImage: coverUrl }).where(eq(users.id, userId));
}

// Poziția verticală a cover-ului (0..100). Clamp-ul îl face service-ul/action-ul.
export async function updateUserCoverPosition(userId: string, position: number) {
  await db.update(users).set({ coverPosition: position }).where(eq(users.id, userId));
}

// Snapshot-ul de badge-uri VĂZUTE — scris DOAR de owner (verificat în service), la confirmarea pop-up-ului.
export async function updateSeenBadges(userId: string, seenBadges: Record<string, string>) {
  await db.update(users).set({ seenBadges }).where(eq(users.id, userId));
}

// Turul ghidat de pe pagina de detaliu — văzut vreodată? Scris DOAR de owner (verificat în service).
export async function getSeenDetailTour(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ seenDetailTour: users.seenDetailTour })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row?.seenDetailTour ?? false;
}

export async function markDetailTourSeen(userId: string): Promise<void> {
  await db.update(users).set({ seenDetailTour: true }).where(eq(users.id, userId));
}

// Datele de profil pentru /profile/edit (nume, email, poză, cover + headline/locație/website). Email = PII.
export async function getUserProfile(userId: string) {
  const [row] = await db
    .select({
      name: users.name,
      email: users.email,
      image: users.image,
      coverImage: users.coverImage,
      coverPosition: users.coverPosition,
      headline: users.headline,
      about: users.about,
      location: users.location,
      county: users.county,
      website: users.website,
      company: users.company,
      phone: users.phone,
      phoneVisible: users.phoneVisible,
      emailVisible: users.emailVisible,
      weeklyDigestEnabled: users.weeklyDigestEnabled,
      activityEmailMode: users.activityEmailMode,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row ?? null;
}

// Editarea câmpurilor de text ale profilului (nume, headline, about, locație, website, firmă, telefon +
// vizibilitatea telefonului/emailului). NU atinge rolul (definitiv).
export async function updateUserDetails(
  userId: string,
  fields: {
    name: string;
    headline: string | null;
    about: string | null;
    location: string | null;
    county: string | null;
    website: string | null;
    company: string | null;
    phone: string | null;
    phoneVisible: boolean;
    emailVisible: boolean;
    weeklyDigestEnabled: boolean;
    activityEmailMode?: ActivityEmailMode;
  },
) {
  await db.update(users).set(fields).where(eq(users.id, userId));
  if (fields.activityEmailMode === "IN_APP") {
    await db.update(notifications).set({ emailDueAt: null }).where(eq(notifications.recipientUserId, userId));
  }
}

// Dezabonarea din email nu modifica digestul saptamanal sau notificarile in-app.
export async function disableActivityEmails(userId: string) {
  await db.execute(sql`
    with updated as (update users set activity_email_mode = 'IN_APP' where id = ${userId} returning id)
    update notifications set email_due_at = null where recipient_user_id in (select id from updated)
  `);
}

// Profil PUBLIC (adresabil prin userId) — câmpuri publice colectate la onboarding + rol/verificare.
// Telefon/email vin ÎNTOTDEAUNA din query (+ flagurile de vizibilitate) — decizia de a le ARĂTA sau
// nu vizitatorului (owner vede mereu tot; restul doar dacă flagul e true) se ia în profileService,
// NU aici (repo-ul citește tot, serviciul redactează). Rolul vine prin join (un singur rol per user).
export async function getPublicProfile(userId: string) {
  const [row] = await db
    .select({
      name: users.name,
      image: users.image,
      coverImage: users.coverImage,
      coverPosition: users.coverPosition,
      headline: users.headline,
      about: users.about,
      location: users.location,
      website: users.website,
      company: users.company,
      email: users.email,
      emailVisible: users.emailVisible,
      phone: users.phone,
      phoneVisible: users.phoneVisible,
      roleMain: roles.roleMain,
      subRole: roles.subRole,
      verificationStatus: roles.verificationStatus,
      createdAt: users.createdAt,
      seenBadges: users.seenBadges,
    })
    .from(users)
    .leftJoin(roles, eq(roles.userId, users.id))
    .where(eq(users.id, userId))
    .limit(1);
  return row ?? null;
}

// Autori activi — userii cu cele mai multe detalii PUBLISHED (+ rol), pentru rail-ul din feed.
// FĂRĂ email/PII. Doar cei cu cel puțin un detaliu.
// `project_id is null` = suprafață PUBLICĂ: un detaliu dintr-un proiect privat nu se numără aici, la
// fel ca în feed/profil/statistici (altfel contorul public ar trăda volumul de activitate privată).
export async function listTopAuthors(limit: number) {
  const detailCount = sql<number>`(select count(*)::int from ${details}
     where ${details.authorId} = ${users.id} and ${details.status} = 'PUBLISHED'
       and ${details.projectId} is null)`;
  return db
    .select({
      id: users.id,
      name: users.name,
      image: users.image,
      roleMain: roles.roleMain,
      subRole: roles.subRole,
      verification: roles.verificationStatus,
      detailCount,
    })
    .from(users)
    .leftJoin(roles, eq(roles.userId, users.id))
    .where(sql`${detailCount} > 0`)
    .orderBy(sql`${detailCount} desc`)
    .limit(limit);
}

// Utilizatorii ACTIVI ai rolului ales, inclusiv fara postari. Contorul respecta vizibilitatea profilului
// public. Un singur LEFT JOIN agregat, nu un count corelat per user. Cu județ ales: doar cei care l-au
// setat în profil.
export async function listUsersByRole(roleMain: RoleMain, county: string | null = null) {
  return db
    .select({
      id: users.id,
      name: users.name,
      image: users.image,
      subRole: roles.subRole,
      detailCount: sql<number>`count(${details.id})::int`,
    })
    .from(users)
    .innerJoin(roles, eq(roles.userId, users.id))
    .leftJoin(
      details,
      and(
        eq(details.authorId, users.id),
        eq(details.status, "PUBLISHED"),
        isNull(details.projectId),
        isNull(details.anonymizedAt),
      ),
    )
    .where(
      and(
        eq(roles.roleMain, roleMain),
        eq(users.status, "ACTIVE"),
        county ? eq(users.county, county) : undefined,
      ),
    )
    .groupBy(users.id, roles.subRole)
    .orderBy(users.name, users.id);
}

// Listă useri pentru panoul de admin: nume, prenume, email, rol (+ subrol), data creării.
// Email = PII, vizibil DOAR adminului (pagina e gated cu sesiune de admin). Sortare descrescătoare după dată.
export async function listUsersForAdmin() {
  return db
    .select({
      id: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
      name: users.name,
      email: users.email,
      status: users.status,
      roleMain: roles.roleMain,
      subRole: roles.subRole,
      verification: roles.verificationStatus,
      createdAt: users.createdAt,
    })
    .from(users)
    .leftJoin(roles, eq(roles.userId, users.id))
    .orderBy(sql`${users.createdAt} desc`);
}

// Media (avatar + cover) pentru ștergerea blob-urilor la ștergerea contului + nume/locație pentru UI
// (citite live din DB, NU din sesiune — JWT-ul cache-uiește doar valorile de la login, stale după onboarding).
export async function getUserMedia(userId: string) {
  const [row] = await db
    .select({
      image: users.image,
      coverImage: users.coverImage,
      coverPosition: users.coverPosition,
      name: users.name,
      location: users.location,
      about: users.about,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row ?? null;
}

// Suspendare/reactivare de admin (moderare reversibilă — alternativă la ștergerea ireversibilă a contului).
// Exclude explicit conturile DELETED (`ne`): un cont anonimizat nu poate fi "reactivat" — identitatea reală
// e deja distrusă ireversibil, nu doar blocat accesul. Întoarce null dacă userul nu există sau e DELETED.
export async function setUserStatus(
  userId: string,
  status: "ACTIVE" | "SUSPENDED",
): Promise<{ id: string; email: string } | null> {
  const [row] = await db
    .update(users)
    .set({ status })
    .where(and(eq(users.id, userId), ne(users.status, "DELETED")))
    .returning({ id: users.id, email: users.email });
  return row ?? null;
}

// GDPR — ștergere cont (tombstone): șterge PII din rândul user. `email` e NOT NULL unique → îl înlocuim cu un
// placeholder non-PII (emailul real dispare). `name` devine o etichetă generică (nu numele real). Restul → null.
// `status = DELETED` → blocat de SEC-04 (signIn + proxy). Conținutul (detalii/schițe/comentarii/validări) rămâne.
export async function anonymizeUserRow(userId: string, placeholderEmail: string) {
  await db
    .update(users)
    .set({
      email: placeholderEmail,
      emailVerified: null,
      name: "[cont șters]",
      firstName: null,
      lastName: null,
      image: null,
      coverImage: null,
      headline: null,
      about: null,
      location: null,
      county: null,
      website: null,
      company: null,
      phone: null,
      phoneVisible: false,
      emailVisible: false,
      status: "DELETED",
    })
    .where(eq(users.id, userId));
}

// Revocă autentificarea: șterge sesiunile (logout imediat) și conturile OAuth legate.
export async function deleteUserAuth(userId: string) {
  await db.delete(sessions).where(eq(sessions.userId, userId));
  await db.delete(accounts).where(eq(accounts.userId, userId));
}

// Email + nume pentru notificări (email = PII, NU se loghează).
export async function getUserContact(userId: string) {
  const [row] = await db
    .select({ email: users.email, name: users.name })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row ?? null;
}

// Digest săptămânal — dezabonare din linkul semnat din email (fără sesiune). Idempotent.
export async function setWeeklyDigestEnabled(userId: string, enabled: boolean): Promise<void> {
  await db.update(users).set({ weeklyDigestEnabled: enabled }).where(eq(users.id, userId));
}

// Actorul unei notificări = nume + rol + verificare (pt afișarea rolului/steluței lângă nume). Fără PII.
// Identitate + rol curent al unui user — folosit unde afișarea cere poză+nume+rol dintr-un singur loc
// (ex. autorul unui proiect, în lista de membri) și nu există deja un query mai specific de reutilizat.
export async function getUserWithRole(userId: string) {
  const [row] = await db
    .select({
      id: users.id,
      name: users.name,
      image: users.image,
      roleMain: roles.roleMain,
      subRole: roles.subRole,
      verified: sql<boolean>`${verifiedCondition}`,
    })
    .from(users)
    .leftJoin(roles, eq(roles.userId, users.id))
    .where(eq(users.id, userId))
    .limit(1);
  return row ?? null;
}

export async function getNotificationActor(userId: string) {
  const [row] = await db
    .select({
      name: users.name,
      roleMain: roles.roleMain,
      subRole: roles.subRole,
      verification: roles.verificationStatus,
    })
    .from(users)
    .leftJoin(roles, eq(roles.userId, users.id))
    .where(eq(users.id, userId))
    .limit(1);
  return row ?? null;
}

export async function getReferralCode(userId: string): Promise<string | null> {
  const [row] = await db.select({ referralCode: users.referralCode }).from(users).where(eq(users.id, userId)).limit(1);
  return row?.referralCode ?? null;
}

// Scrie codul DOAR dacă userul încă nu are unul (WHERE suplimentar, nu doar `set`) — atomic, ca doi
// request-uri concurente (dublu-click pe „generează link") să nu poată amândouă crede că au reușit cu
// coduri diferite. `.returning()` gol = altcineva l-a scris deja între timp (retry-ul apelantului
// citește ce există acum, nu mai insistă cu codul lui).
export async function setReferralCodeIfAbsent(userId: string, code: string): Promise<boolean> {
  const rows = await db
    .update(users)
    .set({ referralCode: code })
    .where(and(eq(users.id, userId), sql`${users.referralCode} is null`))
    .returning({ id: users.id });
  return rows.length > 0;
}

export async function getUserIdByReferralCode(code: string): Promise<string | null> {
  const [row] = await db.select({ id: users.id }).from(users).where(eq(users.referralCode, code)).limit(1);
  return row?.id ?? null;
}

// O SINGURĂ dată — gardă suplimentară aici (nu doar în service), ca un apel greșit să nu poată
// suprascrie un `referredByUserId` deja setat.
export async function setReferredByIfAbsent(userId: string, referrerId: string): Promise<boolean> {
  const rows = await db
    .update(users)
    .set({ referredByUserId: referrerId })
    .where(and(eq(users.id, userId), sql`${users.referredByUserId} is null`))
    .returning({ id: users.id });
  return rows.length > 0;
}

export async function countReferrals(userId: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(users)
    .where(eq(users.referredByUserId, userId));
  return row?.count ?? 0;
}

export type AdminReferralRow = {
  referrerUserId: string;
  referrerName: string | null;
  referrerEmail: string;
  referredUserId: string;
  referredName: string | null;
  referredEmail: string;
  joinedAt: Date;
};

// Panou admin — STRICT conversii reușite (cont chiar creat prin link), fără funnel de click-uri
// neconvertite (decizie de produs 2026-08-25 — nu există alt tip de rând de arătat aici). Self-join
// cu alias Drizzle (nu SQL brut) — evită orice ambiguitate de coloană pe auto-join.
export async function listAllReferrals(): Promise<AdminReferralRow[]> {
  const referrer = alias(users, "referrer");
  const rows = await db
    .select({
      referrerUserId: referrer.id,
      referrerName: referrer.name,
      referrerEmail: referrer.email,
      referredUserId: users.id,
      referredName: users.name,
      referredEmail: users.email,
      joinedAt: users.createdAt,
    })
    .from(users)
    .innerJoin(referrer, eq(referrer.id, users.referredByUserId))
    .orderBy(desc(users.createdAt));
  return rows;
}
