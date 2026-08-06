import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

// Config Vitest — teste de securitate/comportament (SEC-10). Rulează în Node (logica de domeniu +
// servicii cu repo-uri mock-uite); nu atingem DB-ul real. Alias-ul `@/` vine din tsconfig.
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    // `scripts` e inclus pentru poarta de audit (scripts/audit-report.test.ts): e cod care decide dacă
    // un PR trece sau nu, deci merită acoperit ca oricare altă regulă de securitate.
    include: ["{server,lib,app,components,scripts}/**/*.test.ts"],
    globals: true,
  },
});
