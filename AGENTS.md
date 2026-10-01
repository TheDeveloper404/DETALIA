# DETALIA — Instrucțiuni de proiect (Codex)

Portat din `CLAUDE.md` (Claude Code) 2026-09-19, ca Codex să aibă contextul de proiect —
Codex citește doar `AGENTS.md`, nu `CLAUDE.md`. Sursa originală rămâne `CLAUDE.md`; dacă diverg
în timp, actualizează-le pe amândouă sau spune explicit care e sursa de adevăr curentă.

> Acest fișier completează regulile globale (`~/.codex/AGENTS.md` — proces, clasificare,
> quality gates, securitate) cu **specificul DETALIA**: domeniu, model de date, reguli de
> business, structură. Globalul câștigă pe proces/securitate; aici stă „ce înseamnă lucrurile"
> în acest produs. Arhitectura completă: `docs/ARHITECTURA.md`.

> **`CONTEXT.md`** (în același director) conține detaliile de domeniu/business: ce este
> DETALIA, stack, glosarul de domeniu, regulile de business (validare pe roluri, schiță, acces
> & roluri), deciziile de produs confirmate/deschise. NU se încarcă automat — citește-l doar
> când chiar ai nevoie de detaliul respectiv (ex. implementezi un flux de business, verifici o
> decizie de produs).

---

## Arhitectură pe straturi (clean architecture — regula de aur: zero business în handlers/componente)
- `app/` (UI + route handlers + server actions) rămâne **SUBȚIRE**: validează input, deleagă la service.
- Business-ul stă în `server/`: `domain/` (entități, roluri, state machines) → `services/` → `repos/` (Drizzle).
- Mutațiile trec prin **services**, nu direct din UI în DB.
- Deny-by-default: tot ce e sub zona protejată cere sesiune; rolul se verifică pe server.

---

## Securitate (tratăm auth/roluri/validare ca CRITICAL)
- Fără secrete în cod → env (`vercel env`). PII (email, tokenuri, OTP, dovezi rol) **nu se
  loghează** — doar metadate. *(Hook `block-pii-log` blochează încălcările sub Claude Code —
  vezi nota de mai jos, nu e încă portat pentru Codex.)*
- Toate regulile de business de mai sus = enforce pe server. Frontend-ul nu e sursă de adevăr.
- Magic link: token scurt, one-time.

### Mentenanță recurentă (TOATE remindere-le periodice, nu se întâmplă automat)
> Secțiune unică pt orice „trebuie verificat/schimbat din când în când" — nu se împrăștie în alte secțiuni.

- **`AUTH_SECRET` — rotire trimestrială.** Rotirea invalidează instant TOATE sesiunile active
  (JWT semnate cu secretul vechi devin nevalide) — de făcut într-o fereastră asumată, nu din
  greșeală. Schimbi valoarea în Vercel (env, ambele scope-uri Preview + Production) → redeploy.
- **`ADMIN_TOTP_ENCRYPTION_KEY` — NU se rotește ca `AUTH_SECRET`** *(SEC-P02, 2026-09-02)*: e
  cheia cu care sunt criptate secretele TOTP din `admin_totp`. O rotire fără re-criptarea
  rândurilor le face NEDECRIPTABILE → toți adminii rămân blocați afară (fail-closed, intenționat).
  Dacă chiar trebuie schimbată: mai întâi resetează al doilea factor din panou, apoi schimbă
  cheia, apoi reînrolează.
- **`next-auth` (Auth.js v5) — verificare periodică de versiune** *(actualizat 2026-08-10, audit
  securitate 13 categorii)*: proiectul rulează pe `5.0.0-beta.32` + `@auth/core` `0.41.3`
  (release de securitate iulie 2026, include GHSA-8fpg-xm3f-6cx3 — fail-open pe middleware v5) —
  librăria e încă oficial BETA. La checkpoint-ul lunar, verifică `npm view next-auth versions`
  pentru o beta mai nouă cu fix-uri de securitate.
- **Scanare periodică de cod mort cu `knip`** *(regulă 2026-07-13)*: PostHog arată doar ce a
  crăpat vreodată, nu cod mort care n-a aruncat nicio eroare. Rulează `npx knip` ~lunar. **Nu
  șterge orbește din rezultat:** Server Actions (`"use server"`) apar des fals-pozitiv —
  verifică fiecare candidat înainte de ștergere.
