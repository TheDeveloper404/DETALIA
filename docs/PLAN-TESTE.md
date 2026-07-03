# DETALIA — Plan de teste

> Strategia de testare + scenariile critice. Marker `HUMAN_RUNS_TESTS` activ → **userul rulează testele**;
> Claude le scrie și spune ce/unde. `tsc --noEmit` / `next build` pot rula automat (nu sunt „teste").
> Tratăm auth/roluri/validare ca **CRITICAL** → cer și teste de securitate, nu doar happy-path.

---

> **STATUS (2026-07-03): suita EXISTĂ și rulează** — unit (`vitest`, 11 fișiere în `server/`+`lib/`) +
> E2E (`Playwright`, 5 fișiere în `e2e/`, 22 teste). Documentul de mai jos reflectă suita reală, nu doar intenția.

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

## E2E — suita reală (`e2e/*.spec.ts`, Playwright)

```
public.spec.ts   (anonim, fără DB — proiectul `public`)
  - Landing: se încarcă, CTA către signup/login
  - Landing: click „Creează cont" → /signup
  - /login randează formularul magic link · /signup randează formularul de creare cont
  - login ⇄ signup sunt legate reciproc
  - /verify-request e public și brandat
  - Deny-by-default: rută protejată (/feed, /profile) ca anonim → redirect /login cu callbackUrl
  - Rută inexistentă (sub prefix public) → 404

auth.setup.ts   (proiectul `setup`, dependință a `authed`)
  - Seedează user+rol+detaliu în DB (preview/dev) + emite cookie de sesiune JWT valid (encode() @auth/core/jwt)

authed.spec.ts   (sesiune seedată — proiectul `authed`)
  - Feed-ul se încarcă (nu redirect la login) · profilul propriu se încarcă
  - Aprob = 1 click → poziția devine activă
  - Dezaprob cere justificare → devine comentariu argumentat (nicio „dezaprobare mută")
  - Comentariu pe detaliu apare în dezbatere

sketch.spec.ts   (sesiune seedată — proiectul `authed`)
  - Schițează peste detaliu → editor → desen real (drag pe canvas) → Publică → intră direct în teanc
  - Tab-ul schiței → badge „în teanc · publicată" → ștergere de către autor → tab-ul dispare

security.spec.ts   (proiectul `security` — apel direct pe service+DB real, fără browser)
  - IDOR comentariu: attacker nu poate edita comentariul victimei (NOT_FOUND, comentariul supraviețuiește)
  - IDOR comentariu: attacker nu poate șterge comentariul victimei (NOT_FOUND, comentariul supraviețuiește)
  - IDOR schiță: user care nu e nici autorul schiței, nici al detaliului → FORBIDDEN, schița supraviețuiește

integration.spec.ts   (proiectul `security` — apel direct pe service+DB real, fără browser)
  - createDetail: detaliul + categoriile + resursele se inserează atomic (un singur db.batch)
  - deleteDetail: cascada șterge schița + validarea/comentariul polimorfice de pe ea (polimorfism SKETCH)
```

**Ce NU e acoperit încă (opțional, backlog):** overlay multi-schiță, verificare rol (feature pe HOLD, nu se
testează), filtrele de feed pe categorie.

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
npm run e2e -- --project=security          # doar IDOR (rulează și setup-ul, dependință)
npm run e2e:ui                             # debug vizual
```

> ⚠️ Teste verzi ≠ build verde: după schimbări de tipuri/schemă rulează și `npm run build` / `tsc --noEmit`
> (vitest ignoră erorile de tip; CI/deploy pică la type-check).
