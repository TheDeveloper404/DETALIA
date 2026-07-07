# DEPLOY — DETALIA

> **`detalia.ro` e LIVE în producție din 2026-06-29** (domeniu, DNS, Resend, login magic-link — toate
> confirmate atunci; DNS = Cloudflare DNS-only confirmat din nou 2026-07-02, vezi `.remember/remember.md`).
> Secțiunile 3–7 de mai jos sunt runbook-ul de setup **inițial, deja executat** — rămân ca referință istorică
> / pentru o eventuală migrare de domeniu viitoare, NU ca listă de pași rămași. Evergreen: secțiunile 1, 2, 2b, 2c.

---

## 1. Servicii third-party folosite

| Serviciu | Ce face | Stare |
|---|---|---|
| **Vercel** | Hosting app (Next.js) + preview/prod | ✅ Configurat, live |
| **Neon** | Postgres (DB) + branching per preview | ✅ Configurat (integrare nativă Vercel) |
| **Vercel Blob** | Stocare imagini detalii + thumbnail-uri schiță | ✅ Configurat (`detalia-blob-public`) |
| **Resend** | Trimitere email tranzacțional (magic-link + notificări) | ✅ Verified, live din 2026-06-29 |
| **Google Workspace** | Email pe domeniu (`support@detalia.ro` etc.) | ✅ Configurat |
| **Hostico** | Registrar (de unde e cumpărat `detalia.ro`) | ✅ Deține domeniul |
| **Cloudflare** | DNS host (DNS-only în fața Vercel, fără proxy/WAF — decis 2026-07-02) | ✅ Active |
| **Cloudflare Turnstile** | Anti-bot pe login+signup (widget, verificare server-side) | ✅ Configurat 2026-07-02 |
| **Upstash Redis** | Rate-limit (login, mutații, upload) — fail-closed în prod la outage | ✅ Configurat |
| **Sentry** | Erori server/client/edge, tunnel prin `/sentry-tunnel` + Alerts pe `audit_event` | ✅ Configurat 2026-07-02/03 |

**Concepte (ca să nu se amestece):**
- **Registrar** (Hostico) = deține domeniul. Singurul lucru pe care-l mai faci în Hostico: schimbi nameserverele spre Cloudflare.
- **DNS host** (Cloudflare) = locul unde adaugi toate records-urile (A/CNAME/MX/TXT).
- **Consumatori de DNS** (Google Workspace, Resend, Vercel) = NU gestionează DNS; doar cer records care se adaugă în Cloudflare.

---

## 2. Stare actuală (deja făcut)

- App live pe Vercel (`detalia.ro`): `main` = producție, `dev`/PR = preview (push din VS Code → deploy automat).
- Neon: branching automat (prod = ramura `production`, fiecare preview = ramură efemeră). `DATABASE_URL` injectat de integrare.
- Vercel Blob: `BLOB_READ_WRITE_TOKEN` injectat automat.
- Env vars în Vercel (Production + Preview): `AUTH_SECRET`, `AUTH_URL` (= `https://detalia.ro` pe prod), `AUTH_TRUST_HOST=true`,
  `ADMIN_EMAILS`, `AUTH_RESEND_KEY`, `EMAIL_FROM`, `MAGIC_LINK_TTL_MINUTES`, `ADMIN_SESSION_TTL_HOURS`,
  `ADMIN_LOGIN_TOKEN_TTL_MINUTES` + **Upstash** (`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`,
  opțional `RATE_LIMIT_FAIL_OPEN`) + **Turnstile** (`TURNSTILE_SECRET_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`)
  + **Sentry** (`NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN`).
  *(`INVITATION_TTL_HOURS` eliminat 2026-06-28 odată cu logica de invitații — nu mai există în `.env.example`.)*

---

## 2b. Medii & baze de date — separare dev/prod (NON-NEGOCIABIL)

Regula de aur: **datele demo/de test NU ajung niciodată în producție.** Trei medii = trei ramuri Neon:

| Mediu | Ramura Neon | Cine o folosește | `DATABASE_URL` |
|---|---|---|---|
| **Local** (`npm run dev`) | `dev-local` (persistentă, No auto-delete) | laptopul tău | în `.env.local`, manual |
| **Preview** (push pe `dev`/PR) | `preview/dev` (efemeră) | Vercel preview | injectat de integrare |
| **Producție** (`main`) | `production` | Vercel prod | injectat de integrare |

