# DETALIA — Instrucțiuni de proiect

> Acest fișier completează regulile globale (`C:\dev\persist\claude\CLAUDE.md` — proces, clasificare,
> quality gates, securitate) cu **specificul DETALIA**: domeniu, model de date, reguli de business, structură.
> Globalul câștigă pe proces/securitate; aici stă „ce înseamnă lucrurile" în acest produs.
> Arhitectura completă: `docs/ARHITECTURA.md`. Varianta non-tehnică (arhivată, discuție inițială cu
> clientul): `docs/_archive/documente_client/plan nontehnic-raspuns.md`.

> **`CONTEXT.md`** (în același director) conține detaliile de domeniu/business: ce este DETALIA, stack,
> glosarul de domeniu, regulile de business (validare pe roluri, schiță, acces & roluri), deciziile de
> produs confirmate/deschise. NU se încarcă automat — citește-l doar când chiar ai nevoie de detaliul
> respectiv (ex. implementezi un flux de business, verifici o decizie de produs).

---

## Arhitectură pe straturi (clean architecture — regula de aur: zero business în handlers/componente)
- `app/` (UI + route handlers + server actions) rămâne **SUBȚIRE**: validează input, deleagă la service.
- Business-ul stă în `server/`: `domain/` (entități, roluri, state machines) → `services/` → `repos/` (Drizzle).
- Mutațiile trec prin **services**, nu direct din UI în DB.
- Deny-by-default: tot ce e sub zona protejată cere sesiune; rolul se verifică pe server.

---

## Securitate (tratăm auth/roluri/validare ca CRITICAL)
- Fără secrete în cod → env (`vercel env`). PII (email, tokenuri, OTP, dovezi rol) **nu se loghează** — doar
  metadate. (Hook `block-pii-log` blochează încălcările.)
- Toate regulile de business de mai sus = enforce pe server. Frontend-ul nu e sursă de adevăr.
- Magic link: token scurt, one-time.

### Mentenanță recurentă (de reamintit lui Liviu — TOATE remindere-le periodice, nu se întâmplă automat)
> Secțiune unică pt orice „trebuie verificat/schimbat din când în când" — nu se împrăștie în alte secțiuni.

- **`AUTH_SECRET` — rotire trimestrială.** Rotirea invalidează instant TOATE sesiunile active (JWT semnate cu
  secretul vechi devin nevalide) — de făcut într-o fereastră asumată, nu din greșeală. Schimbi valoarea în
  Vercel (env, ambele scope-uri Preview + Production) → redeploy.
- **`next-auth` (Auth.js v5) — verificare periodică de versiune** *(actualizat 2026-08-10, audit securitate
  13 categorii)*: proiectul rulează pe `5.0.0-beta.32` + `@auth/core` `0.41.3` (release de securitate iulie
  2026, include GHSA-8fpg-xm3f-6cx3 — fail-open pe middleware v5) — librăria e încă oficial BETA. La
  checkpoint-ul lunar (sau când apare un motiv), verifică `npm view next-auth versions` pentru o beta mai
  nouă cu fix-uri de securitate; folosește context7 dacă ai nevoie de detalii de migrare API.
- **Scanare periodică de cod mort cu `knip`** *(regulă 2026-07-13)*: PostHog arată doar ce a crăpat
  vreodată, nu cod mort care n-a aruncat nicio eroare. Rulează `npx knip` ~lunar — fișiere/exporturi
  neutilizate + dependențe nedeclarate. **Nu șterge orbește din rezultat:** Server Actions (`"use server"`)
  apar des fals-pozitiv (apelate din client prin `action={...}`, knip nu le urmărește mereu) — verifică
  fiecare candidat înainte de ștergere.
- **Igienă observabilitate (PostHog) după orice refactor/rescriere care elimină cod** *(regulă
  2026-07-13, declanșată de eveniment nu de calendar)*: după ce ștergi/înlocuiești un fișier sau o librărie,
  treci prin dashboard-ul de erori (`is:unresolved`, caută după culprit/fișierele atinse) și închide manual
  ce nu se mai poate reproduce, cu un comentariu scurt de ce. Nu se auto-curăță la refactor.
