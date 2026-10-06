# DETALIA

**The professional construction community, organized around the construction detail.**

DETALIA is a collaborative platform where professionals in design, construction, supply and building management can publish, analyze and improve technical details. Every contribution is transparently tied to a professional role, and a detail can be approved, challenged with arguments, or extended with a sketch drawn on top of it.

Mental model: **"StackOverflow for construction"** — a detail is like a question/post, a sketch is an answer, and role-based validation is the community vote.

## Features

- **Detail feed** filterable by category (including on mobile, through a dedicated filter), with simple title search.
- **Detail page** with the technical image, the author's context and the debate.
- **Role-based validation** — Approve (one click) or Disapprove (with a mandatory justification).
- **Sketching** on top of a detail, directly in the browser, with vector drawing tools.
- **Sketch stack** — a browsable stack of sketches for each detail.
- **Comments** attached to a detail or a sketch, with (emoji) reactions and likes.
- **Private board ("Planșă")** — a personal canvas (sketches/annotations), separate from a detail's public stack, visible ONLY to its owner.
- **Projects** — restricted collaboration spaces between an Author and Guests, with details published directly into the project (private until they are "released to the community").
- **Supplier offers** — a verified supplier can send a real offer on a detail (message + PDF/Excel/CSV files), visible only to the detail's author, who gets notified.
- **Saved details** and **own offers**, as private lists, separate from the feed.
- **In-app notifications** (the email channel exists in code, disabled by default).
- **Public profile** with role, sub-role, photo, join date ("Member since …"), optional role verification and **reputation badges** (Bronze/Silver/Gold, computed from activity — publications, sketches, validations given/received), with a celebration pop-up when a new badge is earned.
- **Referral** — every user has their own invitation link; after 10 users join through it, they receive the "Growing together" badge.

## How it works

### 1. Professional identity
Users sign in with a **magic link** (no password) and declare their main role — Designer, Contractor, Supplier or Client — plus a specialization. The role is shown next to validations, comments and sketches, so opinions are read in context.

### 2. Publishing a detail
A detail contains a technical image, a title, a description, a category, optional climate/seismic context and optional resources (image, link, PDF, text). Once published, it appears in the feed and gets its own analysis page. Any authenticated user with a declared role can publish.

### 3. Role-based validation
Community members can:
- **approve** a detail or a sketch (one click);
- **disapprove** only together with a justification, which automatically becomes a comment;
- later withdraw or change their own position (one position per target).

Validations do not form an anonymous score — the person's role and argument stay visible to the reader. You can also vote on your own content.

### 4. Proposing a sketch
A user can draw on top of a detail's image and publish the result:

```text
DRAFT → PUBLISHED
```

The sketch is published directly and joins the detail's public stack. Each sketch has a single author. Moderation is post-publication: a sketch can be deleted by its author or by the author of the parent detail.

### 5. Debate and notifications
Comments can belong to a detail or to a sketch. Authors receive in-app notifications for relevant events (a new sketch on their detail, deletions, etc.) — the email channel exists in code but is disabled by default.

### 6. Projects
A user can create a Project and invite other members through a copyable link (no automatic email). Inside a project, members (Author + Guests — same rights) publish details visible ONLY to each other; a detail can later be "released to the community" (it becomes public, in the general feed). Access is strictly checked on the server on every read, regardless of how the content is reached (feed, profile, notifications).

### 7. Private board
Independently of a detail's public stack, every user has their own drawing space (the board, "Planșă") — a private canvas with undo/redo history, used for personal notes/annotations. It is never visible to other users.

### 8. Reputation
Every user earns badges (Bronze/Silver/Gold) computed LIVE from activity — they are not stored separately, but derived from existing statistics (published details, sketches, validations given/received). When a new threshold is reached, the user gets a one-time celebration pop-up; badges are visible on anyone's public profile.

## Concepts

| Concept | Meaning |
|---|---|
| **Detail** | The main unit of technical content |
| **Sketch** | A proposal drawn on top of the original detail (single author) |
| **Validation** | A user's Approve/Disapprove position |
| **Stack** | The collection of a detail's published sketches |
| **Role** | The contributor's professional context |
| **Debate** | The comments attached to a detail or a sketch |
| **Project** | A restricted collaboration space (Author + Guests) for private details, publishable later to the community |
| **Board ("Planșă")** | A user's private drawing canvas, separate from the public sketch stack |
| **Badge** | Reputation level (Bronze/Silver/Gold) computed from activity, shown on the public profile |

