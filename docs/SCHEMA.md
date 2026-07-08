# DETALIA — Schema de date (proiectare concretă)

> **🔵 SURSA DE ADEVĂR = CODUL** (`db/schema.ts` + migrații). Acest fișier e *design doc*: la orice divergență,
> **codul câștigă**. Când schimbi schema în cod, actualizează aici sau marchează secțiunea ca „verifică în cod".
> _Ultima verificare față de cod: 2026-07-07 — sincronizat cu `db/schema.ts` (era stale din 2026-07-03:
> lipseau `canvases`/`canvas_items` (Planșă), valoarea `CAD` din `detail_resource_type`; referința la
> `lib/admin.ts` era greșită — fișierele reale sunt `lib/admin-allowlist.ts` + `lib/admin-auth.ts`)._
>
> Versiunea „de adevăr" a schemei va fi **codul Drizzle** (`db/schema.ts`) + migrațiile, generate în Faza 0.
> Acest doc fixează **proiectarea concretă** (tipuri, enum-uri, constrângeri, indici) ca să nu improvizăm la scaffold.
> Convenții (din CLAUDE.md): tabele `snake_case` plural · coloane `snake_case` singular · PK
> `uuid DEFAULT gen_random_uuid()` · `created_at`/`updated_at` standard · **toate FK indexate** · migrații reversibile.

---

## Enum-uri

