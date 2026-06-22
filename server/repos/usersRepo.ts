// Repo users — extensii DETALIA peste tabelul gestionat de Auth.js. Singurul loc cu acces Drizzle pe `users`.
// Auth.js gestionează crearea/sesiunile; aici doar actualizăm câmpuri de profil (ex: poza).
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { users } from "@/db/schema";

export async function updateUserImage(userId: string, imageUrl: string) {
  await db.update(users).set({ image: imageUrl }).where(eq(users.id, userId));
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
