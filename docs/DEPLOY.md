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
  `ADMIN_EMAILS`, `AUTH_RESEND_KEY`, `EMAIL_FROM`, `MAGIC_LINK_TTL_MINUTES`. *(`INVITATION_TTL_HOURS` eliminat
  2026-06-28 odată cu logica de invitații — nu mai există în `.env.example`.)*

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

---

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
