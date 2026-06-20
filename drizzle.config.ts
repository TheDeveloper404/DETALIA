import "dotenv/config";
import { defineConfig } from "drizzle-kit";

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
