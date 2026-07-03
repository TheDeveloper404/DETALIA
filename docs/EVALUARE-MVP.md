# DETALIA — Evaluare MVP (prod-readiness)

> Evaluare a stării curente față de „production-ready", cu note pe capitole și **pași concreți de îmbunătățire**
> pentru fiecare. Exclude din scor: blocajele cunoscute, deciziile pe HOLD și cele intenționate (vezi `CLAUDE.md`
> „Decizii deschise" + handoff). Sursa de adevăr pentru securitate = `SECURITATE.md`; aici e doar sinteza + planul.
>
> **Data evaluării:** 2026-07-03. De re-evaluat după fiecare fază mare. Istoricul „ce s-a făcut și când" trăiește
> în `docs/CHANGELOG.md` — aici stau doar starea curentă + golurile rămase, nu un jurnal de implementare.

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
| Securitate | 9.8/10 | audit APROBAT, alerte active — rămâne doar rotația secretelor (netestată) |
| Performanță | 9/10 | indexare corectă; rămâne doar profilarea pe trafic real (netestabilă acum) |
| Scalabilitate | 8.5/10 | OK pentru fază |
| Clean architecture / principii | 9.5/10 | §11c igienă închisă |
| Testare | 9.5/10 | E2E verde 22/22 (schiță + IDOR + integrare atomicitate/cascadă) + teste în CI |
| Observabilitate | 9/10 | Sentry live + alerte active pe rate-limit/suspendare/admin-login-failed |

---

## Securitate — 9.8/10

**De ce:** deny-by-default, IDOR enforce în services, rate-limit distribuit (Upstash) + alerte Sentry active pe
evenimentele de audit, upload re-procesat (strip EXIF, validare din magic bytes), allowlist URL/Blob (anti-SSRF),
CSP + security headers, validare UUID centralizată, audit trail fără PII, ștergere cont GDPR. Audit formal
CRITICAL (13 categorii) APROBAT, 0 CRITICAL/HIGH/MEDIUM/LOW, verificat cu atacuri reale pe prod — detalii în
`docs/SECURITATE.md` (sursa unică de adevăr pentru securitate).

**Cum ajunge la 10 (rămas):**
1. ✅ Procedura de **rotație a secretelor** e scrisă (`docs/DEPLOY.md` §2b) — rămâne doar **executată o dată**
   (manual, de Liviu) + validat **backup/restore** Neon.

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

**De ce:** unit + domain + servicii (cu repo-uri mock) solide (11 fișiere `.test.ts`) + E2E Playwright VERDE
22/22 pe preview (public + setup + authed + schiță + securitate + integrare): landing/auth UI,
deny-by-default, 404, feed authed, profil, validarea pe roluri, comentariu, schiță publish→teanc→delete,
**IDOR pe comentariu și schiță** (cross-user, service+DB real), **integrare** (atomicitatea `createDetail`,
cascada la ștergere detaliu + polimorfism validare/comentariu pe schiță). Authed via cookie de sesiune JWT —
fără bypass în producție. CI rulează `npm test` (vitest) pe fiecare PR; E2E NU rulează în CI (cere preview +
bypass), manual pe preview.

**Cum ajunge la 10:** aproape închis — restul e doar volum (mai multe fluxuri acoperite pe măsură ce apar).

---

## Observabilitate — 9/10

**De ce:** audit trail structurat (`lib/audit.ts`) + loguri Vercel native + Sentry live pe prod (erori
server/client/edge) + alerte active (Sentry Alerts pe tag `audit_event`: rate-limit, cont suspendat,
login-admin eșuat → notificare Liviu).

**Cum ajunge la 10:**
1. **Correlation ID** propagat prin request (acum evenimentele sunt punctuale) — util la debugging cap-coadă.

---

## Ordinea recomandată (cost/impact) — de acum înainte

1. **Urmărește activ primele zile cu trafic real** (Sentry + Alerts + Vercel Logs) — nu pilot automat; e primul
   semnal despre ce nu s-a văzut în teste (scară, comportament neanticipat de useri).
2. **Profilare feed + indexare** de îndată ce există date reale (nu de test) — atunci apare N-ul care contează.
3. Restul (load-test, backup/restore Neon rehearsed, rotație secrete) — pe măsură ce crește baza de useri, nu
   blocante pentru lansare.
