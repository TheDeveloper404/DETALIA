import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Worker-ul + WASM-ul viewer-ului IFC, copiate din node_modules de next.config.ts (gitignored):
    "public/ifc/**",
    // Tooling local (gitignored) — nu fac parte din app:
    ".claude/**",
    ".agents/**",
    ".remember/**",
  ]),
]);

export default eslintConfig;
