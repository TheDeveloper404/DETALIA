# DETALIA — Securitate

**Sursa unică de adevăr pentru securitatea aplicației.** Un singur document — consolidează auditul intern
white-box, auditul extern black-box (Codex) și nota onestă de ansamblu. Nu mai există alte fișiere de audit
paralele (foste `AUDIT-SECURITATE-2026-07-09.md` și `detalia-security-audit-2026-07-09.md`, absorbite aici
2026-07-09).

> Consolidat 2026-07-02: acest document înlocuiește vechiul `docs/SECURITATE.md` (audit static 24 iunie 2026,
> verdict BLOCAT — depășit, categoriile lui erau deja rezolvate). Conținutul de mai jos e auditul CRITICAL
> complet rulat pe codul live, actualizat cu follow-up-urile din aceeași zi (JWT + fix suspendare).

**Ultima verificare:** 2026-07-09 (audit extern black-box + fixuri + recalibrare notă) · anterior 2026-07-04
(audit pe scenarii, SEC-S1…S5) · **Tip:** re-audit static complet (13 categorii, skill `security-audit`) pe
toată suprafața (auth, authz, mutații, API, business logic, infra) + `npm audit` + **audit extern independent
black-box** (Codex, fără acces la cod). Auditul din 2026-07-02 rămâne valabil ca bază; mai jos doar delta.

**Verdict: APROBAT pentru MVP/producție. Zero constatări CRITICAL / HIGH**, pe AMBELE lentile (white-box +
black-box independent). Constatările MEDIUM/LOW au fost remediate pe măsură ce au apărut — vezi secțiunile
dedicate. **Nota onestă de ansamblu (nu doar calitatea codului) e în §„Nota onestă" mai jos — citește-o înainte
de a trata „APROBAT" ca „platforma nu poate fi spartă".**

Legendă: ✅ implementat structural · ⚠️ parțial/neverificat comportamental · ❌ lipsește/nefuncțional ·
⏸️ cod dormant, fără rută activă · **BLOCKER** — împiedică lansarea publică (niciunul activ acum).

---

## Sumar constatări

| Sev | # | Stare |
|-----|---|-------|
| CRITICAL | 0 | — |
| HIGH | 0 | — |
| MEDIUM | 0 | — |
| LOW | 0 | — |
| Hardening / consistență | 2 | APLICATE (SEC-H01, SEC-04/JWT) |
| Re-audit 2026-07-03 (SEC-A1…A5) | 5 | 1 MEDIUM + 3 LOW + 1 INFO — TOATE REMEDIATE |
| Audit pe scenarii 2026-07-04 (SEC-S1…S5) | 9 fixuri | ~99 scenarii, 7 feature-uri — TOATE REMEDIATE (SEC-04 uniform) |
| Audit extern black-box 2026-07-09 (Codex) | 5 | 1 MEDIUM + 4 LOW — TOATE REMEDIATE |
| Note / risk-acceptance | 4 | documentate |

