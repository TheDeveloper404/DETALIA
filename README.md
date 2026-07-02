# DETALIA

**Comunitatea profesională din construcții, organizată în jurul detaliului de execuție.**

DETALIA este o platformă colaborativă în care profesioniștii din proiectare, execuție, furnizare și administrarea construcțiilor pot publica, analiza și îmbunătăți detalii tehnice. Fiecare contribuție este asociată transparent unui rol profesional, iar un detaliu poate fi aprobat, contestat cu argumente sau completat printr-o schiță desenată peste el.

Modelul mental: **„GitHub pentru construcții"** — un detaliu este ca un repository, o schiță ca un fork, iar validarea pe roluri ca un code review.

## Ce oferă

- **Feed de detalii** filtrabil pe categorie, cu căutare simplă pe titlu.
- **Pagina de detaliu** cu imaginea tehnică, contextul autorului și dezbaterea.
- **Validare pe roluri** — Aprob (un click) sau Dezaprob (cu justificare obligatorie).
- **Schițare** peste un detaliu, direct în browser, cu unelte de desen vectorial.
- **Teanc de schițe** navigabil pentru fiecare detaliu.
- **Comentarii** legate de detaliu sau de schiță.
- **Notificări** in-app și pe email.
- **Profil** cu rol, subrol, poză și verificare opțională a rolului (badge).

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

Validările nu formează un scor anonim — rolul și argumentul persoanei rămân vizibile pentru cititor. Nu îți poți valida propriul conținut.

### 4. Propunerea unei schițe
Un utilizator poate desena peste imaginea unui detaliu și publica rezultatul:

```text
DRAFT → PUBLISHED
```

Schița se publică direct și intră în teancul public al detaliului. Fiecare schiță are un singur autor. Moderarea este post-publicare: schița poate fi ștearsă de autorul ei sau de autorul detaliului-mamă.

### 5. Dezbatere și notificări
Comentariile pot aparține unui detaliu sau unei schițe. Autorii primesc notificări în aplicație și pe email pentru evenimentele relevante (o schiță nouă peste detaliul lor, ștergeri etc.).

## Concepte

| Concept | Semnificație |
|---|---|
| **Detaliu** | Unitatea principală de conținut tehnic |
| **Schiță** | O propunere desenată peste detaliul inițial (un singur autor) |
| **Validare** | Poziția Aprob/Dezaprob a unui utilizator |
| **Teanc** | Colecția schițelor publicate ale unui detaliu |
| **Rol** | Contextul profesional al contributorului |
| **Dezbatere** | Comentariile asociate unui detaliu sau unei schițe |

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

Aplică schema bazei de date și, opțional, datele seed:

```bash
npm run db:migrate
npm run db:seed
```

Pornește aplicația:

```bash
npm run dev
```

Implicit disponibilă la [http://localhost:3000](http://localhost:3000).

## Scripturi utile

```bash
npm run dev           # server de dezvoltare
npm run build         # build de producție
npm run typecheck     # verificare de tipuri (tsc --noEmit)
npm run lint          # ESLint
npm run format:check  # verificare formatare (Prettier)
```

## Documentație

| Document | Conținut |
|---|---|
| [`docs/ARHITECTURA.md`](docs/ARHITECTURA.md) | Arhitectura și deciziile tehnice |
| [`docs/ADR.md`](docs/ADR.md) | Decizii de arhitectură și consecințe |
| [`docs/SCHEMA.md`](docs/SCHEMA.md) | Modelul bazei de date |
| [`docs/SECURITATE.md`](docs/SECURITATE.md) | Controale de securitate și audit |
| [`docs/UX-ECRANE.md`](docs/UX-ECRANE.md) | Ecrane, stări și fluxuri UX |
| [`docs/PLAN-TESTE.md`](docs/PLAN-TESTE.md) | Strategia și scenariile de testare |
| [`docs/CONFIDENTIALITATE-GDPR.md`](docs/CONFIDENTIALITATE-GDPR.md) | Confidențialitate și cerințe GDPR |
| [`docs/CHANGELOG.md`](docs/CHANGELOG.md) | Istoricul modificărilor |