- **Reminder săptămânal observabilitate** (rutină cloud `/schedule`, luni 09:00 RO — recreată 2026-08-24
  după ce lipsea din lista de rutine active; verifică `id`-ul curent cu `/schedule list` dacă pare iar
  dispărută) — doar notificare push, fără verificare automată de Claude; **PostHog e sursa unică** (Sentry
  decommission FĂCUT 2026-07-16, mai devreme decât planul ~07-22 — vezi CHANGELOG).
- **Liste de pe profil (Detalii/Schițe/Activitate) — fără paginare reală la scară** *(decizie de business,
  2026-07-16)*: UI-ul arată primele 4 + „Vezi încă N" (client-side, `components/profile-view.tsx`), dar
  `listAuthorDetails`/`listAuthorSketches` (`server/repos/profileRepo.ts`) NU au `LIMIT` — se aduc din DB
  TOATE rândurile userului la fiecare încărcare de profil, indiferent câte se afișează. La 2026-08-18
  (verificat direct în Neon), maximul real per user: **66 schițe** (un singur user), detalii max 8 —
  pragul de „zeci" s-a atins deja pe schițe. Tot neglijabil ca performanță la 66 rânduri, dar premisa
  „nimeni nu se apropie" nu mai e adevărată. **Reminder**: dacă acel user (sau altul) trece clar de 100+,
  adaugă `LIMIT` + fetch separat la expand (paginare reală) — nu de făcut preventiv acum.
- (Candidat, neconfirmat ca obligație recurentă: test periodic de restore pe backup-ul DB — există doar
  backup automat, nu verificare că restore-ul chiar funcționează.)
