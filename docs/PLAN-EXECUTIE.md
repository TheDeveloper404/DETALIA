# DETALIA — Plan de execuție MVP (faze, servicii terțe, pași)

> Planul operațional „cum ajungem de la zero la MVP lansat". Completează roadmap-ul de nivel înalt din
> `ARHITECTURA.md §12` cu **pași concreți, dependențe, conturi terțe și criterii de „gata" per fază**.
> Fază proiect: validare de piață, buget ~$0. Lucru pe `dev` → PR → `main`.

---

## 0. Servicii terțe — de ce, cine, cost

Toate au free tier real. Coloana „Cine setează" = unde e nevoie de Liviu/Edi vs. ce poate face Claude.

| Serviciu | Pentru ce | Cont / setup | Cine setează | Cost MVP |
|---|---|---|---|---|
| **GitHub** | repo, PR, colaborare | repo privat ✅ (există); Edi = Collaborator | Liviu (invită Edi) | $0 |
| **Vercel** | hosting, deploy, env, preview | proiect linkat la repo | Liviu (login + link) | $0 Hobby → ~$20 Pro la comercial |
| **Neon Postgres** | baza de date | via Vercel Marketplace → `DATABASE_URL` | Liviu (provisionează) | $0 free tier |
| **Resend** | email (magic link + notificări) | cont + verificare domeniu (SPF/DKIM) → `RESEND_API_KEY` | Liviu (+ acces DNS domeniu) | $0 (3k/lună) |
| **Vercel Blob** | imagini detalii + thumbnail schiță | token din proiectul Vercel → `BLOB_READ_WRITE_TOKEN` | Liviu | $0 free tier |
| **Domeniu** | brand + email expeditor | deja deținut | Edi/Liviu (DNS) | $0 (plătit) |
| **Auth.js** | auth (self-hosted) | doar `AUTH_SECRET` generat | Claude (cod) | $0 |

> **Singurele lucruri pe care le poate face DOAR Liviu/Edi:** login-uri/conturi (Vercel, Neon, Resend),
> accesul DNS al domeniului (verificare Resend), invitarea lui Edi pe GitHub. Restul (cod, schema, handlers,
> teste) le face Claude. Credențialele intră în `vercel env` / `.env.local`, niciodată în cod.

---

## Faza 0 — Schelet & acces (fundația)

**Obiectiv:** aplicație care pornește, cu DB, auth funcțional și model de roluri. Încă fără feature-uri de produs.

**Prerechizite (Liviu/Edi):** proiect Vercel linkat · Neon provisionat (`DATABASE_URL`) · Resend cu domeniu
verificat (`RESEND_API_KEY`, `EMAIL_FROM`) · `BLOB_READ_WRITE_TOKEN`.

**Pași (Claude, pe `dev`):**
1. Scaffold Next.js (App Router, TS) + structura de foldere (`app/`, `server/`, `db/`, `components/`, `lib/`).
2. Drizzle + conexiune Neon; schema din `SCHEMA.md` → migrații. `db:push` / `db:migrate`.
3. Auth.js v5 (Email provider = magic link) + adapter Drizzle; middleware deny-by-default pe `(app)`.
4. Flux onboarding: declară rol (principal + subrol) → acces imediat.
5. Poartă acces (invitație) — **schelet izolat** (rămâne ÎN HOLD; ușor de activat/dezactivat).
6. Cont admin seed + rol de admin.
7. Hook-uri în repo (`block-pii-log`, `lint-web`, `block-push-main`) la `git init` deja făcut.

**Definiție de „gata":** un user invitat se loghează prin magic link, declară rol, ajunge în zona protejată;
neautentificat → respins. Build verde (`next build` / `tsc --noEmit`). Migrațiile aplică curat.

**Input de la Edi pentru faza asta:** lista de subroluri per rol · zone climatice/seismice (listă fixă) ·
taxonomia de categorii (pentru seed-ul din Faza 1).

---

## Faza 1 — Inima: detaliu + feed + validare (ETAPA A)

**Obiectiv:** răspundem la întrebarea de validare — *se aprinde dezbaterea pe roluri?*

**Pași:**
1. Model `Detail` + `DetailResource` (max 3) + upload imagine (Blob) — **doar admin/seed**.
2. Categorii (arbore) + filtre; feed finit **~20** după interacțiuni (fără infinite scroll).
3. Pagina de detaliu: imagine + nume+rol autor + panou validare + coloană comentarii.
4. **Validare** (inima): Aprob = 1 click; Dezaprob = justificare obligatorie (server 422) → `Comment` auto
   cu `originValidationId`; o poziție/user reversibilă (constrângere unică).
