# DETALIA — Securitate (document viu, listă de bifat)

> **Scopul acestui document:** să NU ne trezim cu rute neacoperite sau API neprotejat. Auth, roluri și validarea
> sunt **CRITICAL** (regula globală). Aici nu vorbim principii — ținem o **evidență per-endpoint** care trebuie
> să fie verde înainte ca un endpoint să fie „done".
>
> **Regula de aur:** un endpoint nou intră aici ca **🔲 și nu e livrat până nu e ✅ pe toate coloanele.**
> Dacă o rută nu e în tabelul de mai jos → e neacoperită prin definiție. Tabelul e sursa de adevăr pentru „ce e protejat".
>
> Sursa standardelor: `D:\Claude_Development_Rules\Audit_checklist.md` + skill-ul `security-audit` (13 categorii).
> Acest doc le **mapează pe DETALIA**, nu le înlocuiește.

---

## 0. ⚠️ Capcane de securitate — tratate proactiv de la început

> Cele mai frecvente moduri în care „scapă" securitatea. Le tratăm din start, nu după incident.
> Fiecare are un **antidot** deja parte din arhitectură/proces.

- **Authz „uitată" pe un endpoint** — ruta există, dar nimeni nu verifică rolul/ownership → oricine o cheamă.
  Antidot: **deny-by-default** + matricea de mai jos (fără rând verde = fără merge).
- **IDOR** — `/resource/:id` care nu verifică dacă resursa **e a userului curent** → editezi/ștergi ce nu e al tău.
  Antidot: ownership check în service, testat explicit.
- **Validarea doar pe frontend** — regula de business „arătată" în UI dar neaplicată pe server.
  Antidot: enforce în `server/services`; frontend-ul nu e sursă de adevăr.
- **Leak prin erori** — stack-trace / SQL / căi în răspuns. Antidot: format unic de eroare, fără internals.
- **Secrete în cod / PII în loguri.** Antidot: hooks (`block-secrets`, `block-pii-log`) + env.
- **Endpoint-uri „interne" neautentificate** (webhooks, admin, cron) presupuse private dar publice de fapt.
  Antidot: orice rută `/api/admin/*` verifică rolul în service, nu doar prin obscuritate.
- **Enumerare** (emailuri/conturi/resurse) prin diferențe de răspuns. Antidot: 401/403 consistent, niciodată 404 revelator.

---

## 1. Model de zone (deny-by-default)

```
PUBLIC                 /, /login, /invite/[token], /api/auth/*     → fără sesiune, dar rate-limited
AUTENTIFICAT           tot restul (rute + /api/* non-admin)        → proxy.ts cere sesiune; altfel redirect /login
ADMIN                  /admin/*, /api/admin/*                      → sesiune + admin (ADMIN_EMAILS) verificat pe server; altfel 403
```

- **`proxy.ts`** (Next 16 — fostul `middleware.ts`) e **deny-by-default**: tot ce nu e în allowlist-ul public
  (`/`, `/login`, `/api/auth/*`, assets) cere sesiune; neautentificat → redirect `/login?callbackUrl=...`.
- Rolul și ownership-ul se verifică **în service, pe server** — proxy-ul e doar prima poartă, nu singura.
- **Admin** = user al cărui email e în `ADMIN_EMAILS` (env, deny-by-default); guard `requireAdmin()` în `lib/admin.ts`.
- **Authz corect:** lipsă auth → **401** (API) / redirect (pagini), rol greșit → **403**. **Niciodată 404** ca să ascunzi existența.

---

## 2. Matricea de protecție per endpoint (INIMA)

Legendă: `Auth` = cere sesiune · `Rol` = rol necesar · `Input` = validare schemă (zod) pe server ·
`RL` = rate-limit · `Business` = reguli enforce-uite pe server · `Ownership/IDOR` = ce verificare de proprietate ·
`Test` = test de authz cerut · `Status` 🔲 de făcut / ✅ acoperit.