- **După ORICE SQL manual rulat pe Neon (skill `neon-sql`) → rulează și `npm run db:generate` local**,
  ca istoricul din `db/migrations/` să rămână sincron cu `db/schema.ts` — vezi capcana din secțiunea de
  mai jos („`db/migrations/` poate diverge silențios..."). `db:generate` NU atinge nicio bază (doar diff schema→istoric local),
  deci e sigur de rulat oricând, spre deosebire de `db:push`/`db:migrate`.
- **Revizuire lunară allowlist Dependabot** (mutat din backlog, 2026-08-25): o excepție tolerată azi pe
  `brace-expansion` (dismissed 2026-07-27 ca `tolerable_risk`, dev/build-time only) — la checkpoint-ul
  lunar verifică dacă a apărut fix compatibil (eslint 10 stabil?) → upgrade + scoate intrarea din
  allowlist-ul Dependabot.

---

## Standarde moștenite (`D:\Claude_Development_Rules`)
Sursa de adevăr pentru inginerie/securitate. Skill-urile globale (`security-audit`, `clean-architecture`,
`ui-ux-review`, `secure-api-route`) le aplică automat. `Backend.md` / `Frontend.md` sunt **path-scoped** și se
încarcă singure când lucrezi în paths-urile lor (`auth/`, `users/`, `*.tsx`, `components/`). Din ele,
**convenții concrete adoptate în DETALIA** (le respectăm de la scaffold):

**API (route handlers `app/api/...`):**
- Răspuns JSON; timestamps ISO 8601; sesiune via **cookie HttpOnly** (gestionată de Auth.js).
- **Format unic de eroare:** `{ "error": { "code", "message", "details?" } }`.
  Coduri standard: `VALIDATION_ERROR`(400) · `UNAUTHORIZED`(401) · `FORBIDDEN`(403) · `NOT_FOUND`(404) ·
  `CONFLICT`(409) · `UNPROCESSABLE`(422) · `RATE_LIMITED`(429) · `INTERNAL_ERROR`(500, fără internals).
- Authz: `401` (lipsă auth) / `403` (rol greșit) — **niciodată `404` ca să ascunzi existența**.
  Fără stack-trace / erori SQL / căi în răspuns. Rate-limit pe endpoint-urile sensibile.
- Valori tunable (TTL token magic-link etc.) **în env, niciodată hardcodate**.

**DB (Drizzle / Postgres):**
- Tabele `snake_case` plural; coloane `snake_case` singular. PK `uuid DEFAULT gen_random_uuid()`.
- `created_at` / `updated_at` standard; **toate FK indexate**; **migrații reversibile**.

**Divergență față de `Backend.md`:** DETALIA folosește **magic link passwordless** (Google OAuth scos) →
endpoint-urile de register/login-cu-parolă/reset-password/MFA din `Backend.md` **NU se aplică**. Sesiunile, tokenurile și
adapter-ul de DB le **gestionează Auth.js** (nu le mâna manual). Reținem de acolo doar: format eroare,
non-enumerare, logging fără valori sensibile, env pentru config.

---

## Fluxul de lucru per task (SDLC minimal)
**Fluxul complet (7 pași) + Definition of Done sunt GLOBALE din 2026-07-11** — vezi `CLAUDE.md` global
§„Per-task SDLC flow". Aici doar specificul DETALIA:
- Migrație de schemă → SQL brut dat lui Liviu pentru AMBELE ramuri Neon (dev + prod) — vezi skill `neon-sql`.
- Auditul de securitate complet (13 categorii) e pe listă ÎNAINTE de lansarea publică (vezi `.remember/remember.md`).
- **Igienă observabilitate post-refactor + scanare `knip`** — remindere recurente, vezi secțiunea
  „Mentenanță recurentă" mai sus (nu se duplică aici).

### Rollback — dacă `main`/producția se strică după merge
Procedură completă (Vercel „Promote to Production" + schema Neon + reparare pe `dev`) în
`docs/DEPLOY.md` §2c punctul 4. Rezumat: rollback de cod e INSTANT (Vercel), rollback de schemă NU e automat
(SQL manual dacă e nevoie) — verifici compatibilitatea înainte să presupui că un simplu „promote" repară tot.

### Alertare activă pe erori de producție — VERIFICAT
Verificat DIRECT pe PostHog (MCP, 2026-08-18) — 2 alerte active, ambele `enabled: true`, cu status
sănătos: „Post to Slack on issue created" și „Post to Slack on issue spiking" (create 2026-07-15,
`error_tracking_alerts`, destinație Slack). Erorile de producție chiar notifică activ, nu doar se
strâng pasiv. (Secțiunea asta menționa Sentry până la 2026-08-18 — stale, scris înainte de decommission-ul
din 2026-07-16 și nemaiactualizat de atunci; PostHog e unealta reală, folosită concret.)

### Jurnal de incidente
Orice incident REAL de producție (nu confuzii clarificate) → rând scurt în `docs/INCIDENTS.md` (ce, cauza
verificată, impact, fix). Handoff-ul se rescrie/comprimă în timp; jurnalul de incidente rămâne istoric peste luni.

---

## Convenții de lucru (specifice acestui proiect)
- **Regulile de colaborare sunt GLOBALE** (sursa: `rules/working-style.md` din config-ul global, nu se
  dublează aici): română · aprobare pe PLANURI nu pe pași · un fix pe rând · teste split (eu rulez UNIT,
  Liviu rulează E2E — hook `block-tests` blochează doar e2e) · build/type-check după schimbări de
  tipuri/schemă · git exclusiv de Liviu din VS Code (mesaj de commit sugerat de mine; niciodată pe `main`).
- **Documentație** în `docs/`. **Changelog detaliat cu dată** în `docs/CHANGELOG.md` (cel mai recent sus).
- **Handoff** „unde am rămas" în `.remember/remember.md` după fiecare oprire. **Handoff-ul = briefing, nu arhivă:**
  ce e închis/implementat se trece ca **o linie cu referință la CHANGELOG** (ce + dată → vezi changelog), NU cu
  detaliu complet. Handoff-ul ține doar **context viu + următorii pași**; detaliul istoric trăiește în `CHANGELOG.md`.
- **Docs librării:** folosește **context7 MCP** înainte de a scrie cod cu Next.js / Auth.js / Drizzle /
  perfect-freehand (API-uri se schimbă des). Se aplică și la DEBUGGING: orice ipoteză despre cum se comportă
  intern un API de librărie (ex. ce atribute păstrează `cookies().delete()`) se verifică cu context7 ÎNAINTE
  de a propune un fix — nu după ce ai ghicit greșit.
- **Nu iau decizii de design/UI singur.** La un fix de consistență/vizual aliniez DOAR ce diferă explicit;
  nu adaug elemente noi (butoane/CTA "ca să arate complet") — propun și întreb înainte.
- **UI nou → verifică `docs/UI-REGISTRY.md` întâi** (modal, card, buton de pericol, pastilă de rol —
  pattern-uri deja stabilite, nu reinventa). După o componentă nouă reutilizabilă, adaugă-i o secțiune
  scurtă acolo.
- **Nu dramatizez probleme minore.** Când o eroare (PostHog, test flaky) n-are dovadă de impact real asupra
  userilor/producției, spun direct din prima frază „nu e grav, are legătură cu X și Y" — nu tonuri alarmante.
- **Nu verific din inițiativă** (Playwright/browser/screenshot). Verificarea o cere Liviu explicit.
- **La bug/incident: verific ÎNTÂI cu dovadă directă** (query SQL, `git log`, cod) — nu teoretizez cu voce
  tare o cauză înainte s-o confirm. Dacă nu am dovadă, spun "nu știu cauza, iată ce pot verifica", nu
  prezint o ipoteză ca fiind aproape sigură (lecție din incidentul DB 2026-07-06).
- **Pe lucrări CRITICAL** (auth, sesiune, permisiuni, bani): rulez singur, din proprie inițiativă, o trecere
  adversarială (sesiune expirată/stale, acțiuni concurente, input de la client rău-intenționat, dispozitive/
  tab-uri multiple, back-button după logout) — nu aștept ca Liviu să numească fiecare scenariu.
- **NU folosesc formularea „de confirmat de Edi" / „decizie cu Edi"** — nici în răspunsuri, nici în cod/docs.
  Liviu e singura interfață de decizie; când lipsește o informație de produs pun default neutru ("draft"/"de
  reconfirmat", fără nume) și, dacă chiar trebuie, întreb pe Liviu.

### Capcane tehnice cunoscute
- **Cookie sesiune persistent** — `authjs.session-token` persistă în browser; test ca anonim = incognito/clear cookies.
- **Drift schema Neon** — `production` și `preview/dev` sunt baze SEPARATE; orice `ALTER TABLE` se aplică manual
  pe AMBELE ramuri, altfel apare drift (verificat cu `SELECT count(*)`/`\d tabel`, nu presupus).
- **Verificările Neon via MCP țin compute-ul treaz** — orice query (chiar `describe_project`/`run_sql` SELECT)
  resetează timer-ul de suspend (`suspend_timeout_seconds: 300`). Dacă compute-ul pare „mereu activ" fără
  useri, verifică întâi dacă NU e efectul propriilor verificări repetate (2026-07-15) înainte să suspectezi
  un bug real.
- **Migrație distructivă fără verificare = pierdere de date reală** (s-a întâmplat 2026-07-02 pe `category_id`).
  Înainte de orice `DROP COLUMN`/migrație distructivă pe branch real: verific efectiv că tabelul e gol pe
  branch-ul țintă, nu presupun din handoff.
- **Turbopack CSS HMR stale pe Windows** — `globals.css` nu se recompilează mereu la salvare; clase Tailwind
  noi nu se aplică deși codul e corect → re-salvez fișierul / restart `.next`.
- **Comandă Playwright `-g` filtrată pe un test din `describe.serial`** — dacă testul țintă depinde de unul
  anterior din același bloc (variabile module-level: `sketchId`, `canvasId` etc.) și acela nu rulează, testul
  filtrat pică cu o eroare falsă (ex. `getByTestId('sketch-tab-null')`). Verific dependența serial înainte de
  a da o comandă `-g` — dacă există, dau fișierul întreg (`npx playwright test e2e/<fisier>.spec.ts`).
- **Asertările de test (accessible name, ordine logică) nu se presupun din citit codul componentei** — se
  verifică efectiv (accessible name poate concatena text+counter, ex. „Șarpantă 1" nu „Șarpantă"; un ordinal
  citit ÎNAINTE ca a doua entitate să existe poate să nu fie încă setat). `tsc`/`lint` prind erori de tip, NU
  erori de logică de test — nu sunt suficiente pt „gata" pe cod de test.
- **`ref={...}` pe un element din interiorul unui bloc randat condiționat `{stateTogglabil && (...)}`**
  (bug CRITIC găsit 2026-07-16, `detail-actions-menu.tsx`): dacă starea condiției e un toggle real
  (`useState` cu setter, ex. `open`/`setOpen`), elementul (și ref-ul lui) se demontează când condiția
  devine false — orice cod care apelează `ref.current` mai târziu (ex. dintr-un dialog de confirmare
  deschis separat, într-un alt render) găsește `null` și eșuează silențios (fără eroare vizibilă, doar
  acțiunea nu se mai întâmplă). Elementele cu `ref` folosit AFARA momentului randării condiționate
  trebuie montate PERMANENT (props stabile ca `isAuthor`/`canDeleteActiveSketch` sunt OK în bloc
  condiționat — nu comută niciodată; state togglabil NU e OK). Hook automat: `warn-conditional-ref.js`
  (heuristică, nu infailibil — verific manual dacă hook-ul tace, nu presupun automat că e sigur).
- **Subquery corelat Drizzle cu coloană necalificată → corelare mereu falsă, silențios (RECIDIVĂ DE 3 ORI:
  `profileRepo.ts` 2026-07-23, `detailsRepo.ts` `sketchCount` 2026-07-31, `detailsRepo.ts`
  `comment/validation/sketchCount` 2026-08-06 — a treia oară cu impact REAL de producție, contoare 0 în
  feed pentru toți userii, vezi `docs/INCIDENTS.md`).** Un `sql\`...\`` care referă `${tabel.coloană}` al
  query-ului EXTERIOR, dintr-un subquery pe un tabel cu coloană omonimă (aproape orice tabel are `id`,
  multe au `author_id`), se rezolvă de Postgres la coloana subquery-ului însuși, nu la exterior —
  `x <> x`/`x = x`, mereu fals sau mereu adevărat, FĂRĂ eroare SQL, de regulă count 0 silențios. Orice
  subquery corelat NOU → calificare explicită cu `sql.identifier("tabel")`, verificată cu `.toSQL()` +
  date reale, niciodată presupusă din citit codul. Nu e o capcană „rezolvată o dată" — apare la fiecare
  subquery corelat nou, în fiecare fișier.
- **Cascada de FK NU acoperă tabelele polimorfice și nici Blob-ul** *(gol găsit 2026-08-09,
  `projectsRepo.deleteProject`)*: `validations` și `comments` referă ținta prin `target_type`+`target_id`,
  FĂRĂ FK spre `details`/`sketches` → `ON DELETE CASCADE` nu le atinge, iar fișierele din Blob n-au cum să
  cadă în cascadă. Orice ștergere NOUĂ de entitate-părinte (proiect, planșă, orice container viitor) trece
  prin `deleteDetailCascade`/`deleteSketchCascade`, care le șterg manual ȘI colectează URL-urile pentru
  `deleteBlobs`. „Am pus `onDelete: cascade`, deci e rezolvat" e fals aici — rezultatul e rânduri orfane
  spre UUID-uri moarte + fișiere plătite la nesfârșit, ambele complet silențioase.
- **La notificări, verifică accesul DESTINATARULUI, nu al actorului** *(RECIDIVĂ DE 3 ORI în aceeași zi,
  2026-08-09: `notifySketchProposed`, `notifySupplierOffered`, `notifySketchDeleted`)*: gardul de acces
  scris pentru cel care ACȚIONEAZĂ (publisher, furnizor, moderator) nu spune nimic despre cel care
  PRIMEȘTE notificarea — de regulă altă persoană (owner-ul detaliului, autorul schiței), care poate fi
  între timp eliminat din proiect. Fără verificare separată, emailul + notificarea persistată din clopoțel
  îi scurg titlul unui detaliu la care nu mai are acces. Orice `notify*` nou pe un traseu cu proiecte:
  `recipientHasAccess` explicit, pe `recipientUserId`.
- **Un invariant transversal nou nu produce un bug, ci câte unul în fiecare loc care nu trece prin poartă**
  *(lecție 2026-08-09, feature „Proiect": 14 goluri reale în 6 runde de review)*. Când adaugi o regulă de
  vizibilitate/acces peste cod existent scris sub presupunerea opusă, enumeră EXHAUSTIV căile înainte de
  a repara ceva — nu una câte una, pe măsură ce le găsește review-ul. Lista de locuri cu risc în DETALIA:
  feed + rail-uri (`detailsRepo`, `usersRepo.listTopAuthors`), profil public (`profileRepo`: heatmap,
  statistici `given`/`received`, taburile Detalii/Schițe/Activitate), teasere publice (`/s/[id]`), toate
  `notify*`, listele private (`/saved`, „Ofertele mele"), planșele (`plansaService`), și fiecare mutație
  care citește un detaliu direct din `detailsRepo.getDetailById`, ocolind poarta.
- **`Response.redirect()` întoarce headers IMUABILE** *(bug de producție 2026-08-09, `proxy.ts`)*: orice
  `res.headers.append("Set-Cookie", ...)` pe rezultatul lui aruncă `TypeError: immutable` → 500 în loc de
  redirect. În middleware/proxy folosește `NextResponse.redirect()` + `res.cookies.set()`. Bug-ul poate sta
  ascuns luni pe o ramură rar-lovită și să explodeze când o schimbare o pune pe calea principală.
- **Funcție pasată ca prop dintr-un Server Component către un Client Component → crash real, nu warning**
  *(bug de producție 2026-08-11, `projects/[id]/page.tsx` → `content-grid.tsx`)*: `page.tsx` (Server
  Component) pasa `canManageShares={(id) => ...}` inline către `ContentGrid` ("use client") — Next.js
  RSC nu poate serializa funcții peste graniță (excepție: Server Actions explicit `"use server"`),
  pagina arunca eroare și randa boundary-ul de eroare la fiecare încărcare. Orice prop nou dinspre un
  fișier fără `"use client"` către unul cu `"use client"` trebuie să fie date serializabile (primitive/
  obiecte/array-uri) — dacă componenta client are nevoie de o decizie derivată (ex. „poate userul X să
  șteargă Y"), pasează primitivele brute (`isOwner`, `currentUserId`) și calculează local, în client.
- **`db/migrations/` (istoricul tracked în repo) poate diverge silențios de `db/schema.ts` ȘI de baza
  live** *(gol găsit 2026-08-18, `users`: `seen_badges`, `last_seen_announcement_version`,
  `seen_detail_tour`)*: SQL rulat manual pe Neon (regula normală, skill `neon-sql`) actualizează baza
  reală, dar dacă nimeni nu rulează `npm run db:generate` după, istoricul din repo rămâne în urmă — FĂRĂ
  nicio eroare, nimic nu pică (aplicația citește direct din `schema.ts`, nu din migrații). Consecința nu
  e imediată: apare abia dacă cineva reconstruiește o bază nouă din `db/migrations` (test PGlite, mediu
  nou) — atunci lipsesc coloane și totul pică la insert. Orice sesiune care rulează SQL manual pe Neon →
  `db:generate` imediat după, în ACEEAȘI tură (fișier local, nu atinge nicio bază, sigur de rulat oricând).
- **„Un invariant transversal nou..." (mai sus) are acum un test de regresie**: `server/repos/project-visibility.test.ts`
  (2026-08-18, pe infra PGlite din `db/test-db.ts`) verifică simultan 7 căi publice (feed, autori, profil,
  statistici) că exclud detaliile de proiect. NU acoperă încă: `/s/[id]`, `notify*`, `/saved`+„Ofertele
  mele", `plansaService` — o cale nouă de citire în afara astea tot trebuie verificată manual.
- **`workflow_dispatch` din GitHub UI — dropdown-ul de branch rămâne pe `main` dacă nu-l schimbi explicit
  ÎNAINTE de „Run workflow"** *(găsit 2026-08-22, `zap-baseline.yml`)*: selectarea vizuală a altui branch nu
  se prinde întotdeauna dacă e făcută după ce dialogul e deja deschis pe default — rularea pornește tăcut pe
  `main`, fără eroare, doar cu codul vechi. Verifică ÎNTOTDEAUNA `headBranch` din rulare (`gh run view <id>
  --json headBranch`) înainte să tragi concluzii dintr-un rezultat neașteptat — nu presupune că branch-ul
  cerut e cel care a rulat efectiv. Cel mai sigur: declanșează din CLI cu `--ref <branch>` explicit.
- **Step-ul `ZAP Baseline Scan` apare roșu („failed") în UI chiar și când scanul a rulat complet și corect**
  *(comportament normal al `zaproxy/action-baseline`, nu bug)*: acțiunea marchează step-ul failed automat
  când găsește orice WARN/FAIL (`fail_action` default true) — roșu ≠ scan eșuat. Dovada reală de succes:
  liniile `Total of N URLs` + `PASS/WARN-NEW` din log, și step-ul `Upload raport` verde (artifact urcat).
  Nu trage concluzia „a picat" doar din statusul vizual al job-ului.
- **Tab/selecție „activă" ținută ca INDEX de array, nu ca id → schimbă silențios ce se afișează dacă
  lista se reordonează sub picioarele userului** *(bug real de produs, 2026-08-25,
  `detail-workspace.tsx`, găsit din eșecul intermitent `sketch.spec.ts:74`, dovedit cu screenshot, nu
  presupus)*: `setTabAndUrl` făcea `router.replace` pe query string, care re-fetch-uiește datele de pe
  server; dacă altcineva publică o schiță pe ACELAȘI detaliu în același interval, ordinea (cea mai
  nouă primă) se schimbă, iar un index numeric rămas fix arăta tăcut ALTĂ schiță (autor greșit, buton
  de ștergere legat de formularul greșit) — reproductibil real, nu doar în e2e, oricând doi useri
  interacționează simultan pe același conținut. Fix: tab-ul activ ținut ca `id | null`, derivat prin
  `find` cu fallback sigur pe starea de bază dacă id-ul nu mai există — exact pattern-ul deja folosit
  în ACELAȘI fișier pentru `openAnnotation`/`layersOwnerId` (comentat acolo explicit: „comparăm cu
  id-ul, nu cu indexul"), doar că nu fusese aplicat și tab-ului propriu-zis. Orice stare nouă de
  „element activ dintr-o listă care se poate schimba sub el" → id, niciodată index.

### Guardrails de repo (active)
- **Documentația = parte din Definition of Done.** Orice set de modificări actualizează `CHANGELOG.md` + docul
  afectat + handoff. La PR, checklistul din `.github/pull_request_template.md` confirmă (docs, build, teste, securitate).
- **`SCHEMA.md` = design doc; sursa de adevăr e CODUL** (`db/schema.ts`). La divergență câștigă codul;
  actualizează docul sau marchează „verifică în cod".
- **CI** (`.github/workflows/ci.yml`): type-check + lint + build pe fiecare PR (dev/main). Build verde ≠ teste verzi.
- **Hooks locale** (`.claude/`, NU în repo — opțiunea A): `block-pii-log`, `block-secrets`, `block-push-main`,
  `lint-web`, `warn-conditional-ref` (semnalează `ref` în bloc condiționat pe state togglabil — vezi
  capcana de mai sus), `review-checkpoint` (contor mecanic: peste 12 modificări de cod de producție de la
  ultimul `/code-review` real → blochează, cere explicit review-ul; reset la invocarea skill-ului
  `code-review`). **De ce mecanic, nu doar memorie** (2026-07-16): regula de proces „nu înlănțui feature
  după feature fără verificare" era deja notată explicit în memorie și tot a fost sărită de mai multe ori
  în aceeași sesiune — un contor care blochează efectiv nu se poate „uita".

---

## Decizii de produs
Mutate în `CONTEXT.md` §„Decizii de produs confirmate" / §„Decizii deschise".
