# DETALIA — Evaluare MVP (prod-readiness)

> Evaluare a stării curente față de „production-ready", cu note pe capitole și **pași concreți de îmbunătățire**
> pentru fiecare. Exclude din scor: blocajele cunoscute, deciziile pe HOLD și cele intenționate (vezi `CLAUDE.md`
> „Decizii deschise" + handoff). Sursa de adevăr pentru securitate = `SECURITATE.md`; aici e doar sinteza + planul.
>
> **Data evaluării:** 2026-07-04 (audit pe scenarii), actualizat 2026-07-07 (acoperire E2E extinsă +
> gol de observabilitate deschis), **recalibrat 2026-07-09** (două treceri: prima a amestecat „calitate cod"
> cu „rezistă la orice atac" în același număr și a scăzut nota de securitate prea mult, la 7; a doua trecere
> a corectat asta — vezi `docs/SECURITATE.md` §„Nota onestă"). De re-evaluat după fiecare fază mare.
> Istoricul „ce s-a făcut și când" trăiește în `docs/CHANGELOG.md` — aici stau doar starea curentă + golurile
> rămase, nu un jurnal de implementare.

---

## Verdict

**MVP prod-ready: ~93%.** Funcționalul și fundamentele de securitate sunt validate end-to-end, inclusiv teste
distructive reale pe prod (§11) și un audit extern independent (Codex, black-box) — **zero Critical/High pe
ambele lentile**. **Nu există „100%" onest la acest stadiu** — nu pentru că s-ar fi găsit ceva greșit, ci pentru
că nimic din ce s-a validat n-a văzut încă **trafic real**, și niciun audit (al meu sau extern) nu înlocuiește o
verificare umană adversă reală — asta e o limită a oricărei metode de evaluare, nu un defect găsit în platformă.
Asta nu ține pe loc lansarea (e exact scopul fazei de validare de piață) — ține pe loc declarația de „gata și
nu se mai poate întâmpla nimic". Primele zile cu useri reali trebuie urmărite activ (Sentry + Vercel Logs),
nu lăsate pe pilot automat.

> **Notă despre recalibrarea 2026-07-09:** a fost în două trepte. Prima trecere a amestecat „cât de bine e
> testat codul" cu „nimeni nu poate certifica rezistență la orice atac" în ACELAȘI număr, ceea ce a dus nota
> de securitate greșit de jos, la 7 — și cu ea, tot procentul, la ~87%. A doua trecere a corectat asta: numărul
> măsoară STRICT ce s-a testat (dovadă: zero Critical/High, două lentile independente, IDOR+concurență testate
> real); limita „niciun audit nu certifică rezistență la un atacator uman" se spune în cuvinte, separat, fără
> să tragă fals-precis un scor în jos. Detalii complete → `docs/SECURITATE.md` §„Nota onestă".

| Capitol | Notă | Direcția |
|---|---|---|
| Securitate | 8.5–9/10 | vezi `docs/SECURITATE.md` §„Nota onestă" — postura TESTATĂ a codului: zero Critical/High pe două audituri independente (white-box + black-box), IDOR (7 scenarii) și concurență testate real, nu doar citite. Ce NU intră în număr (limită de metodă, nu defect găsit): rezistență la atacator uman real, comportament la trafic real — vezi document pentru detaliu |
| Performanță | 9/10 | indexare corectă; rămâne doar profilarea pe trafic real (netestabilă acum) |
| Scalabilitate | 8.5/10 | OK pentru fază |
| Clean architecture / principii | 9.5/10 | §11c igienă închisă |
| Testare | 9.5/10 | E2E extins la ~86 teste/24 fișiere (2026-07-07) — acoperă și paginile secundare (profil, saved, notificări), admin access-control, feed search/filtrare; rulare curată în așteptare |
| Observabilitate | 8.5/10 | Sentry live + alerte active pe rate-limit/suspendare/admin-login-failed; **gol deschis:** `platform_settings` — citire eșuată intermitent în prod, cauză reală încă necunoscută |

---

## Securitate — 8.5–9/10 (postura testată a codului)

> **Recalibrat 2026-07-09, în două treceri** — vezi `docs/SECURITATE.md` §„Nota onestă" pentru analiza
> completă și istoricul corecției. Analiza nu se duplică aici; doar sinteza.

Fundamentele (auth, authz, IDOR — 7 scenarii testate real, injecție, rate-limiting fail-closed în prod,
business logic cu tranziții atomice testate sub concurență) sunt închise la nivel de inginerie, confirmate
independent de **două audituri metodologic diferite** (white-box al meu + black-box independent Codex) —
**zero Critical, zero High, pe amândouă.** Asta e dovadă, nu ton.

**Ce NU intră în acest număr, deliberat** (limită de metodă, nu defect găsit în platformă): rezistența la un
atacator uman real și determinat — niciun audit AI n-o poate certifica; comportamentul sub trafic real —
netestat pentru că n-a existat încă ocazia. Rămân și câteva goluri concrete, cunoscute, cu plan: DMARC `p=none`
(deschis, cu grijă la livrare), `platform_settings` (instrumentat, așteaptă traceul real), alertare Sentry
neconfirmată end-to-end. Niciunul dintre astea nu e „vibe coding" sau neglijență — sunt limite normale pentru
un MVP în fază de validare, fără resurse pentru pentest uman plătit sau ani de trafic real.

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
