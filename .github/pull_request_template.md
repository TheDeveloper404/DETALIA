## Ce schimbă acest PR

<!-- Descriere scurtă: ce și de ce. -->

## Tip

- [ ] Feature
- [ ] Bug fix
- [ ] Refactor
- [ ] Security fix
- [ ] Docs

## Checklist

- [ ] **Documentația la zi** — `docs/CHANGELOG.md` + docul afectat. Dacă s-a schimbat modelul de date/API:
      actualizate `docs/SCHEMA.md` / `docs/API.md` (sau marcat că **codul e sursa de adevăr** și docul rămâne design).
- [ ] **Build verde local** — `next build` / `tsc --noEmit` (NU doar testele; vitest ignoră erorile de tip).
- [ ] **Teste** relevante adăugate/actualizate (business + authz la CRITICAL — IDOR, escaladare).
- [ ] **Securitate** — fără secrete în cod; PII neloggat; validare pe server; deny-by-default.
- [ ] **Reguli de business enforce pe SERVER** (nu doar pe frontend).
- [ ] Branch = `dev` (niciodată push direct pe `main`).

## Cum se testează

<!-- Pași + rezultat așteptat. -->

## Securitate

<!-- Note auth / validare / date, sau "None". -->
