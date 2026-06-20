# DETALIA — Contract API (inventar endpoint-uri)

> **🔵 SURSA DE ADEVĂR = CODUL** (`app/api/...` + `server/services`). Acest fișier e *design doc*: la orice
> divergență, **codul câștigă**. Când schimbi un endpoint în cod, actualizează aici sau marchează „verifică în cod".
> _Ultima verificare față de cod: pre-scaffold (codul încă nu există)._
>
> Inventarul rutelor REST (route handlers `app/api/...`) + server actions pentru mutații.
> Convențiile de bază sunt în `CLAUDE.md` („Standarde moștenite"). Acest doc le aplică pe domeniul DETALIA.
> Status: **contract de proiectare** — se materializează ca handlers în Faza 0/1. Se actualizează odată cu codul.

---

## Convenții (recap din CLAUDE.md)

- **Răspuns JSON.** Timestamps **ISO 8601**. Sesiune via **cookie HttpOnly** (gestionată de Auth.js).
- **Format unic de eroare:**
  ```json
  { "error": { "code": "VALIDATION_ERROR", "message": "Mesaj lizibil.", "details": { } } }
  ```
- **Coduri standard:** `VALIDATION_ERROR`(400) · `UNAUTHORIZED`(401) · `FORBIDDEN`(403) · `NOT_FOUND`(404) ·
  `CONFLICT`(409) · `UNPROCESSABLE`(422) · `RATE_LIMITED`(429) · `INTERNAL_ERROR`(500, fără internals).
- **Authz:** `401` lipsă auth / `403` rol greșit — **niciodată `404` ca să ascunzi existența**.
- **Deny-by-default:** tot ce e sub `(app)` cere sesiune. Rolul și regulile de business **se verifică pe server**.
- **Fără** stack-trace / erori SQL / căi în răspuns. **Rate-limit** pe endpoint-urile sensibile (auth, invitație, verificare).
- Handler-ul = **subțire**: validează input → deleagă la `server/services`. Zero business în handler.

---

## 1. Autentificare & acces

> Magic link + sesiunile sunt **gestionate de Auth.js** — NU le scriem manual.

| Metodă | Rută | Auth | Descriere |
|---|---|---|---|
| `*` | `/api/auth/*` | public | Rutele Auth.js (magic link request, callback, signout, session). Gestionate de framework. |

**Acces în beta închis (poarta de acces — vezi `ARHITECTURA.md §3`, ÎN HOLD):** signup permis doar cu invitație
validă. Validarea tokenului de invitație se face în fluxul de signup (server-side), nu ca endpoint public separat.

---

## 2. Invitații (admin) `InvitationService`

| Metodă | Rută | Auth | Body / Query | Răspuns | Erori |
|---|---|---|---|---|---|
| `POST` | `/api/admin/invitations` | admin | `{ email }` | `201 { id, expiresAt }` (tokenul se trimite pe email, **nu** în răspuns) | 401, 403, 409 (deja invitat), 422 |
| `GET` | `/api/admin/invitations` | admin | — | `200 { items: [...] }` (fără tokenuri în clar) | 401, 403 |

> Tokenul de invitație **nu** se loghează și **nu** apare în răspuns — doar pe email (Resend). One-time, cu expirare.

---

## 3. Categorii `CategoryService`

| Metodă | Rută | Auth | Răspuns |
|---|---|---|---|
| `GET` | `/api/categories` | sesiune | `200 { tree: [...] }` — arborele de categorii pentru filtre |

---

## 4. Detalii `DetailService`

> **Upload de useri OPRIT în v1 (seed-only).** Crearea de detalii = doar conturi admin/seed.

| Metodă | Rută | Auth | Body / Query | Răspuns | Erori |
|---|---|---|---|---|---|
| `GET` | `/api/details` | sesiune | `?category=&climate=&seismic=&sort=interactions` | `200 { items: [~20] }` — feed finit, fără scroll infinit | 401 |
| `GET` | `/api/details/:id` | sesiune | — | `200 { detail, resources, teanc, counts }` | 401, 404 |
| `POST` | `/api/admin/details` | admin/seed | `{ title, categoryId, climateZone?, seismicZone?, imageUrl, resources? (max 3) }` | `201 { id }` | 401, 403, 422 |

---

## 5. Validări `ValidationService` (INIMA — polimorfic Detail/Sketch)

| Metodă | Rută | Auth | Body | Răspuns | Erori |
|---|---|---|---|---|---|
| `POST` | `/api/validations` | sesiune | `{ targetType: "DETAIL"\|"SKETCH", targetId, position: "APPROVE"\|"DISAPPROVE", justification? }` | `201 { id }` (creează/actualizează poziția unică) | 401, 404, **422 (DISAPPROVE fără `justification`)** |
| `DELETE` | `/api/validations/:id` | sesiune (proprietar) | — | `204` (retrage poziția) | 401, 403, 404 |

**Reguli enforce pe server:**
- **DISAPPROVE fără justificare → `422`** (nu ne bazăm pe frontend). Justificarea devine automat un `Comment`
  cu `originValidationId` (atribuit nume+rol).
- **O singură poziție per user per țintă, reversibilă** — garantat de constrângerea unică `(userId, targetType, targetId)`.
  Re-postarea actualizează aceeași înregistrare (nu creează duplicat → fără `409`).

---

## 6. Comentarii `CommentService` (polimorfic)

| Metodă | Rută | Auth | Body / Query | Răspuns | Erori |
|---|---|---|---|---|---|
| `GET` | `/api/comments` | sesiune | `?targetType=&targetId=` | `200 { items: [...] }` (cu nume+rol autor) | 401 |
| `POST` | `/api/comments` | sesiune | `{ targetType, targetId, body }` | `201 { id }` | 401, 404, 422 |

---

## 7. Schițe `SketchService` (state machine — vezi `ARHITECTURA.md §7.4`)

| Metodă | Rută | Auth | Body | Răspuns | Erori |
|---|---|---|---|---|---|
| `GET` | `/api/details/:id/sketches` | sesiune | — | `200 { items: PUBLISHED[] }` (teancul) | 401, 404 |
| `POST` | `/api/details/:id/sketches` | sesiune | `{ }` → creează `DRAFT` | `201 { id }` | 401, 404 |
| `PATCH` | `/api/sketches/:id` | sesiune (autor) | `{ strokesJson }` (coordonate normalizate 0..1) | `200` | 401, 403, 404 |
| `POST` | `/api/sketches/:id/send` | sesiune (autor) | — → `DRAFT → PENDING_ACCEPTANCE` + `Notification` către autorul detaliului-mamă | `200 { status }` | 401, 403, 404, 409 (stare invalidă) |
| `POST` | `/api/sketches/:id/accept` | sesiune (**autor detaliu-mamă**) | — → `PENDING_ACCEPTANCE → PUBLISHED` (randează thumbnail PNG în Blob) | `200 { status }` | 401, 403, 404, 409 |
| `POST` | `/api/sketches/:id/reject` | sesiune (**autor detaliu-mamă**) | — → `PENDING_ACCEPTANCE → REJECTED` | `200 { status }` | 401, 403, 404, 409 |

**Reguli enforce pe server:** o schiță devine `PUBLISHED` **doar** cu (1) send autor + (2) accept autor
detaliu-mamă. Tranzițiile invalide → `409`. Doar autorul-mamă acceptă/respinge (`403` altfel).

---

## 8. Notificări `NotificationService`

| Metodă | Rută | Auth | Răspuns |
|---|---|---|---|
| `GET` | `/api/notifications` | sesiune | `200 { items, unreadCount }` |
| `PATCH` | `/api/notifications/:id/read` | sesiune (destinatar) | `200` |

> Notificările merg **in-app ȘI pe email** (Resend) de la început — vezi `docs/EMAILURI.md`.

---

## 9. Verificare rol `VerificationService` (poarta 2 — „pull, nu push")

| Metodă | Rută | Auth | Body | Răspuns | Erori |
|---|---|---|---|---|---|
| `POST` | `/api/verification` | sesiune | `{ evidence }` (ex. nr. OAR / CUI) → `DECLARED → PENDING` | `202 { status }` | 401, 422, 429 |
| `GET` | `/api/admin/verification` | admin | — | `200 { items: PENDING[] }` | 401, 403 |
| `POST` | `/api/admin/verification/:roleId/approve` | admin | — → `PENDING → VERIFIED` (badge) | `200` | 401, 403, 404 |
| `POST` | `/api/admin/verification/:roleId/reject` | admin | `{ reason? }` → `PENDING → REJECTED` | `200` | 401, 403, 404 |

> **Dovezile de verificare (OAR/CUI) = PII → NU se loghează** (doar metadate). Rate-limit pe `POST /api/verification`.

---

## Note de implementare

- Rutele `/api/admin/*` cer rol de admin verificat pe server (deny-by-default).
- Paginare clasică unde e cazul (feed = top ~20, fără infinite scroll).
- Toate valorile tunable (TTL-uri) din **env**, niciodată hardcodate.