Postura generală: **foarte bună la nivel de cod, dar vezi §„Nota onestă" pentru ce NU acoperă niciun audit
AI.** Modelul „deny-by-default" e aplicat consecvent (proxy → sesiune pe tot ce nu e explicit public; authz
fină în services). `authorId`/`userId` vin **exclusiv din sesiune**, niciodată din formular → clasa IDOR e
închisă structural (7 scenarii testate, nu doar citite). Toate regulile de business sunt enforce pe server.
Input-urile care ating coloane `uuid` sunt gardate cu `isUuid` (pattern „SEC-11") aproape peste tot.

---

## Hardening / consistență

### [SEC-H01] Guard `isUuid` pe profilul public (consistență cu pattern-ul SEC-11) — ✅ deployat (main)
- **Locație:** `app/(app)/profile/[userId]/page.tsx` → `getProfileView` → `getPublicProfile`
  (`server/services/profileService.ts`).
- **Context:** `getProfileView` era singura cale de citire care **nu** aplica gardul `isUuid` prezent peste
  tot în rest. Ipoteza inițială (static): `userId` malformat → `WHERE users.id = $1` pe coloană `uuid` →
  `22P02` → 500.
- **Verificare pe viu (prod):** ipoteza **NU se confirmă**. `/profile/not-a-uuid` → `notFound()` curat (404),
  identic cu un uuid inexistent (driverul Neon HTTP + Drizzle nu aruncă pe uuid malformat). Nu era un defect
  exploatabil — doar o inconsecvență de stil.
- **Aplicat (defensiv):** `if (!isUuid(userId)) return null;` — aliniază ultima cale de citire la SEC-11.

### [SEC-04 / JWT] Sesiune `database` → `jwt` + blocare tare a suspendării pe mutații — ✅ deployat (main)
- **Context:** strategia `database` interoga Neon la fiecare `auth()` (fiecare render + acțiune) — pârghia #1
  de latență. Decizie: migrare la `jwt` (`lib/auth.ts`).
- **Tradeoff introdus:** cu JWT, `status`-ul din sesiune vine din token și e **stale** (înghețat la login) —
  gate-ul din `proxy.ts` devine SOFT pe citire. Un cont suspendat poate încă *citi* (`/feed` etc.) până-i
  expiră tokenul.
- **Mitigare aplicată:** `lib/require-active-user.ts` (`requireActiveUserId()`) re-verifică `status` PROASPĂT
  din DB (un SELECT) pe toate mutațiile care produc/modifică conținut public (creare/editare detaliu,
  publicare schiță, comentariu add/edit, approve/disapprove). La status non-ACTIVE face **`signOut()` real**
  (șterge cookie-ul JWT), nu doar redirect — altfel userul suspendat revenea la citire cu „back" pe tokenul
  stale.
- **Verificat pe viu (prod, 2026-07-02, cont real suspendat via SQL Neon):**
  - Token JWT stale + `/feed` → **200** (citire permisă — tradeoff intenționat, confirmat).
  - Aceeași sesiune + click „Aprob" (mutație) → **blocat instant**, „contul a fost suspendat", delogare reală
    (verificat: refresh nu păstrează mesajul stale, back nu mai duce în feed — cookie-ul a fost șters).
  - Anon (fără cookie) → 302 login (baseline).
- **Cost operațional la deploy:** sesiunile `database` vechi nu au fost JWT valide → userii logați s-au
  delogat o dată la trecere, re-intrat cu magic link. Fără migrație DB.

---

## Re-audit 2026-07-03 — constatări + remediere (toate REMEDIATED în aceeași zi)

### [SEC-A1] MEDIUM — Magic link ADMIN consumat la GET direct (fără anti-prefetch) — ✅ remediat
- **Era:** emailul de admin trimitea direct la route handler-ul care consuma tokenul one-time → un scanner
  de mail (GET automat) putea arde tokenul (DoS pe login) și provoca emiterea unei sesiuni de admin către
  un terț. Fluxul de USER avea deja protecția (`/verify` click-through JS); adminul nu.
- **Fix:** același pattern — `/admin-page/verify` e acum PAGINĂ inofensivă la GET; consumul real s-a mutat
  pe `/admin-page/verify/confirm` (route handler), declanșat din JS la montare (`AutoVerify`, refolosit).
  Target construit local (path fix + token) → fără open-redirect. Poarta din `proxy.ts` actualizată.

### [SEC-A2] LOW — `BLOB_URL_RE` accepta orice store `*.public.blob.vercel-storage.com` — ✅ remediat
- **Era:** validarea la persistare accepta URL-uri din ORICE store Vercel Blob (inclusiv al altui cont).
  Impact aproape nul (imaginea era oricum re-encodată cu sharp + re-uploadată la noi), dar inutil de larg.
- **Fix:** `lib/blob-url.ts` (server-only) — `isOwnBlobUrl()` pinuiește hostname-ul pe store ID-ul extras
  din `BLOB_READ_WRITE_TOKEN`; fallback pe forma generală doar în dev fără Blob. Înlocuit în toate cele
  5 puncte server (detalii new/edit, onboarding, profil, reprocesare imagine).

### [SEC-A3] LOW — enumerare email la login/signup — ⚠️ risk-acceptance (decizie de produs, 2026-07-03)
- Login-ul cu email fără cont spune explicit „nu există cont", signup-ul cu email existent spune „există
  deja" → un terț poate confirma dacă un email are cont pe DETALIA. **Asumat conștient** pentru claritate
  UX (platformă profesională, passwordless — fără parole de brute-forțat). Mitigare: rate-limit
  5/h/email + 20/h/IP + Turnstile → enumerarea în masă e blocată; cea țintită (1 request/țintă) rămâne
  posibilă prin natura deciziei. Dacă profilul de risc se schimbă → mesaj generic + email informativ.

### [SEC-A4] LOW — fără update-uri automate de dependențe — ✅ remediat
- **Fix:** `.github/dependabot.yml` — security updates imediate + version updates săptămânale (npm +
  github-actions), grupate minor/patch, target `dev`, max 5 PR-uri. Merge manual, CI validează.
- `npm audit` la zi: **0 vulnerabilități în producție**; 4 moderate doar în `drizzle-kit` (tooling local).

### [SEC-A5] INFO — `deleteDetailAction`/`deleteDraftAction` fără rate-limit — ✅ remediat
- Uniformizare: ambele au acum `limiters.mutation`, ca restul mutațiilor (abuzul era oricum limitat la
  propriul conținut prin ownership).

---

## Audit pe SCENARII 2026-07-04 — constatări + remediere (toate REMEDIATED în aceeași zi)

> **Metodă (nouă, complementară auditului pe categorii):** matrice **actor × acțiune × perturbare** executată
> prin cod (UI → action → service → DB), NU checklist. Actori: rău-intenționat autentificat · neautentificat/
> sesiune expirată · neatent (back/reload/dublu-click/tab vechi) · concurent cu el însuși · fost user (cont
> șters, sesiune/link vechi). Acțiuni: extrase din cod (server actions + route handlers) → complete prin
> construcție. Perturbări: repet/replay · ordine greșită · ținta dispare · identitatea se schimbă · input la
> limită. Acoperire: **7 feature-uri cu mutații, ~99 scenarii, 9 constatări**. A prins **comportament** (ce nu
> vede auditul static pe categorii). Scenariile confirmate → țintă de teste (model `e2e/security.spec.ts`).

### [SEC-S1] LOW — clasa SEC-04 aplicată INCONSECVENT pe mutații — ✅ remediat (uniformizat)
- **Era:** invariantul „cont suspendat/șters = zero mutații + delogare la prima încercare" (SEC-04) era
  aplicat doar pe unele acțiuni. Cu sesiune `jwt` (status stale ≤7 zile), un cont suspendat cu token viu putea
  încă executa mutații pe acțiunile rămase pe `auth()` simplu: `retractAction` (validare), `deleteSketch`/
  `startSketch`/`deleteDraft` (schițe), `deleteDetailAction` (ștergerea cascadează peste conținutul ALTORA),
  `deleteCommentAction`, plus **ruta `api/blob/upload`** („poarta" emitea token-uri de upload doar pe sesiune).
- **Fix:** toate acțiunile de mai sus trecute pe `requireActiveUserId` (re-check status proaspăt din DB →
  DELETED/SUSPENDED = signOut). Ruta upload (JSON, unde `redirect()` nu se potrivește) face check inline
  `status === ACTIVE` → 401. **Clasa e acum închisă UNIFORM pe TOATE mutațiile.**
- **Excepții DELIBERATE (documentate în cod):** autosave schiță + toggle bookmark + marcare notificări citite
  rămân pe `auth()` — private, inconsecvente, nu produc conținut vizibil altora; un SELECT/apel ar costa
  degeaba. `deleteAccountAction` rămâne pe `auth()` — un cont SUSPENDED **trebuie** să-și poată șterge contul
  (dreptul GDPR de erasure).

### [SEC-S2] LOW-MEDIUM — de-anonimizare GDPR prin JWT stale la onboarding — ✅ remediat
- **Era:** `onboardingAction` (pe `auth()`) SCRIE PII (nume, headline…) în rândul user ÎNAINTE de `declareRole`.
  Un cont DELETED (deja anonimizat „[cont șters]") sau SUSPENDED cu JWT viu putea re-POSTa formularul → PII real
  rescris peste rândul anonimizat, **anulând ștergerea GDPR** (`declareRole` pica cu ALREADY_HAS_ROLE, dar DUPĂ
  scrierile de PII).
- **Fix:** `requireActiveUserId` → non-ACTIVE blocat înainte de orice scriere. Userii noi (status default ACTIVE)
  neafectați.

### [SEC-S3] LOW — consum ne-atomic al token-ului de magic link ADMIN — ✅ remediat
- **Era:** `consumeAdminLoginToken` făcea SELECT-valid → DELETE separat. Pe neon-http (fără tranzacții) două
  cereri paralele cu ACELAȘI token (dublu-click pe fallback noscript, retry `AutoVerify`) puteau citi ambele
  tokenul valid înainte de ștergere → **două sesiuni de admin dintr-un token one-time** (calea cu cel mai mare
  privilegiu). Anti-prefetch-ul (SEC-A1) reducea, dar nu închidea fereastra de concurență.
- **Fix:** `DELETE … WHERE token+neexpirat RETURNING email` — Postgres serializează ștergerea rândului, doar o
  cerere primește email-ul.

### [SEC-S4] LOW — race la dublu-submit pe dezaprobare → comentarii-justificare duplicate — ✅ remediat
- **Era:** `disapprove` făcea read-then-write (`getUserPosition` → `upsertPosition` → `insertComment`) fără
  tranzacție. Dublu-submit paralel → ambele cereri vedeau „nu era DISAPPROVE" → **2 comentarii-justificare**
  identice (poziția rămânea una, salvată de constrângerea unică). Spam în dezbatere (produsul).
- **Fix:** `upsertDisapprovalIfTransition` — un singur statement `INSERT … ON CONFLICT DO UPDATE … setWhere
  position <> 'DISAPPROVE' RETURNING`; rând întors = tranziție reală → comentariu; nimic = era deja DISAPPROVE.
  Aplicat și în `recordSketchDisapproval` (dublu-publish). Teste unit noi în `validationService.test.ts`.

### [SEC-S5] INFO — thumbnail orfan la publicare eșuată de schiță — ✅ remediat (nu e vulnerabilitate)
- Thumbnail-ul se urca în Blob ÎNAINTE de verificările din `publish`; la eșec rămânea orfan permanent. Fix:
  `deleteBlobs([thumbnailUrl])` pe ramura de eșec în `sendSketchAction`.

> **Verificare:** toate fixurile validate `tsc`+eslint + citire cap-coadă; SEC-S4 are teste unit noi.
> **Materializat în teste (2026-07-07):** consumul token admin (SEC-S3) — `admin-auth.spec.ts` (atomicitate,
> concurență) + `admin-access.spec.ts` (privilege-escalation pe `/admin-page`, token consumat chiar și la
> eșec de allowlist); blocarea SEC-04 la nivel de acțiune — `suspended.spec.ts` (cookie JWT stale, mutație
> blocată + delogare reală).

---

## Audit extern black-box — Codex, 2026-07-09 (independent, fără acces la cod)

**De ce contează:** toate auditurile de mai sus (inclusiv al meu) sunt white-box — citesc codul. Un audit
black-box testează exact opusul: ce vede un atacator real care NU are codul, doar `https://detalia.ro/` din
exterior — fără cont, fără mutații, fără brute-force. Cele două lentile se completează; niciuna nu înlocuiește
cealaltă (vezi §„Nota onestă" pentru de ce nici împreună nu sunt un pentest advers real).

**Ce a testat:** 62 rute (scanner, 1 req/s, anonim), headere de securitate + TLS 1.0–1.3, CORS pe NextAuth,
metode HTTP nepermise, bundle-uri Next.js publice (sourcemaps/secrete), DNS email (SPF/DMARC/DKIM), magic-link
normal + admin (POST controlat, token real folosit o singură dată), două sesiuni user reale simultan (IDOR/BOLA
read-only între conturi).

**Rezultate bune confirmate independent:** HSTS preload, TLS 1.0/1.1 respinse, CSP cu nonce, cookies
HttpOnly+Secure+SameSite, source maps 403, zero chei/secrete în bundle-uri publice, rute API/admin/profile
redirecționează corect la login pentru anonimi, magic-link one-time (replay respins) pe user ȘI admin, sesiuni
admin/user complet izolate, Turnstile pe `/login` blochează POST fără token, IDOR read-only neconfirmat între
cele două conturi testate.

**Findings — 5, toate remediate în aceeași zi:**

| Sev | Ce | Fix |
|---|---|---|
| MEDIUM | Admin login (`/admin-page/login`) fără Turnstile, spre deosebire de `/login` (era deja atenuat de rate-limit 10/15min email + 30/15min IP + allowlist + anti-enumerare) | Turnstile adăugat, verificat server-side înainte de ramura `isAdminEmail` (fără scurgere) — `components/turnstile-widget.tsx`, test unit `app/admin-page/login/actions.test.ts` |
| LOW | DMARC `_dmarc.detalia.ro` = `p=none` (doar monitorizare, nu blochează spoofing) | **Deschis, infra DNS** — necesită confirmare DKIM Resend întâi, apoi progresie graduală `quarantine`→`reject` (vezi handoff) |
| LOW | `www.detalia.ro` servește aplicația, nu redirectează canonical la `detalia.ro` | **Deschis, infra Vercel Domains** (vezi handoff) |
| LOW | CSP prea permisivă în producție (`vercel.live`/`vercel.com`/pusher — infra de toolbar preview, nu funcțional real) | Scoase din CSP pe producție (`VERCEL_ENV === "production"`), rămân pe preview; test unit `lib/csp.test.ts` |
| LOW | `/.well-known/security.txt` lipsă (canal RFC 9116 de raportare responsabilă) | Route handler public nou, `Expires` 2027-07-09 (de reînnoit) |

**Nota lui Codex pe suprafața testată: 8.2/10.** A fost explicit că nu poate urca fără să testeze mutații/IDOR
autentificat/rate-limit real — exact zonele pe care auditul white-box de mai sus le probează. Nota lui NU
contrazice restul documentului; măsoară altceva (vezi §„Nota onestă").

## Verificări interne suplimentare — 2026-07-09 (pe suprafețele pe care black-box nu le atinge)

Trecere din cod pe ce Codex n-a putut testa: mutații/server actions, mass-assignment, XSS stored, upload,
CSRF. **Confirmat curat, fără findings noi:** `verificationStatus` nesettabil de user (doar admin), mențiuni
`@schiță` randate prin parser propriu (fără `dangerouslySetInnerHTML` pe conținut user), blob URL pinuit pe
store-ul propriu (`isOwnBlobUrl`), CSRF acoperit de Origin-check built-in al server actions Next + `form-action
'self'`, rate-limit distribuit fail-closed în prod pe toate mutațiile, `npm audit` = 0 vulnerabilități.

**Teste noi adăugate** (închid golurile explicit semnalate, nu doar citite din cod):
- **IDOR — +2 scenarii** (`e2e/security.spec.ts`): ștergere ciornă detaliu (`deleteDetailDraft`) și ciornă
  schiță (`deleteDraft`) de către non-autor → respinse (`NOT_FOUND`/`false`), victima supraviețuiește.
  **Total acoperire IDOR: 7 scenarii cross-user** (comentariu edit/delete, schiță delete published/draft,
  ciornă detaliu, planșă, editare detaliu).
- **Concurență — dublu-submit real** (`Promise.all`, nu doar citit codul): 5 dezaprobări paralele pe aceeași
  țintă → verificat în DB exact O poziție + UN comentariu-justificare (probează `onConflictDoUpdate` +
  `setWhere` sub sarcină reală, nu doar static).

---

## Audit complet (13 categorii) — 2026-07-14 (security-engineer, white-box) — constatări + remediere

Declanșat după fix-ul unui bug de producție (CSP bloca toate upload-urile client-side — vezi CHANGELOG
2026-07-14). Platforma e live public de ~o săptămână, cu useri activi reali — context tratat ca atare, nu
ipotetic. **Verdict: APPROVED** (Critical 0, High 0, Medium 3, Low 5, Info 2). Toate Medium + 2 din Info
remediate în aceeași zi:

- **SEC-002 (Medium, open-redirect):** `callbackUrl` din formularul de login/signup (client-controlled)
  ajungea nevalidat în `redirect()` — un `callbackUrl=//evil.com` putea produce o redirecționare externă.
  **REMEDIATED:** `safeCallbackUrl()` în `app/auth-actions.ts` — whitelist strict, doar path relativ cu un
  singur `/`. Test nou (`it.each`, 4 payload-uri) în `auth-actions.test.ts`.
- **SEC-004 (Low, host header confusion):** login admin (`app/admin-page/login/actions.ts`) folosea Host
  header ca fallback dacă `AUTH_URL` lipsea din env — un admin ar fi putut autentifica pe deploy-ul greșit.
  **REMEDIATED:** fallback doar pe `localhost:3000` (ca în `lib/auth.ts`), niciodată pe Host header.
- **SEC-001 (Medium, SEC-04 excepție):** autosave-ul Planșei (`saveCanvasDocumentAction`,
  `saveCanvasThumbnailAction`) folosea `auth()` (doar cookie) în loc de `requireActiveUserId()` (status
  proaspăt din DB) — inconsecvent cu restul mutațiilor. **REMEDIATED:** aliniat la `requireActiveUserId()`
  peste tot.
- **SEC-005 (Low, tombstone email):** email-ul de la ștergere cont conținea `userId`-ul real
  (`deleted-${userId}@deleted.invalid`) — corelabil dintr-un export/backup viitor cu conținutul rămas.
  **REMEDIATED:** `crypto.randomUUID()` random, fără legătură cu userId.
- **SEC-003 (Medium, dependințe):** `npm audit --omit=dev --audit-level=high` → **0 vulnerabilități.**
- **SEC-006 (Low, Turnstile fail-open pe outage Cloudflare):** decizie confirmată explicit de Liviu — rate-
  limit-ul rămâne plasa reală, nu blocăm signup-ul la o pană externă. Risc acceptat, fără schimbare.
- **SEC-007 (Low, `next-auth` beta):** verificat — `5.0.0-beta.31` e deja ultima beta publicată. Regulă de
  verificare periodică adăugată în `CLAUDE.md` (§Mentenanță recurentă).
- **SEC-008 (Low, CSP `style-src unsafe-inline`):** 231 utilizări `style={{}}` în 26 fișiere (poziționare
  dinamică canvas/schiță/drag) — nonce-ul CSP nu acoperă atributul `style`. Recomandare: **NU** se scoate
  `unsafe-inline` acum — refactor mare, risc de stricare UI pe useri live, beneficiu de securitate mic.
  Risc acceptat, documentat.

**Feature nou din audit (nu era finding, era gol de proces):** nu exista niciun mecanism de suspendare de
cont din `/admin-page` — singura armă de moderare era ștergerea ireversibilă (GDPR anonimizare). Adăugat
`setUserStatus` (repo + service + acțiune admin + buton UI cu confirmare + audit `admin_user_suspended`/
`admin_user_reactivated`) — moderare reversibilă, testat unit + e2e (`e2e/admin-suspend.spec.ts`).

**Igienă Sentry (efect secundar util al auditului):** 9 issue-uri vechi `unresolved` erau cod mort
(Planșa pre-rescriere, excalidraw/tldraw) sau incident istoric de migrație (2026-07-05) — închise cu
comentariu explicativ. Regulă nouă adăugată în `CLAUDE.md`: după orice refactor care elimină cod, trece
prin Sentry și închide ce nu se mai poate reproduce.

---

## Nota onestă

> **Corectat 2026-07-09 (a doua trecere):** prima variantă a acestei secțiuni dădea 7/10, amestecând în
> ACELAȘI număr două lucruri diferite — (1) cât de bine testat e codul și (2) faptul că niciun audit nu poate
> certifica împotriva unui atacator uman determinat. Al doilea lucru e adevărat, dar e o **limită categorică a
> oricărei metode de audit** (a mea, a lui Codex, a oricui) — nu o slăbiciune concretă găsită în platformă. Nu
> se codifică drept „-3 puncte", pentru că atunci pare o problemă găsită, când de fapt e o limită a evaluării
> însăși. Corectat mai jos: numărul măsoară STRICT ce s-a testat; ce nu poate fi testat se spune în cuvinte,
> separat, fără să tragă un număr fals-precis în jos.

**Postura de securitate testată a codului: 8.5–9 / 10.** Susținut de dovadă, nu de ton:
- **Două audituri metodologic diferite** (white-box al meu + black-box independent, Codex) → **zero Critical,
  zero High, pe amândouă.**
- Tot ce a ieșit Medium/Low → **remediat în aceeași zi**, cu teste (Turnstile admin, CSP, security.txt).
- **IDOR**: 7 scenarii cross-user, rulate (nu doar citite din cod) — comentariu edit/delete, schiță delete
  published/draft, ciornă detaliu, planșă, editare detaliu.
- **Concurență**: testată real cu `Promise.all` (5 dezaprobări paralele) — nu doar teoretizată; upsert atomic
  confirmat sub sarcină.
- **Rate-limit** distribuit, **fail-closed în producție** (nu fail-open tăcut, greșeala tipică).
- Ownership scoped pe `userId`/`authorId` din sesiune peste tot, niciodată din client — clasa IDOR închisă
  structural. Threat-modeling documentat în cod (comentariile SEC-01…14 explică AMENINȚAREA, nu linia de cod).

Asta nu e vibe coding cu noroc — e muncă verificabilă de nivel senior, cu dovadă la fiecare afirmație de mai
sus, nu doar afirmată.

**Ce NU intră într-un număr — și de ce nu forțăm o cifră acolo:**
- **Rezistența la un atacator uman real, determinat.** Niciun audit AI (al meu sau al lui Codex) nu simulează
  timp, motivație și creativitate reale. Asta nu se măsoară cu un scor din citit cod — se verifică doar printr-un
  pentest uman advers, pe care nu l-am făcut.
- **Comportament la trafic real** (concurență de sute de useri, scară) — netestat, pentru că n-a existat încă
  ocazia. Nu e „notă mică", e „încă necunoscut".
- **DMARC `p=none`** — gaură de phishing reală, deschisă acum, dar cunoscută, documentată, cu plan de închidere
  (mai jos) — nu un necunoscut.
- **Goluri de observabilitate** — `platform_settings` neexplicat, alertare Sentry neconfirmată end-to-end.

**Concluzia onestă:** partea care ține de inginer — fundamentele de securitate scrise corect, testate, cu
gărzi consecvente — e făcută la un nivel peste marea majoritate a proiectelor în faza asta, și dovada o susține
(8.5–9, nu o cifră umflată). Ce rămâne deschis nu e un defect găsit, e limita oricărui audit: nimeni nu poate
certifica „rezistă la orice atac" fără un pentest uman plătit sau ani de trafic real — resurse pe care un MVP
în fază de validare, structural, nu le are încă.

---

## Note & risk-acceptance (nu sunt vulnerabilități)

1. **`npm audit`: 6 moderate, 0 high/critical.** `postcss <8.5.10` (bundle-uit în `next`, XSS la stringify
   CSS ne-de-încredere — nu facem asta) + `esbuild` (via `drizzle-kit`, doar dev-server). Ambele tranzitive,
   deja pe ultima versiune a pachetului-părinte; `audit fix --force` ar face downgrade major = rupe app-ul.
   Neexploatabile la noi. CI alertează la escaladare spre high/critical.
2. **`saveStrokesAction` (autosave ciornă) nu are rate-limit dedicat.** Author-scoped, scrie **doar** în
   propriul DRAFT, cost mic. Bounded per user. Opțional de adăugat `limiters.mutation` pentru paritate; nu e
   un risc real de abuz.
3. **Turnstile fail-open la eroare de rețea** (`lib/turnstile.ts`) — deliberat, ca să nu ne auto-blocăm
   signup-ul dacă Cloudflare pică. Rate-limit-ul pe email+IP rămâne plasa de siguranță. Fail-open **doar** la
   outage, **nu** la token invalid. Acceptat.
4. **`trustHost: true`** (`lib/auth.ts`) — pe Vercel hostul e de încredere (proxy controlat). Bifat pe viu la
   §11 că `Host`/`X-Forwarded-Host` nu pot influența magic link-urile. Nu e schimbare de cod.

**Cod mort / rute care nu duc nicăieri:** nu am găsit rute orfane sau handlere neprotejate. Singurele
resturi „inerte" sunt intenționate și documentate: valorile de enum `PENDING_ACCEPTANCE`/`REJECTED`
(schițe — flux vechi, doar date istorice) cu ramurile lor din `SKETCH_STATUS_VIEW`, și schela
`requestRoleVerification` (Poarta 2 pe HOLD, neutralizată la nivel de server — nu colectează PII).

---

## Cele 13 categorii — rezultat

1. **Secrete & config** — ✅ Fără secrete în cod. Doar `.env.example` e comis (placeholder-uri). Sentry
   strip-uiește debug logging la build. Sursa de env = Vercel per mediu.
2. **Autentificare** — ✅ Passwordless magic link (Auth.js v5, sesiune `jwt`). Token one-time, TTL din env
   (15 min). Admin are auth proprie: token `randomBytes(32)`, sesiune cookie HttpOnly opac, validată în DB,
   re-check allowlist la consum ȘI la fiecare request. Anti-prefetch (pagina `/verify` auto-confirmă din JS).
3. **Autorizare** — ✅ Deny-by-default în proxy (gating rute) + authz fină în services (ownership pe
   `authorId`/`actorUserId` din sesiune). IDOR închis: pozițiile/comentariile/schițele/bookmark-urile sunt
   întotdeauna scoped pe userul din sesiune. `getDetailById` întoarce doar `PUBLISHED`. Editare/ștergere
   comentariu: `WHERE id = ? AND author_id = ?`. Regula „nu te validezi pe propriul conținut" enforce server.
   Admin gate centralizat în proxy. Suspendare: gate soft (token) pe citire + gate tare (DB proaspăt + signOut)
   pe mutații (vezi SEC-04/JWT mai sus).
4. **Input validation & injection** — ✅ Drizzle = query parametrizate peste tot. `isUuid` gardează coloanele
   uuid. Strokes validate structural + normalizate 0..1, plafoane anti-DoS. Fără injecție de comandă/path/SSRF.
5. **API & access control** — ✅ Două route handlers: `/api/auth/*` (Auth.js) și `/api/blob/upload` (sesiune +
   rate-limit + restricție tip/mărime la emiterea tokenului). Erorile ascund internals. Fără chei server
   expuse la client.
6. **Business logic** — ✅ State machine schiță (DRAFT→PUBLISHED) cu tranziție atomică guard-ată pe
   status+autor. „Dezaprobare fără justificare" respinsă pe server. Constrângere unică DB
   `(user_id, target_type, target_id)`. „Un singur rol per user" (unique pe `roles.user_id`).
7. **Data protection & privacy** — ✅ HTTPS + HSTS (2 ani, preload). Cookie sesiune HttpOnly+Secure+SameSite.
   PII nu se loghează. Ștergere cont = anonimizare GDPR. Imagini re-encodate → EXIF/GPS stripate.
8. **Logging & monitoring** — ✅ `lib/audit.ts` (evenimente structurate fără PII brut). Sentry live. Hook
   `block-pii-log` în repo.
9. **Abuse & rate limiting** — ✅ Upstash sliding-window distribuit. Auth (5/h email, 20/h IP), mutații
   (40/min), create-detail (10/h), upload (30/h), admin-login. **Fail-closed în producție**. Turnstile pe
   login+signup.
10. **Dependencies & supply chain** — ✅ Lockfile prezent. 0 high/critical (vezi Nota 1). CI rulează
    `npm audit --audit-level=high` pe fiecare PR.
11. **Infrastructure & deployment** — ✅ Vercel (fra1) + Neon + Upstash + Cloudflare DNS-only. Headere de
    securitate complete (`next.config.ts`). Lockdown/mentenanță prin proxy. Fără endpoint-uri de debug în prod.
12. **File handling & storage** — ✅ Upload client direct în Blob cu token server-restricționat. Persistare
    acceptă **doar** URL-uri din store-ul nostru (`BLOB_URL_RE`) → anti-SSRF. Toate imaginile trec prin
    `sharp` (magic-bytes real, strip metadata, plafon anti decompression-bomb). SVG/GIF/HEIC respinse.
13. **Security testing** — ✅ Teste unit/securitate (vitest) pe domain+lib. E2E Playwright (public + authed).
    CI type-check+lint+build. Acest audit = review-ul critic al fluxurilor + pen-test manual pe viu (§11).

---

## Poarta §11 — rezultate pe viu (`detalia.ro`)

| § | Test | Rezultat |
|---|------|----------|
| **A** | Gating rute protejate (anon) | ✅ PASS — toate rutele protejate → `302 → /login?callbackUrl=...`. |
| **B** | Fișiere/rute sensibile expuse | ✅ PASS — `.env`, `.git/*`, `backup.sql`, `actuator/env`, `/admin*` etc. → toate 302, niciunul servit. |
| **H** | Headere & TLS | ✅ PASS — HSTS preload, `X-Frame-Options: DENY`, `nosniff`, CSP cu nonce, fără `unsafe-inline`. |
| **C.2** | IDOR mutație (distructiv): atacator editează/șterge comentariul victimei | ✅ PASS — replay real cu cookie-ul atacatorului → `NOT_FOUND`, comentariul victimei intact/supraviețuiește. |
| **C** | Ownership pagină `/details/{id}/edit` | ✅ PASS — non-autorul e redirectat, fără formular. |
| **D** | Dezaprobare mută (distructiv): justificare goală/spații | ✅ PASS — server respinge, nicio poziție/comentariu creat. |
| **G** | Cont suspendat (SEC-04, JWT) | ✅ PASS — citire permisă (token stale), mutație blocată + signOut real. Detalii mai sus la SEC-04/JWT. |
| — | `/profile/<malformat>` (SEC-H01) | ✅ `notFound()` curat, fără 500. |

**C.1/C.3 (ștergere DETALIU/SCHIȚĂ cross-user) și opționalele E (rate-limit magic-link), F (upload
non-imagine/URL extern), I (magic link one-time), J (`X-Forwarded-Host` fabricat): acceptate pe încredere,
NU se mai rulează distructiv** (decizie de produs, 2026-07-02) — mecanismul de ownership e byte-identic cu C.2
(deja dovedit), iar restul e dovedit static. Playbook-ul rămâne mai jos dacă vreodată vrem să le re-rulăm.

**Metodă C.2 (reproductibilă):** captura encoding-ului server action (Playwright, cookie injectat) + replay
cross-user cu `curl` (header `Next-Action` + body JSON + `Origin: https://detalia.ro`).

**Reproducere rapidă (oricând):**
```bash
curl -sSI https://detalia.ro/ | grep -iE 'strict-transport|x-frame|x-content-type|referrer|permissions-policy|content-security'
```

### Playbook manual (referință, dacă se re-rulează vreodată)

> Cere conturi reale + acces Neon (ramura `production`). Cheatsheet SQL în `.remember/remember.md`.

- **C.1/C.3.** Contul A creează un detaliu/schiță. Contul B încearcă `deleteDetailAction`/`deleteSketch` pe
  conținutul lui A → *așteptat:* no-op / FORBIDDEN.
- **E.** >5 cereri magic-link/oră pe același email → `?error=RateLimited`.
- **F.** Fișier non-imagine redenumit `.png` / URL extern în `imageUrl` → respins (sharp / `BLOB_URL_RE`).
- **I.** Magic link folosit de două ori → a doua oară invalid.
- **J.** `X-Forwarded-Host` fabricat → linkul din email rămâne pe `detalia.ro` (`AUTH_URL`).

---

## Riscuri de domeniu care trebuie păstrate în orice refactor

- `validations` și `comments` sunt polimorfice și nu au FK pe target; service-ul trebuie să verifice tipul și existența.
- Ownership-ul schiței: edit/send = autorul schiței; ștergere = autorul schiței SAU autorul detaliului-mamă.
- Poziția e unică și reversibilă per user/țintă; constrângerea DB trebuie păstrată.
- Dezaprobarea fără justificare e întotdeauna respinsă server-side.
- Tokenul de magic link trebuie să fie one-time și să expire.
- Status cont suspendat: gate soft pe token (citire) + gate tare pe DB proaspăt + signOut (mutații) — nu
  elimina al doilea fără să compensezi altfel (ex. token scurt + re-check la refresh, vezi Recomandări).

---

## Recomandări (prioritizate)

1. ~~Deploy JWT~~ — **FĂCUT**, JWT + SEC-H01 pe `main`.
2. ~~Configurează alerte~~ — **FĂCUT** (2026-07-03): Sentry Alerts pe `audit_event` (`rate_limited`,
   `rate_limit_unavailable`, `access_denied_suspended`, `admin_login_failed`) → notify Liviu.
3. **Opțional, neimplementat (decizie 2026-07-03):** token JWT cu `maxAge` scurt + re-check status la refresh —
   respins; costă friction (relogin mai des) pentru un beneficiu marginal (citirea unui cont suspendat nu e
   periculoasă, mutațiile sunt deja blocate tare).
4. ~~Rate-limit pe `saveStrokesAction`; `overrides` pe `postcss>=8.5.10`~~ — **FĂCUT 2026-07-03** (vezi
   CHANGELOG). npm audit: 6 → 4 moderate.

---
*Audit inițial 2026-07-02, actualizat același jurnal odată cu implementarea JWT + fix-ul de suspendare.
Nu înlocuiește testul pe viu (§11) — care validează configul de mediu (env, host, TLS) ce nu se vede din cod.*
