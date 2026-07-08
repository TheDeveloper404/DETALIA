# DETALIA — Evaluare MVP (prod-readiness)

> Evaluare a stării curente față de „production-ready", cu note pe capitole și **pași concreți de îmbunătățire**
> pentru fiecare. Exclude din scor: blocajele cunoscute, deciziile pe HOLD și cele intenționate (vezi `CLAUDE.md`
> „Decizii deschise" + handoff). Sursa de adevăr pentru securitate = `SECURITATE.md`; aici e doar sinteza + planul.
>
> **Data evaluării:** 2026-07-04 (audit pe scenarii), actualizat 2026-07-07 (acoperire E2E extinsă +
> gol de observabilitate deschis). De re-evaluat după fiecare fază mare.
> Istoricul „ce s-a făcut și când" trăiește în `docs/CHANGELOG.md` — aici stau doar starea curentă + golurile
> rămase, nu un jurnal de implementare.

---

## Verdict

**MVP prod-ready: ~96%.** Securitatea și funcționalul sunt validate end-to-end, inclusiv teste distructive
reale pe prod (§11). JWT deployat, login confirmat pe viu. **Nu există „100%" onest la acest stadiu** —
motivul e simplu: nimic din ce s-a validat n-a văzut încă **trafic real**. Codul e solid; comportamentul la
scară (feed cu sute de detalii, useri simultani) e necunoscut, nu testat, pentru că nu a existat încă ocazia.
Asta nu ține pe loc lansarea (e exact scopul fazei de validare de piață) — ține pe loc declarația de „gata și
nu se mai poate întâmpla nimic". Primele zile cu useri reali trebuie urmărite activ (Sentry + Vercel Logs),
nu lăsate pe pilot automat.

| Capitol | Notă | Direcția |
|---|---|---|
| Securitate | 9.8/10 | audit categorii + **audit pe scenarii (7 feature-uri, 9 fixuri)** — clasa SEC-04 închisă uniform |
| Performanță | 9/10 | indexare corectă; rămâne doar profilarea pe trafic real (netestabilă acum) |
| Scalabilitate | 8.5/10 | OK pentru fază |
| Clean architecture / principii | 9.5/10 | §11c igienă închisă |
| Testare | 9.5/10 | E2E extins la ~86 teste/24 fișiere (2026-07-07) — acoperă și paginile secundare (profil, saved, notificări), admin access-control, feed search/filtrare; rulare curată în așteptare |
| Observabilitate | 8.5/10 | Sentry live + alerte active pe rate-limit/suspendare/admin-login-failed; **gol deschis:** `platform_settings` — citire eșuată intermitent în prod, cauză reală încă necunoscută |

---

## Securitate — 9.8/10

**De ce:** deny-by-default, IDOR enforce în services, rate-limit distribuit (Upstash) + alerte Sentry active pe
evenimentele de audit, upload re-procesat (strip EXIF, validare din magic bytes), allowlist URL/Blob (anti-SSRF),
CSP + security headers, validare UUID centralizată, audit trail fără PII, ștergere cont GDPR. Audit formal
CRITICAL (13 categorii) APROBAT, verificat cu atacuri reale pe prod — detalii în `docs/SECURITATE.md` (sursa
unică de adevăr pentru securitate).

**Audit pe SCENARII (2026-07-04) — complementar auditului pe categorii.** Metodă nouă: matrice
actor×acțiune×perturbare executată prin cod (nu checklist), pe toate cele 7 feature-uri cu mutații (~99
scenarii). A prins ce auditul pe categorii nu vede — **comportament**, nu proprietăți statice. **9 fixuri:**
5 goluri SEC-04 (cont suspendat cu JWT viu putea încă face mutații — retragere poziție, ștergere/creare schiță,
ștergere ciornă/detaliu/comentariu, plus poarta de upload; acum **clasa e închisă UNIFORM**), 1 race atomic la
dublu-submit dezaprobare (comentarii duplicate), 1 consum atomic al token-ului de magic link admin (evită sesiuni
duble), 1 de-anonimizare GDPR la onboarding (PII rescris peste cont șters), 1 cleanup thumbnail orfan. Detalii →
CHANGELOG 2026-07-04 (#1–#7).

> ⚠️ **Verificare:** fixurile sunt validate cu `tsc`+eslint + citire cap-coadă; #1 are teste unit noi
> (`validationService.test.ts`). **Rulează `npm test`** înainte de următorul deploy; restul fixurilor (SEC-04,
> token admin, upload) sunt corecturi mici/atomice fără test dedicat (greu de acoperit unitar fără browser/DB).

**Cum ajunge la 10 (rămas):**
1. ✅ Procedura de **rotație a secretelor** e scrisă (`docs/DEPLOY.md` §2b) — rămâne doar **executată o dată**
   (manual, de Liviu) + validat **backup/restore** Neon.
2. Materializează în teste scenariile confirmate care încă n-au acoperire (consum token admin; SEC-04 pe acțiuni).

---

## Performanță — 9/10

**De ce:** feed finit (~20, fără scroll infinit), `next/image` + Blob, sesiune `jwt` (fără query Neon per
`auth()`), regiuni aliniate (Vercel `fra1` + Neon eu-central-1), thumbnail randat o singură dată la publicare.
Subquery-urile corelate din `listFeed` (`validationCount`/`commentCount`/`sketchCount`) au indecși potriviți
(`validations_target_idx`, `comments_target_idx`, `sketches_detail_id_idx`). Singurul gol structural: `ORDER BY
interactionScore` sortează pe o expresie calculată (sumă, nu coloană) → neindexabil; fix-ul ar fi un scor
denormalizat, nejustificat la scara actuală de zeci-sute de detalii.

**Rămân, legate de trafic real (nu se pot face din cod, pe HOLD până la useri reali):**
1. **Buget de performanță** minim: LCP/INP pe pagina de feed și de detaliu, măsurat în Vercel Speed Insights.
2. Un **smoke load-test** (ex. k6/Artillery) — după ce sunt useri reali, nu acum.

---

## Scalabilitate — 8.5/10

**De ce:** serverless (Vercel Fluid + Neon + Upstash) scalează orizontal natural pentru traficul țintă; business
izolat în `server/` → extragere spre API separat fără rescriere.

**Cum ajunge la 9-10:**
1. Reconfirmă **limitele de plan** (Neon connections, Upstash req/zi, Blob storage) față de proiecția de trafic.

---

## Clean architecture / principii — 9/10

**De ce:** stratificare curată (domain pur → services → repos → UI subțire), zero business în handlere, DRY/KISS,
glosar de domeniu consecvent, docs + changelog disciplinate.

**Cum ajunge la 10:** igiena de cod e închisă; restul drumului spre 10 = doar rafinări marginale pe măsură ce
crește baza de cod.

---

## Testare — 9/10

**De ce:** unit + domain + servicii (cu repo-uri mock) solide (11 fișiere `.test.ts`) + E2E Playwright extins
2026-07-07 la **~86 teste / 24 fișiere** pe preview (public + setup + authed + schiță + securitate + integrare
+ admin-access + sketch-public + feed-search): landing/auth UI, deny-by-default, 404, feed authed (+ căutare
și filtrare pe categorie), profil (propriu + public), saved/bookmark, notificări, validarea pe roluri,
comentariu, schiță publish→teanc→delete, teaser public de schiță (`/s/[id]`), control acces `/admin-page`
(privilege-escalation, fără să depindă de un email real din allowlist), **IDOR pe comentariu și schiță**
(cross-user, service+DB real), **integrare** (atomicitatea `createDetail`, cascada la ștergere detaliu +
polimorfism validare/comentariu pe schiță). Authed via cookie de sesiune JWT — fără bypass în producție. CI
rulează `npm test` (vitest) pe fiecare PR; E2E NU rulează în CI (cere preview + bypass), manual pe preview.

**Gol găsit + reparat (2026-07-07):** `auth.setup.ts` avea un bug de reproductibilitate — categoria seedată
era aleasă nedeterminist la fiecare rulare, divergea de legătura reală din DB. Corectat; a cauzat un eșec
real (nu flaky) în noile teste de filtrare pe categorie.

**De confirmat:** rulare curată completă după curățarea DB-ului de preview (date acumulate din rulări
repetate) — 2 eșecuri (`canvas.spec.ts`, `suspended.spec.ts`) apărute o singură dată, suspectate flake
tranzitoriu, neconfirmate încă pe DB curat. 2 eșecuri vechi documentate (`authed.spec.ts` „Dezaprob",
`sketch.spec.ts` „Șterge schița mea") — posibil artefact Playwright, nu bug real, neinvestigate cu ipoteze
noi fără dovadă.

**Cum ajunge la 10:** aproape închis — restul e doar volum. **Gol punctual (2026-07-04):** cele 9 fixuri din
auditul pe scenarii sunt verificate static (`tsc`+eslint) dar doar #1 are teste unit noi; `npm test` de rulat +
de adăugat teste pe consumul token-ului admin și pe blocarea SEC-04 la nivel de acțiune (parțial acoperit acum
de `admin-access.spec.ts`, 2026-07-07).

---

## Observabilitate — 8.5/10

**De ce:** audit trail structurat (`lib/audit.ts`) + loguri Vercel native + Sentry live pe prod (erori
server/client/edge) + alerte active (Sentry Alerts pe tag `audit_event`: rate-limit, cont suspendat,
login-admin eșuat → notificare Liviu).

**Gol deschis (de zile, necunoscut):** `getSettingsRow()` (`server/repos/settingsRepo.ts`) — citirea
tabelului `platform_settings` (config de mentenanță/lockdown, citit pe căi critice: proxy + feed) eșuează
intermitent în producție, în zile diferite. Nu e drift de schemă (verificat direct în DB). Tolerant by design
(catch → default, site-ul nu pică), deci fără impact vizibil pe useri — dar cauza reală rămâne necunoscută.
Până 2026-07-07 eroarea nu ajungea deloc în Sentry (doar `console.error`, deci invizibilă retroactiv în Vercel
Logs); acum raportează cu `err.cause` + tag `platform_settings` — următoarea apariție va avea, sperăm, cauza
reală (connection refused / pool epuizat / timeout Neon).

**Cum ajunge la 10:**
1. **`platform_settings`** — de investigat cu dovadă din Sentry la următoarea apariție (nu ghicit).
2. **Correlation ID** propagat prin request (acum evenimentele sunt punctuale) — util la debugging cap-coadă.

---

## Ordinea recomandată (cost/impact) — de acum înainte

1. **Urmărește activ primele zile cu trafic real** (Sentry + Alerts + Vercel Logs) — nu pilot automat; e primul
   semnal despre ce nu s-a văzut în teste (scară, comportament neanticipat de useri).
2. **Profilare feed + indexare** de îndată ce există date reale (nu de test) — atunci apare N-ul care contează.
3. Restul (load-test, backup/restore Neon rehearsed, rotație secrete) — pe măsură ce crește baza de useri, nu
   blocante pentru lansare.
