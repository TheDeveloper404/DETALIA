# Incidente — DETALIA

> Jurnal scurt al incidentelor REALE de producție (nu confuzii clarificate, nu discuții — doar ce a afectat
> efectiv userii sau datele). Handoff-ul (`.remember/remember.md`) se rescrie/comprimă în timp; aici rămâne
> istoricul, ca referință peste luni. 3-5 rânduri per incident, nu o reconstituire completă — detaliul tehnic
> complet, dacă există, stă în CHANGELOG/commit-uri.

Format per intrare:

```
## AAAA-LL-ZZ — titlu scurt
- Ce s-a întâmplat: ...
- Cauza reală (verificată, nu ipoteză): ...
- Impact: ...
- Fix / ce s-a schimbat ca să nu se repete: ...
```

---

## 2026-07-27 — panoul de admin inaccesibil în producție (buclă de redirect), din 23 iulie
- Ce s-a întâmplat: orice intrare pe `/admin-page` cu sesiune de admin validă intra în buclă infinită de
  redirect (`ERR_TOO_MANY_REDIRECTS`). Descoperit 27 iulie, prin testul e2e `admin-suspend.spec.ts` care
  pica și cu un singur worker (deci nu era flaky). Prezent în producție de la merge-ul din 23 iulie.
- Cauza reală (verificată în trace-ul Playwright + cod, nu ipoteză): SEC-001 a migrat token-urile de admin
  la hash SHA-256 în DB, dar commit-ul `5b542fc` a actualizat **doar** `lib/admin-auth.ts` (o linie).
  Poarta centralizată de admin din `proxy.ts` (existentă din 30 iunie, `0033574`) a rămas să caute în
  `admin_sessions` cu tokenul **brut** din cookie, într-o coloană care stochează hash-ul → nu recunoștea
  nicio sesiune și redirecta la login (302), iar pagina de login (care hash-uia corect) redirecta înapoi
  la panou (307). Trace-ul arată exact alternanța 302/307.
- Impact: adminii nu puteau intra în panou deloc timp de 4 zile (moderare, suspendări, comutatorul de
  mentenanță — toate inaccesibile). Userii normali neafectați; fără expunere de date — poarta era prea
  strictă, nu prea permisivă.
- Fix / ce s-a schimbat ca să nu se repete: `proxy.ts` hash-uiește acum tokenul înainte de căutare, iar
  `hashToken()` a fost mutat în modulul propriu `lib/admin-token-hash.ts` (importabil și din proxy, care
  nu poate încărca `admin-auth.ts` din cauza lui `next/headers`) — o singură sursă a hash-ului, ca să nu
  mai poată diverge. **Lecția de proces:** când fix-ul din 23 iulie a spart testul e2e de admin, concluzia
  a fost „fixture învechit"; fixture-urile chiar erau greșite și s-au reparat, dar nu s-a re-rulat suita,
  iar testul continua să semnaleze bug-ul REAL rămas în `proxy.ts`. Un test care pică după un fix nu e
  automat un fixture stricat — se re-rulează până e verde, `tsc`+`lint` nu acoperă asta.
