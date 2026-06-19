// PreToolUse / Edit|Write|MultiEdit
// Blochează introducerea de loguri cu PII specific DETALIA: emailuri, parole, tokenuri de
// invitație / magic-link / sesiune, OTP, secrete, dovezi de verificare a rolului (OAR / CUI),
// sau loguri brute de req.body. Regula (CLAUDE.md): PII-ul NU se loghează în producție — doar
// metadate ({ err, status, userId.slice(0,8), count }).
// exit 2 = blochează editarea și cere reparare. Orice eroare internă = exit 0 (nu blocăm munca reală).
const fs = require('fs');

let input;
try { input = JSON.parse(fs.readFileSync(0, 'utf8')); } catch (e) { process.exit(0); }

const ti = input.tool_input || {};

// Adună tot textul nou care se scrie (Edit: new_string · Write: content · MultiEdit: edits[].new_string)
const chunks = [];
if (typeof ti.new_string === 'string') chunks.push(ti.new_string);
if (typeof ti.content === 'string') chunks.push(ti.content);
if (Array.isArray(ti.edits)) for (const e of ti.edits) if (e && typeof e.new_string === 'string') chunks.push(e.new_string);

const text = chunks.join('\n');
if (!text) process.exit(0);

// Doar fișiere sursă. Nu deranjăm testele, node_modules, build-ul.
const fp = (ti.file_path || '').replace(/\\/g, '/');
if (fp && /\/(node_modules|\.next|dist|build)\//.test(fp)) process.exit(0);
if (/\.(test|spec)\.[tj]sx?$/.test(fp)) process.exit(0);
if (fp && !/\.[tj]sx?$/.test(fp)) process.exit(0); // doar .ts/.tsx/.js/.jsx

const LOG   = /(console|logger|req\.log|fastify\.log|app\.log|this\.log)\.(log|info|debug|warn|error|trace|fatal)\s*\(/i;
// PII / secrete specifice DETALIA
const RISKY = /(\bpassword\b|passwordHash|plainPassword|\bemail\b|inviteToken|invitationToken|magicLink|magicToken|verificationToken|sessionToken|accessToken|refreshToken|\botp\b|\bsecret\b|oarNumber|\bcui\b|verificationEvidence|req\.body|request\.body)/i;

const hits = [];
for (const line of text.split('\n')) {
  if (LOG.test(line) && RISKY.test(line)) hits.push(line.trim());
}

if (hits.length) {
  process.stderr.write(
    'BLOCAT — posibil PII/secret în log (regula CLAUDE.md: emailuri, parole, tokenuri NU se loghează):\n\n' +
    hits.map(h => '  ' + h).join('\n') +
    '\n\nLoghează DOAR metadate ({ err, status, userId.slice(0,8), count }), nu PII.\n' +
    'Dacă e fals-pozitiv intenționat, scoate variabila din apelul de log sau ajustează hook-ul.'
  );
  process.exit(2);
}

process.exit(0);
