// Clientul Drizzle (Neon serverless, driver HTTP). Folosit de services/repos.
// Necesită DATABASE_URL la runtime — vezi .env.example.
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import * as schema from "./schema";

// `next build` evaluează modulele (page-data collection) fără DATABASE_URL → un
// `neon()` la top-level fără string ar arunca. Driverul Neon HTTP e lazy (se conectează
// abia la prima interogare, care NU rulează la build), așa că un placeholder ca fallback
// e sigur: la runtime DATABASE_URL real e mereu setat (Vercel env / .env.local).
const connectionString =
  process.env.DATABASE_URL ?? "postgresql://placeholder:placeholder@placeholder/placeholder";

const sql = neon(connectionString);

export const db = drizzle({ client: sql, schema, casing: "snake_case" });

export * as schema from "./schema";
