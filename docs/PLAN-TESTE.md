# DETALIA — Plan de teste

> Strategia de testare + scenariile critice. Marker `HUMAN_RUNS_TESTS` activ → **userul rulează testele**;
> Claude le scrie și spune ce/unde. `tsc --noEmit` / `next build` pot rula automat (nu sunt „teste").
> Tratăm auth/roluri/validare ca **CRITICAL** → cer și teste de securitate, nu doar happy-path.

---

> ⚠️ **STATUS (2026-06-27): testele NU există încă** — `vitest` nu e instalat, `npm test` nu pornește. Documentul e
> **intenția** de testare (ce vom scrie), nu o suită existentă. Scenariile reflectă deciziile curente (acces public,
> upload deschis); verificarea rolului = PE HOLD (E2E-4 amânat).

## Piramida (ce acoperim cu ce)

| Nivel | Unde | Ce acoperă |
|---|---|---|
| **Unit** | `server/services`, `server/domain` | reguli de business + state machines, izolat (DB mock/in-memory) |
| **Integration** | route handlers + DB de test | fluxul handler→service→repo, cu reguli enforce-uite pe server |
| **Security** | authz pe endpoint-uri sensibile | IDOR, privilege escalation, deny-by-default |
| **E2E** (Playwright) | fluxurile critice cap-coadă | signup→login→validare→schiță→accept |

---

## Reguli de business de testat (server-side, NON-negociabile)

1. **Dezaprob fără justificare → respins (422).** Cu justificare → creează `Validation` + `Comment` cu `originValidationId`.
2. **O singură poziție per user/țintă, reversibilă** — a doua postare actualizează, nu duplică (constrângerea unică).
3. **Schiță → PUBLISHED direct la trimiterea autorului** (fără coadă de acceptare, model eliminat 2026-06-30). Tranziții invalide → 409.
4. **Ștergerea unei schițe** = permisă autorului schiței SAU autorului detaliului-mamă (altcineva → 403).
5. **Upload detalii = orice user autentificat cu rol declarat.** De testat: neautentificat / fără rol → respins; moderare post-publicare (fără coadă de aprobare).
6. **Max 3 resurse** per detaliu (a 4-a → respinsă).
7. **Verificare rol:** doar admin aprobă (`DECLARED→PENDING→VERIFIED`); user normal nu poate auto-aproba.
8. **Polimorfism:** validare/comentariu funcționează identic pe Detail și pe Sketch.

---

## Scenarii de securitate (CRITICAL — authz)

- **IDOR:** user A nu poate edita/șterge validarea, comentariul sau schița lui user B.
- **Privilege escalation:** user normal nu accesează viitoare rute `/api/admin/*` (aprobare verificare rol etc.).
- **Deny-by-default:** orice rută `(app)` fără sesiune → 401 (nu 200, nu 404 mascat).
- **Authz corect:** rol greșit → 403, lipsă auth → 401 — **niciodată 404** ca să ascundă existența.
- **Magic link:** token expirat/folosit → respins; one-time use chiar e one-time.
- **Fără leak:** răspunsurile de eroare nu conțin stack-trace / SQL / căi.
- **Rate-limit:** endpoint-urile sensibile (login, mutații, upload, creare detaliu) limitate.

---

## Scenarii E2E (Playwright — fluxurile care contează)

```
E2E-1  Acces & onboarding (PUBLIC):
       creare cont (public, fără invitație) → login (magic link) → declară rol → ajunge în feed → vede nudge „rol neverificat"

E2E-2  Validare cu dezaprobare:
       deschide detaliu → Dezaprob fără text (blocat) → Dezaprob cu justificare →
       apare poziția + comentariul cu nume+rol → își retrage poziția (reversibil)

E2E-3  Schiță fork→PR (cap-coadă):
       intră în mod schiță (fill slab) → desenează → Trimite → autorul-mamă primește notificare →
       acceptă → schița devine PUBLISHED în teanc + are thumbnail

E2E-4  Verificare rol „pull" — ⏸️ PE HOLD (feature în regândire, nu se testează acum):
       user merge singur la verificare rol → trimite dovezi → admin aprobă → badge ⭐ apare lângă rol

E2E-5  Feed & filtre:
       feed arată ~20 detalii, fără infinite scroll; filtru pe categorie restrânge corect
```

---

## Ținte de acoperire (pragmatic, fază de validare)

- **Reguli de business + authz: acoperire cât mai aproape de completă** (sunt inima + CRITICAL).
- UI pur prezentațional: smoke/E2E, fără obsesie de coverage.
- **Definition of done pe feature CRITICAL:** unit + integration + security, authz testat explicit (IDOR, escalare).

---

## Cum rulează testele (după scaffold)

```bash
npm run test           # unit + integration (vitest)
npm run test:e2e       # Playwright (fluxurile E2E de mai sus)
```
> ⚠️ Teste verzi ≠ build verde: după schimbări de tipuri/schemă rulează și `npm run build` / `tsc --noEmit`
> (vitest ignoră erorile de tip; CI/deploy pică la type-check).
