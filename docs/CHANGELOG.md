# CHANGELOG — DETALIA

Jurnal detaliat al modificărilor, cu dată. Cel mai recent sus.

---

## 2026-06-20

### Fix CI: warning Node 20 deprecated pe GitHub Actions
- `actions/checkout@v4`→`v5`, `actions/setup-node@v4`→`v5` (rulează nativ pe Node 24, nu mai sunt forțate de pe Node 20).
- `node-version: 20`→`24` (LTS curent) pentru build-ul aplicației. Doar workflow CI; cod neafectat.

### Faza 0 — pasul 5 (complet): cont admin/seed + authz admin
- **Model admin (decizie):** NU există coloană `is_admin` — admin = user normal al cărui email e în allowlist-ul
  **`ADMIN_EMAILS`** (env, separat prin virgulă), deny-by-default. Fără migrație, reversibil; un admin rămâne rând
  în `users` (deci poate fi autor de detalii / `created_by_admin_id`).
- **`lib/admin.ts`** — `isAdminEmail` · `isAdminSession` · `requireAdmin()` (guard pt rute/acțiuni admin, aruncă
  `FORBIDDEN`; callerul decide 403 vs redirect).
- **`db/seed.ts`** + script **`db:seed`** (tsx) — creează idempotent conturile din `ADMIN_EMAILS` (`onConflictDoNothing`
  pe email). Încarcă `.env.local` apoi `.env`; guard pe `DATABASE_URL`; **fără PII în loguri** (doar numere). Rolul
  acestor rânduri: autor pt detaliile seed + țintă pt FK admin, înainte de primul login (magic link leagă același rând).
- **`.env.example`** — adăugat `ADMIN_EMAILS`. **+dep:** `tsx` (runner scripturi TS).
- **Notă repo:** `drizzle.config.ts` încarcă `.env` (`dotenv/config`), dar `.env.example` documentează `.env.local`
  — inconsistență; seed-ul încarcă ambele ca plasă. (De aliniat ulterior.)
- **Verde:** `typecheck` ✓ · `lint` ✓ · `build` ✓. Seed verificat: rulează prin tsx, guard-ul DATABASE_URL oprește curat
  (rularea reală cere credențiale Neon).

### Faza 0 — pasul 4 (complet): onboarding rol + schelet invitație (HOLD)
- **Arhitectură pe straturi (server/):** `domain/roles.ts` (roluri principale confirmate + subroluri DRAFT de reconfirmat;
  validatori `isValidRoleMain`/`isValidSubRole`; fără import DB → safe în client) · `repos/rolesRepo.ts` (Drizzle) ·
  `services/roleService.ts` (`declareRole`: un rol/user, subrol ∈ rol principal, enforce pe server + constrângere DB).
- **UI onboarding:** `app/onboarding/page.tsx` (server, guard `auth()` → /login dacă nelogat, → / dacă are deja rol) +
  `role-form.tsx` (client: select rol → subrolurile se filtrează; `useActionState` pt erori/pending) +
  `actions.ts` (server action: ia userId din sesiune, deleagă la service, redirect / la succes).
- **Schelet invitație (Poarta 1 = HOLD, NEcablat):** `repos/invitationsRepo.ts` + `services/invitationService.ts`
  (`createInvitation` token criptografic `randomBytes(32).base64url` + TTL din `INVITATION_TTL_HOURS`; `validateInvitation`/
  `consumeInvitation` one-time + expirare). NU e legat de signup — activarea invite-only e o decizie de produs deschisă.
- **Verde:** `typecheck` ✓ · `lint` ✓ · `build` ✓ (`ƒ /onboarding` în rute).

### Faza 0 — pasul 4 (început): pagina /login (magic link) + verificare runtime pas 3
- **Smoke test pas 3 (runtime, fără credențiale):** `/api/auth/providers` → listează Resend ✓ · `/api/auth/csrf` → token ✓ ·
  rută protejată → **302 → `/login?callbackUrl=...`** ✓ (deny-by-default confirmat). Cookie-uri `HttpOnly; SameSite=Lax`.
- **`app/login/page.tsx`** — pagină de login passwordless: formular email → server action `signIn("resend", { email, redirectTo })`.
  `AuthError` → redirect `/login?error=<type>` cu mesaje prietenoase (fără internals). `redirectTo` = `callbackUrl` din query.
  Randare verificată live: status 200, formular + mesaj de eroare prezente.