Reguli:
- **`.env.local` arată DOAR spre `dev-local`**, niciodată spre `production`. (Cauza incidentului din 2026-06-27: `.env.local`
  arăta spre prod → `db:seed` local a băgat date demo în producție.)
- **`db:seed` = bootstrap minim** (admin din `ADMIN_EMAILS` + categorii), idempotent, sigur pe orice mediu inclusiv prod.
  Conținutul demo a fost ELIMINAT din `db/seed.ts` (2026-06-28, vezi CHANGELOG) — nu mai există flag `SEED_DEMO`.
- Curățare prod (dacă se murdărește): Neon → SQL Editor → ramura `production` → `DELETE FROM ...` (păstrând `categories`).

### Cheatsheet SQL — curățare producție

**Curățare totală** (păstrează `categories` și `platform_settings`):
```sql
TRUNCATE TABLE
  users, sessions, accounts, verification_tokens, roles,
  details, detail_categories, detail_resources, sketches,
  validations, comments, saved_details, notifications,
  admin_login_tokens, admin_sessions
RESTART IDENTITY CASCADE;
```

**Verificare după curățare** (toate trebuie să dea 0, în afară de `categories` și `platform_settings`):
```sql
SELECT 'users' AS tabel, count(*) FROM users
UNION ALL SELECT 'sessions', count(*) FROM sessions
UNION ALL SELECT 'accounts', count(*) FROM accounts
UNION ALL SELECT 'verification_tokens', count(*) FROM verification_tokens
UNION ALL SELECT 'roles', count(*) FROM roles
UNION ALL SELECT 'details', count(*) FROM details
UNION ALL SELECT 'detail_categories', count(*) FROM detail_categories
UNION ALL SELECT 'detail_resources', count(*) FROM detail_resources
UNION ALL SELECT 'sketches', count(*) FROM sketches
UNION ALL SELECT 'validations', count(*) FROM validations
UNION ALL SELECT 'comments', count(*) FROM comments
UNION ALL SELECT 'saved_details', count(*) FROM saved_details
UNION ALL SELECT 'notifications', count(*) FROM notifications
UNION ALL SELECT 'admin_login_tokens', count(*) FROM admin_login_tokens
UNION ALL SELECT 'admin_sessions', count(*) FROM admin_sessions
UNION ALL SELECT 'categories (trebuie nezero)', count(*) FROM categories
UNION ALL SELECT 'platform_settings (config, nu-l atinge)', count(*) FROM platform_settings;
```

**Curățare selectivă — un singur user** (șterge tot conținutul lui, păstrează restul platformei).
`users` are `ON DELETE CASCADE` spre `sessions`/`accounts`/`roles`, dar NU spre `details`/`sketches`
(FK fără cascadă) → trebuie ștearse manual întâi, altfel `DELETE FROM users` pică pe constrângere FK:
```sql
-- înlocuiește '<EMAIL>' cu emailul userului de curățat
WITH target AS (SELECT id FROM users WHERE email = '<EMAIL>')
DELETE FROM validations WHERE user_id IN (SELECT id FROM target);
WITH target AS (SELECT id FROM users WHERE email = '<EMAIL>')
DELETE FROM comments WHERE author_id IN (SELECT id FROM target);
WITH target AS (SELECT id FROM users WHERE email = '<EMAIL>')
DELETE FROM sketches WHERE author_id IN (SELECT id FROM target);
WITH target AS (SELECT id FROM users WHERE email = '<EMAIL>')
DELETE FROM details WHERE author_id IN (SELECT id FROM target);
DELETE FROM users WHERE email = '<EMAIL>'; -- cascadă: sessions, accounts, roles, saved_details, notifications
```

**Curățare selectivă — un singur tabel** (ex. doar notificările vechi, fără să atingi restul):
```sql
TRUNCATE TABLE notifications RESTART IDENTITY;
-- sau condiționat: DELETE FROM notifications WHERE created_at < now() - interval '30 days';
```