## Tech stack

| Layer | Technology |
|---|---|
| Full-stack application | Next.js App Router + React |
| Business logic | TypeScript, isolated in `server/` |
| Database | Neon Postgres + Drizzle ORM |
| Authentication | Auth.js — passwordless magic link (Resend) |
| File storage | Vercel Blob |
| UI | Tailwind CSS + shadcn/ui |
| Sketching | HTML Canvas + `perfect-freehand` |
| Hosting | Vercel |

It is a single full-stack application: Server Components and Server Actions handle the UI and mutations, while business rules live in services and repositories, separate from the UI.

## Project structure

```text
detalia/
├── app/          # pages, layouts, route handlers and Server Actions
├── components/   # UI components and the sketching canvas
├── server/
│   ├── domain/   # domain rules and types
│   ├── services/ # business logic and authorization
│   └── repos/    # database access
├── db/           # Drizzle schema, migrations and seed
├── lib/          # auth, email, storage and utilities
├── e2e/          # Playwright tests (E2E)
├── public/       # static assets
└── docs/         # product and implementation documentation
```

## Running locally

### Requirements
- Node.js LTS and npm;
- a PostgreSQL/Neon database;
- Resend credentials for email authentication;
- a Vercel Blob store for uploads.

### Steps

```bash
npm install
```

Copy the configuration template and fill in the values:

```powershell
Copy-Item .env.example .env.local
```

Minimum required variables:

```text
DATABASE_URL
AUTH_SECRET
AUTH_URL
AUTH_RESEND_KEY
EMAIL_FROM
BLOB_READ_WRITE_TOKEN
```

The development database is an existing Neon branch (the schema is not created locally with `db:push`/
`db:migrate` — see the caveat below); ask the team for the `DATABASE_URL`. Optionally, seed test data:

```bash
npm run db:seed
```

Start the application:

```bash
npm run dev
```

Available by default at [http://localhost:3000](http://localhost:3000).

## Useful scripts

```bash
npm run dev             # development server
npm run build           # production build
npm run typecheck       # type check (tsc --noEmit)
npm run lint            # ESLint
npm run format:check    # formatting check (Prettier)
npm run test            # unit/integration tests (Vitest)
npm run e2e             # E2E tests (Playwright) — see docs/PLAN-TESTE.md
npm run check:subqueries  # guard against correlated Drizzle subquery bugs (server/repos)
```

> Schema migrations (`db:generate`/`db:push`/`db:migrate`) are NOT run from the terminal on this
> project — the database is Neon (dev + production, separate branches), and every schema change goes
> through raw SQL, run manually in the Neon SQL Editor on both branches (see `docs/DEPLOY.md`).

## Documentation

| Document | Contents |
|---|---|
| [`docs/README.md`](docs/README.md) | Full documentation index, with the purpose of each document |
| [`docs/ARHITECTURA.md`](docs/ARHITECTURA.md) | Architecture and technical decisions |
| [`docs/ADR.md`](docs/ADR.md) | Architecture decisions and consequences |
| [`docs/SCHEMA.md`](docs/SCHEMA.md) | Database model |
| [`docs/SECURITATE.md`](docs/SECURITATE.md) | Security controls and audit |
| [`docs/PLAN-TESTE.md`](docs/PLAN-TESTE.md) | Testing strategy and scenarios |
| [`docs/QA_TEST_CASES.md`](docs/QA_TEST_CASES.md) | Functional test cases, per feature |
| [`docs/MANUAL_UTILIZATOR.md`](docs/MANUAL_UTILIZATOR.md) | End-user manual |
| [`docs/DEPLOY.md`](docs/DEPLOY.md) | Infrastructure, environments, backup/restore, release rules |
| [`docs/CONFIDENTIALITATE-GDPR.md`](docs/CONFIDENTIALITATE-GDPR.md) | Privacy and GDPR requirements |
| [`docs/INCIDENTS.md`](docs/INCIDENTS.md) | Real production incidents |
| [`docs/BACKLOG.md`](docs/BACKLOG.md) | What's left to do, in short |
| [`docs/CHANGELOG.md`](docs/CHANGELOG.md) | Change history |