- **`lib/auth.ts`** — adăugat `pages: { signIn: "/login" }` (Auth.js folosește pagina noastră, nu cea default). `verifyRequest` rămâne pe default.
- **Verde:** `typecheck` ✓ · `lint` ✓ · `build` ✓ (`ƒ /login` în rute).
- ⏳ Rămâne din pas 4: onboarding rol (tabel `roles`) + schelet invitație (Poarta 1 = HOLD). Testarea trimiterii reale a
  magic link-ului cere `AUTH_RESEND_KEY` + domeniu + `DATABASE_URL`.

### Faza 0 — pasul 3: autentificare Auth.js v5 (magic link) + deny-by-default (verde)
- **`lib/auth.ts`** — config central Auth.js v5: `DrizzleAdapter` (tabele mapate explicit:
  users/accounts/sessions/verificationTokens) + provider **Resend** (magic link, `from` din `EMAIL_FROM`,
  `maxAge` din `MAGIC_LINK_TTL_MINUTES`). Strategie sesiune **`database`** (folosim tabelul `sessions`),
  `trustHost: true`. Callback `session` expune `user.id` (pentru authz pe server). Export `handlers/auth/signIn/signOut`.
  - **Decizie:** fără split-config `auth.config.ts`+JWT — driverul Neon (HTTP/fetch) e edge-compatible,
    deci configul complet rulează și în proxy. Mai simplu + folosim sesiuni DB.
- **`app/api/auth/[...nextauth]/route.ts`** — re-exportă `GET/POST` din `handlers`.
- **`proxy.ts`** (Next 16 înlocuiește `middleware.ts`) — **deny-by-default**: tot ce nu e public cere sesiune;
  neautentificat pe rută protejată → redirect la `/login?callbackUrl=...`. Public: `/`, `/login`, `/api/auth/*`, assets.
- **Fix latent `db/index.ts`:** clientul Neon se construia la import (`neon(DATABASE_URL!)`) → `next build`
  (page-data collection) pica fără `DATABASE_URL`. Soluție: connection string cu **placeholder ca fallback**
  (driver Neon HTTP e lazy — se conectează abia la prima interogare; la runtime DATABASE_URL real e mereu setat).
  `db` rămâne instanță drizzle reală → `DrizzleAdapter` o detectează corect.
- **Verde:** `typecheck` ✓ · `build` ✓ (`ƒ /api/auth/[...nextauth]`, Proxy activ) · `lint` ✓.
- ⚠️ **Testare end-to-end a magic link-ului** cere `AUTH_RESEND_KEY` + domeniu verificat (de la Edi) + `DATABASE_URL`
  pe Neon — structural complet, funcțional după credențiale.

### Fix: CI invalid de la primul commit (toate rulările roșii)
- **Cauză:** `.github/workflows/ci.yml#L52` — pasul „Pre-scaffold" avea `run: echo "Pre-scaffold: ..."` inline;
  `:` urmat de spațiu într-un scalar YAML neîncadrat = interpretat ca mapping → **fișier de workflow invalid**.
  Efect: GitHub respinge workflow-ul la parsare (`startup_failure`, 0 jobs, 0s) și atașează eșecul fiecărui push
  (dev + merge-uri pe main) — de aici toate 6 rulările roșii, „triggered via push" deși `on: pull_request`.