> **Retenția notificărilor citite (15 zile) e AUTOMATĂ** din 2026-07-03 — Vercel Cron zilnic
> (`app/api/cron/cleanup-notifications`, `vercel.json`), nu mai trebuie făcută manual. SQL-ul de mai sus
> rămâne util doar pentru curățare ad-hoc/imediată.

### Rotația secretelor (procedură — de executat manual, când decizi)

Niciun secret nu se rotește automat. Pentru fiecare, pasul e „generează valoare nouă → pune-o în Vercel →
redeploy → verifică → (dacă aplicabil) revocă valoarea veche la sursă":

| Secret | Unde-l schimbi | Efect la rotație |
|---|---|---|
| `AUTH_SECRET` | Vercel → Env Vars (Production) | **Delogează TOȚI userii** (cookie-urile JWT vechi devin invalide) — re-login cu magic link. Fă-o într-o fereastră cu trafic mic. |
| `DATABASE_URL` (parola Neon) | Neon → proiect → Reset password → copiezi noul connection string în Vercel | Fără impact pe useri (transparent) — doar redeploy ca noua valoare să fie citită. |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash → Database → regenerează tokenul → Vercel | Fără impact pe useri; rate-limit-ul continuă normal după redeploy. |
| `AUTH_RESEND_KEY` | Resend → API Keys → creezi una nouă, ștergi cea veche → Vercel | Fără impact — magic link-urile în curs de livrare la momentul schimbării pot eșua (rar, tranzitoriu). |
| `TURNSTILE_SECRET_KEY` | Cloudflare → Turnstile → widget → regenerează secretul → Vercel | Fără impact pe useri — verificarea anti-bot continuă după redeploy. |
| `SENTRY_AUTH_TOKEN` | Sentry → Settings → Auth Tokens → regenerezi → Vercel | Afectează doar upload-ul de source maps la build, nu runtime-ul. |
| `CRON_SECRET` | Generezi tu (ex. `openssl rand -base64 32`) → Vercel | Fără impact pe useri — doar cron-ul de retenție trebuie să folosească noua valoare (automat, citește din env). |

**Regulă:** schimbi UN secret o dată, redeploy, verifici (login funcțional, feed se încarcă, o mutație merge),
abia apoi treci la următorul. Nu le rotești pe toate simultan — dacă ceva se strică, vrei să știi exact care.

---

### Backup & Restore Neon (procedură TESTATĂ 2026-07-04, funcțională)

Neon ține istoric automat (fereastra vizibilă în Neon → branch `production` → **Backup & Restore**, azi:
6 ore pe planul curent — crește cu planul plătit). Restore-ul NU se face direct pe `production` din
panoul principal („Restore" de acolo suprascrie branch-ul LIVE cu date vechi — distructiv, doar pentru
un incident real, nu pentru testare).

**Procedura de restore SIGURĂ (branch nou, `production` neatins):**
1. Neon → **Branches** → **Create branch**.
2. `Parent branch` = `production`.
3. `Branch data and schema from a past point in time` → alegi data/ora dorită.
4. `Auto-delete`: pune un TTL scurt (6h/24h) dacă e doar de verificare, nu „Never".
5. **Create** → branch-ul nou apare instant, cu datele de la acel moment. Copiezi connection string-ul lui
   (Neon → branch nou → Connection Details) — e o bază Postgres separată, complet izolată de `production`.
6. Verificare de integritate (rulează cheatsheet-ul SQL de mai sus — counts pe tabele — pe connection
   string-ul branch-ului nou, NU pe `production`): confirmă că numărul de rânduri + relațiile (FK-uri,
   status-uri) sunt coerente.
7. Șterge branch-ul de test după verificare (Neon → Branches → branch → Delete) dacă nu are TTL.

