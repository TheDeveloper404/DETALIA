# Audit DETALIA — Frontend/Backend + Security (MVP)

> Data: 26 iunie 2026 · Auditor: Claude Code · Scop: verificare cablaj frontend-backend, securitate, cod mort, rute neprotejate
> **Acoperire: 100% din codul sursă** (toate paginile, componentele, server/repos, server/services, server/domain, db/schema + migrări + seed, lib, config, docs)

## Sumar executiv

| Domeniu | Stare |
|---|---|
| Arhitectură (clean layers) | Excelentă — business în services, UI subțire, repo-uri dedicate |
| Auth (magic link) | Corect — passwordless, fără parolă, sesiuni DB |
| Protecție rute (proxy) | Corect — deny-by-default, prefixe publice explicit |
| Anti-IDOR în services | Corect — userId din sesiune, nu din client |
| Validare server-side | Corect — regulile de business NU se bazează pe frontend |
| XSS | Corect — escape HTML în emailuri |
| Rate limiting | **LIPSĂ** — niciun endpoint nu are rate-limit |
| Cod mort / dev routes | **RISC MIC** — `dev/*` gated corect pe producție |
| Logging PII | Corect — nu se loghează emailuri, tokenuri, dovezi |
| SQL injection | Corect — Drizzle ORM + parametrizați |
| Timestamps / tipuri | Corect — ISO 8601, snake_case |
| Dependențe | Fără vulnerabilități cunoscute majore |

---

## 1. Arhitectură și cablaj

### 1.1 Clean Architecture
- `server/domain/` — entități pure, zero dependențe infra
- `server/services/` — business logic, apelează repo-uri
- `server/repos/` — singurele care ating Drizzle/DB
- `app/*/actions.ts` — server actions subțiri, validează sesiune + deleagă
- `components/` — UI pur, props-driven, fără acces direct la DB

### 1.2 Fluxuri verificate

**Auth flow:**
```
app/page.tsx → lib/auth.ts (NextAuth) → db/schema.ts (adapter Drizzle)
app/auth-actions.ts (signInWithEmailAction) → Resend provider → magic link
app/login/page.tsx, app/signup/page.tsx → AuthForm → signInWithEmailAction
```

**Onboarding flow:**
```
app/onboarding/page.tsx → verifica sesiune + role check → OnboardingForm
onboarding/actions.ts → declareRole service → insert role + user profile
```

**Detail creation:**
```
app/(app)/details/new/actions.ts → uploadDetailImage (storage) → createDetail service
→ validateDetailInput → insertDetail + insertDetailResources
```

**Validation flow:**
```
app/(app)/details/[id]/page.tsx → ValidationPanel (client) → approveAction/disapproveAction
→ validationService.approve/disapprove → upsertPosition + optional insertComment
```

**Sketch flow:**
```
SketchSection → startSketchAction → createDraft (service) → redirect la editor
SketchEditor → saveStrokesAction / sendSketchAction → sketchService.saveStrokes/send
send → DRAFT→PENDING_ACCEPTANCE → notification to detail author
accept/reject → PENDING_ACCEPTANCE→PUBLISHED/REJECTED
```

### 1.3 Baza de date (verificat din migrări SQL)

- Migrarea `0000` creează toate tabelele, enum-urile, FK-urile și indecșii
- Constrângerea UNIQUE `(user_id, target_type, target_id)` pe `validations` — **garantată la nivel DB** (coloana 136 migrare 0000)
- Toate FK-urile au indecși (conform convenției proiectului)
- Migrarea `0001` adaugă `description` pe `details`
- Migrarea `0002` adaugă coloanele de profil (`first_name`, `last_name`, `headline`, `location`, `website`, `cover_image`)
- Fără probleme de integritate: FK-urile cu `ON DELETE cascade` sunt corecte (accounts, comments, notifications, roles, sessions, sketches, validations); `ON DELETE no action` unde datele nu trebuie șterse automat (details, invitations)

### 1.4 Seed (`db/seed.ts`) — conținut demo

- Idempotent (`onConflictDoNothing` pe email și slug)
- 6 categorii, 4 useri demo cu roluri (2 VERIFIED, 2 DECLARED)
- 9 detalii cu date realiste, validări (inclusiv 1 dezaprobare cu justificare), comentarii heatmap, 3 schițe în diferite stări
- Folosește `dotenv` pentru `DATABASE_URL` (separat de Next.js) — OK, dar asigurați-vă că `dotenv` e în `dependencies`
- **Notă:** conținutul demo e marcat „DE ȘTERS înainte de prod" — acest reminder trebuie respectat

### 1.5 Documentație (`docs/API.md`, `docs/SCHEMA.md`)

