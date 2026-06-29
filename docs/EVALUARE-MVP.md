# DETALIA — Evaluare MVP (prod-readiness)

> Evaluare a stării curente față de „production-ready", cu note pe capitole și **pași concreți de îmbunătățire**
> pentru fiecare. Exclude din scor: blocajele cunoscute, deciziile pe HOLD și cele intenționate (vezi `CLAUDE.md`
> „Decizii deschise" + handoff). Sursa de adevăr pentru securitate = `SECURITATE.md`; aici e doar sinteza + planul.
>
> **Data evaluării:** 2026-06-29. De re-evaluat după fiecare fază mare.

---

## Verdict

**MVP prod-ready: ~91%** *(ridicat 2026-06-29 — E2E verde + §11c igienă închisă).* Funcționalul și securitatea
sunt acolo, validate end-to-end pe preview. Rămas până la 100%: **poarta finală §11** (manuală) și smoke-test;
accesibilitatea = pe HOLD (decizie Liviu, nu blochează). Niciun datorie tehnică structurală.

| Capitol | Notă | Direcția |
|---|---|---|
| Securitate | 9.5/10 | doar poarta §11 manuală |
| Performanță | 8/10 | profilare la date reale |
| Scalabilitate | 8.5/10 | OK pentru fază |
| Clean architecture / principii | 9.5/10 | §11c igienă închisă |
| Testare | 8/10 | E2E verde; rămâne schiță + integrare |
| Observabilitate | 7/10 | alerte + (later) Sentry |
| Accesibilitate | 5/10 | **PE HOLD** (decizie Liviu) |

---

## Securitate — 9.5/10

**De ce:** deny-by-default, IDOR enforce în services, rate-limit distribuit (Upstash), upload re-procesat
(strip EXIF, validare din magic bytes), allowlist URL/Blob (anti-SSRF), CSP + security headers, validare UUID
centralizată, audit trail fără PII, ștergere cont GDPR. Acoperit cu teste. FAZA 1+2+3 (SEC-01..14, mai puțin SEC-05
HOLD) închise.

✅ **CSP nonce** + ✅ **erori silențioase loggate** + ✅ **§11c igienă #1/#2/#3/#5** (toate 2026-06-29) — făcute, vezi CHANGELOG.

**Cum ajunge la 10 (rămas):**
1. Rulează **poarta finală §11** pe staging: 3 conturi (autor / străin / suspendat), IDOR manual pe fiecare server
   action, replay + expirare magic-link, upload MIME fals / fișiere uriașe, URL `javascript:`/`data:`, accept/reject
   concurent, verificare cookie-uri + toate headerele (inclusiv CSP nonce pe preview).
2. **Configurează alertele** (rate/cost) în dashboard Vercel Logs + Upstash pe evenimentele `rate_limited` /
   `access_denied_suspended` deja emise de audit.
3. Validează **rotația secretelor + backup/restore** Neon (procedură scrisă, testată o dată).
4. Teste de securitate E2E (vezi capitolul Testare).

---

## Performanță — 8/10

**De ce:** feed finit (~20, fără scroll infinit), `next/image` + Blob, poziții batch-uite (fără N+1 evident),
thumbnail randat o singură dată la publicare.

**Cum ajunge la 9-10:**
1. **Profilează query-ul de feed** „debated" (sortare după interacțiuni) pe un volum realist (sutele de detalii din
   seed) — verifică planul de execuție; adaugă indecși acolo unde sortarea/filtrarea o cere.
2. **Verifică indexarea** pe coloanele de sortare/join folosite efectiv (nu doar pe FK).
3. **Buget de performanță** minim: LCP/INP pe pagina de feed și de detaliu, măsurat în Vercel Speed Insights.
4. Un **smoke load-test** (ex. k6/Artillery) pe feed + creare detaliu + validare, ca să cunoști pragul înainte de
   lansare (nu pentru optimizare prematură, ci ca să nu fii surprins).

---

## Scalabilitate — 8.5/10

**De ce:** serverless (Vercel Fluid + Neon + Upstash) scalează orizontal natural pentru traficul țintă; business
izolat în `server/` → extragere spre API separat fără rescriere.

