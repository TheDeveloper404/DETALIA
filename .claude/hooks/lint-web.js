// PostToolUse / Edit|Write|MultiEdit
// După editarea unui fișier sursă din aplicația Next.js (single-app la rădăcină), rulează ESLint
// pe ACEL fișier (rapid, single-file) ca să prindă regulile pe care `tsc --noEmit` NU le prinde
// (ex. react/no-unescaped-entities) ÎNAINTE ca build-ul Vercel să pice. Warning-urile sunt ignorate
// (--quiet); doar erorile blochează și sunt date înapoi lui Claude să le repare.
// exit 2 = ridică erorile către Claude (editarea e deja aplicată). Orice eroare internă = exit 0.
const fs        = require('fs');
const path      = require('path');
const { spawnSync } = require('child_process');

let input;
try {
  input = JSON.parse(fs.readFileSync(0, 'utf8'));
} catch (e) {
  process.exit(0);
}

const filePath = (input.tool_input && input.tool_input.file_path) || '';
if (!filePath) process.exit(0);

const norm = filePath.replace(/\\/g, '/');

// Doar fișiere sursă din aplicație (app/, components/, lib/, server/, db/). Sărim peste node_modules, .next, etc.
if (!/\/(app|components|lib|server|db|hooks|src)\//.test(norm)) process.exit(0);
if (/\/(node_modules|\.next|dist|build)\//.test(norm)) process.exit(0);
if (!/\.(ts|tsx|js|jsx|mjs)$/.test(norm)) process.exit(0);

const repoRoot = process.cwd();
const eslintJs = path.join(repoRoot, 'node_modules', 'eslint', 'bin', 'eslint.js');

if (!fs.existsSync(eslintJs)) process.exit(0); // deps neinstalate → nu stricăm sesiunea

// Forward slashes: ESLint pe Windows nu rezolvă căi cu backslash (le tratează ca glob),
// întoarce "no files matched" (exit 2) și eroarea ar fi înghițită silențios.
const relFile = path.relative(repoRoot, filePath).replace(/\\/g, '/');

const res = spawnSync(
  process.execPath, // node
  [eslintJs, '--quiet', relFile],
  { cwd: repoRoot, encoding: 'utf8', timeout: 60000 }
);

// ESLint exit codes: 0 = curat, 1 = erori de lint (cu --quiet → erori reale), 2 = ESLint a crăpat.
if (res.status === 1) {
  const out = ((res.stdout || '') + (res.stderr || '')).trim();
  process.stderr.write(
    'Erori ESLint în fișierul editat (acestea pică `next lint` / build-ul Vercel):\n\n' +
    out + '\n\nRepară-le înainte de a considera task-ul gata.'
  );
  process.exit(2);
}

process.exit(0); // curat, sau ESLint însuși a eșuat → nu blocăm niciodată munca reală
