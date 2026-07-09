# DETALIA — Index documentație

Listă a documentelor din `docs/`, cu scopul fiecăruia. Codul e sursa de adevăr peste orice design doc —
la divergență, câștigă codul (excepție: `INCIDENTS.md` și `CHANGELOG.md`, care sunt jurnale istorice).

| Document | Scop |
|---|---|
| [ARHITECTURA.md](ARHITECTURA.md) | Arhitectură + plan de atac: stack, straturi, modelul de roluri, fazare/roadmap, deciziile de produs confirmate. Punctul de plecare pentru orice context tehnic nou. |
| [ADR.md](ADR.md) | Registru compact de decizii de arhitectură durabile (context → decizie → consecințe), formă scurtă, ușor de revizitat. |
| [SCHEMA.md](SCHEMA.md) | Proiectarea concretă a modelului de date (tabele, enum-uri, constrângeri, indici) — design doc; sursa de adevăr reală e `db/schema.ts`. |
| [SECURITATE.md](SECURITATE.md) | Sursa unică de adevăr pentru securitate: auditul CRITICAL (13 categorii) + auditurile de follow-up (intern + extern black-box Codex) + nota onestă de ansamblu, într-un singur document. |
| [PLAN-TESTE.md](PLAN-TESTE.md) | Strategia de testare (unit/E2E/security), suita reală de teste pe fișier, cum se rulează. |
| [EMAILURI.md](EMAILURI.md) | Copy-ul emailurilor trimise prin Resend (magic link + notificări), sincronizat cu `lib/email.ts`. |
| [DEPLOY.md](DEPLOY.md) | Infrastructură live: servicii third-party, separare medii dev/prod, backup/restore, reguli de release. |
| [CONFIDENTIALITATE-GDPR.md](CONFIDENTIALITATE-GDPR.md) | Notă de lucru GDPR: ce date se colectează, drepturile persoanei, schelet Notă de confidențialitate + ToS (nepublicate încă). |
| [PLAN-SEED.md](PLAN-SEED.md) | Plan de conținut de start (seed): ce detalii se pun la lansare, cine le pune, cum se măsoară succesul. |
| [evaluare-mvp.md](evaluare-mvp.md) | Evaluare de prod-readiness pe capitole (securitate, performanță, testare, observabilitate etc.), cu pași concreți de îmbunătățire. |
| [MANUAL_UTILIZATOR.md](MANUAL_UTILIZATOR.md) | Manual de utilizare pentru useri finali — flux, funcționalități, întrebări frecvente. |
| [CHANGELOG.md](CHANGELOG.md) | Jurnal cronologic detaliat al modificărilor, cel mai recent sus. Istoric, nu se rescrie retroactiv. |
| [INCIDENTS.md](INCIDENTS.md) | Jurnal al incidentelor reale de producție (impact efectiv pe useri/date) — distinct de confuzii clarificate sau probleme fără impact vizibil. |

## Alte fișiere de context (în afara `docs/`)

| Fișier | Scop |
|---|---|
| `CLAUDE.md` (rădăcina proiectului) | Instrucțiuni de proiect: glosar de domeniu, reguli de business non-negociabile, arhitectură pe straturi, flux de lucru per task. |
| `.remember/remember.md` | Handoff „unde am rămas" — context viu + pași următori. Comprimat/rescris în timp; istoricul detaliat trăiește în `CHANGELOG.md`. |
| `LICENSE` (rădăcina proiectului) | Licență proprietară — toate drepturile rezervate, cod ne-open-source. |
