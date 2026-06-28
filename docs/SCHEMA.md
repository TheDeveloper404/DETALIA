# DETALIA — Schema de date (proiectare concretă)

> **🔵 SURSA DE ADEVĂR = CODUL** (`db/schema.ts` + migrații). Acest fișier e *design doc*: la orice divergență,
> **codul câștigă**. Când schimbi schema în cod, actualizează aici sau marchează secțiunea ca „verifică în cod".
> _Ultima verificare față de cod: 2026-06-27 — codul EXISTĂ (`db/schema.ts`). La orice divergență, codul câștigă._
>
> Versiunea „de adevăr" a schemei va fi **codul Drizzle** (`db/schema.ts`) + migrațiile, generate în Faza 0.
> Acest doc fixează **proiectarea concretă** (tipuri, enum-uri, constrângeri, indici) ca să nu improvizăm la scaffold.
> Convenții (din CLAUDE.md): tabele `snake_case` plural · coloane `snake_case` singular · PK
> `uuid DEFAULT gen_random_uuid()` · `created_at`/`updated_at` standard · **toate FK indexate** · migrații reversibile.

---

## Enum-uri

```
user_status            : INVITED | ACTIVE | SUSPENDED | DELETED
role_main              : PROIECTANT | EXECUTANT | FURNIZOR | BENEFICIAR
verification_status    : DECLARED | PENDING | VERIFIED | REJECTED
target_type            : DETAIL | SKETCH        -- polimorfism validare/comentariu
validation_position    : APPROVE | DISAPPROVE
sketch_status          : DRAFT | PENDING_ACCEPTANCE | PUBLISHED | REJECTED
detail_resource_type   : IMAGE | LINK | TEXT | PDF
notification_type      : SKETCH_PROPOSED | SKETCH_ACCEPTED | SKETCH_REJECTED | ...
```

---

## Tabele

