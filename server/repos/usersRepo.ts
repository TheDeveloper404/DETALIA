// Repo users — extensii DETALIA peste tabelul gestionat de Auth.js. Singurul loc cu acces Drizzle pe `users`.
// Auth.js gestionează crearea/sesiunile; aici doar actualizăm câmpuri de profil (ex: poza).
import { and, desc, eq, ne, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { db } from "@/db";
import { accounts, details, roles, sessions, userStatus, users } from "@/db/schema";

import { verifiedCondition } from "@/server/repos/repoHelpers";

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
): Promise<{ status: (typeof userStatus.enumValues)[number]; hasRole: boolean } | null> {
  const [row] = await db
    .select({ status: users.status, hasRole: sql<boolean>`${roles.userId} is not null` })
    .from(users)
    .leftJoin(roles, eq(roles.userId, users.id))
    .where(eq(users.id, userId))
    .limit(1);
  return row ?? null;
}

// Datele de profil colectate la onboarding (text). Imaginile (image/coverImage) se setează separat,
// după upload-ul în Blob. `name` îl compunem aici din first + last pentru codul care-l citește.
export async function updateUserProfile(
  userId: string,
  fields: {
    firstName: string;
    lastName: string;
    name: string;
    headline: string | null;
    location: string | null;
    website: string | null;
    company: string | null;
  },
) {
  await db.update(users).set(fields).where(eq(users.id, userId));
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

// Ultima versiune văzută a panoului „Ce e nou" — scrisă DOAR de owner (verificat în service).
export async function updateLastSeenAnnouncement(userId: string, version: string) {
  await db.update(users).set({ lastSeenAnnouncementVersion: version }).where(eq(users.id, userId));
}

export async function getLastSeenAnnouncement(userId: string): Promise<string | null> {
  const [row] = await db
    .select({ lastSeenAnnouncementVersion: users.lastSeenAnnouncementVersion })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row?.lastSeenAnnouncementVersion ?? null;
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
      website: users.website,
      company: users.company,
      phone: users.phone,
      phoneVisible: users.phoneVisible,
      emailVisible: users.emailVisible,
      weeklyDigestEnabled: users.weeklyDigestEnabled,
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
    website: string | null;
    company: string | null;
    phone: string | null;
    phoneVisible: boolean;
    emailVisible: boolean;
    weeklyDigestEnabled: boolean;
  },
) {
  await db.update(users).set(fields).where(eq(users.id, userId));
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
      website: null,
      company: null,
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
