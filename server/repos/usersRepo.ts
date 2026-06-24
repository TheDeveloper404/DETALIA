// Repo users — extensii DETALIA peste tabelul gestionat de Auth.js. Singurul loc cu acces Drizzle pe `users`.
// Auth.js gestionează crearea/sesiunile; aici doar actualizăm câmpuri de profil (ex: poza).
import { eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { details, roles, users } from "@/db/schema";

export async function updateUserImage(userId: string, imageUrl: string) {
  await db.update(users).set({ image: imageUrl }).where(eq(users.id, userId));
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
  },
) {
  await db.update(users).set(fields).where(eq(users.id, userId));
}

// Setează URL-ul cover-ului după upload (best-effort, ca și avatarul).
export async function updateUserCoverImage(userId: string, coverUrl: string) {
  await db.update(users).set({ coverImage: coverUrl }).where(eq(users.id, userId));
}

// Datele de profil pentru /profile/edit (nume, email, poză, cover + headline/locație/website). Email = PII.
export async function getUserProfile(userId: string) {
  const [row] = await db
    .select({
      name: users.name,
      email: users.email,
      image: users.image,
      coverImage: users.coverImage,
      headline: users.headline,
      location: users.location,
      website: users.website,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row ?? null;
}

// Editarea câmpurilor de text ale profilului (nume, headline, locație, website). NU atinge rolul (definitiv).
export async function updateUserDetails(
  userId: string,
  fields: { name: string; headline: string | null; location: string | null; website: string | null },
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
      headline: users.headline,
      location: users.location,
      website: users.website,
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
      verification: roles.verificationStatus,
    })
    .from(users)
    .leftJoin(roles, eq(roles.userId, users.id))
    .where(eq(users.id, userId))
    .limit(1);
  return row ?? null;
}