5. Comentarii (polimorfic, deocamdată pe Detail).
6. Seed-ul de conținut (vezi `PLAN-SEED.md`) — 10–15 detalii „polarizante pe rol".

**Definiție de „gata":** un specialist deschide un detaliu, ia poziție (aprob/dezaprob cu argument), vede
poziția altuia cu rolul afișat. Reguli enforce-uite pe server (teste din `PLAN-TESTE.md`).

**Input de la Edi:** conținutul seed (detalii + autori) · confirmarea pragurilor de validare.

---

## Faza 1.5 — Schițarea colaborativă (OBLIGATORIE în MVP)

**Obiectiv:** fără ea „e doar blog cu comentarii". Modelul fork→PR, asincron.

**Pași:**
1. Mod schiță: canvas (HTML5 + `perfect-freehand`) peste detaliul-mamă cu **fill slab**.
2. Unelte: culori stridente + 3 grosimi + radieră + undo/redo. Auto-save `strokes_json` (normalizat 0..1).
3. State machine `SketchService`: DRAFT → (send) PENDING_ACCEPTANCE → (accept autor-mamă) PUBLISHED | REJECTED.
4. La accept: randare thumbnail PNG (Blob). Teanc = taburi cu schițele PUBLISHED + hover-slideshow.
5. Validare/comentariu **și pe Sketch** (polimorfismul plătește acum — dezbatere per foaie gratis).
6. **Notificări in-app + email** (Resend) la propunere/acceptare/respingere (copy în `EMAILURI.md`).

**Definiție de „gata":** un user desenează o variantă, o trimite, autorul-mamă primește notificare (in-app +
email), o acceptă, schița intră în teanc cu thumbnail și poate fi dezbătută separat. E2E-3 din `PLAN-TESTE.md` trece.

---

## Faza 2 — Verificare rol + lustruire pentru lansare

**Obiectiv:** poarta 2 (credibilitate) + pregătire de beta.

**Pași:**
1. Flux „Verificare rol" („pull, nu push"): user trimite dovezi → PENDING → admin aprobă → **badge ⭐**.
   Nudge blând permanent, fără blocare.
2. Profil cu nume + rol + badge.
3. Stări empty/loading/error peste tot (`UX-ECRANE.md`); accesibilitate minimă.
4. Securitate CRITICAL: audit authz (IDOR, escalare), rate-limit pe endpoint-urile sensibile.
5. Decizie finală **Poarta 1** (invitație vs. public) — reconfirmată cu Edi → activare/dezactivare gating.

**Definiție de „gata":** beta închis lansabil — acces controlat, roluri afișate/verificabile, fluxurile critice
testate (unit+integration+security+E2E), build verde, deploy reproducibil pe Vercel.

---

## Backlog (post-MVP, NU acum)

Search liber semantic (pgvector) · upload de detalii pentru useri (Val 2) · verificare automată rol (OAR/CUI) ·
scoring/reputație · unelte de schiță avansate (Line/Circle/Arrow/text) · co-desenare real-time.

---

## Dependențe & ordine (pe scurt)

```
Conturi terțe (Liviu/Edi) ──► Faza 0 (schelet+auth) ──► Faza 1 (inima) ──► Faza 1.5 (schiță) ──► Faza 2 (verificare+lansare)
        │                          │                        │
   inputuri Edi:              subroluri/zone/          seed content +
   GitHub user,               categorii                praguri validare
   DNS pt Resend
```

**Calea critică = conturile terțe + inputurile lui Edi.** Codul nu e blocajul; așteptările sunt: DNS pentru
Resend (ca emailurile să nu cadă în spam) și conținutul seed (fără el, Faza 1 nu testează nimic real).

---

## Ce blochează ce (de urmărit)

| Blocaj | Blochează | Deblocat de |
|---|---|---|
| `DATABASE_URL` (Neon) | tot (fără DB nu pornim) | Liviu provisionează |
| Domeniu verificat în Resend | magic link (login!) → practic tot | Liviu, acces DNS |
| Subroluri + categorii (Edi) | onboarding rol + filtre + seed | Edi |
| Conținut seed (Edi) | validarea premisei (Faza 1) | Edi + noi |
| Decizie Poarta 1 (Edi) | finalizarea gating-ului de acces | Edi |