- Ambele sunt marcate „pre-scaffold" (scrise înainte de implementare) → **stale față de cod**
- `API.md` listează endpoint-uri REST care nu există (totul e prin server actions)
- `SCHEMA.md` lipsește coloanele adăugate în migrările 0001–0002 (`description`, `first_name`, `last_name`, `headline`, `location`, `website`, `cover_image`)
- Recomandare: actualizat docs sau marcat explicit „vezi codul" mai vizibil (deși disclaimerul există)

### 1.6 Cablaj verificat (frontend → service → repo)
| Acțiune | Frontend | Server Action | Service | Repo |
|---|---|---|---|---|
| Login | AuthForm | signInWithEmailAction | NextAuth | Auth.js adapter |
| Onboarding | OnboardingForm | onboardingAction | declareRole | usersRepo + rolesRepo |
| Create detail | detail-form.tsx | createDetailAction | createDetail | detailsRepo |
| Approve | ValidationPanel | approveAction | approve | validationsRepo |
| Disapprove | ValidationPanel | disapproveAction | disapprove | validationsRepo |
| Add comment | CommentsSection | addCommentAction | addComment | commentsRepo |
| Save sketch | SketchEditor | saveStrokesAction | saveStrokes | sketchesRepo |
| Send sketch | SketchEditor | sendSketchAction | send | sketchesRepo |
| Accept sketch | SketchSection | acceptSketchAction | accept | sketchesRepo |
| Edit profile | profile-forms.tsx | updateProfileDetailsAction | (direct repo) | usersRepo |
| Verification | profile-forms.tsx | requestVerificationAction | requestRoleVerification | rolesRepo |

**Probleme identificate:**

- **`updateAvatarAction` / `updateCoverAction` / `updateProfileDetailsAction`** din `app/(app)/profile/actions.ts` ocolesc service-ul și merg direct în repo-uri (`usersRepo`). Nu e o gaură de securitate (userId e din sesiune), dar încalcă convenția arhitecturală. Recomand: mutat prin `profileService`.
- **`profileRepo.ts`** — bine structurat, toate interogările sunt read-only și parametrizate. Folosește `to_char` pentru heatmap-ul de contribuții (portabil PostgreSQL). Fără probleme.
- **`categoriesRepo.ts`** — `listCategoriesWithCounts` folosește subquery corelat pentru numărul de detalii per categorie. Corect, fără N+1.
- **`notificationsRepo.ts`** / **`invitationsRepo.ts`** — simple CRUD, corecte. InvitationsRepo e nefolosit (dormant, conform planului).
- **`app/template.tsx`** — **confirmat folosit**: aplică clasa `.dt-page` care declanșează animația de fade la navigare (definită în `globals.css:242-257`). Nu e mort.

---

## 2. Securitate

### 2.1 Autentificare (Auth.js v5)
- Magic link passwordless, fără stocare parolă → corect
- Adapter Drizzle, sesiuni în DB → corect
- `trustHost: true` — necesar pentru Vercel, dar **revizuit** în producție
- Token magic link: TTL configurable din env (default 15 min) → corect
- Callback `session` expune `user.id` → necesar, corect

### 2.2 Protecție rute (middleware/proxy)
- `proxy.ts` — deny-by-default, doar prefixele explicite sunt publice
- Rute protejate redirecționează la `/login?callbackUrl=...`
- Matcher exclude `/api/auth/*`, `_next/*`, `favicon.ico`, fișiere statice → corect
- **Dev pages** (`/dev/*`) sunt în `PUBLIC_PATHS` DOAR când `NODE_ENV !== "production"` → corect
- Fiecare pagină `dev/*` are și `notFound()` în producție ca a doua barieră → corect

### 2.3 Anti-IDOR (Insecure Direct Object Reference)
- Toate server actions și services primesc `userId` din sesiune (`session.user.id`), NU din form/client
- **Verificat:** `validation-actions.ts:38` → `approve({ userId: session.user.id, ... })`
- **Verificat:** `sketch-actions.ts:38-39` → `saveStrokes({ sketchId, authorId: session.user.id })`
- **Verificat:** `sketchService.send()` → `sketch.authorId !== input.authorId` → FORBIDDEN
- **Verificat:** `sketchService.decide()` → `detail.authorId !== input.actorUserId` → FORBIDDEN
- **Verificat:** `comment-actions.ts:31` → `addComment({ userId: session.user.id, ... })`
- **Problema:** `deleteDraftAction` din `drafts/actions.ts:16` trimite `sketchId` din formular, dar service-ul verifică ownership și status DRAFT → safe