### `users`
| coloană | tip | note |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` |
| `email` | text | **UNIQUE**, not null |
| `email_verified` | timestamptz | standard Auth.js |
| `name` | text | nullable (compus din `first_name` + `last_name` la onboarding) |
| `image` | text | avatar (Blob) |
| `status` | `user_status` | default `ACTIVE` |
| `invited_by_id` | uuid | nullable |
| `first_name` / `last_name` | text | profil extins (onboarding) |
| `headline` | text | profil public (titlu/headline) |
| `about` | text | descriere profil |
| `location` / `website` | text | profil public |
| `cover_image` | text | copertă profil (Blob) |
| `created_at` | timestamptz | (NU există `updated_at` pe `users`) |

> Tabelele Auth.js (`accounts`, `sessions`, `verification_tokens`) sunt gestionate de adapterul Drizzle — vezi `db/schema.ts`, nu le mâna manual.

### `roles` (un singur rol per user — declarat la signup)
| coloană | tip | note |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK→users.id | **UNIQUE** (un rol/user), **index** |
| `role_main` | `role_main` | not null |
| `sub_role` | text | ex. „arhitect", „inginer structurist" |
| `verification_status` | `verification_status` | default `DECLARED` |
| `verification_evidence` | text | nr. OAR / CUI — **PII, nu se loghează** |
| `verified_by_admin_id` | uuid FK→users.id | nullable; **index** |
| `created_at` / `updated_at` | timestamptz | |

> **Notă „admin":** nu există coloană `is_admin`. Un user e admin dacă emailul lui e în allowlist-ul `ADMIN_EMAILS`
> (env, vezi `lib/admin.ts`). FK-urile `verified_by_admin_id` / `created_by_admin_id` arată spre rândul `users` al
> acelui admin (care e tot un user normal).

### `invitations` (dă DOAR acces — NU atribuie rolul)
| coloană | tip | note |
|---|---|---|
| `id` | uuid PK | |
| `token` | text | **UNIQUE**, one-time — **PII, nu se loghează** |
| `email` | text | not null; **index** |
| `expires_at` | timestamptz | not null |
| `used_at` | timestamptz | nullable (one-time use) |
| `created_by_admin_id` | uuid FK→users.id | **index** |
| `created_at` | timestamptz | |

### `categories` (arbore, self-FK)
| coloană | tip | note |
|---|---|---|
| `id` | uuid PK | |
| `parent_id` | uuid FK→categories.id | nullable (rădăcină); **index** |
| `name` | text | not null |
| `slug` | text | **UNIQUE** |

### `details` («repository»)
| coloană | tip | note |
|---|---|---|
| `id` | uuid PK | |
| `title` | text | not null |
| `description` | text | nullable; text liber „deasupra" imaginii (stil post) |
| `author_id` | uuid FK→users.id | **index** |
| `category_id` | uuid FK→categories.id | **index** |
| `climate_zone` | text | default `'General'` (listă fixă) |
| `seismic_zone` | text | default `'General'` (listă fixă) |
| `image_url` | text | imaginea 2D (jpg/png/webp, ~5MB) |
| `status` | text | publicat/draft (seed) |
| `created_at` / `updated_at` | timestamptz | |

### `detail_resources` (MAX 3 resurse opționale/detaliu)
| coloană | tip | note |
|---|---|---|
| `id` | uuid PK | |
| `detail_id` | uuid FK→details.id | **index** |
| `type` | `detail_resource_type` | |
| `url` | text | pt IMAGE/LINK/PDF |
| `body` | text | pt TEXT |
> Limita „max 3" se aplică în `DetailService` (regulă de business), nu doar la DB.

### `sketches` («fork + PR» — o foaie din teanc)
| coloană | tip | note |
|---|---|---|
| `id` | uuid PK | |
| `detail_id` | uuid FK→details.id | detaliul-mamă; **index** |
| `author_id` | uuid FK→users.id | un singur autor/foaie; **index** |
| `strokes_json` | jsonb | stroke-uri vectoriale, **coordonate normalizate 0..1** |
| `thumbnail_url` | text | PNG pre-randat la publicare (Blob); nullable până la PUBLISHED |
| `status` | `sketch_status` | default `DRAFT` |
| `accepted_at` | timestamptz | nullable |
| `created_at` / `updated_at` | timestamptz | |

### `validations` («code review» — INIMA, polimorfic)
| coloană | tip | note |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK→users.id | **index** |
| `target_type` | `target_type` | DETAIL \| SKETCH |
| `target_id` | uuid | id-ul țintei (polimorfic — fără FK forțat) |
| `position` | `validation_position` | APPROVE \| DISAPPROVE |
| `role_snapshot` | jsonb | rolul userului la momentul poziției (pt afișare istorică) |
| `created_at` / `updated_at` | timestamptz | |

> **CONSTRÂNGERE UNICĂ: `(user_id, target_type, target_id)`** → o singură poziție/user/țintă, reversibilă.
> Index pe `(target_type, target_id)` pentru citirea rapidă a pozițiilor unei ținte.

### `comments` (polimorfic)
| coloană | tip | note |
|---|---|---|
| `id` | uuid PK | |
| `target_type` | `target_type` | |
| `target_id` | uuid | polimorfic |
| `author_id` | uuid FK→users.id | **index** |
| `body` | text | not null |
| `origin_validation_id` | uuid FK→validations.id | nullable — setat când vine dintr-un DISAPPROVE obligatoriu; **index** |
| `created_at` | timestamptz | |
> Index pe `(target_type, target_id)` pentru coloana de comentarii a unei ținte.

### `notifications`
| coloană | tip | note |
|---|---|---|
| `id` | uuid PK | |
| `recipient_user_id` | uuid FK→users.id | **index** |
| `type` | `notification_type` | |
| `payload_json` | jsonb | date contextuale (id schiță, id detaliu, etc.) |
| `read_at` | timestamptz | nullable |
| `created_at` | timestamptz | |

---

## Decizii de modelare (de ce)

- **Polimorfism `validations`/`comments` (target_type + target_id):** același mecanism de dezbatere
  funcționează pe Detaliu ȘI pe fiecare Schiță. „Fiecare foaie dezbătută separat" iese gratis.
  Compromis: fără FK forțat pe `target_id` (e polimorfic) → integritatea se asigură în service + indici compuși.
- **Constrângere unică pe `validations`** → „o poziție/user, reversibilă" garantat de DB, nu de cod fragil.
- **`strokes_json` ca jsonb, normalizat 0..1** → mic, redabil, scalabil pe orice ecran; thumbnail PNG randat
  o singură dată la publicare (nu re-randăm vectorii la fiecare hover).
- **`role_snapshot` pe validare** → rolul afișat lângă o poziție rămâne corect chiar dacă userul își schimbă
  subrolul ulterior (istoric onest).
- **Toate FK indexate** + indici compuși pe țintele polimorfice — citirile feed/detaliu sunt ieftine.
