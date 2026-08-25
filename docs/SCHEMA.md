# DETALIA — Schema de date (proiectare concretă)

> **🔵 SURSA DE ADEVĂR = CODUL** (`db/schema.ts` + migrații). Acest fișier e *design doc*: la orice divergență,
> **codul câștigă**. Când schimbi schema în cod, actualizează aici sau marchează secțiunea ca „verifică în cod".
> _Ultima verificare față de cod: 2026-08-25 — resincronizat cu `db/schema.ts` (adăugate tabelele
> `material_offers`/`material_offer_files`; coloanele `users.referral_code`/`.referred_by_user_id`;
> completat tabelul `users` cu coloanele care lipseau din doc de mai demult — `phone`/`phone_visible`/
> `email_visible`, `seen_badges`, `last_seen_announcement_version`, `seen_detail_tour`; enum
> `notification_type` la zi — vezi CHANGELOG 2026-08-25 pentru detaliu)._
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
notification_type      : SKETCH_PROPOSED | SKETCH_DELETED | SUPPLIER_OFFERED | MATERIAL_OFFER_SENT |
                          MATERIAL_OFFER_EDITED | REFERRAL_JOINED  (SKETCH_ACCEPTED | SKETCH_REJECTED = istoric)
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
| `phone` | text | nullable; contact opțional |
| `phone_visible` / `email_visible` | boolean | default `false` — opt-in explicit, altfel privat inclusiv pt proprietar (2026-08-17) |
| `seen_badges` | jsonb | default `{}` — ultimul snapshot de badge-uri VĂZUT (id→tier), pt pop-up „badge nou" |
| `last_seen_announcement_version` | text | nullable — ultima versiune văzută a panoului „Ce e nou" |
| `seen_detail_tour` | boolean | default `false` — turul ghidat de pe pagina de detaliu, arătat vreodată? |
| `referral_code` | text | nullable, **UNIQUE** — cod scurt de referral, generat LENEȘ la prima cerere a linkului (2026-08-25) |
| `referred_by_user_id` | uuid FK→users.id | nullable, `ON DELETE SET NULL` — cine a adus acest user, setat O SINGURĂ DATĂ (2026-08-25) |
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
| `location` | text | not null, default `'România'` — orice altă valoare (text liber) = context tehnic RO invalid pt acel detaliu (enforce în service, nu doar DB) |
| `climate_zone` | text | nullable, fără default (Zona I..IV — n-are variantă neutră) |
| `seismic_ag` | text | default `'General'` (listă fixă) |
| `seismic_tc` | text | default `'General'` (listă fixă) |
| `snow_load` | text | default `'General'` (listă fixă) |
| `wind_load` | text | default `'General'` (listă fixă) |
| `image_url` | text | imaginea 2D (jpg/png/webp, ~5MB) |
| `status` | text | default `'PUBLISHED'` |
| `views` | integer | not null, default `0` — contor de vizualizări; FIECARE încărcare de pagină (nu vizitatori unici), incrementat atomic prin SQL brut ca să nu atingă `updated_at` (2026-08-06) |
| `anonymized_at` | timestamptz | nullable — momentul în care autorul s-a RETRAS din detaliu. Non-null ⇒ nume/poză/link de profil mascate ÎN SQL la orice citire, detaliul dispare de pe profilul autorului, editarea e blocată. `author_id` rămâne, pentru audit (2026-08-06) |
| `author_role_snapshot` | jsonb | nullable — rolul autorului îngheţat la retragere (`{roleMain, subRole, verificationStatus}`), fiindcă după anonimizare nu mai poate fi citit din cont. Acelaşi model ca `validations.role_snapshot` |
| `project_id` | uuid FK→projects.id | nullable; cascade; **index**. Combinat cu `status`: DRAFT+null = ciornă, PUBLISHED+id = vizibil doar membrilor proiectului, PUBLISHED+null = public (2026-08-09) |
| `released_from_project_id` | uuid FK→projects.id | nullable; `ON DELETE SET NULL`; **index** — originea unui detaliu eliberat în comunitate (`project_id = null` acum), păstrată ca preview în proiectul de unde a plecat (2026-08-11) |
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
| `is_annotation` | boolean | default `false`; true doar pe rândul creat din formularul de adaugă/editează detaliu — explicația autorului pe propria imagine, nu o schiță primită de la altcineva (2026-08-11) |
| `accepted_at` | timestamptz | nullable; = momentul publicării |
| `base_sketch_ids` | jsonb | nullable — id-urile schițelor aprinse pe ecran la „Schițează peste", în ordine jos-sus (stack de foi, 2026-08-08); listă deja aplatizată, nu recursivă |
| `role_snapshot` | jsonb | nullable — rolul autorului la momentul PUBLICĂRII (afișare istorică după retragere), capturat la publish |
| `author_removed` | boolean | default `false` — identitatea autorului a fost retrasă, desenul rămâne |
| `hidden_after_release` | boolean | default `false` — setat o singură dată la „Scoate în comunitate": schițele altor membri (nu autorul detaliului) nu devin publice odată cu detaliul (SEC-002, 2026-08-10) |
| `locked_at` | timestamptz | nullable — setat când o altă schiță care o conține în `base_sketch_ids` e PUBLICATĂ; rămâne setat definitiv chiar dacă acea schiță e ștearsă ulterior |
| `created_at` / `updated_at` | timestamptz | |

### `projects` (colaborare restrânsă — al treilea strat, pe lângă Detaliu public și Planșă strict privată, 2026-08-09)
| coloană | tip | note |
|---|---|---|
| `id` | uuid PK | |
| `owner_id` | uuid FK→users.id | **index** |
| `name` | text | not null |
| `invite_token` | text | not null, **unique** — stocat BRUT (nu hash, e link persistent de recopiat, nu credențială one-time); regenerare = UPDATE, tokenul vechi devine instant invalid |
| `invite_token_created_at` | timestamptz | not null, default now — ancora de TTL pt link (separată de `updated_at`, care se schimbă și la redenumire) |
| `created_at` / `updated_at` | timestamptz | |

