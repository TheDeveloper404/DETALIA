# DETALIA

> **Comunitatea profesională din construcții, organizată în jurul detaliului de execuție.**
> Modelul mental intern: *„GitHub pentru construcții"* — detaliu = repo, schiță = fork+PR, validare = code review.
> (Metaforă pentru noi, dezvoltatorii — **nu** apare în UI; publicul din construcții nu o cunoaște.)

Fiecare detaliu de execuție poate fi **aprobat**, **contestat cu argument** și **îmbunătățit prin schiță** —
de cei care îl proiectează, îl execută sau îl trăiesc, fiecare cu **rolul afișat transparent** lângă nume.

Întrebarea pe care MVP-ul o testează: *dacă pun în fața specialiștilor un detaliu bun, se aprinde dezbaterea pe roluri?*

---

## 🧭 Start aici

- **Ce e gata / ce nu** → secțiunea [Stare la zi](#-stare-la-zi) de mai jos.
- **Istoric detaliat cu dată** → [`docs/CHANGELOG.md`](docs/CHANGELOG.md) (cel mai recent sus). **Sursa de adevăr pentru „ce s-a făcut".**
- **Reguli de domeniu + business + convenții** → [`CLAUDE.md`](CLAUDE.md).
- **Unde am rămas (briefing de sesiune)** → [`.remember/remember.md`](.remember/remember.md).
- **Restul docurilor** (design/spec) → harta din secțiunea [Documentație](#documentație).

> ⚠️ Design-docs (SCHEMA, API, ARHITECTURA…) descriu **intenția**. La orice divergență, **codul câștigă** —
> sursa de adevăr e codul + CHANGELOG, nu design-doc-ul.

---

## 📊 Stare la zi

**Fază: validare de piață** (cost ~$0, fundație curată). **Acces PUBLIC** — înregistrare liberă, fără invitație (decizie Edi, iunie 2026).

**MVP-ul e funcțional complet în cod și verde** (`typecheck` + `lint` + `build`). Lipsesc doar **credențialele + conținutul seed** ca să *ruleze*.

### ✅ Făcut (detaliu cu dată → CHANGELOG)
| Zonă | Stare |
|---|---|
| **Fundație** | schelet Next.js, schema DB (13 tabele + migrația `0000`), `proxy.ts` deny-by-default, CI verde |
| **Auth & acces** | passwordless: **magic link (Resend) + Google OAuth**; `/signup` public, `/login`, onboarding rol+subrol+poză; admin allowlist (`ADMIN_EMAILS`) |
| **Inima** | „Adaugă detaliu" (upload Blob), feed finit ~20 + filtre, pagina detaliu, **validare pe roluri** (Aprob/Dezaprob cu justificare), comentarii |
| **Schițare** | end-to-end: canvas `perfect-freehand`, state machine DRAFT→PENDING→PUBLISHED/REJECTED, teanc, accept/respinge, **notificări in-app + email**, dezbatere pe schiță |
| **Profil** | editare poză/rol; cerere de verificare rol (latura user) |
| **Design/UI** | migrare completă pe **shadcn/ui** (toate suprafețele, tokeni de temă) |

### ⏳ Blochează *rularea*, nu codul (de la Edi/Liviu)
`DATABASE_URL` (Neon) · `AUTH_RESEND_KEY` + domeniu verificat · `AUTH_GOOGLE_ID/SECRET` · `BLOB_READ_WRITE_TOKEN` ·
**conținut seed** (Edi) · **verificare vizuală a designului** în browser (la prima rulare).

### ⛔ Placeholder / neînceput
- **Verificare rol — latura admin** (aprobare `PENDING → VERIFIED`): inexistentă. Metoda e **în regândire** ca să fie fără frecare/birocrație — nu o cabla până nu vine decizia.
- **Landing nou**: în lucru pe Claude Design (cel din cod e provizoriu).
- Datorii tehnice mici: paginare comentarii, filtru categorii arbore, rol atașat în session callback, audit formal 13-cat pe inimă.

### 🔮 Backlog (post-MVP)
Search semantic (pgvector) · scoring/reputație · unelte schiță avansate (Line/Circle/Arrow/text) · co-desenare real-time · verificare automată rol (OAR/CUI).

---

## Stack

| Strat | Tehnologie |
|---|---|
| Framework | **Next.js (App Router)** — UI + API într-un singur produs |
| Hosting | **Vercel** |
| Bază de date | **Neon Postgres** (serverless) + **Drizzle** (ORM) |
| Auth | **Auth.js v5** — **magic link (Resend) + Google OAuth**, passwordless |
| Email | **Resend** (magic link + notificări) |
| Stocare | **Vercel Blob** (imagini detalii + thumbnail-uri schiță) |
| UI | **shadcn/ui** + Tailwind v4 (tokeni de temă) |
| Canvas schiță | **HTML5 Canvas + `perfect-freehand`** (stroke-uri vectoriale) |

Decizie: **single-app**, nu monorepo cu backend separat (motivare în `docs/ARHITECTURA.md §2`). Logica de
business stă izolată în `server/`, ca extragerea spre un API separat să fie posibilă ulterior fără rescriere.

---

## Structura

```
detalia/
├─ app/          # Next.js App Router: pagini (UI) + route handlers (API) + server actions — SUBȚIRI
├─ server/       # STRATUL DE BUSINESS — domain/ (entități, roluri, state machines) · services/ · repos/
├─ components/   # UI (shadcn în components/ui/ + canvas-ul de schițare)
├─ db/           # schema Drizzle + migrații
├─ lib/          # auth, email, storage, utils
└─ docs/         # arhitectură, planuri, changelog, spec
```

Regula de aur: **zero logică de business în route handlers / componente.** Mutațiile trec prin `server/services`.

---

## Rulare locală

```bash
# 1. dependențe
npm install

# 2. variabile de mediu (vezi .env.example)
cp .env.example .env.local
#    completează: DATABASE_URL, AUTH_SECRET, AUTH_RESEND_KEY, AUTH_GOOGLE_ID/SECRET, BLOB_READ_WRITE_TOKEN, ADMIN_EMAILS

# 3. schema pe DB (cere DATABASE_URL)
npm run db:push        # apoi: npm run db:seed

# 4. server de dezvoltare
npm run dev            # http://localhost:3000
```

**Fără credențiale:** paginile publice (`/`, `/login`, `/signup`) randează dacă setezi doar `AUTH_SECRET` în `.env.local`
(generează cu `npx auth secret`). Restul ecranelor cer sesiune → au nevoie de `DATABASE_URL` + Resend/Google.
Secretele reale **nu** se comit niciodată — stau în `vercel env` / `.env.local` (ignorat de git).

---

## Documentație

**Sursa de adevăr pentru „ce s-a făcut": [`docs/CHANGELOG.md`](docs/CHANGELOG.md).** Restul sunt design/spec (intenție):

| Document | Ce conține |
|---|---|
| [`docs/CHANGELOG.md`](docs/CHANGELOG.md) | **Jurnal de modificări cu dată** (cel mai recent sus). |
| [`docs/PLAN-EXECUTIE.md`](docs/PLAN-EXECUTIE.md) | Faze MVP + servicii terțe + dependențe + ce blochează ce (cu status per fază). |
| [`docs/ARHITECTURA.md`](docs/ARHITECTURA.md) | Plan tehnic complet: stack, model de date, straturi, securitate, fazare. |
| [`docs/ADR.md`](docs/ADR.md) | Decizii de arhitectură (context → decizie → consecințe). |
| [`docs/SCHEMA.md`](docs/SCHEMA.md) | Proiectarea bazei de date (tabele, enum-uri, constrângeri, indici). *Design doc.* |
| [`docs/API.md`](docs/API.md) | Contractul API: endpoint-uri + reguli enforce pe server. *Design doc.* |
| [`docs/SECURITATE.md`](docs/SECURITATE.md) | Matrice de protecție per endpoint + 13 categorii + porți per fază. |
| [`docs/UX-ECRANE.md`](docs/UX-ECRANE.md) | Inventar ecrane + flow-uri + stările obligatorii (empty/loading/error). |
| [`docs/EMAILURI.md`](docs/EMAILURI.md) | Copy-ul emailurilor (magic link, notificări schiță). |
| [`docs/PLAN-SEED.md`](docs/PLAN-SEED.md) | Planul de conținut seed (instrumentul de validare). |
| [`docs/PLAN-TESTE.md`](docs/PLAN-TESTE.md) | Strategia de teste + scenariile critice. |
| [`docs/CONFIDENTIALITATE-GDPR.md`](docs/CONFIDENTIALITATE-GDPR.md) | Notă GDPR + schelet confidențialitate/ToS (de finalizat înainte de public). |
| [`docs/plan nontehnic.md`](docs/plan%20nontehnic.md) | Varianta non-tehnică (discuții de produs) + întrebări deschise. |
| `documente_client/` | Materialele originale de la client (Document Fundamental, Specificație MVP, răspunsuri). |

**Glosar rapid:** **Detaliu** = unitatea de conținut (~repo) · **Schiță** = foaie desenată peste un detaliu, un
singur autor (~fork+PR) · **Validare** = poziție (Aprob / Dezaprob cu justificare) pe un detaliu sau o schiță ·
**Teanc** = totalitatea schițelor publicate ale unui detaliu · **Rol** = Proiectant / Executant / Furnizor / Beneficiar.

---

## Flux de lucru (contributori)

- `main` = **producție**. `dev` = branch permanent de pre-producție.
- Tot codul: pe `dev` → **Pull Request** → merge în `main`. Niciodată push direct pe `main`.
- Testele sunt rulate de om (marker `HUMAN_RUNS_TESTS`). `tsc --noEmit` / `next build` pot rula automat.
- Documentația = parte din Definition of Done: orice set de modificări actualizează `CHANGELOG.md` + docul afectat + handoff-ul.

---

🚧 **Repo privat, fază de validare de piață.** Stare detaliată mai sus; istoric cu dată în [`docs/CHANGELOG.md`](docs/CHANGELOG.md).
