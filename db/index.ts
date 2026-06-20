// Clientul Drizzle (Neon serverless, driver HTTP). Folosit de services/repos.
// Necesită DATABASE_URL la runtime — vezi .env.example.
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import * as schema from "./schema";

const sql = neon(process.env.DATABASE_URL!);

export const db = drizzle({ client: sql, schema, casing: "snake_case" });

export * as schema from "./schema";
