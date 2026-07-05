# DETALIA — Arhitectură & Plan de Atac (MVP)

> Document de start, scris pentru a fi prezentat lui Edward și folosit ca referință tehnică.
> Faza proiectului: **validare de piață**. Obiectiv tehnic: cost cât mai aproape de $0, livrare rapidă,
> fundație curată care suportă creșterea fără rescriere.
> Întrebarea pe care MVP-ul o testează: *„dacă pun în fața specialiștilor un detaliu bun, se aprinde
> dezbaterea pe roluri sau nu?"*

---

> 🔄 **DECIZII SUPRASCRISE (iunie 2026) — citește înainte.** Acest doc conceptual rămâne valid pe stack/straturi/schiță,
> dar 3 decizii s-au schimbat de la scriere (vezi `CLAUDE.md` + `ADR.md`):
> 1. **Acces = PUBLIC** (înregistrare deschisă), NU „beta închis pe invitație". **Logica de invitații a fost
>    ELIMINATĂ complet** (2026-06-28, vezi CHANGELOG) — orice mențiune de mai jos despre `Invitation` /
>    `InvitationService` / „invite-only" e ISTORICĂ; codul nu mai există.
> 2. **Upload de detalii = DESCHIS** userilor cu rol declarat (moderare post-publicare), NU „seed-only v1".
> 3. **Verificarea rolului = PE HOLD** (metoda în regândire). Restul (magic link, fără scoring, schiță async) — confirmat.
> Unde textul de mai jos zice „invite-only" / „seed-only", aplică deciziile de aici.

## 0. Rezumat executiv (pentru client)

DETALIA = **comunitatea profesională din construcții, organizată în jurul detaliului de execuție**, unde
fiecare detaliu poate fi aprobat, contestat cu argument și îmbunătățit prin schiță — de către cei care îl
execută sau îl trăiesc, fiecare cu rolul lui afișat transparent.

Tehnic, construim un singur produs web, ieftin la rulare în faza de validare (aproape de **$0/lună** pe
trafic mic), care poate scala fără să-l rescriem când comunitatea crește. Lansăm cu **acces public**
(înregistrare deschisă), cu **conținut seed pus de noi prin conturi reale** ca platforma să nu fie goală la
primul contact, exact ca să controlăm calitatea dezbaterii din prima zi.

Livrăm în etape clare; prima etapă răspunde direct la întrebarea de validare, fără să cheltuim pe ce nu o
servește.

---

## 1. Principiul organizator: „GitHub pentru construcții"

Toată arhitectura derivă din această analogie (a clientului, și e foarte bună):

| GitHub | DETALIA |
|---|---|
| Repository | **Detaliu** (de execuție) |
| Fork / Branch | **Schiță** (o foaie nouă, a unui alt autor, peste detaliul-mamă) |
| Pull Request | Schița propusă → **acceptată de autorul detaliului-mamă** ca să devină publică |
| Code Review (approve/request changes) | **Validarea pe roluri** (Aprob / Dezaprob cu justificare) |
| Comentarii pe PR | **Coloana de comentarii**, atribuite cu nume + rol |
| Stars / trending | **Feed-ul** (top N detalii după interacțiuni) |
| Contributor | **User cu rol verificat** (proiectant / executant / furnizor / beneficiar) |

Consecința cea mai importantă, care **simplifică enorm partea grea**:
schițarea colaborativă din DETALIA este **asincronă, în stilul GitHub (fork + PR)**, NU co-desenare în timp
real în stilul Figma/Google Docs. Fiecare „foaie" are **un singur autor**; oamenii colaborează adăugând
fiecare foaia lui în teanc, nu desenând simultan pe aceeași pânză. Asta elimină din MVP toată complexitatea
de real-time collaborative editing (CRDT, websockets, rezolvare de conflicte) — partea cea mai scumpă și mai
riscantă. O notez aici pentru că schimbă fundamental fezabilitatea.

---

## 2. Stack tehnologic recomandat (și de ce)

