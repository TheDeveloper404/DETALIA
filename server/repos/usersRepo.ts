// Repo users — extensii DETALIA peste tabelul gestionat de Auth.js. Singurul loc cu acces Drizzle pe `users`.
// Auth.js gestionează crearea/sesiunile; aici doar actualizăm câmpuri de profil (ex: poza).
import { eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { accounts, details, roles, sessions, users } from "@/db/schema";

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
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row ?? null;
}

// Editarea câmpurilor de text ale profilului (nume, headline, about, locație, website, firmă). NU atinge rolul (definitiv).
export async function updateUserDetails(
  userId: string,
  fields: {
    name: string;
    headline: string | null;
    about: string | null;
    location: string | null;
    website: string | null;
    company: string | null;
  },
) {
  await db.update(users).set(fields).where(eq(users.id, userId));
}

// Profil PUBLIC (adresabil prin userId) — câmpuri publice colectate la onboarding + rol/verificare.
// FĂRĂ email/PII (pagina e vizibilă altor useri). Rolul vine prin join (un singur rol per user).
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
      roleMain: roles.roleMain,
      subRole: roles.subRole,
      verificationStatus: roles.verificationStatus,
    })
    .from(users)
    .leftJoin(roles, eq(roles.userId, users.id))
    .where(eq(users.id, userId))
    .limit(1);
  return row ?? null;
}

// Autori activi — userii cu cele mai multe detalii PUBLISHED (+ rol), pentru rail-ul din feed.
// FĂRĂ email/PII. Doar cei cu cel puțin un detaliu.
export async function listTopAuthors(limit: number) {
  const detailCount = sql<number>`(select count(*)::int from ${details}
     where ${details.authorId} = ${users.id} and ${details.status} = 'PUBLISHED')`;
  return db
    .select({
      id: users.id,
      name: users.name,
      image: users.image,
      roleMain: roles.roleMain,
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
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
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

// Actorul unei notificări = nume + rol + verificare (pt afișarea rolului/steluței lângă nume). Fără PII.
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
