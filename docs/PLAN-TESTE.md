# DETALIA — Plan de teste

> Strategia de testare + scenariile critice. Marker `HUMAN_RUNS_TESTS` activ → **userul rulează testele**;
> Claude le scrie și spune ce/unde. `tsc --noEmit` / `next build` pot rula automat (nu sunt „teste").
> Tratăm auth/roluri/validare ca **CRITICAL** → cer și teste de securitate, nu doar happy-path.

---

> **STATUS (2026-07-07): suita EXISTĂ și rulează** — unit (`vitest`, 11 fișiere în `server/`+`lib/`) +
> E2E (`Playwright`, 24 fișiere în `e2e/`, ~86 teste). Documentul de mai jos reflectă suita reală, nu doar intenția.

## Piramida (ce acoperim cu ce)

| Nivel | Unde | Ce acoperă |
|---|---|---|
| **Unit** | `server/domain/*.test.ts`, `server/services/*.test.ts`, `lib/*.test.ts` | reguli de business + state machines, izolat (fără DB) |
| **E2E** (Playwright, `e2e/*.spec.ts`) | fluxurile critice cap-coadă, pe preview/dev real | public, authed (validare/comentariu), schiță (publish/delete) |
| **Security** | authz pe endpoint-uri sensibile, verificat manual pe prod (vezi `docs/SECURITATE.md`) | IDOR, privilege escalation, deny-by-default |

Nu avem un nivel „integration" separat (route handler + DB de test) — E2E rulează direct pe un preview
Vercel + DB Neon reale, ceea ce acoperă acel gol.

---

## Reguli de business de testat (server-side, NON-negociabile)

1. **Dezaprob fără justificare → respins (422).** Cu justificare → creează `Validation` + `Comment` cu `originValidationId`.
2. **O singură poziție per user/țintă, reversibilă** — a doua postare actualizează, nu duplică (constrângerea unică).
3. **Schiță → PUBLISHED direct la trimiterea autorului** (fără coadă de acceptare, model eliminat 2026-06-30). Tranziții invalide → 409.
4. **Ștergerea unei schițe** = permisă autorului schiței SAU autorului detaliului-mamă (altcineva → 403).
5. **Upload detalii = orice user autentificat cu rol declarat.** Neautentificat / fără rol → respins; moderare post-publicare (fără coadă de aprobare).
6. **Max 3 resurse** per detaliu (a 4-a → respinsă).
7. **Verificare rol:** doar admin aprobă (`DECLARED→PENDING→VERIFIED`); user normal nu poate auto-aproba.
8. **Polimorfism:** validare/comentariu funcționează identic pe Detail și pe Sketch.

**Acoperite azi de unit tests** (`server/domain/`, `server/services/`): state machine schiță
(`sketch.test.ts`), validare/dezaprobare (`validation.test.ts`, `validationService.test.ts`), publish/delete
schiță (`sketchService.test.ts`), roluri (`roles.test.ts`), reguli detaliu (`detail.test.ts`), id-uri
polimorfice (`ids.test.ts`). Plus `lib/`: rate-limit, audit, url, upload-limits.

---

## Scenarii de securitate (CRITICAL — authz)

- **IDOR:** user A nu poate edita/șterge validarea, comentariul sau schița lui user B.
- **Privilege escalation:** user normal nu accesează rutele `/admin-page/*` (allowlist `ADMIN_EMAILS`, sesiune separată).
- **Deny-by-default:** orice rută `(app)` fără sesiune → redirect `/login` (nu 200, nu 404 mascat).
- **Authz corect:** rol greșit → 403, lipsă auth → 401/redirect — **niciodată 404** ca să ascundă existența.
- **Magic link:** token expirat/folosit → respins; one-time use chiar e one-time.
- **Fără leak:** răspunsurile de eroare nu conțin stack-trace / SQL / căi.
- **Rate-limit:** endpoint-urile sensibile (login, mutații, upload, creare detaliu) limitate.

Astea au fost verificate **live pe prod** în auditul formal 2026-07-02 (atacuri cross-user reale, cu date de
test — vezi `docs/SECURITATE.md`), nu doar prin teste automate.

---

## E2E — suita reală (`e2e/*.spec.ts`, Playwright, `playwright.config.ts`)

Organizată pe proiecte Playwright, fiecare cu un tip de context (anonim/authed/service-direct) și o
dependință de date proprie:

| Proiect | Context | Fișiere |
|---|---|---|
| `public` | anonim, fără sesiune, fără DB | `public.spec.ts`, `verify-and-maintenance.spec.ts` |
| `setup` | seedează user+rol+detaliu+sesiune JWT (dependință a `authed`) | `auth.setup.ts` |
| `authed` | sesiune seedată (storageState) | `authed.spec.ts`, `sketch.spec.ts`, `detail-upload.spec.ts`, `sketch-draft.spec.ts`, `canvas.spec.ts`, `detail-draft.spec.ts`, `detail-edit.spec.ts`, `feed.spec.ts`, `feed-search.spec.ts`, `sketch-numbering.spec.ts`, `profile-edit.spec.ts`, `profile-public.spec.ts`, `saved.spec.ts`, `notifications-page.spec.ts` |
| `security` | apel direct service+DB, fără browser | `security.spec.ts` (IDOR), `integration.spec.ts` (atomicitate/cascadă), `admin-auth.spec.ts` (consum atomic token admin), `notifications.spec.ts` |
| `suspended` | user dedicat, cookie JWT propriu | `suspended.spec.ts` (SEC-04, cont suspendat cu token stale) |
| `admin-access` | anonim, sesiune admin construită direct în DB (fără email real din allowlist) | `admin-access.spec.ts` (privilege-escalation `/admin-page`) |
| `onboarding` | user dedicat fără rol | `onboarding.spec.ts` |
| `sketch-public` | anonim, dependință de `setup` | `sketch-public.spec.ts` (teaser public `/s/[id]`) |

**Ce acoperă, pe scurt:** acces public/deny-by-default, onboarding, upload/editare/draft de detalii, schițare
(draft/publish/delete/numerotare), planșe (canvas), validare Aprob/Dezaprob, comentarii, notificări (service
+ pagină UI), profil (propriu + public), bookmark/saved, feed (căutare + filtrare pe categorie), teaser public
de schiță, control acces admin, IDOR (comentariu/schiță/planșă/editare detaliu), suspendare cont, consum
atomic al tokenului de magic link (user + admin).

**Ce NU e acoperit (deliberat, backlog):** lockdown global live-toggle (risc de coliziune pe DB shared,
`fullyParallel`), overlay multi-schiță, verificarea rolului (feature pe HOLD, nu se testează).

---

## Ținte de acoperire (pragmatic, fază de validare)

- **Reguli de business + authz: acoperire cât mai aproape de completă** (sunt inima + CRITICAL).
- UI pur prezentațional: smoke/E2E, fără obsesie de coverage.
- **Definition of done pe feature CRITICAL:** unit + E2E + verificare authz explicită (IDOR, escalare).

---

## Cum rulează testele

```bash
npm test                                   # unit (vitest), fără DB/secrete
npm run test:watch                         # unit, watch mode

npx playwright install chromium            # o singură dată
npm run e2e                                # tot: public + setup + authed (cere .env.e2e, vezi e2e/README.md)
npm run e2e -- --project=public            # doar fluxurile publice, fără DB
npm run e2e -- --project=authed            # doar authed (rulează și setup-ul, dependință)
npm run e2e -- --project=security          # doar IDOR/integrare (rulează și setup-ul, dependință)
npm run e2e -- --project=admin-access      # doar control acces admin, fără DB de seed
npm run e2e -- --workers=1                 # toate proiectele, secvențial (semnal final înainte de deploy)
npm run e2e:ui                             # debug vizual
```

> ⚠️ Teste verzi ≠ build verde: după schimbări de tipuri/schemă rulează și `npm run build` / `tsc --noEmit`
> (vitest ignoră erorile de tip; CI/deploy pică la type-check).