**Recomandarea fermă: o singură aplicație Next.js full-stack, pe Vercel, cu Postgres serverless.**

```
detalia/
├─ app/                 # Next.js App Router: pagini (UI) + route handlers (API)
│  ├─ (auth)/           # login / invitație / magic link
│  ├─ (app)/            # feed, detaliu, schițare — zona protejată
│  └─ api/              # route handlers REST (validări, schițe, notificări)
├─ server/              # STRATUL DE BUSINESS (services, state machines, RBAC)
│  ├─ domain/           # entități, modelul de roluri, state machine schiță
│  ├─ services/         # DetailService, ValidationService, SketchService...
│  └─ repos/            # acces date (Drizzle)
├─ db/                  # schema Drizzle + migrații
├─ components/          # UI (inclusiv canvas-ul de schițare)
└─ lib/                 # auth, email, storage, utils
```

### De ce această variantă (și nu un backend separat)

| Criteriu | Next.js full-stack (RECOMANDAT) | Monorepo Fastify + Next |
|---|---|---|
| Cost hosting MVP | ~$0 (un singur deploy) | 2 servicii de plătit/întreținut |
| Viteză până la MVP | Maximă (un singur codebase) | Mai lentă (API + web + contracte între ele) |
| Ops / DevOps | Minim (un deploy, un set de env) | Dublu |
| Potrivit pentru validare de piață | Da | Over-engineering acum |
| Scalare ulterioară | Bună (Fluid Compute, scale-to-zero) | Bună, dar n-avem nevoie încă |

Un API separat (Fastify) ar avea sens **doar dacă** apar consumatori externi (app mobil nativ, integrări
terțe). Nu e cazul la validare. Dacă apare nevoia, stratul `server/` e deja izolat și se poate extrage într-un
serviciu fără să rescriem logica de business — exact de aceea separ business-ul de UI de la început.

### Componentele și de ce (toate cu free tier real)