| Endpoint | Auth | Rol | Input | RL | Business (server) | Ownership / IDOR | Test authz | Status |
|---|---|---|---|---|---|---|---|---|
| `* /api/auth/*` (Auth.js) | — | — | framework | ✅ | magic link one-time, expirare | n/a | token expirat/folosit | 🔲 |
| signup (flux, cu invitație) | — | — | ✅ | ✅ | invitație validă/neexpirată/one-time | n/a | token invalid → respins | 🔲 |
| `POST /api/admin/invitations` | ✅ | **admin** | ✅ | ✅ | token în email, nu în răspuns | n/a | user normal → 403 | 🔲 |
| `GET /api/admin/invitations` | ✅ | **admin** | — | — | fără tokenuri în clar | n/a | user normal → 403 | 🔲 |
| `GET /api/categories` | ✅ | orice | — | — | — | n/a | neautentificat → 401 | 🔲 |
| `GET /api/details` | ✅ | orice | ✅ (query) | — | feed ~20, fără infinite scroll | n/a | neautentificat → 401 | 🔲 |
| `GET /api/details/:id` | ✅ | orice | ✅ (id) | — | — | n/a (citire publică în beta) | neautentificat → 401 | 🔲 |
| `POST /api/admin/details` | ✅ | **admin/seed** | ✅ | — | upload seed-only; max 3 resurse | n/a | user normal → 403 | 🔲 |
| `POST /api/validations` | ✅ | orice | ✅ | ✅ | **DISAPPROVE fără justificare → 422**; o poziție/user (constrângere unică) | poziția se leagă de `userId` curent | IDOR (nu poți poza ca altul) | 🔲 |
| `DELETE /api/validations/:id` | ✅ | orice | ✅ (id) | — | retragere poziție | **doar proprietarul** (userId == owner) | IDOR: A nu șterge poziția lui B | 🔲 |
| `GET /api/comments` | ✅ | orice | ✅ (query) | — | — | n/a | neautentificat → 401 | 🔲 |
| `POST /api/comments` | ✅ | orice | ✅ | ✅ | target există (DETAIL/SKETCH) | autor = userul curent | IDOR pe target inexistent | 🔲 |
| `GET /api/details/:id/sketches` | ✅ | orice | ✅ (id) | — | doar PUBLISHED în teanc | n/a | neautentificat → 401 | 🔲 |
| `POST /api/details/:id/sketches` | ✅ | orice | ✅ | ✅ | creează DRAFT | autor = userul curent | — | 🔲 |
| `PATCH /api/sketches/:id` | ✅ | orice | ✅ (strokes) | — | doar în DRAFT | **doar autorul schiței** | IDOR: A nu editează schița lui B | 🔲 |
| `POST /api/sketches/:id/send` | ✅ | orice | ✅ (id) | ✅ | DRAFT→PENDING; notificare la autor-mamă | **doar autorul schiței** | IDOR + tranziție invalidă → 409 | 🔲 |
| `POST /api/sketches/:id/accept` | ✅ | orice | ✅ (id) | — | PENDING→PUBLISHED; randează thumbnail | **doar autorul detaliului-mamă** | escaladare: alt user → 403 | 🔲 |
| `POST /api/sketches/:id/reject` | ✅ | orice | ✅ (id) | — | PENDING→REJECTED | **doar autorul detaliului-mamă** | escaladare: alt user → 403 | 🔲 |
| `GET /api/notifications` | ✅ | orice | — | — | doar ale destinatarului | **scope la recipientUserId** | IDOR: nu vezi notificările altuia | 🔲 |
| `PATCH /api/notifications/:id/read` | ✅ | orice | ✅ (id) | — | marcare citit | **doar destinatarul** | IDOR | 🔲 |
| `POST /api/verification` | ✅ | orice | ✅ (dovezi) | ✅ | DECLARED→PENDING | rolul userului curent | IDOR + **dovezi (OAR/CUI) neloggate** | 🔲 |
| `GET /api/admin/verification` | ✅ | **admin** | — | — | listă PENDING | n/a | user normal → 403 | 🔲 |
| `POST /api/admin/verification/:id/approve` | ✅ | **admin** | ✅ (id) | — | PENDING→VERIFIED (badge) | n/a | escaladare: user normal → 403 | 🔲 |
| `POST /api/admin/verification/:id/reject` | ✅ | **admin** | ✅ | — | PENDING→REJECTED | n/a | escaladare → 403 | 🔲 |

> Pe măsură ce implementăm, fiecare rând trece la ✅ doar când **toate coloanele relevante** sunt acoperite ȘI testate.
> Endpoint nou = rând nou 🔲. Fără rând → neacoperit.

---

## 3. Cele 13 categorii (Audit_checklist) — mapate pe DETALIA

