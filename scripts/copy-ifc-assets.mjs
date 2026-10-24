#!/usr/bin/env node
// Copiază în `public/ifc/` fișierele de runtime ale viewer-ului 3D IFC (app/(app)/details/[id]/ifc-viewer.tsx):
// WASM-ul `web-ifc` (parserul IFC) și worker-ul `@thatopen/fragments`. Le servim de pe domeniul nostru,
// NU de pe unpkg cum fac tutorialele That Open — CSP-ul nu primește un CDN extern, iar versiunea e mereu
// exact cea instalată (wasm/worker nepotrivit cu librăria = erori greu de diagnosticat).
//
// Rulat din `predev` / `prebuild`. `public/ifc/` e în .gitignore (se regenerează la fiecare build).

import { copyFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const outDir = join(root, "public", "ifc");

const assets = [
  ["node_modules/web-ifc/web-ifc.wasm", "web-ifc.wasm"],
  ["node_modules/@thatopen/fragments/dist/Worker/worker.min.mjs", "fragments-worker.mjs"],
];

mkdirSync(outDir, { recursive: true });
for (const [from, to] of assets) {
  copyFileSync(join(root, from), join(outDir, to));
}
console.log(`copy-ifc-assets: ${assets.length} fișiere → public/ifc/`);
