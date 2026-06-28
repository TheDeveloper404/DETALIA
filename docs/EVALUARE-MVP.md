# DETALIA — Evaluare MVP (prod-readiness)

> Evaluare a stării curente față de „production-ready", cu note pe capitole și **pași concreți de îmbunătățire**
> pentru fiecare. Exclude din scor: blocajele cunoscute, deciziile pe HOLD și cele intenționate (vezi `CLAUDE.md`
> „Decizii deschise" + handoff). Sursa de adevăr pentru securitate = `SECURITATE.md`; aici e doar sinteza + planul.
>
> **Data evaluării:** 2026-06-29. De re-evaluat după fiecare fază mare.

---

## Verdict

**MVP prod-ready: ~88%.** Funcționalul și securitatea de bază sunt acolo. Restul până la 100% e **călire**, nu
construcție: accesibilitate, poarta finală de securitate pe staging (§11), teste de integrare/E2E, smoke-test.
Niciun datorie tehnică structurală. Riscul de lansare nu e în cod, ci în lipsa validării end-to-end.

| Capitol | Notă | Direcția |
|---|---|---|
| Securitate | 9.5/10 | doar poarta §11 manuală |
| Performanță | 8/10 | profilare la date reale |
| Scalabilitate | 8.5/10 | OK pentru fază |
| Clean architecture / principii | 9/10 | menținere |
| Testare | 6.5/10 | **cea mai mare pârghie** |
| Observabilitate | 7/10 | alerte + (later) Sentry |
| Accesibilitate | 5/10 | **necesar înainte de public** |

---

## Securitate — 9.5/10

**De ce:** deny-by-default, IDOR enforce în services, rate-limit distribuit (Upstash), upload re-procesat
(strip EXIF, validare din magic bytes), allowlist URL/Blob (anti-SSRF), CSP + security headers, validare UUID
centralizată, audit trail fără PII, ștergere cont GDPR. Acoperit cu teste. FAZA 1+2+3 (SEC-01..14, mai puțin SEC-05
HOLD) închise.

✅ **CSP nonce** (2026-06-29) + ✅ **erori silențioase loggate** (§11c #4, 2026-06-29) — făcute, vezi CHANGELOG.

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

**Cum ajunge la 10:**
1. **§11c #1** — mută profile actions prin `profileService` (acum lovesc direct `usersRepo`).
2. **§11c #2** — decide pe `zod`: adoptă-l pentru validările din `domain` (scheme unice) sau scoate-l din deps.
3. **§11c #3** — afișează validările istorice cu `roleSnapshot` (fallback la rolul curent doar pentru cele vechi).

---

## Testare — 6.5/10  *(cea mai mare pârghie de creștere)*

**De ce:** unit + domain + servicii (cu repo-uri mock) solide (~66 aserțiuni pe căile critice). DAR zero integrare
cu DB real și zero E2E (Playwright instalat, nefolosit). Verde la unit ≠ verde end-to-end.

**Cum ajunge la 8-9:**
1. **E2E Playwright** pe fluxurile critice: signup→magic-link→onboarding→feed; creare detaliu; validare (aprob/
   dezaprob cu justificare); schiță draft→send→accept→teanc.
2. **Teste de integrare** handler→service→repo pe o bază de test (Neon branch dedicat) — prinde ce mock-urile ascund
   (constrângeri DB, cascade, polimorfism).
3. **Teste de securitate E2E**: IDOR pe fiecare action cu 3 conturi, deny-by-default pe rute, non-enumerare 401/403.
4. **CI**: rulează testele pe fiecare PR (acum CI face doar type-check + lint + build).

---

## Observabilitate — 7/10

**De ce:** audit trail structurat (`lib/audit.ts`) + loguri Vercel native. Fără error tracking de producție (decizie:
amânat) și fără dashboard de alerte încă.

**Cum ajunge la 8-9:**
1. **Alerte** pe evenimentele de audit (rate-limit, access-denied) în Vercel/Upstash.
2. **Sentry** (sau echivalent) când apar useri reali — stack traces grupate, alerte pe erori, fără reproducere manuală.
3. **Correlation ID** propagat prin request (acum evenimentele sunt punctuale) — util la debugging cap-coadă.

---

## Accesibilitate — 5/10  *(necesar înainte de acces public real)*

**De ce:** singurul capitol neatins, marcat „pe later".

**Cum ajunge la 8-9:**
1. **Contrast** AA pe text/butoane (verifică paleta caldă pe fundalurile crem).
2. **Focus vizibil** pe toate elementele interactive (keyboard nav).
3. **Target tap ≥44px** pe acțiunile mici (iconițe avatar/cover, controale schiță).
4. **Etichete text / `aria-label`** pe butoanele cu doar iconiță (parțial făcut — de completat).
5. Un **audit automat** (axe DevTools / Lighthouse a11y) pe paginile principale, apoi remediere.

---

## Ordinea recomandată (cost/impact)

1. **Accesibilitate minimă** — blochează accesul public, efort mic.
2. **E2E Playwright** pe fluxurile critice — cea mai mare pârghie de încredere.
3. **Poarta de securitate §11** pe staging — verdict APPROVED.
4. **Profilare feed + buget perf** — înainte de creștere.
5. Restul (§11c, Sentry, alerte, load-test) — pe măsură ce apar useri reali.