- **Igienă observabilitate (PostHog) după orice refactor/rescriere care elimină cod** *(regulă
  2026-07-13, declanșată de eveniment nu de calendar)*: după ce ștergi/înlocuiești un fișier sau
  o librărie, treci prin dashboard-ul de erori și închide manual ce nu se mai poate reproduce,
  cu un comentariu scurt de ce.
- **Reminder săptămânal observabilitate** (rutină cloud, luni 09:00 RO) — doar notificare push;
  **PostHog e sursa unică** (Sentry decommission FĂCUT 2026-07-16).
- **Liste de pe profil (Detalii/Schițe/Activitate) — fără paginare reală la scară** *(decizie de
  business, 2026-07-16)*: `listAuthorDetails`/`listAuthorSketches` (`server/repos/profileRepo.ts`)
  NU au `LIMIT`. Maxim real verificat (2026-08-18): 66 schițe. **Reminder**: la 100+ pe un user,
  adaugă `LIMIT` + fetch separat la expand — nu preventiv acum.
- **Cotă Resend vs. digest săptămânal** *(2026-09-03)*: plan free = 100/zi, 3000/lună. La ~70+
  useri activi verifică headroom-ul real.
- (Candidat, neconfirmat ca obligație recurentă: test periodic de restore pe backup-ul DB.)
- **După ORICE SQL manual rulat pe Neon (skill `neon-sql`) → rulează și `npm run db:generate`
  local**, ca istoricul din `db/migrations/` să rămână sincron cu `db/schema.ts` — vezi capcana
  din secțiunea de mai jos. `db:generate` NU atinge nicio bază, deci e sigur de rulat oricând.
- **Revizuire lunară allowlist Dependabot** (mutat din backlog, 2026-08-25): excepție tolerată pe
  `brace-expansion` — verifică lunar dacă a apărut fix compatibil.
- **DAST (ZAP) — lunar, sau la orice implementare mare**: `zap-baseline.yml` (neautentificat) →
  `zap-full-auth.yml` (autentificat) → skill `dast-preview` (ad-hoc). Nu se pornește automat —
  userul declanșează sau cere explicit.

---

## Standarde moștenite (`D:\Claude_Development_Rules`)
Sursa de adevăr pentru inginerie/securitate. Skill-urile globale (`security-audit`,
`clean-architecture`, `ui-ux-review`, `secure-api-route`, deja portate în `~/.agents/skills/`)
le aplică automat. Din ele, **convenții concrete adoptate în DETALIA**:

**API (route handlers `app/api/...`):**
- Răspuns JSON; timestamps ISO 8601; sesiune via **cookie HttpOnly** (gestionată de Auth.js).
- **Format unic de eroare:** `{ "error": { "code", "message", "details?" } }`.
  Coduri standard: `VALIDATION_ERROR`(400) · `UNAUTHORIZED`(401) · `FORBIDDEN`(403) ·
  `NOT_FOUND`(404) · `CONFLICT`(409) · `UNPROCESSABLE`(422) · `RATE_LIMITED`(429) ·
  `INTERNAL_ERROR`(500, fără internals).
- Authz: `401` (lipsă auth) / `403` (rol greșit) — **niciodată `404` ca să ascunzi existența**.
  Fără stack-trace / erori SQL / căi în răspuns. Rate-limit pe endpoint-urile sensibile.
- Valori tunable (TTL token magic-link etc.) **în env, niciodată hardcodate**.

**DB (Drizzle / Postgres):**
- Tabele `snake_case` plural; coloane `snake_case` singular. PK `uuid DEFAULT gen_random_uuid()`.
- `created_at` / `updated_at` standard; **toate FK indexate**; **migrații reversibile**.

**Divergență față de `Backend.md`:** DETALIA folosește **magic link passwordless** (Google OAuth
scos) → endpoint-urile de register/login-cu-parolă/reset-password/MFA din `Backend.md` **NU se
aplică**. Sesiunile, tokenurile și adapter-ul de DB le **gestionează Auth.js**.

---

