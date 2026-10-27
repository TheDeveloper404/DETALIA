# DETALIA — Index documentație

Listă a documentelor din `docs/`, cu scopul fiecăruia. Codul e sursa de adevăr peste orice design doc —
la divergență, câștigă codul (excepție: `INCIDENTS.md` și `CHANGELOG.md`, care sunt jurnale istorice).

| Document | Scop |
|---|---|
| [ARHITECTURA.md](ARHITECTURA.md) | Arhitectură + plan de atac: stack, straturi, modelul de roluri, fazare/roadmap, deciziile de produs confirmate. Punctul de plecare pentru orice context tehnic nou. |
| [ADR.md](ADR.md) | Registru compact de decizii de arhitectură durabile (context → decizie → consecințe), formă scurtă, ușor de revizitat. |
| [SCHEMA.md](SCHEMA.md) | Proiectarea concretă a modelului de date (tabele, enum-uri, constrângeri, indici) — design doc; sursa de adevăr reală e `db/schema.ts`. |
| [SECURITATE.md](SECURITATE.md) | Starea curentă a securității: constatări deschise (DET-01…06), risc asumat, reguli de păstrat, ordine recomandată. Gitignored. |
| `securitate/2026-07-audituri.md`, `securitate/2026-08-audituri.md` | Istoricul auditurilor din iulie și august (toate constatările închise). Gitignored. |
| `faza-1-2.md`, `faza-3.md` | Rapoartele Codex faza 1–3 (2026-10-25), cu dovezi file:line. Negitignored — nu le include în commit. |
| `2026-08-10-ZAP-Report-.html`, `raport_pentest.html` | Rapoartele HTML ale scanului ZAP din 2026-08-10. Gitignored. |
| [PLAN-TESTE.md](PLAN-TESTE.md) | Strategia de testare (unit/E2E/security), suita reală de teste pe fișier, cum se rulează. |
| [EMAILURI.md](EMAILURI.md) | Copy-ul emailurilor trimise prin Resend (magic link, digest săptămânal, notificări), sincronizat cu `lib/email.ts`. |
| [DEPLOY.md](DEPLOY.md) | Infrastructură live: servicii third-party, separare medii dev/prod, backup/restore, reguli de release. |
| [CONFIDENTIALITATE-GDPR.md](CONFIDENTIALITATE-GDPR.md) | Notă de lucru GDPR: ce date se colectează, drepturile persoanei, schelet Notă de confidențialitate + ToS (nepublicate încă). |
| [BACKLOG.md](BACKLOG.md) | Ce e de făcut, pe scurt (Acum/Următor/Blocat/Idei) — nu ține detaliu tehnic, doar ce urmează. |
| [CHANGELOG.md](CHANGELOG.md) | Jurnal cronologic detaliat al modificărilor, cel mai recent sus. Istoric, nu se rescrie retroactiv. |
| [INCIDENTS.md](INCIDENTS.md) | Jurnal al incidentelor reale de producție (impact efectiv pe useri/date) — distinct de confuzii clarificate sau probleme fără impact vizibil. |
| [UI-REGISTRY.md](UI-REGISTRY.md) | Pattern-uri UI reutilizabile (modal, card, buton de pericol, pastilă de rol) — verifică ÎNAINTE de UI nou, actualizează DUPĂ o componentă nouă reutilizabilă. |

## Alte fișiere de context (în afara `docs/`)

| Fișier | Scop |
|---|---|
| `AGENTS.md` (rădăcina proiectului) | Instrucțiunile de proiect pentru agenți (Codex îl citește direct; `CLAUDE.md` doar îl importă). Capcanele pe zone stau în `.claude/rules/`. |
| `CONTEXT.md` (rădăcina proiectului) | Context de business/domeniu: ce este DETALIA, stack, glosar de domeniu, regulile de business non-negociabile, decizii de produs. |
| `.remember/remember.md` | Handoff „unde am rămas" — context viu + pași următori. Comprimat/rescris în timp; istoricul detaliat trăiește în `CHANGELOG.md`. |
| `LICENSE` (rădăcina proiectului) | Licență proprietară — toate drepturile rezervate, cod ne-open-source. |