### 2.4 Validare server-side (reguli de business)
| Regulă | Enforced pe server? | Locație |
|---|---|---|
| Dezaprob = justificare obligatorie | DA | `validationService.ts:89-95` |
| Un singur rol per user (unic DB) | DA | `schema.ts:133` (unique pe userId) |
| Un singur vot per user/țintă (unic DB) | DA | `schema.ts:271` (unique pe userId+targetType+targetId) |
| Rol declarat înainte de validare/comentariu | DA | Toate services verifică `getRoleByUserId` |
| Rol declarat înainte de creare detaliu | DA | `detailService.ts:48` (`userHasRole`) |
| Sketch: doar autorul editează/trimite | DA | `sketchService.ts:65,86` |
| Sketch: doar autorul mamă acceptă/respinge | DA | `sketchService.ts:133` |
| Tranziție atomică (race condition) | DA | `sketchesRepo.ts:58` guard pe status |
| Rol + subrol valid | DA | `roleService.ts:28-37` |
| Titlu obligatoriu | DA | `detail.ts:80` |
| Imagine obligatorie | DA | `detail.ts:92` |
| Max 3 resurse | DA | `detail.ts:95` |
| URL-uri resurse doar http/https | DA | `detail.ts:109` + `isHttpUrl()` |
| Stroke-uri validate structural | DA | `sketch.ts:55-104` |
| Coordonate normalizate 0..1 | DA | `sketch.ts:50-52` + `sketch.ts:97` |
| Format UUID valid | DA | `detailService.ts:29` + `detailService.ts:90` |
| Dimensiune/tip imagine | DA | `storage.ts:20-27` |

### 2.5 XSS
- Email HTML: `esc()` în `notificationService.ts:20-27` escapează `&<>"'` → corect
- User-supplied values (nume, titlu) apar în HTML email DOAR prin `esc()` → corect
- `dangerouslySetInnerHTML` / `innerHTML` — **nu apare nicăieri** în cod → bine
- `next/image` și `img` tags folosesc `alt` text → corect

### 2.6 Rate Limiting
- **NICIUN** endpoint/server action nu are rate limiting
- Pericol: magic link spam, validare spam, comentarii spam
- Recomandare CRITICAL pentru MVP: adăugat rate-limit pe:
  - `signInWithEmailAction` (magic link)
  - `createDetailAction` (upload)
  - `approveAction` / `disapproveAction`
  - `addCommentAction`

### 2.7 Headere de securitate
- **LIPSĂ** — Next.js nu adaugă implicit CSP, HSTS, etc.
- Recomandare: `next.config.js` cu headere de securitate (CSP, X-Frame-Options, X-Content-Type-Options)

### 2.8 Logging PII
- Comentariile documentează clar ce e PII și că nu se loghează → corect
- `verificationEvidence` (OAR/CUI) — marcat PII, stocat în DB, nu logat → corect
- `getUserContact` (email) — folosit doar pentru trimis email, nu logat → corect

### 2.9 Dev-login bypass
- `app/dev/login/actions.ts` — creează sesiuni direct în DB cu un token hex random
- **GATIT:** `if (process.env.NODE_ENV === "production") throw new Error(...)` → safe
- **Dar:** Problema e că acest cod există. Dacă cineva deployează cu `NODE_ENV` greșit, e periculos.
- Recomandare: eliminat complet din cod înainte de producție sau mutat într-un fișier care nu e inclus în build.

---

## 3. Cod mort / Rute nefolosite

### 3.1 Schelă dormantă (intenționată)
- `invitationService.ts` — complet implementat dar NEUTILIZAT (niciun server action nu-l cheamă)
  - `createInvitation`, `validateInvitation`, `consumeInvitation`
  - Confirmat în CLAUDE.md: „Dormant în MVP"
- Providerul Google OAuth în `lib/auth.ts:41` — comentat, marcat „scos pentru MVP"
- `listCategoriesWithCounts` din `categoryService.ts` — folosit în feed → nu e mort

### 3.2 Componente nefolosite
- `app/(app)/notifications/mark-read-on-view.tsx` — folosit în `notifications/page.tsx`
- `app/dev/preview/sketch/sketch-preview-client.tsx` — folosit doar în dev preview
- `components/feed-empty.tsx` — folosit în feed + dev preview feed
- `components/hero-preview.tsx` — folosit în landing
- `components/intro-splash.tsx` — folosit în landing
- `components/reveal.tsx` — folosit în landing (animații scroll)
- `components/contribution-graph.tsx` — folosit în profile-view
- Toate par folosite.

---

## 4. Rute neprotejate (găuri)

