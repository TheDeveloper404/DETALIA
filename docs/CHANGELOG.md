# CHANGELOG — DETALIA

Jurnal detaliat al modificărilor, cu dată. Cel mai recent sus.

---

## 2026-07-14 — E2E: eșecuri la publish cauzate de epuizarea reală a rate-limit-ului (nu bug de cod)

**Diagnosticat din dovadă directă** (DOM capturat la eșec, `error-context.md`): testele de publicare
detaliu picau constant pe „Publică detaliul" (URL rămânea pe `/edit` sau `/new`). Snapshot-ul arăta
clar alerta reală a aplicației: *„Prea multe detalii publicate într-un timp scurt. Încearcă mai
târziu."* — nu era flakiness, era **`limiters.createDetail` (10 publicări/oră per user, `lib/rate-
limit.ts`) real epuizat**, pentru că userul seedat de e2e e FIX la fiecare rulare, iar suita a rulat
de multe ori azi în aceeași fereastră de o oră.

- **Fix:** `e2e/auth.setup.ts` resetează acum cotele Redis (`createDetail`, `mutation`, `upload`) ale
  userilor seedați la începutul fiecărei rulări, via `Ratelimit.resetUsedTokens()` (API oficial,
  verificat cu context7 — nu s-a ghicit formatul cheilor Redis). Rulează doar dacă `UPSTASH_REDIS_
  REST_URL`/`TOKEN` sunt prezente în `.env.e2e` (opțional — lipsă = warning, nu eroare fatală).
  Namespace-ul Redis calculat corect după `E2E_BASE_URL` (`"preview"` pt orice deploy Vercel,
  `"development"` pt localhost) — NU după env-ul procesului local de Playwright.
- **Limiter-ul de producție NU a fost atins** (protecție reală anti-abuz, SEC-01) — fix-ul e strict pe
  partea de test infrastructure.
- **Ipoteză separată, neconfirmată:** un al doilea eșec (`notifications-page.spec.ts`) a apărut DOAR
  la rulare locală cu 6 workers (CI rulează cu 1, `playwright.config.ts`), consistent cu limiter-ul
  general `mutation` (40/min) sub presiune de la workers paraleli pe același user seedat. Recomandare:
  `npx playwright test --workers=3` la rulări locale ale suitei complete, ca să nu se apropie de prag.
- „Rulează de două ori" (confuzie raportată) — verificat direct în `gh run list`: **nu rulează**, doar
  apare de două ori în lista de Actions. Vercel trimite webhook-ul `vercel.deployment.success` de două
  ori per deploy; al doilea e filtrat de condiția `if: environment == 'preview'` din `e2e.yml` și
  devine `skipped` fără să pornească vreun job.
- **`e2e.yml` (CI)** actualizat să treacă și `UPSTASH_REDIS_REST_URL`/`TOKEN` la job — altfel fix-ul de
  mai sus se sare (warning) și în rulările automate din CI, nu doar local. Secrete noi de adăugat în
  GitHub → Settings → Secrets and variables → Actions: `E2E_UPSTASH_REDIS_REST_URL`,
  `E2E_UPSTASH_REDIS_REST_TOKEN` (aceleași valori ca scope-ul Preview din Vercel).

---

## 2026-07-14 — Fix: dezaprobare repetată raporta „succes" fals, fără să salveze justificarea

**Bug găsit din raportare directă a lui Liviu** (a scris o justificare la dezaprobare, textul nu a
apărut nicăieri — nici ca dezaprobare, nici ca simplu comentariu):

- **Cauza reală (verificată în cod, nu presupusă):** `disapprove()` din `validationService.ts` întorcea
  necondiționat `{ ok: true }`, chiar și când `upsertDisapprovalIfTransition` întorcea `null` (userul era
  DEJA în poziția DISAPPROVE pe acea țintă — tranziția atomică din DB nu s-a produs, deci comentariul-
  justificare nu s-a mai creat, intenționat, ca să nu apară duplicate). Userul primea confirmare de
  succes, dar textul lui nu ajungea nicăieri, fără nicio eroare vizibilă.
- **Fix:** cod nou de eroare `ALREADY_DISAPPROVED` — `disapprove()` întoarce acum `{ ok: false, error:
  "ALREADY_DISAPPROVED" }` în acest caz; `validation-actions.ts` mapează mesajul: *„Ai dezaprobat deja
  acest conținut — textul nou nu a fost salvat. Editează justificarea existentă din comentarii dacă vrei
  s-o schimbi."*
- **Verificat, NU schimbat** (decizie confirmată cu Liviu, contrar propunerii lui inițiale): diferența
  vizuală comentariu/dezaprobare exista deja (`comments-section.tsx` — chenar roșu + etichetă „✕
  dezaprobare"), la fel „fostă dezaprobare · retrasă" la retragere. Justificarea la retragere **rămâne**
  intenționat (decizie din 2026-07-06, motiv documentat în cod: transparență/istoric public al
  dezbaterii) — NU se șterge, cum propusese inițial Liviu; a confirmat recomandarea de a păstra.
- Test unitar existent (`validationService.test.ts`, cazul de dublu-submit/race) actualizat să aștepte
  noul cod de eroare în loc de `{ ok: true }`. 12/12 teste unitare verzi, `tsc`+`lint`+`build` verzi.

---

## 2026-07-14 — Landing page: animații pe secțiunile 01-05, secțiune nouă „Planșa ta", hero rescris, fix-uri mobil

**Landing public (`app/page.tsx`) redesenat pe bucăți — de la conținut static la interacțiv, pe baza
feedback-ului direct al lui Liviu (comparat cu screenshot-uri reale din aplicație: `feed.png`,
înregistrare `test.mp4`):**

- **01 — Problema & soluția:** panoul „diff" cascadă rând cu rând (nu tot blocul deodată); hover pe
  rând mărește ușor textul (variabile CSS, nu inline, ca să evite conflictul de specificitate cu
  starea implicită).
- **02 — Cum funcționează:** fiecare cadru (`FlowFrame`) folosește acum un detaliu REAL (imagine,
  fundal eliminat — `public/landing/how-it-works-detail.png`), cu propunerea desenată live peste el
  (traseu unghiular, nu curbă/mâzgălitură) + hașură (notație reală de material) + filtru SVG de
  „tremur de mână" (`feTurbulence`/`feDisplacementMap`). Butoane reale „Schițează"/„Aprob"/„Dezaprob"
  cu tap simulat, întreaga secvență în buclă la 10s (nu o singură dată).
- **03 — Planșa ta (NOU):** secțiune nouă, introdusă după 02 (feature „Planșă" — spațiul privat de
  organizare a detaliilor — nu avea deloc prezență pe landing). Mockup cu 4 „bilețele" (2 cu imagini
  reale, 2 cu schițe abstracte generice — nu desene tehnice false), plutire lentă continuă
  (`--plansa-rot` custom property, respectă `prefers-reduced-motion`). Restul secțiunilor renumerotate
  04 (Ce câștigi, reveal în cascadă) / 05 (Pentru cine, accent de culoare pe rol identic cu
  `role-pill.tsx` în loc de emoji generic, motiv vizual „un singur detaliu" deasupra grid-ului).
- **Hero (`components/hero-preview.tsx`) rescris complet:** poveste în 2 etape — (1) FEED, screenshot
  REAL din aplicație (`public/landing/feed-real.png`, cadru din `test.mp4`, **nume/avatare anonimizate**
  — fără PII reale pe landing-ul public), tap simulat pe un card, (2) crossfade spre detaliul deschis
  (imagine reală `public/landing/hero-detail.png`) cu schiță subțire desenată live + chrome-ul complet
  al cardului (identic cu cardul din feed, pentru continuitate).
- **CTA final „Pre-lansare":** revenit la forma inițială (fără bandă de statistici — testat, dar
  eliminat la cererea lui Liviu, arăta „orfan").
- **Fix-uri mobil:** header-ul (logo + Autentificare + Creează cont) se înghesuia sub ~400px —
  link-ul „Autentificare" se ascunde sub acest prag, padding redus; cookie-consent (`components/
  cookie-consent.tsx`) nu era centrat pe mobil (`max-w-sm` + `left-5` fix depășea viewport-ul) — acum
  responsive (centrat pe mobil, colț jos-stânga pe desktop, ca înainte).

**Verificat activ cu Chrome DevTools MCP** (screenshot-uri reale, nu presupuneri) după ce prima rundă
de modificări „arăta identic" din cauza unor bug-uri de specificitate CSS (inline style vs. regulă de
clasă — inline câștigă mereu fără `!important`) prinse abia la verificare vizuală directă.

`tsc` + `lint` + `build` complet — toate verzi.

---

## 2026-07-14 — Fix critic upload (CSP) + audit securitate complet + suspendare admin + curățenie cod mort

**Bug de producție găsit din raportare user (poză profil "încărcarea a eșuat"), reprodus și confirmat prin
Sentry/Vercel Logs, apoi corectat:**
- **`lib/csp.ts` — FIX CRITIC:** `https://vercel.com` (API-ul REST real al Vercel Blob, folosit de
  `@vercel/blob/client` la fiecare upload direct din browser) era gatat greșit în spatele flagului
  `previewTools` (presupus, greșit, că era doar toolbar de preview) → **CSP bloca TOATE upload-urile
  client-side pe producție** (avatar, cover, imagine detaliu, schiță desenată, resurse PDF/CAD), de la
  introducerea nonce-ului. Acum mereu în `connect-src`, indiferent de mediu. Test nou în `csp.test.ts`.
- **Mesaje de eroare mai clare la upload/ștergere** (`components/edit-profile-header.tsx`,
  `app/(app)/details/new/detail-form.tsx`, helper comun `lib/blob-upload.ts`): catch-ul generic
  („Încărcarea a eșuat. Încearcă din nou.") nu distingea o sesiune expirată de o eroare reală — acum
  verifică `/api/auth/session` și arată „Sesiunea a expirat..." când e cazul.
- **Turnstile dezactivat pe preview:** domeniile dinamice `*.vercel.app` nu pot fi în allowlist-ul
  Cloudflare Turnstile (eroare 110200) → `lib/turnstile.ts` + `auth-form.tsx` + `admin-page/login-form.tsx`
  no-op pe `VERCEL_ENV !== "production"`, la fel ca lipsa secretului. Pe producție neschimbat.

**Audit de securitate complet (13 categorii) — vezi `docs/SECURITATE.md` §2026-07-14 pentru detaliu.**
Verdict APPROVED. Fixate: open-redirect pe `callbackUrl` (auth-actions.ts), fallback nesigur pe Host header
la login admin, autosave Planșă aliniat pe `requireActiveUserId` (SEC-04 consecvent peste tot), tombstone
email cu UUID random (nu userId real). `npm audit` — 0 vulnerabilități.

**Feature nou: suspendare/reactivare cont din `/admin-page`** (`server/repos/usersRepo.ts` `setUserStatus`,
`server/services/accountService.ts`, `app/admin-page/actions.ts` `setUserStatusAction`, buton UI cu
confirmare `user-status-button.tsx`) — moderare reversibilă, alternativă la ștergerea ireversibilă de cont.
Audit nou (`admin_user_suspended`/`admin_user_reactivated`). Test unit (`accountService.test.ts`) + e2e
(`e2e/admin-suspend.spec.ts`, înregistrat în proiectul `admin-access` din `playwright.config.ts`).

**Curățenie cod mort (`knip`):** 3 fișiere complet neutilizate șterse (`category-filter.tsx` — înlocuit
de `category-filter-list.tsx`, `ui/badge.tsx`, `ui/separator.tsx`) + ~20 exporturi/tipuri moarte
(funcții repo/service fără niciun apelant, re-exporturi orfane). Verificat cu `tsc`+teste unit+`next build`
după fiecare lot. `updateRole`/`UpdateRoleResult` (roleService.ts) păstrate deliberat — feature implementat
dar nelegat încă în UI (schimbare rol post-onboarding), nu cod abandonat.

**Igienă Sentry:** 9 issue-uri vechi `unresolved` închise — 7 erau cod mort (Planșa pre-rescriere,
excalidraw/tldraw, eliminate la rescrierea motorului propriu) sau incident istoric de migrație
(2026-07-05, auto-rezolvat); 2 (open-redirect, autosave) rezolvate prin fix-urile de mai sus.

**Reguli noi în `CLAUDE.md` (proiect):** igienă Sentry obligatorie după orice refactor care elimină cod;
scanare periodică `knip` (~lunar sau CI) cu avertisment despre fals-pozitive pe Server Actions; verificare
periodică versiune `next-auth` (beta) — verificat azi, suntem pe ultima (`5.0.0-beta.31`).

**Infra:** `db-backup.yml` — frecvență redusă de la orar la zilnic (03:00 UTC), retenție neschimbată (30
zile) → ~30 backup-uri simultane în loc de ~720 (repo public, fără cost, dar zgomot inutil).

**Documentație:** `docs/QA_TEST_CASES.md` (NOU) — 113 cazuri de test QA pe toate modulele platformei,
generat din codul real (servicii + rute), pentru completat manual (Trece/Nu trece/Parțial).

---

## 2026-07-11 — E2E în CI (Playwright pe preview Vercel) + allowlist permisiuni + worksheet UI landing
- **Fix (primul run real al workflow-ului E2E):** `e2e/detail-edit.spec.ts` apela `getSeed()` în scope-ul
  `describe` → rula la COLECTAREA testelor, înainte ca proiectul `setup` să scrie `e2e/.auth/seed.json` →
  ENOENT pe mașină proaspătă (CI). Local nu se vedea (fișierul exista din rulări vechi). Mutat lazy în
  `beforeAll`. Singurul spec cu problema (verificat toate apelurile `getSeed()`).
- **`.github/workflows/e2e.yml` (NOU):** rulează `npx playwright test` automat după fiecare deploy de
  PREVIEW reușit, via `repository_dispatch: vercel.deployment.success` (production exclus explicit prin
  `client_payload.environment == 'preview'`; sursă: docs oficiale Vercel). Coadă `concurrency` pe DB-ul
  partajat de test; raport Playwright ca artifact la eșec; `workflow_dispatch` manual pentru testare.
  **NEactivat încă:** (1) devine funcțional abia după merge în `main` (repository_dispatch declanșează
  doar de pe branch-ul default); (2) Liviu trebuie să adauge 3 secrete în GitHub → Settings → Secrets:
  `E2E_DATABASE_URL` (ramura Neon dev), `E2E_AUTH_SECRET` (AUTH_SECRET din scope-ul Preview),
  `VERCEL_AUTOMATION_BYPASS_SECRET`. Netestat pe un run real până atunci (YAML validat sintactic).
- **`.claude/settings.json` — allowlist permisiuni (20 reguli):** generat din analiza transcripturilor
  (`/fewer-permission-prompts`) — tsc --noEmit, eslint, npm run lint/test, git fetch, vercel read-only
  (whoami/env ls/logs/ls/inspect), context7, tool-urile read-only Playwright MCP. Mai puține prompturi
  de aprobare pe sesiune. Notă: `npx eslint *` include și `--fix` (mutare de fișiere echivalentă cu Edit).
- **`docs/worksheet-ui-landing.csv` (NOU):** worksheet pentru schimbările de UI pe landing, pe secțiunile
  reale din `app/page.tsx` (Header, Hero B, 01–04, CTA dark, Footer + General/responsive) — Liviu îl
  importă în Google Sheets și completează; implementarea se face pe baza lui.
- **Context (în afara repo-ului, config global Claude):** aprobare pe planuri nu pe pași, split teste
  (Claude rulează unit, Liviu e2e — hook `block-tests` ajustat), SDLC per task promovat global, skill-uri
  noi (unde-am-ramas/neon-sql/citeste-poza), rutine cloud (DMARC 24 iul, checkpoint lunar teste,
  reminder trimestrial AUTH_SECRET), curățenie memorie + WhatsappAI eliminat din config.

## 2026-07-10 — Like pe comentarii (o singură poziție per user, blocat pe conținut propriu) + popup cu aprecierile
Feature nou, cerut de Liviu, pattern identic cu validarea pe roluri (o poziție per user, reversibilă,
enforce pe server):
- **DB:** tabel nou `comment_likes` (PK compus `user_id`+`comment_id` → o singură apreciere per user per
  comentariu, toggle reversibil; FK cascadă spre `users`/`comments`; index pe `comment_id`).
- **Server:** `commentsRepo.toggleCommentLike()` (delete-dacă-exista / insert, `onConflictDoNothing` pt
  curse) + `likeCount`/`likedByMe`/`likers` (subquery corelat, `json_agg`) adăugate în
  `listCommentsForTarget`. `commentService.toggleCommentLike()` — cere rol declarat (`NO_ROLE`, ca la
  comentat) și blochează like-ul pe propriul comentariu (`CANNOT_LIKE_OWN`, aceeași regulă ca la
  `CANNOT_VALIDATE_OWN`). Server action `toggleCommentLikeAction` (rate-limited, `revalidatePath`).
- **UI:** buton „Apreciază" (inimă, optimistic prin `useOptimistic`) lângă fiecare comentariu/reply,
  ascuns pentru autorul propriu. Link „vezi cine" deschide `CommentLikersModal` — popup centrat, listă
  scrollabilă (nume+avatar+rol, click → profil), refolosind tiparul de modal existent (`SendToCanvasModal`),
  fără librărie nouă de dialog.
- **Teste:** unit (`commentService.test.ts` — NO_ROLE, NOT_FOUND, CANNOT_LIKE_OWN, toggle liked/unliked) +
  integrare pe DB real (`e2e/integration.spec.ts` — toggle real pe `comment_likes`, agregarea
  `likeCount`/`likedByMe`/`likers` din `getComments`, cascadă la ștergerea detaliului).
- **De rulat manual pe Neon (dev întâi, apoi production)** — SQL în `docs/DEPLOY.md` sau cerut direct de la
  Claude; fără `db:push`/`db:migrate` din terminal.

---

## 2026-07-10 — Fix layout mobil (7 probleme, din screenshot-uri reale ale lui Liviu)
Audit vizual pe 6 screenshot-uri mobile (landing, profil, pagina de detaliu, mod schiță) — toate elemente
poziționate absolut/fix care nu se adaptau la viewport îngust:
- **Footer (landing):** linkuri + copyright centrate pe mobil (≤720px) — erau lipite de marginea stângă
  din cauza `justify-content: space-between` pe elemente care se rup (`flex-wrap`) în rânduri separate.
- **Header (landing):** pe mobil devine `static` în loc de `sticky` — rămânea fixat peste secțiunea dark
  CTA și footer în timpul scroll-ului.
- **Hero preview (SVG animat):** `aspect-ratio` explicit pe SVG — putea colapsa la randare pe Safari mobil
  (fără `height`/`aspect-ratio`, doar `width:100%` + `viewBox`).
- **Toolbar mod-schiță:** badge „Schiță peste" ascuns sub `sm:`, butoanele „Salvează ciornă"/„Publică"
  devin icon-only pe mobil — eliminată suprapunerea peste titlul detaliului.
- **Dropdown notificări:** pe mobil devine `fixed` ancorat de viewport (nu `absolute` relativ la
  wrapper-ul îngust al clopoțelului) — elimina overflow-ul din stânga ecranului („Notificări" tăiat).
- **Badge rol suprapus (pagina de detaliu):** `whitespace-nowrap` pe pastila de rol + rândul de poziții
  devine `flex-wrap` — „Beneficiar documentat" nu se mai rupe pe 2 linii suprapuse.
- **FAB „Adaugă detaliu":** `pb-24` pe zona de conținut a layout-ului autentificat — butonul fix nu mai
  acoperă ultimele rânduri (ex. comentarii) pe nicio pagină.

---

## 2026-07-10 — Suită E2E completă: 82/82 verde
Rulare completă (`npm run e2e -- --workers=1`), confirmată de Liviu: **82 passed, 0 erori.** Zero regresii pe
tot ce s-a schimbat în ultimele două zile (Turnstile admin login, CSP scope preview, security.txt, fix HEIC
upload, +2 teste IDOR, test de concurență). Suita e verde de la un cap la altul, nu doar fișierele noi.

---

## 2026-07-10 — Infra: DMARC întărit, redirect canonical www, confirmări Vercel/Sentry
Continuare pe golurile minore rămase din auditul de securitate 2026-07-09 (`docs/SECURITATE.md`):
- **DMARC `p=none`→`p=quarantine`** pe AMBELE înregistrări (`_dmarc.detalia.ro` + auto-generata
  `_dmarc.send.notifications.detalia.ro`) — după confirmarea DKIM+SPF verified în Resend pe
  `notifications.detalia.ro`. **Monitorizare ~1-2 săptămâni în curs** (rapoarte `rua=` pe `liviu@detalia.ro`)
  înainte de a trece la `p=reject` + SPF `~all`→`-all` (nu înainte de ~2026-07-24).
- **`www.detalia.ro` → redirect canonical 308 la `detalia.ro`** — Vercel Domains, confirmat activ.
- **Plan Vercel confirmat: rămâne Hobby** — migrarea la pay-as-you-go (Neon Launch + Upstash PAYG) trecută
  pe HOLD, nu e urgentă la volumul actual.
- **Alertarea Sentry confirmată funcțională** — notificările de issue nou chiar ajung la Liviu (era doar
  „configurată", neverificat direct până acum).

---

## 2026-07-10 — Mesaj clar pentru poze HEIC la upload (fix preventiv; NU cauza incidentului investigat)
Pornit de la un log de producție (`1.png`) — un user a raportat că prima poză n-a mers, a doua da. Investigație
în etape, cu corectare pe parcurs (nu s-a ghicit o cauză finală fără dovadă):
1. Ipoteză inițială: userul era pe iPhone (semnal din log: `SafariViewService`, browser-în-aplicație iOS),
   deci poza ar fi fost HEIC — format nesuportat de `sharp` (binarele precompilate npm/Vercel NU decodează
   HEIC, codec HEVC sub restricții de brevet, confirmat din docs oficiale `sharp`).
2. **Corectat:** telefonul real era un Nothing Phone (Android) — rândul `SafariViewService` din log aparținea
   altui vizitator (iPhone), coincidență de timp, nu acestui user. Ipoteza HEIC/iPhone nu se aplică incidentului.
3. Test live pe producție cu o poză HEIF reală → **a mers fără eroare** — confirmă că browserul/OS-ul convertește
   HEIF→JPEG la selectare înainte să ajungă la codul nostru (comportament comun), nu că `sharp` suportă HEIF.
4. **Sentry verificat pentru fereastra incidentului: zero evenimente.** Exclude o excepție server capturată
   (ex. eșec la reprocesare). Concluzie onestă: **cauza reală a incidentului rămâne necunoscută** — probabil
   ne-related la formatul imaginii (conexiune, eroare de operare, glitch local), nu un bug confirmat de-al nostru.

**Fix livrat totuși** (util independent de acest incident, protejează userii de iPhone unde HEIC e o problemă
documentată): detecție HEIC ÎNAINTE de upload, cu mesaj clar și acționabil în loc de eroarea generică „format
neacceptat". `lib/blob-upload.ts` — `isHeicFile()` (verifică `file.type` ȘI extensia din nume, HEIC vine des cu
`file.type` gol în unele browsere) + `HEIC_ERROR_MESSAGE` partajat. Aplicat în cele 3 puncte de upload de
imagine: `detail-form.tsx`, `onboarding-form.tsx`, `edit-profile-header.tsx`. Fără teste noi — validare pură de
UX client. **Nu se închide ca „incident rezolvat"** — rămâne fără cauză confirmată, doar fără reproducere/dovezi
suplimentare de urmărit.

---

## 2026-07-09 — Audit securitate (Codex black-box + audit intern white-box) + fix Turnstile pe admin login

### audit(security) — dublu audit înainte de expunere publică
Auditul STRICT programat rulat în două paralele: **Codex** (black-box, producție, fără cont/mutații — nota
8.2/10 pe suprafața anonimă, zero Critical/High) + **audit intern white-box** (verificare directă în cod a
suprafețelor pe care black-box-ul nu le poate atinge: mutații/server actions, mass-assignment, XSS stored,
upload, CSRF). Verdict intern: **APPROVED, zero Critical/High**. Confirmat curat: rate-limit distribuit
fail-closed în prod, `verificationStatus` nesettabil de user, mențiuni randate prin parser (fără injecție),
blob pinuit pe store-ul propriu, `npm audit` = 0 vulnerabilități. Findings coincidente (toate minore):
DMARC `p=none`, `www` fără canonical, `vercel.live` în CSP prod, `security.txt` lipsă.

### test(security) — acoperire IDOR completă + concurență (dublu-submit)
Închide golurile semnalate în auditul intern. IDOR (`e2e/security.spec.ts`): +2 scenarii cross-user —
ștergere ciornă detaliu (`deleteDetailDraft` → `NOT_FOUND`) și ștergere ciornă schiță (`deleteDraft` →
`false`), victima supraviețuiește. Total IDOR: 7 scenarii (comentariu edit/delete, schiță delete published/
draft, ciornă detaliu, planșă, editare detaliu). **Concurență:** test nou care trage 5 dezaprobări paralele
(`Promise.all`) pe aceeași țintă → verifică în DB O poziție + UN comentariu-justificare (probează upsert-ul
atomic `onConflictDoUpdate` cu `setWhere`, nu doar citit codul). Rulare: `npx playwright test
e2e/security.spec.ts` (preview, nu prod). *(`platform_settings` rămâne observare, nu bug — calea de citire e
tolerantă + instrumentată Sentry cu `.cause`; nu se repară pe ghicit fără traceul real.)*

**Confirmat rulat 2026-07-10 (Liviu): 9/9 teste verzi** (`npx playwright test e2e/security.spec.ts`).

### fix(security) — hygiene din audit: security.txt + CSP scope pe preview (Low)
Două minore din audit: (1) `/.well-known/security.txt` (RFC 9116) — route handler public (adăugat în
`PUBLIC_PATHS`), canal standard de raportare responsabilă; contact `liviu@detalia.ro` (deja public în DNS
DMARC), `Expires` 2027-07-09 (de reînnoit). (2) CSP — originile toolbar-ului Vercel (`vercel.live`,
`vercel.com`, `pusher`) trec pe preview ONLY (`VERCEL_ENV !== "production"`); pe producție suprafața CSP e
mai mică. Blob storage + Turnstile rămân MEREU (funcțional real). MVP n-are real-time → pusher e exclusiv
toolbar. Test unit nou `lib/csp.test.ts`. *(Rămân minorele infra `www` canonical + DMARC `p=quarantine` —
în handoff, se fac din DNS/Vercel UI.)*

### fix(security) — Turnstile pe admin login (SEC — Medium din audit)
`/admin-page/login` nu avea Turnstile, spre deosebire de `/login` (era deja atenuat de rate-limit 10/15min
email + 30/15min IP + allowlist + anti-enumerare, dar inconsistent). Fix: extras widget-ul Turnstile într-un
component partajat nou (`components/turnstile-widget.tsx`, fără a atinge `auth-form.tsx` live), adăugat în
`login-form.tsx`, verificare server-side `verifyTurnstile` în `requestAdminLinkAction` — plasată ÎNAINTE de
ramura `isAdminEmail` (răspuns generic, fără scurgere). Test unit nou: `app/admin-page/login/actions.test.ts`
(captcha respins blochează înainte de sendEmail, anti-enumerare pe email non-admin).

---

## 2026-07-09 — Licență proprietară, fix UX sesiune-fantomă, cleanup profil, limită avatar separată, autor→profil clickabil

### docs — `LICENSE` proprietar la rădăcină
Fișier explicit „toate drepturile rezervate" (nu o licență open-source din listă GitHub) — decizie luată
anterior (vezi handoff), rămasă neexecutată până acum. Fără nume de entitate/CUI (SRL încă neînființat).

### fix(security) — UX sesiune-fantomă după curățare DB
Un cont șters complet din DB (curățare/GDPR) cu JWT stale încă valid rămânea „blocat" vizual logat, într-o
buclă la `/onboarding` (poarta din `proxy.ts` verifica doar „are rol?", nu „mai există userul?"). Fix: funcție
nouă `userExistsById` (`server/repos/usersRepo.ts`) apelată pe calea `!hasRole`; dacă userul nu mai există,
`proxy.ts` șterge direct cookie-urile de sesiune și redirectează la `/login` în loc de `/onboarding`.

### refactor — elimină „Specializări" (câmp mort din profil)
`specializations: []` din `profileService.ts` era mereu gol, hardcodat, nefolosit — redundant cu meseria
(`subRole`, deja implementată în `server/domain/roles.ts`). Șters din `profileService.ts` și `profile-view.tsx`
(tip + blocul UI condiționat care nu randa niciodată nimic). Backlog-ul „Specializări pe profil" închis.

### fix(limits) — limită de mărime separată pentru avatar/cover (8MB) vs imagine de detaliu (25MB)
`MAX_IMAGE_MB=25` era folosit peste tot, inclusiv pentru avatar/cover — prea generos pentru o poză de profil.
Limită nouă `MAX_AVATAR_MB=8` (`lib/upload-limits.ts`), enforce pe server (poarta reală, `/api/blob/upload`,
`kind: "avatar"`) + validare client (`edit-profile-header.tsx`, `onboarding-form.tsx`). Imaginea de detaliu
rămâne la 25MB.

### style — nota de format imagine mai discretă în edit-profile-header
Textul „PNG, JPG, WebP sau AVIF · max X MB" avea `border-t` + padding propriu care-l făcea să arate ca o bară
separată de card. Scos separatorul, redus padding-ul.

### feat(ux) — click pe numele/avatarul autorului duce direct la profil (stil LinkedIn)
Adăugat link spre `/profile/{authorId}` pe avatar+nume în: card feed (`detail-card.tsx`), header pagină
detaliu (`detail-workspace.tsx`), comentarii+reply-uri (`comments-section.tsx`), editorul de schiță
(`sketch-editor.tsx`, a necesitat threaduirea unui prop nou `authorId` din `edit/page.tsx`). Nu s-au atins:
taburile de schițe din teanc (switch funcțional, nu navigare), mențiunile `@` (picker funcțional), teaser-ul
public `/s/[id]` (decizie documentată: doar CTA, fără linkuri adânci pentru anonimi). Eliminat itemul „Vezi
profilul autorului" din meniul kebab (`detail-actions-menu.tsx`, acum redundant) + cleanup prop `authorId` și
import `User` rămase neutilizate.

---

## 2026-07-08 — Fix SEC-04 (cookie sesiune la suspendare) + 4 bug-uri reale în suita e2e + manual utilizator

### fix(security) — cookie-ul de sesiune supraviețuia suspendării unui cont (SEC-04)
`suspended.spec.ts` prindea corect problema (nu era flake): la prima mutație a unui cont suspendat,
`requireActiveUserId` (`lib/require-active-user.ts`) trebuia să delogheze real (cookie șters), dar cookie-ul
rămânea viu. Două cauze combinate, găsite cu dovadă directă din trace Playwright (headere `Set-Cookie`
efective, nu presupunere):
1. **Ordine greșită** — ștergerea manuală a cookie-ului rula ÎNAINTE de `signOut()`, iar `signOut()` își
   re-scrie propriul `Set-Cookie` (re-emite un token) DUPĂ, anulând ștergerea. Fix: ștergerea mutată în
   `finally` (rulează după `signOut()`, deci ultima pe wire).
2. **`cookieStore.delete(name)` nu acceptă opțiuni** (verificat cu context7 în docs oficiale Next.js) →
   Set-Cookie-ul de ștergere ieșea fără `Secure`. Un cookie cu prefix `__Secure-` e respins de browser dacă
   Set-Cookie-ul care-l atinge n-are `Secure` (regulă de spec) → ștergerea era ignorată silențios. Fix:
   `cookieStore.set(name, "", { path:"/", maxAge:0, httpOnly:true, secure:true, sameSite:"lax" })` în loc de
   `delete()`.

Confirmat REZOLVAT pentru garanția care contează: **mutația e blocată + redirect la `/login` de fiecare
dată, în toate rulările** (verificat direct). Un al treilea aspect a rămas cosmetic-racy și a fost slăbit
în test, nu forțat cu alt patch: strategia JWT (Auth.js) reîmprospătează cookie-ul de sesiune pe ORICE
citire reușită (design intenționat — citirea trece cu token stale), iar un prefetch automat de `<Link>`
(navbar) concurent cu delogarea poate re-emite cookie-ul DUPĂ ștergerea noastră (cursă confirmată din trace,
nu bug de cod — JWT nu poate fi invalidat server-side înainte de expirare fără o listă neagră, per docs
Auth.js). Testul nu mai asertează „cookie mereu absent" — asertează garanția reală (mutație blocată).

### fix(test) — 4 bug-uri reale în suita e2e, NU flake (toate cu dovadă din trace/screenshot Playwright)
- `saved.spec.ts` (ambele teste „salvează"/„scoate din salvate"): click optimist pe butonul de bookmark
  (fire-and-forget, `feed-save-button.tsx`) + `page.goto()` imediat după → naviga înainte ca request-ul către
  server să ajungă, anulându-l (confirmat ulterior și în Sentry: `TypeError: Failed to fetch` real pe POST
  `/saved`, prins live după o rulare e2e). **Prima încercare de fix a fost greșită** —
  `await expect(saveButton).toHaveAttribute("aria-pressed", ...)` verifică starea OPTIMISTĂ din UI, care se
  schimbă instant, înainte de round-trip — nu garantează nimic despre server. **A doua încercare a fost tot
  greșită**: `waitForResponse((r) => r.request().method()==="POST" && r.ok())` fără filtru pe URL prindea
  primul POST reușit din pagină — care era `sentry-tunnel` (telemetrie), nu server action-ul real (confirmat
  din trace: request-ul de save nici nu apărea încă în listă). Fix real: matcher pe URL-ul EXACT al paginii
  curente (`r.url() === page.url()`), pe ambele teste.
- `authed.spec.ts` „Dezaprob cere justificare": `getByRole("button", { name: /retrage/ })` — regex FĂRĂ flag
  `i` (case-sensitive), dar textul afișat e „Retrage" (R mare) → locatorul nu se potrivea niciodată, `click()`
  expira 30s fără nicio eroare vizibilă. Plus: asertarea `getByText(/Ai dezaprobat acest detaliu/)` viza un
  text care nu mai era vizibil pe pagină de la refactorul UI din 2026-07-06 (devenise doar `title` pe butonul
  colapsat). Fix: flag `i` adăugat + asertare mutată pe `getByText(/dezaprobă/)` din rândul de poziții
  (pattern identic cu testul de Aprob).
- `sketch.spec.ts` „Șterge schița mea": butonul are `role="menuitem"` explicit (`detail-actions-menu.tsx`),
  care suprascrie rolul implicit ARIA „button" al elementului `<button>`. Testul căuta
  `getByRole("button", ...)` — rol greșit, locatorul nu se rezolva niciodată (confirmat din trace: butonul
  era perfect vizibil în screenshot, dar cu alt rol ARIA, nicidecum problemă de vizibilitate/timing). Fix:
  `getByRole("menuitem", ...)`.

Corectează retroactiv notele din (11)/(10)/(8) mai jos, care presupuneau flake/hidratare — cauza reală era
alta, în ambele cazuri bug-uri de test cu fix exact, nu artefacte.

### feat(docs) — `docs/MANUAL_UTILIZATOR.md` nou
Manual non-tehnic pentru useri: creare cont → rol (+ notă că verificarea rolului nu e încă disponibilă) →
feed → postare detaliu → aprob/dezaprob → schițe → comentarii → salvare → planșe → notificări → editare
profil, plus tabel cu toate limitele de rate-limit explicate în termeni umani.

### fix(docs) — `/confidentialitate` — lista de furnizori tehnici înlocuită cu formulare vagă
Secțiunea „Cu cine partajăm datele" enumera explicit furnizorii (Vercel/Neon/Resend/Sentry/Cloudflare
Turnstile) — înlocuit cu descriere generică (găzduire, bază de date, email, stocare imagini), fără nume de
firme.

### infra — DNS Cloudflare verificat vizual (screenshot Liviu), toate corecte
12 records, toate DNS only (niciuna proxiată): Google Workspace pe root (MX/SPF/DKIM/DMARC) + Resend pe
`send.notifications.detalia.ro` (SPF/DKIM/DMARC separate, fără conflict cu SPF-ul de pe root) + Vercel
(CNAME apex/www + verificare domeniu). `support@detalia.ro` rămâne alias (routing) pe `liviu@detalia.ro` în
Google Workspace — nu cont nou; cele 2 conturi plătite (`liviu@`, `edi@`) rămân neschimbate.

---

## 2026-07-07 (13) — Publicat Termeni și condiții + Notă de confidențialitate (draft)

### feat — `/termeni` + `/confidentialitate`, linkuite din footer
Pagini publice noi (`app/termeni/page.tsx`, `app/confidentialitate/page.tsx`), adăugate în `PUBLIC_PATHS`
(`proxy.ts`). Conținut din scheletul deja existent în `docs/CONFIDENTIALITATE-GDPR.md` §3/§4, extins în
proză. Linkuite din footer-ul landing-ului (`app/page.tsx`) și din rail-ul feed-ului authed
(`components/feed-rail.tsx`). Fiecare pagină are un banner vizibil: document de lucru, **nerevizuit încă de
jurist**. Operatorul e listat generic („SRL în curs de înregistrare") — Liviu+Edi nu au firmă înființată
încă; de completat cu denumire/CUI/sediu ulterior. Contact: `support@detalia.ro`.

### fix — dedicat sesiunii: 13 documente din `docs/` verificate/actualizate față de cod + `docs/README.md` nou
`SCHEMA.md` (lipseau `canvases`/`canvas_items`, `CAD`), `ARHITECTURA.md` (referință reziduală invitații, faze
nemarcate închise, status email notificări greșit), `SECURITATE.md` (notă „rămân de testat" depășită, acum
acoperită de `admin-access.spec.ts`+`suspended.spec.ts`), `PLAN-TESTE.md` (22→~86 teste), `EMAILURI.md`
(nu menționa oprirea emailurilor de notificare), `PLAN-SEED.md` (criteriu de succes imposibil — verificare rol
pe HOLD), `DEPLOY.md` (lipsea backup-ul orar GH Actions), `Detalia_Canvas.md` (banner de divergență explicit
față de implementarea v2). Găsit și: secțiunea „§Decizii / HOLD" citată de mai multe docs nu mai există în
`.remember/remember.md` (pierdută într-o comprimare anterioară) — de recreat.

---

## 2026-07-07 (12) — Acoperire e2e extinsă (8 fișiere noi) + fix bug reproductibilitate `auth.setup.ts`

### test — 8 fișiere e2e noi, acoperă paginile/fluxurile rămase netestate
`profile-edit.spec.ts`, `profile-public.spec.ts`, `saved.spec.ts`, `notifications-page.spec.ts`,
`sketch-public.spec.ts` (teaser `/s/[id]`), `admin-access.spec.ts` (privilege-escalation pe `/admin-page`,
fără să depindă de un email real din `ADMIN_EMAILS`), `feed-search.spec.ts` (căutare + filtrare categorie),
`verify-and-maintenance.spec.ts` (`/verify` + SEC-03 anti-open-redirect + `/maintenance`). Toate înregistrate
în `playwright.config.ts` (4 dintre ele existau scrise dintr-o iterație anterioară a sesiunii dar nu erau în
niciun `project.testMatch` — nu rulau deloc, prinse din timp).
Rămas neacoperit deliberat: lockdown global live-toggle (risc de coliziune pe DB shared, `fullyParallel`).

### fix — `auth.setup.ts`: `seed.json.categoryId` putea diverge de categoria REAL legată de detaliul seedat
`pickLeafCategories(1)` alege o categorie nedeterministă la FIECARE rulare și o scrie mereu în `seed.json`,
dar legătura reală (`detail_categories`) se creează o singură dată (prima rulare, detaliul e reutilizat după
aia) — pe rulările următoare, `seed.json.categoryId` reflecta o categorie nouă, aleasă acum, nu cea legată
efectiv în DB. Confirmat direct din DB (query dedicat), nu presupus. Fix: la reutilizare, citește înapoi
legătura reală din `detail_categories` în loc să folosească alegerea nouă. A cauzat eșecul real (nu flaky) al
testului de filtrare pe categorie din `feed-search.spec.ts`.

### fix — 2 teste proprii, cauze reale confirmate cu dovadă
`saved.spec.ts`: butonul de bookmark nu e în interiorul `<a href>` (sibling, în div-ul de conținut) — selector
scopat greșit pe ancoră → timeout; scopat pe `<article>`. Al doilea test presupunea empty-state global (fragil
pe DB shared) → verifică acum specific dispariția detaliului nostru. `feed-search.spec.ts`: titlul apare de 2
ori pe pagină (cardul + rail-ul „În dezbatere acum") → dezambiguizat cu `getByRole("heading")`.

### infra — regex de config `public.spec.ts` prindea și `profile-public.spec.ts` (substring match)
`profile-public.spec.ts` rula (greșit) și anonim, fără sesiune → toate 3 teste picau pe redirect la `/login`.
Ancorat regexul (`/(^|[\\/])public\.spec\.ts$/`).

### notă — 2 eșecuri pre-existente, ACTUALIZARE 2026-07-08: ambele rezolvate, nu erau flake
`authed.spec.ts` „Dezaprob" — vezi intrarea (10) mai jos, REZOLVAT (bug real de test: regex fără flag `i` +
asertare pe text devenit `title`, nu mai vizibil pe pagină). `sketch.spec.ts` „Șterge schița mea" — REZOLVAT
2026-07-08: cauza reală era `role="menuitem"` explicit pe buton (`detail-actions-menu.tsx`), care suprascrie
rolul implicit „button" — testul căuta `getByRole("button", ...)`, rol greșit, locatorul nu se rezolva
niciodată (confirmat din trace: butonul era perfect vizibil, dar cu alt rol ARIA). Niciunul nu era flake —
erau bug-uri de test, cu cauză exactă, găsite cu dovadă (trace Playwright), nu ghicite.
`canvas.spec.ts` „redenumește planșa" nu a mai reapărut în rulările ulterioare — confirmat flake tranzitoriu
din load-ul rulărilor repetate, cum era suspectat. `suspended.spec.ts` NU era flake: era un bug real de
securitate (SEC-04) — cookie-ul de sesiune supraviețuia suspendării contului din două cauze combinate
(ordine `signOut()`/ștergere cookie + lipsă atribut `Secure` pe cookie-ul de ștergere, obligatoriu pentru
prefixul `__Secure-`). Fix + detaliu complet în handoff-ul de azi (2026-07-08).

---

## 2026-07-07 (11) — DB backup: fix pg_dump v18 + Sentry pe `platform_settings` + tweak sidebar categorii

### fix — `db-backup.yml` picase din nou, cauză diferită de `deb822`
Instalarea `postgresql-client-18` a mers de data asta, dar `pg_dump` apelat era tot v16 (implicit în PATH pe
Ubuntu runner) — mismatch cu serverul (Postgres 18.4), `pg_dump: aborting because of server version mismatch`.
Fix: apelat binarul explicit (`/usr/lib/postgresql/18/bin/pg_dump`). Confirmat cu `workflow_dispatch` manual.

### fix — `platform_settings` citire eșuată intermitent, fără vizibilitate în Sentry
Raportat de Liviu: eroare recurentă (mai multe zile), dar „nu văd nimic în Sentry". Cauză: catch-ul din
`settingsRepo.ts` doar loga `err.message` (wrapper Drizzle generic) cu `console.error`, fără
`Sentry.captureException` — ajungea în Vercel Logs, nu în Sentry Issues. Verificat SQL pe producție: coloanele
DB sunt corecte, NU e drift de schemă (ipoteza din comentariul vechi era greșită). Fix: log și `err.cause`
(eroarea Postgres reală) + `Sentry.captureException` (tag `platform_settings`). Cauza reală rămâne de văzut
la următoarea apariție, acum cu vizibilitate în Sentry.

### tweak — UI sidebar categorii feed (cerut explicit de Liviu)
`category-filter-list.tsx`: rândul activ nu mai are fundal bej — doar bară verticală `border-primary` + text
bold. Cifra „0" de lângă frunze ascunsă complet când `count === 0` (afișată doar dacă sunt detalii reale).

## 2026-07-07 (10) — Fix date: categorii cu `parent_id` greșit DOAR pe producție + consistență header pagini „ale mele"

### fix — săgețile expand/collapse din sidebar feed și din formularul de adăugare detaliu păreau moarte
Raportat de Liviu (bug1.mp4/bug2.mp4): click pe săgeata unui capitol (Fundație/Acoperiș/Instalații/Fațadă)
rotea chevron-ul (`aria-expanded` chiar comuta corect, confirmat din DevTools) dar lista de sub-categorii
nu apărea niciodată — nu era bug de UI/React. Cauză confirmată direct din DB (SELECT, nu presupus): pe
branch-ul de **producție**, 11 frunze (Beton, Micropiloți înșurubați, Șarpantă, Tip terasă, Electrice,
Sanitare, Termice, HVAC, Termosistem clasic, Fațadă ventilată, Fațadă cortină) aveau `parent_id` legat
direct de secțiune („Clasificare după zonă") în loc de capitolul lor — capitolele rămâneau orfane (0 copii).
Pe `dev`/preview datele erau deja corecte; doar producția avea drift-ul. Fix: `UPDATE categories SET
parent_id = ...` (re-parentare la capitolul corect, după slug), rulat manual doar pe branch-ul de producție
din Neon. Nu a fost nevoie de niciun fix de cod.

### fix — lățime inconsistentă + header fără iconiță pe paginile „ale mele"
`/saved` („Detalii salvate") folosea `max-w-[860px]` fix în loc de `max-w-[var(--container-max)]` ca restul
paginilor (`/canvases`, `/sketches/drafts`) → arăta mai îngustă. Aliniat la aceeași lățime. `/sketches/drafts`
(„Ciornele mele") avea titlu fără iconiță și cu alt stil de font față de „Planșele mele"/„Detalii salvate” —
adăugat `PencilLine` + același stil de `h1` (`font-heading text-[26px] font-extrabold`) pentru consistență vizuală.

## 2026-07-07 (9) — Fix db-backup.yml (sintaxă apt greșită la prima încercare)

### fix — workflow-ul de backup producție tot pica după merge, cauză diferită de cea originală
Fix-ul din (vezi CHANGELOG mai jos, „instalare postgresql-client-18") ajunsese pe `main`, dar cu o greșeală
de sintaxă: `deb signed-by=... URL...` fără paranteze pătrate (`[signed-by=...]`) → apt respinge intrarea
ca „Malformed entry" (confirmat direct din log-ul GitHub Actions, nu presupus). Rescris pe formatul `deb822`
(`.sources`), cel documentat ACUM oficial de postgresql.org (verificat cu WebFetch pe pagina oficială,
nu din memorie) — mai robust decât formatul vechi pe o linie. Sintaxă YAML+bash verificată local
(`python -c "yaml.safe_load(...)"` + `bash -n`), dar nu am putut rula `apt` real (Windows) — verificarea
finală se face la următoarea rulare reală pe GitHub Actions, după merge.

## 2026-07-07 (8) — REZOLVAT: hydration mismatch (React #418) — `<li>` imbricat în `<li>`

### fix — cauza reală a bug-ului de hidratare de azi, confirmată cu dovadă directă din browser
Toate încercările de azi (`suppressHydrationWarning`, timezone) au fost ipoteze greșite. Cauza reală,
găsită cu `npm run dev` local + Playwright (browser real, consolă necodificată): `comments-section.tsx`
randa `<li>` în jurul fiecărui `<CommentItem>`, dar `CommentItem` randa ȘI EL propriul `<li>` — HTML invalid
(`<li>` nu poate conține alt `<li>` direct), browserul corectează structura DOM, React se aștepta la alta →
„Hydration failed", butoanele rămân fără handler o vreme (exact simptomul de la „Dezaprob"/„Șterge schița mea").
Fix: `CommentItem` randează acum `<div>` — părintele (`comments-section.tsx`) rămâne singurul care pune
`<li>`-urile corecte în `<ul>` (atât pentru comentarii-rădăcină, cât și pentru replici).

**Verificat înainte/după, în browser real** (nu doar cod): 7 erori de consolă → 1 (doar mismatch-ul de
`nonce`, generic și inofensiv, prezent pe orice pagină Next.js). Ciclu Retrage→Aprob→Retrage testat repetat,
instant, fără blocaje. `authed.spec.ts` „Dezaprob" și `sketch.spec.ts` „Șterge schița mea" ar trebui să treacă
stabil de-acum (de reconfirmat cu `npm run e2e`).

**Corecție 2026-07-08:** predicția de mai sus nu s-a confirmat — cele două teste au continuat să pice și după
acest fix. Fix-ul de hidratare de aici a fost real și corect (rămâne valid), dar NU era cauza eșecurilor
persistente din cele două teste — acelea aveau bug-uri de test complet separate (vezi intrarea (11) de mai
jos, secțiunea actualizată 2026-07-08).

## 2026-07-07 (7) — Fix teste stricate DE fix-ul de date de la (6) + concurență documentată

### test — 3 spec-uri alegeau categorii-frunză ascunse sub un capitol, fără să-l deschidă întâi
Consecință directă a fix-ului de date de mai sus: ÎNAINTE (date stricate, 2 niveluri), orice frunză era
direct vizibilă. ACUM (3 niveluri corecte), unele frunze (Șarpantă, Tip terasă etc.) sunt sub un capitol
(Acoperiș) care trebuie expandat întâi. `pickSimpleLeafCategory`/`pickTwoLeafCategories` (duplicate în 3
fișiere) alegeau orice frunză la întâmplare. Fix: `e2e/category-helpers.ts` (nou) — `pickLeafCategories(n)`
alege STRICT frunze copii direcți ai unei secțiuni (nu ascunse sub un capitol), folosit în
`detail-upload.spec.ts`, `detail-draft.spec.ts`, `detail-edit.spec.ts`.

### test — `feed.spec.ts` scopat strict la sidebar (nu toată pagina)
Un query global (`page.getByRole(...)`) se putea potrivi și cu un tag de categorie dintr-un detaliu
publicat concurent de alt spec, în paralel, pe același nume de categorie. Scopat la
`nav[aria-label="Filtru categorii"]`.

### test — `sketch-numbering.spec.ts` verifică ordine RELATIVĂ, nu numere absolute
`sketch.spec.ts` rulează în paralel pe același cont+detaliu și poate crea o a treia schiță exact în
fereastra de test, deplasând numerele absolute (2 devine 3). Testul verifică acum ce contează de fapt:
prima schiță NU-și schimbă numărul după ce apare a doua, iar a doua primește un număr mai mare.

### Cunoscut, neinvestigat mai departe — flakiness sub 6 workeri paraleli
`sketch.spec.ts` („Șterge schița mea") și `suspended.spec.ts` trec curat izolat/`--workers=1`, dar ocazional
pică sub 6 workeri paraleli (toate pe ACELAȘI cont+detaliu seedat, revalidări concurente). Pare limită
structurală a fixture-ului comun, nu bug de aplicație — `--workers=1` rămâne semnalul de adevăr; 6 workeri
= verificare rapidă, nu autoritativă.

## 2026-07-07 (6) — Fix date: ierarhia de categorii (3 niveluri prăbușită la 2) + coliziune taburi schiță în teste

### fix(date) — capitolele (Fundație/Acoperiș/Instalații/Fațadă) nu aveau copii pe preview/dev
Descoperit de `e2e/feed.spec.ts` (nou, sesiunea trecută): TOATE cele 4 capitole aveau 0 sub-categorii —
„Beton"/„Micropiloți" etc. erau copii direcți ai SECȚIUNII, nu ai capitolului. `db/seed.ts` are deja codul
corect (`parentId: leafRow.id` la nivelul 3) — datele din DB erau dintr-o rulare VECHE a seed-ului, dinaintea
acestui fix de cod, niciodată re-rulată. Fix: re-rulat `npm run db:seed` pe `preview/dev` (după ștergerea
singurului `details` existent, care bloca `DELETE FROM categories` pe FK RESTRICT). **De verificat separat
pe `production`** — query dat lui Liviu, posibil are aceeași problemă.

### test — coliziune între `sketch.spec.ts` și `sketch-numbering.spec.ts` la rulare paralelă
Ambele creează schițe pentru ACELAȘI tester pe ACELAȘI detaliu seedat, în workeri diferiți simultan.
`getByRole("button", { name: "E2E Tester" })` (substring) se potrivea și cu tab-urile celuilalt spec
(„— schița 1"/„— schița 2"), dând strict-mode violation. Fix: `data-testid={`sketch-tab-${id}`}` stabil pe
fiecare tab (`detail-workspace.tsx`), ambele spec-uri țintesc acum STRICT propriul id, nu nume generic.

## 2026-07-07 (5) — Numerotare schițe stabilă (nu se mai renumerotează la fiecare schiță nouă)

### fix — „schița N" per autor era recalculată după ordinea taburilor, nu după data creării
Raportat de Liviu (`1.png`): dacă un autor are schița 1 azi și face alta mâine, platforma denumea
schița de mâine „1" și cea de azi devenea „2" — ordinalul se calcula din poziția în array-ul `sketches`
(cea mai nouă primă, pt afișarea taburilor), nu din ordinea reală de creare. Prima schiță creată trebuie
să rămână „1" pentru totdeauna.
- `app/(app)/details/[id]/detail-workspace.tsx` — eticheta tabului sortează `sameAuthor` ascendent după
  `createdAt` înainte de a calcula ordinalul (nu mai folosește ordinea de afișare a taburilor).
- `app/(app)/details/[id]/comments-section.tsx` — aceeași corecție pe `ordinalById` (etichetele de
  mențiune @schiță din dezbatere, care trebuie identice cu eticheta tabului).
- `app/(app)/details/[id]/page.tsx` — `createdAt` propagat prin `WorkspaceSketch`/`MentionSketch` (lipsea).

### test — `e2e/sketch-numbering.spec.ts` (nou)
Creează 2 schițe secvențial (același autor), verifică că prima rămâne „schița 1" și a doua „schița 2",
indiferent de ordinea de afișare a taburilor (cea mai nouă primă).

## 2026-07-07 (4) — Sidebar Feed: categorii ierarhice (secțiuni + capitole + frunze), nu listă flată

### feat(ui) — sidebar-ul de filtrare din Feed arată acum toată ierarhia de categorii
Cerință Liviu (`1.png` + `lista_categorii.pdf`): categoriile trebuie puse în ordinea din document, cu
titluri/subtitluri, și dropdown la titlurile cu subtitluri. Formularul „Adaugă Detaliu" avea deja exact
această structură; sidebar-ul de Feed (`CategoryFilterList`) era o listă flată de frunze, trunchiată la
6 cu „Vezi mai multe".
- `server/repos/categoriesRepo.ts` — `listCategoriesWithCounts()` întoarce acum tot arborele
  (secțiuni + capitole + frunze), nu doar frunzele; `parentId`/`isGroup` incluse în select.
- `components/category-filter-list.tsx` — rescris: secțiuni ca antete, capitole (ex. „Instalații") ca
  dropdown expandabil (colapsat implicit), frunze ca link-uri de filtru cu counter — pattern identic cu
  `CategoryDropdown` din formular, adaptat la link-uri în loc de checkbox-uri.
- `components/feed-sidebar.tsx` — scroll intern (`max-h-[420px] overflow-y-auto`) pe zona de categorii,
  ca ierarhia completă (mult mai lungă decât vechea listă cap-6) să nu umfle tot sidebar-ul.
- `feed/page.tsx` — nicio schimbare necesară (calculul `total`/`activeId` rămâne corect cu noile date).

### test — `e2e/feed.spec.ts` (nou)
Verifică pattern-ul de bază: un capitol pornește colapsat (`aria-expanded=false`), frunzele lui nu sunt
în DOM cât timp e colapsat, click îl deschide, click pe o frunză filtrează (`?cat=<id>` în URL).


## 2026-07-07 (3) — Sesiune lungă de reparat e2e (47/48 verde) + fix Sentry + timezone

### fix(securitate) — cookie de sesiune al unui cont SUSPENDAT nu se ștergea garantat
`lib/require-active-user.ts`: `signOut()` apelat dintr-un server action nested nu garanta ștergerea
cookie-ului la un cont suspendat cu JWT stale — acum șters explicit prin `cookies()` înainte de `signOut()`.
Găsit de `e2e/suspended.spec.ts` (cookie-ul supraviețuia mutației blocante).

### fix(ui) — Enter la redenumire planșă nu închidea modul de editare
`canvases-list.tsx`: `onKeyDown` pe Enter trimitea formularul dar nu apela `setRenaming(false)` (doar
`onBlur`/Escape o făceau) — inputul rămânea deschis la nesfârșit după salvare.

### fix(observabilitate) — Sentry nu prindea nimic din client, environment lipsă
Client-side Sentry (`instrumentation-client.ts`) nu seta `environment` deloc — `VERCEL_ENV` nu ajunge în
bundle-ul de browser fără mapping explicit, deci toate evenimentele de acolo cădeau sub environment implicit,
invizibile la filtrarea „vercel-preview" din dashboard (asta explica „nu văd nimic în Sentry", nu o problemă
de cont). Fix: `next.config.ts` mapează `NEXT_PUBLIC_VERCEL_ENV`; toate 3 config-urile Sentry
(client/server/edge) setează `environment` explicit. Adăugat și un interceptor ÎNGUST de `console.error`
în `instrumentation-client.ts` care trimite la Sentry STRICT tiparul de mesaj de hidratare al Next.js
(regex, NU console-forwarding general — păstrează decizia „fără PII").

### fix — formatare dată fără timezone explicit (mismatch server UTC vs client România)
`lib/format.ts` (`formatDate`) + duplicate locale în `canvases-list.tsx`/`drafts-list.tsx`: `Intl.DateTimeFormat`/
`toLocaleDateString` fără `timeZone` explicit → server (UTC) și client (ora României) pot arăta zile diferite
pentru timestamp-uri aproape de miezul nopții UTC. Confirmat cu date reale din DB (un comentariu: „6 iul." vs
„7 iul."). Fix: `timeZone: "Europe/Bucharest"` explicit peste tot.

### test — reparat 47/48 din suita e2e (rulată cu `--workers=1`; 6 workeri paraleli pe același cont/detaliu
de test dădeau coliziuni de stare, fals-pozitive)
Cauze reale găsite (nu doar cârpeli): teste stale după refactor-urile UI din 2026-07-06 (text de badge/buton
schimbat), locatori Playwright strict-mode (breadcrumb+heading cu același text), fixture cu URL fals de Blob
respins corect de `isOwnBlobUrl` (SEC-02/A2 funcționează), cleanup de test care intra în coliziune cu alt
spec rulat în paralel (race condition, nu poluare), și CORS pe upload real de imagine cauzat de header-ul
`x-vercel-protection-bypass` (necesar ca Playwright să treacă de Deployment Protection) injectat din greșeală
pe TOATE cererile inclusiv PUT-ul direct către Vercel Blob storage — fix: `e2e/strip-bypass-headers.ts`
scoate headerul doar pe cererile către domeniile Blob.

**REZOLVAT 2026-07-08:** `authed.spec.ts` „Dezaprob" — cauza reală (două bug-uri de test, nu de aplicație,
găsite cu dovadă directă din trace Playwright): `getByRole("button", { name: /retrage/ })` fără flag `i`
(regex case-sensitive, textul afișat e „Retrage" cu R mare → locator nu se potrivea niciodată, click expira
30s) + asertarea `getByText(/Ai dezaprobat acest detaliu/)` viza un text care nu mai era vizibil pe pagină
(devenise doar `title` pe butonul colapsat, din refactorul 2026-07-06). Fix în ambele puncte — testul trece
consistent de atunci. Nota veche „React error #418 hydration" era o ipoteză respinsă la vremea ei; cauza
reală era în altă parte.

## 2026-07-07 (2) — Teste e2e editare detaliu + fix regresie (non-autor pe /edit dădea 404)

### fix — non-autor pe /details/[id]/edit primea 404 în loc de redirect (regresie de azi)
- La feature-ul de ciornă, edit page-ul a trecut pe `getDetailForEditing` (scoped pe owner, ca să
  țină ciornele private) — dar asta a schimbat și cazul unui detaliu PUBLICAT: non-autorul primea acum
  `notFound()` în loc de redirect spre pagina publică (comportamentul vechi, corect — existența unui
  detaliu publicat e deja publică, în feed). Fix: dacă `getDetailForEditing` întoarce null, mai verificăm
  o dată cu `getDetail` (PUBLISHED-only) — dacă există public, redirect; altfel (chiar nu există, SAU e
  ciorna altcuiva) → notFound, păstrând privacy-ul strict al ciornelor.

### test — editare detaliu existent (PUBLISHED), netestat până acum
- `e2e/detail-edit.spec.ts`: autorul editează titlu+categorie → schimbări vizibile pe pagina publică;
  golirea categoriilor → eroare de validare, rămâne pe formular; non-autor pe `/edit` → redirect (nu 404,
  vezi fix-ul de mai sus).
- `e2e/security.spec.ts`: IDOR nou — non-autor nu poate edita detaliul altcuiva prin `updateDetail`
  (service) → `FORBIDDEN`, detaliul rămâne neatins.
- Adăugat `data-testid="category-dropdown-trigger"` pe trigger-ul dropdown-ului de categorii
  (`detail-form.tsx`) — selector stabil pt teste, textul butonului se schimbă cu selecția curentă.

---

## 2026-07-07 — „Salvează ciornă" pe formularul de adăugare detaliu

### feat — detaliile pot fi salvate ca CIORNĂ (status DRAFT), publicate mai târziu
- **Decizii de produs confirmate** (întrebate explicit, nu presupuse): „Ciornele mele" (`/sketches/drafts`)
  devine listă UNIFICATĂ (schițe + detalii, aceeași rută) — nu pagină separată; `image_url` pe `details`
  devine NULLABLE — o ciornă se poate salva doar cu titlul, înainte de upload.
- **Schema (migrație necesară, SQL mai jos):** `details.image_url` NOT NULL → nullable.
- **Domeniu** (`server/domain/detail.ts`): status nou `DRAFT`. `validateDetailInput` primește al doilea
  parametru `{ strict }` (implicit `true`, comportament vechi neschimbat) — `strict:false` (ciornă) cere
  DOAR titlul; imagine/categorie opționale, dar tot validate ca format/plafoane dacă sunt prezente.
- **Repo** (`detailsRepo.ts`): `insertDetailWithRelations` acceptă `status` (DRAFT/PUBLISHED) + `imageUrl`
  nullable; `getDetailForEdit(id, ownerId)` — fetch pt editare (draft SAU published, scoped pe owner ÎN
  query, ca la Planșă — un DRAFT al altui user nu ajunge nici măcar ca „not found după citire");
  `publishDetailRow` (tranziția DRAFT→PUBLISHED); `listDetailDraftsByAuthor`.
- **Service** (`detailService.ts`): `createDetailDraft` / `saveDetailDraft` / `publishDetailDraft` /
  `getDetailForEditing` / `deleteDetailDraft` / `getMyDetailDrafts` — validare lenientă la save, strictă
  la publish (userul poate ajusta câmpuri chiar înainte de publish, nu doar ce era deja salvat).
- **UI** (`details/new/detail-form.tsx`): al doilea `useActionState` + buton „Salvează ciornă"
  (`formAction` separat, `data-intent="draft"` citit în `onSubmit` ca să relaxeze regulile client-side —
  categorie/imagine/desen obligatorii — DOAR pt submit-ul de ciornă; server-ul rămâne sursa de adevăr).
  Editorul (`/details/[id]/edit`) e acum dual-mod: DRAFT → butoane „Salvează ciornă"/„Publică detaliul";
  PUBLISHED → „Salvează modificările" (neschimbat).
- **„Ciornele mele" unificată** (`sketches/drafts/{page,drafts-list,actions}.tsx`): un singur tip
  discriminat (`kind: "sketch" | "detail"`), fiecare cu iconița/eticheta/link-ul/delete-ul lui.
- **Rate-limit:** `limiters.mutation` la salvare ciornă (frecvent, ieftin), `limiters.createDetail` la
  publish (costisitor — imagine, ca la creare directă).
- Teste: `server/domain/detail.test.ts` (strict:false), `e2e/detail-draft.spec.ts` (ciclu complet:
  salvează fără categorie/imagine → apare unificat → reia → publish respinge fără categorie → publish
  cu categorie+imagine → detaliu public; + ștergere ciornă).

### ⚠️ SQL de rulat manual (Neon SQL Editor) — ÎNTÂI `preview/dev`, apoi `production`
```sql
ALTER TABLE details ALTER COLUMN image_url DROP NOT NULL;
```

---

## 2026-07-06 (noapte, târziu) — Unificare afișare rol: doar meseria (subRole), niciunde domeniul

### fix — „Autori activi" (feed) + profil + sidebar feed arătau Domeniu, nu Rolul (cerere Edi, 1.png)
- Convenția „doar meseria apare în platformă, domeniul e grupare internă" exista deja documentat
  (`role-pill.tsx`, `profile/edit/page.tsx`) dar era aplicată inconsecvent — 3 locuri rămase în urmă
  arătau Domeniul (ex. „Proiectare") în loc de Rol (ex. „Arhitect"):
  1. Widget „Autori activi" din feed (`components/feed-rail.tsx`) — query-ul (`listTopAuthors`,
     `server/repos/usersRepo.ts`) nici nu selecta `subRole`.
  2. Cardul propriu din sidebar-ul feed-ului (`app/(app)/feed/page.tsx`).
  3. Header-ul paginii de profil + atribuirea din tabul de Activitate (`roleLabelOf`,
     `server/services/profileService.ts`, un singur helper — fixează ambele locuri deodată).
- Șters `components/author-badge.tsx` — cod mort, neimportat nicăieri, cu convenția veche (Domeniu primar).
- **Exclus intenționat:** panoul de admin (`app/admin-page/page.tsx`) — tabelul de useri arată în continuare
  Domeniu · Rol; decizie: admin-ul are nevoie de context complet pt moderare, nu e „platforma publică".
- Test nou: `server/services/profileService.test.ts` (`roleLabelOf` — subRole prioritar, fallback pe
  eticheta domeniului doar dacă lipsește, „Rol nedeclarat" fără rol).

---

## 2026-07-06 (noapte) — Completare acoperire E2E, flux de lucru SDLC + fix thumbnail schițe pe profil

### test — completare goluri e2e/unitare (nu 100%, vezi listă în `.remember/remember.md`)
- Fișiere noi: `e2e/admin-auth.spec.ts` (SEC-S3, consum atomic token admin), `e2e/suspended.spec.ts`
  (SEC-04 la nivel de acțiune, cont suspendat), `e2e/detail-upload.spec.ts` (formular real de adăugare
  detaliu, upload imagine real), `e2e/sketch-draft.spec.ts` (ciclu draft schiță: salvează→reia→șterge),
  `e2e/canvas.spec.ts` (Planșă — CRUD prin UI, fără motorul de desen), `e2e/notifications.spec.ts`
  (notificări reale în DB + IDOR mark-read), `e2e/onboarding.spec.ts` (formular complet, user fără rol),
  `lib/turnstile.test.ts` (nou), `app/auth-actions.test.ts` (nou, poarta publică de auth).
- Extins: `lib/rate-limit.test.ts` (ramuri netestate: succes/respins/outage cu limiter fake), `e2e/security.spec.ts`
  (IDOR pe Planșă — strict privată).
- Config: `vitest.config.ts` include acum și `app/**/*.test.ts` (înainte doar `{server,lib}`); `playwright.config.ts`
  cu proiecte noi `suspended` și `onboarding` (cookie JWT propriu, izolate de storageState-ul comun).

### docs — flux de lucru SDLC minimal (CLAUDE.md) + rollback + jurnal incidente
- `CLAUDE.md`: secțiune nouă „Fluxul de lucru per task" (clasifică→implementează→testează proporțional→
  review→documentează, în ACEEAȘI sesiune, nu amânat) + Definition of Done ca listă de bife.
- `docs/DEPLOY.md` §2c: procedură de rollback (Vercel promote instant + atenție schema Neon care NU se
  rollback-uiește automat).
- `docs/INCIDENTS.md` (nou, gol) — jurnal scurt pt incidente REALE de producție, separat de handoff (care
  se rescrie/comprimă în timp).
- Alertare Sentry pe erori: marcată explicit „de verificat" în `CLAUDE.md` — `docs/DEPLOY.md` zice ✅ configurat,
  dar fără dovadă directă din dashboard.

### fix — thumbnail lipsă în tabul „Schițe" de pe profil
- Cauză: `listAuthorSketches` (repo) nu selecta `thumbnailUrl` → nu ajungea în `profileService` → tipul
  `ProfileSketchItem` nici nu-l avea → cardul din `SketchesTab` era un `<div>` gol hardcodat. Nu regresie,
  wiring incomplet de la implementare.
- Fix pe tot lanțul: `server/repos/profileRepo.ts` → `server/services/profileService.ts` →
  `components/profile-view.tsx` (tip + `<Image>`, cu fallback pe cardul gol pt schițe istorice fără thumbnail).

---

## 2026-07-06 (seară) — Clarificare confuzie DB producție (fals-pozitiv) + hardening backup/Dependabot + tool Pan în Schiță

### notă — NU a fost incident, doar coincidență de timing + neclaritate momentană
- **Ce s-a întâmplat de fapt:** Edi a șters manual, din proprie inițiativă, conținutul lui de test
  (detalii/schițe/validări/comentarii) direct din platformă (`detalia.ro`) — acțiune normală, nu bug.
  Coincidență de timing: cu puțin înainte, un PR Dependabot (`build(deps-dev): bump the minor-and-patch
  group with 2 updates`) deschisese un Preview Deployment pe Vercel, iar integrarea Neon↔Vercel
  (auto-branching activ) clonase `production` într-un branch nou (`preview/dependabot/...`) chiar înainte
  ca Edi să șteargă. Branch-ul de preview a rămas, din întâmplare, cu poza "de dinainte" — ceea ce a părut
  inițial (greșit) că "Dependabot a mutat datele din producție". Nu a fost nicio gaură de securitate și
  niciun bug de sistem — un branch Neon e mereu doar o COPIE (copy-on-write), nu poate șterge nimic din
  `production`.
- **Ce am făcut, ca urmare a neclarității (util indiferent de cauză):** am extras datele de dinainte din
  `preview/dependabot` (`pg_dump --data-only --on-conflict-do-nothing`) și le-am reintegrat în `production`
  fără suprascriere, ca plasă de siguranță — apoi, la decizia lui Liviu, s-a făcut curățare completă a
  `production` (toate tabelele de conținut + `users`/`accounts`/`sessions`/tokens, păstrând doar
  `categories`/`roles`/`platform_settings`) — platforma repornește goală, ca la o lansare nouă.

### chore(security) — hardening după incident
- **Dependabot reconfigurat** (`.github/dependabot.yml`): `schedule.interval` de la `weekly` la `monthly` +
  `cooldown.default-days: 30` (o versiune nouă trebuie să fie "coaptă" minim 30 zile pe npm înainte să fie
  propusă). Security updates rămân imediate (nu respectă cooldown-ul). A fost oprit complet temporar în
  timpul investigației (alerte + fișier șters), apoi repornit odată clarificată cauza reală.
- **Backup automat nou** (`.github/workflows/db-backup.yml`): `pg_dump --format=custom` pe `production`, la
  fiecare oră (`cron: "0 * * * *"`, repo public → Actions gratuit), artifact păstrat 30 zile. Elimină
  dependența de noroc (o copie întâmplătoare într-un branch de preview) pentru recuperare viitoare.

### feat(sketch) — unealta Pan în editorul de Schiță colaborativă
- Cerere Edi: Pan exista doar în Planșă, lipsea din Schiță — la zoom in, nu se putea muta foaia.
- `components/sketch/sketch-canvas.tsx`: tool nou `"pan"` (icon `Hand`, primul din rail) — click + drag mută
  foaia (`pan` state, `translate()` combinat cu `scale(zoom)` pe wrapper). Reset pan odată cu reset zoom
  (click pe procent). Culorile/grosimea se estompează cât timp Pan e activ (ca la Radieră).
- `tsc --noEmit` + `eslint` + `next build` verzi.

### notă — acoperire teste E2E
- Verificat la cerere: 21 teste E2E (5 fișiere) acoperă fluxul central (public/auth, Aprob/Dezaprob, IDOR
  comentariu+schiță, publicare schiță, cascadă DB). **Neacoperite**: Planșă, categorii 3 niveluri, reply la
  comentarii, notificări, saved details, verificare rol, upload resurse, rate-limiting, tool-ul Pan nou,
  admin panel. Backlog, nu blocant azi.

---

## 2026-07-06 — fix(BUG): a doua schiță din același detaliu trimisă în aceeași planșă era ignorată silențios
- Cauză: migrația de azi (Planșă↔schițe) presupunea că vechiul PK compus se numește `canvas_items_pkey` și îl
  dropa cu `DROP CONSTRAINT IF EXISTS` — dar numele real era `canvas_items_canvas_id_detail_id_pk`, deci
  `IF EXISTS` a fost no-op și PK-ul compus `(canvas_id, detail_id)` a rămas activ. `insertItem` (`onConflictDoNothing`
  fără target) lovea acest PK vechi la a doua schiță a aceluiași detaliu → insert ignorat silențios (fără eroare
  vizibilă). Detalii diferite mergeau OK (detail_id diferit → fără conflict pe vechiul PK).
- Fix (SQL rulat manual în Neon, dev + production):
  ```sql
  ALTER TABLE canvas_items DROP CONSTRAINT canvas_items_canvas_id_detail_id_pk;
  ALTER TABLE canvas_items ADD PRIMARY KEY (id);
  ```
- Cod neschimbat — bug-ul era strict de schemă DB; indecșii parțiali din `db/schema.ts`
  (`canvas_items_detail_only_uidx` / `canvas_items_sketch_uidx`) erau deja corecți de la migrația inițială.

## 2026-07-06 (continuare) — Categorii pe 3 niveluri, reply la comentarii, Planșă↔schițe, curățenie feed/header

- **Taxonomia de categorii restructurată** (task Edi, document `lista_categorii.md`): ordinea dropdown-ului
  urmează acum EXACT ordinea din document (nu mai e alfabetică) — coloană nouă `categories.position`.
  Categorii noi pe 3 niveluri: „capitole" cu sub-categorii (Fundație→Beton/Micropiloți, Acoperiș→Șarpantă/
  Tip terasă, Instalații→Electrice/Sanitare/Termice/HVAC, Fațadă→3 tipuri) — capitolul însuși NU e bifabil,
  doar copiii lui (coloană nouă `categories.is_group`), afișat ca antet expandabil cu săgeată. Categorie nouă
  **„Scări"** adăugată sub „După zonă". Validare server: o categorie-grup nu poate fi trimisă direct ca tag
  (ocolind UI-ul). SQL rulat manual pe dev + production (coloane + re-populare din `db/seed.ts` rescris).
- **„Trimite în Planșă" funcționează acum și pe schițe** (nu doar pe detaliul-mamă): `canvas_items.sketch_id`
  opțional — un item de planșă poate fi acum „detaliu-mamă" SAU „schiță" (imaginea compusă, deja randată la
  publicare, nu se randează a doua oară). Regula de acces rămâne simetrică cu cea de la detalii: orice user
  logat, nu doar autorul (planșa e panou personal de referințe, nu legată de proprietate asupra conținutului).
  Editorul de Planșă (drag/resize/duplicare/ștergere/link „deschide") tratează corect item-urile de schiță.
- **Reply la comentarii, UN SINGUR nivel** (idee Edi: „mizăm pe dezbatere, fără reply e greu"): coloană nouă
  `comments.parent_comment_id` (self-FK, cascade). Buton „Răspunde" doar pe comentariile rădăcină (un reply nu
  poate primi la rândul lui reply); compozitor inline compact, fără @mention. Reply-urile apar indentate sub
  comentariul original.
- **Header global simplificat**: „Ciornele mele" și „Planșele mele" mutate din iconițele de header în
  dropdown-ul de user (lângă „Detalii salvate"); „Editează profil" scos din dropdown (redundant, deja
  accesibil din `/profile`). Header-ul păstrează doar Acasă + Notificări + avatar.
- **Bookmark „Salvează" direct pe cardul din feed** (colț dreapta-sus al thumbnail-ului, devine galben la
  click, optimist) — înainte exista doar în meniul kebab de pe pagina de detaliu.
- **Căutarea mutată din header în feed**, lângă titlul „Detalii în dezbatere" (nu mai e accesibilă din restul
  paginilor — decizie asumată). Toggle-ul „În dezbatere / Recente" a fost scos complet. Titlul + căutarea
  stau acum într-un card propriu (nu se mai încearcă alinierea pixel-perfect cu sidebar-ul); sidebar-ul din
  stânga și rail-ul din dreapta au primit același offset de sus, ca toate cele 3 coloane să pornească aliniat.
- **Rail-ul din feed** — containerul „Schițe noi în teanc" scos complet (derutant, fără scop clar); rămân
  „Autori activi" + „În dezbatere acum". Containerul „Validează pe rolul tău" din sidebar a fost scos (nu s-a
  decis încă înlocuitorul).
- **Butonul „Adaugă detaliu"** (FAB flotant) — ascuns DOAR pe pagina de adăugare detaliu (`/details/new`);
  rămâne vizibil peste tot altundeva.
- **Fix hover cu „țintă mobilă"**: iconițele de acțiune din feed („Schițează peste"/„Trimite în Planșă"/
  „Retrage") își expandau eticheta prin flex layout, ceea ce împingea fizic iconița următoare sub cursor în
  timpul navigării rapide → hover-ul rata ținta. Etichetele sunt acum tooltip-uri poziționate absolut (nu mai
  împing nimic din jur).
- **Zoom cu rotița mouse-ului, direct** (fără Ctrl/Cmd) — Schiță + Planșă; ambele editoare sunt full-screen,
  nu există pagină dedesubt de scrollat, deci nimic nu se pierde.
- **Pagina `/canvases`** lărgită la `--container-max` (era fixă la 860px) — consistentă cu `/sketches/drafts`.
- **Landing** — ritm de culoare pe secțiuni (alternanță bej/alb reală, nu bej-pe-bej aproape identic) + tonul
  întunecat de dinaintea footer-ului mutat din maro-negru neutru în familia teracotei (`--primary` întunecat),
  ca să se simtă aceeași identitate, nu o paletă separată.
- **Animație intro (splash) — încercată variantă nouă (SVG din `animatie_noua.html`), apoi REVERTITĂ** la
  cerere: bug de randare neexplicat (SVG-ul corect în DOM/HTML server, dar browserul afișa vizual varianta
  veche) — nerezolvat, s-a renunțat. Rămâne varianta originală (litere + triunghiuri CSS).
- **Discutat, nu implementat**: „Salvează ciornă" pe formularul de adăugare detaliu (simetric cu draft-ul de
  la Schiță) — confirmat scope-ul cu Edi, dar în așteptare clarificare (pagină comună „Ciornele mele" cu
  schițele, sau pagină separată). Emoji în comentarii — funcționează deja nativ (text UTF-8, tastatura de
  sistem); un picker în-app rămâne idee neprioritizată.
- `tsc --noEmit` + `eslint` + `next build` verzi pe tot parcursul.

**SQL rulat manual în Neon (dev + production) în această sesiune:**
```sql
-- Planșă ↔ schițe
ALTER TABLE canvas_items ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
UPDATE canvas_items SET id = gen_random_uuid() WHERE id IS NULL;
ALTER TABLE canvas_items ALTER COLUMN id SET NOT NULL;
ALTER TABLE canvas_items ADD COLUMN IF NOT EXISTS sketch_id uuid REFERENCES sketches(id) ON DELETE CASCADE;
ALTER TABLE canvas_items DROP CONSTRAINT IF EXISTS canvas_items_pkey;
ALTER TABLE canvas_items ADD PRIMARY KEY (id);
CREATE UNIQUE INDEX IF NOT EXISTS canvas_items_detail_only_uidx ON canvas_items (canvas_id, detail_id) WHERE sketch_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS canvas_items_sketch_uidx ON canvas_items (canvas_id, sketch_id) WHERE sketch_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS canvas_items_sketch_id_idx ON canvas_items (sketch_id);

-- Categorii (position + is_group + retaxonomie completă, vezi db/seed.ts)
ALTER TABLE categories ADD COLUMN IF NOT EXISTS position integer NOT NULL DEFAULT 0;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS is_group boolean NOT NULL DEFAULT false;
-- (re-populare categorii — vezi commit-ul cu db/seed.ts pentru scriptul complet folosit)

-- Reply la comentarii
ALTER TABLE comments ADD COLUMN IF NOT EXISTS parent_comment_id uuid REFERENCES comments(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS comments_parent_comment_id_idx ON comments (parent_comment_id);
```

---

## 2026-07-06 — Curățenie UX pagină detaliu + redesign validare (Aprob/Dezaprob) + fix istoric dezaprobări

- **Kebab-ul detaliului unifică toate acțiunile** (`DetailActionsMenu`): „Trimite în Planșă", copiază link,
  editează, șterge — mutate din zona împrăștiată de sub imagine/panoul din dreapta, într-un singur meniu „⋮",
  identic pe tab de bază și pe tab de schiță. Panoul separat din dreapta a fost eliminat complet; imaginea
  folosește acum toată lățimea cardului (mărită de la ~576px la ~768px). Rolul autorului schiței active
  (singura info netă din panoul scos) s-a mutat lângă nume, în strip-ul de taburi.
- **Link din kebab — DOAR public, niciodată privat** (decizie Liviu): „Copiază linkul" apare acum doar pe tab
  de schiță și copiază linkul public `/s/[id]` (fără cont) — linkul privat al paginii curente a fost scos de
  peste tot (între useri cu cont, link-ul se trimite din bara de adresă a browserului, nu are nevoie de buton
  dedicat). Pe tab de bază nu există nicio opțiune de link (nu există variantă publică pentru detaliul-mamă).
  Bonus găsit pe parcurs: URL-ul din browser nu reflecta tab-ul activ la comutare (rămânea mereu pe detaliul
  de bază) — reparat, `?sketch=id` se sincronizează acum cu tab-ul ales (shallow, fără reload).
- **Butonul „Schițează peste detaliu"** — mutat din antet (lângă titlu) suprapus peste imagine, colț
  dreapta-jos; colaps la iconiță, textul apare la HOVER (nu la click), pattern reutilizat apoi și pe restul
  butoanelor de acțiune.
- **Header-ul aplicației** (toate paginile) — trecut de pe `bg-background/85` (aceeași culoare ca pagina) pe
  `bg-secondary/90` (tokenul „surface caldă" deja din paletă) — acum se distinge vizibil de fundal.
- **Redesign validare Aprob/Dezaprob**, două iterații (feedback direct pe prima variantă):
  - **Feed** (`FeedValidationActions`): un singur buton (thumbs-up) — hover arată un mini-meniu cu
    Aprob/Dezaprob (pattern „reacții" gen LinkedIn). După poziționare, colapsează la iconița stării
    (colorată) + „Retrage" apare la hover. „Schițează peste"/„Trimite în Planșă" din card sunt acum
    icon-only, text la hover, pe același rând.
  - **Pagina de detaliu** (`ValidationPanel`, embedded): testat inițial același meniu unic ca în feed —
    respins de Liviu (un singur icon fără etichetă era confuz, arăta ca un „Ok" generic). Varianta finală:
    două butoane separate (Aprob/Dezaprob), icon-only, text la hover — același principiu ca la taburi/
    „Schițează peste detaliu", dar păstrate distincte (nu contopite într-un meniu).
- **Fix istoric dezaprobări retrase**: la retragere, comentariul-justificare rămânea în dezbatere dar pierdea
  orice etichetă (arăta ca un comentariu obișnuit, fără context că a fost cândva o poziție publică de
  dezaprobare). Coloană nouă `comments.was_disapproval` (persistă dincolo de `originValidationId → null` la
  retract) → UI arată acum „fostă dezaprobare · retrasă" (etichetă discretă gri) în loc să ascundă complet
  contextul. **SQL de rulat manual în Neon (dev întâi, apoi production):**
  ```sql
  ALTER TABLE comments ADD COLUMN IF NOT EXISTS was_disapproval boolean NOT NULL DEFAULT false;
  UPDATE comments SET was_disapproval = true WHERE origin_validation_id IS NOT NULL;
  ```
- **Discutat, PE HOLD (nu implementat):** „Trimite în Planșă" pentru schițe (nu doar detaliul-mamă) — ar
  cere `sketch_id` opțional pe `canvas_items`. De discutat cu Edi (vezi `.remember/remember.md`).
- `tsc --noEmit` + `eslint` verzi pe toate fișierele atinse.

---

## 2026-07-05/06 — Feature-uri Planșă/Schiță + dark mode încercat și scos

- **Link public schiță** (`/s/[id]`) — teaser read-only, fără cont: imagine deja compusă (detaliu-mamă +
  strokes), titlu, autor+rol, CTA „Creează cont". `getPublicSketchTeaser` filtrează strict PUBLISHED, fără
  `strokesJson` brut expus. Rută adăugată în `PUBLIC_PATHS` (`proxy.ts`). Buton „Copiază linkul" nou pe tab-ul
  unei schițe în `detail-workspace.tsx` (`CopySketchLinkButton`).
- **„Copiază linkul" (kebab detaliu) păstrează tab-ul activ** — `DetailActionsMenu` primește `activeSketchId`;
  linkul copiat include `?sketch=id` dacă ești pe tab de schiță; `detail-workspace.tsx` citește parametrul la
  mount (`useSearchParams`) și deschide direct pe tabul respectiv.
- **Duplicare planșă** (din „Planșele mele" — meniu kebab) — copiază documentul + indexul de detalii pe o
  planșă nouă („X (copie)"); thumbnail-ul NU se copiază (rămâne null, regenerat la autosave — evită ca
  ștergerea originalului să șteargă blob-ul de sub copie). `duplicateCanvas` în `plansaService.ts`.
- **Duplicare item** (din interiorul editorului Planșă, lângă „Adu în față"/„Trimite în spate") — clonează
  imaginea selectată cu offset mic, deasupra celorlalte. Fix corelat: `removeSelectedItem` nu mai șterge
  indexul `canvas_items` dacă mai rămâne un alt item (duplicat) care referă același `detailId` — altfel
  duplicatul rămas își pierdea sursa imaginii la reload.
- **Zona de lucru Planșă lărgită** — `WORKSPACE_RATIO` 16:10 → 16:9 (mai multă lățime pt aranjat detalii pe
  rând). Planșe deja salvate cu imagini pot apărea ușor distorsionate (înălțimea era „coaptă" la raportul
  vechi) — acceptabil acum, doar date de test în DB.
- **„Trimite în Planșă" ascuns pe tab de schiță** — butonul era legat mereu de `detailId` (bază), inclusiv
  când te uitai la o schiță anume → ar fi trimis silențios altceva decât ce vedeai. Modelul `canvas_items` nu
  are `sketch_id` (doar `detail_id`) — suport real pt „trimite ACEASTĂ schiță" ar cere schimbare de schemă,
  neimplementat; deocamdată butonul dispare pe tab de schiță (nu mai minte).
- **Magic link email — link de rezervă scurtat vizual** (`lib/email.ts`, login + admin): textul afișat
  devine „deschide linkul de autentificare" în loc de URL-ul complet (lung, cu token); `href` neschimbat,
  aceeași securitate.
- **Dark mode — implementat, apoi scos complet la cererea lui Liviu** (paleta „antracit cald + teracotă
  deschisă" citită ca prea generic-AI, gen Claude/Anthropic). Eliminat: `next-themes` (dezinstalat), toggle
  din `user-menu.tsx`, `ThemeProvider` din `layout.tsx`, blocul `.dark` din `globals.css`, clasele `dark:`
  adăugate în Planșă/Schiță. **Păstrat** (curățenie de cod validă indiferent de temă, zero schimbare vizuală):
  hex hardcodat → tokeni semantici (`var(--foreground)`, `bg-card`, `border-border` etc.) în landing
  (`app/page.tsx`), `onboarding-form.tsx`, `auth-shell.tsx`, `hero-preview.tsx`, `intro-splash.tsx`,
  `cookie-consent.tsx`. Bonus găsit pe parcurs: `BrandLogo` avea variantă „light" fixă (logo negru) folosită
  peste tot fără condiționare — inofensiv acum (fără dark mode), dar ar fi fost invizibil dacă temă întunecată
  s-ar fi activat vreodată fără acest fix.
- `tsc`/`eslint`/`next build`/`audit-check` verzi pe tot parcursul. Nicio schimbare de schemă DB.

---

## 2026-07-05 — Debugging sesiune completă (accent Planșă) — 7 bug-uri găsite + fixate

- **Metodă:** citire riguroasă cod (Planșă 100% linie cu linie) + fork-uri paralele pe restul platformei
  (auth/sesiuni, feed/comentarii/notificări, upload/profil/rol, schiță/validare/rate-limit) + debugging
  vizual live pe preview Vercel cu sesiune JWT seedată direct (cookie semnat cu `AUTH_SECRET`, ocolind magic
  link) + bypass Deployment Protection. Restul platformei (auth, feed, comentarii, validare, rate-limit,
  upload, ownership/IDOR) verificat riguros — **curat, zero bug-uri găsite**.
- **#1 — Resize aspect-locked nu clampa ambele dimensiuni** (`plansa-canvas.tsx`): `newW` clampat la
  `MAX_ITEM_SIZE`, dar `newH` derivat proporțional din `newW` fără propriul clamp → la imagini portrait,
  resize putea produce o înălțime peste limita din `server/domain/plansa.ts` → item invalid la salvare.
  Fix: clamp pe `scale` (nu post-hoc pe `newW`), ambele dimensiuni garantat în `[MIN_ITEM_SIZE, MAX_ITEM_SIZE]`.
- **#2 — Autosave eșuat la Planșă = tăcere completă** (`canvas-editor.tsx`): `res.error` exista dar nu era
  citit niciodată; UI rămânea blocat pe „se salvează…” la infinit, fără eroare vizibilă, pierdere de muncă
  neobservată. Combinat cu #1 → orice item invalid bloca silențios TOATE salvările viitoare ale planșei.
  Fix: `saveError` afișat în header (roșu), resetat la fiecare încercare nouă.
- **#3 — Mismatch limită domeniu vs. transport**: `MAX_STATE_BYTES` (5MB, Planșă) > `bodySizeLimit` (4mb,
  `next.config.ts`, partajat de toate server actions) → documente sub 5MB puteau eșua cu eroare de transport
  neclară. Fix: `MAX_STATE_BYTES` redus la 3MB (marjă sub limita de transport, nu s-a ridicat limita globală).
- **#4 — Schiță fără cap agregat de bytes** (doar cap pe număr de stroke-uri/puncte, teoretic sute de MB):
  adăugat `MAX_STROKES_BYTES` (3MB) în `server/domain/sketch.ts`, același raționament ca la Planșă. Test nou
  în `sketch.test.ts` (20 stroke-uri × puncte la limită individuală, dar peste plafonul agregat).
- **#5 — Ștergerea unei planșe nu funcționa deloc** (`canvases-list.tsx`): butonul de submit avea
  `onClick={() => setMenuOpen(false)}`, care demonta sincron `<form>`-ul înainte ca browser-ul să declanșeze
  submit-ul nativ — zero request POST confirmat în network. Fix: `onClick` scos; meniul dispare oricum la
  refresh după `revalidatePath`. Confirmat vizual pe preview (click real prin Playwright, 404 după ștergere).
- **Bonus găsit în același fișier:** meniul kebab din „Planșele mele” era invizibil/inclicabil — cardul avea
  `overflow-hidden` pe TOT containerul (pt colțurile rotunjite ale thumbnail-ului), care tăia din randare
  dropdown-ul ce ieșea sub cutia cardului. Fix: `overflow-hidden` mutat doar pe wrapper-ul thumbnail-ului.
- **#6 — Text fals despre notificări email** (`notification-bell.tsx`): „Primești aceleași anunțuri și pe
  email” afișat necondiționat, deși emailurile sunt oprite din 2026-07-03. Rând scos.
- **#7 — CTA greșit la căutare/filtru fără rezultate** (`feed-empty.tsx`): „Adaugă **primul** detaliu” apărea
  și când căutarea/categoria nu găsea nimic, deși platforma are deja detalii. Fix: text condiționat.
- **Verificat vizual, fără bug:** feed, pagina de detaliu, dezbatere/comentarii (istoric dezaprobări —
  comportament intenționat, documentat în cod), profil + grafic contribuții, căutare, ciorne (ștergere +
  editor desen + salvare ciornă), creare+ștergere detaliu (flux complet, inclusiv dialogul de confirmare),
  popover „Trimite în Planșă”, admin login (pagină, nu flux complet — fără credențiale).
- **Neacoperit** (necesită cont nou/date reale, nu blocante): onboarding, upload avatar/cover cu fișier
  real, admin dincolo de login, dark mode (neimplementat), verificare rol (funcție inactivă), notificări
  reale (nu empty state), pagini publice, concurență multi-tab.
- `tsc --noEmit` + `eslint` verzi pe toate fișierele atinse. **De rulat de Liviu:** `npm test` (118 teste,
  toate verzi la ultima rulare inclusiv testul nou `TOO_LARGE`).

---

## 2026-07-05 — Planșă v2: RECONSTRUITĂ de la zero cu engine PROPRIU (nu Excalidraw/tldraw)

- **De ce:** după ce Planșa a fost scoasă complet mai devreme azi (vezi intrarea de mai jos), discuție cu
  Liviu — feature-ul rămâne valoros (adună detalii + aranjează + desenează peste ansamblu), dar NU pe un
  engine generic de whiteboard. Decizie: rescriem de la zero, pe modelul Schiței (HTML5 Canvas +
  `perfect-freehand`, deja marcă proprie). Plan aprobat: `C:\dev\persist\claude\plans\te-trec-n-plan-happy-volcano.md`.
- **Scop v1 (confirmat, simplificări deliberate):** fără rotație (resize doar din colțuri, aspect blocat),
  fără multi-select (un singur item selectat/mutat), fără canvas literalmente infinit (zonă de lucru fixă
  16:10 + pan/zoom liber).
- **Model de date nou** — `CanvasDocument = { version, items: CanvasItem[], strokes: Stroke[] }`. `items`
  = imagini-detaliu poziționate (x/y/width/height normalizate 0..1, `z` explicit — nu index array).
  `strokes` = tipul EXACT din `server/domain/sketch.ts`, reutilizat 1:1 (nu duplicat).
- **Straturi noi** (pattern identic cu Schița — domain pur → repo Drizzle izolat → service cu authz):
  `server/domain/plansa.ts` (+`plansa.test.ts`), `server/repos/plansaRepo.ts`, `server/services/plansaService.ts`.
  Authz: `WHERE id=? AND owner_id=?` condiționat direct în SQL pe orice mutație (anti-TOCTOU/anti-IDOR),
  planșă nedeținută → `NOT_FOUND` uniform (niciodată `FORBIDDEN` — nu scurgem existența UUID-ului).
- **Engine nou** — `components/plansa/plansa-canvas.tsx`: selecție/hit-test pe bounding box, drag/move
  (commit la mouseup), resize din colțuri cu aspect blocat, z-order (adu în față/trimite în spate), strat
  global de desen freehand (reutilizează `renderStrokes` din `lib/sketch-render.ts` fără nicio adaptare),
  undo/redo unificat (items+strokes într-un singur snapshot, reducer identic cu cel de la Schiță), export
  thumbnail (compunere manuală pe canvas offscreen: imagini + strokes), pan/zoom pe zonă fixă.
- **DB (migrație `0016`):** re-adăugate `canvases`/`canvas_items` (schemă aproape identică cu varianta
  veche) — **de rulat manual în Neon SQL Editor** (dev, apoi production; vezi handoff pt SQL exact).
- **Storage:** `uploadCanvasThumbnail` nou în `lib/storage.ts` (`processAndUploadImage(blob, "canvases")`
  — folder SEPARAT de `sketches/`, ca să fie distinctibile la audit de blob-uri orfane).
- **UI + integrare feed:** `/canvases` (listă) + `/canvases/[id]/edit` (editor), `SendToCanvasButton`
  reintrodus în cardul de feed + pagina detaliului, link nav în header — toate recuperate ~neschimbate din
  varianta veche (doar payload-urile adaptate la noul model).
- `tsc --noEmit` + `eslint` + `next build` verzi; `scripts/audit-check.mjs` confirmă 0 vulnerabilități noi
  (fără nicio dependință externă de whiteboard — engine 100% intern). **Teste de rulat de Liviu:** `npm test`
  (unit `plansa.test.ts`, urmează convenția din `sketch.test.ts`).
- **Rămas pt sesiunea viitoare:** verificare vizuală/funcțională live (creare planșă → trimite detalii →
  aranjează/desenează → autosave/reload → export → ștergere) + eventual audit de securitate țintit
  (IDOR pe canvases/canvas_items, plafoane anti-abuz) înainte de a considera feature-ul stabil.

---

## 2026-07-05 — Planșa SCOASĂ complet din MVP (feature + engine + DB)

- **De ce:** discuție cu Liviu — Planșa (canvas privat, orice engine: tldraw sau Excalidraw) e un wrapper
  subțire peste un whiteboard generic. Risc de identitate de produs: userul întreabă „de ce nu folosesc
  direct Excalidraw/Figma?". Nu servește întrebarea pe care MVP-ul o testează (dezbaterea pe roluri). Cost
  de a construi un engine propriu diferențiat (shape-uri, selecție, transformări) e mult peste bugetul fazei
  de validare de piață. Decizie: scoatem tot acum; Edi decide separat dacă/cum se reia, cu engine propriu.
- **Ce s-a scos:** ruta `/canvases` (listă + editor), `SendToCanvasButton` (feed + pagina detaliului), link-ul
  din header, `server/domain/canvas.ts` (+test), `canvasesRepo`, `canvasService`, dependența
  `@excalidraw/excalidraw` + scripturile `predev`/`prebuild`/`postinstall` de copiere fonturi, stub-ul
  mermaid din `next.config.ts`, comentariul CSP din `lib/csp.ts`, tabelele `canvases`/`canvas_items` din
  `db/schema.ts`, allowlist-ul de audit pentru cele 3 GHSA lodash-es (`scripts/audit-check.mjs`) și secțiunea
  SEC-A6 din `docs/SECURITATE.md` (nu mai există dependința care aducea vulnerabilitatea).
- **DB (migrație `0015`):** `DROP TABLE canvas_items, canvases` — **de rulat manual în Neon SQL Editor**
  (vezi handoff).
- **Neatins:** Schița (engine separat, HTML5 Canvas + `perfect-freehand`) — nicio legătură cu Planșa.
- `tsc --noEmit` + `eslint` verzi (rulate după curățare). `npm install` a scos 214 pachete (arborele
  Excalidraw). `docs/ARHITECTURA.md` §7.7 actualizat (feature marcat scos).

---

## 2026-07-05 — migrare engine Planșă: tldraw → **Excalidraw** *(revocat, vezi intrarea de mai sus)*

- **De ce:** tldraw încarcă asset-uri (fonturi/iconițe/traduceri/watermark) de pe `cdn.tldraw.com` → cerea
  relaxare de CSP (CDN terț + watermark phone-home) și, în producție, editorul apărea rupt când fetch-ul spre
  CDN era blocat. Decizie cu Liviu: trecem la **Excalidraw** (MIT, fără watermark, fără licență comercială),
  cu **fonturi self-hostate** din același origin → zero CDN terț, zero relaxare de CSP pentru editor.
- **Ce s-a schimbat:**
  - `package.json`: scos `tldraw`, adăugat `@excalidraw/excalidraw` (^0.18.1).
  - `canvas-editor.tsx` rescris pe Excalidraw: `initialData` construit sincron din scena persistată +
    reconciliere cu items (imagini-detaliu ca `image` elements cu `customData.detailId`, `fileId` determinist,
    placeholder pt detalii dispărute), autosave debounced via `serializeAsJSON` (semnătură de scenă → ignoră
    onChange-uri de selecție/viewport), thumbnail throttled + Export PNG via `exportToBlob`, overlay selecție
    („Deschide detaliul"/„Elimină de pe planșă") prin `onChange` + `updateScene`.
  - **Fonturi self-hostate:** `scripts/copy-excalidraw-assets.mjs` copiază `dist/prod/fonts` →
    `public/excalidraw-assets/fonts` la `predev`/`prebuild`/`postinstall`; `window.EXCALIDRAW_ASSET_PATH =
    "/excalidraw-assets/"`. Folderul e **gitignored** (~14MB, regenerat la install/build).
  - `lib/csp.ts`: scos `https://cdn.tldraw.com` din `img-src`/`font-src`/`connect-src` (nu mai e necesar niciun host terț pt editor).
- **Neatins:** stratul server (`canvasService`/`canvas-actions`/`domain`/`schema`) — `state` rămâne JSON opac,
  mărginit; doar comentariile doc actualizate (tldraw→Excalidraw). Fără migrație DB.
- **Bonus (fix separat, aceeași sesiune):** popover „Trimite în Planșă" (feed) și meniul kebab (`/canvases`)
  erau clipate de `overflow-hidden` de pe card → mutat `overflow-hidden` strict pe thumbnail. Vezi
  `detail-card.tsx` / `canvases-list.tsx`.
- `tsc --noEmit` + `eslint` + `next build` verzi; verificat **live** (Excalidraw montează, RO, fără watermark;
  reconciliere detaliu→imagine, autosave în format `excalidraw`, reload, overlay selecție, „Elimină de pe planșă").
- **Securitate — mermaid blocat + CI:** Excalidraw aduce tranzitiv un HIGH fără fix upstream (`lodash-es` via
  mermaid/chevrotain — vezi SEC-A6 în `docs/SECURITATE.md`). **Blocat la 3 niveluri:** (1) dialogul mermaid nu e
  randat în UI; (2) **alias la stub** în `next.config.ts` (`stubs/mermaid-to-excalidraw.js`) → lanțul vulnerabil
  NU intră în bundle (verificat post-build: 0 chunk-uri cu cod chevrotain); (3) poarta de audit a trecut de la
  `npm audit --audit-level=high` la `scripts/audit-check.mjs` — allowlist **țintit** pe cele 3 GHSA lodash-es
  (npm audit scanează lockfile-ul), **orice alt high/critical nou tot blochează PR-ul**.

---

## 2026-07-05 — feature nou: PLANȘA (canvas privat per user)

- **Ce e:** spațiu de lucru privat, canvas infinit, în care userul **adună** detalii („Trimite în Planșă"),
  le **aranjează** liber (mută/scalează/z-order) și **schițează** peste ansamblu. STRICT privat la MVP
  (fără share/colaborare). Spec: `Detalia_Canvas.md`.
- **Engine: tldraw** (v5, watermark „Made with tldraw" gratis — acceptabil pentru MVP privat; business
  license doar dacă feature-ul validează per §9 spec). Decizie confirmată cu Liviu; DB/storage/auth mapate pe
  stack-ul nostru real (Neon+Drizzle, Auth.js, Vercel Blob), NU Supabase/RLS/tldraw-sync din spec.
- **DB (migrație `0014`):** tabele noi `canvases` (owner_id, name, `state` jsonb = snapshot tldraw,
  thumbnail_url) + `canvas_items` (PK compus canvas_id+detail_id = index relațional planșă↔detalii, ambele FK
  cascadă). **De rulat manual în Neon SQL Editor** (vezi handoff pentru SQL).
- **Straturi:** `server/domain/canvas.ts` (validări nume + cap bytes state, +test) · `canvasesRepo` ·
  `canvasService` (ownership/IDOR pe fiecare read+mutație; planșă nedeținută → NOT_FOUND, privat-by-design) ·
  server actions (`canvas-actions.ts` autosave+thumbnail, `canvas-list-actions.ts` CRUD+add). `requireActiveUserId`
  pe mutațiile care produc conținut; autosave pe `auth()` (hot-path, ca la schițe) + rate-limit.
- **UI:** editor tldraw (`/canvases/[id]/edit`, dynamic ssr:false, autosave debounced, reconciliere index↔shapes
  la load: materializează items adăugate din popover + placeholder „Detaliu indisponibil" pt detalii dispărute,
  overlay „Deschide detaliul"/„Elimină de pe planșă", Export PNG) · „Planșele mele" (`/canvases`, listă+creare+
  redenumire+ștergere) · buton „Trimite în Planșă" (popover) pe cardul de feed + pagina detaliului · link în header.
- **Decizii §6 spec:** fără dublură detaliu/planșă (6.3, unique PK) · cap 30 items/planșă (6.4) · thumbnail DA
  (6.5, via `editor.toImage` → `uploadSketchThumbnail`) · export PNG DA (6.6).
- **Env nou (opțional):** `NEXT_PUBLIC_TLDRAW_LICENSE_KEY` — gol la MVP (watermark). *(Momentan nepasat în cod;
  se poate adăuga `licenseKey` pe `<Tldraw>` când se cumpără licența.)*
- `tsc --noEmit`, `eslint`, `next build` — toate verzi. **Teste de rulat de Liviu:** `npm test` (unit `canvas.ts`).
- **4 fixuri UI după verificarea vizuală (aceeași zi):**
  1. **Editorul Planșă stătea SUB chrome-ul aplicației** (header z-50 + FAB peste canvas) — root-ul n-avea
     z-index. Fix: `z-[60] bg-background` pe containerul editorului (ca editorul de schiță).
  2. **Popover „Trimite în Planșă" se tăia la marginea de sus** (se deschidea în sus, `bottom-full`) — pe
     pagina detaliului butonul e sus. Fix: deschidere în jos, aliniat dreapta (`top-full right-0`).
  3. **Aliniere inconsistentă acțiuni în cardul de feed:** cu butoane de validare, „Trimite în Planșă" trecea
     pe rândul 2 (flex-wrap la 4 elemente). Fix: validarea pe rândul ei, „Schițează peste" + „Trimite în Planșă"
     MEREU împreună pe rândul de sub → layout identic pe toate cardurile (`detail-card.tsx`).
  4. **Card feed mai mare + thumbnail mai vizibil** (cerere Liviu): `min-h-[220px]`, thumbnail `200→260px` +
     umple toată înălțimea cardului pe desktop (scos `self-start`). Mobil rămâne aspect 4/3.
  5. **CSP bloca asset-urile tldraw** (fonturi/iconițe/traduceri/watermark de pe `cdn.tldraw.com`) → editorul
     apărea rupt. Fix: adăugat `https://cdn.tldraw.com` la `img-src`/`font-src`/`connect-src` în `lib/csp.ts`.
     **RELAXARE de audiat** (CDN terț + watermark phone-home); alternativă = self-host `@tldraw/assets` + licență.
- **Rămas pt sesiunea viitoare:** verificare riguroasă + debugging + **audit de securitate țintit** pe feature
  (inclusiv decizia CSP tldraw: self-host asset-uri vs. CDN terț).

## 2026-07-04 — audit pe SCENARII #1: Validare (metodă nouă) + 2 fixuri

- **Metodă nouă de audit, decisă cu Liviu:** audituri **pe scenarii** (matrice actor × acțiune × perturbare,
  executată prin cod), nu pe categorii-checklist — categoriile rămân doar plasă de siguranță. Inventar din cod:
  31 mutații, ~90 scenarii, ordine: Validare → Schițe → Ștergere cont → Auth → Detalii → Comentarii → restul.
  Detalii metodă în handoff (`.remember/remember.md`).
- **Auditul #1 — Validare (approve/retract/disapprove): 16 scenarii executate, 14 ✅, 2 găsiri, ambele fixate:**
  1. **Race dublu-submit pe dezaprobare → comentarii-justificare duplicate.** `disapprove` făcea
     read-then-write (`getUserPosition` → `upsertPosition` → `insertComment`) fără tranzacție (neon-http nu
     are tranzacții) — două cereri paralele vedeau ambele „nu era DISAPPROVE" și scriau 2 comentarii. Fix:
     **`upsertDisapprovalIfTransition`** în `validationsRepo` — un singur statement
     `INSERT … ON CONFLICT DO UPDATE … setWhere position <> 'DISAPPROVE' RETURNING`; rând întors = tranziție
     reală → comentariu; nimic întors = era deja DISAPPROVE → fără comentariu. Postgres serializează pe
     constrângerea unică → atomic. Aplicat și în `recordSketchDisapproval` (aceeași fereastră la dublu-publish).
     `getUserPosition` eliminat din service (rămâne în repo, neutilizat).
  2. **`retractAction` folosea `auth()` în loc de `requireActiveUserId`** — un cont suspendat cu JWT viu
     (max 7 zile) putea retrage poziții, spart invariantul SEC-04 („suspendat = zero mutații + delogare la
     prima încercare"). Fix: o linie în `validation-actions.ts`.
- **Teste actualizate** (`validationService.test.ts`): mock pe noul repo-call + 2 teste noi (tranziție null =
  cerere paralelă pierzătoare / dublu-publish → fără comentariu dublu). **De rulat de Liviu: `npm test`.**
- Notă (nu găsire): `detailId` din formData ajunge în `revalidatePath` → poate invalida cache-ul unui path
  arbitrar; efect practic ~zero (doar purge de cache, rate-limited). Lăsat așa.
- `tsc --noEmit` verde.

## 2026-07-04 — audit pe SCENARII #7 (ULTIMUL): Notificări + Blob upload + Cron — 1 găsire fixată

- **~12 scenarii executate.** Notificări: `markOneRead`/`markAllRead` scoped pe `recipientUserId` (anti-IDOR),
  acțiunile pe `auth()` = OK deliberat (marcare privată, inofensivă, ca bookmark). Cron cleanup: `timingSafeEqual`
  pe `CRON_SECRET` + fail-closed dacă lipsește env. Blob upload: sesiune + rate-limit per user + allowlist
  tip/mărime per `kind` pe server (CAD gate pe extensie fiindcă MIME-ul nu e de încredere) + `addRandomSuffix`;
  imaginile sunt oricum reprocesate (strip metadata) la persistare.
- **Găsirea — ruta de upload (`api/blob/upload`) nu re-verifica statusul contului:** „poarta" cerea doar
  sesiune (`auth()`), deci un cont SUSPENDED/DELETED cu JWT viu (≤7 zile) putea încă obține token-uri de upload
  (risipă de storage; conținutul vizibil e oricum blocat, fiindcă persistarea URL-ului trece prin acțiuni deja
  gate-uite). Fix: verificare inline a `status === ACTIVE` din DB (nu `requireActiveUserId` — acela face
  redirect, nepotrivit într-o rută JSON) → non-ACTIVE = 401.
- **Decizie DELIBERATĂ:** acțiunile de notificări rămân pe `auth()` (private, inofensive).
- `tsc --noEmit` + eslint: verzi.
- **✅ AUDIT PE SCENARII COMPLET (7/7).** Total: ~99 scenarii, **9 fixuri** (1 race atomic dezaprobare, 1 consum
  atomic token admin, 1 de-anonimizare GDPR, 5 goluri SEC-04 pe mutații/gate + upload, 1 cleanup thumbnail orfan).
  Metodă nouă (matrice actor×acțiune×perturbare) documentată în handoff.

## 2026-07-04 — audit pe SCENARII #6: Comentarii — 1 găsire fixată

- **~12 scenarii executate** (add/edit/delete). Foarte solid: add+edit deja pe `requireActiveUserId`,
  ownership atomic în repo (`updateCommentByAuthor`/`deleteFreeCommentByAuthor` = single-statement cu
  condiție pe authorId + RETURNING → fără IDOR, fără race), ștergerea RESTRICȚIONATĂ la comentarii libere
  (`originValidationId IS NULL` → justificările de dezaprobare nu pot fi șterse, altfel „dezaprobare mută"),
  body validat pe server, mențiuni @schiță sanitizate anti-IDOR la ADD **și** la EDIT, SEC-11 peste tot.
  IDOR-urile de bază erau deja acoperite cu teste în `e2e/security.spec.ts`.
- **Găsirea — `deleteCommentAction` pe `auth()` în loc de `requireActiveUserId`:** singura acțiune de
  comentariu inconsecventă (add+edit erau deja gate-uite); un cont suspendat cu JWT viu (≤7 zile) putea
  șterge conținut de dezbatere. Fix: `requireActiveUserId` + curățat importul `auth` nefolosit.
- `tsc --noEmit` + eslint: verzi. Fără teste noi.

## 2026-07-04 — audit pe SCENARII #5: Detalii — 1 găsire fixată

- **~16 scenarii executate** (create/update/delete/save). Foarte solid: create+update deja pe
  `requireActiveUserId`, ownership pe server (FORBIDDEN, nu 404-ascuns), IDOR acoperit (author/userId din
  sesiune), FK categorii validate + SEC-11, imagini reprocesate (strip metadata) + cleanup orfan pe
  editare, cascadă de ștergere atomică în repo, bookmark cu PK (userId,detailId)+onConflictDoNothing
  (dublu-click safe).
- **Găsirea — `deleteDetailAction` pe `auth()` în loc de `requireActiveUserId`:** ștergerea unui detaliu
  cascadează peste conținutul ALTORA (schițe/comentarii/validări de pe el); un cont suspendat cu JWT viu
  (≤7 zile) își putea nuci contribuțiile (evadare de moderare), inconsecvent cu create/update. Fix:
  `requireActiveUserId`.
- **Decizie DELIBERATĂ (nu găsire):** `toggleSaveDetailAction` (bookmark) rămâne pe `auth()` — privat,
  inconsecvent, nu produce conținut vizibil altora; gate-ul ar costa un SELECT degeaba (ca autosave-ul).
- `tsc --noEmit` + eslint: verzi. Fără teste noi (service-ul de detalii avea deja ownership/validări testate).

## 2026-07-04 — audit pe SCENARII #4: Auth — 1 găsire fixată

- **~14 scenarii executate** (signInWithEmail user + admin login/verify/logout + setPlatform). Solid: poarta
  publică are rate-limit dublu (email+IP) + Turnstile înainte de Resend/DB; magic link-ul de admin are pas
  anti-prefetch (consum din JS, scanerele de mail nu ard tokenul — SEC-A1); sesiune admin cookie HttpOnly+
  Secure+SameSite, re-verificată în allowlist la fiecare acces; setPlatform deny-by-default + audit; admin
  login anti-enumerare (răspuns generic).
- **Găsirea — consum ne-atomic al tokenului de magic link ADMIN** (calea cu cel mai mare privilegiu).
  `consumeAdminLoginToken` făcea SELECT-valid → DELETE separat; pe neon-http (fără tranzacții) două cereri
  paralele cu ACELAȘI token (dublu-click pe fallback noscript, retry AutoVerify) puteau citi ambele tokenul
  valid ÎNAINTE de ștergere → **două sesiuni de admin dintr-un token one-time**. Fix: `DELETE … WHERE
  token+neexpirat RETURNING email` — Postgres serializează ștergerea rândului, doar o cerere primește email-ul.
  Anti-prefetch-ul exista deja; asta închide fereastra de concurență rămasă.
- **Decizie DELIBERATĂ (nu găsire):** `signInWithEmailAction` dezvăluie existența contului (NoAccount /
  AccountExists) — enumerare de emailuri, dar e decizie de produs confirmată (Liviu 2026-07-03: login/signup
  fluxuri distincte). Admin login rămâne anti-enumerare.
- `tsc --noEmit` + eslint: verzi. Fără teste noi (repo call, greu de testat unitar fără DB).

## 2026-07-04 — audit pe SCENARII #3: Profil & Ștergere cont — 1 găsire fixată

- **18 scenarii executate** (saveAvatar/saveCover/deleteAvatar/deleteCover/coverPosition/updateDetails/
  requestVerification/deleteAccount + onboarding). Foarte solid: toate mutațiile de profil deja pe
  `requireActiveUserId` (DELETED/suspended blocat), IDOR acoperit (userId din sesiune), blob URL validat
  `isOwnBlobUrl` (anti-SSRF), imagini reprocesate (strip EXIF), cleanup orfan pe eșec parțial.
- **Găsirea — de-anonimizare GDPR prin JWT stale la onboarding:** `onboardingAction` folosea `auth()` și
  SCRIE PII (nume, headline, locație…) în rândul user ÎNAINTE de `declareRole`. Un cont DELETED (deja
  anonimizat „[cont șters]") sau SUSPENDED cu JWT încă viu (≤7 zile) putea re-POSTa formularul → PII real
  rescris peste rândul anonimizat, anulând ștergerea GDPR. (`declareRole` pica cu ALREADY_HAS_ROLE, dar
  DUPĂ ce scrierile de PII se executaseră.) Fix: `requireActiveUserId` → status proaspăt din DB, DELETED/
  SUSPENDED = signOut. Userii noi au `status` default ACTIVE → onboarding legitim neafectat.
- **Decizii DELIBERATE (nu găsiri):** `deleteAccountAction` rămâne pe `auth()` simplu — un cont SUSPENDED
  TREBUIE să-și poată șterge contul (dreptul GDPR de erasure); `requireActiveUserId` l-ar bloca greșit.
  `requestVerificationAction` e no-op (flux pe HOLD).
- **Notă (tradeoff acceptat, documentat de la SEC-04):** după ștergere, alte dispozitive cu JWT viu pot încă
  CITI pagini ≤7 zile (reads nu re-verifică status); mutațiile sunt blocate. Nemodificat.
- `tsc --noEmit` + eslint: verzi.

## 2026-07-04 — audit pe SCENARII #2: Schițe — 2 găsiri fixate

- **17 scenarii executate** (start/saveStrokes/publish/deleteSketch/deleteDraft), 14 ✅ din prima —
  solid: publish deja atomic (`publishFromDraft` cu guard pe status+autor → dublu-publish fără efecte duble),
  strokes cu limite anti-abuz + coordonate 0..1, thumbnail validat ca imagine + capat la mărime, IDOR acoperit.
- **Găsirea 1 — goluri SEC-04 pe acțiunile de schiță:** `deleteSketchAction` (cea gravă: MODERARE — un autor
  de detaliu suspendat putea șterge schițele altora până la 7 zile, cât trăiește JWT-ul), `startSketchAction`
  și `deleteDraftAction` foloseau `auth()` în loc de `requireActiveUserId`. Fixate toate trei.
  **Excepție DELIBERATĂ, documentată în cod:** `saveStrokesAction` (autosave) rămâne pe `auth()` — hot-path
  (apel la câteva secunde), ciorna e privată, singura ieșire publică (publish) e gardată.
- **Găsirea 2 — blob-uri orfane la publish eșuat:** thumbnail-ul se urcă în Blob ÎNAINTE de verificările din
  `publish` (autor/stare/strokes); la eșec rămânea orfan pentru totdeauna. Fix: `deleteBlobs([thumbnailUrl])`
  pe ramura de eșec în `sendSketchAction`. (Nu era gaură de securitate — imagine validată + rate-limit.)
- **Notă (nefixat, transparență):** autorul unui detaliu poate șterge prin `deleteSketch` și o ciornă
  nepublicată a altcuiva de pe detaliul lui, dacă i-ar ști UUID-ul — neghicibil, ciornele nu apar public;
  practic neexploatabil.
- `tsc --noEmit` + eslint pe fișierele modificate: verzi. Fără teste noi (fixurile sunt în actions, nu în
  service; service-ul de schițe avea deja guard-urile testate).

## 2026-07-04 — request-uri Liviu (pre-lansare): fix vizual, admin, audit securitate țintit

- **Fix vizual + copywriting:** pastila „Autor detaliu"/tab de schiță se tăia jos — `overflow-x-auto`
  (v5, anti-tremur) transformă rândul într-un container de scroll pe AMBELE axe (per spec CSS), iar
  rândul avea `pt-3` fără padding jos → inelul avatarului (box-shadow) și descendentele (ș/ț) se tăiau.
  Fix: `pb-1.5` pe rând (`detail-workspace.tsx`). Eticheta „Utilizator șters" → **„[cont șters]"**
  (convenție paranteze pătrate, gen GitHub/Reddit — clar placeholder, nu nume real); schimbat la sursă
  (`usersRepo.anonymizeUserRow`) — SQL de migrare pt rândurile deja anonimizate mai jos.
- **Politica de retenție (confirmată, informativ):** ștergerea de cont ANONIMIZEAZĂ (tombstone), nu
  șterge definitiv — conținutul (detalii/schițe/comentarii/validări) rămâne atribuit „[cont șters]" ca
  să nu se strice dezbaterile altora. NU exista până acum niciun cron/job de purjare automată — datele
  rămâneau pentru totdeauna. Vezi punctul de mai jos (admin) pentru purjare manuală.
- **„Copiază linkul" — investigat, nu modificat:** copiază azi doar URL-ul paginii de bază a detaliului
  (tab-ul activ e stare client, nu apare în URL) și ruta `/details/[id]` NU e publică — un vizitator
  fără cont e redirecționat direct la login. Ideea unui link public spre O schiță anume (vizibilă fără
  cont) NU există — ar fi o rută publică nouă, de proiectat separat ca decizie de produs.
- **Admin — coloană „Șters la" + purjare conturi inerte:** schema `users` primește `deletedAt` (setat
  la anonimizare); pagina admin arată data ștergerii; buton nou „Purjează conturile șterse fără conținut"
  (`purgeInertDeletedUsers`, hard delete REAL, ireversibil) — eligibil DOAR dacă userul DELETED nu a
  autorizat NIMIC (`details`/`sketches` sunt FK RESTRICT — ar eșua oricum; `comments`/`validations` sunt
  CASCADE — le-am exclus explicit ca purjarea să nu șteargă silențios conținut din dezbatere, contrazicând
  politica de mai sus). Conturile șterse CU conținut rămân definitiv (by design), acum vizibile cu dată.
- **Audit securitate țintit (Opus), cerut explicit de Liviu — rute/API neprotejate + „back button" după
  logout/ștergere cont.** Verdict: **APROBAT CU OBSERVAȚII** (0 Critical/High). Toate rutele, API-urile
  și cele 15 fișiere de server actions verificate — deny-by-default corect, IDOR acoperit sistematic
  (ownership verificat pe server peste tot), admin protejat prin sesiune reală (nu obscuritate). Găsiri
  remediate în aceeași zi:
  - **SEC-B1 (Medium):** acțiunile de profil (`profile/actions.ts` — avatar/cover/poziție cover/detalii
    text) foloseau doar `auth()`, nu `requireActiveUserId()` → un cont SUSPENDAT putea în continuare să
    editeze câmpuri PUBLICE (nume, headline, website etc.) până la expirarea JWT-ului. Aliniat la gate-ul
    „tare" folosit deja pe restul mutațiilor publice.
  - **SEC-B2 (Low):** `session.maxAge` lipsea (default Auth.js = 30 zile) → fereastră lungă în care un
    JWT cu status stale (ACTIVE la login) mai putea CITI conținut protejat după suspendare/ștergere.
    Redus la 7 zile (`lib/auth.ts`).
  - **SEC-B3 (Low):** paginile protejate nu setau `Cache-Control` → pe un calculator PARTAJAT, „Back"
    după logout putea reda conținut din bfcache-ul browserului. Adăugat `no-store, must-revalidate` pe
    ramura protejată din `proxy.ts`.
  - **SEC-B4 (Info, opțional):** `CRON_SECRET` comparat cu `!==` (risc practic neglijabil, dar rigoare
    ieftină) → `timingSafeEqual` în `api/cron/cleanup-notifications/route.ts`.
- **SQL de rulat manual în Neon** (dev întâi, apoi prod — regula DB a proiectului):
  ```sql
  ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
  UPDATE users SET name = '[cont șters]' WHERE name = 'Utilizator șters';
  ```

## 2026-07-04 — audit (code review + securitate) pe modificările zilei + remedieri

- **Audit dublu (subagenți Opus)** pe diff-ul `4ef77f8..HEAD` (fix viewport, @mențiuni, redesign validare,
  fade-in, E2E). **Securitate: APROBAT, 0 Critical/High/Medium** — lanțul @mențiuni validat anti-IDOR pe
  server (`filterSketchIdsByDetail`: apartenență detaliu + PUBLISHED), randare integral JSX (fără XSS),
  editarea re-validează sid-urile server-side, butoanele noi nu ocolesc gărzile (justificare obligatorie,
  `CANNOT_VALIDATE_OWN`, poziție unică DB). **Code review: 1 Medium + 2 Low + 2 Nit.**
- **Remedieri aplicate:**
  - **CR-002 (Low, E2E):** cursă retrage→dezaprobă în `authed.spec.ts` — acum se așteaptă round-trip-ul
    POST al retract-ului înainte de dezaprobare (butoanele reapar optimist, înaintea serverului).
  - **CR-003 (Low):** scos `crossOrigin="anonymous"` din `sketch-viewer.tsx` (citim doar naturalWidth/Height;
    dependință CORS gratuită care putea face stroke-urile să dispară silențios la schimbare de host).
  - **CR-001 (Medium):** reconstruirea corpului cu tokeni nu mai folosește `split/join` naiv —
    `replaceLabelsWithTokens` (nou în `lib/mentions.ts`) înlocuiește cu **graniță de cuvânt** („@Ana" nu
    se mai potrivește în „@Anatol" → corp corupt) + `labelsRef` se golește după trimitere reușită
    (un „@Nume" scris de mână în comentariul următor nu se mai tokeniza automat).
  - **Cunoscut #1 (editare comentariu):** formularul de editare nu mai arată tokenii bruți —
    `mentionsToDisplay` (nou) convertește corpul stocat în text lizibil (`@Nume`) + mapare etichetă→sid;
    la salvare corpul se reconstruiește cu aceiași helperi (serverul re-validează oricum). Mențiuni NOI
    din editare rămân text simplu (fără autocomplete în editare — asumat).
  - **Cunoscut #2 (Info):** avertisment lizibil în composer când corpul REAL (cu tokeni expandați)
    depășește limita de 5000, deși textul afișat e sub `maxLength` — serverul respingea corect dar sec.
- **Teste noi:** `lib/mentions.test.ts` (graniță de cuvânt, prioritate etichete lungi, idempotență pe
  tokeni formați, round-trip display↔tokeni, escape regex în etichete). Le rulează Liviu (`npm test`).
- **Nit-urile, făcute și ele:** taburile de schiță primesc ordinalul „Nume — schița N" când autorul are
  mai multe schițe (identic cu eticheta mențiunilor — corelabile); după Backspace atomic pe un token,
  dropdown-ul de mențiuni se reîmprospătează imediat (`detect()` după ștergere), nu la următoarea tastă.

## 2026-07-04 — polish: fade-in la comutarea taburilor (confirmat: v5 a rezolvat tremurul)

- Liviu confirmă: **tremurul e rezolvat** cu v5. Cerință nouă: tranziția instantă între taburi să fie
  „lină". Fix: `animate-in fade-in duration-200` (din `tw-animate-css`, deja importat) pe elementele care
  se schimbă la comutare — overlay-ul `SketchViewer`, badge-ul „schiță peste detaliu", panoul dreapta
  (autor) și zona `ValidationPanel` — fiecare cheiat pe tab ca animația să repornească. Doar opacitate,
  nicio schimbare de dimensiune/poziție → nu redeschide tremurul (v1-v5 rămân valabile).

## 2026-07-04 — fix(BUG, v5): tremurul persistă după v4 → eliminate ultimele surse de mișcare la comutare

- Liviu confirmă că tremurul persistă și după v4 (min-height blocat pe zona de validare). Analiză: singurele
  lucruri care se mai schimbă în DOM la comutare sunt (a) scrollbar-ul paginii — deja acoperit, `scrollbar-gutter:
  stable` există pe `html` din altă cauză; (b) WRAP-ul tranzitoriu al rândului de taburi când pastila activă
  se lărgește (min-h-11 limitează minimul, nu maximul); (c) `transition-all` pe pastile — animă layout
  (padding/width) cu cadre intermediare fracționare.
- Fix: rândul de taburi devine `flex-nowrap` + `overflow-x-auto` (lărgirea pastilei nu mai poate împinge
  pastilele pe rândul doi) și `transition-all` → `transition-colors` (lărgirea pastilei active e instant,
  fără animație de layout). Design-ul lărgirii rămâne.
- **Revert v4 min-height** (cerință Liviu): zona ValidationPanel înapoi la forma dinainte (fără lock
  `useLayoutEffect`) — redundant dacă (b)/(c) sunt cauza și lăsa spațiu gol.
- **Consecvență culori**: butoanele Aprob/Dezaprob din pagina de detaliu (stare neutră) preiau culorile pal
  din feed (verde `#e9f2ea`/`#2f6b3f`, roșu `destructive/10`) în loc de alb.

## 2026-07-04 — fix(BUG, v4) + redesign validare: pastilă de poziție + înălțime stabilă la comutarea taburilor

- **Redesign butoane Aprob/Dezaprob** (`validation-panel.tsx`, decizie Liviu): după alegerea unei poziții,
  cele două butoane COLAPSEAZĂ într-o singură pastilă colorată (verde „Ai aprobat…" / roșu „Ai dezaprobat…")
  cu butonul „× retrage" integrat. Bannerul separat „Ai aprobat acest detaliu · retrage poziția" a fost
  eliminat (redundant + adăuga un rând de înălțime). Formularele de dezaprobare (alegere/justificare) se
  randează doar fără poziție activă; `onRetract` resetează și `mode`.
- **Fix v4 tremur** (`detail-workspace.tsx`, soluția lui Liviu — „mărește containerul"): zona ValidationPanel
  are conținut diferit per tab (lista de poziții, pastila proprie) → își schimba înălțimea și împingea
  Dezbaterea la fiecare comutare. Acum `min-height` pe zonă e BLOCAT la maximul măsurat între taburi
  (ref + `useLayoutEffect` pe schimbarea tabului; măsurarea se face după remount-ul panoului, deci
  formularele deschise nu umflă valoarea). Zona doar crește o dată la primul tab mai înalt, apoi e stabilă.
- E2E actualizat (`e2e/authed.spec.ts`): asertările pe `aria-pressed` înlocuite cu vizibilitatea pastilei
  („Ai aprobat/dezaprobat acest detaliu" + buton „retrage"); testul de dezaprobare retrage întâi poziția
  APPROVE rămasă din testul anterior (serial).
- **Feed aliniat** (`feed-validation-actions.tsx`, follow-up în aceeași zi): același model de colaps —
  cu poziție activă rămâne o singură pastilă compactă („✓ Ai aprobat" / „✕ Ai dezaprobat") cu „× retrage"
  integrat; linkul separat „retrage poziția" eliminat. Culorile neutre din feed (verde/roșu pal) păstrate.

## 2026-07-04 — fix(BUG, v3): tremur la comutare — cauza reală găsită prin analiza video cadru cu cadru

- Reproducere: clip de la Liviu (bug.mp4), extras cadre la 30fps + măsurat numeric bbox-ul logo-ului
  din imagine per cadru. Rezultat: imaginea NU se mișcă între taburi (fixurile v1/v2 țin), dar chiar
  la comutare TOT conținutul de sub rândul de taburi sare **1px în sus și revine** (y 167→166→167),
  în ambele direcții.
- Cauză: pastila de tab activă (avatar+nume, py-1) are altă înălțime decât cea inactivă (doar avatar,
  p-0.5); în timpul animației `transition-all` înălțimea rândului de taburi fluctuează cu ~1px →
  viewport + validare + dezbatere „tremură" la fiecare click.
- Fix: `min-h-11` (44px, peste înălțimea maximă a pastilei) pe rândul de taburi → înălțimea rândului
  e constantă indiferent de starea/animația pastilelor. Lărgirea pastilei active (apare numele) rămâne
  — confirmat de Liviu că e design, nu bug.

## 2026-07-04 — fix(BUG, v2): tremur la comutarea Detaliu ↔ Schiță — imaginea-mamă montată permanent

- Fixul v1 (cutie 4/3 comună) nu era suficient: `SketchViewer` remontat la fiecare comutare reîncărca
  imaginea async → o clipă cutia era goală, apoi imaginea „pocnea" înăuntru (perceput ca tremur).
- Acum `<Image>` mamă rămâne montată PERMANENT în cutia 4/3 pe ambele taburi; `SketchViewer` a devenit
  overlay doar cu stroke-uri (`absolute inset-0`, canvas poziționat pe dreptunghiul „contain" al
  imaginii, `pointer-events-none`). La comutare doar stroke-urile apar/dispar — imaginea nu se mai
  atinge deloc.
- Sursă secundară de mișcare, NEatinsă (decizie de design): pastila de tab activă se lărgește
  (avatar → avatar+nume), mutând rândul de avatare la fiecare comutare.

## 2026-07-04 — fix(BUG): @mențiuni — tokenul brut `@[Nume](sid:uuid)` nu mai apare în textarea

- Raport: la compunere, selectarea unei mențiuni insera tokenul tehnic (~50 caractere) direct în
  câmp — urât și derutant. Acum textarea afișează doar eticheta lizibilă („@Nume" sau
  „@Nume — schița 2" la autori cu mai multe schițe); maparea etichetă→sketchId se ține în memorie,
  iar corpul cu tokeni se reconstruiește nevăzut într-un `<input hidden name="body">` la fiecare
  modificare → serverul primește exact același format ca înainte (validare sid-uri neschimbată).
- Backspace după o mențiune șterge toată eticheta dintr-o apăsare (o etichetă ruptă pe la mijloc
  n-ar mai fi recunoscută la reconstruire — degradează la text simplu, fără link).
- Separatorul ordinalului a devenit „—" (em dash) în loc de paranteze — `buildMentionToken` curăța
  parantezele din etichetă, deci afișat ≠ salvat.
- Limitare cunoscută: formularul de EDITARE a unui comentariu existent încă arată tokenii bruți
  (follow-up separat).

## 2026-07-04 — fix(BUG): imaginea „tremura" la comutarea Detaliu ↔ Schiță în teanc

- Cauză: cele două taburi randau imaginea cu geometrii diferite — tabul Detaliu în cutie fixă
  `aspect-[4/3]` cu `object-contain` (+ fundal grilă), tabul Schiță cu un canvas la raportul natural
  al imaginii, pe toată lățimea, cu înălțime 0 până la încărcare → containerul își schimba înălțimea
  și imaginea se redimensiona/deplasa la fiecare comutare.
- Fix: `detail-workspace.tsx` — grila de fundal + cutia `aspect-[4/3] max-w-xl` sunt acum comune
  ambelor taburi; doar conținutul din interior se schimbă (Image / SketchViewer).
  `sketch-viewer.tsx` — canvas-ul se încadrează „contain" în cutia părinte (centrat, la raportul
  imaginii), identic cu `object-contain` de pe tabul Detaliu; scos ring-ul propriu (diferență vizuală).

## 2026-07-04 — security: audit sesiune (upload PDF/CAD, date live din DB, onboarding) + fix blob orfan

- **Audit dedicat** (subagent security-engineer) pe toate modificările din sesiunea 2026-07-04 (upload
  PDF/CAD, `getUserMedia` extins cu name/location, paralelizare reprocesare imagini onboarding,
  autocomplete localitate, ordinal @mențiuni). **Verdict: APROBAT** — 0 Critical/High, 2 Low + 1 Info.
- **[Info] Fix:** la onboarding, dacă avatarul și cover-ul se reprocesau în paralel și unul eșua în
  timp ce celălalt reușise deja, blob-ul reprocesat cu succes rămânea orfan în storage (urcat, dar
  niciodată referit în DB). `app/onboarding/actions.ts`: pe eșec parțial, blob-ul reușit se șterge
  (`deleteBlobs`, best-effort) înainte de a respinge.
- Restul găsirilor (rel="noopener noreferrer" pe linkurile de resurse, extensia CAD validată doar
  cosmetic din pathname) erau deja acoperite / acceptate ca risc — fără schimbare de cod necesară.

## 2026-07-04 — fix(ui): jump de imagine la comutarea tab bază↔schiță în workspace

- **Bug (raportat vizual, Edi):** la trecerea între tab-ul „detaliu de bază" și un tab de schiță,
  imaginea se redimensiona/repoziționa vizibil — cauza: cutiile aveau lățimi diferite (`max-w-xl` la
  bază vs `max-w-md` la schiță). Aliniat la aceeași lățime în `detail-workspace.tsx`.

## 2026-07-04 — fix(ui): @mențiuni în comentarii — schițe multiple ale aceluiași autor + backspace pe token

- **Ambiguitate:** dacă un autor avea mai multe schițe, apărea identic de mai multe ori în dropdown-ul
  de `@mențiuni` (nume+avatar), imposibil de deosebit care schiță se menționează. Numerotare „schița N"
  per autor în dropdown, propagată și în eticheta salvată în comentariu (`Nume (schița 2)`).
- **Bug:** tokenul brut `@[Nume](sid:uuid)` (~50 caractere) trebuia șters caracter cu caracter din
  textarea. Backspace imediat după un token de mențiune îl șterge acum dintr-o singură apăsare.
  Helper nou `mentionTokenEndingAt()` în `lib/mentions.ts`.

## 2026-07-04 — feat(ui): buton „Acasă" în header

- Header-ul avea o singură cale spre feed (click pe logo, nedescoperibil). Buton nou (icon `House`),
  înainte de „Ciornele mele", link direct spre `/feed`.

## 2026-07-04 — fix(ui): nume/locație stale în sidebar-ul feed-ului (aceeași cauză ca bug-ul pozei)

- `session.user.name` vine din JWT, cache-uit doar la login → userii care completau numele abia la
  onboarding vedeau fallback-ul generic „Profilul tău" până la re-login. `getUserMedia` (repo) extins
  cu `name`+`location` citite live din DB; `feed/page.tsx` + `feed-sidebar.tsx` actualizate să le
  folosească (cu fallback pe sesiune doar dacă DB n-are nimic). Locația apare acum sub rol, în sidebar.

## 2026-07-04 — perf(onboarding): procesare avatar+cover în paralel (lag la submit final)

- **Bug raportat:** butonul final de onboarding părea „blocat" câteva secunde. Cauză: avatarul și
  cover-ul se re-procesau (fetch blob → sharp resize/re-encode → re-upload → ștergere original)
  **secvențial**, 6 round-trip-uri de rețea una după alta. Rulate acum în paralel (`Promise.all`) în
  `app/onboarding/actions.ts` — ~jumătate din timp când ambele imagini sunt setate.

## 2026-07-04 — fix+feat(onboarding): etichete Domeniu/Rolul tău + autocomplete localitate

- **Etichete onboarding:** „Rol principal" → „Domeniu", „Subrol" → „Rolul tău" (+ placeholder-ele
  corelate) — clarifică relația dintre cele două câmpuri.
- **Bug „Locație":** `<input list>` + `<datalist>` nativ arăta toată lista (~200 orașe) pe click,
  cât tot ecranul, înainte să scrii ceva. Componentă nouă `components/city-autocomplete.tsx` —
  nimic nu apare până nu tastezi, apoi listă scurtă filtrată (max 8) sub câmp. Înlocuit în onboarding
  (`onboarding-form.tsx`) și editare profil (`profile-forms.tsx`); câmpul rămâne text liber.

## 2026-07-04 — feat(ui): buton „Adaugă detaliu" mutat din sidebar în buton fix global (FAB)

- **Bug raportat:** poziția butonului din sidebar depindea de layout (se muta când se expandau
  categoriile), obligând la scroll ca să fie găsit — pentru CTA-ul principal al platformei, inacceptabil.
- Component nou `components/add-detail-fab.tsx`, montat în `app/(app)/layout.tsx` — fix pe ecran
  (dreapta-jos), vizibil pe toate paginile din zona autentificată indiferent de scroll. Scos din
  `feed-sidebar.tsx` (`addHref` prop eliminat, era neutilizat).

## 2026-07-04 — feat(ui): card „Validează pe rolul tău" mutat din rail-ul din dreapta în sidebar-ul din stânga

- Mutat între cardul „Profilul tău" și „Categorii" (`feed-sidebar.tsx`) — scos din `feed-rail.tsx`.
  Fiecare card își păstrează un singur scop (identitate vs. nudge educativ).

## 2026-07-04 — feat(resurse): upload de fișier pentru PDF + tip nou de resursă CAD (DWG/DXF)

- Resursele PDF/CAD ale unui detaliu pot fi acum urcate direct (nu doar link extern), prin Blob.
- `lib/upload-limits.ts`: allowlist-uri + limite noi (PDF max 25MB; CAD max 50MB — MIME nesigur pt.
  DWG/DXF în browsere → gate real pe extensia din pathname, server-side).
- `app/api/blob/upload/route.ts`: tokenul acceptă acum un `kind` (`image`/`pdf`/`cad`) trimis din
  client (`clientPayload`), alege allowlist-ul + mărimea corespunzătoare.
- `lib/blob-upload.ts`: helper nou `uploadDocToBlob()`. `server/domain/detail.ts`: `RESOURCE_TYPES`
  + `"CAD"`. `db/schema.ts` + migrație `0013_uneven_red_skull.sql` (`ALTER TYPE ... ADD VALUE 'CAD'`,
  rulată manual în Neon dev+prod). Formular nou/editare detaliu + pagina de detaliu actualizate
  (selector, buton de upload cu stare „se încarcă"/eroare per rând, iconiță `Compass` pt. chip CAD).

## 2026-07-04 — fix(ui): CTA „Schițează peste detaliu" mutat ca overlay peste imagine + text tab schiță

- **Bug raportat:** butonul „Schițează peste detaliu" era în banda de taburi, nu suficient de vizibil;
  poziția lui era condiționată de UI-ul din jur. Mutat ca overlay fix în colțul dreapta-sus **al
  ferestrei cu imaginea** (`detail-workspace.tsx`), vizibil automat indiferent de tab, mai proeminent
  (fără `size="sm"`, cu umbră).
- Tab-ul „detaliu de bază" arăta text generic „Detaliul de bază"; acum arată avatar + numele
  autorului + eticheta „Autor detaliu" (activ), la fel ca tab-urile de schiță.
- Text „schiță peste detaliul-mamă" → „schiță peste detaliu" (etichetă pe viewport-ul unei schițe).

## 2026-07-04 — fix(ui): poza de profil din header rămânea stale până la re-login

- **Bug raportat:** poza de profil nu apărea în header după onboarding, doar după logout/login.
  Cauză: header-ul (`app-header.tsx`) folosea `session.user.image` (JWT, cache-uit doar la login).
  Aliniat cu sidebar-ul feed-ului, care deja citea imaginea live din DB via `getUserMedia`.

## 2026-07-03 — chore(notificări): emailurile de notificare OPRITE (rămân doar in-app)

- **Decizie Liviu:** notificările `SKETCH_PROPOSED`/`SKETCH_DELETED` nu mai trimit email — in-app ajunge,
  iar cota Resend free (100/zi) rămâne pentru magic link-uri (login/signup + admin), unde emailul e
  singura cale de acces. **Reversibil fără cod:** `NOTIFICATION_EMAILS_ENABLED=true` în env le repornește.
- `server/services/notificationService.ts` (gate în `notify()`), CLAUDE.md actualizat (2 locuri).

## 2026-07-03 — security: re-audit complet (13 categorii) + remedieri SEC-A1…A5

- **Re-audit static complet** (skill `security-audit`) pe toată suprafața: auth, authz (IDOR pe toate
  mutațiile), API, business logic (validări/schițe/notificări), rate-limit, Turnstile, PII, Blob, cron,
  CSP/headers, dependențe. Verdict: **APROBAT** — 0 Critical/High; 1 Medium + 3 Low + 1 Info, toate
  remediate în aceeași zi. Detalii + raționament: `docs/SECURITATE.md` §„Re-audit 2026-07-03".
- **[SEC-A1][MEDIUM] Anti-prefetch pe magic link-ul de ADMIN:** consumul tokenului mutat de pe
  `/admin-page/verify` (acum pagină click-through inofensivă la GET, cu `AutoVerify` refolosit) pe
  `/admin-page/verify/confirm` (route handler). Scanerele de mail nu mai pot arde tokenul one-time /
  provoca emiterea unei sesiuni. `proxy.ts`: poarta admin-public extinsă la `/verify/confirm`.
- **[SEC-A2][LOW] Pin pe store-ul Blob propriu:** nou `lib/blob-url.ts` (server-only) — `isOwnBlobUrl()`
  cere hostname-ul exact al store-ului nostru (store ID extras din `BLOB_READ_WRITE_TOKEN`), nu orice
  `*.public.blob.vercel-storage.com`. Înlocuit `BLOB_URL_RE.test()` în cele 5 puncte server.
- **[SEC-A4][LOW] `.github/dependabot.yml`:** security updates imediate + version updates săptămânale
  (npm + github-actions, grupate minor/patch, target `dev`). `npm audit` prod: 0 vulnerabilități.
- **[SEC-A5][INFO] Rate-limit pe `deleteDetailAction` + `deleteDraftAction`** (`limiters.mutation`) —
  uniformizare cu restul mutațiilor.
- **[SEC-A3][LOW] Enumerare email la login/signup = risk-acceptance** (consecință a fluxurilor separate
  de mai jos) — documentat în SECURITATE.md, fără schimbare de cod.

## 2026-07-03 — fix(auth): Turnstile la navigare SPA + fluxuri login/signup separate după existența contului

- **Turnstile nu se randa la navigare client-side** (signup→login etc.): scriptul Cloudflare, injectat o
  singură dată de `next/script`, nu re-scanează DOM-ul la a doua montare → widget lipsă → orice submit
  pica cu `CaptchaFailed` până la refresh. **Fix:** randare explicită (`components/auth-form.tsx` —
  `TurnstileWidget` cu `turnstile.render()` în `useEffect` + `?render=explicit` pe script).
- **Login ≠ signup (decizie produs):** `/login` cu email fără cont → „Nu există niciun cont cu acest
  email" (`NoAccount`); `/signup` cu email existent → „Există deja un cont cu acest email"
  (`AccountExists`). Nu se mai trimite magic link „orb" în ambele cazuri. Verificarea (nou
  `userExistsByEmail` în `usersRepo`) rulează DUPĂ rate-limit + Turnstile. Trade-off enumerare asumat
  (vezi SEC-A3 mai sus).

## 2026-07-03 — feat(ui): cookie notice pe landing + email admin vizual distinct + fix XSS în emailuri

- **`components/cookie-consent.tsx`** (nou): notă informativă despre cookie-uri (NU consent cu opțiuni —
  DETALIA folosește doar cookie-ul de sesiune Auth.js, strict necesar, deci sub GDPR/ePrivacy nu cere
  opt-in). Apare o singură dată, la 10s după intrarea pe landing, jos-stânga (nu în footer); alegerea
  persistă în `localStorage`. Montat în `app/page.tsx`.
- **`lib/email.ts`:** `emailLayout()` acceptă acum `{ accent, badge }` opțional. Nou `adminLoginEmailHtml`/
  `Text` — email de acces admin vizual distinct de login-ul normal (badge „PANOU ADMIN" + accent
  albastru-ardezie `#33465e` în loc de teracota de brand, ca admin să recunoască instant emailul + semnal
  anti-phishing). `app/admin-page/login/actions.ts` folosește noul template.
- **Fix XSS (găsit de review automat, MEDIUM):** link-ul fallback din `magicLinkEmailHtml` și
  `adminLoginEmailHtml` nu era escapat (`${url}` brut în `href`+text) — reparat cu `esc()`, consistent cu
  `emailButton`. `magicLinkEmailHtml` dedus să refolosească `emailButton` în loc să dubleze markup-ul.
- `tsc --noEmit` verde.

---

## 2026-07-03 — fix(review): code review pe modificările zilei (cron, atomicitate, IDOR) — 7 găsiri reparate

- **De ce:** code review riguros (8 unghiuri paralele) pe tot ce s-a schimbat azi (cron retenție, atomicitate
  `createDetail`, teste IDOR/integrare, `auth.setup.ts` JWT). Verificat direct în sursă (`neon-http/session.js`)
  că `db.batch` chiar rulează o tranzacție Postgres reală (`client.transaction(...)`) — fix-ul de atomicitate
  de mai devreme e solid, nu doar aparent.
- **`app/api/cron/cleanup-notifications/route.ts`:** fail-closed explicit dacă `CRON_SECRET` lipsește din env
  (înainte, comparația cădea pe literalul `"Bearer undefined"` — bypass posibil). Mutată logica din route direct
  în `server/services/notificationService.ts` (`cleanupOldNotifications`) — ruta nu mai atinge repo-ul direct
  (regulă CLAUDE.md: mutațiile trec prin services).
- **`server/repos/detailsRepo.ts`:** `insertDetailWithRelations` simplificat de la 4 ramuri manuale
  (`if`/`else if` pe combinația categorii/resurse) la un singur `db.batch` + `filter(Boolean)` — tipul real al
  `db.batch` cere doar array nevid, nu tuplu de lungime fixă. Adăugat `.returning()` + verificare explicită că
  insert-ul a produs un rând (arunca eroare altfel, în loc să întoarcă tăcut un `detailId` fantomă).
  Reconfirmat printr-un pic mai atent: **atomicitatea e reală** (nu doar „o rundă HTTP", ci o tranzacție Postgres).
- **`proxy.ts`:** `/api/cron` era prefix larg în `PUBLIC_PATHS` (orice rută viitoare sub el ar fi devenit public/
  scutită de lockdown implicit) — înlocuit cu `CRON_PATHS` (listă exactă) + `isCronPath()` folosit consecvent
  în ambele gate-uri (public + lockdown).
- **`e2e/seed.ts`** (nou): `getSeed()` centralizat, elimină duplicarea byte-cu-byte din `security.spec.ts` +
  `integration.spec.ts`.
- **DB:** rândurile vechi din `sessions` (moștenite din strategia `database`, nemaifolosite din migrarea la
  JWT) curățate manual (`TRUNCATE TABLE sessions`) pe preview/dev și producție.
- **22/22 teste E2E verzi** (rerulate după fiecare fix), `tsc --noEmit` verde.

---

## 2026-07-03 — feat(ops+test): retenție notificări (cron) + teste de integrare (atomicitate/cascadă/polimorfism)

- **De ce:** ultimele 2 goluri fezabile din `evaluare-mvp.md`. (1) tabelul `notifications` creștea nemărginit
  — nicio politică de retenție. (2) „teste de integrare handler→service→repo" lipseau — doar unit (mock) + E2E
  UI existau, nimic nu verifica direct atomicitatea/cascada/polimorfismul la nivel de service+DB real.
- **`app/api/cron/cleanup-notifications/route.ts`** (nou): șterge notificările **citite** mai vechi de
  **15 zile** (decizie Liviu 2026-07-03) — cele necitite rămân (userul trebuie să le vadă măcar o dată).
  Autorizat prin header `Authorization: Bearer $CRON_SECRET` (convenția Vercel Cron). **`vercel.json`** (nou):
  programează cron-ul zilnic (`0 3 * * *`). `proxy.ts`: `/api/cron` adăugat ca prefix public (autorizarea
  reală e în handler, nu în proxy) + exclus din rewrite-ul de lockdown (altfel cron-ul n-ar rula în mentenanță).
  **De configurat în Vercel (Liviu):** env `CRON_SECRET` (Production) — orice string random lung.
- **`server/repos/notificationsRepo.ts`:** `deleteReadNotificationsOlderThan(days)` (nou).
- **`e2e/integration.spec.ts`** (nou, proiect `security`): 2 teste — `createDetail` inserează detaliu +
  categorii + resurse atomic (`insertDetailWithRelations`, verificat pe DB real); `deleteDetail` cascadează
  corect peste o schiță CU validare+comentariu polimorfice pe ea (targetType SKETCH), toate dispar.
  `e2e/auth.setup.ts` extins cu `categoryId` în `seed.json`.
- **22/22 teste E2E verzi.** `tsc --noEmit` verde.

---

## 2026-07-03 — feat(perf+test): atomicitate creare detaliu + E2E IDOR (comentariu/schiță)

- **De ce:** două goluri rămase din `evaluare-mvp.md`. (1) `createDetail` insera detaliu→categorii→resurse
  secvențial (Neon HTTP n-are tranzacții interactive) — o eroare la mijloc putea lăsa detaliul fără categorii.
  (2) IDOR-ul (C.2 comentariu, C.1/C.3 schiță) fusese verificat doar manual cu `curl` în audit, fără regresie
  automată.
- **`server/repos/detailsRepo.ts`:** `insertDetailWithRelations` (nou) — id generat client-side
  (`crypto.randomUUID()`) + `db.batch` cu toate insert-urile (detaliu + categorii + resurse) într-o singură
  rundă atomică. Înlocuiește `insertDetail`/`insertDetailCategories`/`insertDetailResources` (șterse).
- **`server/services/detailService.ts`:** `createDetail` folosește noul `insertDetailWithRelations`.
- **`e2e/security.spec.ts`** (nou, proiect `security` în `playwright.config.ts`): 3 teste IDOR — apel direct
  pe service+DB real (fără browser), reproduc automat scenariile din audit: attacker nu poate edita/șterge
  comentariul victimei (`NOT_FOUND`), nu poate șterge o schiță a altcuiva (`FORBIDDEN`); victima supraviețuiește
  în toate cazurile. `e2e/auth.setup.ts` extins să scrie `testerUserId`/`authorUserId` în `seed.json`.
- **20/20 teste E2E verzi** (`npm run e2e`, pe preview/dev). `tsc --noEmit` verde.

---

## 2026-07-03 — fix(security): rate-limit pe saveStrokesAction + override postcss (curățare recomandări audit)

- **`app/(app)/sketches/[id]/edit/sketch-actions.ts`:** `saveStrokesAction` (salvare ciornă schiță) primea
  scrieri DB fără limită per user — singura mutație de schiță fără `checkLimit`. Adăugat `limiters.mutation`,
  la fel ca `publish`/`deleteSketch`.
- **`package.json`:** `overrides.postcss: "^8.5.10"` — curăță advisory-ul moderat tranzitiv (bundle-uit în
  `next`, XSS la stringify CSS ne-de-încredere, nu-l foloseam expus). `npm audit`: 6 → 4 moderate rămase
  (esbuild via `drizzle-kit`, neexploatabil — dev-server only).
- Deciziile din `docs/SECURITATE.md` §Recomandări actualizate (JWT `maxAge` scurt = respins, restul = făcut).

---

## 2026-07-03 — test(e2e): suită schiță (publish/delete) + fix sesiune setup + fix robustețe canvas

- **De ce:** ultimul punct rămas din audit — E2E pe fluxul de schiță. La scriere, `e2e/auth.setup.ts` seeda
  încă o sesiune stil `database` (rând în `sessions` + token hex random în cookie) — stale de la migrarea
  sesiunii pe JWT (2026-07-02). Cu strategia `jwt`, Auth.js nu mai validează DB, ci decriptează cookie-ul →
  toate testele authed (nu doar cele noi) picau cu redirect la `/login`.
- **`e2e/auth.setup.ts`:** nu mai scrie în `sessions`; emite cookie JWT valid cu `encode()` din
  `@auth/core/jwt` (`salt` = numele cookie-ului, payload `{ sub, id, status, name, email }` — exact ce pune
  callback-ul `jwt()` din `lib/auth.ts` la login real). Necesită `AUTH_SECRET` (Preview) în `.env.e2e`.
- **`components/sketch/sketch-canvas.tsx`:** bug real găsit în timpul testării, NU doar de test — dacă
  imaginea-mamă eșuează la încărcare (blob șters, CORS, outage rețea), `dims` rămânea `0x0` PERMANENT
  (canvas invizibil, editor inutilizabil). Adăugat `img.onerror` → degradează la foaie goală (`aspectRatio`),
  la fel ca fluxul fără imagine.
- **`e2e/sketch.spec.ts`** (nou): pornește schiță → desen real (drag pe canvas, tool `pen` implicit) →
  Publică → verifică tab nou în teanc + badge „în teanc · publicată" → șterge (autor) → verifică dispariția.
- **`playwright.config.ts`:** `sketch.spec.ts` adăugat la `testMatch` al proiectului `authed`.
- **17/17 teste E2E verzi** (`npm run e2e`, pe preview/dev). `docs/DEPLOY.md` §2b: cheatsheet curățare DB
  producție (total + selectiv pe user/tabel) + Sentry Alerts configurate (`rate_limited`,
  `rate_limit_unavailable`, `access_denied_suspended`, `admin_login_failed` → notify Liviu).

---

## 2026-07-02 — fix(email): template-uri brand pentru notificările de schiță + curățare docs (voce impersonală, `EMAILURI.md`)

- **De ce:** `notifySketchProposed`/`notifySketchDeleted` trimiteau HTML brut (`<p>...`), fără brand-ul DETALIA
  — inconsistent cu magic link-ul (care folosește `emailLayout()`). Sesizat la revizuirea documentației.
- **`lib/email.ts`:** adăugate `sketchProposedEmailHtml/Text`, `sketchDeletedEmailHtml/Text` (folosesc
  `emailLayout()` + un buton CTA comun, escaping intern). Mutat `esc`/`plain` (→ `plainSubject`) din
  `notificationService.ts` aici — un singur loc pentru templating email.
- **`server/services/notificationService.ts`:** folosește noile template-uri în loc de HTML inline;
  `sendEmail` primește acum și `text` (fallback plain-text, lipsea înainte).
- **`docs/EMAILURI.md`:** rescris complet — descria fluxul vechi de accept/respins pe schiță (eliminat
  2026-06-30) cu 2 tipuri de notificare care nu mai există în cod. Acum documentează exact cele 2 email-uri
  reale + magic link, sincron cu `lib/email.ts`.
- **Curățare voce impersonală** în documentele „sursă de adevăr" (`docs/SECURITATE.md`, `docs/EVALUARE-MVP.md`,
  `docs/DEPLOY.md`): scoase referințe directe („decizie Liviu" → „decizie de produs", „îți dă"/„ai date reale"
  → formulări generice). `docs/CHANGELOG.md` (jurnal) și `.remember/remember.md` (handoff) rămân neatinse
  intenționat — sunt scrise ca notă către o persoană, prin design.
- `tsc --noEmit` + `eslint` verzi.

## 2026-07-02 — docs: consolidare `SECURITATE.md` + curățare staleness în `docs/`

- **De ce:** `docs/SECURITATE.md` era din 24 iunie, se declara „sursa unică de adevăr" cu verdict **BLOCAT**
  și categorii ⚠️/❌ deja rezolvate de săptămâni (rate-limit, headers, upload, SEC-04) — contrazicea realitatea
  (app live din 2026-06-29). Exista și un `securitate.md` la root (auditul de azi, verdict APROBAT).
- **Consolidat:** conținutul auditului de azi (13 categorii, poarta §11, JWT+SEC-04, decizia de a nu mai rula
  distructiv C.1/C.3/E/F/I/J) a înlocuit complet vechiul `docs/SECURITATE.md`. `securitate.md` de la root **șters**
  (conținut mutat). `docs/SECURITATE.md` rămâne singura sursă de adevăr pentru securitate.
- **`docs/DEPLOY.md`:** era runbook-ul de setup inițial („blocaj curent: login nu merge până la domeniu"),
  complet depășit — app live de o săptămână. Actualizat stările (Resend/Google/Cloudflare = ✅), scos
  `INVITATION_TTL_HOURS` (env inexistent, eliminat 2026-06-28), marcat §3-7 ca istoric/referință, bifat
  checklist-ul final.
- **`docs/ADR.md`:** ADR-002 avea o linie stale („se mulează natural pe invite-only") care contrazicea
  ADR-008 din același document (acces public, invitații eliminate). Corectată.
- **`docs/EVALUARE-MVP.md`:** secțiunea Securitate actualizată cu rezultatul auditului + poarta §11 (nu mai
  „rămas de rulat", ci făcut). Secțiunea Performanță actualizată cu migrarea JWT.

## 2026-07-02 — perf(auth): sesiune `database` → `jwt` + blocare tare suspendare pe mutații (SEC-04)

- **De ce:** cu `strategy:"database"`, fiecare `auth()` (fiecare render + fiecare acțiune) făcea un query
  în Neon pe driver HTTP → pârghia #1 de performanță („aplicația trebuie să fie instant"). Decizie Liviu.
- **`lib/auth.ts`:** `session.strategy` → `"jwt"`. Adăugat callback `jwt` (pune `id` + `status` în token la
  sign-in, o singură dată) + `session` citește din `token` (NU mai lovește DB). Adapterul Drizzle rămâne
  pentru creare useri + verification tokens (magic link **neatins**). Tabelul `sessions` nu se mai scrie.
- **`types/next-auth.d.ts`:** augmentat `next-auth/jwt` JWT cu `id` + `status`.
- **`lib/require-active-user.ts`** (NOU): `requireActiveUserId()` — re-check `status` PROASPĂT din DB (un
  singur SELECT) pe mutațiile care produc/modifică conținut public. Tradeoff JWT (SEC-04): `status` din token
  e stale → gating-ul din `proxy.ts` rămâne SOFT; blocarea TARE a unui cont suspendat se mută pe mutații.
  La status non-ACTIVE face **`signOut()` real** (nu doar redirect) → șterge cookie-ul JWT, ca userul suspendat
  să nu revină la citire cu „back". Prima mutație a unui cont suspendat = delogare completă. `proxy.ts`: comentariul
  SEC-04 actualizat (gate soft pe token stale, nu mai e „proaspăt din DB").
- **Aplicat `requireActiveUserId` pe:** creare detaliu (`details/new`), editare detaliu (`details/[id]/edit`),
  publicare schiță (`sketches/[id]/edit` → `sendSketchAction`), comentariu add+edit (`comment-actions`),
  approve+disapprove (`validation-actions`). **Neatinse** (inofensive la suspendare): retract poziție proprie,
  ștergere ciornă/comentariu propriu, bookmark, salvare ciornă privată, mark-read notificări.
- **Efect operațional la deploy:** sesiunile `database` existente NU mai sunt valide ca JWT → userii logați
  acum se deloghează o dată și re-intră cu magic link. Fără migrație DB (schema neschimbată).
- `tsc --noEmit` verde · `eslint` 0 erori.

## 2026-07-02 — feat(details): workspace unificat cu taburi + dezbatere unificată @mention

- **De ce:** pagina de detaliu era liniară (imagine → validare → teanc cu thread izolat per schiță →
  comentarii) → scroll obositor + dezbatere fragmentată. Model nou „GitHub PR": tab = versiune. Plan +
  decizii de produs în `plan-detaliu.md` (aprobat 2026-07-02).
- **`app/(app)/details/[id]/detail-workspace.tsx`** (NOU, client): card unificat cu taburi
  (tab 0 = detaliul de bază, 1..N = schițe), viewport contextual (Image mamă / `SketchViewer`), panou dreapta
  cu autorul tabului activ + ștergere schiță, și **bara de validare CONTEXTUALĂ** pe ținta tabului (per-țintă,
  model DB neschimbat). Comutarea de tab = pur client (view-urile vin precomputate din server). Randează și
  `CommentsSection` (dezbatere unificată) ca `selectSketch` din mențiuni să schimbe tabul fără plumbing.
- **`validation-panel.tsx`**: prop `embedded` — fără card propriu + butoane compacte (cerință Edi: butoanele
  păreau prea mari în containerul dedicat).
- **`comments-section.tsx`**: thread UNIC pe toată postarea (target DETAIL; s-a renunțat la thread per-schiță).
  Compozitor `@mention` (dropdown cu schițele detaliului, textarea necontrolat + inserare token prin ref),
  randare mențiuni clicabile (`CommentBody`) → click schimbă tabul; schiță ștearsă → degradare la text.
- **`lib/mentions.ts`** (NOU): format token inline `@[Nume](sid:<uuid>)` (fără schimbare de schemă) —
  `buildMentionToken` / `parseMentions` / `extractMentionSketchIds` / `sanitizeMentions`. Totul TEXT (fără
  `dangerouslySetInnerHTML`) → zero injecție.
- **Server (`commentService` + repos)**: la add/edit comentariu pe DETAIL, mențiunile se validează că trimit
  către schițe PUBLISHED ale acestui detaliu (`filterSketchIdsByDetail`, `inArray`) — anti-IDOR; tokenii
  străini se degradează la text. `getCommentTarget` derivă detailId la editare.
- **`page.tsx`**: înlocuit blocul liniar cu `<DetailWorkspace/>`; **antetul** (titlu/autor/params/descriere +
  meniul „⋮") s-a mutat în capul cardului workspace (ca în 3.jpeg) — `page.tsx` rămâne cu breadcrumb + resurse +
  workspace. Imaginea 2D trăiește acum în viewportul tabului 0 (figure standalone scoasă). **Nu mai fetchează
  comentarii per SKETCH** (elimină N query-uri); validarea per-schiță rămâne.
- **`sketch-section.tsx`**: ȘTERS (absorbit în workspace).
- **Fără migrație DB.** Comentariile SKETCH istorice nu se mai afișează (MVP, date puține — lăsate ascunse).
- **Amânat:** overlay multi-schiță pe canvas; breakdown counts pe rol în bara de validare.

## 2026-07-02 — feat(details): editare detaliu de către autor

- **De ce:** autorul nu putea corecta un detaliu după publicare (exista doar creare + ștergere).
- **`server/repos/detailsRepo.ts`**: `updateDetailRow` (câmpuri + `updated_at`), `replaceDetailCategories`,
  `replaceDetailResources` (delete-all + insert, `db.batch` atomic când există și inserare).
- **`server/services/detailService.ts`**: `updateDetail` — ownership pe server (autor → altfel `FORBIDDEN`/
  `NOT_FOUND`), aceeași validare ca la creare (`validateDetailInput` + FK categorii), întoarce `oldImageUrl`
  când imaginea s-a schimbat (curățare blob în action). **Resursele TEXT se păstrează** (formularul acoperă
  doar IMAGE/LINK/PDF → altfel replace-ul le-ar șterge).
- **`app/(app)/details/[id]/edit/`**: pagină nouă (authz autor; non-autor → redirect la detaliu) + `actions.ts`
  (`updateDetailAction`: reprocesează imaginea DOAR dacă s-a schimbat — flag `imageChanged`; șterge blob-ul vechi;
  revalidează detaliu + feed).
- **`detail-form.tsx`**: refolosit ca formular COMUN creare/editare (props `action`/`initial`/`submitLabel`,
  `defaultValue`-uri, imaginea existentă pre-încărcată ca previzualizare).
- **`detail-actions-menu.tsx`** (kebab): item „Editează detaliul" — doar autorul.
- **Limitare cunoscută:** resursele TEXT se păstrează dar NU se pot edita/șterge din formular (are doar IMAGE/
  LINK/PDF); fără rate-limit dedicat pe editare (author-only, risc mic). Vezi handoff.

## 2026-07-02 — feat(auth+ui): auto-confirmare magic link + rafinări UI

- **Magic link fără al doilea click:** scos butonul intermediar „Aproape gata → Conectează-te". Emailul duce
  la **`app/verify/page.tsx`** care se **auto-confirmă din JS** la încărcare (`auto-verify.tsx` → `window.location`
  spre callback-ul Auth.js). Scanerele de mail fac GET dar nu rulează JS → tokenul one-time nu se consumă;
  fallback `<noscript>` cu buton. `lib/auth.ts` trimite `/verify?u=…`; `proxy.ts` listă publică `/verify`
  (scos `/verify-click`). Anti open-redirect: `validateCallbackUrl` (origine + `/api/auth/callback/`).
- **Fade la intrarea în feed:** linkul aterizează pe `/feed?welcome=1`; `feed-entrance.tsx` face fade-in fin +
  curăță flag-ul din URL (fără re-declanșare la refresh). Default login callbackUrl → `/feed?welcome=1`.
- **Intro splash:** o dată **per sesiune** (`sessionStorage`) în loc de per dispozitiv (`intro-splash.tsx` + scriptul
  pre-paint din `layout.tsx`).
- **Fix meniu user (header):** se închide la click în afară + Escape (`user-menu.tsx`). Backdrop-ul `fixed` nu
  funcționa din cauza `backdrop-blur` pe header (containing block pt. `fixed`) → înlocuit cu click-outside pe ref.
- **Teanc — taburi compacte:** taburile inactive arată doar avatarul; tabul activ = avatar + nume (pill); tooltip
  la hover (`title`/`aria-label`). Rezolvă umplerea liniei de numele lungi (`sketch-section.tsx`).
- **README** rescris ca document despre aplicație (scos decizii/porți interne; corectat flux schiță `DRAFT→PUBLISHED`
  și accesul public).

## 2026-07-02 — feat(observabilitate): Vercel Web Analytics

- **De ce:** vizibilitate pe vizitatori + page views pe `detalia.ro` (fază de validare — vrem să vedem traficul).
- `@vercel/analytics` instalat; `<Analytics />` (din `@vercel/analytics/next`) adăugat în `app/layout.tsx` înainte
  de `</body>`. **First-party** (`/_vercel/insights/*`, same-origin) → fără excepții CSP. No-op în dev local.
- **De făcut (Liviu):** deploy → navighează pe site → date în tab-ul Analytics din Vercel (~30s).

## 2026-07-02 — feat(security): Cloudflare Turnstile pe formularele de auth (anti-bot)

- **De ce:** acces public/passwordless (magic link) = țintă clasică de boți/abuz de email. Turnstile filtrează
  boții înainte de a atinge Resend/DB, în plus peste rate-limit-ul existent.
- **`lib/turnstile.ts`** — `verifyTurnstile(token, ip)` validează la Cloudflare siteverify. **No-op fără
  `TURNSTILE_SECRET_KEY`** (dev local merge fără chei, ca Sentry). Fail-open DOAR la eroare de rețea (outage CF →
  nu blocăm signup, rate-limit rămâne plasa de siguranță); token lipsă/invalid = respins.
- **`components/auth-form.tsx`** (partajat login+signup): widget Turnstile (mod Managed) randat doar dacă există
  `NEXT_PUBLIC_TURNSTILE_SITE_KEY`; injectează `cf-turnstile-response` în form. **`app/auth-actions.ts`**:
  verificare după rate-limit, înainte de `signIn` → `?error=CaptchaFailed` la eșec. Mesaj adăugat pe login+signup.
- **`lib/csp.ts`**: `challenges.cloudflare.com` adăugat pe `script-src` + `frame-src` + `connect-src` (altfel CSP
  strict cu nonce ar bloca scriptul/iframe-ul widget-ului).
- **Env (Liviu, deja puse în Vercel):** `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (public, inline la build) +
  `TURNSTILE_SECRET_KEY` (server). Necesită deploy ca site key-ul să intre în build. `next build` verificat verde.

## 2026-07-02 — feat(feed): scurtătură „Schițează peste" pe cardul de detaliu

- **De ce (idee Edi):** buton de schițare la fiecare detaliu direct din feed, ca să nu deschizi întâi pagina.
- **Nu buton primar care pornește schița din feed** (ar fi creat drafts gunoi la fiecare click + schițe fără
  context). În loc: **link secundar** „Schițează peste" pe fiecare `DetailCard`, care duce la pagina detaliului
  la ancora teancului (`/details/[id]#schiteaza`) — userul vede întâi contextul (imaginea mare, parametri,
  schițele existente) și apasă butonul real „Schițează peste detaliu". Draft-ul se creează abia acolo, ca înainte.
- `sketch-section.tsx`: secțiunea teancului are acum `id="schiteaza"` + `scroll-mt-24` (offset sub header sticky).
  Link vizibil TUTUROR (inclusiv pe propriul detaliu), spre deosebire de validarea inline (ascunsă pe self).

## 2026-07-02 — feat(detaliu): meniu „⋮" (acțiuni) + „Salvează detaliu" (bookmark)

- **De ce (cerere Edi):** butonul „Șterge" din antetul paginii de detaliu era prea expus (colț dreapta-sus,
  lângă interacțiuni) → risc de click accidental pe o acțiune ireversibilă. Mutat într-un meniu kebab „⋮".
- **Meniu nou** `app/(app)/details/[id]/detail-actions-menu.tsx` (client, pattern-ul de dropdown din
  `components/user-menu.tsx`). Vizibil TUTUROR: **Salvează detaliul · Vezi profilul autorului · Copiază linkul**.
  Autorului i se adaugă, ULTIMA, separată + roșie: **Șterge detaliul** (confirmare `window.confirm` păstrată;
  authz reală rămâne pe server în `deleteDetail`). `delete-detail-button.tsx` (butonul expus) — eliminat.
- **Bookmark = feature nou.** Tabel `saved_details` (PK compus `(user_id, detail_id)` → unicitate; ambele FK
  cascade; index pe `detail_id`) — migrația `db/migrations/0012_dear_callisto.sql`. Repo (`detailsRepo`):
  `insertSavedDetail` (onConflictDoNothing), `deleteSavedDetail`, `isDetailSavedByUser`, `listSavedDetails`
  (forma FeedItem, refolosește cardul de feed). Service (`detailService`): `toggleSavedDetail`, `isDetailSaved`,
  `getSavedDetails`. Server action `save-actions.ts` (`toggleSaveDetailAction`) — `userId` DOAR din sesiune
  (fără IDOR), toggle reversibil, revalidează `/details/[id]` + `/saved`.
- **Pagină nouă `/saved`** — lista detaliilor salvate (recent salvate primele), refolosește `DetailCard` +
  `getMyPositions` ca feed-ul; empty state propriu. Link „Detalii salvate" adăugat în `user-menu`.
- **De aplicat (Liviu):** migrația `0012` pe DB (`npm run db:push` / `db:migrate` pe branch-ul Neon, apoi prod).
  Type-check verde; lint pe fișierele editate verde.

## 2026-07-02 — feat(observabilitate): Sentry (erori server/client/edge)

- **De ce:** logurile Vercel sunt greu de corelat cu erorile de UI (vezi bug-ul de schiță blocată — a
  trebuit screenshot manual din Vercel Logs). Sentry le prinde automat, cu stack trace + context.
- **`@sentry/nextjs` instalat.** Fișiere noi: `instrumentation.ts` (register server+edge, `onRequestError`),
  `instrumentation-client.ts` (browser, + `onRouterTransitionStart` cerut pt tracing navigări),
  `sentry.server.config.ts`, `sentry.edge.config.ts`. `app/error.tsx` + `app/global-error.tsx`:
  adăugat `Sentry.captureException` (păstrat comportamentul UI existent).
- **`next.config.ts`**: înfășurat cu `withSentryConfig` — `tunnelRoute: "/sentry-tunnel"` (erorile trec
  prin domeniul nostru, nu direct spre `*.sentry.io` → evită ad-blockere ȘI nu trebuie touched `lib/csp.ts`).
  `proxy.ts`: `/sentry-tunnel` adăugat în `PUBLIC_PATHS` (altfel erorile de pe pagini pre-auth, ex. `/login`,
  ar fi fost blocate de deny-by-default).
- **PII:** `sendDefaultPii: false` explicit pe toate cele 3 runtime-uri (regula proiectului). Fără session
  replay (ar putea capta imagini/date de profil — omis prudent, nu e o decizie luată).
- **Complet no-op fără env** (`enabled: !!NEXT_PUBLIC_SENTRY_DSN`) — build/dev local merg identic fără cont
  Sentry configurat. `npm run build` verificat verde, fără avertismente.
- **De configurat (Liviu, în Vercel + Sentry):** proiect nou Sentry (platformă Next.js) → `NEXT_PUBLIC_SENTRY_DSN`
  (Production+Preview) + `SENTRY_ORG`/`SENTRY_PROJECT`/`SENTRY_AUTH_TOKEN` (doar pt source maps la build).

## 2026-07-02 — fix(feed): sidebar categorii — secțiuni scoase din filtre + „Vezi mai multe"

- **Secțiunile de grupare** (`Alte categorii`, `Clasificare după zonă`, `Clasificare după sistem
  constructiv` — rândurile cu `parentId` null) apăreau greșit ca filtre bifabile în sidebar-ul
  feed-ului. `categoriesRepo.listCategoriesWithCounts` acum exclude explicit rândurile fără părinte
  (`isNotNull(categories.parentId)`) — rămân doar cele 29 de categorii FRUNZĂ, reale.
- **Listă trunchiată**: cu 29 de categorii, sidebar-ul devenea o coloană nesfârșită. Extras
  `components/category-filter-list.tsx` (client, are nevoie de state pentru toggle) — arată primele 6,
  restul sub „Vezi mai multe (N)"/"Arată mai puține".
- **De investigat separat (raportat de Liviu):** toate categoriile arătau 0 detalii deși platforma are
  conținut real — cauza probabilă e migrația 0011 care a șters `details.category_id` fără să migreze
  datele în `detail_categories` pentru detaliile create înainte de refactor. Vezi handoff pentru status.

## 2026-07-02 — fix(auth, CRITICAL): pagină de confirmare pentru magic link (anti-prefetch)

- **Simptom raportat:** login pe PC funcțional, dar cererea unui magic link nou pe telefon eșua la
  click cu `[auth][error] Verification` (Vercel Logs). Cauză: clienți de mail care fac GET automat pe
  linkurile din email pentru scanare de securitate (Apple Mail Privacy Protection, preview Gmail,
  filtre corporate) — consumă tokenul one-time al Auth.js ÎNAINTE de click-ul real al userului.
- **Fix:** emailul de magic link nu mai trimite direct URL-ul de callback Auth.js (`sendVerificationRequest`
  în `lib/auth.ts`), ci un link către pagina nouă `/verify-click?u=<url encodat>` — inofensivă la un GET
  automat (doar afișează un buton, nu consumă nimic). Verificarea reală (`/api/auth/callback/resend`) se
  declanșează DOAR la click-ul efectiv al userului pe buton.
- **`app/verify-click/page.tsx`** (nou): validează strict `u` — trebuie să fie pe originea `AUTH_URL` și
  pe path `/api/auth/callback/*` (SEC-03, anti open-redirect); orice altceva → „Link invalid".
- **`proxy.ts`**: `/verify-click` adăugată în `PUBLIC_PATHS` (rută pre-auth, ca `/verify-request`).
- **De testat manual** (CRITICAL, auth): magic link normal PC + telefon, link expirat, link reutilizat,
  `u` manipulat (open-redirect) → trebuie respins cu „Link invalid".

## 2026-07-02 — feat(onboarding): autocomplete orașe RO și pe formularul de onboarding

- `onboarding-form.tsx`: câmpul „Locație" era text liber simplu, spre deosebire de același câmp din
  `profile/edit` (`profile-forms.tsx`), care are sugestii native din `RO_CITIES` (`<datalist>`). Aliniat —
  același `list="ro-cities"` + `autoComplete="off"` (câmpul rămâne text liber, sugestiile sunt doar UX).

## 2026-07-02 — perf(validare): scos `revalidatePath("/feed")` inutil din acțiunile pe pagina detaliu

- `validation-actions.ts` (Aprob/Retract/Dezaprob): fiecare acțiune invalida și cache-ul feed-ului întreg,
  deși efectul e local unui singur detaliu. Rămâne doar `revalidatePath(/details/{id})`. Feed-ul se
  reîmprospătează normal la următoarea vizită — fără regresie funcțională.

## 2026-07-02 — fix(schiță): copy vechi despre acceptare + autor separat în seed-ul E2E

- `sketch-editor.tsx`: scos textul „Autorul detaliului decide dacă schița ta intră în teancul public" —
  rest din modelul vechi cu coadă de acceptare, eliminat 2026-06-30 (schițele se publică direct). Copy-ul
  rămăsese, deruta userul deși comportamentul real era deja cel corect.
- `e2e/auth.setup.ts`: detaliul-țintă al testelor de validare era autorat de ÎNSUȘI userul de sesiune →
  `CANNOT_VALIDATE_OWN` ascundea mereu butoanele Aprob/Dezaprob, testele de validare nu puteau trece
  structural. Adăugat user separat `e2e-author@detalia.test` ca autor al detaliului; userul de sesiune
  (`e2e-tester@...`) rămâne doar actorul care validează/comentează.

## 2026-07-02 — fix(ux): trei mici inconsistențe raportate de Liviu

- `validation-panel.tsx`: click pe Aprob nu mai lasă deschis panoul de alegere Dezaprob (text/schiță) dacă
  fusese pornit înainte — `onApprove` resetează `mode` la `"none"`.
- `sketch-canvas.tsx`: pill-ul „MOD DESEN/MOD SCHIȚĂ" (z-[3]) era acoperit de foaia de desen (z-[4]) când
  aceasta ajungea în colțul stânga-sus — ridicat la z-[6], deasupra foii și controalelor de zoom.
- `user-menu.tsx`: dropdown-ul de profil din header rămânea deschis la navigare între pagini (header-ul
  persistă în layout, componenta nu se remonta) — închis acum la schimbarea `pathname` (ajustare de state
  în render, nu `useEffect`, per recomandarea React).

## 2026-07-02 — test(roluri): acoperire pentru allowlist meserii/rol adițional

- `server/domain/roles.test.ts` (nou) — gol de testare descoperit la audit post-implementare (meserii +
  categorii, task-urile de mai jos): `isValidRoleMain`/`isValidSubRole`/`isValidSecondaryRole` (allowlist-uri
  server-side, enforce pe `declareRole`/`updateRole`) nu aveau teste. Acoperă: valori valide per listă, respingere
  meserie din alt rol principal (nu se pot amesteca listele), respingere valoare inventată/case greșit.

## 2026-07-02 — feat(categorii): multi-categorie (tag-uri) + parametri tehnici pe listă fixă

- **Multi-categorie** (Edi: „bifezi oricâte", stil tag Pinterest): `details.category_id` (FK unic) →
  tabel nou many-to-many `detail_categories` (`detailId`, `categoryId`, PK compus, index pe
  `categoryId`, cascade la ștergerea detaliului). `domain/detail.ts`: `categoryId: string` →
  `categoryIds: string[]` (min 1, cap defensiv `MAX_DETAIL_CATEGORIES=10`, dedupe).
  `detailsRepo.ts`: query-uri (`getDetailById`, `listFeed`, `listRelatedDetails`) trec de la `leftJoin`
  pe `categoryId` la `EXISTS`/agregare JSON (`detail.categories: {id,name,slug}[]`) pe join-ul nou —
  „detalii înrudite" = acum cel puțin o categorie comună, nu neapărat aceeași. `categoriesRepo.listCategoriesWithCounts`
  actualizat pentru join-ul nou. `detail-form.tsx`: select unic → tag picker grupat pe secțiuni
  (`categories.parentId` = header neselectabil), bifare multiplă → câmpuri hidden `categoryIds` repetate.
- **Parametri tehnici pe liste fixe** (Edi, `lista_categorii.md`): `climateZone` (Zona I–IV, fără
  variantă neutră → nullable, fără default) + `seismicZone` (text liber) **split** în `seismicAg`
  (8 valori) + `seismicTc` (4 valori) — ambele cu „General" ca variantă neutră. Adăugate `snowLoad`
  (4 valori) și `windLoad` (5 valori), tot cu „General". Toate validate contra listei fixe în
  `validateDetailInput` (`INVALID_ZONE` dacă valoarea nu e din listă) — planul vechi „listă pe HOLD,
  string liber mărginit" (`MAX_ZONE_LENGTH`) e depășit de decizia asta.
- **Migrație în 2 pași** (evită prompt-ul interactiv al `drizzle-kit generate` la rename ambiguu):
  `0010_fluffy_pandemic.sql` (adaugă `detail_categories` + `seismic_ag/tc`, `snow_load`, `wind_load`;
  relaxează `category_id`/`climate_zone`/`seismic_zone` vechi) + `0011_naive_alex_power.sql` (scoate
  `category_id` + `seismic_zone`). **NEAPLICATE** — rulează ambele, în ordine, pe branch-ul Neon de
  `dev` înainte de a testa formularul de creare detaliu.
- **`db/seed.ts` rescris**: taxonomia veche DRAFT (6 categorii flat) → taxonomia finală (3 secțiuni:
  „Clasificare după zonă" / „...sistem constructiv" / „Alte categorii", 29 categorii bifabile ca
  frunze pe `parentId`). Seed-ul acum ȘTERGE categoriile existente înainte de a insera (sigur doar
  fără detalii reale atașate — DB golită pentru seed-ul de lansare, vezi handoff). Rulează `npm run db:seed` DUPĂ migrații.
- Actualizate toate locurile care citeau `categoryId`/`categoryName` direct: `detail-card.tsx` (badge
  arată prima categorie + „+N"), `profile-view.tsx`/`profileRepo.ts` (idem, subquery pe prima
  categorie alfabetic), `details/[id]/page.tsx` (breadcrumb + antet + badge-uri de parametri tehnici),
  `e2e/auth.setup.ts` (insert separat în `detail_categories`).

## 2026-07-02 — feat(roluri): lista finală de meserii + rol adițional + rolul principal ascuns din platformă

- **`server/domain/roles.ts`**: `SUBROLES` înlocuit cu lista finală confirmată de Edi (`lista_meserii.md`) — 13
  meserii PROIECTANT, 7 EXECUTANT, 3 FURNIZOR, 2 BENEFICIAR. Adăugat `SECONDARY_ROLES` (Administrativ + Educație,
  11 valori) + `isValidSecondaryRole`.
- **Rol adițional, ADITIV** peste meseria de bază (nu înlocuiește regula „un singur rol per user"): coloană nouă
  `roles.secondary_role` (nullable, migrație `0009_cynical_annihilus.sql`) + prag prin `declareRole`/`updateRole`
  (`roleService.ts`) → `rolesRepo.ts` → `onboarding/actions.ts` (câmp nou `secondaryRole` în formular).
- **Rolul principal (PROIECTANT/EXECUTANT/FURNIZOR/BENEFICIAR) nu se mai afișează în platformă** — doar meseria
  (subRole), decizie Edi („Eduard Nemeș · Arhitect", nu „Proiectant · Arhitect"). `RolePill` afișează acum
  `subRole` (culoarea pastilei rămâne pe `roleMain`, invizibil userului). Actualizate toate apelurile:
  `detail-card.tsx`, `comments-section.tsx`, `validation-panel.tsx`, `sketch-section.tsx`, `sketch-editor.tsx`,
  `details/[id]/page.tsx` (autor + detalii înrudite), `notification-bell.tsx`/`app-header.tsx` (payload notificare
  extins cu `sketchAuthorSubRole`). `profile/edit/page.tsx`: `roleLabel` = doar meseria.
  Repo-urile (`detailsRepo`, `commentsRepo`, `validationsRepo`) aveau deja `subRole`/`authorSubRole` în select —
  doar `usersRepo.getNotificationActor` + `detailsRepo.listRelatedDetails` au primit coloana în plus.
  **Admin panel (`admin-page/page.tsx`) neatins** — afișează în continuare rol+subrol (context intern, nu platformă publică).
- **Migrație generată, NEAPLICATĂ** — rulează `npm run db:migrate` (sau `db:push`) pe branch-ul de lucru înainte de deploy.

## 2026-07-01 — perf/ux(detaliu): optimistic UI la validare + pagina „Adaugă detaliu" wide

- **Optimistic UI pe Aprob/Retract** (`validation-panel.tsx`): butoanele erau `<form action>` simple, fără pending
  → UI-ul îngheța pe toată durata roundtrip-ului server (auth Neon + Upstash + write + revalidate) și „părea blocat".
  Acum: `useOptimistic` pe poziție + contoare, acțiunile rulează în `startTransition` → flip **instant**, reconciliere
  cu serverul la revenirea props-urilor. Dezaprobarea-text rămâne pe `useActionState` (are nevoie de validare server).
  *(Diagnostic latență prod, de urmărit: sesiune `strategy:"database"` = query Neon la fiecare `auth()`; colocare
  regiuni Vercel/Neon/Upstash; revalidări țintite. Vezi handoff.)*
- **Pagina „Adaugă detaliu" wide** (`details/new/page.tsx`): container `max-w-[760px]` → `max-w-[var(--container-max)]`
  (1280px, ca header/Feed); titlu + subtitlu centrate. Zona de desen: `h-[560px]` → `h-[70vh]` (min 520 / max 760).

## 2026-07-01 — feat(detaliu): creare detaliu prin DESEN („Desenează")

> Propunere Edi: constructorul își desenează exact problema lui (detaliul de execuție pe care nu știe cum să-l
> rezolve), fără să caute o imagine gata făcută; ceilalți vin cu soluții (schițe peste el). Până acum un detaliu
> se putea crea **doar prin upload de fișier**.

- **Decizie de produs (confirmată de Liviu):** desenul se salvează ca **PNG** (randat client-side) → devine
  `imageUrl`-ul detaliului, exact ca un upload. **Fără schimbare de schemă DB, fără flux nou pe server.** Detaliul
  desenat NU e re-editabil (peste el se pot face schițe, ca peste orice detaliu).
- **Canvas reutilizat, parametrizat pentru „foaie goală"** (`components/sketch/sketch-canvas.tsx`): `imageUrl` devenit
  opțional + prop nou `aspectRatio` (default 4:3). Fără imagine-mamă: fundal alb solid în `redraw` + `exportThumbnail`
  (relaxat `if(!img) return null`), dimensionare din `aspectRatio`, eticheta din colț „Mod desen · foaie nouă".
  Modificări aditive sub guard-uri existente → editorul de schițe (imagine-mamă la fill slab) rămâne neschimbat.
- **Formular creare** (`app/(app)/details/new/detail-form.tsx`): toggle **„Încarcă fișier" / „Desenează"**. În modul
  desen, la submit: `exportThumbnail()` → `File` PNG → `uploadImageToBlob("details", ...)` → hidden `imageUrl` →
  re-submit. De aici încolo pipeline-ul e identic cu uploadul (server reprocesează cu sharp: `reprocessBlobImage`).
- **Server neatins:** `actions.ts`, `detailService.ts`, `detailsRepo.ts`, `db/schema.ts` — zero modificări.

---

## 2026-06-30 — feat(detaliu): simplificarea logicii de interacțiune (validare + dezaprobare + schiță)

> Decizie de produs Edi: pagina de detaliu era greoaie/derutantă. Patru schimbări corelate. **Modifică reguli
> marcate anterior „non-negociabile" în acest fișier și în `CLAUDE.md`** (schiță publică doar cu accept autor-mamă).

### 1. Autorul nu se mai validează pe propriul conținut (Q1)
- **UI:** butoanele Aprob/Dezaprob sunt ascunse pe propriul detaliu — pe pagina detaliului
  (`validation-panel.tsx` prop nou `canValidate`, gating în `details/[id]/page.tsx` via `isAuthor`) ȘI în feed
  (`detail-card.tsx` + `feed/page.tsx` propagă `currentUserId`; `FeedValidationActions` ascuns pe propriul card).
- **Server (defense-in-depth):** `validationService.approve/disapprove` — guard nou `CANNOT_VALIDATE_OWN`
  (helper `getTargetAuthorId`): refuză dacă `userId === authorId` al țintei (DETAIL sau SKETCH PUBLISHED).

### 2. Dezaprobare cu alegere binară text SAU schiță (Q2 + Q3)
- `validation-panel.tsx`: Dezaprob → pas de **alegere** (`mode: none → choose → text`): „Scrie o justificare"
  (textarea + `intent=send`, neschimbat) SAU „Fă o schiță" (`intent=sketch`). Pe SKETCH (`allowSketch=false`)
  se sare direct la text (o singură cale). Vechiul formular cu 2 submit-uri lipite a fost eliminat.
- `validation-actions.ts` `disapproveAction`: ramura `intent=sketch` **NU mai cere text** și **NU mai înregistrează
  poziția pe loc** — creează un draft marcat `disapprovesParent` și duce în editor.

### 3. Dezaprobarea-prin-schiță fără „dezaprobare mută" (decizie de design)
- Coloană nouă `sketches.disapproves_parent` (migrație `0008_high_loa.sql`, aditivă/reversibilă).
- Poziția DISAPPROVE + comentariul-justificare (`originValidationId`) se materializează **la PUBLICAREA schiței**
  (`sketchService.publish` → `validationService.recordSketchDisapproval`), nu la click. Dacă autorul abandonează
  editorul → nicio dezaprobare. Guard: autorul-mamă care schițează pe propriul detaliu nu se auto-dezaprobă.

### 4. Publicare directă + ștergere (Q4) — **se elimină coada de acceptare**
- State machine simplificat: `DRAFT → PUBLISHED` (fără `PENDING_ACCEPTANCE`). `server/domain/sketch.ts` documentat;
  valorile `PENDING_ACCEPTANCE`/`REJECTED` rămân în enumul DB pentru istoric, dar nu se mai produc.
- `sketchService`: `send` → **`publish`** (DRAFT→PUBLISHED direct, `publishFromDraft` în repo). Eliminate
  `accept`/`reject`/`decide`/`getPendingForOwner` + `transitionFromPending`/`listPendingByDetail`. Nou **`deleteSketch`**
  (ownership: autorul schiței SAU autorul detaliului-mamă; cascadă validări+comentarii pe SKETCH + blob via
  `deleteSketchCascade`).
- Acțiuni: `sketch-review-actions.ts` — eliminate `acceptSketchAction`/`rejectSketchAction`, adăugat
  `deleteSketchAction` (rate-limit SEC-01). `sketch-actions.ts` `sendSketchAction` → `publish`.
  `sketch-editor.tsx`: buton „Trimite propunerea" → **„Publică schița"**.
- UI `sketch-section.tsx`: eliminată secțiunea „Propuneri în așteptare"; adăugat buton **Șterge** pe schița activă
  din teanc (vizibil autorului detaliului sau autorului schiței), cu confirmare. Clamp pe tab după ștergere.
- Notificări: `notifySketchProposed` → „X a schițat peste «titlu»" (deja publicată). Eliminat `notifySketchDecision`;
  adăugat **`notifySketchDeleted`** (tip enum nou `SKETCH_DELETED`). UI notificări (`notification-bell.tsx`,
  `notifications/page.tsx`) actualizat: text „a schițat peste", CTA „Vezi schița în teanc", caz `SKETCH_DELETED`.

### Teste & verificare
- `sketchService.test.ts` rescris (publish + deleteSketch + materializare dezaprobare; fără accept/reject).
- `validationService.test.ts`: teste noi pentru `CANNOT_VALIDATE_OWN` + `recordSketchDisapproval`.
- `tsc --noEmit` ✅ · `eslint` ✅ (0 erori). Migrația Drizzle generată (`db:generate`).

---

## 2026-06-30 — feat(profile): autocomplete orașe România pe câmpul „Locație"

### feat(profile) — sugestii de orașe la „Locație" (profile/edit)
- `lib/ro-cities.ts` nou: listă statică cu orașele României (toate municipiile + orașe notabile), deduplicată +
  sortată `ro`. `app/(app)/profile/profile-forms.tsx`: câmpul „Locație" primește `list="ro-cities"` + un `<datalist>`
  populat din listă → browserul sugerează nativ (scrii „Ti" → Timișoara). Zero JS / zero dependențe / accesibil.
  Câmpul rămâne **text liber** (nu e enum validat pe server) — userul poate scrie și o comună care nu e în listă.
  `autoComplete="off"` ca să nu se bată autofill-ul de browser cu sugestiile din datalist.
- Notă: același câmp „Locație" există și în `app/onboarding/onboarding-form.tsx` — NU a fost atins (cerut doar profile/edit).

---

## 2026-06-30 — fix(sketch): ștergere ciornă optimistă (nu mai pare „blocat")

### fix(sketch) — ștergerea ciornei dispare instant (UI optimist)
- `app/(app)/sketches/drafts/page.tsx` posta ștergerea printr-un `<form action={deleteDraftAction}>` server pur,
  fără pending/optimistic → la click rândul rămânea static ~2s (roundtrip `auth` + `deleteDraft` + `revalidatePath`
  + re-render) și părea blocat. Extras lista într-un client component nou `drafts-list.tsx` cu **`useOptimistic`**:
  rândul dispare **instant** la click, ștergerea reală rulează în fundal; dacă pică, `revalidatePath` resincronizează
  prop-ul `drafts` și rândul revine. `deleteDraftAction` neschimbat (ownership + stare DRAFT verificate în service/repo).
  Empty state mutat tot în client component ca să reflecte starea optimistă (dispare ultima ciornă → apare instant).

---

## 2026-06-30 — sesiune fix-uri: schiță (canvas/mobil), auth, header/logo mobil, câmp „Firmă"
<!-- Lot de modificări dintr-o singură sesiune (câmp Firmă, unelte schiță, pinch-zoom, redirect ciornă,
     bodySizeLimit, header/logo mobil, CTA landing, feedback magic link). Dacă apar regresii din astea,
     aici e referința — fiecare intrare are fișierul afectat. -->

### feat(landing) — animația hero reflectă cardul real din feed
- `components/hero-preview.tsx`: cardul animat din hero arăta doar planșa + 2 voturi. Rescris să oglindească un
  `DetailCard` real din feed — păstrează planșa care „se desenează" ca thumbnail, dar adaugă chrome-ul de feed:
  etichetă categorie + `DET-014`, titlu, autor + **pastilă de rol**, **stivă de validatori** suprapuși, **contoare**
  (`12 validări · 3 comentarii · 5 schițe în teanc`), apoi pozițiile pe roluri (Aprobă/Dezaprobă + justificare).
  Reutilizează animațiile existente (`data-draw`/`data-fade`/`data-rise`, reduced-motion respectat); ciclu 6.5s.

### feat(profile) — câmp opțional „Firmă" (firma pe care o reprezintă userul)
- Coloană nouă `users.company text` (opțional, auto-declarat ca locație/website). Migrație `0007_public_black_tom.sql`
  (`ALTER TABLE users ADD COLUMN company text`) — **de aplicat pe AMBELE ramuri Neon**.
- Cablat prin toate straturile: onboarding (form + `onboardingAction`, max 120, validat server-side), editare profil
  (`EditDetailsForm` + `updateProfileDetailsAction` → `updateProfileDetails`), repo (`updateUserProfile`/`updateUserDetails`
  + selecturile `getUserProfile`/`getPublicProfile` + `anonymizeUserRow`). Afișat pe profilul public lângă locație (icon clădire).

### fix(auth) — placeholder email generic
- `auth-form.tsx`: placeholder `nume@firma.ro` → `nume@mail.ro`.

### fix(sketch) — curățare unelte canvas de schiță
- Scoase **riglele decorative** (ticks la 26px) de pe marginile sus/stânga ale foii — nu aveau funcție.
- **Grosime creion**: cele 3 trepte fixe (`STROKE_WIDTHS` butoane) înlocuite cu un **slider vertical** continuu
  (2..40px) + punct de previzualizare. Serverul validează independent `0 < size ≤ 100` (`sketch.ts`), neschimbat.
- **Salvează ciornă → redirect în detaliu**: după salvare reușită editorul te duce înapoi la `/details/[id]`
  (model clar: salvează=pleci cu munca pusă deoparte, Renunță=pleci fără salvare, Trimite=propui). Toast-ul „ciornă
  salvată" eliminat (navigăm). Acțiunea server `saveStrokesAction` neschimbată; redirect-ul e client-side (`useRouter`).
- **Pinch-to-zoom pe mobil/tabletă**: al doilea deget pe foaie intră în mod pinch (anulează stroke-ul în curs) și
  ajustează zoom-ul după raportul distanțelor dintre degete, plafonat la `ZOOM_MIN..ZOOM_MAX` (0.4..3). Pointerele
  touch urmărite într-un `Map`; desenul cu un deget neschimbat. `touch-none` pe canvas împiedică zoom-ul nativ.

### fix(auth) — feedback instant la trimiterea magic link-ului
- La „Creează cont" / „Trimite link de acces", butonul stătea mut ~1s (cât server action-ul trimite emailul prin
  Resend, apoi redirect) → părea blocat. Adăugat stare de pending cu `useFormStatus`: butonul devine „Se trimite…"
  + disabled imediat la submit. Nu accelerează trimiterea — elimină percepția de „înghețat".

### fix(ui) — CTA header landing pe mobil (buton „Creează cont")
- Pe ecran îngust „Autentificare" + „Creează cont" se înghesuiau lângă logo, iar „Creează cont" se rupea pe 2 rânduri.
  `whiteSpace: nowrap` pe `primaryBtn` (un singur rând) + media query `max-width:560px` (`.dc-header-cta`) care
  micșorează gap-ul, fontul și padding-ul butonului/link-ului. Inline style → override cu `!important`.

### fix(ui) — butoane header consistente (mobil)
- Clopoțelul de notificări era `rounded-md` cu bordură + fundal colorat când aveai necitite → arăta ca o „cutie"
  lângă „Ciornele" și avatar (ambele cercuri ghost). Unificat: cerc ghost `h-9 w-9`, fără bordură; starea „necitite"
  o semnalează doar bulina roșie. Vizibil mai ales pe mobil, unde butoanele stau înghesuite lângă margine.

### fix(sketch) — trimiterea schiței pică cu 413 (body > 1MB)
- `POST 500` pe `/sketches/[id]/...` la **Trimite propunerea**: Server Action-ul postează strokes JSON + thumbnail PNG
  (1000px lățime, frecvent > 1MB) → lovea default-ul de 1MB al Server Actions (`statusCode 413`). Setat
  `experimental.serverActions.bodySizeLimit = "4mb"` în `next.config.ts`. Acțiunea rămâne auth-gated + rate-limited.

### fix(ui) — header unificat la 76px + logo 32 (peste tot)
- AppHeader-ul (feed + restul paginilor logate) era mai scund (`py-3` ~50px, logo 26) decât landing/login/signup
  (76px, logo 32) → bara „sărea" la tranziție. **Aliniat AppHeader la dimensiunea landing-ului** (header `h-[76px]`,
  logo 32) — NU invers. `app-header.tsx` + `auth-shell.tsx` + `app/page.tsx` au acum aceleași metrici. Container
  orizontal era deja identic (1280px + `px-6`). *(Inițial aliniasem greșit în jos; corectat la cererea lui Liviu.)*

### fix(brand) — logo identic pe mobil (wordmark vectorizat)
- `public/logo.svg` + `public/logo-dark.svg`: wordmark-ul „DETALI" era `<text>` live cu **Arial Black** (font-family
  Arial, weight 900) → pe mobil „Arial" cădea pe un sans mai subțire, iar avansurile per-glyph hardcodate (calculate
  pentru Arial Black) lăsau literele slabe și depărtate. Convertit în **contururi vectoriale** (path), independent de
  font → randare identică pe orice device. Header + footer folosesc aceleași assets.

## 2026-06-30 — panou de admin (magic link, separat de useri) + mod mentenanță

### feat(admin) — panou izolat `/admin-page`, login prin magic link propriu
- Login admin = **magic link pe email** (via Resend), complet separat de Auth.js/contul de user. **CINE e admin =
  allowlist `ADMIN_EMAILS`** (env) — fără tabel de conturi, fără parole. Sesiune proprie (cookie HttpOnly dedicat,
  token opac validat în `admin_sessions` — revocabil, expiră, default 8h).
- Flux: `/admin-page/login` (pui email) → token one-time în `admin_login_tokens` (TTL 15m) → email cu link →
  `/admin-page/verify` (route handler GET) consumă token + creează sesiune → panou. `/admin` redirectează la login.
- `lib/admin-auth.ts`: `isAdminEmail` (allowlist), `createAdminLoginUrl`, `verifyAdminLoginToken`,
  `createAdminSession`/`getAdminSession`/`destroyAdminSession`. Re-verifică allowlist-ul la consum ȘI la fiecare citire
  de sesiune (email scos din `ADMIN_EMAILS` → acces revocat imediat).
- Panoul: listă useri (nume, email, rol+subrol, status, dată creare; `listUsersForAdmin`) + formular mentenanță + logout.
- `proxy.ts`: `/admin-page` scutit de poarta Auth.js a userilor (gating-ul real e în pagini/route, via sesiunea de admin).

### feat(maintenance) — DOUĂ controale independente (anunț + lockdown)
- Tabel **single-row** `platform_settings`: (1) anunț — `announcement_enabled` / `announcement_date` /
  `announcement_message`; (2) lockdown — `lockdown_enabled` / `lockdown_message`; + `updated_by` (email), `updated_at`.
  Migrație `0006_heavy_pet_avengers.sql` (creează `admin_login_tokens`, `admin_sessions`, `platform_settings`;
  reversibilă; de aplicat pe AMBELE ramuri Neon).
- `settingsRepo` (upsert singleton) + `settingsService` (`getPlatformState` cu `cache()` per-request + `setPlatform`
  cu validare server-side). Formularul din admin trimite ambele controale împreună.
- **(1) Anunț** — banner în feed (`app/(app)/feed/page.tsx`) pentru userii logați; platforma merge normal. Avertizare în avans.
- **(2) Lockdown** — gate GLOBAL în `proxy.ts`: cât e ON, tot ce nu e `/admin-page*` se face **rewrite** la `/maintenance`
  (ecran „site în lucru", URL neschimbat). DOAR adminul intră (pe `/admin-page`, ca să-l poată opri). Ecranul =
  `components/maintenance-screen.tsx` + `app/maintenance/page.tsx` (public).
- Notă: lockdown-ul citește `platform_settings` (single-row) în proxy pe fiecare request de pagină — cost mic, acceptabil MVP.

### fix — citire `platform_settings` tolerantă la erori
- `getSettingsRow` prinde excepțiile DB (drift de schemă / tabel lipsă / outage) → logează și cade pe default
  (mentenanță OFF). Motiv: tabelul e citit pe căi critice (landing + gate-ul de lockdown din `proxy.ts`) → o
  problemă de DB NU trebuie să dărâme paginile (pe prod, codul cu schema veche dădea 500 pe `/` fiindcă
  `production` nu fusese migrat). Acum un mismatch e degradare grațioasă, nu cădere.

### sec — hardening pe panoul de admin
- **Anti-enumerare**: cererea de link răspunde IDENTIC indiferent dacă emailul e admin (linkul se trimite doar dacă e
  în allowlist). Token magic-link one-time + TTL scurt. Sesiune re-verificată în allowlist la fiecare request.
- **Audit (SEC-14)**: `admin_login_success` (link trimis / verificat), `admin_login_failed` (email non-admin / token
  invalid) — cu hash de email/IP, fără PII brut. `maintenance_toggled` cu `emailHash`.
- **Rate-limit (SEC-01)**: cererea de link limitată pe email ȘI pe IP (`adminLoginPerUser` 10/15m, `adminLoginPerIp`
  30/15m); `setMaintenanceAction` per email.
- **Eliminat**: vechiul `lib/admin.ts` (allowlist peste contul de user) + ruta `/admin` veche + blocul de seed
  `ADMIN_EMAILS`→users din `db/seed.ts`. `ADMIN_EMAILS` rămâne, dar acum doar pentru gating-ul de admin separat.

---

## 2026-06-29 — fix-uri UX (profil/detaliu/feed) + remediere audit securitate (Codex)

### fix(ui) — câteva fix-uri de interfață
- `profile-view.tsx`: buton „Adaugă detaliu" în empty state-ul tab-ului Detalii (doar pe profilul propriu);
  cardul de detaliu afișează acum imaginea 2D (`details.imageUrl`), nu mai e placeholder gol.
- `details/[id]/page.tsx`: scos `max-w-[64ch]` de pe descriere → umple lățimea, fără gol lateral.
- `detail-card.tsx`: rândul de avataruri validatori are înălțime rezervată (`h-6`) → cardul nu mai „crește"
  când treci de la 0 validări la ≥1 (Aprob/Dezaprob).

### fix(auth) — eroarea de signup rămâne pe /signup
- `auth-actions.ts`: `signIn` cu `redirect: false` → citim `?error` din URL-ul întors și redirectăm pe `authPath`,
  în loc ca Auth.js să sară singur pe `pages.error` (=/login). Bug: o eroare la signup ducea userul pe login.

### fix(onboarding) — uploadul de avatar/cover în onboarding nu mai e blocat
- `proxy.ts`: poarta de rol redirecta `POST /api/blob/upload` către `/onboarding` (302) fiindcă userul încă n-are rol
  în timpul onboarding-ului → poza eșua („Încărcarea imaginii a eșuat"). Excepție: `/api/blob/upload` trece prin poarta
  de rol (ruta cere oricum sesiune în handler, deci sigur). Descoperit la testul de magic link pe `detalia.ro` live.

### fix(onboarding) — rol/subrol fără preselecție + cover repoziționabil
- `onboarding-form.tsx`: selecturile rol/subrol pornesc goale (placeholder „Alege rolul" / „Alege întâi rolul", `required`);
  subrolul e dezactivat până alegi rolul și nu se mai auto-completează cu primul (era Proiectant/Arhitect prefixate).
- Banda de cover se poate **repoziționa sus/jos** (drag, ca în profile edit) + hint + „Schimbă banda"; `coverPosition`
  (0..100) trimis prin câmp ascuns și persistat cu clamp server-side (`actions.ts` → `updateUserCoverPosition`).

### infra — domeniu `detalia.ro` live + Resend funcțional (magic link end-to-end)
- DNS migrat pe **Cloudflare**, domeniul `detalia.ro`/`www` atașat în Vercel (apex principal, A/CNAME DNS-only).
- **Resend**: domeniu de trimitere `notifications.detalia.ro` verificat (DKIM/SPF prin Cloudflare); `EMAIL_FROM` =
  `Detalia <noreply@notifications.detalia.ro>`, `AUTH_URL` = `https://detalia.ro` (Production). Magic link testat pe viu: OK.

### security — remediere audit read-only (Codex)
- **CRITICAL închis:** `e2e/.auth/state.json` + `seed.json` (cookie de sesiune real) erau urmărite de git →
  scoase din tracking + `e2e/.auth/` adăugat în `.gitignore`. Sesiunea compromisă revocată din DB (`preview/dev`).
  Tokenul rămâne în istoricul git dar e neutralizat prin revocare (e session token).
- **Gap CI închis:** `ci.yml` rulează acum **secret scan (gitleaks)** pe tot istoricul + **`npm audit --audit-level=high`**
  (cele 6 moderate = risk-acceptance MVP; high/critical blochează). Aliniază realitatea cu `SECURITATE.md` SEC-09/10/14.
- **PII verificare rol (SEC-05) închis pe HOLD:** `requestVerificationAction` neutralizat la nivel de server —
  păstrează gate-ul de auth dar NU mai citește/persistă dovada (PII fără retenție/review/limită). UI-ul era deja ascuns
  (`VerificationSection` = „nedisponibil"). Schela `requestRoleVerification` rămâne în service pentru re-activare.
- **Rate-limit fail-closed în producție:** `lib/rate-limit.ts` — lipsă env Upstash sau outage Redis ⇒ **blochează**
  cererile sensibile în prod (un control de securitate nu se dezactivează tăcut), **fail-open în dev/preview**. Escape
  hatch `RATE_LIMIT_FAIL_OPEN=true`. Audit `rate_limit_unavailable` la outage. `AuditSeverity` capătă `"error"`.
- **Rămase din audit (NU cod):** `trustHost` (bifă la poarta §11) · 6 deps moderate (risk-acceptance, deja pe latest,
  fix = downgrade major) · vezi handoff pentru detalii.

---

## 2026-06-29 — header auth aliniat la landing + fix hidratare toploader

### fix(ui) — header login/signup/verify-request aliniat la landing
- `auth-shell.tsx`: înălțime `h-16`→`h-[76px]`, logo `BrandLogo size={32}` (era 26). Containerul era deja comun
  (`--container-max` 1280px); fundal/bordură = aceiași tokeni. Dreapta = link discret „← Înapoi la site" (`/`)
  (decizie Liviu).

### fix(ux) — eliminat eroarea de hidratare a barei de progres
- `layout.tsx`: scos `nonce` de pe `NextTopLoader`. Browserul golește atributul `nonce` din DOM (anti-exfiltrare CSP)
  → server `nonce="..."` vs client `nonce=""` = mismatch de hidratare pe `<style>`-ul injectat. CSP-ul are deja
  `style-src 'unsafe-inline'` → stilul nprogress trece fără nonce. Zero regresie de securitate.

---

## 2026-06-29 — fix cover în sidebar feed + bară de progres la navigare

### fix(feed) — poza de cover în cardul de profil din sidebar
- `feed-sidebar.tsx` afișa doar un gradient — `SidebarProfile` n-avea `coverImage`. Adăugat `coverImage` +
  `coverPosition` în tip, randat `<img>` în bandă (fallback gradient), `object-position` din `coverPosition`.
- `usersRepo.getUserMedia` întoarce și `coverPosition`; `feed/page.tsx` ia media via `getUserMedia` și o pasează
  (folosește și `media.image` proaspăt din DB, fallback la `session.user.image`).

### feat(ux) — bară de progres la navigare (nextjs-toploader)
- `nextjs-toploader` în `layout.tsx` (culoare brand `#95492e`, 3px, fără spinner, `nonce` CSP). Feedback instant
  la fiecare navigare → maschează round-trip-ul de la layout-ul dinamic (nonce) + paginile grele (profil), care se
  percepea ca „blank / se încarcă greu" între feed ↔ profil/editare. NU re-introduce fade-ul `.dt-page` (scos azi).

---

## 2026-06-29 — CI rulează testele (vitest)

### ci — pas de test pe fiecare push/PR
- `.github/workflows/ci.yml`: adăugat pasul **Test** (`npm run test --if-present`) între Lint și Build → un PR cu
  teste roșii (unit/domain/securitate) nu mai trece. `vitest` e scopat la `{server,lib}/**/*.test.ts`, deci NU
  atinge `e2e/*.spec.ts`. E2E NU rulează în CI (cere preview live + bypass) — se rulează manual pe preview.

---

## 2026-06-29 — E2E: suită VERDE pe preview (15/15) + fix-uri selectoare

### test(e2e) — rulat pe preview, toate verzi
- 9 public + 6 authed = **15/15 verzi** pe preview-ul de `dev`. Fix-uri de selectoare descoperite la rulare:
  `CardTitle` e `<div>` (nu heading) → `getByText`; 404 testat sub prefix public (`/signup/...`, altfel poarta
  deny-by-default redirectează la `/login`); `getByRole('button',{name:'Aprob'})` prindea și „Dez**aprob**" → `exact:true`.
- **Drift DB prins de E2E:** `users.cover_position` lipsea pe ramura Neon `preview/dev` → reparat manual
  (`ALTER TABLE users ADD COLUMN IF NOT EXISTS cover_position integer NOT NULL DEFAULT 50;`). Cod neatins.
- Rulare necesită `VERCEL_AUTOMATION_BYPASS_SECRET` în `.env.e2e` (preview-urile = Deployment Protection); headerul
  `x-vercel-protection-bypass` e trimis automat din `playwright.config.ts`.

---

## 2026-06-29 — E2E Playwright: fluxuri authed (increment 2)

### test(e2e) — autentificare via sesiune seedată în DB + fluxuri authed
- `playwright.config.ts`: restructurat în 3 proiecte — `public` (anonim, fără DB), `setup` (`auth.setup.ts`),
  `authed` (`authed.spec.ts`, `dependencies: ['setup']`, `storageState` din setup).
- `e2e/auth.setup.ts`: seedează în DB-ul mediului-țintă user ACTIVE + rol (PROIECTANT/Arhitect) + rând în
  `sessions` + cookie de sesiune Auth.js (`__Secure-authjs.session-token` pe https, `authjs.session-token` pe http)
  → `storageState`. **ZERO cod de bypass în producție** (modelul de sesiune Auth.js, doar pre-populat). Seedează și
  un detaliu țintă (imageUrl pe host `*.public.blob.vercel-storage.com` ca next/image să nu dea 500); id în `seed.json`.
- `e2e/authed.spec.ts`: feed authed, profil propriu, **validarea pe roluri** (Aprob 1 click = upsert idempotent;
  Dezaprob cu justificare obligatorie → comentariu argumentat, serial), comentariu pe detaliu.
- `e2e/README.md`: actualizat (necesită `DATABASE_URL` al mediului-țintă în `.env.e2e`). Schița = TODO (canvas).

---

## 2026-06-29 — E2E Playwright: scaffold + fluxuri publice (increment 1)

### test(e2e) — fundație Playwright targetată pe mediu pornit (preview)
- `@playwright/test@^1.61.0` + scripturi `e2e` / `e2e:ui`. `playwright.config.ts`: `baseURL` din `E2E_BASE_URL`
  (din `.env.e2e`, negitat), **fără `webServer`** (rulează pe preview-ul deja pornit), chromium, anonim implicit.
- `e2e/public.spec.ts`: fluxuri PUBLICE fără auth — landing + CTA signup/login, formular `/login` și `/signup`
  (magic link), link-uri reciproce, `/verify-request` brandat, **poarta deny-by-default** (rută protejată ca
  anonim → `/login?callbackUrl=`), 404. NU trimite signup-ul (ar declanșa email real + rate limit).
- `e2e/README.md`: cum se rulează (`npx playwright install chromium`, `E2E_BASE_URL`, `npm run e2e`).
- `.gitignore`: `.env.e2e` (artefactele Playwright erau deja ignorate).
- **Următor increment:** fluxuri authed via sesiune seedată în DB (`globalSetup` inserează rând în `sessions` +
  cookie, fără cod de bypass în producție). `HUMAN_RUNS_TESTS` → Liviu rulează.

---

## 2026-06-29 — §11c igienă cod închisă (#1/#2/#3/#5)

### refactor(profile) — §11c #1: mutații prin profileService
- `server/services/profileService.ts`: adăugate mutațiile `setAvatar`/`setCover`/`removeAvatar`/`removeCover`/
  `setCoverPosition`/`updateProfileDetails` (validare + reprocesare imagine SEC-02 + cleanup blob SEC-06 + allowlist
  website SEC-03 + scriere DB). `app/(app)/profile/actions.ts` deleagă acum la service și rămâne subțire (extrage
  FormData → service → revalidatePath + mapare erori). Comportament identic, doar mutat stratul.

### chore(deps) — §11c #2: scos zod nefolosit
- `zod` (zero importuri în cod) eliminat din `package.json` + `package-lock.json`.

### fix(profile) — §11c #3: rol istoric corect în activity
- `server/repos/profileRepo.ts` (`listAuthorActivity`) aduce `roleSnapshot`; `profileService` afișează rolul de la
  momentul votului, cu fallback la rolul curent DOAR pentru validările vechi fără snapshot. Schimbarea rolului nu mai
  rescrie retroactiv istoricul propriu. (Afișarea poziţiilor pe detaliu folosea deja snapshot-ul.)

### fix(ux) — §11c #5: maxLength pe textareele de justificare/comentariu
- `maxLength={COMMENT_MAX_LENGTH}` (5000) pe textareele din `validation-panel`, `feed-validation-actions` și
  `comments-section` (creare + editare) → utilizatorul nu mai poate depăși limita server. Loading states existau deja.

---

## 2026-06-29 — fix UX flash/welcome + verify-request brandat + copyright feed + runbook §11

### fix(ux) — eliminat flash-ul „blank" la navigare + welcome o dată per dispozitiv
- `app/template.tsx` + `globals.css`: scos fade-ul `.dt-page` (opacity 0→1) care făcea conținutul să pornească
  invizibil pe fiecare navigare → se percepea ca „pagină blank, apoi apare".
- Șterse `app/loading.tsx` (generic root) + `app/login/loading.tsx` + `app/signup/loading.tsx`: pagini fără DB →
  Next ține pagina anterioară până e gata noua și schimbă direct, fără skeleton. Skeletoanele grele
  (feed/detaliu/profil) rămân. Cauza de fond: `layout.tsx` dinamic (nonce CSP) forța round-trip pe fiecare navigare.
- `intro-splash.tsx` + scriptul pre-paint din `layout.tsx`: `sessionStorage` → `localStorage` pentru
  `detalia_intro_seen` → welcome-ul apare o singură dată **per dispozitiv** (persistă peste refresh/tab/logout).
  (Reset la test: șterge cheia `detalia_intro_seen` din localStorage.)

### feat(auth) — ecran „verifică-ți email-ul" brandat
- `app/verify-request/page.tsx` (nou): înlocuiește pagina default Auth.js (întunecată, engleză) cu limbajul
  vizual DETALIA (`AuthShell` + card, copy română, iconiță `MailCheck`). Cablat în `lib/auth.ts`
  (`pages.verifyRequest`) + adăugat în `PUBLIC_PATHS` (`proxy.ts`, e pre-auth).

### feat(feed) — copyright în rail-ul feed-ului
- `components/feed-rail.tsx`: „© <an> Detalia.ro — Toate drepturile rezervate." ca ultim element din rail →
  în flow normal e împins în jos pe măsură ce apar containere noi (stil footer LinkedIn). An dinamic.

### docs(security) — §11 rescris ca runbook executabil
- `docs/SECURITATE.md §11`: lista de bullets → checklist pas-cu-pas (setup 3 conturi, payload-uri concrete,
  rezultat așteptat, bife) pe 10 secțiuni: IDOR/authz, cont suspendat, magic link & rate limit, upload, URL-uri,
  concurență, headers/CSP/cookie, infra/deps, verdict. Mapat la SEC-01..14. Nu schimbă codul.

---

## 2026-06-29 — erori silențioase (§11c #4)

### fix(security) — logging explicit pe căile înghițite + cleanup orfani observabil
- `lib/email.ts` (`sendEmail`): cele 3 căi tăcute (chei de mediu lipsă / Resend respinge / eroare rețea) acum
  loghează (fără PII — niciun destinatar/subiect). Rămâne best-effort (nu aruncă, notificarea in-app primează).
- `lib/image-processing.ts`: cele 5 `del(url).catch(()=>{})` (cleanup blob orfan) trec prin `delOrphan()` care
  loghează eșecul → orfanii nu mai dispar fără urmă (SEC-02). URL blob = cale random, nu PII.
- Restul catch-urilor (isHttpUrl, normalizeWebsite, parseStrokes, sharp, audit) = validare pură / best-effort
  intenționat → lăsate.

---

## 2026-06-29 — CSP întărit cu nonce (SEC-08 hardening)

### fix(security) — CSP nonce per request, fără `script-src 'unsafe-inline'`
- `lib/csp.ts` (nou): construiește headerul CSP cu `'nonce-${nonce}'` pe `script-src` (fără `'unsafe-inline'`).
- `proxy.ts`: generează nonce per request (`btoa(crypto.randomUUID())`), îl pune pe `x-nonce` + headerul CSP
  (request + response) → Next aplică nonce-ul pe scripturile lui; pattern oficial Next 16.
- `app/layout.tsx`: devine async, citește `x-nonce` (→ rendering dinamic, nonce mereu proaspăt) și îl pune pe
  scriptul inline de pre-paint.
- `next.config.ts`: CSP scos din headerele statice (rămâne în proxy); restul (HSTS/nosniff/etc.) neschimbat.
- **Excepție deliberată:** `style-src` păstrează `'unsafe-inline'` — `style={{}}` din React = atribute `style`,
  pe care un nonce nu le acoperă. Fără `strict-dynamic` (ar rupe toolbar-ul vercel.live pe preview).
- ⚠️ DE VERIFICAT în consola preview-ului că nimic nu e blocat (inclusiv vercel.live).

---

## 2026-06-29 — doc nou: evaluare MVP prod-readiness
- `docs/EVALUARE-MVP.md` (nou): ~88% prod-ready, note pe capitole (securitate 9, perf 8, scalabilitate 8.5, clean
  arch 9, testare 6.5, observabilitate 7, accesibilitate 5) + **pași concreți de îmbunătățire** pentru fiecare +
  ordinea recomandată cost/impact. Exclude din scor holds/blocante/intenționate.

---

## 2026-06-28 (noapte — eliminare completă logică invitații + SEC-12 închis)

### chore(security) — invitațiile ȘTERSE complet (cod mort)
- Șters: `server/services/invitationService.ts`, `server/repos/invitationsRepo.ts`, tabelul `invitations`
  (`db/schema.ts`), `INVITATION_TTL_HOURS` din `.env.example`. Nimic din app nu le importa (cod 100% mort).
- Resturi de schemă curățate: coloana `users.invited_by_id` + valoarea de enum `user_status` „INVITED"
  (niciodată atribuită — default e ACTIVE). Tipul TS din `types/next-auth.d.ts` aliniat.
- Migrații: `0004_drop_invitations.sql` (DROP TABLE) + `0005_cleanup_invitation_remnants.sql` (recreare enum fără
  INVITED + DROP COLUMN invited_by_id). **De aplicat manual pe ambele ramuri Neon** (vezi DEPLOY/handoff — DB-urile
  live au drift: enum `DELETED` + `cover_position` deja aplicate manual, deci rulează DOAR delta de invitații).
- **SEC-12 închis prin eliminare** (constatarea nu mai are obiect). Docs actualizate: SECURITATE, SCHEMA, CLAUDE.md,
  ADR, ARHITECTURA (banner istoric), EMAILURI (șters template invitație), PLAN-TESTE, CONFIDENTIALITATE-GDPR.

### docs(security) — audit suprafață de rute + refresh §5
- Reparcursă întreaga suprafață: **nicio rută neprotejată / API descoperit**. Public intenționat: `/`, `/login`,
  `/signup`, `/api/auth/*`, magic-link send (rate-limited). Tot restul (pagini `(app)`, `/onboarding`,
  `/api/blob/upload`, toate cele 10 fișiere de server actions) = proxy deny-by-default + check `auth()` propriu,
  userId din sesiune (anti-IDOR). `SECURITATE.md §5` rescris la starea reală (FAZA 1+2+3; BLOCKER-ele vechi închise).

---

## 2026-06-28 (noapte — SEC-13 + SEC-14: matcher proxy + audit trail)

### fix(security) — SEC-13: matcher proxy cu excluderi de asset explicite
- `proxy.ts` matcher: înlocuit `.*\..*` (orice cale cu punct) cu extensii statice EXPLICITE la finalul căii
  (`svg|png|jpg|jpeg|gif|webp|avif|ico|css|js|map|woff|woff2|ttf|otf` + `robots.txt`/`sitemap.xml`). O rută
  viitoare cu punct în segment nu mai scapă tăcut de poarta de auth. Comentariu: deny-by-default, rute publice
  DOAR în `PUBLIC_PATHS`.

### feat(security) — SEC-14: audit trail de securitate (fără PII brut)
- `lib/audit.ts` (nou, **edge-safe** — fără `node:crypto`): `audit(event, fields, severity)` emite o linie JSON
  structurată în Vercel Runtime Logs (decizie: rămânem pe logurile native Vercel). Best-effort (nu aruncă).
- Cablat **central**, fără a atinge call-site-urile:
  - `checkLimit` (`lib/rate-limit.ts`) → eveniment `rate_limited` la cotă depășită, cu numele bucket-ului
    (hartă inversă limiter→nume) + `idHash` (SHA-256 scurt al identificatorului — fără email/IP brut). Acoperă
    auth/mutație/upload/creare detaliu dintr-un singur loc.
  - `proxy.ts` → eveniment `access_denied_suspended` când un cont non-ACTIVE lovește o rută protejată (SEC-04).
- **Alertele rate/cost** se configurează în dashboard-urile Vercel Logs + Upstash pe baza acestor evenimente
  (operațional). Extensibil la suspendări/decizii admin când fluxurile apar.
- Teste: `lib/audit.test.ts` (structură, severity, best-effort la serializare eșuată). Type-check + lint verzi.

---

## 2026-06-28 (noapte — SEC-11: validare centralizată inputuri)

### fix(security) — UUID malformat nu mai dă 500; limite de lungime pe stringuri (FAZA 3, parțial)
- **Helper central `isUuid`** (`server/domain/ids.ts`, pur) — înlocuiește `UUID_RE` local din `detailService`.
  Un id extern malformat lovea coloane Postgres `uuid` → „invalid input syntax for type uuid" → 500.
- **Aplicat la fiecare graniță de serviciu** care primește un id de la client, întorcând codul de not-found/no-op
  existent (nu 500):
  - `validationService`: `targetExists` (gate pt approve/disapprove/comment), `retract` (no-op), `getMyPositions`
    (filtrează id-urile rele din feed), `getTargetValidationView` (vedere goală).
  - `commentService`: `editComment`/`deleteComment` → NOT_FOUND, `getComments` → [].
  - `sketchService`: `createDraft`, `saveStrokes`, `send`, `accept/reject`, `getDraftForEdit`,
    `getPublishedSketch`, `getPendingForOwner`, `deleteDraft`, `getTeanc`.
  - `detailService`: `getDetail`/`deleteDetail` (refolosesc helper-ul) + guard nou pe `categoryId` la `createDetail`.
- **Limite de lungime** în `validateDetailInput`: `climateZone`/`seismicZone` plafonate la `MAX_ZONE_LENGTH=64`;
  URL resursă ≤ `MAX_RESOURCE_URL_LENGTH=2048`; body TEXT ≤ `DESCRIPTION_MAX_LENGTH`.
- **Teste:** `server/domain/ids.test.ts` (nou) + extinse `detail.test.ts` (plafoane), `sketchService.test.ts` /
  `validationService.test.ts` (id malformat → not found, fără atingere DB). Type-check + lint verzi.

---

## 2026-06-28 (noapte — curățare date demo înainte de prod)

### chore — eliminat conținutul demo din seed
- `db/seed.ts` curățat: păstrează DOAR bootstrap-ul necesar pe orice mediu — (A) admin din `ADMIN_EMAILS`,
  (B) categoriile (idempotent pe slug). Eliminat tot blocul demo (useri/detalii/validări/comentarii/schițe +
  heatmap) și flag-ul `SEED_DEMO`. Seed-ul real de lansare se face prin conturi reale.
- Șters `public/seed/detail.svg` (imaginea demo a detaliilor seed). `lib/storage.ts` păstrează guard-ul care
  ignoră URL-uri `/seed/...` la ștergere din Blob (inofensiv, neatins).
- `db:seed` rămâne în `package.json` (necesar pe prod pt admin + categorii). DEPLOY.md actualizat (fără `SEED_DEMO`).

---

## 2026-06-28 (noapte — SEC-10: runner de teste + teste de securitate)

### test — Vitest + suită de securitate (FAZA 2 completă)
- Instalat `vitest` + `vite-tsconfig-paths` (dev). `vitest.config.ts`: env node, `include` `{server,lib}/**/*.test.ts`,
  alias `@/` din tsconfig. `npm test` rula deja `vitest run` (acum funcțional).
- **Teste pure (domeniu/lib):**
  - `server/domain/sketch.test.ts` — `validateStrokes`: EMPTY/TOO_MANY, culoare ne-hex, size invalid,
    **puncte ne-normalizate (0..1)**, prea multe puncte, kind necunoscut, reguli `text` (nevid, ≤ limită, trim).
  - `server/domain/validation.test.ts` — `validateJustification`/`validateCommentBody`: gol/whitespace → REQUIRED
    („nu există dezaprobare mută"), TOO_LONG, trim.
  - `server/domain/detail.test.ts` — `validateDetailInput` + `isHttpUrl`: titlu/imagine/categorie, >3 resurse,
    **allowlist URL la input** (blochează `javascript:`/`data:`/`file:`), TEXT cere body.
  - `lib/url.test.ts` — `normalizeWebsite` (SEC-03): gol→null, prefix https, blochează scheme periculoase.
  - `lib/upload-limits.test.ts` — `BLOB_URL_RE`: acceptă DOAR store-ul nostru Blob (anti-SSRF/URL arbitrar);
    respinge alt host, lookalike, http, scheme periculoase.
  - `lib/rate-limit.test.ts` — `hashEmail` (PII hash-uit, stabil) + `checkLimit` fail-open la limiter null.
- **Teste de serviciu (repo-uri mock-uite, fără DB):**
  - `server/services/sketchService.test.ts` — **IDOR**: doar autorul schiței o atinge cât e DRAFT (saveStrokes/
    getDraftForEdit/send → FORBIDDEN); doar autorul detaliului-mamă acceptă/respinge (autorul schiței/străin →
    FORBIDDEN). State machine (INVALID_STATE). **Atomicitate**: la `transitionFromDraft/Pending=false` (cursă
    pierdută) → INVALID_STATE și NU se notifică (fără email dublu); succes → notificare exact o dată.
  - `server/services/validationService.test.ts` — NO_ROLE fără rol; dezaprobare fără justificare →
    JUSTIFICATION_REQUIRED (fără scriere); dezaprobare nouă → poziție + comentariu o dată; re-dezaprobare → fără
    comentariu duplicat; approve = upsert APPROVE.
- Type-check + lint verzi. `HUMAN_RUNS_TESTS` activ → Liviu rulează `npm test`.

---

## 2026-06-28 (noapte — 2 fix-uri UI)

### fix — poza de profil/cover apărea doar după refresh
- La editarea „in place" din profil, clientul afișa `setUrl(uploaded)` = URL-ul **original**, dar serverul
  reprocesa imaginea (SEC-02), urca un blob NOU curat și **ștergea originalul** → preview-ul arăta un blob șters
  până la refresh. Acum `saveAvatarUrl`/`saveCoverUrl` întorc `url: processed.url`, iar `edit-profile-header.tsx`
  face `setUrl(res.url ?? uploaded)`. Securitate neschimbată (URL-ul întors e tot blob-ul validat + reprocesat).
  (Onboarding/detaliu nou nu erau afectate — fac redirect, se reîncarcă din DB.)

### fix — flash de „ecran gol" la intrarea pe login/signup din landing
- `app/loading.tsx` (Suspense root) se aplica și pe `/login`/`/signup` (dinamice via `searchParams`) → la navigare
  apărea câteva ms scheletul generic. Adăugat `app/login/loading.tsx` + `app/signup/loading.tsx` care randează
  ACELAȘI `AuthShell` ca paginile (header + panou + card cu zona de formular ca schelet) → tranziție imperceptibilă.

---

## 2026-06-28 (seară — fix-uri UI + feed rail)

### fix — CSP bloca uploadul de imagini (SEC-08 regresie)
- PUT-urile de upload client→Blob merg la `https://vercel.com/api/blob/...`, domeniu lipsă din `connect-src` →
  „Refused to connect", uploadul de poze (profil/cover/detaliu) pica. Adăugat `https://vercel.com` în `connect-src`
  (`next.config.ts`). Asta era „SEC-08 de verificat pe preview" din handoff.

### fix — imaginea cardului din feed creștea la Aprob/Dezaprob
- Thumbnail-ul avea `sm:aspect-auto` + `fill` → urma înălțimea cardului; când apare stiva de validatori cardul
  crește și imaginea se mărea. Acum aspect 4/3 fix + `sm:self-start` → rămâne 200×150 (`detail-card.tsx`).

### fix — buton „Schițează peste detaliu" duplicat în empty state
- În „Teancul de schițe", butonul din header apărea și în empty state lângă cel din centru. Header-ul apare acum
  doar când teancul are schițe (`sketch-section.tsx`).

### fix — notificarea rămânea necitită la clic pe ea
- Clicul pe o notificare doar naviga; doar „Marchează toate" o marca citită. Adăugat marcare per-notificare:
  `markOneRead` (repo, scoped pe recipient → fără IDOR) → `markNotificationRead` (service) → `markOneReadAction`
  (action) → handler optimist în `notification-bell.tsx` (scade badge-ul + scoate punctul, apoi `router.refresh()`).

### fix — footer scos de pe login/signup
- Eliminat footerul din `auth-shell.tsx` (afecta ambele pagini).

### feat(feed) — card „Schițe noi în teanc" în rail-ul din dreapta
- Ultimele 4 schițe PUBLISHED din toată platforma (thumbnail + titlu detaliu + autor cu rol și steluță dacă e
  verificat), link spre detaliul-mamă. `listRecentPublished` (repo) → `getRecentSketches` (service) → cablat în
  `feed/page.tsx` + `feed-rail.tsx`. Apare doar dacă există schițe publicate. („În dezbatere acum" + „Autori
  activi" existau deja în rail.)

### SEC-09 — Audit dependențe: risk-acceptance (FAZA 2 securitate)
- `npm audit` = 6 moderate, toate dev/build-time (esbuild via drizzle-kit; postcss bundle-uit în next), zero în
  runtime-ul livrat. Deja pe latest la ambele (drizzle-kit 0.31.10, next 16.2.9) → niciun upgrade nu rezolvă;
  `--force` = downgrade major inacceptabil. **Decizie: risk-acceptance, fără modificări** (vezi `SECURITATE.md §10`).

### SEC-06 — Cleanup blob la înlocuire avatar/cover (FAZA 2 securitate)
- La schimbarea pozei de profil/cover (`saveAvatarUrl`/`saveCoverUrl`), poza veche rămânea orfană în Blob. Acum
  citim URL-ul vechi și îl ștergem (best-effort) după ce salvăm noul, dacă diferă.
- Restul SEC-06 era deja acoperit: ștergere cont + strategie FK (anonimizare/tombstone păstrează rândul user →
  `details.authorId`/`sketches.authorId` rămân valide) + cleanup blob la ștergere (deleteAvatar/deleteCover/cont).
  *Export date (portabilitate GDPR) rămâne manual (cerere → admin).*

### SEC-07 — Tranziție atomică la SEND schiță (FAZA 2 securitate)
- Accept/reject erau deja atomice (`transitionFromPending`, guard `WHERE status='PENDING_ACCEPTANCE'`). Gap: **SEND**
  (DRAFT→PENDING) folosea un update necondiționat → două SEND-uri concurente notificau autorul-mamă de 2 ori (email dublu).
- Adăugat `transitionFromDraft` (guard atomic `WHERE id=? AND author_id=? AND status='DRAFT'`); `send()` notifică
  DOAR dacă tranziția a prins rândul → notificare idempotentă fără outbox. Al doilea SEND → `INVALID_STATE`, fără email.
- Curățat codul mort (`updateStatus`).

### SEC-08 — Security headers (FAZA 2 securitate)
- `next.config.ts headers()`: CSP + `X-Content-Type-Options: nosniff` + `Referrer-Policy` + `X-Frame-Options: DENY`
  + `Permissions-Policy` (camera/mic/geo/topics off) + HSTS (2 ani, subdomenii, preload), pe toate rutele.
- CSP: `default-src 'self'`, `object-src none`, `frame-ancestors none`, `base-uri/form-action self`. `script-src`
  cu `'unsafe-inline'` (script pre-paint intro + bootstrap Next; nonce = hardening ulterior). Permise: Vercel Blob
  (img + upload `connect-src`), toolbar `vercel.live` (preview). **De verificat în consola preview-ului** că nimic
  legit nu e blocat.

### Ștergere cont (GDPR „dreptul de a fi uitat") — anonimizare
- Buton „Șterge contul" în `/profile/edit` (confirmare în 2 pași + tastare „ȘTERGE"). Politică = **anonimizare
  (tombstone)**, confirmată de Liviu: ștergem PII din DB, păstrăm conținutul comunitar.
- Șterse: email (→ placeholder non-PII), nume real (firstName/lastName + `name`→„Utilizator șters"), avatar+cover
  (inclusiv blob-uri), website/headline/about/locație/emailVerified, **dovezile de rol** (`verificationEvidence`).
  Sesiuni + accounts șterse (logout). Status nou `DELETED` → re-login imposibil (SEC-04 îl blochează).
- Păstrate: detalii/schițe/comentarii/validări (atribuite „Utilizator șters") + rol main/sub (non-PII).
- Cod: `server/services/accountService.ts`, repo-uri `usersRepo`/`rolesRepo`, `deleteAccountAction`,
  `delete-account-section.tsx`. Enum `user_status` extins cu `DELETED` → **necesită `db:push`**.
- Doc GDPR actualizat (`docs/CONFIDENTIALITATE-GDPR.md §2`).

### SEC-04 — Blocare conturi suspendate (FAZA 1 securitate)
- `lib/auth.ts`: callback `signIn` refuză conturile cu `status ≠ ACTIVE` (se cheamă de 2 ori la email provider:
  la trimiterea magic link-ului ȘI la click → blocat în ambele; user nou n-are status → permis, devine ACTIVE).
  `pages.error = /login` → refuzul ajunge ca `?error=AccessDenied`.
- `status` expus pe sesiune (callback `session`) + augmentare tip `types/next-auth.d.ts`. Proxy-ul (strategie
  `database` → status proaspăt din DB la fiecare request) redirectează sesiunile non-ACTIVE de pe rutele protejate
  către `/login?error=AccessDenied` (acoperă și server actions, care lovesc rute protejate prin POST).
- Mesaj „cont suspendat" pe login + signup. *Nu există încă UI de suspendare; enforcement-ul e gata pt când se setează.*

### SEC-03 — Allowlist URL pe website (FAZA 1 securitate)
- Resursele detaliului erau deja validate la input (`isHttpUrl` = `new URL()` + allowlist http/https), iar
  website-ul era sanitizat la randare (`safeWebsite`). Gap rămas: `website` se stoca **brut** la input.
- Adăugat `lib/url.ts` (`normalizeWebsite`, pur): allowlist strict http/https la INPUT (defense-in-depth, nu
  doar la output). Schemă nepermisă (`javascript:`, `data:`, `file:`…) → respinsă, nu stocată.
- Cablat în `onboarding/actions.ts` și `profile/actions.ts` (înlocuiește vechiul prefix-regex care stoca gunoi).

### SEC-02 — Upload sigur: validare reală + re-encodare fără metadata (FAZA 1 securitate)
- Adăugat `lib/image-processing.ts` (sharp). Upload-ul rămâne client-direct în Blob (necesar pt fișiere mari),
  dar la **persistare** pe server: descărcăm blob-ul (doar din store-ul nostru → anti-SSRF) → `sharp.metadata()`
  validează formatul REAL din header (magic bytes, nu `file.type` client) → `limitInputPixels` ~50MP (anti-bombă
  decompresie) → `.rotate()` aplică EXIF orientation apoi **re-encodare** (sharp strip-uiește EXIF/GPS/ICC/XMP
  implicit) → plafon 4096px latura lungă → re-urcăm imaginea curată și **ștergem originalul**. Eșec → ștergem orfanul.
- Formate acceptate la ieșire: jpeg/png/webp/avif (svg/gif/heic/tiff respinse). Helper și pt bytes deja pe server
  (`processAndUploadImage`, folosit la thumbnail-ul de schiță).
- Cablat la toate punctele de persistare URL imagine: `details/new/actions.ts`, `profile/actions.ts`
  (avatar+cover), `onboarding/actions.ts` (avatar+cover), `lib/storage.ts` (thumbnail schiță).
- Dependență nouă: `sharp`.

### SEC-01 — Rate limiting distribuit (FAZA 1 securitate)
- Adăugat `lib/rate-limit.ts`: limitere sliding-window peste **Upstash Redis** (`@upstash/ratelimit` +
  `@upstash/redis`). Serverless n-are memorie partajată → store distribuit. **Fail-open**: dacă Redis lipsește
  (dev fără env) sau pică, cererea trece + se loghează (disponibilitate > enforce strict pentru MVP). PII (email)
  NU intră în Redis — hash SHA-256. IP din `x-forwarded-for`.
- Limite (centralizate, ușor de ajustat): magic link 5/h/email + 20/h/IP · mutații (validare/comentariu/
  send schiță/accept-reject/start sketch) 40/min/user · publicare detaliu 10/h/user · upload (token Blob) 30/h/user.
- Cablat în: `auth-actions.ts` (răspuns generic `RateLimited`, anti-enumerare), `validation-actions.ts`,
  `comment-actions.ts`, `sketch-actions.ts` (doar SEND, nu autosave), `sketch-review-actions.ts`,
  `details/new/actions.ts`, `api/blob/upload/route.ts` (429 `RATE_LIMITED`). Mesaj `RateLimited` adăugat pe login/signup.
- **Prerequisit prod/local:** integrarea Upstash for Redis pe proiectul Vercel pune `UPSTASH_REDIS_REST_URL`
  + `UPSTASH_REDIS_REST_TOKEN`. Local: copiate în `.env.local` (altfel limiter dezactivat = fail-open).

### Logo oficial de brand (SVG) în loc de rombul placeholder
- Adăugate variantele oficiale: `public/logo.svg` (fundal deschis, wordmark negru) și
  `public/logo-dark.svg` (fundal închis, wordmark alb), derivate din SVG-urile furnizate
  (`logowhite.svg` / `logodark.svg`): scos panoul/chenarul crem (artboard), strâns viewBox-ul pe conținut.
- Folosite ca fișier (`<img>`), nu reconstruite: `BrandLogo` (→ AppHeader + paginile de auth),
  header + footer landing (`app/page.tsx`), header onboarding. Footer/CTA dark folosesc varianta dark.
- `IntroSplash` păstrează deocamdată marca animată proprie — de aliniat separat dacă se dorește.
- **Al doilea logo pe login/signup** (deasupra cardului de formular, în `auth-shell.tsx`) era încă rombul
  vechi → înlocuit cu `/logo.svg`. Acum nu mai există niciun wordmark text+romb în `.tsx` (toate = SVG).
- **Dimensiune logo uniformizată la 26px** peste tot (header/footer landing, onboarding, `BrandLogo` default
  → app header + login/signup). Ulterior, header + footer landing crescute (vezi mai jos).
- **Header & footer landing — mărite**: header înălțime 64→76px, logo 26→32px, „Autentificare" 16px, buton
  „Creează cont" 15.5px/padding mai mare; footer padding vertical → 30px, logo 32px, tagline 16px, copyright
  13.5px + text „© {an} DETALIA — Toate drepturile rezervate."
- **Favicon**: `app/icon.svg` = simbolul „A" (din `icon.svg` furnizat), curățat de panou + viewBox pătrat pe
  simbol. Șters `app/favicon.ico` (default Next) ca SVG-ul să fie iconița. login/signup foloseau deja
  logo-ul nou via `AuthShell`→`BrandLogo`. Emailul (`lib/email.ts`) rămâne cu wordmark CSS (decizie: SVG
  nesuportat în clienți de email).
- **Organizare assets**: sursele de logo mutate din root în `public/brand/` (`logowhite.svg`, `logodark.svg`).
  Active rămân `public/logo.svg` + `public/logo-dark.svg` (căi neschimbate). `app/icon.svg` rămâne în `app/`
  (convenția de favicon Next — nu se mută).

### Fix: flash de landing înainte de intro-ul de brand
- La prima vizită, landing-ul clipea ~1s înainte să apară overlay-ul de welcome, fiindcă `IntroSplash`
  decidea afișarea abia într-un `useEffect` (după hidratare) → SSR picta landing-ul complet întâi.
- Fix fără flash în niciun sens: script inline sincron în `<body>` (`app/layout.tsx`) pune
  `html[data-intro="show"]` înainte de prima pictare (doar prima vizită din sesiune, fără reduced-motion);
  un `::before` CSS (fundal identic cu intro-ul) acoperă landing-ul până montează overlay-ul React.
  `IntroSplash` scoate atributul la dismiss → fade-ul dezvăluie landing-ul. Cei care au văzut deja /
  reduced-motion: scriptul nu pune atributul → landing direct.
- Adăugat `suppressHydrationWarning` pe `<html>` (`app/layout.tsx`) — scriptul pre-paint mută `data-intro`
  înainte de hidratare, deci atributul diferă de SSR; e mismatch-ul intenționat (ca next-themes), nu un bug.
- **Fix #2 (welcome nu mai apărea):** abordarea cu cover `::before` lăsa un ecran gol crem până monta overlay-ul
  React (în dev, lent → welcome-ul nu se vedea). Rescris: overlay-ul de intro se randează acum **din SSR**
  (e el însuși cover-ul, cu logo, din prima pictare). `IntroSplash` pornește în faza „show"; pentru cine l-a
  văzut deja / reduced-motion, scriptul pre-paint pune `html[data-intro="seen"]` → CSS îl ascunde instant
  (`.dt-intro { display:none }`) și efectul îl demontează. Fără flash de landing ȘI fără ecran gol.

### Profil edit: header editabil „in place" + verificare integrată în „Rolul tău"
- **Avatar + cover editabile direct din antet** — scoase cele două carduri separate „Poză de profil" și
  „Imagine de cover". Schimbi/ștergi imaginile din butoanele (cameră/coș) suprapuse pe avatar și pe banner.
  Componentă nouă `components/edit-profile-header.tsx` (combină cover repoziționabil + avatar + identitate).
  **Schimbare de UX:** upload direct la alegerea fișierului (fără pasul intermediar preview→Salvează), UI mai curat.
- **„Verificarea rolului" integrată în secțiunea „Rolul tău"** — nu mai e card separat; apare ca subsecțiune cu separator.
- **Cod mort curățat** — eliminate `ImageUploadForm`/`AvatarForm`/`CoverForm` din `profile-forms.tsx` și
  șters `components/edit-cover-band.tsx` (logica de repoziționare e acum în noul header).

### Profil: cover repoziționabil + ștergere imagini + curățare UI + text verificare
- **Cover repoziționabil sus/jos** — coloană nouă `users.cover_position` (int 0..100, default 50, **necesită `db:push`**).
  Slider în `/profile/edit` (preview live cu `object-position`), salvat prin `saveCoverPosition` (clamp pe server).
  Aplicat în banner-ul profilului + preview-ul din edit.
- **Ștergere imagini** — buton „Șterge" la avatar și cover (`deleteAvatar`/`deleteCover`): golesc coloana + șterg
  blob-ul best-effort. `updateUserImage`/`updateUserCoverImage` acceptă acum `null`.
- **Cover afișat în profil** — `ProfileView` randează imaginea de cover în banner (înainte era doar grilă decorativă;
  coverul se salva dar nu apărea). `coverImage` + `coverPosition` aduse în `getProfileView`.
- **Scos secțiunea „Cont" (deconectare) din `/profile/edit`** — redundantă; deconectarea există în meniul din header.
- **Text verificare rol explicit** — „Această funcție nu este încă disponibilă." atât în `/profile` cât și în `/profile/edit`.

### Fix: count-uri categorii „0" în feed
- La crearea unui detaliu lipsea `revalidatePath("/feed")` (spre deosebire de ștergere/validare) → feed cache-uit. Adăugat.
- În plus, `listCategoriesWithCounts` folosea un subquery corelat scris cu `sql` template care returna 0 chiar când
  existau detalii PUBLISHED (detaliul apărea în listă, dar count-ul rămânea 0 în același render). Rescris în forma
  canonică **LEFT JOIN + GROUP BY** (`count(details.id)`), care numără corect.

### Upload imagini profil rescris: client direct în Blob + UX Încarcă→preview→Salvează + limită 25MB
- **Root cause (de ce coverul „dădea verde" dar nu se salva):** avatar/cover urcau prin **server action** →
  limitat la **1MB** (default Next, `bodySizeLimit` nesetat) și **~4.5MB** (plafon funcții Vercel). Pozele reale
  (telefon) erau respinse de framework înainte de cod.
- **Fix:** upload **client direct în Vercel Blob** (`@vercel/blob/client.upload` → `/api/blob/upload` cu
  `handleUpload`). Ocolește ambele limite (până la 5TB). Securitate: `onBeforeGenerateToken` cere sesiune +
  restrânge tip (doar imagini) și mărime pe SERVER înainte de emiterea tokenului. URL-ul întors se persistă
  printr-un server action (`saveAvatarUrl`/`saveCoverUrl`) care acceptă DOAR URL-uri de Blob ale store-ului nostru.
- **UX nou (cerut):** buton „Încarcă" → **preview** al imaginii alese (sau cea curentă) → buton „Salvează".
  Componentă partajată `ImageUploadForm` (avatar = cerc, cover = bandă).
- **Limită ridicată 8MB → 25MB.** Constante mutate în `lib/upload-limits.ts` (client-safe, fără SDK Blob).
- **Revalidare:** acțiunile revalidează acum și `/profile/edit` (înainte doar `/profile` → preview-ul de pe
  pagina de edit nu se reîmprospăta).
- ✅ **Restanță rezolvată (același flux):** upload-ul de avatar/cover la **onboarding** și **imaginea de detaliu**
  (`details/new`) migrate și ele la client upload (helper comun `lib/blob-upload.ts`). Forma de detaliu/onboarding
  urcă imaginea în Blob înainte de submit, apoi trimit doar URL-ul (validat `BLOB_URL_RE` pe server). Cod mort
  curățat din `lib/storage.ts` (`uploadDetailImage`/`uploadAvatarImage`/`uploadCoverImage`/`validateImageFile`).

### Fix buclă onboarding⇄feed + tool text revine la creion + ștergere detaliu de către autor
- **Buclă de loading onboarding⇄feed (prod):** user nou (fără rol) după magic link rămânea în buclă infinită
  de loading. Cauză: `redirect("/onboarding")` din `app/(app)/layout.tsx` se producea în timpul streaming-ului
  RSC → Next emite meta-refresh → buclă de reîncărcare (exact clasa de bug documentată deja în `proxy.ts`,
  rezolvată acolo pentru landing). **Fix:** poarta de onboarding mutată din layout în `proxy.ts` ca redirect
  307 curat (logat fără rol → `/onboarding`; logat cu rol pe `/onboarding` → `/feed`). Layout simplificat,
  fără redirect. (NU era Turbopack — prod rulează webpack.)
- **Tool de text (schiță):** după ce scrii un comentariu și confirmi (Enter / click în afară), tool-ul se
  **deselectează** (mouse neutru — `tool = null`, canvas-ul nu mai desenează), nu trece pe creion. Înainte rămânea
  pe „text" și deschidea o casetă la fiecare click. Pentru alt comentariu se reselectează Text.
  (`components/sketch/sketch-canvas.tsx`.)
- **Ștergere detaliu de către autor:** buton „Șterge" pe pagina detaliului, vizibil DOAR autorului. Authz pe
  server (ownership în `detailService.deleteDetail`; FORBIDDEN/NOT_FOUND fără a dezvălui existența). Ștergere
  atomică prin `db.batch`: resurse+schițe cad în cascadă (FK), validările/comentariile polimorfice (detaliu +
  schițele lui) curățate manual. Blob-uri (imagine detaliu + thumbnail schițe) șterse best-effort. Notificările
  (referă prin payload, fără FK) rămân — link stale minor.

### Fix gating onboarding + separare dev/prod DB (date demo în prod)
- **Bug grav:** user logat fără rol intra direct în feed ca „anonim". Cauză: `app/(app)/layout.tsx` nu verifica rolul.
  Fix: layout async → logat fără rol → redirect `/onboarding` (un singur loc, acoperă toată zona autentificată).
- **Date demo în prod:** local și prod foloseau aceeași ramură Neon → `db:seed` local scria demo în producție.
  Remediere: (1) golit prod via Neon SQL Editor pe ramura `production` (păstrat `categories`); (2) ramură Neon nouă
  `dev-local` (persistentă), `.env.local` re-creat să arate spre ea, nu spre prod; (3) barieră `SEED_DEMO=true` în
  `db/seed.ts` — demo se seamănă doar cu opt-in explicit. Separarea documentată în `DEPLOY.md §2b`.

## 2026-06-27

### SECURITATE §10 — plan de implementare pe faze + gitignore docs
`SECURITATE.md §10` rescris ca **plan ordonat pe 4 faze** acoperind TOATE constatările (SEC-01..14 + §11c), în ordinea
de făcut: Faza 1 blocante (rate limit, upload, URL allowlist, conturi suspendate) → Faza 2 production-ready (teste,
atomicitate, ștergere date, headers, deps, PII rol) → Faza 3 hardening → Faza 4 igienă cod/UX.
`.gitignore`: adăugat `docs/_archive/` + untracked `documente_client/` (documente client, nu se comit).

### Consolidare audituri într-un singur document
Cele 3 documente de audit (`SECURITATE.md`, `opencode.md`, `audit.md`) aveau suprapunere mare. Consolidate în
**`SECURITATE.md`** (canonicul — cel mai riguros, se autodeclară „singurul doc de securitate"): adăugată §11b cu
constatările non-securitate unice (profile actions ocolesc service, `zod` nefolosit, snapshot rol ignorat la afișare)
+ lista constatărilor deja rezolvate. `opencode.md` și `audit.md` **arhivate** în `docs/_archive/` cu banner.

### Curățenie documentație (handoff #6)
Aliniere docs la deciziile confirmate de Edi (acces PUBLIC, upload deschis, Server Actions, rute reale).
- **Arhivate** în `docs/_archive/` (cu banner „NU mai e sursă activă"): `API.md` (ficțiune REST — appul folosește Server Actions), `plan nontehnic.md` (invite/seed-only + feature livrate ca „urmează"), `UX-ECRANE.md` (rute greșite).
- **Șters** `PLAN-EXECUTIE.md` — tot ce conținea e implementat (în CHANGELOG) sau restanță trecută în handoff (Faza 2: accesibilitate + audit securitate).
- **Actualizate țintit:** `ADR.md` (008→acces public, 009→upload deschis), `ARHITECTURA.md` (banner decizii suprascrise + §0/§13), `SCHEMA.md` (scos „pre-scaffold", adăugate câmpurile de profil reale din `db/schema.ts`), `CONFIDENTIALITATE-GDPR.md` (risc public de la lansare), `EMAILURI.md` (invitație dormantă), `PLAN-SEED.md` (50–100 detalii, upload deschis), `PLAN-TESTE.md` (0 teste/Vitest neinstalat, upload deschis, E2E verificare rol pe HOLD).
- Rămân surse active: `SECURITATE.md`, `CHANGELOG.md`, `DEPLOY.md`, `audit.md` (dated, încă util).
- **`docs/DECIZII-EDI.md` nou** — toate deciziile care depind de Edi într-un singur loc, în limbaj simplu (acum/mai târziu). Scoase din restul docurilor (ARHITECTURA „Încă deschise", GDPR, PLAN-SEED) → trimitere la el. PLAN-SEED rescris simplu, fără jargon.

### `docs/DEPLOY.md` — ghid de deploy + DNS
Document operațional nou: servicii third-party (Vercel/Neon/Blob/Resend/Google Workspace/Hostico/Cloudflare), stare actuală, și pașii rămași în ordine — migrare DNS pe Cloudflare, records Google Workspace (`support@detalia.ro`), records Resend pe `send.detalia.ro` (deblochează login real), legare opțională domeniu de Vercel. Include capcanele SPF (un singur record) + proxy Cloudflare (DNS only pe mail/verificare/Vercel).

### Pagina de detaliu — scos sidebar-ul dreapta, lățit conținutul
Eliminat sidebar-ul (carduri autor + „Despre detaliu" = redundante, info deja în antet; + „Regula de aur"). Pagina e acum o singură coloană lățită. „Detalii înrudite" mutat într-o secțiune **full-width** la baza paginii (grid responsive 1/2/3 coloane). `app/(app)/details/[id]/page.tsx` (scos `MetaRow` + importul `MapPin`).

### Deploy live pe Vercel (Neon branching + Blob)
Proiectul e deployat pe Vercel: `main` = producție, `dev`/PR = preview. Integrarea nativă **Neon ↔ Vercel** face branching automat (prod = ramura principală, fiecare preview = ramură Neon efemeră) și injectează `DATABASE_URL`. **Vercel Blob** injectează automat `BLOB_READ_WRITE_TOKEN`. `AUTH_URL` = URL-ul `.vercel.app` (domeniul `detalia.ro` încă nelegat), `AUTH_TRUST_HOST=true`. **Resend încă nesetat** → login real (magic-link) blocat pe prod până la `AUTH_RESEND_KEY` + `EMAIL_FROM`. Schimbările de env vars cer redeploy.

### Șters dev-login (bypass auth) — re-adăugat din greșeală
`app/dev/login/` (page + `devLoginAction`) re-apăruse prin commit `fac1249`. Eliminat din nou: folderul `app/dev/` șters, poarta publică `/dev` scoasă din `proxy.ts`, și **2 sesiuni reziduale** create de dev-login șterse din tabelul `sessions` (Neon). Login-ul rămâne doar magic-link real. (Eroarea tsc din `.next/dev/types/validator.ts` e generată, se regenerează la următorul dev/build.)

### Fix buclă de reload în Firefox (dev pe webpack)
La prima `npm run dev`, Firefox reîncărca `/feed` la infinit (Chrome nu). Cauză: HMR-ul Turbopack (default în Next 16) la compilare la rece — Firefox anulează chunk-urile lente (`NS_BINDING_ABORTED`) → Turbopack face full-reload → buclă. Diagnoza: Network arăta `/feed` 200 (nu redirect) + scripturi `[turbopack]_hmr-client` anulate. Fix: `dev` opt-out de Turbopack (`next dev --webpack`). `build`/`start` rămân pe Turbopack. `package.json`.

### Redirect authed `/` → `/feed`
User logat care intră pe landing e dus direct în feed; ramurile authed din landing au fost scoase (cod mort). `app/page.tsx`.

### Aliniere header între pagini
`scrollbar-gutter: stable` global pe `html` (`globals.css`) — gata diferența de centrare între paginile cu/fără scrollbar.

### Stivă de avatare validatori pe cardul de feed
Subquery `validatorAvatars` în `detailsRepo.listFeed` (max 5 validatori recenți) + componenta `ValidatorStack` în `detail-card.tsx` (cercuri suprapuse + „+N").

### Coloană `about` în profil
Schemă + migrația `0003` + repo (`getUserProfile`/`updateUserDetails`/`getPublicProfile`) + `Textarea` „Despre" în edit form + afișare în `ProfileView`. Aplicată în DB direct (migrate e rupt pe Neon HTTP → `db:push`/SQL).

### Constraint `validations_user_target_unique`
Adăugat în DB (lipsea) — regula „o poziție per user per țintă" e acum enforce la nivel de bază de date.

### Șters bypass-ul de acces dev
`app/dev/` (dev-login + preview + mock) ȘTERS, poarta `/dev` scoasă din `proxy.ts`, sesiunile din DB șterse. Login-ul rămâne doar magic-link real.

### Cardurile de schiță din profil linkează spre detaliul-mamă
Tab-ul Schițe: cardurile (înainte non-navigabile) duc acum la `/details/[detailId]`. `detailId` propagat prin `ProfileSketchItem` + `profileService`.

### Comentarii — editare și ștergere
Autorul își poate **edita** comentariile (inline) și **șterge** comentariile libere. Justificările de dezaprobare (`originValidationId`) NU se pot șterge (ar deveni „dezaprobare mută" — regulă de business), doar edita. Ownership enforce pe server (condiție `authorId` în repo, fără IDOR). Nou: `updateCommentByAuthor`/`deleteFreeCommentByAuthor` (repo) · `editComment`/`deleteComment` (service) · `editCommentAction`/`deleteCommentAction` (actions) · `CommentItem` cu edit inline (`comments-section.tsx`).

### Editor schiță — text manipulabil (mutare/rotire/mărime)
Textul plasat poate fi selectat (click cu unealta Text) și transformat: **mutare** prin drag, **rotire** ±15° și **mărime** ±, plus editare conținut și ștergere — printr-o bară flotantă ancorată la text + contur de selecție. Câmp nou `angle` (radiani) pe `Stroke` (validat în domain, randat rotit în `sketch-render.ts`). `sketch-canvas.tsx`.

---

## 2026-06-25 (datorie vie #4 — validare pe SKETCH, fix copy)

### Validare/comentarii pe schiță — confirmarea poziției urmează ținta
`typecheck` VERDE. (Verificarea vizuală o face Liviu.)
- **Constatare:** datoria „validare pe SKETCH" era deja implementată end-to-end în cod (service `targetExists`
  → schițe PUBLISHED; `page.tsx` aduce `getTargetValidationView("SKETCH")` + `getComments("SKETCH")` per schiță;
  `readTarget` acceptă SKETCH; `SketchSection` randează `ValidationPanel`/`CommentsSection` cu `targetType="SKETCH"`).
  Handoff-ul era depășit pe acest punct.
- **Singurul defect viu — copy:** mesajul de confirmare din `validation-panel.tsx` era hardcodat „acest detaliu",
  deci pe o schiță apărea „Ai dezaprobat acest detaliu." (greșit). Fix: `targetNoun` derivat din `targetType`
  („această schiță" / „acest detaliu") → confirmarea urmează ținta.

---

## 2026-06-24 (editare profil completă + rol DEFINITIV)

### Câmpuri lipsă în editare profil (#5) + rol blocat după alegere (#6)
`typecheck` + `lint` + `build` VERZI. (Verificarea vizuală o face Liviu.)
- **#5 — editare profil completă:** `/profile/edit` n-avea câmpuri pentru nume/headline/locație/website (apăreau pe profil
  dar nu se puteau seta), iar `getUserProfile` nici nu le aducea. Adăugat: `getUserProfile` întoarce acum
  `headline/location/website`; `updateUserDetails` (repo, doar câmpuri text, NU atinge rolul); `updateProfileDetailsAction`
  (nume obligatoriu, restul opțional → null, website fără schemă → `https://` prefixat); `EditDetailsForm` (nume, headline,
  locație, website) într-o secțiune nouă „Detalii profil" pe `/profile/edit`.
- **#6 — rol DEFINITIV (decizie Edi/Liviu):** rolul se alege o singură dată la onboarding și **nu se mai schimbă din UI**
  (stabilește credibilitatea). Scos `EditRoleForm` + `updateRoleAction` + `ROLE_ERRORS` din profil; secțiunea „Rolul tău"
  devine read-only (pill cu rol + steluță) + nota: schimbarea se cere prin email la `support@detalia.ro` (mailto cu
  subiect/motiv) — fără UI admin în MVP. Onboarding-ul deja bloca re-intrarea celor cu rol (`userHasRole → /feed`).
  `updateRole` rămâne în `roleService` dar **necablat** (fără cale din UI). **TODO:** adresa `support@detalia.ro` e
  placeholder — de înlocuit cu adresa reală.

## 2026-06-24 (follow-up-uri mărunte: detalii înrudite + search + rol în notificări)

### Detalii înrudite (sidebar) · căutare în header · rolul actorului în notificări
Trei follow-up-uri din handoff. `typecheck` + `lint` + `build` VERZI; verificat vizual (Playwright, logat ca Andrei).
- **Detalii înrudite**: `detailsRepo.listRelatedDetails` (aceeași categorie, PUBLISHED, exclus self, sortat după
  interacțiuni) + `detailService.getRelatedDetails` + card nou în sidebar-ul paginii de detaliu (titlu + autor/rol +
  contoare). Ascuns dacă nu există înrudite. Confirmat: arată detaliile din aceeași categorie.
- **Căutare simplă în AppHeader**: form GET nativ (merge fără JS) → `/feed?q=`. `listFeed` ia `q` → filtru `title ILIKE`
  (cu escape pe `%_\`). Feed: heading „Rezultate pentru …", `q` păstrat în linkurile de sortare, empty state pe „filtrat".
  Confirmat vizual.
- **Rolul actorului în notificări**: `usersRepo.getNotificationActor` (nume + rol + verificare); `notifySketchProposed`
  stochează `sketchAuthorRole`/`sketchAuthorVerified` în payload; clopoțelul afișează `RolePill` lângă nume la „a propus
  o modificare". Notificările vechi (fără rol în payload) rămân valide — pill-ul apare doar când există rolul (graceful).

## 2026-06-24 (fix clopoțel notificări — `<a>` imbricat)

### Hydration error în dropdown-ul de notificări — REZOLVAT
La deschiderea clopoțelului: 2 erori în consolă (`<a>` nu poate fi descendent de `<a>`). Rândul de notificare e
împachetat într-un `<Link>`, iar înăuntru titlul (`NotificationText`) ȘI butonul „Vizualizează & acceptă" erau tot
`<Link>` → ancore imbricate (HTML invalid → hydration error). Cauza găsită prin reproducere în browser (Playwright +
`/dev/login` ca Andrei), nu ghicită. Toate trei duceau la același `n.href` → titlul + CTA devin `span` (vizual identice),
rândul-Link rămâne singura navigare. `typecheck` + `lint` + `build` VERZI; verificat: 0 erori în consolă.

## 2026-06-24 (editor schiță — fix-uri audit Liviu + forme noi)

### Grilă pe foaie, zoom, riglă, radieră corectă, text-casetă + circle/square/arrow
Run de fix-uri pe editorul de schiță (feedback Liviu, verificat vizual cu Playwright pe `/dev/preview/sketch`).
`typecheck` + `lint` + `build` VERZI.
- **Bug text tool (nu apărea caseta) — REZOLVAT:** click-ul real pe canvas (`mousedown`) muta focusul pe `body` →
  textarea-ul abia deschis lua `onBlur` → `commitText` gol → se închidea instant. Fix: `onMouseDown preventDefault`
  pe canvas (desenul merge pe pointer events, neafectat). Cauza găsită prin reproducere în browser, nu ghicită.
- **#3 Text = etichetă curată** cu **halou alb** subțire (stil adnotare plan/CAD), în culoarea aleasă — FĂRĂ casetă/
  bordură (varianta cu casetă albă+bordură arăta lipită peste desen). Input flotant fără box (fundal-hârtie subtil doar
  la editare). Plasare prin click → scrii → Enter fixează.
- **#1 Grila** mutată de pe fundalul zonei pe **foaie** (desenată în canvas la `redraw`, deci NU intră în thumbnail).
- **#2 Zoom** 40–300%: controale −/100%/＋ (jos-dreapta) + **Ctrl/Cmd + rotiță** (listener non-passive). Transform pe
  wrapper; `normPoint` rămâne corect (folosește `getBoundingClientRect`, care include scalarea).
- **#4 Radieră — hit-test geometric** (distanță punct→segment per formă): prinde acum și liniile/formele (înainte
  verifica doar punctele, deci rata muchiile). Un singur pas de undo per tragere (batching în `eraseRef`).
- **#5 Riglă**: benzi cu ticks (la 26px = pasul grilei) pe marginile de sus și stânga ale foii, scalate cu zoom.
- **#6 Forme noi**: `rect` / `ellipse` / `arrow` (dreptunghi/cerc/săgeată cu vârf) — kind-uri în `Stroke`, validate pe
  server, randate în `lib/sketch-render.ts`; rail reorganizat în grilă 2 coloane (6 unelte).
- **Fix preview**: `sketch-preview-client` arăta `/preview/detail.svg` (404) → `/seed/detail.svg`. Robustețe: dacă
  imaginea-mamă nu se încarcă, editorul rămânea gol (dims 0) — de monitorizat pe editorul real.

## 2026-06-24 (#9 unelte schiță — line + text + paletă pe brand)

### Line tool, text tool și paletă aliniată la brand
Ultimul punct din auditul vizual Liviu (#9). Schița avea doar freehand + culori + grosimi + radieră → adăugate
**linie dreaptă** și **casetă de text**, plus **paletă de brand**. `typecheck` + `lint` + `build` VERZI.
- **`server/domain/sketch.ts`**: `Stroke.kind?: "free" | "line" | "text"` (opțional → stroke-urile vechi rămân „free");
  `text?: string` (doar pt kind text, validat: nevid, ≤ `MAX_TEXT_LENGTH` 200). `STROKE_KINDS` + validare server extinsă.
- **Paletă nouă** `STROKE_COLORS` = grafit `#211d18` + cărămiziu `#b0463c` + chihlimbar `#d97a1e` + ocru `#caa12e` +
  verde `#2f8f5f` + albastru `#2f6fb0` — stridente dar calde (brand), grafitul ca default pt adnotare tehnică.
- **`lib/sketch-render.ts`**: randare `kind: "line"` (segment drept, cap rotund) și `kind: "text"` (fillText multi-rând,
  baseline top, font scalat cu `TEXT_FONT_SCALE`). Partajat → liniile/textul apar identic în editor, teanc și thumbnail.
- **`components/sketch/sketch-canvas.tsx`**: `eraser` boolean → unealtă unică `tool: pen | line | text | eraser` cu selector
  în rail (Creion/Linie/Text). Linie = drag A→B cu preview live. Text = **click → input flotant** (textarea ancorată la
  poziția normalizată, font identic cu randarea, auto-grow, Enter fixează / Esc anulează / blur fixează).

## 2026-06-24 (Faza 2 #3 — stări loading/error/not-found)

### Schelete de încărcare + error boundaries + pagină 404
Punctul 3 din Faza 2 (`PLAN-EXECUTIE.md`): stările empty/loading/error „peste tot". **Empty states existau deja**
(feed, notificări, ciorne, comentarii) → completat ce lipsea: **loading** (fișiere `loading.tsx`) și **error/404**.
`typecheck` + `lint` VERZI. **Accesibilitatea minimă rămâne pe later** (decizie Liviu — vezi handoff).
- **`components/ui/skeleton.tsx`** (nou): primitivă `Skeleton` (puls discret, `bg-muted`, `aria-hidden`).
- **`app/loading.tsx`** (nou): fallback generic Suspense pentru rutele fără schelet dedicat.
- **`app/feed/loading.tsx`** · **`app/details/[id]/loading.tsx`** · **`app/profile/loading.tsx`** (noi): schelete pe
  forma reală a paginii (feed = grilă 3 coloane · detaliu = antet+imagine+validare+sidebar · profil = cover+avatar+stats).
  `loading.tsx` din `profile/` acoperă și `/profile/[userId]` + `/profile/edit` (segmente copil).
- **`app/error.tsx`** (nou): error boundary sub AppHeader — „Încearcă din nou" (`reset`) + „Mergi la feed". Log fără PII (digest/mesaj).
- **`app/global-error.tsx`** (nou): plasă pentru erorile din root layout (randează propriul `<html>/<body>`, stiluri inline).
- **`app/not-found.tsx`** (nou): pagina 404 pe brand — `notFound()` din pagina detaliu o folosește acum.

## 2026-06-24 (audit vizual Liviu — fix-uri + UX, val 1+2)

### Fix-uri bug + îmbunătățiri UX din verificarea vizuală
`typecheck` + `lint` + `build` VERZI. Pe puncte (numerotare din feedback-ul lui Liviu):
- **#8 (bug 500 upload poză):** `"use server"` nu poate exporta un obiect → mutat `initialProfileState` din `profile/actions.ts` în `profile-forms.tsx`.
- **#10/#13 (bug 500 Blob):** `lib/storage.ts` — `put()` în try/catch → întoarce `{ok:false, error:"UPLOAD_FAILED"}` în loc să arunce (fără 500).
  Send schiță merge fără thumbnail; creare detaliu dă eroare curată. **Cauza reală = store Blob PRIVAT** (config Vercel): trebuie un store PUBLIC.
- **#1 (feed):** Aprob/Dezaprob activ = **fill solid** (verde/roșu plin) home; Dezaprob deschide un **modal** (overlay) — nu mai mărește cardul.
- **#3:** „Detalii recente" → **„Detalii în dezbatere"**.
- **#4:** sortare **funcțională** (dropdown 2 opțiuni: „În dezbatere" după interacțiuni / „Recente" după dată) — `getFeed/listFeed` iau `sort`, param `?sort=`.
- **#11:** rail dreapta „Categorii populare" (redundant cu sidebar-ul) → **„Autori activi"** (top după detalii publicate, link la profilul public). Repo `listTopAuthors`.
- **#5:** avatar din header → **dropdown** (`UserMenu`): Vizualizare profil · Editează profil · **Deconectare** (reală, `signOut`).
- **#6:** **upload cover** adăugat (`updateCoverAction` + `CoverForm`).
- **#7:** `/profile/edit` **redesenat** — antet cu cover+avatar (preview live) + grid de carduri (mai puțin spațiu mort).
- **#12:** buton **ștergere ciornă** pe `/sketches/drafts` (`deleteDraftAction` → delete condiționat: doar autorul, doar DRAFT).
- **#2 (categorii count 0):** verificat — logica e corectă (subquery identic cu contoarele de pe detaliu); artefact de cache/timing pre-seed.

**Rămas din audit:** #9 unelte schiță (line/text tool + paletă aliniată la brand) — separat.

## 2026-06-24 (dev-login + seed — verificare vizuală localhost) 🔴 DE ȘTERS LA PROD

### Dev-login gated + seed de conținut demo
Infrastructură DOAR pentru verificare vizuală pe localhost (login + seed lipseau → paginile reale nevăzute cu DB).
**Gated dur la non-producție; DE ȘTERS înainte de prod** (reminder în `.remember/remember.md`). `typecheck` + `lint` + `build` VERZI.
- **`app/dev/login/`** (nou): pagină gated (`notFound` în prod) care listează userii și te loghează fără email. Cu sesiune `database`,
  „login" = inserăm rând în `sessions` + setăm cookie-ul Auth.js (`authjs.session-token` / `__Secure-` după AUTH_URL). `/dev` e deja public pe non-prod în `proxy.ts`.
- **`db/seed.ts`** extins: păstrează seedarea admin (ADMIN_EMAILS), adaugă **conținut demo idempotent** — 6 categorii, 4 useri cu roluri
  diferite (Andrei PROIECTANT verificat · Ioana · Mihai EXECUTANT verificat · Elena FURNIZOR), 9 detalii distribuite pe categorii,
  15 validări (cu dezaprobări→comentariu), ~18 comentarii Andrei împrăștiate pe an (densitate heatmap), 3 schițe (PUBLISHED/PENDING/DRAFT).
  Guard: dacă Andrei are deja detalii → skip. PII fără log (hook `block-pii-log`).
- **`public/seed/detail.svg`** (nou): placeholder blueprint local pentru `imageUrl` (next/image servește local fără remotePatterns).

## 2026-06-24 (epic Profil pe date reale — Faza 2: heatmap contribuții)

### Grafic de contribuții stil GitHub (heatmap „ultimul an")
Heatmap de contribuții pe profil, **derivat din aceleași timestamp-uri** (validări date + comentarii + detalii publicate + schițe trimise),
fără tabel de evenimente. `typecheck` + `lint` + `build` VERZI. **Neverificat vizual cu DB.**
- **`profileRepo.getContributionCounts(userId, since)`** (nou): 4 query-uri grupate pe zi (UTC, `to_char ... at time zone 'UTC'`),
  fuzionate într-un `Map<zi, număr>`. Helper `dayUtc(col)`.
- **`profileService`**: fereastră ~53 săptămâni aliniată la **Luni** (UTC), generează zilele cu `level` 0..4 (buckete 0 / 1-2 / 3-5 / 6-9 / 10+) +
  `contributionsTotal`. Adăugate în `ProfileViewData` (`contributions`, `contributionsTotal`).
- **`components/contribution-graph.tsx`** (nou): grilă săptămâni × 7 zile, scală verde, etichete lună/zi RO, legendă „Mai puțin→Mai mult",
  tooltip per zi. Randat în `ProfileView` sub bara de stats. Mock în `/dev/preview/profile`.
- Note lint react-compiler: etichete lună fără variabilă mutabilă în closure; mock fără `Date.now` (bază fixă `Date.UTC`).

**Rămas (din epic):** schema `bio/about/specializări` (decizie de produs); linkuri pe cardurile din tab-ul Schițe.

## 2026-06-24 (epic Profil pe date reale — Faza 1)

### Profil pe date REALE — ProfileView alimentat din DB + restructurare rute
Epicul „PROFIL pe date reale" (faza 1). Stats + activitate **derivate din tabelele existente** (validations/comments/details/sketches au
`created_at`) — **fără tabel de evenimente nou** (zero dual-write/backfill). `typecheck` + `lint` + `build` VERZI. **Neverificat vizual cu DB.**
- **`server/repos/profileRepo.ts`** (nou): `getProfileStats` (publicate / schițe propuse / validări date / validări primite — ultima pe ținte
  deținute de user, via `inArray` pe subquery), `listAuthorDetails` (cu contoare validări/schițe), `listAuthorSketches` (non-DRAFT, cu titlul
  detaliului-mamă), `listAuthorActivity` (validări + comentarii + publicări; titlul țintei polimorfice rezolvat prin join, SKETCH→detaliul-mamă cu `alias`).
- **`server/services/profileService.ts`** (nou): `getProfileView(userId, viewerId)` → `ProfileViewData`. Mapează statusuri schiță
  (PUBLISHED→„În teanc"/approved, REJECTED→„Respinsă"/disputed, PENDING_ACCEPTANCE→„În așteptare"/open), fuzionează activitatea (recent→vechi,
  sare peste comentariile-justificare ca să nu dubleze dezaprobarea), timp relativ RO, website sanitizat (allowlist http/https).
- **`ProfileView`** ajustat: `viewerIsOwner` (ascunde „Editează profil" pe profil public) în loc de `verifyHref`; **scoase CTA-urile „Verifică rolul"**
  (header/nudge/aside) — consecvent cu HOLD-ul de la verificarea rolului; **website** afișat în header; carduri Detalii **navigabile** (→ `/details/[id]`);
  **stări goale** pe cele 3 taburi; copy activitate generic (nu mai zice „o schiță" pentru validări pe detalii).
- **Restructurare rute:** `/profile` = **vizualizarea** proprie (ProfileView); **`/profile/edit`** (nou) = setările (mutate din `/profile`);
  **`/profile/[userId]`** = aceeași ProfileView read-only (înlocuiește pagina minimală de la #2). Linkul „Editează profil" → `/profile/edit`.
- **`bio/about/specializări`** rămân backlog (ProfileView le randează condiționat → ascunse); `headline` → slotul de tagline.
- `package.json`: `test` → `vitest run --passWithNoTests` (verde până scriem teste). **vitest = de instalat de Liviu** (`npm i -D vitest`).

**Rămas (faza 2):** grafic de contribuții stil GitHub (heatmap, derivă din aceleași timestamp-uri); schema `bio/about/specializări`; linkuri pe cardurile de schiță.

## 2026-06-24 (audit Codex — aliniere frontend↔backend)

### Remediere constatări audit (`audit.md`) — 8 fix-uri + 1 pus pe HOLD intenționat
Rulat un audit static de aliniere frontend↔backend (Codex). Tratate toate cele 9 constatări. `typecheck` + `lint` + `build` VERZI.

**Severitate ridicată**
- **#2 „Vezi profilul" deschidea persoana greșită → profil public nou.** Linkul din cardul autor (`details/[id]`) ducea fix la `/profile`
  (propriile setări). Adăugat **`/profile/[userId]`** read-only (cover/avatar/nume/rol+verificat/headline/locație/website), repo `getPublicProfile`
  (fără email/PII), website sanitizat (allowlist http/https). Propriul ID → redirect la `/profile`. *Statistici/taburi/activity log rămân pe epicul „Profil pe date reale".*
- **#1 Verificare rol „fără ieșire" → pusă pe HOLD (decizie Edi/Liviu).** Fluxul ducea userul în `PENDING` fără capăt de aprobare. În loc să
  construim UI admin birocratic (metodă în regândire), **ascuns butonul „Verifică rolul"** din profil; mesaj onest „disponibilă în curând".
  Rol declarat = funcțional 100%. Schela (`requestRoleVerification`) rămâne dormantă în service.

**Severitate medie**
- **#3 Link categorie din detaliu nu filtra feedul.** Genera `?category=<slug>`, feedul citea `?cat=<uuid>`. Aliniat la convenția unică `?cat=<categoryId>`.
- **#4 „Aprob/Dezaprob" din feed erau doar linkuri → cablate INLINE.** Componentă client `FeedValidationActions` (buton identic, Dezaprob cu
  justificare obligatorie), reutilizează acțiunile detaliului + `revalidatePath("/feed")`. Poziția curentă încărcată batch (`getMyPositions`, fără N+1).
- **#5 Ciornele DRAFT nu puteau fi reluate → pagina „Ciornele mele".** `/sketches/drafts` (listează drafturile userului cu titlul detaliului-mamă),
  `listDraftsByAuthor`/`getMyDrafts`, link în AppHeader (iconiță). Mesajul „o reiei oricând" devine real.
- **#6 Onboarding putea lăsa profil parțial permanent.** Reordonat: profil text + imagini ÎNTÂI, **`declareRole` ULTIMUL** (e markerul de
  „onboarding complet"). Dacă o scriere pică, rolul nu se creează → onboardingul se reia, nu rămâne rol fără nume.
- **#7 Accept/reject schiță vulnerabil la concurență.** Înlocuit read-then-write cu update condiționat atomic `transitionFromPending`
  (`WHERE id=? AND status='PENDING_ACCEPTANCE'`, verifică rândurile afectate) → fără rezultate opuse / notificări duble.
- **#8 URL resurse nevalidat.** Adăugat `isHttpUrl` (parsare `new URL` + allowlist http/https) la validarea resurselor detaliului (blochează `javascript:`/`data:`).

**Severitate redusă**
- **#9 `roleSnapshot` ignorat la afișare.** `listPositionsForTarget` afișa rolul CURENT (rescria retroactiv validările vechi la schimbarea rolului).
  Acum preferă snapshotul salvat la momentul votului; fallback la rolul curent doar pentru înregistrările vechi fără snapshot.

*Rămas separat (nu în acest set): rescrierea/arhivarea docs-urilor depășite semnalate de audit (ADR/API/ARHITECTURA/plan nontehnic etc.) + epicul „Profil pe date reale" (stats/activity log).*

## 2026-06-24

### Editor schiță — redesign full-screen din Claude Design (`Detalia Schita-editor.dc.html`)
Re-skin al editorului (`app/sketches/[id]/edit`) la layout full-screen. Toată logica de desen refolosită (perfect-freehand prin
`renderStrokes`, undo/redo, radieră, thumbnail PNG, coordonate normalizate, fill-slab 0.3 al detaliului-mamă).
- **`sketch-canvas.tsx`** refactorizat: acum **`forwardRef`** care expune `getStrokes()` + `exportThumbnail()` (citite din bara de context),
  randează **rail vertical de unelte** (Culori grid · 3 Grosimi · Radieră · Undo/Redo) + **canvas fit-to-area** (centrat, păstrează raportul,
  `ResizeObserver`), grid de lucru faint + badge „Mod schiță · detaliul-mamă estompat". Grup pen estompat când radiera e activă.
- **`sketch-editor.tsx`** rescris ca **shell full-screen** (`fixed inset-0 z-[60]`, acoperă AppHeader-ul global): bară de context
  (Renunță → detaliu, badge „Schiță peste" + titlu detaliu-mamă + autor cu `RolePill`, notă, **Salvează ciornă** + **Trimite propunerea**),
  suprafața de desen, **toast „ciornă salvată"**. Acțiunile citesc strokes/thumbnail prin ref.
- **`page.tsx`** pasează acum `detailTitle`/`authorName`/`authorRoleMain`/`authorVerified`; a renunțat la wrapper-ul `max-w` (editorul e full-screen).
- **`dev/preview/sketch`** aliniat la noul API (container cu înălțime fixă, fără handlere save/send).
- **Deviere onestă:** modalul „Propunere trimisă" din design = înlocuit de **redirect la `/details/[id]`** pe succes (flux MPA, nu SPA).
- `typecheck` + `lint` + `build` VERZI. **Neverificat vizual cu DB.**

### „Adaugă un detaliu" — redesign formular din Claude Design (`Detalia Publica.dc.html`)
Re-skin + completare a formularului de creare detaliu (`app/details/new`). Tot fluxul existent (upload imagine Blob, auth, rol declarat,
moderare post-publicare) refolosit; în plus **cablate câmpuri pe care service-ul le suporta deja dar formularul nu le trimitea**.
- **`detail-form.tsx`** rescris ca card pe design: label-uri mono uppercase, titlu, descriere (notă „apare deasupra desenului"),
  select categorie stilizat (săgeată proprie), **zonă climatică + seismică** (selecturi noi, default „General"), **dropzone imagine**
  (file input ascuns + preview cu grid blueprint, nume fișier, Înlocuiește/Elimină), **repeater resurse** (max 3, tip Imagine/Link/PDF +
  valoare, add/remove, serializat în câmp ascuns JSON), notă „devine public imediat", butoane Renunță / Publică detaliul.
- **`actions.ts`** citește acum `climateZone`, `seismicZone` și `resources` (parsare JSON defensivă, ignoră malformat/gol, max 3, validare
  finală în `DetailService`). După publicare **redirect la `/details/[id]`** (înainte mergea la `/`).
- **`page.tsx`:** breadcrumb + titlu + subtitlu, lățime `760px`.
- **Deviere/follow-up onest:** resursele suplimentare stochează un **URL/referință** (placeholder-ele cer link), NU upload de fișier secundar —
  uploadul de fișiere per-resursă nu există încă (decizie de produs deschisă: tipuri resurse). Tipul „Imagine/PDF" e doar etichetă peste un URL.
- `typecheck` + `lint` + `build` VERZI. **Neverificat vizual cu DB.**

### Notificări — dropdown din clopoțel (din Claude Design `Detalia Notificari.dc.html`)
La cererea lui Liviu, designul de notificări **NU** e tratat ca pagină separată, ci ca **dropdown care iese din clopoțelul** din header.
- **`components/notification-bell.tsx`** rescris ca **client component cu dropdown**: buton clopoțel (badge teracotă cu count), panou
  ancorat dreapta, închidere la click-în-afară + Escape. Header „Notificări" + „Marchează toate ca citite" (disabled fără necitite).
- **Rânduri fidele designului:** gutter cu punct de necitit, pătrat-iconiță colorat pe tip (proposed=creion teracotă / accepted=check verde
  / rejected=X cărămiziu), text + link «titlu detaliu» + timp relativ, buton „Vizualizează & acceptă" doar pe `SKETCH_PROPOSED`.
  Rândurile necitite au fundal cald + hover. **Empty state** desenat.
- **`components/app-header.tsx`** aduce acum lista (`getNotifications`) și o mapează la o formă serializabilă; trece `notifications` + `count`
  la clopoțel (înainte trimitea doar count-ul). „Marchează toate" → `markReadAction` (existentă) + `router.refresh()`.
- **Deviere/follow-up onest:** designul arată **rol + steluță** lângă nume; payload-ul de notificări **nu stochează rolul** actorului (doar
  numele, doar la „proposed") → rolul a fost **omis** (de adăugat prin îmbogățirea payload-ului în `notifySketch*`). Pentru accepted/rejected
  păstrăm formularea „Schița ta … a fost acceptată/respinsă" (nu stocăm identitatea autorului-mamă). Pagina `/notifications` rămâne **dormantă**
  (URL direct funcțional), dar clopoțelul nu mai duce la ea.
- `typecheck` + `lint` + `build` VERZI. **Neverificat vizual cu DB.**

### Pagina DETALIU — redesign din Claude Design (re-skin peste Faza 1)
Design importat din proiectul Claude Design (`Detalia Detaliu.dc.html`, via tool-ul `DesignSync`) și implementat peste pagina
de detaliu existentă (funcțional Faza 1) — **doar re-skin + reorganizare layout**, tot wiring-ul server (services/actions) refolosit.
- **Layout nou:** coloană principală (`minmax(0,1fr)`) + sidebar 320px (`lg:sticky`). Validarea, teancul și dezbaterea au trecut în
  coloana principală; sidebar = card autor / card meta („Despre detaliu") / „Regula de aur". Breadcrumb mono Detalii / categorie / titlu.
- **Antet:** H1 32px extrabold, rând autor (avatar + nume + `RolePill` + chip categorie + dată `formatDate`), strip zone climatice/seismice
  (afișat doar dacă există), descriere `max-w-[64ch]`. Imaginea 2D într-o ramă cu grid blueprint + resurse ca chipuri cu iconițe pe tip.
- **Bara de validare (`validation-panel`)** rescrisă: butoane mari Aprob (check, verde când activ) / Dezaprob (X, destructive când activ),
  hint „o singură poziție reversibilă", confirmarea poziției proprii cu retragere, rând de contoare (validări/comentarii/schițe „fără scor"),
  lista pozițiilor celorlalți (nume+rol). Justificarea rămâne **inline-expand** (nu modal — funcțional identic, deviere intenționată).
- **Teancul (`sketch-section`)** rescris: card cu taburi pe autor, viewport + panou meta (autor/rol/contoare/status „în teanc · publicată"),
  dezbaterea schiței active sub viewport, **empty state** desenat, secțiunea „propuneri în așteptare" (doar autorul-mamă). Butonul
  **„Schițează peste detaliu"** cablat la noua acțiune `startSketchAction` (creează DRAFT → editor; NO_ROLE → onboarding) — nu mai e
  accesibilă schițarea doar din „Dezaprob și fac o schiță".
- **Dezbaterea (`comments-section`)** rescrisă: composer cu avatar + listă cu avatar/nume/`RolePill`/timp relativ; dezaprobările marcate
  distinct (bară stânga + fundal `destructive`). Header „Dezbatere · N comentarii".
- **Componente noi reutilizabile:** `components/avatar-initials.tsx` (poză sau inițiale) + `lib/format.ts` (`formatDate` / `formatRelative` ro).
- **Schemă/repo:** `detailsRepo` aduce acum `authorLocation` + `authorHeadline` (cardul autor din sidebar). Mock-ul de preview aliniat la tip.
- **Deviere/follow-up:** secțiunea „Detalii înrudite" din design **omisă** (n-avem încă query de înrudite — de adăugat). Header-ul global
  `AppHeader` rămâne (n-am dublat header-ul cu search din mockup). Strip-ul de thumbnails al teancului redus la taburi (fără mini-previews).
- `typecheck` + `lint` + `build` VERZI. **Neverificat vizual cu DB** (vezi capcane env — magic link/seed).

### Design System — aliniere globală de dimensiuni + culori pe tokeni
Cerere (via Claude Design): UI uniform pe dimensiuni și culori prin tokenii shadcn, nu hex ad-hoc. Aplicat doar pe **design**
(dimensiuni/culori) — comportamentul (stări empty/loading/error, flux Dezaprob) a fost lăsat în afara scope-ului, la cererea lui Liviu.
- **Lățime container unică:** variabila `--container-max: 1280px` (globals.css) folosită pe **Auth/Onboarding/Feed/Landing** (erau
  1320/1280/1180/1320). **Profil rămâne 1080px intenționat** (lizibilitate). Paginile de conținut/formular (detaliu, notificări,
  schiță) rămân pe lățimi de citit mai înguste (`max-w-5xl/3xl/2xl`) — tier separat, deliberat.
- **Gutter unic 24px** (Onboarding era 28; landing deja 24).
- **Radius unic 10px** (`--radius` / `rounded-lg`) pe toate cardurile/butoanele/inputurile/panourile, inclusiv baza shadcn
  `components/ui/card.tsx` (era `rounded-xl`); eliminat amestecul 9/11/12/13/14/16/18px. Pastilele (`rounded-full`) și cercurile
  (`50%`) rămân. Radius-urile inline din landing → `var(--radius)`.
- **Culori pe tokeni:** `destructive` (#b0463c) pe **Dezaprob** (`detail-card`) și pe stările **disputat/dezaprobat** (`profile-view`
  — `SKETCH_STATUS_STYLE.disputed`, `ACTIVITY_ICON.disapprove`, bordura justificării); border input `#d8cfc0` → `--input` (Onboarding)
  / `border-border` (buton editare profil, feed-empty); borduri calde ad-hoc (`#e6ddcf/#e2d7c4/#e6dccd`) → `border-border`; bg activ
  categorie `#f6ede4` → `bg-secondary`.
- **Breakpoint** onboarding 680→720px (aliniat la breakpoint-ul de sistem al hero-ului).
- **Excepție păstrată:** landing-ul (`.dc-landing`) își păstrează **paleta proprie** (inclusiv pastila „disputat" #9a3a30 din
  preview-ul hero) — confirmat ca excepție; doar dimensiunile (container/gutter/radius) au fost aliniate.
- `typecheck` + `lint` + `build` VERZI.

### Onboarding — redesign din Claude Design (date de profil) + migrație schemă
- **Design importat** din proiectul Claude Design (`Detalia Onboarding.dc.html`) și implementat 1:1 ca pagină de brand bespoke
  (header cu „Conectat ca {email}" + fundal blueprint + titlu + card cu **preview live** „cum vei apărea").
- **Schemă — câmpuri noi pe `users`** (migrația `0002_tearful_puck`, reversibilă, toate nullable): `first_name`, `last_name`,
  `headline`, `location`, `website`, `cover_image`. `name` (Auth.js) rămâne și e compus din `first + last` la onboarding pentru
  compatibilitate cu codul care-l citește. **Necesită `db:push`/`db:migrate` pe Neon la următoarea rulare.**
- **Onboarding colectează acum** (era doar rol+subrol+poză): prenume, nume (**obligatorii** — magic link nu capturează numele),
  rol, subrol, headline, locație, website + **poză de profil** și **bandă de cover** (ambele opționale). Validare server-side
  (lungimi + tip/dimensiune imagine) în `app/onboarding/actions.ts` → `roleService.declareRole` + `usersRepo.updateUserProfile`.
- **Storage:** `uploadCoverImage` (prefix `covers/`) lângă avatar. **usersRepo:** `updateUserProfile` + `updateUserCoverImage`.
- **Fix redirect (handoff):** onboarding redirectează acum în **`/feed`** (era `/`), atât post-submit cât și pentru userul care
  are deja rol și reintră.
- Componente: `app/onboarding/onboarding-form.tsx` (client, preview live + previews imagini cu `URL.createObjectURL`) înlocuiește
  `role-form.tsx` (șters). Reguli scoped `.dt-onb` în `globals.css` (focus/hover/săgeată select/responsive 680px).
- `typecheck` + `lint` + `build` VERZI.

---

## 2026-06-23

### Design — login/signup la lățimea landing-ului + cadru bogat (AuthShell)
- **`components/auth-shell.tsx`** (nou) — cadru comun login/signup la **lățimea landing-ului (1320px)**: header de brand + corp pe
  două coloane (panou de pitch în stânga — eyebrow + titlu + 3 puncte cu rombul; cardul cu formular în dreapta) + footer dark ca pe
  landing. Panoul de pitch e ascuns pe mobil (rămâne cardul centrat). Rezolvă feedback-ul „prea sec / prea îngust".
- `app/login` + `app/signup` refactorizate să folosească `AuthShell` (header-ul propriu adăugat anterior a fost înlocuit). Verificat vizual.

### Design — temă de brand pe toată aplicația + preview dev (feed & schiță) fără DB
- **Tema unică (`globals.css`):** paleta landing-ului (bej `#faf8f4` / teracotă `#a9573a` / ink `#211d18` + borduri/muted
  calde) mapată pe **tokenii shadcn `:root`** + fonturile **Archivo/IBM Plex Mono** ca `--font-sans`/`--font-mono`. Efect: TOATE
  suprafețele pe tokeni (login/signup/feed/profil/notificări/detaliu/onboarding) se aliniază AUTOMAT la landing, fără rescriere.
- **`components/brand-logo.tsx`** (nou) — rombul teracotă + wordmark „DETALIA", partajat. Folosit pe login/signup + `AppHeader`.
- **Login/signup:** adăugat header de brand (logo + cross-link) + fundal bej din tokeni; cardul devine brand automat.
- **`AppHeader`:** sticky + bej translucid + `BrandLogo` (rombul), aliniat la header-ul landing.
- **Preview dev (`/dev/preview`, `/feed`, `/sketch`)** — randează componentele REALE (`DetailCard`, `CategoryFilter`, `SketchCanvas`)
  cu **date mock** (`app/dev/preview/mock.ts` + `/public/preview/detail.svg`), **fără DB și fără auth**. Pentru a vedea feed-ul și
  editorul de schiță fără a popula DB-ul. **Gated strict pe non-producție:** `/dev` e public în proxy DOAR dacă `NODE_ENV !==
  production`, iar fiecare pagină dă `notFound()` în prod (a doua barieră). `CategoryFilter` a primit prop opțional `basePath`
  (default `/feed` — comportament real neschimbat). `tsc`+`build` VERZI; verificat vizual (Playwright).
- GitGuardian (GitHub App) a semnalat un „Generic Password" în `app/page.tsx` — **fals pozitiv**: detectorul se agață de
  cuvântul „parolă" din `const SUBLINE = "...fără parolă..."` (copy UI passwordless), NU o credențială. Zero secrete reale.
- Adăugat **`.gitguardian.yaml`** (v2) cu `ignored_matches` pe acest text. **Atenție:** fișierul e citit de **ggshield** (CLI);
  GitHub App-ul îl respectă doar dacă workspace-ul are „honor repo config". Pe PR-ul curent, fixul sigur = „Skip: false positive"
  în check / resolve în dashboard. CI-ul propriu (`ci.yml`) NU rulează ggshield (doar type-check+lint+build).

### Auth — Google OAuth scos pentru MVP (rămâne doar magic link)
- **Decizie Edi/Liviu:** pentru MVP autentificarea e **doar passwordless prin magic link (Resend)**. Google OAuth scos din flux.
- **`lib/auth.ts`** — eliminat providerul `Google` + importul; rămâne doar `Resend`. (Schela de re-adăugare documentată în comentariu.)
- **`app/auth-actions.ts`** — eliminat `signInWithGoogleAction` (rămâne `signInWithEmailAction`).
- **`components/auth-form.tsx`** — scos butonul „Continuă cu Google", separatorul „sau" și `GoogleIcon`; formularul = doar email.
- **`/login` + `/signup`** — copy actualizat (fără „Google"), curățate mesajele de eroare OAuth (`OAuthSignInError`/`OAuthAccountNotLinked`).
- **`.env.example`** — secțiunea Google marcată DEZACTIVAT (variabile comentate + instrucțiuni de reactivare). `tsc`+`build` VERZI.

### Landing public — implementat din Claude Design (hero varianta B) + responsive
- **`app/page.tsx`** rescris complet din designul aprobat de Edi în Claude Design (proiect `Detalia Landing.dc.html`).
  Implementat **hero varianta B** (split: text + card preview cu planșă SVG și voturi pe roluri — M. Popa ✓ Aprobă /
  I. Radu ✕ Dezaprobă + justificare) + CTA final dark. Reproducere **fidelă**: paletă proprie de brand (bej `#faf8f4` /
  teracotă `#a9573a`) + fonturile **Archivo + IBM Plex Mono** (via `next/font` în `layout.tsx`) — separată intenționat de tokenii shadcn.
- Secțiuni: header sticky · hero B · 01 Problema&soluția · 02 Cum funcționează · 03 Ce câștigi · 04 Pentru cine (4 roluri) ·
  05 FAQ (`<details>` nativ, fără JS) · CTA final dark · footer.
- **Responsive (adăugat):** heading-uri + padding-uri verticale pe `clamp()` (fluide, fără media queries); grilele de carduri pe
  `repeat(auto-fit, minmax(...))` (colapsează singure); singura grilă cu media query e hero B → `.dc-hero-grid` în `globals.css`
  (1 coloană sub 880px). Hover-urile și markerul `<details>` scoped în `globals.css` la `.dc-landing`.
- Cablat `/signup` `/login` `/feed`; ramura **authed** (session → „Mergi la feed", fără sublinii de signup); `auth()` server-side păstrat.
  Copy fără „Google" (passwordless = doar email) și fără „GitHub". **`app/page.tsx` provizoriu** înlocuit definitiv. `tsc`+`build` VERZI.
- **Rafinări post-verificare vizuală (browser):** breakpoint hero coborât 880→720px (laptopuri cu scalare OS rămân pe 2 coloane);
  lățime conținut principal lărgită 1180→1320px (constanta `MAXW` — header/hero/01–04/footer; FAQ+CTA rămân înguste, centrate).

### Refresh documentație (README + PLAN-EXECUTIE aliniate la realitate)
- **`README.md`** rescris ca punct de intrare: secțiune **„Stare la zi"** consolidată (✅ făcut / ⏳ blocat de credențiale /
  ⛔ placeholder / 🔮 backlog), stack corectat (Google OAuth + shadcn), acces **PUBLIC** (nu „beta închis"), rulare reală
  (inclusiv `.env.local` doar cu `AUTH_SECRET` pt paginile publice), hartă de docuri grupată. „GitHub pentru construcții"
  marcat explicit ca metaforă internă (NU în UI).
- **`docs/PLAN-EXECUTIE.md`** — Faza 1 + 1.5 marcate **ÎNCHEIATE**, Faza 2 **PARȚIALĂ**; corectate notele depășite
  (upload deschis userilor, nu doar admin/seed; Poarta 1 = PUBLIC, rezolvată).
- Restul design-docs (SCHEMA/API/SECURITATE/EMAILURI/PLAN-SEED) aveau deja bannere „codul = sursa de adevăr" — neatinse.

### Design — restul suprafețelor pe shadcn (migrare completă)
- **profil** (`page.tsx` + `profile-forms.tsx`): Button/Input/Label + select stilizat + alerte pe tokeni.
- **notificări** (`page.tsx`): listă + empty-state pe tokeni (unread = `bg-muted/50`).
- **header + clopoțel** (`app-header.tsx`, `notification-bell.tsx`): tokeni (badge necitite rămâne roșu = semnal).
- **`/details/new`** (`detail-form.tsx` + `page.tsx`): Input/Textarea/Label/Button + preview pe `ring`.
- **editor schiță** (`sketch-canvas.tsx`, `sketch-editor`, `sketch-viewer`, `edit/page.tsx`): chrome-ul (toolbar/butoane/
  suprafață/alertă) pe `Button` + tokeni; **logica de desen și `STROKE_COLORS` neatinse**.
- **`author-badge.tsx`** tokenizat (folosit peste tot). **Migrarea design pe shadcn = COMPLETĂ** — zero `zinc-*`/`dark:` rămase
  în afară de culorile semantice intenționate (emerald=aprobă/salvat, destructive=dezaprobă, roșu=badge necitite, amber=★ verificat,
  culorile creionului). `lint`+`build` VERZI.

### Design — pagina de detaliu pe shadcn (`/details/[id]` + sub-componente)
- Adăugat `textarea`. **`page.tsx`** — back-link + descriere + imagine + resurse pe tokeni; categoria = `Badge`.
- **`validation-panel.tsx`** — pe `Button` (Aprob default/outline; Dezaprob destructive/outline) + `Textarea`; carcasă pe
  `bg-card`/`ring`. Păstrate culorile semantice (aprobă=emerald, dezaprobă=destructive) ca afordanță, restul pe tokeni.
- **`comments-section.tsx`** — `Textarea` + `Button`; tag „dezaprobare" = `Badge` destructive.
- **`sketch-section.tsx`** — taburi teanc + accept/respinge pe `Button` (accept=primary, drop emerald); secțiunea „în așteptare"
  pe `bg-card`/`ring` cu `Badge` în loc de wash amber. Logica (state machine, authz, polimorfism) neatinsă. VERZI.

### Design — feed pe shadcn (`Badge`/`Button` + tokeni)
- Adăugat `badge`. **`detail-card.tsx`** — card pe tokeni (`bg-card`/`ring-foreground/10`), categoria devine `Badge` secondary.
- **`category-filter.tsx`** — chip-uri pe `Button asChild` (default=activ / outline=inactiv, `rounded-full`).
- **`app/feed/page.tsx`** — „Adaugă detaliu" pe `Button`, header + empty-state pe tokeni (`text-muted-foreground`, `border-border`).

### Design — onboarding pe shadcn (`Card`/`Button`/`Input`/`Label`)
- **`app/onboarding/page.tsx`** — wrap în `Card` (titlu + descriere), tokeni de temă.
- **`app/onboarding/role-form.tsx`** — `Button` + `Label` + `Input` (file) + alertă `destructive`. Logica neschimbată.
  **`select` rol/subrol rămâne native** (stilizat ca Input) — subrolul are opțiune goală, iar Radix Select interzice
  `value=""` → native = robust + submit curat în server action, fără sentinel.

### Design — login + signup pe shadcn (`Card`/`Input`/`Label`/`Button`)
- Adăugate componente shadcn: `card`, `input`, `label`, `separator`.
- **`components/auth-form.tsx`** — rescris pe `Button` (outline pt Google, default pt email) + `Input` + `Label`, tokeni de temă.
  Logica neschimbată (Google + magic link, două server actions, hidden `callbackUrl`/`authPath`).
- **`app/login` + `app/signup`** — wrap în `Card` (header titlu+descriere + content), alertă de eroare pe tokeni `destructive`.
  **Confirmat cu Liviu: păstrăm două pagini** (signup→`/onboarding`, login→`/`) — diferă doar copy-ul + destinația; mecanic e
  același flux passwordless. Garanția new-vs-returning rămâne check-ul de rol, nu pagina. VERZI.

### Design — fundație shadcn/ui + landing minimalist
- **shadcn/ui inițializat** (`init -d --base radix`): `components.json`, `lib/utils.ts` (`cn`), `components/ui/button.tsx`,
  dependențe (radix-ui, cva, clsx, tailwind-merge, lucide). `globals.css` rescris cu tokeni de temă (oklch, light + `.dark`).
- **Fix gotcha Tailwind v4:** init-ul a stricat fontul (`--font-sans: var(--font-sans)`, circular) → re-legat la
  `var(--font-geist-sans)`/`var(--font-geist-mono)` (variabilele încărcate de `layout.tsx`). Acum aplicația folosește Geist
  (înainte body cădea pe Arial). Dark mode devine class-based (`.dark`) — fără toggle deocamdată (light-only).
- **Landing (`app/page.tsx`) — redesign minimalist** (direcție „centrat, esențial" aleasă de Liviu): wordmark + o frază +
  CTA pe componenta `Button` (default + outline) / „Mergi la feed" pt logați. Tokeni de temă, fără hex ad-hoc. VERZI.

### Pagina de profil (`/profile`) — editare poză/rol + „Verifică rolul" (Poarta 2)
- **`app/profile/page.tsx`** — server component: avatar + `AuthorBadge` (nume/rol/★) + email (read-only).
  Logat fără rol → redirect `/onboarding`. Trei secțiuni: poză, rol, verificare + buton de deconectare.
- **`app/profile/profile-forms.tsx`** (client) — `AvatarForm`, `EditRoleForm` (pre-completat, subrol resetat la
  schimbarea rolului principal), `VerificationSection`/`VerificationForm`, `SignOutButton`. Feedback succes/eroare.
- **`app/profile/actions.ts`** — `updateAvatarAction` (reuse `uploadAvatarImage`+`updateUserImage`),
  `updateRoleAction`, `requestVerificationAction`, `signOutAction`. userId din sesiune; `revalidatePath`.
- **`server/services/roleService`** — `getUserRole`, `updateRole` (validare rol/subrol + **reset verificare la DECLARED**
  dacă revendicarea se schimbă), `requestRoleVerification` (DECLARED/REJECTED → PENDING; respinge dacă deja VERIFIED/PENDING/dovadă goală).
- **`server/repos/rolesRepo`** — `updateRoleClaim`, `setRoleVerificationPending` (dovada OAR/CUI = PII, nu se loghează).
- **`server/repos/usersRepo`** — `getUserProfile` (nume/email/poză).
- **`components/app-header.tsx`** — adăugat avatar-link spre `/profile` lângă clopoțel.
- **Aprobarea verificării (latura admin) = task separat** (nu există încă admin UI). `typecheck`+`lint`+`build` VERZI.

## 2026-06-22

### Schițare — pas 6: dezbatere pe schiță (validare + comentarii polimorfice)
- **Generalizat UI-ul de la `DETAIL` la orice target:** `validation-actions` + `validation-panel` și `comment-actions`
  + `comments-section` primesc acum `targetType` + `targetId` (+ `detailId` = pagina de revalidat). Butonul „Dezaprob
  și fac o schiță" apare doar pe DETAIL (`allowSketch`).
- **`sketch-section`** — pe schița activă din teanc montează `ValidationPanel` + `CommentsSection` cu `targetType=SKETCH`
  (reuse total; dezbaterea per schiță vine „gratis", cum prevedea schema polimorfică).
- **Pagina de detaliu** — pasează `targetType="DETAIL"` + îmbogățește fiecare schiță publicată cu validarea + comentariile ei.
- **Schițarea = COMPLETĂ** (pașii 1–6): nucleu server → canvas → editor (din Dezaprob) → teanc/review → notificări → dezbatere.
- `typecheck`+`lint`+`build` VERZI.

### Schițare — pas 5: clopoțel notificări + pagina de notificări
- **Header global** (`components/app-header.tsx` în `app/layout.tsx`) — apare DOAR pentru useri autentificați:
  logo „DETALIA" → feed + **clopoțel** (`components/notification-bell.tsx`) cu badge de necitite.
- **`server/services/notificationService`** — citiri: `getNotifications`, `getUnreadCount`, `markNotificationsRead`.
- **`app/notifications/`** — `page.tsx` (listă, necitite evidențiate, link la detaliu, gol-state), `actions.ts`
  (`markReadAction` — userId din sesiune), `mark-read-on-view.tsx` (la deschidere marchează citite + `router.refresh()`
  → clopoțelul se golește). Protejat de proxy deny-by-default.
- Notă: layout-ul citește sesiunea → toate rutele devin dinamice (corect pt această aplicație). `typecheck`+`lint`+`build` VERZI.
- **Rămas (ultimul pas schițare):** dezbatere (validare/comentarii) pe pagină proprie de schiță publicată.

### Schițare — pas 4: UI autor-mamă (teanc + accept/respinge)
- **`components/sketch/sketch-viewer.tsx`** — viewer read-only: imaginea-mamă (intensitate normală) + stroke-uri deasupra.
- **`app/details/[id]/sketch-section.tsx`** — pe pagina de detaliu: **teancul** (taburi „Original" + schițe PUBLISHED,
  navigabile, cu autor+rol) + **coada de review** (doar autorul-mamă) cu butoane **Acceptă/Respinge** (fără justificare).
- **`app/details/[id]/sketch-review-actions.ts`** — `acceptSketchAction`/`rejectSketchAction` (authz în `sketchService`:
  doar autorul-mamă; PENDING→PUBLISHED/REJECTED + notifică autorul schiței). `actorUserId` din sesiune.
- **`sketchesRepo`** — `strokesJson` inclus în query-urile teanc/coadă (randare în pagină); `getTeanc`/`getPendingForOwner` îl expun.
- **Bucla de schițare e acum completă funcțional:** Dezaprob → desen → trimite → autor-mamă acceptă → intră în teanc (public).
- `typecheck`+`lint`+`build` VERZI. **Urmează:** clopoțel notificări + dezbatere (validare/comentarii) pe schiță.

### Schițare — pas 3: pagina-editor (din fereastra de Dezaprob)
- **Enforcement „schițarea doar din Dezaprob":** editorul cere un DRAFT existent, iar draftul se creează **doar** de
  acțiunea de Dezaprob → nu există altă cale către editor. Buton nou „Dezaprob și fac o schiță" în panoul de validare
  (intent `sketch`): `disapproveDetailAction` face dezaprobarea (justificare obligatorie) → `createDraft` → redirect editor.
- **`app/sketches/[id]/edit/`** — `page.tsx` (guard `auth()` + `getDraftForEdit` = doar autorul, doar DRAFT → altfel 404),
  `sketch-editor.tsx` (leagă `SketchCanvas` de actions, stări pending/error/„salvat"), `sketch-actions.ts`
  (`saveStrokesAction`; `sendSketchAction` = upload thumbnail → `sketchService.send` → redirect la detaliu).
- Protejat de proxy deny-by-default + guard pagină + authz în service. `typecheck`+`lint`+`build` VERZI.
- **Urmează:** UI autor-mamă (teanc/taburi + accept/respinge) + clopoțel notificări + dezbatere pe schiță.

### Fix securitate (XSS în email) în `server/services/notificationService.ts`
- `detailTitle` / `sketchAuthorName` (user-controlled) intrau neescapate în HTML-ul de email → XSS stocat. **Fix:**
  helper `esc()` (HTML-escape) pe toate valorile interpolate + `plain()` pe subiect (anti header-injection).
  (Flag de la security review automat; MEDIUM, rezolvat.)

### Schițare — pas 2: canvas de desen (perfect-freehand)
- **Dependență nouă:** `perfect-freehand`. **`lib/sketch-render.ts`** — `renderStrokes(ctx, strokes, w, h)` partajat
  (editor + viewer); coordonate normalizate 0..1, grosime scalată față de `REFERENCE_WIDTH=1000`.
- **`components/sketch/sketch-canvas.tsx`** — editor: desen peste imaginea-mamă **slabă (fill 0.3)**, unelte MVP
  (6 culori stridente + 3 grosimi + radieră + undo/redo), pointer events (mouse/touch/pen), output stroke-uri
  normalizate. La „Trimite" randează **thumbnail PNG** client-side (best-effort, taint CORS → null). Butoane
  „Salvează ciorna" / „Trimite propunerea" (handlerele = props, cablate la pasul 3).
- **`lib/storage.uploadSketchThumbnail`** (Blob PNG → Blob `sketches/`). `STROKE_WIDTHS` ajustate la [8,16,28] (vizibile).
- Fix lint (React Compiler strict): fără assignment de ref în render; `ResizeObserver` în loc de listener manual.
- `typecheck` + `lint` + **build VERZI**. **Urmează:** editor-page (din fereastra de Dezaprob) + UI autor mamă (teanc/review) + clopoțel notificări.

### Schițare — pas 1 (CRITICAL): nucleul de server (state machine + notificări)
- **`server/domain/sketch.ts`** — `SKETCH_STATUS`, paletă (culori stridente + 3 grosimi), tip `Stroke` (puncte
  normalizate 0..1) + `validateStrokes` (structural + limite anti-abuz: max 2000 stroke-uri / 10000 puncte / size 100).
- **`server/repos/sketchesRepo.ts`** — `insertDraft`, `getSketchById`, `updateStrokes`, `updateStatus`,
  `listPublishedByDetail` (teancul), `listPendingByDetail` (coadă review), cu autor nume+rol.
- **`server/repos/notificationsRepo.ts`** + **`server/repos/usersRepo.getUserContact`** — notificări in-app + contact.
- **`lib/email.ts`** — trimitere best-effort via Resend REST (no-op fără credențiale; fără PII logat).
- **`server/services/notificationService.ts`** — in-app (mereu) + email (best-effort) pentru SKETCH_PROPOSED/ACCEPTED/REJECTED.
- **`server/services/sketchService.ts`** — state machine + authz: `createDraft`, `saveStrokes`, `send`
  (DRAFT→PENDING_ACCEPTANCE + notifică autorul mamă), `accept`/`reject` (doar autorul mamă; →PUBLISHED/REJECTED +
  notifică autorul schiței), `getTeanc`, `getPendingForOwner`, `getDraftForEdit`, `getPublishedSketch`.
- **Datorie veche închisă:** validarea/comentariile pe **SKETCH** activate (`validationService.targetExists` →
  schițe PUBLISHED). Dezbaterea per schiță vine gratis (polimorfic).
- **Securitate:** `actorUserId` din sesiune (fără IDOR); doar autorul schiței editează/trimite, doar autorul mamă
  acceptă/respinge; tranziții invalide respinse; stroke-uri validate; fără PII logat. `typecheck`+`lint`+`build` VERZI.
- **Urmează:** canvas perfect-freehand (desen + thumbnail PNG) + UI (editor din fereastra de Dezaprob, teanc/taburi, review autor mamă).

### Faza 0.5 (CRITICAL — auth): Google OAuth + signup public + onboarding cu poză
- **Google OAuth** (`lib/auth.ts`): provider `Google` adăugat lângă Resend; `allowDangerousEmailAccountLinking: true`
  (linkare pe email sigură — ambele fluxuri passwordless dovedesc deținerea email-ului). Env noi în `.env.example`:
  `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` (+ redirect URI documentat).
- **Auth public partajat** (`app/auth-actions.ts` + `components/auth-form.tsx`): „Continuă cu Google" + magic link pe
  email, reutilizat de `/login` și `/signup`. `redirectTo` sanitizat la same-origin de Auth.js (fără open-redirect).
- **`/signup` (public)** — înregistrare deschisă (fără invitație); după auth → `/onboarding`. **`/login`** rescris
  (Google + email, link spre signup). Texte „beta închis / invitație" **eliminate**. Proxy: `/signup` adăugat la public.
- **Landing `/`** — acum dinamic: CTA „Creează cont" / „Autentificare" pentru vizitatori, „Mergi la feed" pentru cei logați.
- **Onboarding cu poză** — `lib/storage.ts` refactorizat (`validateImageFile` + `uploadAvatarImage`); `usersRepo.updateUserImage`;
  `app/onboarding` acceptă poză opțională (validare ieftină înainte de declararea rolului, upload best-effort după).
- **Securitate:** rutele rămân deny-by-default (doar `/`,`/login`,`/signup` publice); fără secrete în cod; fără PII logat.
  `typecheck` + `lint` + **build VERZI**. Testare end-to-end Google/magic link → cere credențiale reale (Edi/Liviu).

### Fix securitate (open-redirect) în `app/auth-actions.ts`
- `authPath` (client-controlled, din formular) era interpolat direct în `redirect()` → un `//evil.com` ar fi fost
  protocol-relative (redirecționare externă post-eroare auth). **Fix:** whitelist strict `safeAuthPath()` → doar
  `/login` | `/signup`, + `encodeURIComponent` pe `error.type`. (Flag de la security review automat; MEDIUM, rezolvat.)
  `callbackUrl` era deja sigur — sanitizat same-origin de Auth.js. `typecheck` + `lint` VERZI.

### Faza 1 — pas 5: comentarii (afișare + adăugare)
- **`server/domain/validation.ts`** — `validateCommentBody` (aceleași limite ca justificarea).
- **`server/services/commentService.ts`** — `addComment` (enforce: rol declarat, corp non-vid ≤5000, țintă
  `PUBLISHED`, `authorId` din sesiune) + `getComments`. Refolosește `targetExists` (exportat din `validationService`).
- **`app/details/[id]/comment-actions.ts`** + **`comments-section.tsx`** — listă cronologică (nume+rol+★, badge
  „dezaprobare" pe comentariile cu `originValidationId`) + form de adăugare (reset pe succes). Cablate în pagină.
- Justificările-dezaprobare de la pas 4 **devin acum vizibile** în coloana de comentarii. Polimorfic (Detail acum).
- `typecheck` + `lint` + **build VERZI**. **Faza 1 (detaliu + feed + validare + comentarii) = încheiată structural.**

### Faza 1 — pas 4 (CRITICAL): validarea pe roluri (INIMA)
- **`server/domain/validation.ts`** — poziții (APPROVE/DISAPPROVE), target (DETAIL/SKETCH), `validateJustification`
  („nu există dezaprobare mută"), tip `RoleSnapshot`.
- **`server/repos/validationsRepo.ts`** — `getUserPosition`, `upsertPosition` (**`onConflictDoUpdate` pe constrângerea
  unică** `(userId,targetType,targetId)` = o poziție/user, reversibilă), `deletePosition`, `listPositionsForTarget`
  (cu nume+rol curent).
- **`server/repos/commentsRepo.ts`** — `insertComment` (cu `originValidationId`) + `listCommentsForTarget` (pt pas 5).
- **`server/services/validationService.ts`** — `approve` (1 click, idempotent), `disapprove` (justificare OBLIGATORIE
  → respinsă fără ea; devine automat `Comment` cu `originValidationId`; fără duplicate la re-trimitere), `retract`
  (reversibilitate; comentariul rămâne în dezbatere), `getTargetValidationView` (poziții + totaluri + poziția mea).
  Polimorfic (DETAIL acum; SKETCH reuse la schițare). Snapshot rol la momentul poziției.
- **`app/details/[id]/validation-actions.ts`** + **`validation-panel.tsx`** — butoane Aprob/Dezaprob (identice),
  form justificare la Dezaprob, „Retrage poziția", listă poziții cu rol (+ ★ verificat). Cablat în pagina de detaliu.
- **Securitate (CRITICAL):** `userId` EXCLUSIV din sesiune (fără IDOR — upsert/delete keyed pe userul sesiunii);
  poziția cere rol declarat (`NO_ROLE`→onboarding); justificarea enforce pe server (echivalent **422**), nu doar în
  HTML; doar ținte `PUBLISHED`; fără 404 ascuns; fără PII logat; constrângerea unică DB ca plasă de siguranță.
  `typecheck` + `lint` + **build VERZI**. (Audit formal 13-cat disponibil la cerere înainte de merge în `main`.)

### Faza 1 — pas 3: pagina de detaliu (`/details/[id]`)
- **`server/repos/detailsRepo.ts`** — `getDetailResources(detailId)` (cele 0–3 resurse atașate).
- **`server/services/detailService.ts`** — `getDetail` validează acum **formatul UUID** (id malformat → `null` → 404,
  nu eroare SQL/500) și întoarce detaliul + `resources`.
- **`app/details/[id]/page.tsx`** — guard `auth()`; `getDetail` → `notFound()` dacă lipsește. Layout pe 2 coloane:
  detaliul (categorie + titlu + `AuthorBadge` + descriere + imagine `next/image` + listă resurse) și o coloană
  laterală cu **placeholdere marcate** pentru panoul de validare (pas 4) și comentarii (pas 5). Link „înapoi la feed".
- Cardurile din feed (link spre `/details/[id]`) **nu mai dau 404**. Protejat de proxy deny-by-default.
- `typecheck` + `lint` + **build VERZI**.

### Faza 1 — pas 2: feed finit + filtre pe categorii + sortare după interacțiuni
- **`listFeed` sortează acum după interacțiuni** (validări + comentarii polimorfice pe DETAIL + schițe PUBLISHED),
  tie-break după dată — via subquery-uri corelate (fără dublare pe join). Achită datoria de la pas 1 (era după dată).
  `FeedItem` expune `interactionCount`.
- **`next.config.ts`** — `images.remotePatterns` pentru `**.public.blob.vercel-storage.com` (afișare cu `next/image`).
- **Componente noi** (`components/`): `author-badge.tsx` (nume + rol + **steluță galbenă** la rol VERIFICAT),
  `detail-card.tsx` (imagine `next/image` + titlu + excerpt + autor/rol + categorie, link spre `/details/[id]`),
  `category-filter.tsx` (chip-uri link, „Toate" + per categorie; MVP plat, refinare arbore ulterior).
- **`app/feed/page.tsx`** — suprafața autenticată principală: guard `auth()`, feed finit (~20, fără scroll infinit),
  filtru pe categorie via `?cat=` (acceptat doar dacă e categorie reală), grilă responsivă, **stare empty**, buton
  **„Adaugă detaliu"** (cablează linkul lipsă către `/details/new`). Protejat de proxy deny-by-default.
- `typecheck` + `lint` + **build VERZI**. Testabil end-to-end după seed (categorii + detalii) + `DATABASE_URL`/Blob.

### Faza 1 — pas 1 (cont.): wiring Blob + UI „Adaugă detaliu"
- **Dependență nouă:** `@vercel/blob`. **`lib/storage.ts`** — `uploadDetailImage(file)` cu validare pe SERVER
  (tip ∈ PNG/JPG/WebP/AVIF, max **8 MB**); urcă în Blob (acces public, nume uuid) și întoarce URL-ul.
  Tokenul `BLOB_READ_WRITE_TOKEN` (deja în `.env.example`) e citit automat de `put()`.
- **`server/services/categoryService.ts`** — `listCategories()` pentru UI (UI citește prin service, nu repo).
- **`app/details/new/`** — pagină + form + action „Adaugă detaliu":
  - `page.tsx` (RSC): guard `auth()` + `userHasRole` → fără sesiune `/login`, fără rol `/onboarding`; stare empty
    dacă nu există categorii.
  - `detail-form.tsx` (client): titlu/descriere/categorie/imagine + **preview local** + stări loading/error.
  - `actions.ts` (server action): **`authorId` EXCLUSIV din sesiune**; guard ieftin înainte de upload (evită blob
    orfan); upload imagine → `createDetail`; `NO_ROLE` → redirect `/onboarding`. Redirect post-creare → `/` (feed
    vine la pasul 3).
- **Securitate:** rută protejată de proxy deny-by-default (`/details` nu e public) **+** guard în pagină + enforce
  în service — trei straturi. `typecheck` + `lint` + **build VERZI**.

### Faza 1 — pas 1: stratul `server/` pentru Detaliu (domain + repo + service)
- **`server/domain/detail.ts`** — reguli pure: status (`PUBLISHED`/`REMOVED`), limite (titlu ≤200, descriere ≤5000,
  **max 3 resurse**, feed implicit **20**), tipuri de resurse (IMAGE/LINK/TEXT/PDF) + `validateDetailInput()` care
  normalizează și respinge inputul invalid (titlu obligatoriu, imagine obligatorie, resurse validate pe tip).
- **`server/repos/categoriesRepo.ts`** — `getCategoryById` (existență) + `listCategories` (pentru filtre/form).
- **`server/repos/detailsRepo.ts`** — `insertDetail`, `insertDetailResources`, `getDetailById` și `listFeed`
  (ambele cu autor nume+rol+verificare + categorie, doar `PUBLISHED`). Feed sortat provizoriu după `createdAt`
  (TODO pas 2: sortare „după interacțiuni"). Toate prin `leftJoin` pe `categories`/`users`/`roles`.
- **`server/services/detailService.ts`** — `createDetail` enforce pe SERVER: (1) **autor cu rol declarat**
  (`userHasRole`, nu doar admin/seed, nu trebuie verificat) → altfel `NO_ROLE`; (2) validare/normalizare;
  (3) categorie existentă → altfel `INVALID_CATEGORY`; (4) insert detaliu + resurse. Plus `getDetail` și `getFeed`.
- **Upload Blob ținut în afara service-ului** (primește `imageUrl` rezolvat) — clean architecture, business testabil
  fără infra. Wiring-ul Blob + UI = pașii următori. `typecheck` + `lint` VERZI. Fără UI, fără migrație.

### Schemă: `details.description` (text liber „deasupra" imaginii, stil post)
- Adăugat coloana **`description` (text, nullable)** pe `details` — caption/text bogat afișat deasupra imaginii
  (model post LinkedIn). `title` rămâne obligatoriu; `description` e opțional. Decizie de produs (Edi).
- Migrație **`0001_familiar_darkhawk.sql`** (`ADD COLUMN`, reversibilă prin `DROP COLUMN`). `typecheck` VERDE.
- **Doc afectate:** `db/schema.ts`, `docs/SCHEMA.md` (tabel `details`). Rulare pe DB (`db:push`/`db:migrate`)
  blocată de lipsa `DATABASE_URL` — migrația e generată și gata de aplicat.

### Decizii de produs confirmate de Edi (răstoarnă câteva decizii „confirmat/HOLD" anterioare)
- **Login: passwordless = magic link (Resend) + Google OAuth** („Continuă cu Google"). **Fără parolă** (s-a
  clarificat ambiguitatea „parolă vs magic link" → rămâne passwordless, se adaugă Google).
- **Acces PUBLIC** (înregistrare deschisă) — se renunță definitiv la beta pe invitație. Schela `Invitation`
  rămâne **dormantă** în cod (neutilizată), nu se cablează în signup. Flux: landing → creare cont → email magic
  link → onboarding profil (rol, subrol, poză) → feed.
- **Upload de detalii DESCHIS** oricărui user cu rol declarat (nu mai e seed-only/admin-only). Moderare
  post-publicare; fără cozi de aprobare în MVP.
- **Taxonomia categorii + subroluri** — OK pentru MVP (draftul curent e suficient; Edi se mai gândește la roluri).
- **Seed 50–100 detalii** (~2/categorie), prin conturi reale (Edi + useri din toate categoriile + portofoliul Edi).
- **Pe HOLD (neschimbat):** lista fixă zone climatice/seismice; sursele de verificare automată a rolului.
- **Doc afectate:** `CLAUDE.md` (Stack, Glosar, Poarta 1, Upload, Divergență Backend.md, Decizii confirmate/deschise).
  Cod neatins în acest set — doar aliniere de decizii. (Implementarea Google OAuth + onboarding poză = task viitor.)

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
