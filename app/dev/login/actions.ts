"use server";

// 🔴 DEV-LOGIN — bypass de autentificare pentru verificare vizuală pe localhost. DE ȘTERS înainte de prod.
// Gated dur: aruncă în producție. Cu sesiune `database` (adapter Drizzle), „login" = inserăm un rând în
// `sessions` + setăm cookie-ul de sesiune Auth.js; la următorul request Auth.js rezolvă userul din DB.
import { randomBytes } from "crypto";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { sessions } from "@/db/schema";

const SESSION_TTL_MS = 30 * 86_400_000;

export async function devLoginAction(formData: FormData) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Dev-login indisponibil în producție.");
  }

  const userId = String(formData.get("userId") ?? "");
  if (!userId) throw new Error("userId lipsește.");

  const token = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + SESSION_TTL_MS);
  await db.insert(sessions).values({ sessionToken: token, userId, expires });

  // Numele cookie-ului Auth.js v5 depinde de secure (https → prefix __Secure-).
  const secure = (process.env.AUTH_URL ?? "").startsWith("https://");
  const cookieName = secure ? "__Secure-authjs.session-token" : "authjs.session-token";
  const store = await cookies();
  store.set(cookieName, token, { httpOnly: true, sameSite: "lax", path: "/", secure, expires });

  redirect("/feed");
}