## Fluxul de lucru per task (SDLC minimal)
**Fluxul complet (7 pași) + Definition of Done sunt GLOBALE** — vezi `~/.codex/AGENTS.md`
§„Fluxul SDLC per task". Aici doar specificul DETALIA:
- Migrație de schemă → SQL brut dat userului pentru AMBELE ramuri Neon (dev + prod) — skill `neon-sql`.
- Auditul de securitate complet (13 categorii) e pe listă ÎNAINTE de lansarea publică.
- Igienă observabilitate post-refactor + scanare `knip` — remindere recurente, vezi „Mentenanță
  recurentă" mai sus.

### Rollback — dacă `main`/producția se strică după merge
Procedură completă în `docs/DEPLOY.md` §2c punctul 4. Rezumat: rollback de cod e INSTANT
(Vercel), rollback de schemă NU e automat — verifici compatibilitatea înainte să presupui că un
simplu „promote" repară tot.

### Alertare activă pe erori de producție
PostHog: 2 alerte active către Slack („issue created", „issue spiking"). Erorile de producție
chiar notifică activ, nu doar se strâng pasiv.

### Jurnal de incidente
Orice incident REAL de producție → rând scurt în `docs/INCIDENTS.md` (ce, cauza verificată,
impact, fix).

---

## Convenții de lucru (specifice acestui proiect)
- **Regulile de colaborare sunt GLOBALE** (`~/.codex/AGENTS.md`, nu se dublează aici): română ·
  aprobare pe PLANURI nu pe pași · un fix pe rând · build/type-check după schimbări de
  tipuri/schemă · git exclusiv de user (mesaj de commit sugerat, niciodată pe `main`).
- **Documentație** în `docs/`. **Changelog detaliat cu dată** în `docs/CHANGELOG.md`.
- **`docs/BACKLOG.md`:** un item LIVRAT se **ȘTERGE definitiv** din backlog — istoricul e doar
  în `CHANGELOG.md`.
- **E2E rulează pe PREVIEW VERCEL** (`E2E_BASE_URL` din `.env.e2e`), NICIODATĂ localhost. Un spec
  nou în proiectul Playwright **`security`** NU face `request.get/post` HTTP către o rută —
  preview-ul e în spatele Deployment Protection și POST-ul e redirectat (urmat ca GET → `200`
  fals). Se testează logica prin service/repo direct pe `db`.
- **Docs librării:** folosește **context7 MCP** (dacă e configurat în această sesiune Codex)
  înainte de a scrie cod cu Next.js / Auth.js / Drizzle / perfect-freehand. Se aplică și la
  DEBUGGING: orice ipoteză despre comportamentul intern al unui API se verifică ÎNAINTE de a
  propune un fix.
- **Nu iau decizii de design/UI singur.** La un fix de consistență/vizual aliniez DOAR ce diferă
  explicit; propun și întreb înainte de a adăuga elemente noi.
- **UI nou → verifică `docs/UI-REGISTRY.md` întâi** (pattern-uri deja stabilite).
- **Nu dramatizez probleme minore.** Fără dovadă de impact real, spun direct „nu e grav".
- **Nu verific din inițiativă** (Playwright/browser/screenshot) — verificarea o cere userul explicit.
- **La bug/incident: verific ÎNTÂI cu dovadă directă** (query SQL, `git log`, cod).
- **Pe lucrări CRITICAL** (auth, sesiune, permisiuni, bani): rulez singur o trecere adversarială
  (sesiune expirată/stale, acțiuni concurente, input rău-intenționat, dispozitive/tab-uri
  multiple, back-button după logout).
- Userul e singura interfață de decizie de produs; când lipsește o informație pun default neutru.