```
user_status            : ACTIVE | SUSPENDED | DELETED
role_main              : PROIECTANT | EXECUTANT | FURNIZOR | BENEFICIAR
verification_status    : DECLARED | PENDING | VERIFIED | REJECTED
target_type            : DETAIL | SKETCH        -- polimorfism validare/comentariu
validation_position    : APPROVE | DISAPPROVE
sketch_status          : DRAFT | PUBLISHED  (PENDING_ACCEPTANCE | REJECTED = valori istorice, nemaifolosite)
detail_resource_type   : IMAGE | LINK | TEXT | PDF | CAD
notification_type      : SKETCH_PROPOSED | SKETCH_DELETED  (SKETCH_ACCEPTED | SKETCH_REJECTED = istoric)
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
| `first_name` / `last_name` | text | profil extins (onboarding) |
| `headline` | text | profil public (titlu/headline) |
| `about` | text | descriere profil |
| `location` / `website` | text | profil public |
| `company` | text | firma reprezentată (opțional, auto-declarat) |
| `cover_image` | text | copertă profil (Blob) |
| `cover_position` | integer | default `50`; poziția verticală a coperții (object-position Y, 0..100) |
| `created_at` | timestamptz | (NU există `updated_at` pe `users`) |

> Tabelele Auth.js (`accounts`, `sessions`, `verification_tokens`) sunt gestionate de adapterul Drizzle — vezi `db/schema.ts`, nu le mâna manual.

### `roles` (un singur rol per user — declarat la signup)
| coloană | tip | note |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK→users.id | **UNIQUE** (un rol/user), **index** |
| `role_main` | `role_main` | not null |
| `sub_role` | text | ex. „arhitect", „inginer structurist" |
| `secondary_role` | text | nullable; rol aditiv opțional (Administrativ/Educație) — peste meseria de bază |
| `verification_status` | `verification_status` | default `DECLARED` |
| `verification_evidence` | text | nr. OAR / CUI — **PII, nu se loghează** |
| `verified_by_admin_id` | uuid FK→users.id | nullable; **index** |
| `created_at` / `updated_at` | timestamptz | |

> **Notă „admin":** nu există coloană `is_admin`. Un user e admin dacă emailul lui e în allowlist-ul `ADMIN_EMAILS`
> (env, vezi `lib/admin-allowlist.ts`). FK-ul `verified_by_admin_id` arată spre rândul `users` al adminului
> care a validat verificarea (adminul e tot un user normal — nu există un tabel separat de conturi de admin).

> **`invitations` — ELIMINAT** (2026-06-28, vezi CHANGELOG): tabelul + tot codul de invitații au fost șterse
> (acces public prin magic link). Migrația `0004_drop_invitations.sql` face `DROP TABLE`.

### `categories` (arbore, self-FK, până la 3 niveluri: secțiune → capitol → sub-capitol)
| coloană | tip | note |
|---|---|---|
| `id` | uuid PK | |
| `parent_id` | uuid FK→categories.id | nullable (rădăcină); **index** |
| `name` | text | not null |
| `slug` | text | **UNIQUE** |
| `position` | integer | default `0`; ordinea din document (`lista_categorii.md`) — NU alfabetic |
| `is_group` | boolean | default `false`; `true` = grupare neselectabilă (secțiuni de nivel 1 ȘI „capitole" cu sub-categorii, ex. „Instalații" — capitolul însuși nu e bifabil, doar copiii) |

### `details` («repository»)
| coloană | tip | note |
|---|---|---|
| `id` | uuid PK | |
| `title` | text | not null |
| `description` | text | nullable; text liber „deasupra" imaginii (stil post) |
| `author_id` | uuid FK→users.id | **index** |
| `climate_zone` | text | nullable, fără default (Zona I..IV — n-are variantă neutră) |
| `seismic_ag` | text | default `'General'` (listă fixă) |
| `seismic_tc` | text | default `'General'` (listă fixă) |
| `snow_load` | text | default `'General'` (listă fixă) |
| `wind_load` | text | default `'General'` (listă fixă) |
| `image_url` | text | imaginea 2D (jpg/png/webp, ~5MB) |
| `status` | text | default `'PUBLISHED'` |
| `created_at` / `updated_at` | timestamptz | |

### `detail_categories` (many-to-many — bifezi oricâte categorii pe un detaliu)
| coloană | tip | note |
|---|---|---|
| `detail_id` | uuid FK→details.id | cascade; parte din PK compus |
| `category_id` | uuid FK→categories.id | **index**; parte din PK compus |

PK compus `(detail_id, category_id)`. Înlocuiește vechiul `details.category_id` (FK simplu, un singur
detaliu = o categorie) — modelul actual permite tag-uri multiple, stil Pinterest.

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
| `status` | `sketch_status` | default `DRAFT`; flux nou `DRAFT → PUBLISHED` (PENDING_ACCEPTANCE/REJECTED = istoric) |
| `disapproves_parent` | boolean | default `false`; true = pornită din „Dezaprob → fac o schiță" (materializează dezaprobarea la publicare) |
| `accepted_at` | timestamptz | nullable; = momentul publicării |
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
| `was_disapproval` | boolean | default `false`; persistă DINCOLO de retragere (`origin_validation_id` → null la retract) — UI arată „fostă dezaprobare, retrasă" |
| `parent_comment_id` | uuid FK→comments.id | nullable — reply, UN SINGUR nivel (un reply nu poate primi reply, enforce în service); cascade; **index** |
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

### `saved_details` (bookmark — „citește mai târziu")
| coloană | tip | note |
|---|---|---|
| `user_id` | uuid FK→users.id | cascade; parte din PK compus |
| `detail_id` | uuid FK→details.id | cascade; **index**; parte din PK compus |
| `created_at` | timestamptz | ordinea în lista `/saved` (recent salvate primele) |

PK compus `(user_id, detail_id)` → un user nu poate salva același detaliu de două ori.

### Admin — autentificare SEPARATĂ de useri
Adminii NU sunt useri ai platformei: login propriu prin magic link (allowlist `ADMIN_EMAILS` din env, fără
tabel de conturi/parole), sesiune proprie (cookie dedicat), acces izolat la `/admin-page`.

**`admin_login_tokens`** (token one-time la cererea de login):
| coloană | tip | note |
|---|---|---|
| `token` | text PK | |
| `email` | text | din allowlist; **index** |
| `expires` | timestamptz | |
| `created_at` | timestamptz | |

**`admin_sessions`** (sesiune de admin, token opac în cookie HttpOnly, revocabilă din DB):
| coloană | tip | note |
|---|---|---|
| `token` | text PK | |
| `email` | text | **index** — identitatea = emailul din allowlist, nu un FK spre `users` |
| `expires` | timestamptz | |
| `created_at` | timestamptz | |

### `platform_settings` (single-row — config global, administrat din `/admin-page`)
| coloană | tip | note |
|---|---|---|
| `id` | uuid PK | |
| `announcement_enabled` | boolean | default `false`; banner programat în feed |
| `announcement_date` | date | nullable |
| `announcement_message` | text | nullable; override text implicit |
| `lockdown_enabled` | boolean | default `false`; „site în lucru" — doar adminul intră |
| `lockdown_message` | text | nullable |
| `updated_by` | text | emailul adminului (allowlist, NU user) |
| `updated_at` | timestamptz | |

### `canvases` (Planșă — spațiu de lucru privat per user)
| coloană | tip | note |
|---|---|---|
| `id` | uuid PK | |
| `owner_id` | uuid FK→users.id | cascade; **index** |
| `name` | text | not null |
| `state` | jsonb | `CanvasDocument` ({ version, items, strokes }) — opac pentru Drizzle, validat structural pe server la fiecare salvare; `null` = planșă nou-creată, fără conținut |
| `thumbnail_url` | text | nullable; PNG compus client-side la salvare |
| `created_at` / `updated_at` | timestamptz | |

Strict privat la MVP — ownership enforce în service (nu RLS).

### `canvas_items` (relația planșă ↔ detalii/schițe)
| coloană | tip | note |
|---|---|---|
| `id` | uuid PK | |
| `canvas_id` | uuid FK→canvases.id | cascade; |
| `detail_id` | uuid FK→details.id | cascade; **index** |
| `sketch_id` | uuid FK→sketches.id | nullable; cascade; **index** — `null` = item „detaliu-mamă", prezent = item „schiță" |
| `added_at` | timestamptz | |

Index unic parțial: un detaliu-mamă o singură dată per planșă (`sketch_id is null`); o schiță o singură dată
per planșă (`sketch_id is not null`) — același detaliu poate apărea de mai multe ori (o dată ca detaliu-mamă,
plus câte o dată per schiță trimisă separat).

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
