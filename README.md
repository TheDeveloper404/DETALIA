# DETALIA

> **Comunitatea profesională din construcții, organizată în jurul detaliului de execuție.**
> Modelul mental: **„GitHub pentru construcții"** — detaliu = repo, schiță = fork+PR, validare = code review.

Fiecare detaliu de execuție poate fi **aprobat**, **contestat cu argument** și **îmbunătățit prin schiță** —
de către cei care îl proiectează, îl execută sau îl trăiesc, fiecare cu **rolul afișat transparent** lângă nume.

---

## Stadiul proiectului

**Fază: validare de piață.** Obiectiv: cost cât mai aproape de **$0**, livrare rapidă, fundație curată care
suportă creșterea fără rescriere. Lansare = **beta închis** (acces controlat), cu conținut seed pus de noi.

> ⚠️ **Pre-scaffold.** Momentan repo-ul conține **planificarea** (docs + reguli de proiect). Codul aplicației
> (Next.js) se generează în **Faza 0**. Secțiunile „Rulare locală" de mai jos descriu setup-ul **țintă**,
> nu unul deja funcțional.

Întrebarea pe care MVP-ul o testează: *dacă pun în fața specialiștilor un detaliu bun, se aprinde dezbaterea pe roluri?*

---

## Stack

| Strat | Tehnologie |
|---|---|
| Framework | **Next.js (App Router)** — UI + API într-un singur produs |
| Hosting | **Vercel** |
| Bază de date | **Neon Postgres** (serverless) + **Drizzle** (ORM) |
| Auth | **Auth.js v5** — magic link (passwordless) |
| Email | **Resend** |
| Stocare | **Vercel Blob** (imagini detalii + thumbnail-uri schiță) |
| Canvas schiță | **HTML5 Canvas + `perfect-freehand`** (stroke-uri vectoriale) |

Decizie: **single-app**, nu monorepo cu backend separat (motivare în `docs/ARHITECTURA.md §2`). Logica de
business stă izolată în `server/`, ca extragerea spre un API separat să fie posibilă ulterior fără rescriere.

---

## Structura (țintă)

```
detalia/
├─ app/          # Next.js App Router: pagini (UI) + route handlers (API) + server actions — SUBȚIRI
├─ server/       # STRATUL DE BUSINESS — domain/ (entități, roluri, state machines) · services/ · repos/
├─ db/           # schema Drizzle + migrații
├─ components/   # UI (inclusiv canvas-ul de schițare)
├─ lib/          # auth, email, storage, utils
└─ docs/         # arhitectură, plan nontehnic, changelog
```

Regula de aur: **zero logică de business în route handlers / componente.** Mutațiile trec prin `server/services`.

---

## Rulare locală (țintă — disponibilă după Faza 0)

```bash
# 1. instalează dependențele
npm install

# 2. configurează variabilele de mediu (vezi .env.example)
cp .env.example .env.local
#    completează valorile (DATABASE_URL, AUTH_SECRET, RESEND_API_KEY, ...)

# 3. aplică schema pe DB
npm run db:push        # sau db:migrate

# 4. pornește serverul de dezvoltare
npm run dev            # http://localhost:3000
```

Variabilele de mediu necesare sunt documentate în **`.env.example`**. Secretele reale **nu** se comit niciodată
— stau în `vercel env` / `.env.local` (ignorat de git).

---

## Documentație

| Document | Ce conține |
|---|---|
| [`docs/ARHITECTURA.md`](docs/ARHITECTURA.md) | Plan tehnic complet: stack, model de date, straturi, securitate, fazare. |
| [`docs/PLAN-EXECUTIE.md`](docs/PLAN-EXECUTIE.md) | Planul de execuție MVP: faze, servicii terțe, pași, dependențe, ce blochează ce. |
| [`docs/ADR.md`](docs/ADR.md) | Deciziile de arhitectură (formă scurtă): context → decizie → consecințe. |
| [`docs/SCHEMA.md`](docs/SCHEMA.md) | Proiectarea concretă a bazei de date (tabele, enum-uri, constrângeri, indici). |
| [`docs/API.md`](docs/API.md) | Contractul API: inventarul endpoint-urilor + reguli enforce pe server. |
| [`docs/UX-ECRANE.md`](docs/UX-ECRANE.md) | Inventar de ecrane + flow-uri UX + stările obligatorii (empty/loading/error). |
| [`docs/EMAILURI.md`](docs/EMAILURI.md) | Copy-ul emailurilor (magic link, invitație, notificări schiță). |
| [`docs/PLAN-SEED.md`](docs/PLAN-SEED.md) | Planul de conținut seed pentru lansare = instrumentul de validare. |
| [`docs/PLAN-TESTE.md`](docs/PLAN-TESTE.md) | Strategia de teste + scenariile critice (business, securitate, E2E). |
| [`docs/CONFIDENTIALITATE-GDPR.md`](docs/CONFIDENTIALITATE-GDPR.md) | Notă GDPR + schelet confidențialitate/ToS (de finalizat înainte de public). |
| [`docs/plan nontehnic.md`](docs/plan%20nontehnic.md) | Varianta non-tehnică (pentru discuții de produs) + întrebări deschise. |
| [`docs/CHANGELOG.md`](docs/CHANGELOG.md) | Jurnal de decizii și modificări, cu dată (cel mai recent sus). |
| [`CLAUDE.md`](CLAUDE.md) | Glosar de domeniu + reguli de business non-negociabile + convenții de cod. |
| `documente_client/` | Materialele originale de la client (Document Fundamental, Specificație MVP, răspunsuri). |

**Glosar rapid:** **Detaliu** = unitatea de conținut (~repo) · **Schiță** = foaie desenată peste un detaliu,
un singur autor (~fork+PR) · **Validare** = poziție (Aprob / Dezaprob cu justificare) pe un detaliu sau o schiță ·
**Teanc** = totalitatea schițelor publicate ale unui detaliu.

---

## Flux de lucru (contributori)

- `main` = **producție**. `dev` = branch permanent de pre-producție.
- Tot codul: pe `dev` → **Pull Request** → merge în `main`. Niciodată push direct pe `main`.
- Testele sunt rulate de om (marker `HUMAN_RUNS_TESTS`). `tsc --noEmit` / `next build` pot rula automat.

---

## Status

🚧 **În construcție** — repo privat, beta închis. Proiect în fază de validare de piață.
