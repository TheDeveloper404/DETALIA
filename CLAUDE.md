# DETALIA — Instrucțiuni de proiect

> Acest fișier completează regulile globale (`C:\dev\persist\claude\CLAUDE.md` — proces, clasificare,
> quality gates, securitate) cu **specificul DETALIA**: domeniu, model de date, reguli de business, structură.
> Globalul câștigă pe proces/securitate; aici stă „ce înseamnă lucrurile" în acest produs.
> Arhitectura completă: `docs/ARHITECTURA.md`. Varianta non-tehnică: `docs/plan nontehnic.md`.

---

## Ce este DETALIA
Comunitate profesională din construcții, organizată în jurul **detaliului de execuție**. Modelul mental:
**„GitHub pentru construcții"** — detaliu = repo, schiță = fork+PR, validare = code review. Faza curentă:
**validare de piață** (cost ~$0, livrare rapidă, fundație care scalează fără rescriere). Lansare = **acces
public deschis** (înregistrare liberă), cu **conținut seed** pus la început prin conturi reale (echipa +
useri aduși din toate categoriile) ca platforma să nu fie goală la primul contact.

Întrebarea pe care MVP-ul o testează: *dacă pun un detaliu bun în față, se aprinde dezbaterea pe roluri?*

---

## Stack (confirmat)
Single-app **Next.js (App Router)** pe **Vercel** · **Neon Postgres** + **Drizzle** · **Auth.js v5** —
**magic link (Resend)**, passwordless (fără parolă) — *Google OAuth scos pentru MVP; schela de re-adăugare e documentată
în comentarii (`lib/auth.ts`)* · **Resend** (email) · **Vercel Blob** (stocare) · **Canvas + perfect-freehand** pentru schiță.
NU monorepo Fastify în această fază (motivare: `docs/ARHITECTURA.md §2`). Business izolat în `server/` ca
extragerea spre API separat ulterior să fie posibilă fără rescriere.

---

## Glosar de domeniu (limbaj unic — folosește acești termeni în cod și UI)
- **Detaliu** (`Detail`) — unitatea de conținut (~repo). Titlu, autor+rol, categorie, opțional zonă
  climatică/seismică, 1 imagine 2D, opțional 2–3 resurse.
- **Schiță** (`Sketch`) — o „foaie" desenată peste un detaliu-mamă, cu **un singur autor** (~fork+PR).
- **Validare** (`Validation`) — poziția unui user pe un detaliu SAU pe o schiță: **Aprob** / **Dezaprob**.
- **Rol / Subrol** — PROIECTANT / EXECUTANT / FURNIZOR / BENEFICIAR + subrol (arhitect, inginer, etc.).
- **Teanc** — totalitatea schițelor PUBLISHED ale unui detaliu (navigabile prin taburi).

---

## Reguli de business NON-NEGOCIABILE (enforce pe SERVER, nu pe frontend)

### Validarea pe roluri (inima)
- Buton **identic** pentru toți. Lângă fiecare poziție/comentariu se afișează **numele + rolul**.
- **Aprob = 1 click.** **Dezaprob = justificare OBLIGATORIE** → respinge pe server dacă lipsește; justificarea
  devine automat un `Comment` (cu `originValidationId`), atribuit nume+rol. **Nu există „dezaprobare mută".**
- **O singură poziție per user per țintă, reversibilă** — garantat de constrângere unică în DB
  `(userId, targetType, targetId)`.
- **FĂRĂ ponderare numerică / scor / reputație în MVP.** Greutatea o judecă cititorul uitându-se la rol.
  Noi doar afișăm rolul corect și transparent. (Scoring = backlog, decizie de produs separată.)

### Discovery (feed & căutare)
- Feed **finit, ~20 detalii** sortate după interacțiuni — **FĂRĂ scroll infinit** (caracter de comunitate, nu social media).
- La început doar **filtre** + căutare simplă; căutarea liberă „cu vorbele tale" vine mai târziu.

