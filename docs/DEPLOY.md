# DEPLOY — DETALIA

> Ghid operațional: cum e deployat proiectul și ce pași mai rămân până la „domeniu real + login real".
> Ordinea contează — fiecare pas depinde de cel dinainte. Valorile concrete (nameservere, chei DKIM etc.)
> se generează în dashboard-urile respective; aici sunt marcate cu `← din dashboard`.

---

## 1. Servicii third-party folosite

| Serviciu | Ce face | Stare |
|---|---|---|
| **Vercel** | Hosting app (Next.js) + preview/prod | ✅ Configurat |
| **Neon** | Postgres (DB) + branching per preview | ✅ Configurat (integrare nativă Vercel) |
| **Vercel Blob** | Stocare imagini detalii + thumbnail-uri schiță | ✅ Configurat (`detalia-blob-public`) |
| **Resend** | Trimitere email tranzacțional (magic-link + notificări) | ⏸️ Nesetat — depinde de DNS |
| **Google Workspace** | Email pe domeniu (`support@detalia.ro` etc.) | ⏸️ De configurat — depinde de DNS |
| **Hostico** | Registrar (de unde e cumpărat `detalia.ro`) | ✅ Deține domeniul |
| **Cloudflare** | DNS host + CDN/reguli (panoul ales pentru DNS) | ⏸️ De pornit |

**Concepte (ca să nu se amestece):**
- **Registrar** (Hostico) = deține domeniul. Singurul lucru pe care-l mai faci în Hostico: schimbi nameserverele spre Cloudflare.
- **DNS host** (Cloudflare) = locul unde adaugi toate records-urile (A/CNAME/MX/TXT).
- **Consumatori de DNS** (Google Workspace, Resend, Vercel) = NU gestionează DNS; doar îți cer records pe care le pui în Cloudflare.

---

## 2. Stare actuală (deja făcut)

- App live pe Vercel: `main` = producție, `dev`/PR = preview (push din VS Code → deploy automat).
- Neon: branching automat (prod = ramura `production`, fiecare preview = ramură efemeră). `DATABASE_URL` injectat de integrare.
- Vercel Blob: `BLOB_READ_WRITE_TOKEN` injectat automat.
- Env vars în Vercel (Production + Preview): `AUTH_SECRET`, `AUTH_URL` (= URL `.vercel.app`), `AUTH_TRUST_HOST=true`,
  `ADMIN_EMAILS`, `AUTH_RESEND_KEY`, `EMAIL_FROM`, `MAGIC_LINK_TTL_MINUTES`, `INVITATION_TTL_HOURS`.

**Blocaj curent:** login real (magic-link) nu merge până nu e domeniul verificat în Resend → de aceea pașii de mai jos.

---

## 3. Mută DNS-ul pe Cloudflare (o singură dată)

1. **Cloudflare → Add a site** → `detalia.ro` → planul **Free**.
2. Cloudflare scanează și **importă** records-urile existente. Verifică lista să fie completă.
3. Cloudflare îți dă **2 nameservere** `← din dashboard` (gen `xxx.ns.cloudflare.com`).
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

- [ ] Cloudflare „Active" pentru `detalia.ro`.
- [ ] `support@detalia.ro` primește un email de test.
- [ ] Resend domain „Verified".
- [ ] Login magic-link merge end-to-end pe prod (email → link → feed).
- [ ] (dacă pasul 6) site-ul se deschide pe `https://detalia.ro` cu SSL valid.

---

## Note

- **Env vars se aplică doar după redeploy** (push pe `main` pentru prod, sau „Redeploy" din dashboard).
- **Preview vs Prod `AUTH_URL`:** prod = domeniul real; preview = URL-ul stabil al branch-ului `dev`
  (`detalia-git-dev-<scope>.vercel.app`) ca magic-link-ul + link-urile din emailuri să cadă corect pe `dev`.
- Detaliile de arhitectură stau în `ARHITECTURA.md`; istoricul în `CHANGELOG.md`.
