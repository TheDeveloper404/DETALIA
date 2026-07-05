// Copiază fonturile Excalidraw din node_modules în public/ ca să le SERVIM din același origin
// (self-host, fără CDN terț → CSP `font-src 'self'`). Rulat automat la install/dev/build (vezi package.json).
// public/excalidraw-assets e gitignored — regenerat aici, nu comis (evită ~14MB de binare în repo).
import { cp, mkdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = path.join(root, "node_modules", "@excalidraw", "excalidraw", "dist", "prod", "fonts");
const dest = path.join(root, "public", "excalidraw-assets", "fonts");

try {
  await stat(src);
} catch {
  // Fără dependință instalată (ex. install parțial) → nu blocăm; build-ul va semnala lipsa altfel.
  console.warn("[copy-excalidraw-assets] sursa lipsește, sar peste:", src);
  process.exit(0);
}

await rm(dest, { recursive: true, force: true });
await mkdir(path.dirname(dest), { recursive: true });
await cp(src, dest, { recursive: true });
console.log("[copy-excalidraw-assets] fonturi copiate în", dest);
