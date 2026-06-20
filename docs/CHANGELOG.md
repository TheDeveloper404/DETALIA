# CHANGELOG — DETALIA

Jurnal detaliat al modificărilor, cu dată. Cel mai recent sus.

---

## 2026-06-20

### Guardrails de proces — PR template, CI, hooks noi (înainte de scaffold)
- **`.github/pull_request_template.md`** (nou, se comite) — checklist la fiecare PR: documentația la zi,
  build verde local, teste, securitate, business enforce pe server, branch = dev. Vizibil și pentru Edi.
- **`.github/workflows/ci.yml`** (nou, se comite) — CI pe PR (dev/main): type-check + lint + build. Guardat
  pentru pre-scaffold (trece gol fără package.json; devine activ automat după Faza 0).
- **Hooks noi (locale, `.claude/` rămâne gitignored — opțiunea A):**
  - `block-push-main.js` — blochează push direct pe `main` prin tool-ul Bash.
  - `block-secrets.js` — blochează scrierea de secrete reale în fișiere (permite .env locale + placeholdere .env.example).
  - Înregistrate în `.claude/settings.json` lângă `block-pii-log` și `lint-web`.
- **Regula „codul = sursa de adevăr"** marcată explicit în antetul `SCHEMA.md` și `API.md` (design docs;
  la divergență câștigă codul; câmp „ultima verificare").

### Plan de execuție MVP (nou)
- **`docs/PLAN-EXECUTIE.md`** (nou) — planul operațional: tabel de servicii terțe (cine setează ce, cost),
  faze 0/1/1.5/2 cu pași concreți + prerechizite + definiție de „gata" per fază, backlog, diagramă de
  dependențe și tabel „ce blochează ce". Calea critică = conturi terțe + inputurile lui Edi (DNS Resend, seed).
  Completează roadmap-ul de nivel înalt din `ARHITECTURA.md §12`. README actualizat.

### Documente lipsă — adăugat restul (🟡 + 🟢), set complet de docuri pre-scaffold
- **`docs/API.md`** (nou) — contractul API: inventar endpoint-uri (auth, invitații, detalii, validări,
  comentarii, schițe, notificări, verificare), cu reguli enforce pe server + coduri de eroare standard.
- **`docs/SCHEMA.md`** (nou) — proiectarea concretă DB: enum-uri, tabele, constrângeri (inclusiv unica
  `(user_id, target_type, target_id)` pe validări), indici, decizii de modelare. Devine cod Drizzle în Faza 0.
- **`docs/UX-ECRANE.md`** (nou) — harta de ecrane + flow-uri (cu săgeți) + stările obligatorii empty/loading/error
  + reguli UX transversale (buton identic, dezaprob cu justificare, fill slab, verificare non-blocantă).
- **`docs/EMAILURI.md`** (nou) — copy pentru magic link, invitație, notificări schiță (propusă/acceptată/respinsă).
- **`docs/CONFIDENTIALITATE-GDPR.md`** (nou) — registru de prelucrări + schelet notă confidențialitate/ToS;
  marcat clar „de finalizat (jurist) înainte de Val 2 / public".
- **`docs/PLAN-TESTE.md`** (nou) — piramida de teste, reguli business de testat, scenarii de securitate (IDOR,
  escalare), scenarii E2E Playwright. Marker `HUMAN_RUNS_TESTS` respectat.
- **`docs/ADR.md`** (nou) — 10 decizii de arhitectură în formă scurtă (single-app, magic link, schiță asincronă,
  vectorial, polimorfism, fără scoring, două porți, invitație ÎN HOLD, seed-only, Neon+Drizzle).
- **`README.md`** — tabelul de documentație actualizat cu toate fișierele noi.

### Documente lipsă — adăugate cele 3 blocante înainte de scaffold (Faza 0)
- **`README.md`** (nou, rădăcină) — pagina de intrare pe GitHub pentru Edi (Collaborator): ce e proiectul,
  stack, structură țintă, rulare locală, glosar, flux de lucru. Onest marcat **pre-scaffold**.
- **`.env.example`** (nou) — inventarul complet de variabile de mediu cu placeholdere și comentarii (DB, Auth.js,
  Resend, Blob, TTL-uri tunable). Fără secrete reale. Confirmat că `.gitignore` îl lasă să se comită.
