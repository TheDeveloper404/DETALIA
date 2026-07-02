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
  **Notificările merg in-app ȘI pe email de la început** (via Resend), pentru brand awareness/recall.
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

## Convenții de lucru (specifice acestui proiect)
- Răspuns **în română**. Nu încep cod fără „da" explicit. Un fix pe rând.
- **Teste:** marker `HUMAN_RUNS_TESTS` activ → **userul rulează testele**. Eu le scriu + spun ce/unde.
  `tsc --noEmit` / `next build` le pot rula eu (nu-s „teste").
- După schimbări de **tipuri/schemă** → rulez **build / type-check**, nu doar mă bazez pe teste.
- **Git:** userul comite/push singur din **VS Code Source Control**. Eu las **mesaj de commit sugerat** după
  fiecare set de modificări. Nu raportez ce e comis. Niciodată direct pe `main` (`dev` → PR).
- **Documentație** în `docs/`. **Changelog detaliat cu dată** în `docs/CHANGELOG.md` (cel mai recent sus).
- **Handoff** „unde am rămas" în `.remember/remember.md` după fiecare oprire. **Handoff-ul = briefing, nu arhivă:**
  ce e închis/implementat se trece ca **o linie cu referință la CHANGELOG** (ce + dată → vezi changelog), NU cu
  detaliu complet. Handoff-ul ține doar **context viu + următorii pași**; detaliul istoric trăiește în `CHANGELOG.md`.
- **Docs librării:** folosește **context7 MCP** înainte de a scrie cod cu Next.js / Auth.js / Drizzle /
  perfect-freehand (API-uri se schimbă des).

### Guardrails de repo (active)
- **Documentația = parte din Definition of Done.** Orice set de modificări actualizează `CHANGELOG.md` + docul
  afectat + handoff. La PR, checklistul din `.github/pull_request_template.md` confirmă (docs, build, teste, securitate).
- **`SCHEMA.md` / `API.md` = design docs; sursa de adevăr e CODUL.** La divergență câștigă codul; actualizează
  docul sau marchează „verifică în cod".
- **CI** (`.github/workflows/ci.yml`): type-check + lint + build pe fiecare PR (dev/main). Build verde ≠ teste verzi.
- **Hooks locale** (`.claude/`, NU în repo — opțiunea A): `block-pii-log`, `block-secrets`, `block-push-main`, `lint-web`.

---

## Decizii de produs confirmate
- **Login passwordless: magic link (Resend)** — confirmat. **Fără parolă.** *(Google OAuth a fost scos pentru MVP — vezi CHANGELOG 2026-06-23; schela de re-adăugare rămâne documentată în `lib/auth.ts`.)*
- **Acces PUBLIC** (înregistrare deschisă, fără invitație) — confirmat. Flux: landing → creare cont → email
  magic link → onboarding profil (rol, subrol, poză) → feed.
- **Upload de detalii DESCHIS** oricărui user cu rol declarat (nu doar admin/seed) — confirmat. Moderare post-publicare.
- **Taxonomia de categorii + meseriile** — finalizate și implementate 2026-07-02 (vezi CHANGELOG).
- **Zone climatice/seismice + încărcare zăpadă/vânt** — liste fixe, implementate 2026-07-02 (vezi CHANGELOG).
- **Resurse suplimentare** — rămân IMAGE/LINK/PDF/TEXT (nu doar imagini).
- **Seed 50–100 detalii** (~2 per categorie, proporțional cu nr. categoriilor), prin **conturi reale** (echipa +
  useri aduși din toate categoriile principale) — ca platforma să nu fie goală la start. *(Decis, neexecutat —
  vezi `.remember/remember.md`.)*
- **Schiță asincronă GitHub-style** (o foaie = un autor, NU real-time) — confirmat. Schițarea = **feature obligatoriu în MVP**.
- **Un singur rol per user** (nu roluri multiple), plus **rol adițional opțional** (Administrativ/Educație), aditiv.
- **Rol auto-declarat** la signup + verificare în platformă cu badge (NU atribuit de admin).
- **Verificarea rolului = „pull, nu push"** — opțională, fără blocare, rol neverificat funcțional 100%, nudge
  blând; userii vin singuri să se verifice, motivați de credibilitate. Fără scoring numeric.
- Notificări **in-app + email** de la început.

## Decizii deschise
- **Surse de verificare automată a rolului** (OAR/CUI confirmate?), dincolo de manual-admin: **pe HOLD**.
- Vezi `.remember/remember.md` §„Decizii / HOLD" pentru lista completă la zi (Termeni și Condiții, firmă/SRL,
  specializări pe profil).
