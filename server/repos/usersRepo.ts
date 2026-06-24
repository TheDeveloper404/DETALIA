// Repo users — extensii DETALIA peste tabelul gestionat de Auth.js. Singurul loc cu acces Drizzle pe `users`.
// Auth.js gestionează crearea/sesiunile; aici doar actualizăm câmpuri de profil (ex: poza).
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { users } from "@/db/schema";

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

// Datele de profil afișate pe /profile (nume, email, poză). Email = PII, NU se loghează.
export async function getUserProfile(userId: string) {
  const [row] = await db
    .select({ name: users.name, email: users.email, image: users.image })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row ?? null;
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
