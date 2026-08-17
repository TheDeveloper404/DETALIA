# DETALIA — Arhitectură

Document de sistem: ce este platforma din punct de vedere tehnic, cum sunt organizate straturile,
ce entități există și cum interacționează. Pentru decizii punctuale cu justificare/alternative
respinse → `docs/ADR.md`. Pentru schema exactă a bazei de date → `db/schema.ts` (sursa de adevăr;
`docs/SCHEMA.md` e design doc, poate rămâne în urmă). Pentru istoricul modificărilor →
`docs/CHANGELOG.md`. Pentru glosar de domeniu și reguli de business → `CONTEXT.md`.

---

## 1. Ce este DETALIA

O comunitate profesională din construcții organizată în jurul **detaliului de execuție**: un
conținut tehnic (imagine + context) pe care alți profesioniști îl pot aproba, contesta cu
justificare, sau îmbunătăți printr-o schiță desenată peste el. Fiecare contribuție e atribuită
transparent unui rol profesional (proiectant / executant / furnizor / beneficiar).

Model mental: un Detaliu e ca un repository; o Schiță e ca un fork; validarea pe roluri e ca un
code review. Colaborarea pe schițe e **asincronă** (fiecare autor adaugă propria „foaie" într-un
teanc), nu co-editare în timp real — decizie care elimină din sistem toată complexitatea de
CRDT/websockets/rezolvare de conflicte.

## 2. Stack tehnic

| Strat | Tehnologie | Rol |
|---|---|---|
| Framework | Next.js (App Router) | UI + API în același proces — Server Components, Route Handlers, Server Actions |
| Hosting | Vercel | Deploy, preview per PR, scale-to-zero (Fluid Compute) |
| Bază de date | Postgres (Neon, serverless) | Relațională — modelul are relații reale (roluri, validări, schițe, proiecte) |
| ORM | Drizzle | Tip-safe, fără engine binar (cold start mic pe serverless) |
| Autentificare | Auth.js (NextAuth v5) — provider Email | Passwordless (magic link), sesiune JWT |
| Trimitere email | Resend | Magic link + notificări (canalul de notificări e dezactivabil din env) |
| Stocare fișiere | Vercel Blob | Imagini de detaliu, thumbnail-uri de schiță, avatare/cover |
| Canvas (schițare + planșă) | HTML5 Canvas + `perfect-freehand` | Stroke-uri vectoriale, engine propriu (nu tldraw/Excalidraw) |
| Rate limiting | Upstash Ratelimit | Fail-closed în producție, pe login/mutații/upload |
| Anti-bot | Cloudflare Turnstile | Pe login + signup |
| Observabilitate | PostHog | Erori + evenimente de securitate + analytics (sursă unică; Sentry decomisionat) |
| UI | Tailwind CSS + shadcn/ui | — |

Este o singură aplicație full-stack — nu un backend separat. Regulile de business stau izolate în
`server/`, ceea ce lasă loc pentru extragerea unui API separat mai târziu, dacă apare un consumator
extern (ex. aplicație mobilă nativă), fără să rescrie logica.

## 3. Arhitectura pe straturi

```
[ UI / Presentation ]   Next.js pages + React Server Components
        │               client components doar unde e nevoie (canvas, modale, formulare interactive)
        ▼
[ API ]                 Route Handlers (REST, minim) + Server Actions (majoritatea mutațiilor)
        │               subțiri: validează inputul, deleagă la service
        ▼
[ Application/Services ] server/services/* — DetailService, ValidationService, SketchService,
        │                ProjectService, PlansaService, ProfileService, NotificationService...
        │                TOATĂ logica de business, autorizare și state machines
        ▼
[ Domain ]              server/domain/* — entități, reguli, tipuri, state machines (fără I/O)
        ▼
[ Infrastructure ]      server/repos/* (Drizzle) · Neon Postgres · Resend · Vercel Blob · Auth.js
```

Regulă strictă: **zero logică de business în route handlers sau componente.** Un handler/Server
Action validează inputul și deleagă la un service; service-ul decide, repo-ul persistă. Asta ține
codul testabil independent de framework și permite schimbarea UI-ului sau extragerea unui API fără
rescrierea regulilor.

## 4. Modelul de date

Entitățile principale (schema completă, cu tipuri și constrângeri: `db/schema.ts`):

**Identitate**
- `users` — cont (Auth.js + extensii de profil: headline, locație, website, contact opțional,
  imagine de cover, dată de înscriere).
