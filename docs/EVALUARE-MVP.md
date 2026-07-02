# DETALIA — Evaluare MVP (prod-readiness)

> Evaluare a stării curente față de „production-ready", cu note pe capitole și **pași concreți de îmbunătățire**
> pentru fiecare. Exclude din scor: blocajele cunoscute, deciziile pe HOLD și cele intenționate (vezi `CLAUDE.md`
> „Decizii deschise" + handoff). Sursa de adevăr pentru securitate = `SECURITATE.md`; aici e doar sinteza + planul.
>
> **Data evaluării:** 2026-07-02. De re-evaluat după fiecare fază mare.

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
| Securitate | 9.7/10 | poarta §11 rulată pe viu, APROBAT — rămâne doar rotația secretelor (netestată) |
| Performanță | 8.5/10 | JWT închide pârghia #1; profilarea la date/trafic reale rămâne netestată |
| Scalabilitate | 8.5/10 | OK pentru fază |
| Clean architecture / principii | 9.5/10 | §11c igienă închisă |
| Testare | 8.5/10 | E2E verde + teste în CI; rămâne schiță + integrare |
| Observabilitate | 8/10 | Sentry live confirmat; rămân alertele active (rate-limit/suspendare) |

---

## Securitate — 9.7/10

**De ce:** deny-by-default, IDOR enforce în services, rate-limit distribuit (Upstash), upload re-procesat
(strip EXIF, validare din magic bytes), allowlist URL/Blob (anti-SSRF), CSP + security headers, validare UUID
centralizată, audit trail fără PII, ștergere cont GDPR. Acoperit cu teste. FAZA 1+2+3 (SEC-01..14, mai puțin SEC-05
HOLD) închise.

✅ **CSP nonce** + ✅ **erori silențioase loggate** + ✅ **§11c igienă #1/#2/#3/#5** (toate 2026-06-29) — făcute, vezi CHANGELOG.
✅ **Audit formal CRITICAL 13 categorii — APROBAT, 0 CRITICAL/HIGH/MEDIUM/LOW** (2026-07-02, `docs/SECURITATE.md`
= sursa unică de adevăr pentru securitate, consolidat azi). Poarta §11 rulată pe viu cu 2 conturi
reale: gating rute, fișiere expuse, headere/TLS, IDOR distructiv pe comentariu (C.2), dezaprobare mută (D), cont
suspendat (G) — toate PASS. C.1/C.3 (ștergere cross-user) și opționalele E/F/I/J: **acceptate pe încredere,
NU se mai rulează distructiv** (decizie de produs 2026-07-02) — mecanism dovedit static + prin C.2.

**Cum ajunge la 10 (rămas):**
1. **Configurează alertele** (rate/cost) în dashboard Vercel Logs + Upstash pe evenimentele `rate_limited` /
   `access_denied_suspended` deja emise de audit.
2. Validează **rotația secretelor + backup/restore** Neon (procedură scrisă, testată o dată).
3. Teste de securitate E2E (vezi capitolul Testare).

---

## Performanță — 8/10

**De ce:** feed finit (~20, fără scroll infinit), `next/image` + Blob, poziții batch-uite (fără N+1 evident),
thumbnail randat o singură dată la publicare. ✅ **Sesiune `database`→`jwt`** (2026-07-02, vezi CHANGELOG) —
eliminat query-ul Neon la fiecare `auth()` (fiecare render + acțiune), pârghia #1 de latență identificată în
diagnosticul 2026-07-01. Regiuni aliniate pe Frankfurt (Vercel `fra1` + Neon eu-central-1, confirmat 2026-07-02).

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

## Testare — 8.5/10  *(ridicat 2026-06-29 — E2E verde + teste în CI)*

**De ce:** unit + domain + servicii (cu repo-uri mock) solide (~66 aserțiuni) **+ E2E Playwright VERDE 15/15 pe
preview** (9 public + 6 authed): landing/auth UI, deny-by-default, 404, feed authed, profil, **validarea pe roluri**
(aprob 1 click + dezaprob cu justificare → comentariu), comentariu. Authed via sesiune seedată în DB (fără bypass în
producție). E2E-ul a și prins un drift real (`users.cover_position` lipsă pe `preview/dev`). Vezi `e2e/README.md`.

**Cum ajunge la 9-10:**
1. **E2E pe schiță** draft→send→accept→teanc — rămas (flaky pe canvas, necesită helper de stroke-uri).
2. **Teste de integrare** handler→service→repo pe o bază de test — prinde ce mock-urile ascund (constrângeri DB,
   cascade, polimorfism). E2E acoperă acum parțial asta prin fluxul real pe preview.
3. ✅ **CI rulează `npm test` (vitest)** pe fiecare PR (2026-06-29) — un PR cu teste roșii nu mai trece. E2E NU rulează în CI (cere preview + bypass), se rulează manual pe preview.

---

## Observabilitate — 8/10

**De ce:** audit trail structurat (`lib/audit.ts`) + loguri Vercel native + ✅ **Sentry live confirmat pe prod**
(2026-07-02, erori server/client/edge, `tunnelRoute` anti-adblock). Ce lipsește: nimeni nu e notificat activ —
afli o problemă doar dacă te uiți în dashboard.

**Cum ajunge la 9-10:**
1. **Alerte** pe evenimentele de audit (rate-limit, access-denied) în Vercel/Upstash — cel mai ieftin pas rămas,
   singurul care contează cu adevărat înainte de useri reali (altfel un abuz/atac trece neobservat).
2. **Correlation ID** propagat prin request (acum evenimentele sunt punctuale) — util la debugging cap-coadă.

---

## Ordinea recomandată (cost/impact) — de acum înainte

1. **Alerte pe evenimentele de audit** (rate-limit, access-denied suspendat) în Vercel/Upstash — cel mai ieftin,
   singurul care schimbă ce se întâmplă dacă apare abuz în primele zile cu useri reali.
2. **Urmărește activ primele zile cu trafic real** (Sentry + Vercel Logs) — nu pilot automat; e primul semnal
   despre ce nu s-a văzut în teste (scară, comportament neanticipat de useri).
3. **Profilare feed + indexare** de îndată ce există date reale (nu de test) — atunci apare N-ul care contează.
4. Restul (E2E schiță, load-test, backup/restore Neon rehearsed, rotație secrete) — pe măsură ce crește baza
   de useri, nu blocante pentru lansare.

> ✅ **Făcute:** E2E Playwright (2026-06-29), §11c igienă cod (2026-06-29), audit CRITICAL + poarta §11 pe viu
> (2026-07-02), migrare JWT + SEC-04 (2026-07-02), Sentry live (2026-07-02).