### Capcane tehnice cunoscute
- **Cookie sesiune persistent** — `authjs.session-token` persistă în browser; test ca anonim = incognito/clear cookies.
- **Drift schema Neon** — `production` și `preview/dev` sunt baze SEPARATE; orice `ALTER TABLE` se aplică manual pe AMBELE ramuri.
- **Verificările Neon via MCP țin compute-ul treaz** — orice query resetează timer-ul de suspend (300s).
- **Migrație distructivă fără verificare = pierdere de date reală** (2026-07-02, `category_id`). Verifici efectiv că tabelul e gol pe branch-ul țintă.
- **Turbopack CSS HMR stale pe Windows** — `globals.css` nu se recompilează mereu la salvare.
- **Comandă Playwright `-g` filtrată pe un test din `describe.serial`** poate pica fals dacă testul anterior nu rulează — dă fișierul întreg dacă există dependență serial.
- **Asertările de test (accessible name, ordine logică) nu se presupun din citit codul** — se verifică efectiv.
- **`ref={...}` pe un element randat condiționat `{stateTogglabil && (...)}`** (bug CRITIC 2026-07-16, `detail-actions-menu.tsx`): elementul se demontează când condiția devine false; `ref.current` mai târziu = `null`, eșuează silențios. Elemente cu `ref` folosit AFARA momentului randării condiționate trebuie montate PERMANENT.
- **Subquery corelat Drizzle cu coloană necalificată → corelare mereu falsă, silențios** (RECIDIVĂ DE 3 ORI, ultima cu impact real de producție — `docs/INCIDENTS.md`). Orice subquery corelat NOU → calificare explicită cu `sql.identifier("tabel")`, verificată cu `.toSQL()` + date reale.
- **Cascada de FK NU acoperă tabelele polimorfice și nici Blob-ul** (`validations`/`comments` referă prin `target_type`+`target_id`, fără FK). Orice ștergere NOUĂ de entitate-părinte trece prin `deleteDetailCascade`/`deleteSketchCascade`.
- **La notificări, verifică accesul DESTINATARULUI, nu al actorului** (RECIDIVĂ DE 3 ORI, 2026-08-09). Orice `notify*` nou pe un traseu cu proiecte: `recipientHasAccess` explicit, pe `recipientUserId`.
- **Un invariant transversal nou produce câte un bug în fiecare loc care nu trece prin poartă** (14 goluri reale în 6 runde de review, feature „Proiect"). Enumeră EXHAUSTIV căile înainte de a repara — locuri cu risc: feed + rail-uri, profil public, teasere publice (`/s/[id]`), toate `notify*`, listele private, planșele, orice mutație care citește direct din `detailsRepo.getDetailById`.
- **`Response.redirect()` întoarce headers IMUABILE** (bug producție 2026-08-09, `proxy.ts`). Folosește `NextResponse.redirect()` + `res.cookies.set()`.
- **Funcție pasată ca prop din Server Component către Client Component → crash real** (2026-08-11). RSC nu serializează funcții — pasează primitivele brute, calculează local în client.
- **`db/migrations/` poate diverge silențios de `db/schema.ts` ȘI de baza live** (2026-08-18). Orice sesiune care rulează SQL manual pe Neon → `db:generate` imediat după, în ACEEAȘI tură.
- Test de regresie pentru invariantul transversal: `server/repos/project-visibility.test.ts` — NU acoperă `/s/[id]`, `notify*`, `/saved`, `plansaService`.
- **`workflow_dispatch` din GitHub UI — dropdown-ul de branch rămâne pe `main` dacă nu-l schimbi explicit ÎNAINTE de „Run workflow"**. Verifică `headBranch` din rulare, nu presupune.
- **Step-ul `ZAP Baseline Scan` apare roșu chiar și când scanul a rulat corect** — comportament normal, nu bug. Dovada reală: `Total of N URLs` + `Upload raport` verde.
- **Tab/selecție „activă" ținută ca INDEX de array, nu ca id → schimbă silențios ce se afișează dacă lista se reordonează** (bug real, 2026-08-25). Orice stare de „element activ dintr-o listă care se poate schimba sub el" → id, niciodată index.

### Guardrails de repo
- **Documentația = parte din Definition of Done.** Orice set de modificări actualizează
  `CHANGELOG.md` + docul afectat + handoff.
- **`SCHEMA.md` = design doc; sursa de adevăr e CODUL** (`db/schema.ts`).
- **CI** (`.github/workflows/ci.yml`): type-check + lint + build pe fiecare PR. Build verde ≠ teste verzi.
- **Hooks locale Claude Code** (`.claude/`, nu în repo): `block-pii-log`, `block-secrets`,
  `block-push-main`, `lint-web`, `warn-conditional-ref`, `review-checkpoint` (contor: peste 12
  modificări de cod de producție de la ultimul `/code-review` real → blochează). **Nu sunt încă
  portate pentru Codex** (necesită citit configul local Claude Code al acestui proiect și
  adaptat la `apply_patch`, la fel cum s-a făcut pentru hook-urile globale) — de făcut ca pas
  separat dacă chiar lucrezi cu Codex pe DETALIA în mod susținut, nu doar exploratoriu.

---

## Decizii de produs
Mutate în `CONTEXT.md` §„Decizii de produs confirmate" / §„Decizii deschise".