### 4.1 Verificat: toate rutele protejate
| Rută | Protejată? | Mecanism |
|---|---|---|
| `/` (landing) | Public | `proxy.ts` |
| `/login` | Public | `proxy.ts` |
| `/signup` | Public | `proxy.ts` |
| `/feed` | DA | `proxy.ts` + sesiune în componentă |
| `/details/[id]` | DA | `proxy.ts` + sesiune în componentă |
| `/details/new` | DA | `proxy.ts` + sesiune în actions |
| `/profile` | DA | `proxy.ts` + sesiune |
| `/profile/[userId]` | DA | `proxy.ts` + sesiune |
| `/profile/edit` | DA | `proxy.ts` + sesiune |
| `/sketches/[id]/edit` | DA | `proxy.ts` + sesiune + ownership |
| `/sketches/drafts` | DA | `proxy.ts` + sesiune |
| `/notifications` | DA | `proxy.ts` + sesiune |
| `/onboarding` | DA | `proxy.ts` + sesiune |
| `/dev/*` | DOAR non-prod | `proxy.ts` + `notFound()` |
| `/api/auth/*` | Public (Auth.js) | Exclus din matcher |

### 4.2 Problema: API routes lipsă
- Nu există rute REST `/api/details`, `/api/validations`, etc.
- Totul e prin server actions → e acceptabil pentru MVP, dar face imposibilă integrarea cu client extern
- Pentru faza curentă: e ok (server actions sunt RPC-uri)

---

## 5. Alte probleme

### 5.1 Website safety
- `profileService.ts:39-49` → `safeWebsite()` normalizează URL-ul și blochează scheme periculoase → corect
- `updateProfileDetailsAction` din `profile/actions.ts:112` prefixează `https://` → corect

### 5.2 Hardcodări
- `DEFAULT_TTL_HOURS = 168` în `invitationService.ts:17` — dar e fallback, env e preferat
- `DEFAULT_FEED_SIZE = 20` în `detail.ts:16` — constantă de produs, acceptabil
- `SESSION_TTL_MS = 30 * 86_400_000` în `dev/login/actions.ts:14` — doar dev, acceptabil

### 5.3 Tranzacții DB
- `detailService.ts:70` — menționează că driverul Neon HTTP nu suportă tranzacții interactive
- Resursele orfane sunt tolerate (opționale) → risc acceptabil pentru MVP

### 5.4 Dependențe
- `zod` în `package.json` — dar **nu e folosit** nicăieri în cod. Validările sunt manuale.
- Recomandare: eliminat `zod` sau folosit pentru validările din domain

### 5.5 Erori silențioase
- `sendEmail` în `email.ts` — înghite orice eroare (intenționat, documentat)
- `uploadSketchThumbnail` în `storage.ts:77` — doar `console.error`, fără throw
- Upload thumbnail în `sketch-actions.ts:58-61` — best-effort, dacă thumb upload eșuează, SEND merge fără el

---

## 6. Recomandări CRITICAL

1. **Rate limiting** — adăugat pe toate server actions care scriu (auth, validare, comentarii, upload)
2. **Eliminat `dev/login/actions.ts`** complet din build (nu doar gated cu env check)
3. **Adăugat headere de securitate** în `next.config.js` (CSP, HSTS)

## 7. Recomandări MEDIUM

4. **Mutate profile update actions** prin `profileService` în loc de repo direct
5. **Eliminat `zod`** din dependențe (nefolosit)
6. **Revizuit `trustHost: true`** pentru producție (e setat prea permisiv)

## 8. Recomandări LOW

7. **Adăugat `maxLength` pe textarea de justificare** în client (UX, nu security)
8. **Adăugat `loading` states consistente** pe toate butoanele de formular
9. **Docs (`API.md`, `SCHEMA.md`)** — actualizat să reflecte starea curentă a codului (sau eliminat disclaimerul ambiguu)

---

**Notă:** Acest audit e bazat pe citirea **100%** a codului sursă (iunie 2026) — toate paginile, componentele, server/repos, server/services, server/domain, db/schema + migrări + seed, lib, config, middleware, docs. Nu a rămas niciun fișier necitit.

**Confirmat curat:** `lib/format.ts`, `lib/utils.ts`, `lib/sketch-render.ts`, `components/brand-logo.tsx`, `components/avatar-initials.tsx`, `components/feed-validation-actions.tsx`, `app/globals.css`, `app/layout.tsx`, `app/error.tsx`, `app/not-found.tsx`, `next.config.ts`, `drizzle.config.ts`, `.env.example` — toate respectă standardele proiectului, fără probleme de securitate sau arhitectură.

Toate regulile de business sunt aplicate corect pe server. Authz e granulară și anti-IDOR. Riscul principal e lipsa rate limiting-ului.