- `roles` — rolul declarat de user (principal + subrol + rol adițional opțional), stare de
  verificare (`DECLARED → PENDING → VERIFIED/REJECTED`).

**Conținut**
- `categories` — arbore de categorii (secțiuni → capitole → frunze), many-to-many cu detaliile
  prin `detailCategories`.
- `details` — un detaliu de execuție (imagine, descriere, context tehnic opțional — zonă
  climatică/seismică/încărcări). Poate aparține unui proiect (`projectId`) sau fi public.
- `detailResources` — resurse opționale de înțelegere (imagine/link/text/PDF, max 3).
- `sketches` — o „foaie" desenată peste un detaliu, cu un singur autor; stocată ca **stroke-uri
  vectoriale** (coordonate normalizate 0..1), nu ca imagine rasterizată — mic în DB, redabil,
  scalabil pe orice ecran. Publicare directă (`DRAFT → PUBLISHED`), fără coadă de acceptare.

**Dezbatere** (polimorfică — țintește fie un `Detail`, fie un `Sketch`)
- `validations` — poziția Aprob/Dezaprob a unui user, cu constrângere unică `(user, țintă)` — o
  singură poziție per user, reversibilă, garantată de bază de date.
- `comments` — comentarii, cu reacții (`commentLikes`); o dezaprobare fără justificare e respinsă
  server-side, iar justificarea intră automat ca și comentariu.
- `notifications` — evenimente relevante pentru un user (schiță nouă peste detaliul lui, ștergeri,
  ofertă de furnizor etc.), livrate in-app (canalul email există, dezactivabil din env).

**Colaborare restrânsă**
- `projects` — spațiu privat cu un owner și un `inviteToken` opac, regenerabil.
- `projectMembers` — membri (Autor + Invitați, drepturi identice), dezactivați cu `removedAt` la
  eliminare (nu istoric de intrări/ieșiri).
- `projectCanvasShares` — copie ÎNGHEȚATĂ a unei planșe personale, partajată într-un proiect (nu
  referă planșa sursă — care poate fi editată/ștearsă ulterior fără efect).

**Spațiu privat de lucru**
- `canvases` / `canvasItems` — planșă privată per user (document serializat cu poziții de imagini +
  stroke-uri), independentă de teancul public de schițe.

**Altele**
- `savedDetails` — detalii salvate de un user (listă privată).
- `supplierOffers` — semnalul „pot oferta materiale" al unui furnizor verificat, pe un detaliu.
- `adminLoginTokens` / `adminSessions` / `platformSettings` — panou de administrare (mentenanță,
  listă useri) separat de sesiunea normală.

Decizii de modelare care se repetă în cod și merită înțelese:
- **Polimorfismul pe `targetType`/`targetId`** (validări, comentarii) face ca exact același
  mecanism de dezbatere să funcționeze identic pe un detaliu și pe fiecare schiță a lui.
- **Retragerea autorului nu șterge conținutul.** Un rând `details` expune două identități la
  citire: `authorId` (derivat, `NULL` dacă autorul s-a retras — sigur de trimis la client) vs.
  `ownerId` (coloana reală, strict server-side, folosită DOAR pentru autorizare). Masca se aplică
  o singură dată, la interogare, nu în fiecare componentă.
- **Un detaliu stă mereu într-o singură stare din trei**, combinând `status` cu `projectId`:
  ciornă (`DRAFT` + fără proiect), privat de proiect (`PUBLISHED` + `projectId`), public
  (`PUBLISHED` fără proiect). Trecerea din privat în public e ireversibilă și validată server-side.
- **Ștergerea unei entități-părinte (proiect, detaliu) nu e doar `ON DELETE CASCADE`** —
  validările/comentariile polimorfice n-au FK spre țintă, iar fișierele din Blob nu cad în cascadă
  DB. Ștergerea e orchestrată explicit în service (colectează și șterge manual rândurile + Blob-urile).

## 5. Fluxuri de domeniu

### Rol declarat vs. verificat
Userul își declară rolul la onboarding (acces imediat, fără fricțiune). Verificarea e un flux
separat, opțional, aprobat manual de admin — rolul neverificat rămâne complet funcțional. Greutatea
unei poziții/comentariu **nu e calculată de server** (fără scor numeric) — cititorul o judecă
văzând rolul afișat lângă nume; un rol verificat cântărește mai mult în ochii cititorului, ceea ce
motivează organic verificarea.