**Cum ajunge la 9-10:**
1. **Atomicitate scrieri multi-pas:** driverul Neon HTTP nu are tranzacții interactive → detaliu+resurse se inserează
   secvențial (o resursă orfană e tolerabilă acum). Când contează, treci pe driverul Neon cu suport de tranzacții
   sau grupează în SQL.
2. Definește **politica de retenție** pentru loguri/audit și pentru notificări vechi (creștere nemărginită altfel).
3. Reconfirmă **limitele de plan** (Neon connections, Upstash req/zi, Blob storage) față de proiecția de trafic.

---

## Clean architecture / principii — 9/10

**De ce:** stratificare curată (domain pur → services → repos → UI subțire), zero business în handlere, DRY/KISS,
glosar de domeniu consecvent, docs + changelog disciplinate.

**Cum ajunge la 10:** ✅ **§11c #1/#2/#3/#5 făcute (2026-06-29, vezi CHANGELOG)** — profile actions prin
`profileService`, `zod` scos, validări istorice cu `roleSnapshot`, `maxLength` pe textarea + loading states.
Igiena de cod e închisă; restul drumului spre 10 = doar rafinări marginale pe măsură ce crește baza de cod.

---

## Testare — 8/10  *(ridicat 2026-06-29 — E2E verde)*

**De ce:** unit + domain + servicii (cu repo-uri mock) solide (~66 aserțiuni) **+ E2E Playwright VERDE 15/15 pe
preview** (9 public + 6 authed): landing/auth UI, deny-by-default, 404, feed authed, profil, **validarea pe roluri**
(aprob 1 click + dezaprob cu justificare → comentariu), comentariu. Authed via sesiune seedată în DB (fără bypass în
producție). E2E-ul a și prins un drift real (`users.cover_position` lipsă pe `preview/dev`). Vezi `e2e/README.md`.

**Cum ajunge la 9-10:**
1. **E2E pe schiță** draft→send→accept→teanc — rămas (flaky pe canvas, necesită helper de stroke-uri).
2. **Teste de integrare** handler→service→repo pe o bază de test — prinde ce mock-urile ascund (constrângeri DB,
   cascade, polimorfism). E2E acoperă acum parțial asta prin fluxul real pe preview.
3. **CI**: rulează testele pe fiecare PR (acum CI face doar type-check + lint + build); E2E poate rula pe preview cu bypass.

---

## Observabilitate — 7/10

**De ce:** audit trail structurat (`lib/audit.ts`) + loguri Vercel native. Fără error tracking de producție (decizie:
amânat) și fără dashboard de alerte încă.

**Cum ajunge la 8-9:**
1. **Alerte** pe evenimentele de audit (rate-limit, access-denied) în Vercel/Upstash.
2. **Sentry** (sau echivalent) când apar useri reali — stack traces grupate, alerte pe erori, fără reproducere manuală.
3. **Correlation ID** propagat prin request (acum evenimentele sunt punctuale) — util la debugging cap-coadă.

---

## Accesibilitate — 5/10  *(PE HOLD — decizie Liviu 2026-06-29)*

**De ce:** singurul capitol neatins. NU e cerută de client (evaluare internă) și nu e critică acum → **pusă pe HOLD**,
nu se implementează în această fază. Lista de mai jos rămâne ca plan de reluare.

**Cum ajunge la 8-9:**
1. **Contrast** AA pe text/butoane (verifică paleta caldă pe fundalurile crem).
2. **Focus vizibil** pe toate elementele interactive (keyboard nav).
3. **Target tap ≥44px** pe acțiunile mici (iconițe avatar/cover, controale schiță).
4. **Etichete text / `aria-label`** pe butoanele cu doar iconiță (parțial făcut — de completat).
5. Un **audit automat** (axe DevTools / Lighthouse a11y) pe paginile principale, apoi remediere.

---

## Ordinea recomandată (cost/impact)

1. **Poarta de securitate §11** pe preview — verdict APPROVED (singurul lucru între noi și „gata de lansare").
2. **Smoke-test vizual** pe preview.
3. **Profilare feed + buget perf** — înainte de creștere.
4. Restul (E2E schiță, Sentry, alerte, load-test) — pe măsură ce apar useri reali.

> ✅ **Făcute 2026-06-29:** E2E Playwright (verde pe preview), §11c igienă cod. **HOLD:** accesibilitate (decizie Liviu).