| # | Categorie | Cum o acoperim aici |
|---|---|---|
| 1 | **Autentificare** | Auth.js magic link, token scurt one-time; fără parole de scurs |
| 2 | **Autorizare / access control** | deny-by-default + matricea §2; rol & ownership pe server; 401/403 nu 404 |
| 3 | **Validare input / injection** | zod pe server la fiecare endpoint; Drizzle parametrizat (fără SQL crud) |
| 4 | **Date sensibile (PII)** | OAR/CUI/email/tokenuri neloggate; minimizare; (vezi `CONFIDENTIALITATE-GDPR.md`) |
| 5 | **Secrete / config** | env + `vercel env`; hook `block-secrets`; niciun secret în cod |
| 6 | **Sesiuni** | gestionate de Auth.js (cookie HttpOnly); fără token în URL/log |
| 7 | **Rate-limiting / DoS** | pe login, invitație, verificare, mutații (POST validări/comentarii/schițe) |
| 8 | **Error handling / info leak** | format unic `{error:{code,message}}`; fără stack-trace/SQL/căi |
| 9 | **Logging / monitoring** | doar metadate; hook `block-pii-log`; fără PII |
| 10 | **Dependențe / supply chain** | `npm audit` în CI ulterior; versiuni fixate; minim de pachete |
| 11 | **Upload fișiere** | doar admin/seed în v1 (suprafață redusă); validare tip/mărime imagine (~5MB) |
| 12 | **CSRF / SSRF** | mutații prin server actions/POST cu protecție Auth.js; fără fetch către URL-uri user-controlate |
| 13 | **Security headers / config** | headers pe Next/Vercel (CSP de bază, HSTS), cookie flags corecte |

---

## 4. Riscuri specifice DETALIA (atenție crescută)

- **Polimorfism `validations`/`comments`** — `target_type` + `target_id` **fără FK forțat** → serviciul TREBUIE să
  verifice că target-ul **există** și că tipul e valid, altfel se pot crea poziții pe ținte fantomă. (Test dedicat.)
- **Ownership pe schițe** — două ownership-uri diferite: editarea/send = **autorul schiței**; accept/reject =
  **autorul detaliului-mamă**. Ușor de confundat → escaladare. Test explicit pe ambele.
- **Poziție unică reversibilă** — re-postarea trebuie să **actualizeze** aceeași înregistrare, nu să ocolească
  constrângerea unică. (Race condition: două POST simultane → constrângerea DB e plasa de siguranță.)
- **Invitație & magic link** — one-time chiar one-time (folosit → respins), expirare din env, fără enumerare de emailuri.
- **Admin endpoints** — `/api/admin/*` e cea mai tentantă suprafață de escaladare; rol admin verificat în service, nu doar în UI.

---

## 5. Poarta de securitate per fază (Definition of Done)

- **Faza 0 (auth): ✅ structural acoperită (2026-06-20).** `proxy.ts` deny-by-default verificat la runtime
  (rută protejată → 302 `/login`); magic link one-time/expirare (config Auth.js + TTL env); schelet invitație
  one-time (HOLD); admin pe allowlist `ADMIN_EMAILS` + `requireAdmin()`; fără secrete în cod; fără PII în loguri
  (seed loghează doar numere). Rămâne testarea „login real" cu credențiale (Neon + Resend).
- **Faza 1 (validare):** matricea §2 verde pe details/validations/comments; IDOR pe DELETE validation; DISAPPROVE→422.
- **Faza 1.5 (schiță):** ownership dublu (autor schiță vs. autor-mamă); tranziții state machine (409); target polimorfic validat.
- **Faza 2 (verificare + lansare):** matrice 100% verde; rate-limit pe sensibile; audit pe cele 13 categorii;
  decizie finală Poarta 1; **Security Engineer + Code Review** (CRITICAL nu trece fără ele).

---

## 6. Cum folosim documentul

1. **La fiecare endpoint nou** → adaugă rând în §2 ca 🔲.
2. **La implementare** → bifează coloanele; scrie testul de authz din `PLAN-TESTE.md`.
3. **Înainte de PR** → endpoint-ul e ✅ pe toate coloanele relevante, altfel nu e „done".
4. **La final de fază** → trece poarta §5; pe CRITICAL, rulează skill-ul `security-audit` (verdict APPROVED/BLOCKED).