**În caz de incident REAL** (date corupte/șterse din greșeală pe `production`): pasul 1-6 identic, dar
branch-ul nou devine sursa de recuperare — fie promovezi acel branch la `production` (Neon → branch →
„Set as production" / redenumire, verifică opțiunea curentă în UI), fie exporți datele necesare din el
și le re-inserezi manual pe `production`. Alege în funcție de cât de mare e diferența față de starea
curentă (un „set as production" pierde și orice scriere legitimă întâmplată după momentul restaurat).

**Rezultatul testului din 2026-07-04:** branch creat din `production` la un timestamp cu ~3.5h în urmă →
counts + rânduri (users, details, sketches cu FK-uri valide) confirmate corecte. Procedura funcționează.

### Backup automat orar (GitHub Actions, independent de Neon)

`.github/workflows/db-backup.yml` — rulează orar (`cron: "0 * * * *"`), `pg_dump` pe `production`
(`PROD_DATABASE_URL_BACKUP`, binarul v18 explicit — Ubuntu runner are implicit v16 în PATH, mismatch cu
serverul), format custom, urcat ca artifact GitHub Actions (retenție 30 zile). Complementar ferestrei native
Neon (§ de mai sus, 6h) — acoperă orizontul de o lună fără să depindă de planul Neon.

## 2c. Reguli de release (flux dev → PR → main, fără local)

Lucrăm **direct pe preview Vercel**, nu local. Testarea oricărei schimbări se face pe URL-ul de preview al PR-ului.
Trei lucruri pot trimite cod prost în prod — astea le închidem:

1. **CI blocant pe `main`** — ✅ activ (branch protection): merge în `main` permis DOAR cu CI `build` verde
   (type-check + lint + build) și branch la zi. Force-push/ștergere `main` interzise. *CI verde = „compilează", NU „funcționează".*
2. **Schema drift preview↔prod** — preview și prod sunt **baze Neon diferite**. Orice schimbare de schemă
   (coloană/enum/tabel) trebuie aplicată pe **AMBELE** ramuri (vezi 2b). Aplicată doar pe una → merge pe un mediu,
   crapă pe celălalt. Aplici pe `preview/dev` când testezi PR-ul, pe `production` înainte/la merge-ul în `main`.
3. **Probează preview-ul înainte de merge** — deschizi URL-ul de preview al PR-ului și **apeși efectiv pe ce ai schimbat**.
   Nu da merge bazându-te doar pe CI verde.
4. **Rollback — dacă `main` se strică după merge**, în ordinea asta:
   1. **Vercel → Deployments → ultimul deployment BUN de pe `main` → „Promote to Production"** (instant, câteva
      secunde, fără nevoie de commit/PR nou). E prima acțiune, ÎNAINTE de orice investigație — oprești sângerarea,
      apoi diagnostichezi calm.
   2. Dacă problema vine dintr-o **migrație de schemă** aplicată deja pe `production` (Neon) — schema NU se
      rollback-uiește automat odată cu codul. Verifici manual dacă vechiul cod (promovat înapoi) mai e compatibil
      cu schema nouă; dacă nu, scrii SQL de revenire (regula obișnuită: SQL brut, rulat manual, verificat înainte).
   3. Repari cauza pe `dev`, testezi pe preview, abia apoi refaci PR-ul `dev → main` normal.
   4. Scrii un rând scurt în `docs/INCIDENTS.md` (ce, de ce, ce s-a schimbat) — vezi mai jos.

---

## 3-6. Setup inițial (ISTORIC — deja executat, rămas ca referință)

> Pașii 3-7 de mai jos au fost rulați o singură dată la lansare (2026-06-29) și confirmați din nou 2026-07-02.
> Nu mai sunt „de făcut" — le păstrăm doar ca runbook pentru o eventuală schimbare de domeniu/DNS viitoare.

## 3. Mută DNS-ul pe Cloudflare (o singură dată)

1. **Cloudflare → Add a site** → `detalia.ro` → planul **Free**.
2. Cloudflare scanează și **importă** records-urile existente. Verifică lista să fie completă.
3. Cloudflare generează **2 nameservere** `← din dashboard` (gen `xxx.ns.cloudflare.com`).
4. **Hostico → domeniul `detalia.ro` → Nameservers** → înlocuiește-le cu cele 2 de la Cloudflare.
5. Așteaptă propagarea (minute → max ~24h). Cloudflare arată **„Active"** când e gata.
6. De acum, **toate records-urile se adaugă în Cloudflare**.

> ⚠️ **Proxy (norul portocaliu):** records-urile de email (MX) și cele de verificare (TXT: SPF/DKIM/DMARC)
> se lasă **DNS only (nor gri)**. Proxy-ul peste ele rupe mailul/verificarea.

---

## 4. Google Workspace — mailbox pe domeniu (`support@detalia.ro`)

Scop: ca adresa `support@detalia.ro` (deja folosită în `/profile/edit`) să **primească** mail.

1. În **Google Workspace Admin** → pornește verificarea domeniului `detalia.ro`.
2. Adaugă în Cloudflare (toate **DNS only**):
   - **TXT** de verificare domeniu `← din dashboard`.
   - **MX** records Google `← din dashboard` (de obicei `smtp.google.com`, prioritate 1).
   - **DKIM** (TXT) generat de Google `← din dashboard`.
   - **DMARC** (TXT) — opțional dar recomandat: `_dmarc` → `v=DMARC1; p=none; rua=mailto:support@detalia.ro`.
3. Creează căsuța `support@detalia.ro` în Workspace.

---

## 5. Resend — deblochează login-ul magic-link

Scop: app-ul să poată **trimite** email (magic-link + notificări) către orice adresă.

> **Recomandare:** folosește un **subdomeniu** dedicat: `send.detalia.ro`. Astfel Resend își are SPF/DKIM-ul
> lui, separat de root-ul cu Google → eviți conflictul de SPF (vezi nota de jos).

1. **Resend → Domains → Add** → `send.detalia.ro`.
2. Adaugă în Cloudflare records-urile date de Resend (toate **DNS only**) `← din dashboard`:
   - **MX** (pentru `send.detalia.ro`, bounce handling).
   - **TXT SPF** pentru `send.detalia.ro`.
   - **TXT/CNAME DKIM** pentru `send.detalia.ro`.
3. Așteaptă „Verified" în Resend.
4. **Resend → API Keys → Create** → copiază cheia.
5. **Vercel → Environment Variables** (Production + Preview):
   - `AUTH_RESEND_KEY` = cheia reală.
   - `EMAIL_FROM` = `DETALIA <no-reply@send.detalia.ro>`.
6. **Redeploy** (env vars noi NU se aplică retroactiv).
7. Testează magic-link login cu emailul tău.

> ⚠️ **Regula SPF:** un domeniu are voie **un singur** record TXT SPF. Dacă pui Resend pe `send.detalia.ro`
> (subdomeniu), SPF-ul Google (pe root) și SPF-ul Resend (pe subdomeniu) sunt **separate** → fără conflict.
> Dacă ai pune Resend tot pe root, ar trebui să combini Google + Resend într-un singur SPF.

---

## 6. (Opțional) Leagă `detalia.ro` de Vercel

Ca site-ul să fie pe `detalia.ro` în loc de `.vercel.app`.

1. **Vercel → proiect → Settings → Domains → Add** → `detalia.ro` (+ `www` dacă vrei).
2. Adaugă în Cloudflare records-urile cerute de Vercel `← din dashboard` (A/CNAME).
   - Pentru Vercel, lasă-le **DNS only (nor gri)** — proxy-ul portocaliu peste Vercel poate strica SSL-ul.
3. După ce domeniul e „Valid" în Vercel:
   - **Vercel → Env Vars → `AUTH_URL`** (Production) = `https://detalia.ro`.
   - Dacă ai pus Resend pe root înainte, reverifică SPF-ul.
   - **Redeploy.**

---

## 7. Verificare finală

- [x] Cloudflare „Active" pentru `detalia.ro`.
- [x] `support@detalia.ro` primește un email de test.
- [x] Resend domain „Verified".
- [x] Login magic-link merge end-to-end pe prod (email → link → feed).
- [x] Site-ul se deschide pe `https://detalia.ro` cu SSL valid.

---

## Note

- **Env vars se aplică doar după redeploy** (push pe `main` pentru prod, sau „Redeploy" din dashboard).
- **Preview vs Prod `AUTH_URL`:** prod = domeniul real; preview = URL-ul stabil al branch-ului `dev`
  (`detalia-git-dev-<scope>.vercel.app`) ca magic-link-ul + link-urile din emailuri să cadă corect pe `dev`.
- Detaliile de arhitectură stau în `ARHITECTURA.md`; istoricul în `CHANGELOG.md`.
