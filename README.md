# DETALIA

**Comunitatea profesională din construcții, organizată în jurul detaliului de execuție.**

DETALIA este o platformă colaborativă în care profesioniștii din proiectare, execuție, furnizare și administrarea construcțiilor pot publica, analiza și îmbunătăți detalii tehnice. Fiecare contribuție este asociată transparent unui rol profesional, iar un detaliu poate fi aprobat, contestat cu argumente sau completat printr-o schiță desenată peste el.

Modelul mental: **„StackOverflow pentru construcții"** — un detaliu este ca o întrebare/postare, o schiță este un răspuns, iar validarea pe roluri e votul comunității.

## Ce oferă

- **Feed de detalii** filtrabil pe categorie (inclusiv pe mobil, printr-un filtru dedicat), cu căutare simplă pe titlu.
- **Pagina de detaliu** cu imaginea tehnică, contextul autorului și dezbaterea.
- **Validare pe roluri** — Aprob (un click) sau Dezaprob (cu justificare obligatorie).
- **Schițare** peste un detaliu, direct în browser, cu unelte de desen vectorial.
- **Teanc de schițe** navigabil pentru fiecare detaliu.
- **Comentarii** legate de detaliu sau de schiță, cu reacții (emoji) și aprecieri.
- **Planșă privată** — un canvas personal (schițe/adnotări), separat de teancul public al unui detaliu, vizibil DOAR proprietarului.
- **Proiecte** — spații de colaborare restrânsă între Autor și Invitați, cu detalii publicate direct în proiect (private până sunt „scoase în comunitate").
- **Oferte de la furnizori** — un furnizor verificat poate trimite o ofertă reală pe un detaliu (mesaj + fișiere PDF/Excel/CSV), vizibilă strict autorului detaliului, care e notificat.
- **Detalii salvate** și **oferte proprii**, ca liste private, separate de feed.
- **Notificări** in-app (canalul email există în cod, dezactivat implicit).
- **Profil public** cu rol, subrol, poză, dată de înscriere („Membru din …"), verificare opțională a rolului și **badge-uri de reputație** (Bronz/Argint/Aur, calculate din activitate — publicări, schițe, validări date/primite), cu pop-up de celebrare la primirea unui badge nou.
- **Referral** — fiecare user are un link propriu de invitație; la 10 useri aduși prin el primește badge-ul „Creștem împreună".

## Cum funcționează

### 1. Identitate profesională
Utilizatorul intră prin **magic link** (fără parolă) și își declară rolul principal — Proiectant, Executant, Furnizor sau Beneficiar — plus o specializare. Rolul este afișat lângă validări, comentarii și schițe, ca opiniile să fie citite în context.

### 2. Publicarea unui detaliu
Un detaliu conține o imagine tehnică, titlu, descriere, categorie, context climatic/seismic opțional și resurse opționale (imagine, link, PDF, text). După publicare apare în feed și are propria pagină de analiză. Orice utilizator autentificat cu rol declarat poate publica.

### 3. Validarea pe roluri
Membrii comunității pot:
- **aproba** un detaliu sau o schiță (un click);
- **dezaproba** numai împreună cu o justificare, care devine automat un comentariu;
- retrage sau schimba ulterior propria poziție (o singură poziție per țintă).

Validările nu formează un scor anonim — rolul și argumentul persoanei rămân vizibile pentru cititor. Poți vota și pe propriul conținut.

### 4. Propunerea unei schițe
Un utilizator poate desena peste imaginea unui detaliu și publica rezultatul:

```text
DRAFT → PUBLISHED
```

Schița se publică direct și intră în teancul public al detaliului. Fiecare schiță are un singur autor. Moderarea este post-publicare: schița poate fi ștearsă de autorul ei sau de autorul detaliului-mamă.

### 5. Dezbatere și notificări
Comentariile pot aparține unui detaliu sau unei schițe. Autorii primesc notificări în aplicație pentru evenimentele relevante (o schiță nouă peste detaliul lor, ștergeri etc.) — canalul email există în cod dar e dezactivat implicit.

### 6. Proiecte
Un utilizator poate crea un Proiect și invita alți membri printr-un link de copiat (fără email automat). În interiorul unui proiect, membrii (Autor + Invitați — aceleași drepturi) publică detalii vizibile DOAR între ei; un detaliu poate fi ulterior „scos în comunitate" (devine public, în feed-ul general). Accesul e verificat strict pe server la fiecare citire, indiferent de calea prin care se ajunge la conținut (feed, profil, notificări).

### 7. Planșă privată
Independent de teancul public al unui detaliu, fiecare utilizator are propriul spațiu de desen (Planșă) — un canvas privat, cu istoric de undo/redo, folosit pentru notițe/adnotări proprii. Nu e vizibil altor useri sub nicio formă.

### 8. Reputație
Fiecare utilizator acumulează badge-uri (Bronz/Argint/Aur) calculate LIVE din activitate — nu sunt stocate separat, ci derivate din statistici existente (detalii publicate, schițe, validări date/primite). La atingerea unui prag nou, userul primește un pop-up de celebrare o singură dată; badge-urile sunt vizibile pe profilul public al oricui.

## Concepte

| Concept | Semnificație |
|---|---|
| **Detaliu** | Unitatea principală de conținut tehnic |
| **Schiță** | O propunere desenată peste detaliul inițial (un singur autor) |
| **Validare** | Poziția Aprob/Dezaprob a unui utilizator |
| **Teanc** | Colecția schițelor publicate ale unui detaliu |
| **Rol** | Contextul profesional al contributorului |
| **Dezbatere** | Comentariile asociate unui detaliu sau unei schițe |
| **Proiect** | Spațiu de colaborare restrânsă (Autor + Invitați) pentru detalii private, publicabile ulterior în comunitate |
| **Planșă** | Canvas privat de desen al unui utilizator, separat de teancul public de schițe |
| **Badge** | Nivel de reputație (Bronz/Argint/Aur) calculat din activitate, afișat pe profilul public |

## Stack tehnic

| Strat | Tehnologie |
|---|---|
| Aplicație full-stack | Next.js App Router + React |
| Business logic | TypeScript, izolat în `server/` |
| Bază de date | Neon Postgres + Drizzle ORM |
| Autentificare | Auth.js — magic link passwordless (Resend) |
| Stocare fișiere | Vercel Blob |
| UI | Tailwind CSS + shadcn/ui |
| Schițare | HTML Canvas + `perfect-freehand` |
| Hosting | Vercel |

Este o singură aplicație full-stack: Server Components și Server Actions gestionează interfața și mutațiile, iar regulile de business stau în servicii și repository-uri, separate de UI.

## Structura proiectului

```text
detalia/
├── app/          # pagini, layouturi, route handlers și Server Actions
├── components/   # componente UI și canvasul de schițare
├── server/
│   ├── domain/   # reguli și tipuri de domeniu
│   ├── services/ # business logic și autorizare
│   └── repos/    # acces la baza de date
├── db/           # schema Drizzle, migrații și seed
├── lib/          # auth, email, storage și utilitare
├── e2e/          # teste Playwright (E2E)
├── public/       # asseturi statice
└── docs/         # documentația produsului și a implementării
```

## Rulare locală

### Cerințe
- Node.js LTS și npm;
- o bază de date PostgreSQL/Neon;
- credențiale Resend pentru autentificarea prin email;
- un store Vercel Blob pentru uploaduri.

### Pași

```bash
npm install
```

Copiază template-ul de configurare și completează valorile:

```powershell
Copy-Item .env.example .env.local
```

Variabile minime necesare:

```text
DATABASE_URL
AUTH_SECRET
AUTH_URL
AUTH_RESEND_KEY
EMAIL_FROM
BLOB_READ_WRITE_TOKEN
```

Baza de date de dezvoltare e o ramură Neon existentă (nu se creează schema local cu `db:push`/
`db:migrate` — vezi caveat-ul de mai jos); cere `DATABASE_URL` de la echipă. Opțional, populează date
de test:

```bash
npm run db:seed
```

Pornește aplicația:

```bash
npm run dev
```

Implicit disponibilă la [http://localhost:3000](http://localhost:3000).

## Scripturi utile

```bash
npm run dev             # server de dezvoltare
npm run build           # build de producție
npm run typecheck       # verificare de tipuri (tsc --noEmit)
npm run lint            # ESLint
npm run format:check    # verificare formatare (Prettier)
npm run test            # teste unitare/integrare (Vitest)
npm run e2e             # teste E2E (Playwright) — vezi docs/PLAN-TESTE.md
npm run check:subqueries  # gardă anti-bug pentru subquery-uri Drizzle corelate (server/repos)
```

> Migrațiile de schemă (`db:generate`/`db:push`/`db:migrate`) NU se rulează din terminal pe acest
> proiect — baza de date e Neon (dev + producție, ramuri separate), iar orice schimbare de schemă
> trece prin SQL brut, rulat manual în Neon SQL Editor pe ambele ramuri (vezi `docs/DEPLOY.md`).

## Documentație

| Document | Conținut |
|---|---|
| [`docs/README.md`](docs/README.md) | Index complet al documentației, cu scopul fiecărui document |
| [`docs/ARHITECTURA.md`](docs/ARHITECTURA.md) | Arhitectura și deciziile tehnice |
| [`docs/ADR.md`](docs/ADR.md) | Decizii de arhitectură și consecințe |
| [`docs/SCHEMA.md`](docs/SCHEMA.md) | Modelul bazei de date |
| [`docs/SECURITATE.md`](docs/SECURITATE.md) | Controale de securitate și audit |
| [`docs/PLAN-TESTE.md`](docs/PLAN-TESTE.md) | Strategia și scenariile de testare |
| [`docs/QA_TEST_CASES.md`](docs/QA_TEST_CASES.md) | Cazuri de test funcționale, pe funcție |
| [`docs/MANUAL_UTILIZATOR.md`](docs/MANUAL_UTILIZATOR.md) | Manual pentru useri finali |
| [`docs/DEPLOY.md`](docs/DEPLOY.md) | Infrastructură, medii, backup/restore, reguli de release |
| [`docs/CONFIDENTIALITATE-GDPR.md`](docs/CONFIDENTIALITATE-GDPR.md) | Confidențialitate și cerințe GDPR |
| [`docs/INCIDENTS.md`](docs/INCIDENTS.md) | Incidente reale de producție |
| [`docs/BACKLOG.md`](docs/BACKLOG.md) | Ce e de făcut, pe scurt |
| [`docs/CHANGELOG.md`](docs/CHANGELOG.md) | Istoricul modificărilor |
