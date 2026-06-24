# DETALIA

**Comunitatea profesională din construcții, organizată în jurul detaliului de execuție.**

DETALIA este o platformă colaborativă în care profesioniștii din proiectare, execuție, furnizare și administrarea construcțiilor pot publica, analiza și îmbunătăți detalii tehnice.

Fiecare contribuție este asociată transparent unui rol profesional. Un detaliu poate fi aprobat, contestat cu argumente sau completat printr-o schiță propusă autorului.

## De ce DETALIA

Cunoștințele despre execuție sunt răspândite între proiectanți, constructori, furnizori și beneficiari. Aceeași soluție poate fi corectă pe planșă, dificilă în șantier sau dependentă de un material specific.

DETALIA aduce aceste perspective în același loc:

- contextul profesional este vizibil lângă fiecare contribuție;
- dezaprobarea cere o justificare, nu doar un vot negativ;
- alternativele pot fi desenate direct peste detaliul inițial;
- autorul decide ce schițe intră în teancul public;
- discuția rămâne legată de detaliul sau schița analizată.

## Cum funcționează

### 1. Identitate profesională

Utilizatorul intră prin magic link și își declară rolul principal:

- Proiectant;
- Executant;
- Furnizor;
- Beneficiar.

Rolul și specializarea sunt afișate lângă validări, comentarii și schițe, astfel încât opiniile să poată fi înțelese în context.

### 2. Publicarea unui detaliu

Un detaliu conține o imagine tehnică, titlu, descriere, categorie, context climatic/seismic și resurse opționale. După publicare, acesta apare în feed și are propria pagină de analiză.

### 3. Validarea pe roluri

Membrii comunității pot:

- **aproba** un detaliu sau o schiță;
- **dezaproba** numai împreună cu o justificare;
- retrage sau schimba ulterior propria poziție.

Validările nu formează un scor anonim. Rolul și argumentul persoanei rămân vizibile pentru cititor.

### 4. Propunerea unei schițe

Un utilizator poate desena peste imaginea unui detaliu și trimite rezultatul autorului. Schița urmează un flux asincron:

```text
DRAFT → PENDING_ACCEPTANCE → PUBLISHED | REJECTED
```

Doar autorul schiței o poate edita și trimite. Doar autorul detaliului inițial o poate accepta sau respinge.

### 5. Dezbatere și notificări

Comentariile pot aparține unui detaliu sau unei schițe. Autorii primesc notificări în aplicație și, când serviciul de email este configurat, notificări prin email pentru propunerile și deciziile legate de schițe.

## Conceptele produsului

| Concept | Semnificație |
|---|---|
| **Detaliu** | Unitatea principală de conținut tehnic |
| **Validare** | Poziția Aprob/Dezaprob a unui utilizator |
| **Schiță** | O propunere desenată peste detaliul inițial |
| **Teanc** | Colecția schițelor acceptate pentru un detaliu |
| **Rol** | Contextul profesional al contributorului |
| **Dezbatere** | Comentariile asociate unui detaliu sau unei schițe |

## Principii

- **Argument înaintea scorului.** Dezaprobarea nu poate fi anonimă sau nejustificată.
- **Context profesional transparent.** Rolul explică perspectiva, fără a înlocui argumentul.
- **Colaborare asincronă.** Fiecare schiță are un singur autor; nu există co-editare în timp real în MVP.
- **Autorul păstrează controlul.** O schiță devine publică numai după acceptarea de către autorul detaliului.
- **Reguli aplicate pe server.** UI-ul nu este sursa de adevăr pentru permisiuni și tranziții.

## Stadiul proiectului

DETALIA este un MVP privat aflat în validare și dezvoltare activă. Fluxurile principale sunt implementate, iar diferențele de integrare, securitate și pregătire pentru producție sunt urmărite în documentația proiectului.

Aplicația nu trebuie considerată production-ready până la închiderea porților documentate în [`docs/SECURITATE.md`](docs/SECURITATE.md).

## Stack tehnic

| Strat | Tehnologie |
|---|---|
| Aplicație full-stack | Next.js App Router + React |
| Business logic | TypeScript, separat în `server/` |
| Bază de date | Neon Postgres + Drizzle ORM |
| Autentificare | Auth.js, passwordless prin Resend |
| Stocare | Vercel Blob |
| UI | Tailwind CSS + shadcn/ui |
| Schițare | HTML Canvas + `perfect-freehand` |
| Hosting vizat | Vercel |

DETALIA este o singură aplicație full-stack. Server Components și Server Actions gestionează interfața și mutațiile, iar regulile de business sunt izolate de UI în servicii și repository-uri.

## Structura proiectului

```text
detalia/
├── app/          # pagini, layouturi și Server Actions
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

- Node.js LTS;
- npm;
- o bază de date PostgreSQL/Neon;
- credențiale Resend pentru autentificarea prin email;
- un store Vercel Blob pentru uploaduri.

### Instalare

```bash
npm install
```

Copiază template-ul de configurare:

```powershell
Copy-Item .env.example .env.local
```

Completează cel puțin:

```text
DATABASE_URL
AUTH_SECRET
AUTH_URL
AUTH_RESEND_KEY
EMAIL_FROM
BLOB_READ_WRITE_TOKEN
```

Aplică migrațiile și, opțional, datele seed:

```bash
npm run db:migrate
npm run db:seed
```

Pornește aplicația:

```bash
npm run dev
```

Aplicația va fi disponibilă implicit la [http://localhost:3000](http://localhost:3000).

## Verificări disponibile

```bash
npm run typecheck
npm run lint
npm run build
npm run format:check
```

Suita automată de teste nu este încă operațională; starea și cerințele de acoperire sunt descrise în [`docs/PLAN-TESTE.md`](docs/PLAN-TESTE.md).

## Documentație

| Document | Conținut |
|---|---|
| [`docs/ARHITECTURA.md`](docs/ARHITECTURA.md) | Arhitectura și deciziile tehnice |
| [`docs/ADR.md`](docs/ADR.md) | Decizii de arhitectură și consecințe |
| [`docs/SCHEMA.md`](docs/SCHEMA.md) | Modelul bazei de date |
| [`docs/SECURITATE.md`](docs/SECURITATE.md) | Sursa unică pentru controale, audit și poarta de lansare |
| [`docs/UX-ECRANE.md`](docs/UX-ECRANE.md) | Ecrane, stări și fluxuri UX |
| [`docs/PLAN-TESTE.md`](docs/PLAN-TESTE.md) | Strategia și scenariile de testare |
| [`docs/CONFIDENTIALITATE-GDPR.md`](docs/CONFIDENTIALITATE-GDPR.md) | Confidențialitate și cerințe GDPR |
| [`docs/CHANGELOG.md`](docs/CHANGELOG.md) | Istoricul modificărilor |

## Statut

Repository privat. Proiect aflat în dezvoltare activă.