### Validarea pe roluri
Identic pe Detaliu și pe Schiță: Aprob = un click. Dezaprob obligă o justificare (enforce
server-side), care devine automat comentariu atribuit cu nume+rol. O poziție e reversibilă
(update pe aceeași înregistrare unică), nu se acumulează istoric de voturi.

### Schițarea (teanc asincron)
Fiecare schiță are un singur autor și se publică direct în teancul public al detaliului (fără
coadă de acceptare din partea autorului-mamă) — moderarea e post-publicare, prin ștergere. La
publicare, autorul detaliului-mamă primește notificare.

### Planșă privată
Spațiu de lucru strict privat per user, zonă fixă cu pan/zoom, unde userul adună detalii și
desenează peste ele cu același engine ca la schițare. Nu e vizibilă altor useri sub nicio formă —
ownership enforce direct în interogarea SQL (`WHERE id=? AND owner_id=?`), nu doar în UI.

### Proiecte (colaborare restrânsă)
Al treilea nivel de vizibilitate, pe lângă public (Detaliu) și strict privat (Planșă): un owner
invită oameni printr-un link și lucrează cu ei la detalii înainte de a le scoate, opțional și
ireversibil, în comunitate. Poarta de acces e un singur punct de control server-side, prin care
trece orice citire de conținut de proiect — invariant verificat exhaustiv pe toate suprafețele
(feed, profil, notificări, listele private).

### Reputație (badge-uri)
Badge-urile (Bronz/Argint/Aur) sunt **calculate live** din statistici deja existente (detalii
publicate, schițe, validări date/primite, zile active) — fără tabelă proprie de scor. Un snapshot
minimal (`users.seenBadges`) reține ultimul set văzut de user, ca să poată fi detectat și celebrat
un badge nou la vizita următoare pe propriul profil.

### Feed și căutare
Fără scroll infinit — listă finită, paginată clasic, strict cronologică (sortarea după interacțiuni
există separat, într-un rail dedicat „cele mai dezbătute"). Căutarea e pe filtre din arborele de
categorii; căutare semantică (embeddings/pgvector) nu e implementată.

## 6. Securitate

Tratat ca domeniu CRITICAL (auth, roluri, permisiuni):
- **Deny-by-default** — orice rută în afara zonei publice cere sesiune, verificat în `proxy.ts`.
- **Magic link passwordless** (Auth.js Email provider) — token cu durată scurtă, one-time.
- **Toate regulile de business validate server-side** — frontend-ul nu e sursă de adevăr (dezaprob
  fără justificare, poziții multiple per user, acces la conținut de proiect etc.).
- **Sesiune JWT** — `status`-ul contului e stale până expiră tokenul pe citire; pe orice mutație
  care produce conținut se face verificare tare (re-check DB + `signOut()` real dacă e suspendat).
- **Rate limiting** (Upstash, fail-closed în producție) pe login/mutații/upload + **Turnstile** pe
  login și signup.
- **Audit trail structurat** + evenimente de securitate în PostHog (rate-limit lovit, acces respins
  pe cont suspendat, login-admin eșuat).
- **Fără secrete în cod** — toate cheile în environment management (Vercel env).
- **PII (email, tokenuri, dovezi de rol) nu se loghează** — doar metadate.

Auditul complet pe 13 categorii, cu verdict și findings: `docs/SECURITATE.md`.

## 7. Decizii de arhitectură cheie

Rezumat; justificare completă și alternative respinse pentru fiecare → `docs/ADR.md`.

- **O singură aplicație Next.js full-stack**, nu un backend separat — regulile de business stau
  izolate în `server/`, extragerea unui API separat rămâne posibilă fără rescriere.
- **Schițarea e asincronă (model „teanc de foi"), nu co-editare în timp real** — elimină toată
  complexitatea de CRDT/websockets/rezolvare de conflicte.
- **Schițele se stochează ca stroke-uri vectoriale, nu ca imagini rasterizate** — mic în DB,
  redabil, scalabil pe orice ecran; un thumbnail PNG se randează o singură dată, la publicare.
- **Fără scor/ponderare numerică pe validări** — greutatea unei poziții o judecă cititorul, din
  rolul afișat lângă nume, nu un algoritm.
- **Badge-urile de reputație sunt calculate live**, nu stocate — evită desincronizarea între
  statistici și scor afișat.
- **Trei niveluri de vizibilitate pe conținut** (public / restrâns la un proiect / strict privat pe
  planșă), fiecare cu propria poartă de acces server-side, fără suprapunere de mecanism.