### Schița — state machine (enforce în `SketchService`)
```
DRAFT ──(autorul dă PUBLISH)──▶ PUBLISHED  (intră DIRECT în teanc, public)
```
- **Simplificat 2026-06-30:** schițele se publică **direct** (fără coadă de acceptare). Modelul
  „accept autor-mamă" a fost eliminat. *(Valorile `PENDING_ACCEPTANCE`/`REJECTED` rămân în enumul DB doar pentru
  date istorice — nu se mai produc.)*
- **Moderare POST-publicare:** autorul detaliului-mamă **SAU** autorul schiței poate **ȘTERGE** o schiță
  (`deleteSketch`, ownership pe server, cascadă validări+comentarii+blob). Nu există aprobare/respingere.
- La PUBLISH → `Notification` către autorul detaliului-mamă („X a schițat peste «detaliu» → vezi în teanc").
  La ștergerea de către autorul-mamă → `Notification` (`SKETCH_DELETED`) către autorul schiței.
  **Notificările merg doar in-app** (decizie 2026-07-03: emailurile de notificare OPRITE — cota Resend
  free rămâne pentru magic link-uri; repornibile cu `NOTIFICATION_EMAILS_ENABLED=true`).
- **Validarea pe propriul conținut e interzisă** (`CANNOT_VALIDATE_OWN`, enforce pe server): autorul nu vede
  Aprob/Dezaprob pe propriul detaliu/schiță. Aprobarea propriului conținut e implicită prin publicare.
- **Dezaprobare = alegere binară** (pe detaliu): „Scrie o justificare" (text → comentariu) SAU „Fă o schiță"
  (desenul **e** justificarea). La varianta schiță, poziția DISAPPROVE + comentariul se materializează **la
  publicarea schiței** (draft marcat `disapprovesParent`), nu la click → fără „dezaprobare mută" la abandon.
- Schițarea e **asincronă** (fiecare foaie un autor). **FĂRĂ co-desenare real-time în MVP.** (Model confirmat.)
- Stroke-uri stocate **vectorial** (`strokesJson`, coordonate **normalizate 0..1** față de imaginea-mamă).
  La publicare se randează **o singură dată** un thumbnail PNG (Blob) pentru hover-slideshow/liste.
- **UX la intrarea în modul schiță:** detaliul-mamă se afișează cu **fill slab** (intensitate redusă, nu la
  intensitatea naturală) — semnal vizibil că s-a declanșat schițarea + ajută la desenat peste detalii colorate intens.
- **Unelte MVP:** mai multe **culori stridente** + **3 grosimi** de creion + **radieră** + **undo/redo**.
  (Viitor: Line / Circle / Square / Arrow / inserare casetă text.)
- `Validation` și `Comment` sunt **polimorfice** (Detail SAU Sketch) → dezbaterea per schiță vine gratis.

### Acces & roluri
> **Două porți distincte, nu le confunda:** Poarta 1 = **accesul** (cine intră în platformă).
> Poarta 2 = **credibilitatea** (cât „cântărești" odată intrat → rol declarat → verificat). Sunt independente.

- **Poarta 1 — acces: PUBLIC (confirmat, iunie 2026).** Înregistrare deschisă, fără invitație. Flux:
  landing → „creare cont" → email → magic link → onboarding profil (rol, subrol, poză) → feed. *(Logica de
  invitații a fost eliminată complet — 2026-06-28, vezi CHANGELOG; dacă vreodată se vrea acces restricționat,
  se construiește un mecanism nou de la zero.)*
- **Rolul e auto-declarat de user la signup** (categorie + subrol). Acces imediat după declarare → minimizează
  frecarea la primul contact. Rolul e **vizibil permanent** lângă nume.
- **Poarta 2 — verificare rolului = „pull, nu push":** flux separat în platformă ("Verificare rol", inițiat de
  user), **opțional, fără blocare**. Rol neverificat = **funcțional 100%**. Nu stresăm pe nimeni: doar un
  **nudge blând permanent** („Rolul tău nu e verificat → Verifică rolul"). Userii vin **singuri** să se
  verifice, motivați de credibilitate (rol verificat „cântărește" mai mult în ochii cititorului). La verificare
  le cerem niște date; **aprobarea e manuală (admin)** în MVP; OAR/CUI auto = ulterior. Odată verificat →
  **badge cu steluță galbenă** lângă rol (poziția UI exactă — lângă rol și/sau avatar — se decide la implementare).
  Fără scoring numeric: greutatea e dată de rol + faptul că e verificat, judecată de cititor.
- **Upload de detalii DESCHIS userilor (confirmat, iunie 2026).** Orice user autentificat cu **rol
  declarat** poate publica detalii (nu trebuie să fie verificat). **Moderare post-publicare** (publici direct,
  ștergem abuzurile ulterior) — fără cozi de aprobare în MVP. Calitatea o dă validarea/dezbaterea pe roluri.
  Seed-ul inițial e tot prin conturi reale (vezi mai jos), dar uploadul NU mai e limitat la admin/seed.

---

## Arhitectură pe straturi (clean architecture — regula de aur: zero business în handlers/componente)
```
app/        UI (RSC) + route handlers (API) + server actions — SUBȚIRI: validează input, deleagă la service
server/     domain/ (entități, roluri, state machines) · services/ (business) · repos/ (Drizzle)
db/         schema Drizzle + migrații
components/ UI (inclusiv canvas-ul de schițare)
lib/        auth, email, storage, utils
```
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
- **`next-auth` (Auth.js v5) — verificare periodică de versiune** *(confirmat 2026-07-13, audit securitate)*:
  proiectul rulează pe `5.0.0-beta.31` — librăria de autentificare e încă oficial BETA. La checkpoint-ul
  lunar (sau când apare un motiv), verifică `npm view next-auth versions` pentru o beta mai nouă cu fix-uri
  de securitate; folosește context7 dacă ai nevoie de detalii de migrare API.
- **Scanare periodică de cod mort cu `knip`** *(regulă 2026-07-13)*: Sentry/PostHog arată doar ce a crăpat
  vreodată, nu cod mort care n-a aruncat nicio eroare. Rulează `npx knip` ~lunar — fișiere/exporturi
  neutilizate + dependențe nedeclarate. **Nu șterge orbește din rezultat:** Server Actions (`"use server"`)
  apar des fals-pozitiv (apelate din client prin `action={...}`, knip nu le urmărește mereu) — verifică
  fiecare candidat înainte de ștergere.
- **Igienă observabilitate (Sentry/PostHog) după orice refactor/rescriere care elimină cod** *(regulă
  2026-07-13, declanșată de eveniment nu de calendar)*: după ce ștergi/înlocuiești un fișier sau o librărie,
  treci prin dashboard-ul de erori (`is:unresolved`, caută după culprit/fișierele atinse) și închide manual
  ce nu se mai poate reproduce, cu un comentariu scurt de ce. Nu se auto-curăță la refactor.
- **Reminder săptămânal observabilitate** (rutină cloud `/schedule`, luni 09:00 RO) — doar notificare push,
  fără verificare automată de Claude; **PostHog e sursa unică** (Sentry decommission FĂCUT 2026-07-16, mai
  devreme decât planul ~07-22 — vezi CHANGELOG).
- **Liste de pe profil (Detalii/Schițe/Activitate) — fără paginare reală la scară** *(decizie de business,
  2026-07-16)*: UI-ul arată primele 4 + „Vezi încă N" (client-side, `components/profile-view.tsx`), dar
  `listAuthorDetails`/`listAuthorSketches` (`server/repos/profileRepo.ts`) NU au `LIMIT` — se aduc din DB
  TOATE rândurile userului la fiecare încărcare de profil, indiferent câte se afișează. La 2026-07-16,
  maximul real per user era 6 detalii → neglijabil. **Reminder**: dacă vreun user ajunge la zeci de
  detalii/schițe reale, adaugă `LIMIT` + fetch separat la expand (paginare reală) — nu de făcut preventiv acum.
- (Candidat, neconfirmat ca obligație recurentă: test periodic de restore pe backup-ul DB — există doar
  backup automat, nu verificare că restore-ul chiar funcționează.)

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

**Divergență față de `Backend.md`:** DETALIA folosește **magic link passwordless** (Google OAuth scos pentru MVP) →
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

### Alertare activă pe erori de producție — DE VERIFICAT, nu asumat
`docs/DEPLOY.md` menționează Sentry „+ Alerts pe `audit_event`" ca ✅ configurat (2026-07-02/03), dar nu am
verificare directă (dashboard Sentry) că regula de alertă chiar notifică pe Liviu (email/altceva), sau doar
că evenimentele AJUNG în Sentry pasiv. **Nu presupune niciuna din variante — cere lui Liviu confirmarea din
Sentry → Alerts înainte să tratezi asta ca rezolvată sau ca gol.**

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
- **Nu dramatizez probleme minore.** Când o eroare (Sentry, test flaky) n-are dovadă de impact real asupra
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

### Guardrails de repo (active)
- **Documentația = parte din Definition of Done.** Orice set de modificări actualizează `CHANGELOG.md` + docul
  afectat + handoff. La PR, checklistul din `.github/pull_request_template.md` confirmă (docs, build, teste, securitate).
- **`SCHEMA.md` / `API.md` = design docs; sursa de adevăr e CODUL.** La divergență câștigă codul; actualizează
  docul sau marchează „verifică în cod".
- **CI** (`.github/workflows/ci.yml`): type-check + lint + build pe fiecare PR (dev/main). Build verde ≠ teste verzi.
- **Hooks locale** (`.claude/`, NU în repo — opțiunea A): `block-pii-log`, `block-secrets`, `block-push-main`,
  `lint-web`, `warn-conditional-ref` (semnalează `ref` în bloc condiționat pe state togglabil — vezi
  capcana de mai sus), `review-checkpoint` (contor mecanic: peste 12 modificări de cod de producție de la
  ultimul `/code-review` real → blochează, cere explicit review-ul; reset la invocarea skill-ului
  `code-review`). **De ce mecanic, nu doar memorie** (2026-07-16): regula de proces „nu înlănțui feature
  după feature fără verificare" era deja notată explicit în memorie și tot a fost sărită de mai multe ori
  în aceeași sesiune — un contor care blochează efectiv nu se poate „uita".

---

## Decizii de produs confirmate
- **Login passwordless: magic link (Resend)** — confirmat. **Fără parolă.** *(Google OAuth a fost scos pentru MVP — vezi CHANGELOG 2026-06-23; schela de re-adăugare rămâne documentată în `lib/auth.ts`.)*
- **Acces PUBLIC** (înregistrare deschisă, fără invitație) — confirmat. Flux: landing → creare cont → email
  magic link → onboarding profil (rol, subrol, poză) → feed.
- **Upload de detalii DESCHIS** oricărui user cu rol declarat (nu doar admin/seed) — confirmat. Moderare post-publicare.
- **Taxonomia de categorii + meseriile** — finalizate și implementate 2026-07-02 (vezi CHANGELOG).
- **Zone climatice/seismice + încărcare zăpadă/vânt** — liste fixe, implementate 2026-07-02 (vezi CHANGELOG).
- **Resurse suplimentare** — rămân IMAGE/LINK/PDF/TEXT (nu doar imagini).
- **Schiță asincronă GitHub-style** (o foaie = un autor, NU real-time) — confirmat. Schițarea = **feature obligatoriu în MVP**.
- **Un singur rol per user** (nu roluri multiple), plus **rol adițional opțional** (Administrativ/Educație), aditiv.
- **Rol auto-declarat** la signup + verificare în platformă cu badge (NU atribuit de admin).
- **Verificarea rolului = „pull, nu push"** — opțională, fără blocare, rol neverificat funcțional 100%, nudge
  blând; userii vin singuri să se verifice, motivați de credibilitate. Fără scoring numeric.
- Notificări **doar in-app** (email oprit 2026-07-03, repornibil din env — vezi mai sus).

## Decizii deschise
- **Surse de verificare automată a rolului** (OAR/CUI confirmate?), dincolo de manual-admin: **pe HOLD**.
- Vezi `.remember/remember.md` §„Decizii / HOLD" pentru lista completă la zi (Termeni și Condiții, firmă/SRL,
  specializări pe profil).
