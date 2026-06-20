import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// Convenția proiectului = `.env.local` (auto-încărcat de Next). Îl încărcăm explicit pentru
// uneltele DB (drizzle-kit nu citește singur .env.local), cu `.env` ca fallback.
config({ path: ".env.local" });
config();

export default defineConfig({
  dialect: "postgresql",
  schema: "./db/schema.ts",
  out: "./db/migrations",
  casing: "snake_case",
  dbCredentials: {
    // Necesar pentru db:push / db:migrate / db:studio (cere DATABASE_URL).
    // Pentru db:generate (doar din schemă) nu e necesară conexiune live.
    url: process.env.DATABASE_URL ?? "",
  },
});
