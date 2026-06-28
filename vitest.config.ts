import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

// Config Vitest — teste de securitate/comportament (SEC-10). Rulează în Node (logica de domeniu +
// servicii cu repo-uri mock-uite); nu atingem DB-ul real. Alias-ul `@/` vine din tsconfig.
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["{server,lib}/**/*.test.ts"],
    globals: true,
  },
});