- **`docs/PLAN-SEED.md`** (nou) — planul de conținut seed pentru lansare: câte detalii, criteriul „polarizant
  pe rol", distribuție pe categorii, autori seed, pump inițial autentic (fără falsuri), invitați, metrici de
  validare. Marcate clar deciziile de produs pentru Edi.

### Fluxul de cont — clarificat „două porți" + verificare „pull, nu push" (mesaj nou de la Edi)
- **Decuplate explicit cele două porți** (se confundau): **Poarta 1 = accesul** (cine intră → invitația),
  **Poarta 2 = credibilitatea** (cât „cântărești" odată intrat → rol declarat → verificat). Sunt independente.
- **Verificarea rolului reformulată ca „pull, nu push"** (confirmat de Edi): opțională, fără blocare; rol
  neverificat = **funcțional 100%**; doar un **nudge blând permanent** („Rolul tău nu e verificat → Verifică");
  userii vin **singuri** să se verifice, motivați de credibilitate (rol verificat „cântărește" mai mult în
  ochii cititorului). La verificare le cerem date → aprobare manuală admin → **badge steluță galbenă**. Fără scoring.
- **Invitația (Poarta 1) marcată ÎN HOLD** — rămâne în plan, dar e **sub reevaluare cu Edi** (invite-only vs.
  deschidere publică la lansare). Mesajul lui Edi viza doar verificarea, nu modul de acces → invitația neatinsă deocamdată.
- Actualizat: `ARHITECTURA.md` §3 (+ notă poartă acces), §9, §13; `CLAUDE.md` „Acces & roluri" + decizii.

---

## 2026-06-19

### Aliniere `CLAUDE.md` la documentele clientului (3 docuri de la Edi)
- Citite integral cele 3 documente din `documente_client/` (Document Fundamental v3.0, Specificația MVP,
  răspunsurile lui Edi). Edi a precizat: **Documentul Fundamental = gândirea inițială** → unde bate altfel,
  câștigă Specificația MVP / răspunsurile mai noi.
- **Verificarea rolului — corectat:** rolul e **auto-declarat de user la signup** (acces imediat, frecare minimă);
  `Invitation` dă **doar acces** la beta închis (NU mai atribuie rolul). Verificarea = **flux separat în platformă**
  → **badge steluță galbenă**; aprobare manuală (admin) în MVP. Actualizat glosarul + secțiunea „Acces & roluri".
- **Schiță — detalii UX adăugate** (de la Edi, păstrată ca feature OBLIGATORIU în MVP): **fill slab** pe
  detaliul-mamă la intrarea în modul schiță; unelte = mai multe **culori stridente** + 3 grosimi + radieră +
  undo/redo (viitor: Line/Circle/Square/Arrow/casetă text); model **asincron** confirmat de Edi.
- **Notificări:** in-app **ȘI email** de la început (via Resend) — brand awareness/recall.
- **Discovery:** adăugată secțiune — feed finit **~20 detalii** după interacțiuni, fără scroll infinit.
- **Decizii confirmate de Edi** mutate într-o secțiune dedicată (magic link, schiță asincronă, un singur rol,
  rol auto-declarat, zone listă fixă + „General", notificări email). **Upload v1 = seed-only (confirmat)**;
  deschiderea uploadului pentru useri = Val 2.

### Aliniere `docs/ARHITECTURA.md` + rescriere `docs/plan nontehnic.md` (pentru prezentare la Edi)
- **`docs/ARHITECTURA.md`** adus la zi cu deciziile confirmate: verificare rol (auto-declarat la signup +
  flux în platformă cu badge, `Invitation` = doar acces); model de date corectat (scos `isLifetime`, scos
  rolul din `Invitation`, un singur rol/user, imagine jpg/png/webp ~5MB, max 3 resurse, zone listă fixă +
  default „General"); schiță (fill slab + culori stridente + 3 grosimi); notificări in-app + email; feed
  ~20; roadmap (schițare = obligatorie MVP, upload seed-only în v1); hooks (ntfy eliminat); §13 restructurat
  în „confirmate" vs „deschise".
- **`docs/plan nontehnic.md`** rescris integral: Partea I actualizată (rol declarat→verificat, schiță cu
  fill slab, notificări email, feed ~20); Partea II transformată din „întrebări cu spații goale" în
  „ce ai confirmat (integrat)" + „ce mai avem nevoie" (subroluri, taxonomie categorii, verificare auto rol).

### Consolidare doc Edi (un singur document) + completare `.gitignore`
- Întrebările pentru Edi mutate în documentul non-tehnic și fuzionate cu el; rezultat:
  **`docs/plan nontehnic.md`** = Partea I (de ce arhitectura asta) + Partea II (întrebări + default-uri).
  Șterse `docs/DE-CE-ARHITECTURA-ASTA.md` și `docs/INTREBARI-PENTRU-EDI.md`. Referințe actualizate în
  `CLAUDE.md` și `.remember/remember.md`.
- **`.gitignore`** completat: `playwright/.cache/`, `.eslintcache`, `.turbo/`, certuri locale (`*.pem`,
  `*.local.key/crt`).

### `CLAUDE.md` de proiect (instrucțiuni domeniu — fără cod)
- **`CLAUDE.md`** (rădăcină) — completează globalul cu specificul DETALIA: glosar de domeniu, stack
  confirmat, reguli de business non-negociabile (validare pe roluri, state machine schiță, acces/roluri),
  arhitectură pe straturi, securitate, convenții de lucru, decizii deschise. Enforce business pe server.
- Adăugată secțiunea **„Standarde moștenite (`D:\Claude_Development_Rules`)"** — pinuiește convențiile
  concrete de la scaffold: format unic de eroare API + coduri standard, authz 401/403 (nu 404), config în
  env; DB Drizzle (snake_case, uuid `gen_random_uuid()`, FK indexate, migrații reversibile). Notează
  divergența: DETALIA = magic link → endpoint-urile parolă/MFA din `Backend.md` nu se aplică; Auth.js
  gestionează sesiuni/tokeni.

### Setup inițial proiect & arhitectură (faza de planificare, fără cod)
- **`docs/ARHITECTURA.md`** — document de arhitectură complet (prezentabil clientului): principiul
  organizator „GitHub pentru construcții", stack recomandat cu justificare, model de roluri + verificare,
  model de date, arhitectură pe straturi, inima (validarea pe roluri), deep-dive schițare colaborativă,
  feed/căutare, securitate, tabel de cost, roadmap în faze, decizii deschise.
- **`docs/DE-CE-ARHITECTURA-ASTA.md`** — varianta non-tehnică a deciziilor de arhitectură, pentru Edi
  (client non-tehnic). *(redenumit ulterior în `docs/plan nontehnic.md`)*
- **Decizie de stack confirmată:** single-app Next.js (App Router) pe Vercel; Neon Postgres + Drizzle;
  Auth.js magic link; Resend (email); Vercel Blob (stocare); Canvas + perfect-freehand pentru schiță
  (stroke-uri vectoriale). NU monorepo Fastify în faza de validare (motivare în ARHITECTURA.md §2).
  Migrarea la API separat rămâne posibilă fără rescriere (business izolat în `server/`).
- **Hooks recalibrate de la WhatsappAI la DETALIA:**
  - `block-pii-log.js` — PII-ul vizat schimbat din mesaje/imagini WhatsApp în emailuri, parole, tokenuri
    (invite/magic-link/sesiune), OTP, secrete, dovezi verificare rol (OAR/CUI); scoping pe structura
    single-app în loc de `apps/api/src`.
  - `lint-web.js` — ESLint single-file mutat de pe `apps/web/` pe structura single-app la rădăcină
    (`app/`, `components/`, `lib/`, `server/`, `db/`).
  - **Eliminat hook-ul `Stop` (ntfy)** — nu se mai folosește.
- **`.gitignore`** creat — ignoră node_modules/.next/.env*/.vercel/loguri/teste + fișierele Claude locale
  (`settings.local.json`, `.loop-state`, lock-uri) și partea volatilă din `.remember/`. Se comit: `docs/`,
  hook-urile partajate, `settings.json`, `.env.example`, `.remember/remember.md`.

### Decizii deschise rămase (pentru Edi)
- Schițarea în MVP: așteptăm cum o vede Edi (asincron tip GitHub vs. altceva).
- Lista de subroluri per rol principal.
- Metoda de verificare a rolului (MVP = manual admin; surse automate ulterior, ex. OAR).
