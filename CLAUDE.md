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

## Fluxul de lucru per task (SDLC minimal — obligatoriu, nu opțional)
> Motivul: fără asta, se acumulează „de testat mai târziu" până devine varză (lecție 2026-07-06 — s-au
> recuperat într-o sesiune teste e2e pentru feature-uri vechi de săptămâni). Testul e parte din task,
> NU o fază separată făcută în bloc altă dată.

Orice feature/fix trece prin pașii de mai jos, ÎN ACEEAȘI sesiune/task — nu se declară „gata" cu pași săriți:

1. **Definește** — ce, cu ce scop, ce e explicit OUT of scope (deja: „un fix pe rând").
2. **Clasifică** — SMALL / NORMAL / CRITICAL (`/classify` sau spontan, vezi CLAUDE.md global §Step 0).
3. **Implementează.**
4. **Testează, proporțional cu clasificarea** — NU amânat:
   - SMALL → sanity check; poate fără test nou (decizie explicită, nu omisiune tăcută).
   - NORMAL → unit pt logică nouă + minim un test de integrare/e2e pe fluxul principal (happy path).
   - CRITICAL → unit + integrare + e2e + trecere adversarială (deja: regula de gândire adversarială proactivă).
5. **Review scurt** (verificare proprie; code-reviewer/security-engineer pe NORMAL/CRITICAL).
6. **Documentează** — CHANGELOG (+ doc afectat dacă schimbă contracte/schema).
7. **Task închis** — dacă un pas s-a sărit conștient (ex. SMALL fără test), se spune explicit, nu se ascunde.

**Declanșator simplu pentru Liviu:** la finalul oricărui task, întrebi „unde e testul?" — ca la build/typecheck.
Nu trebuie să știi să scrii teste; trebuie doar să ceri dovada. Clasificarea (deci proporția testului) o fac eu.

**Recurent, NU continuu — checkpoint la ~1 lună (sau la fiecare N feature-uri mari):** o trecere scurtă
„ce s-a construit fără test în perioada asta?" — nu un audit complet. Listă goală = disciplina ține.
Listă nu-goală = se recuperează, dar ca excepție rară, nu ca normalitate.

**Auditul de securitate STRICT (13 categorii, `security-audit`) rămâne obligatoriu la momente-cheie, NU
înlocuit de disciplina de mai sus:** înainte de lansarea publică (deja pe listă, vezi `.remember/remember.md`),
la orice schimbare pe auth/permisiuni/plăți/date sensibile (CRITICAL, oricând), și după incidente reale.
Disciplina per-task elimină nevoia de „audit de recuperare" pe cod deja livrat — nu elimină nevoia de audit
complet înainte de expunere publică reală sau pe zone cu risc mare.

### Definition of Done — bifă rapidă (nu doar proză)
Înainte să declar un task „gata" (NORMAL/CRITICAL — pe SMALL e opțional dacă decizia de a sări e explicită):
- [ ] Clasificat (SMALL/NORMAL/CRITICAL) — spus explicit, nu implicit
- [ ] Implementat conform scope-ului definit (fără scope creep)
- [ ] Testat proporțional (unit/integrare/e2e — sau motiv explicit dacă nu)
- [ ] `tsc --noEmit` / lint / build rulate dacă s-au atins tipuri/schema
- [ ] CHANGELOG actualizat (+ doc afectat dacă schimbă un contract/schema)
- [ ] Dacă a fost o migrație de schemă → SQL dat pe AMBELE ramuri Neon (dev + prod)
- [ ] Mesaj de commit sugerat lăsat pentru Liviu

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
- **Nu iau decizii de design/UI singur.** La un fix de consistență/vizual aliniez DOAR ce diferă explicit;
  nu adaug elemente noi (butoane/CTA "ca să arate complet") — propun și întreb înainte.
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
- **Migrație distructivă fără verificare = pierdere de date reală** (s-a întâmplat 2026-07-02 pe `category_id`).
  Înainte de orice `DROP COLUMN`/migrație distructivă pe branch real: verific efectiv că tabelul e gol pe
  branch-ul țintă, nu presupun din handoff.
- **Turbopack CSS HMR stale pe Windows** — `globals.css` nu se recompilează mereu la salvare; clase Tailwind
  noi nu se aplică deși codul e corect → re-salvez fișierul / restart `.next`.

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
- Notificări **doar in-app** (email oprit 2026-07-03, repornibil din env — vezi mai sus).

## Decizii deschise
- **Surse de verificare automată a rolului** (OAR/CUI confirmate?), dincolo de manual-admin: **pe HOLD**.
- Vezi `.remember/remember.md` §„Decizii / HOLD" pentru lista completă la zi (Termeni și Condiții, firmă/SRL,
  specializări pe profil).