| Strat | Tehnologie | De ce | Cost MVP |
|---|---|---|---|
| Framework | **Next.js (App Router)** | UI + API într-un loc, Server Components, deploy pe Vercel | $0* |
| Hosting | **Vercel** | Zero-config, preview pe fiecare push, scale-to-zero | $0 hobby / $20 Pro** |
| Bază de date | **Postgres (Neon, via Vercel Marketplace)** | Serverless, scale-to-zero, free tier ~0.5GB, relațional (avem nevoie de relații: roluri, validări, schițe) | $0 |
| ORM | **Drizzle** | Tip-safe, ușor, fără engine binar → cold start mic pe serverless | $0 |
| Auth | **Auth.js (NextAuth v5), provider Email = magic link** | Passwordless, self-hosted, se mulează pe invite-only | $0 |
| Trimitere email | **Resend** | 3.000 emailuri/lună free, SPF/DKIM ușor pe domeniul deținut → magic link-urile ajung în inbox, nu în spam | $0 |
| Stocare imagini/schițe | **Vercel Blob** (sau Cloudflare R2 când crește volumul) | Imaginile 2D ale detaliilor + thumbnail-urile de schiță | $0 free tier |
| Canvas schițare | **HTML5 Canvas + `perfect-freehand`** | Control total, ușor, stroke-uri frumoase; fără editor greu (tldraw/Excalidraw sunt supradimensionate pentru „2 culori + radieră") | $0 (lib open-source) |

\* Next.js e gratuit; costul e doar hostingul.
\*\* **Onestitate față de client:** Vercel Hobby e gratuit dar e gândit pentru proiecte necomerciale. La un
produs comercial, planul corect e **Pro (~$20/lună)**. Pentru pura validare de piață putem porni pe Hobby; în
momentul în care devine clar comercial / public, trecem pe Pro. **Singurul cost garantat în această fază:
hostingul (~$0–20/lună).** Restul stă pe free tier la traficul de început.

### Alternative considerate (și de ce nu acum)
- **Supabase** în loc de Neon+Auth.js: bun, dar leagă auth+db+storage de un singur vendor; preferăm piese
  decuplate, fiecare cu free tier, mai ușor de mutat.
- **Prisma** în loc de Drizzle: perfect viabil, mai matur; am ales Drizzle strict pentru cold start mai mic pe
  serverless. Dacă echipa preferă Prisma, e o decizie reversibilă.
- **Search liber semantic** (embeddings + pgvector): amânat — vezi §8.

---

## 3. Modelul de roluri și validarea rolului

### Roluri principale (4) + meserii (subroluri) — listă finală (2026-07-02)
- **PROIECTANT** → arhitect, inginer constructor, inginer instalații electrice/termice-HVAC/sanitare,
  inginer geotehnician, inginer topograf, verificator proiecte, expert tehnic, auditor energetic,
  peisagist, designer de interior, BIM Manager.
- **EXECUTANT** → constructor general, meșter, electrician, instalator, montator tâmplării, diriginte
  de șantier, RTE.
- **FURNIZOR** → producător materiale, distribuitor materiale, agent vânzări materiale.
- **BENEFICIAR** → beneficiar documentat, dezvoltator imobiliar.
- **Rol adițional opțional** (Administrativ/Educație — arhitect șef, ISC, OCPI, cadru didactic etc.),
  ADITIV peste meseria de bază, nu o înlocuiește. Vezi `server/domain/roles.ts`.

Rolul principal NU se mai afișează în platformă — doar meseria (subrolul), lângă nume. Sursă:
`lista_meserii.md` (poate fi ștearsă, conținutul e în cod; vezi CHANGELOG 2026-07-02).

### Rol declarat vs. verificat — abordare în trepte (decizie confirmată)
Logica: **rolul și-l declară userul singur la signup** (acces imediat → frecare minimă la primul contact),
iar **verificarea e un pas separat, opțional, în platformă**. Greutatea unei interacțiuni e dată întâi de rol,
apoi de faptul că rolul e verificat — așa că fiecare va vrea să-și verifice rolul.

**Filozofia verificării = „pull, nu push".** Nu forțăm și nu blocăm pe nimeni să se
verifice. Rolul neverificat e **complet funcțional** — userul interacționează normal (validează, comentează,
schițează). Presiunea de a te verifica vine **organic, din credibilitate**: când te uiți cine discută pe un
detaliu, specialiștii cu **rol verificat „cântăresc" mai mult** în ochii cititorului decât cei neverificați.
Așa, **userii vin singuri** să-și verifice rolul, ca să fie credibili — noi nu-i stresăm, doar le ținem la
vedere un **nudge blând și permanent** („Rolul tău nu e verificat → Verifică rolul").

1. **La signup:** userul **își declară** rolul principal + subrolul → acces imediat (acces PUBLIC, fără
   invitație — vezi nota de mai jos).
2. **În folosire:** rol = `DECLARED`, funcțional 100%. Nudge permanent, neintruziv, spre fluxul de verificare.
3. **Verificare (MVP):** flux dedicat în platformă („Verificare rol", inițiat de user). Îi cerem niște date;
   aprobarea e **manuală, de admin**. Odată verificat → **badge cu steluță
   galbenă** lângă rol (poziția exactă — lângă rol și/sau lângă avatar — se decide la implementarea UI).
4. **Etapa următoare:** integrări de verificare unde există sursă (ex. arhitecți — registrul **OAR**),
   upload de dovadă (legitimație, CUI firmă) cu aprobare admin.
5. **Mai târziu:** verificare automată / badge-uri de încredere.

> **Nota despre poarta de acces — REZOLVAT (2026-06-28, vezi CHANGELOG/ADR-008).** Verificarea de mai sus
> (Poarta 2 — credibilitate) e independentă de **modul în care userii intră în platformă** (Poarta 1 — acces).
> Planul de „beta închis pe invitație" a fost **eliminat complet** — accesul e PUBLIC, înregistrare liberă,
> fără invitație. Nota veche de „sub reevaluare" nu mai e valabilă.

**Un singur rol per user** — mai curat de afișat și de verificat.

**Nuanță importantă din mail, care simplifică inima aplicației:** greutatea unei validări **NU se calculează
de server** — „greutatea o cântărește cititorul, în funcție de rolul afișat lângă nume". Deci **nu construim
un algoritm de ponderare/reputație în MVP.** Construim doar **afișarea transparentă și corectă a rolului**
lângă fiecare poziție și comentariu. Mult mai simplu și exact ce a cerut clientul.

---

## 4. Modelul de date (entități principale)

```
User
  id, email (unic), name, status (ACTIVE|SUSPENDED|DELETED), createdAt
  // acces PUBLIC (2026-06-28: logica de invitații ELIMINATĂ complet, inclusiv tabelul) — un singur rol
  // per user (declarat la signup) — câmpurile de rol mai jos

Role (declarat de user la signup)
  userId, roleMain (enum), subRole, secondaryRole? (aditiv opțional, ex. Administrativ/Educație),
  verificationStatus (DECLARED|PENDING|VERIFIED|REJECTED),
  verificationEvidence (ex. nr. OAR / CUI), verifiedByAdminId
  // un singur rol principal / user, afișat permanent lângă nume; badge la VERIFIED

Category (arbore)
  id, parentId (self-FK), name, slug
  // ex: Fundație → Beton → Hidroizolare ; Acoperiș → Cornișă → Jgheab

Detail  («repository»)
  id, title, description?, authorId,
  climateZone? (fără default, listă fixă Zona I..IV), seismicAg/seismicTc (default „General"),
  snowLoad/windLoad (default „General"),  // parametri tehnici separați, listă fixă
  imageUrl (imaginea 2D: jpg/png/webp, ~5MB), status, createdAt
DetailCategories       // many-to-many — un detaliu poate avea oricâte categorii (tag-uri, stil Pinterest)
  detailId, categoryId  // PK compus; înlocuiește vechiul FK simplu categoryId de pe Detail
DetailResource         // MAX 3 resurse opționale de înțelegere (imagine + link; PDF/text mai târziu)
  id, detailId, type (IMAGE|LINK|TEXT|PDF), url/body

Sketch  («fork + PR» — o foaie din teanc)
  id, detailId (detaliul-mamă), authorId,
  strokesJson (stroke-urile vectoriale, coordonate normalizate 0..1),
  thumbnailUrl (PNG pre-randat pentru hover-slideshow),
  status (DRAFT → PUBLISHED; valorile vechi PENDING_ACCEPTANCE|REJECTED rămân în enum, nemaifolosite),
  disapprovesParent (true = schiță pornită din „Dezaprob → fac o schiță" → la publicare materializează dezaprobarea),
  acceptedAt (= momentul publicării), createdAt

Validation  («code review» — INIMA, polimorfică pe Detail SAU Sketch)
  id, userId, targetType (DETAIL|SKETCH), targetId,
  position (APPROVE|DISAPPROVE),
  roleSnapshot (rolul userului la momentul poziției, pentru afișare),
  createdAt, updatedAt
  // CONSTRÂNGERE UNICĂ: (userId, targetType, targetId) → o singură poziție/user, reversibilă

Comment
  id, targetType (DETAIL|SKETCH), targetId, authorId, body,
  originValidationId? (setat când vine dintr-un Dezaprob obligatoriu), createdAt

Notification
  id, recipientUserId, type (SKETCH_PROPOSED|SKETCH_DELETED; SKETCH_ACCEPTED|SKETCH_REJECTED = istoric),
  payloadJson, readAt, createdAt
```

Decizii de modelare cheie:
- **`Validation` și `Comment` sunt polimorfice** (țintesc fie un Detaliu, fie o Schiță) → exact același
  mecanism de dezbatere funcționează și pe detaliu, și pe fiecare schiță separat. Cerința „fiecare foaie poate
  fi dezbătută separat" cade din asta gratis.
- **`Validation` are constrângere unică pe (user, țintă)** → „o singură poziție per user, reversibilă" e
  garantat de bază de date, nu de cod fragil.
- **Dezaprob → Comment cu `originValidationId`** → justificarea obligatorie intră automat în comentarii,
  atribuită cu nume+rol, exact ca în mail.

---

## 5. Arhitectura pe straturi (clean architecture)

```
[ UI / Presentation ]   Next.js pages + React Server Components
        │                client components doar unde e nevoie (canvas, modale, validare)
        ▼
[ API ]                 Route Handlers (REST) + Server Actions (mutații)
        │                — subțiri: validează input + cheamă service
        ▼
[ Application/Services ] DetailService · ValidationService · SketchService
        │                InvitationService · NotificationService
        │                — TOATĂ logica de business + state machines + reguli
        ▼
[ Domain ]              entități, modelul de roluri, state machine schiță
        ▼
[ Infrastructure ]      Drizzle repos · Neon Postgres · Resend · Vercel Blob · Auth.js
```

Regula de aur (din standardele noastre): **zero logică de business în route handlers / componente.**
Handler-ul validează inputul și deleagă la service. Asta ține codul testabil și permite extragerea unui API
separat ulterior, fără rescriere.

---

## 6. Inima: validarea pe roluri

Flux, identic pe Detaliu și pe Schiță:
1. Buton **identic** pentru toți (Aprob / Dezaprob). Lângă nume se afișează mereu rolul.
2. **Aprob = 1 click** → creează/actualizează `Validation(position=APPROVE)`.
3. **Dezaprob = obligă justificare** → se deschide modal; la **Send**:
   - se creează `Validation(position=DISAPPROVE)`
   - se creează `Comment(body=justificare, originValidationId=...)` → apare automat în coloana de comentarii,
     atribuit cu **nume + rol**.
   - **Server-side enforced:** dezaprobare fără justificare = respinsă (nu ne bazăm pe frontend).
4. **Reversibil:** userul își poate schimba/retrage poziția (update pe aceeași înregistrare unică).
5. **Fără „dezaprobare mută"** — orice dezaprob are argument, prin construcție.

Nu există ponderare numerică. Greutatea o judecă cititorul, uitându-se la rol. (Reputația/scorul = backlog.)

---

## 7. Partea grea: schițarea colaborativă (deep dive)

Cea mai grea piesă. O sparg în sub-probleme și arăt cum o ținem fezabilă pentru MVP.

### 7.1 Modelul „teanc de foi" (decisiv pentru fezabilitate)
- Fiecare **foaie = o Schiță cu un singur autor**, desenată **peste imaginea detaliului-mamă** (overlay).
- Oamenii colaborează **adăugând fiecare foaia lui în teanc** — NU desenând simultan pe aceeași foaie.
- => **fără real-time collaborative editing în MVP.** (CRDT/websockets/rezolvare conflicte = amânat, e luna de
  muncă pe care n-o cheltuim acum.) Asta e câștigul major de scope.

### 7.2 Fereastra de desen (exact ce a cerut clientul, nimic în plus)
- **Mai multe culori stridente**, **3 grosimi** de creion, **radieră**, **undo/redo (back/forward)**. Atât.
  (Viitor: Line / Circle / Square / Arrow / inserare casetă text — direcție ulterioară confirmată.)
- **Fill slab pe detaliul-mamă** la intrarea în modul schiță: imaginea-mamă se estompează (intensitate redusă,
  nu naturală) → semnal vizibil că s-a declanșat schițarea + ajută la desenat peste detalii colorate intens.
- Implementare: **HTML5 Canvas + `perfect-freehand`** (stroke-uri netede, frumoase).
- **Undo/redo** = stivă de stroke-uri pe client (operație pură, ieftină).
- **Radieră** = stroke cu `tool=eraser`, randat cu `globalCompositeOperation = 'destination-out'`.

### 7.3 Stocare ca VECTORI, nu PNG (recomandarea mea, confirmată de cerințe)
- O schiță = listă ordonată de stroke-uri: `{ tool: pen|eraser, color, size, points: [{x,y}, ...] }`.
- **Coordonate normalizate 0..1** față de imaginea-mamă → schița se scalează corect pe orice ecran/dispozitiv.
- Avantaje față de PNG: mic în DB, **redabil**, scalabil, dezbătut/diff-uit per foaie, viitor-proof.
- La publicare, randăm **o singură dată** un **thumbnail PNG** (în Vercel Blob) pentru hover-slideshow și
  liste — ca să nu re-randăm vectorii la fiecare hover.

### 7.4 Fluxul de publicare (state machine) — **simplificat 2026-06-30**
```
DRAFT ──(autorul dă PUBLISH)──▶ PUBLISHED  (intră DIRECT în teanc, public)
```
> **Schimbare de model (vezi CHANGELOG 2026-06-30):** coada de acceptare `PENDING_ACCEPTANCE`
> a fost **eliminată**. Schițele se publică **direct**; moderarea e **post-publicare** prin ștergere (autorul
> detaliului-mamă SAU autorul schiței). Sursa de adevăr = codul (`SketchService.publish` / `deleteSketch`).
> Valorile `PENDING_ACCEPTANCE`/`REJECTED` rămân în enumul DB doar pentru date istorice.
- La PUBLISH → **Notificare** către autorul detaliului-mamă: *„X a schițat peste detaliul tău → vezi în teanc"*.
  La ștergerea de către autorul-mamă → notificare (`SKETCH_DELETED`) către autorul schiței.
- **Notificările merg in-app ȘI pe email de la început** (via Resend), pentru brand
  awareness/recall, nu doar in-app.

### 7.5 Navigare: taburi + hover-slideshow
- **Taburi** = lista schițelor PUBLISHED ale unui detaliu; click pe o schiță → vezi autorul + toate
  interacțiunile pe ea (validări + comentarii, prin mecanismul polimorfic de la §4).
- **Hover-slideshow** = la hover peste detaliul-mamă, ciclăm prin **thumbnail-urile** schițelor (pre-randate,
  deci instant). Pur UI, fără cost de server.

### 7.6 Ce NU facem în MVP (explicit, ca să nu se umfle)
- Co-desenare în timp real. Layere multiple per foaie. Pen pressure avansat. Editare colaborativă pe aceeași
  foaie. Toate astea vin după ce validăm că dezbaterea se aprinde.

### 7.7 Planșa (canvas privat per user) — SCOASĂ din MVP (2026-07-05)
Implementată 2026-07-05 (tldraw, apoi migrată pe Excalidraw), scoasă complet aceeași zi: risc de identitate
de produs — un wrapper subțire peste un whiteboard generic (Excalidraw/Figma/Miro) nu servește întrebarea
pe care MVP-ul o testează (dezbaterea pe roluri). Cod + tabele DB (`canvases`, `canvas_items`) șterse.
Reluare posibilă doar cu un engine propriu, diferențiat — decizie separată, pe HOLD. Spec veche (istoric,
neactuală): `Detalia_Canvas.md`.

---

## 8. Feed și căutare

- **Feed:** fără infinite scroll. Afișăm **primele ~20 detalii după număr de interacțiuni** (validări +
  comentarii + schițe). Query simplu, ordonat, paginat clasic.
- **Căutare MVP = filtre pe arborele de categorii** (Fundație → Beton → Hidroizolare; Acoperiș → Cornișă →
  Jgheab). Ieftin, predictibil, livrabil în zile.
- **Search liber în limbaj natural** („detaliu îmbinare perete interior cu exterior la casă din lemn"):
  **amânat.** Diferența de complexitate e mare — necesită embeddings + vector search (pgvector) + tuning.
  Recomandare fermă: **MVP pe filtre**, search semantic în backlog (Neon suportă pgvector, deci e un upgrade,
  nu o rescriere).

---

## 9. Securitate (acces public + RBAC)

Tratăm ca **CRITICAL** (auth, roluri, permisiuni):
- **Deny-by-default.** Tot ce nu e public e în spatele sesiunii; `proxy.ts` (Next 16, fostul `middleware.ts`)
  respinge neautentificații (redirect `/login`).
- **Acces PUBLIC** (2026-06-28, vezi CHANGELOG/ADR-008): înregistrare liberă, fără invitație. Mecanismul de
  invitație (token, expirare, one-time use) a fost **eliminat complet**, niciun cod dormant. Rolul și-l
  declară userul la signup; verificarea (badge) e un flux separat, ulterior, aprobat de admin.
- **Magic link (Auth.js Email provider):** passwordless → fără parole de scurs/resetat, mai puțină suprafață
  de atac. Token cu durată scurtă, one-time.
- **Validare pe server pentru toate regulile de business** (dezaprob necesită justificare; o poziție/user;
  schița se publică direct — fără acceptare de la autorul-mamă, ADR-011). Frontend-ul nu e sursă de adevăr.
- **Upload detalii DESCHIS** oricărui user cu rol declarat (ADR-009, 2026-06-28) — moderare **post-publicare**
  (ștergere de către autorul-mamă/autorul conținutului), nu coadă de aprobare.
- **Sesiune `jwt`** (2026-07-02, perf) — `status`-ul e stale până expiră tokenul pe *citire*; blocare TARE
  (re-check DB + `signOut()` real) pe toate mutațiile care produc conținut (`lib/require-active-user.ts`).
- **Rate-limit** (Upstash, fail-closed în prod) pe login/mutații/upload + **Cloudflare Turnstile** pe
  login+signup (anti-bot).
- **Audit trail structurat** (`lib/audit.ts`) + **Sentry** (erori + Alerts pe evenimente de securitate:
  rate-limit, acces respins pe cont suspendat, login-admin eșuat).
- Fără secrete în cod; toate cheile (Resend, DB, Auth, Upstash, Turnstile, Sentry) în env management (Vercel env).
- PII (emailuri, tokenuri magic link, dovezi rol) **nu se loghează** — doar metadate. (Hook care blochează
  asta — vezi §11.)
- **Audit formal CRITICAL (13 categorii) — APROBAT** (2026-07-02, vezi `docs/SECURITATE.md`), 0 constatări
  CRITICAL/HIGH/MEDIUM/LOW, verificat cu atacuri reale pe producție.

---

## 10. Cost — cât de aproape de $0

| Componentă | Plan | Cost lunar MVP |
|---|---|---|
| Domeniu | deja deținut | $0 (plătit) |
| Hosting (Vercel) | Hobby la validare → Pro la comercial | **$0 → ~$20** |
| DB (Neon Postgres) | Free tier | $0 |
| Email (Resend) | Free 3k/lună | $0 |
| Stocare (Vercel Blob / R2) | Free tier | ~$0 |
| Auth (Auth.js) | self-hosted | $0 |
| **Total realist** | | **$0–20/lună** |

**Mesaj clar pentru client:** în faza de validare singurul cost cvasi-garantat e hostingul (Vercel), eventual
~$20/lună când produsul devine clar comercial/public. Totul în plus apare doar dacă explodează traficul — un
„problem de succes", nu un cost de pornire.

---

## 11. Setup de lucru: rules, hooks, MCP

Reutilizăm fundația de la proiectul anterior, adaptată la DETALIA:

**Hooks (`.claude/hooks/`):**
- `block-pii-log.js` — **recalibrat pe PII-ul DETALIA**: în loc de „messageText / imageBase64" (WhatsApp),
  blochează logarea de `email`, `inviteToken`, `magicLinkToken`, `password`, dovezi de verificare (nr. OAR/CUI).
- `lint-web.js` — ESLint pe fișierul editat, înainte de deploy Vercel; mutat pe structura single-app
  (`app/`, `components/`, `lib/`, `server/`, `db/` — nu `apps/web/`).
- **Hook-ul `Stop` (ntfy) — eliminat** (nu se mai folosește).
- **De adăugat la `git init`:** `block-push-main` (nu se împinge direct pe `main`; tot prin `dev` → PR).

**Rules (`CLAUDE.md` de proiect):** glosar de domeniu (detaliu, schiță, validare, roluri/subroluri),
state machine-ul schiței, regulile de securitate ale validării, structura pe straturi. Îl scriem după ce
confirmi stack-ul.

**MCP:**
- **context7** (deja) — docs la zi pentru Next.js / Auth.js / Drizzle / perfect-freehand.
- **Playwright** (deja) — E2E pe fluxurile critice (invitație → login → validare → schiță → accept).
- **Vercel** (deja, via plugin) — deploy + env management.
- Opțional mai târziu: un MCP de Postgres pentru introspecție schemă. Nu acum (minimalism).

---

## 12. Fazare / roadmap

- **Faza 0 — Schelet & acces (fundația): ✅ ÎNCHEIATĂ structural (2026-06-20, vezi `CHANGELOG.md`).** proiect Next.js,
  DB+Drizzle (migrația 0000), Auth.js magic link + `proxy.ts` deny-by-default, onboarding rol,
  cont admin seed (allowlist `ADMIN_EMAILS`). Rămâne rularea cu credențiale (Neon `db:push`/`db:seed`, magic link e2e).
- **Faza 1 — Inima:** Detaliu (seed), Feed (top N), filtre pe categorii, Validare
  (Aprob/Dezaprob+justificare), Comentarii. → **Aici răspundem la întrebarea de validare.**
- **Faza 1.5 — Schițarea colaborativă (OBLIGATORIE în MVP):** canvas, stroke-uri vectoriale,
  fill slab pe detaliul-mamă, state machine PR, notificări (in-app + email), taburi + hover-slideshow.
  Partea grea, dar non-negociabilă — fără ea „e doar blog cu comentarii".
- **Faza 2 (Val 2, post-v1):** ✅ **ÎNCHEIATĂ (2026-06-28):** upload de detalii DESCHIS oricărui user cu
  rol declarat (nu mai e seed-only), moderare post-publicare.
- **Backlog:** search liber semantic, verificare automată rol (OAR), reputație/ponderare, real-time.

---

## 13. Stadiul deciziilor

### Confirmate
- **Auth = magic link** (passwordless); sesiune `jwt` (2026-07-02, perf — vezi ADR-002).
- **Un singur rol per user**; **rol auto-declarat** la signup + verificare în platformă cu **badge** (NU
  atribuit de admin la invitație).
- **Verificarea rolului = „pull, nu push":** opțională, fără blocare; rol neverificat e funcțional 100%; nudge
  blând permanent; userii vin singuri să se verifice, motivați de credibilitate (rol verificat „cântărește"
  mai mult în ochii cititorului). Fără scoring numeric — vezi §6.
- **Schițarea colaborativă = obligatorie în MVP**; model asincron GitHub-style; fill slab pe detaliul-mamă;
  unelte = culori stridente + 3 grosimi + radieră + undo/redo.
- **Notificări in-app + email** de la început.
- **Zone climatice/seismice + încărcare zăpadă/vânt = liste fixe** (implementat 2026-07-02): zonă
  climatică Zona I–IV, seismic a_g + Tc separate, opțiune „General" pe restul (cu atenționare că
  datele reale dau greutate). Sursă: `lista_categorii.md` (poate fi ștearsă).
- **Upload detalii = DESCHIS** userilor cu rol declarat (moderare post-publicare); seed inițial prin conturi reale.
- **Acces = PUBLIC** (înregistrare deschisă, fără invitație); mecanismul de invitație a fost eliminat complet din cod.
- **Feed ~20** detalii după interacțiuni; căutare pe filtre la început.
- O imagine 2D/detaliu (jpg/png/webp, ~5MB); **max 3 resurse** suplimentare.

### Încă deschise
→ Deciziile rezolvate au trecut în cod (vezi CHANGELOG 2026-07-02); cele rămase deschise (Termeni/GDPR,
firmă/SRL, verificare automată meserie) sunt în `.remember/remember.md` §„Decizii / HOLD".
```