- **Fix (soluția cea mai sigură):** scos colon-ul din mesajul echo (`Pre-scaffold -` în loc de `Pre-scaffold:`),
  pe o singură linie inline. Block scalar `run: |` trecea js-yaml, dar linter-ul Red Hat din VS Code încă reclama
  („Nested mappings are not allowed in compact mappings") → am ales forma fără colon, validă în ORICE parser.
- **Validat:** `npx js-yaml ci.yml` → VALID; niciun alt `run:` inline cu colon-space în fișier.
- **+ trigger `push` pe dev/main** (pe lângă `pull_request`): cu workflow valid, pushurile directe pe dev nu
  declanșau nimic vizibil; acum CI rulează și pe push, și pe PR → feedback verde imediat. Comentarii trecute pe ASCII.
- ⚠️ **Necesită push:** fixul e local; cele 6 rulări roșii sunt istoricul vechi (workflow invalid). Până la push,
  GitHub are tot fișierul invalid → nu rulează nimic. După push pe dev → ar trebui să apară prima rulare verde.
- Notă: era doar fișierul de workflow — codul/schema/scaffold neafectate; CI nici n-a apucat să verifice ceva.
  Lecție: validez YAML-ul de workflow (js-yaml/actionlint) înainte să mă bazez pe el.

### Faza 0 — pasul 2: schema DB în cod + migrații (verde)
- **`db/schema.ts`** — schema Drizzle completă (13 tabele), sursa de adevăr a modelului (`SCHEMA.md` rămâne design doc):
  - **Tabele Auth.js** (adapter Drizzle): `users` (extins cu `status`, `invited_by_id`, `created_at`), `accounts`,
    `sessions`, `verification_tokens` — cu cheile TS exacte cerute de adapter (emailVerified, sessionToken, userId, providerAccountId).
  - **Tabele de domeniu:** `roles`, `invitations`, `categories` (self-FK), `details`, `detail_resources`, `sketches`,
    `validations`, `comments`, `notifications`. 8 enum-uri (user_status, role_main, verification_status, target_type,
    validation_position, sketch_status, detail_resource_type, notification_type).
  - Constrângeri cheie: **unică `(user_id, target_type, target_id)` pe `validations`**, FK indexate, `uuid gen_random_uuid()`,
    `created_at`/`updated_at` (cu `$onUpdate`). `casing: "snake_case"` → coloane snake_case din chei camelCase.
- **`db/index.ts`** — client Drizzle (Neon HTTP), `casing: snake_case`. **`drizzle.config.ts`** — dialect postgresql, out `db/migrations`.
- **Migrație generată:** `db/migrations/0000_equal_alice.sql` (13 tabele, FK, indici, enum-uri). Verificat: snake_case + unique + gen_random_uuid().
- **Verde:** `typecheck` ✓ · `db:generate` ✓ · `lint` ✓ · `build` ✓. Rămâne `db:push` pe Neon (cere `DATABASE_URL`).

### Faza 0 — pasul 1: schelet Next.js + tooling (verde)
- **Scaffold Next.js** generat cu `create-next-app` și integrat în repo (păstrând docs/`.github`/`CLAUDE.md`/`README`
  existente): **Next 16.2.9 · React 19.2.4 · Tailwind v4 · ESLint 9 (flat) · TypeScript 5 strict**.
- **Dependențe adăugate:** `drizzle-orm`, `@neondatabase/serverless`, `next-auth@beta` (v5), `@auth/drizzle-adapter`,
  `zod`; dev: `drizzle-kit`, `dotenv`, `prettier`. (`vitest` se adaugă când scriem testele — Faza 1.)
- **Scripturi `package.json`:** `dev/build/start/lint` + `typecheck` (tsc --noEmit) + `format` + `db:generate/push/migrate/studio`.
  Astea **activează CI-ul** (`.github/workflows/ci.yml` nu mai trece „gol").
- **ESLint:** exclus tooling-ul local din lint (`.claude/`, `.agents/`, `.remember/`). **Prettier:** `.prettierrc.json` + `.prettierignore`.
- **Curățare boilerplate:** `app/page.tsx` = placeholder DETALIA (nu mai e pagina default Next); `layout.tsx`
  metadata DETALIA + `lang="ro"`; SVG-urile default Next șterse din `public/`. `.env.example` aliniat la
  **`AUTH_RESEND_KEY`** (convenția Auth.js v5, în loc de `RESEND_API_KEY`).
- **Verificat verde:** `typecheck` ✓ · `build` (Turbopack) ✓ · `lint` ✓.
- Încă NU: schema DB în cod, Auth.js, middleware, onboarding (pașii 2–5). Independente de credențiale.

### Document de securitate (nou) — evidență per-endpoint
- **`docs/SECURITATE.md`** (nou) — document viu, construit ca **listă de bifat** ca să nu rămână rute neacoperite:
  matrice de protecție per endpoint (auth/rol/input/rate-limit/business/ownership-IDOR/test/status), model de
  zone deny-by-default, mapare pe cele 13 categorii din `Audit_checklist`, riscuri specifice DETALIA (polimorfism,
  ownership dublu pe schițe, poziție unică), poartă de securitate per fază. Regula: endpoint fără rând verde = neacoperit.
- Capcanele clasice (authz uitată, IDOR, validare doar pe frontend, leak prin erori, enumerare) listate cu antidot.
  README actualizat.

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