Doar 2 poziții: Autor (owner) și Invitați — invitații se comportă identic cu owner-ul, nu există Viewer/Editor.

### `project_members`
| coloană | tip | note |
|---|---|---|
| `id` | uuid PK | |
| `project_id` | uuid FK→projects.id | cascade; **index** |
| `user_id` | uuid FK→users.id | **index** |
| `joined_at` | timestamptz | |
| `removed_at` | timestamptz | nullable — un singur rând per (project, user), NU istoric de intrări/ieșiri; la re-alăturare se reactivează același rând (`removed_at = null`) |

Constrângere unică `(project_id, user_id)`. Owner-ul NU are neapărat un rând aici — accesul e membru activ SAU `projects.owner_id`.

### `project_canvas_shares` (partajare planșă în proiect, §6B, 2026-08-11)
| coloană | tip | note |
|---|---|---|
| `id` | uuid PK | |
| `project_id` | uuid FK→projects.id | cascade; **index** |
| `shared_by_user_id` | uuid FK→users.id | **index** |
| `name` | text | not null |
| `image_url` | text | not null — copie ÎNGHEȚATĂ, needitabilă, blob nou re-încărcat la partajare (nu referă `canvases.id`; planșa sursă poate fi editată/ștearsă fără efect) |
| `created_at` | timestamptz | |

Pot exista mai multe partajări ale aceleiași planșe — fără unique pe `(project_id, shared_by_user_id)`.

### `validations` («code review» — INIMA, polimorfic)
| coloană | tip | note |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK→users.id | **index** |
| `target_type` | `target_type` | DETAIL \| SKETCH |
| `target_id` | uuid | id-ul țintei (polimorfic — fără FK forțat) |
| `position` | `validation_position` | APPROVE \| DISAPPROVE |
| `role_snapshot` | jsonb | rolul userului la momentul poziției (pt afișare istorică) |
| `hidden_after_release` | boolean | default `false` — oglindește `sketches.hidden_after_release`: pozițiile altor membri decât autorul detaliului nu devin publice la „Scoate în comunitate" (SEC-001, 2026-08-11) |
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
| `image_url` | text | nullable — MAXIM o imagine ataşată; trecută prin acelaşi pipeline de re-encodare ca imaginile de detalii, sub `u/<userId>/comments/`. Ştearsă din Blob odată cu comentariul (şi la ştergerea detaliului-părinte) (2026-08-06) |
| `origin_validation_id` | uuid FK→validations.id | nullable — setat când vine dintr-un DISAPPROVE obligatoriu; **index** |
| `was_disapproval` | boolean | default `false`; persistă DINCOLO de retragere (`origin_validation_id` → null la retract) — UI arată „fostă dezaprobare, retrasă" |
| `parent_comment_id` | uuid FK→comments.id | nullable — reply, UN SINGUR nivel (un reply nu poate primi reply, enforce în service); cascade; **index** |
| `created_at` | timestamptz | |
> Index pe `(target_type, target_id)` pentru coloana de comentarii a unei ținte.

### `comment_likes`
| coloană | tip | note |
|---|---|---|
| `user_id` | uuid FK→users.id | cascade; parte din PK compus |
| `comment_id` | uuid FK→comments.id | cascade; **index**; parte din PK compus |
| `created_at` | timestamptz | |

PK compus `(user_id, comment_id)` → un user nu poate da like de două ori aceluiași comentariu.

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

### `supplier_offers` („ridic mâna" — FURNIZOR semnalează că poate oferta materiale, 2026-07-16)
| coloană | tip | note |
|---|---|---|
| `user_id` | uuid FK→users.id | cascade; parte din PK compus |
| `detail_id` | uuid FK→details.id | cascade; **index**; parte din PK compus |
| `created_at` | timestamptz | |

PK compus `(user_id, detail_id)`, identic model cu `saved_details`: al doilea click = retragere (DELETE),
nu a doua ramură de stare. Entitate separată de `validations` — doar vizibilitate comercială, fără
semantica de aprobare/dezaprobare.

### `material_offers` + `material_offer_files` (ofertă REALĂ de materiale, fișiere, 2026-08-25)
Distinct de `supplier_offers` (aia e doar flag-ul „pot oferta", fără fișiere). O ofertă = mesaj +
fișiere (PDF/Excel/CSV), STRICT pe detalii PUBLICE, vizibilă doar autorului detaliului.

| coloană (`material_offers`) | tip | note |
|---|---|---|
| `id` | uuid PK | |
| `detail_id` | uuid FK→details.id | cascade; **index** |
| `supplier_id` | uuid FK→users.id | cascade; **index** |
| `message` | text | not null |
| `created_at` / `updated_at` | timestamptz | |

**UNIQUE** `(detail_id, supplier_id)` — o singură ofertă per furnizor per detaliu (se editează, nu se
duplică).

| coloană (`material_offer_files`) | tip | note |
|---|---|---|
| `id` | uuid PK | |
| `offer_id` | uuid FK→material_offers.id | cascade; **index** |
| `url` | text | not null (Blob, propriul store) |
| `file_name` | text | not null |
| `file_size` | integer | not null |
| `created_at` | timestamptz | |

La `ANONYMIZE` (autor retras, detaliul rămâne) ofertele se șterg EXPLICIT — excepție deliberată față
de comentarii/schițe, care rămân (relația furnizor↔autor și-a pierdut sensul).

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

Strict privat — ownership enforce în service (nu RLS).

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
