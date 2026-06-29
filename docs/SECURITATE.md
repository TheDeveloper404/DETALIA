# DETALIA — Securitate

**Sursa unică de adevăr pentru securitatea aplicației**

**Ultima verificare:** 24 iunie 2026

**Tip verificare:** audit static al codului + scanare live a dependențelor

**Verdict pentru lansare publică:** **BLOCAT până la remedierea constatărilor High**

Acest document combină modelul de securitate, inventarul suprafeței reale, controalele implementate, constatările auditului și poarta de lansare. Nu descrie protecții doar pentru că sunt planificate: starea fiecărui control trebuie să reflecte codul existent.

Legendă:

- ✅ implementat structural în cod;
- ⚠️ implementat parțial sau neverificat comportamental;
- ❌ lipsește ori este nefuncțional;
- ⏸️ cod dormant, fără rută activă;
- **BLOCKER** — împiedică lansarea publică.

## 1. Rezumat executiv

Nu a fost identificat un bypass direct de autentificare, un SQL injection evident sau un IDOR exploatabil în fluxurile active analizate. Separarea Server Action → service → repository este în general corectă, iar user ID-ul folosit la mutații vine consecvent din sesiune.

Aplicația nu este încă pregătită pentru trafic public. Riscurile dominante sunt lipsa protecțiilor anti-abuz și pipeline-ul de upload public, care poate consuma necontrolat storage. Suspendarea conturilor, ciclul datelor sensibile, hardeningul HTTP și testele de securitate sunt de asemenea incomplete.

| Severitate | Număr | Stare |
|---|---:|---|
| High | 2 | blochează lansarea publică |
| Medium | 8 | obligatoriu înainte de production-ready |
| Low | 4 | hardening și prevenirea regresiilor |
| Informativ | 2 | decizii/configurații de confirmat |

## 2. Domeniul și limitele auditului

Au fost analizate rutele de producție, Server Actions, serviciile, regulile de domeniu, repository-urile, schema și migrațiile DB, Auth.js, Vercel Blob, Resend, randarea datelor controlate de utilizator, documentația GDPR și lockfile-ul npm.

Limitări:

- nu este penetration test și nu include exploatare activă;
- nu a fost folosit un staging izolat cu utilizatori reali;
- configurațiile efective Vercel, Neon, Resend, DNS și headerele livrate de platformă nu au fost inspectate;
- `.env.local` nu a fost citit, iar istoricul Git nu a fost scanat pentru secrete;
- controalele nu au teste automate, deci marcajul ✅ înseamnă acoperire statică, nu dovadă end-to-end.

## 3. Reguli de securitate permanente

- **Deny-by-default:** orice rută care nu este explicit publică cere sesiune.
- **Defense in depth:** proxy-ul este prima poartă; fiecare pagină și Server Action sensibilă trebuie să verifice local sesiunea.
- **User ID numai din sesiune:** clientul nu poate alege autorul unei mutații.
- **Authz în service:** rolul, ownership-ul și tranzițiile nu se decid în UI.
- **Validare server-side:** frontendul nu este sursă de adevăr.
- **Ținte polimorfice verificate:** `targetType + targetId` trebuie să indice conținut existent și public.
- **Fără PII în loguri:** emailurile, dovezile OAR/CUI și tokenurile nu se loghează.
- **Secrete numai în env:** niciun secret real în repository.
- **Efecte externe după validare:** uploadurile, emailurile și notificările se execută numai după authz și validarea ieftină.
- **Tranziții atomice:** orice state machine trebuie protejată contra requesturilor concurente.
- **Endpoint/Action nou:** intră în matricea de mai jos și nu este „done” fără test negativ de authz.

## 4. Zonele reale ale aplicației

### Public

- `/`;
- `/login`;
- `/signup`;
- `/api/auth/*`, gestionat de Auth.js;
- `/dev/*` numai când `NODE_ENV !== "production"`, cu `notFound()` suplimentar în pagini.

### Autentificat

Tot restul aplicației: onboarding, feed, detalii, profil, notificări, validări, comentarii și schițe. `proxy.ts` cere sesiune, iar paginile/Server Actions active repetă verificarea.

### Admin

`lib/admin.ts` oferă allowlist `ADMIN_EMAILS` și `requireAdmin()`, deny-by-default. Nu există însă rute sau Server Actions admin active. Verificarea rolurilor este doar planificată.

### Dormant

Înregistrarea este publică (magic link). Logica de invitații a fost **eliminată complet** (2026-06-28, vezi CHANGELOG) — nu mai există cod dormant.

## 5. Matricea suprafeței active

> **Audit de rute (2026-06-28):** întreaga suprafață a fost reparcursă. **Nu există rute neprotejate sau API
> descoperite.** Public INTENȚIONAT: `/`, `/login`, `/signup`, `/api/auth/*` (Auth.js), magic-link send
> (rate-limited). TOT restul (toate paginile `(app)`, `/onboarding`, `/api/blob/upload`, toate server actions) e
> protejat de proxy deny-by-default **și** de un check `auth()` propriu. Fiecare action ia userId din sesiune
> (anti-IDOR). Coloanele Anti-abuz/Test reflectă FAZA 1+2+3 (SEC-01/07/10/11 rezolvate).

| Suprafață reală | Auth | Validare server | Authz/ownership | Anti-abuz | Test | Stare |
|---|---|---|---|---|---|---|
| Magic link send (`auth-actions.ts`) | public (intenționat) | Auth.js + input | n/a | ✅ `authPerEmail`+`authPerIp` | ⚠️ | ✅ rate-limited (SEC-01) |
| `/api/blob/upload` (token upload) | ✅ sesiune | tip+mărime pe token | user din sesiune | ✅ `upload` | ⚠️ | ✅ 401/429, fără internals |
| `onboardingAction` | ✅ | manual + domain role | user din sesiune | ✅ | ⚠️ | ✅ |
| `saveAvatarUrl`/`saveCoverUrl` | ✅ | `BLOB_URL_RE` + reprocess sharp | user din sesiune | ✅ | ✅ upload-limits | ✅ (SEC-02) |
| `updateProfileDetailsAction` | ✅ | manual + allowlist URL | user din sesiune | ✅ | ✅ url | ✅ |
| `requestVerificationAction` | ✅ | non-empty | rolul userului | ✅ | ⚠️ | ⏸️ feature PE HOLD |
| `createDetailAction` | ✅ | domain + UUID categorie | autor din sesiune, rol cerut | ✅ `createDetail` | ✅ detail | ✅ (SEC-11) |
| `deleteDetailAction` | ✅ | UUID | numai autorul detaliului | ✅ | ⚠️ | ✅ ownership |
| `approveAction` | ✅ | target existență + UUID | poziția userului | ✅ | ✅ validation | ✅ |
| `retractAction` | ✅ | UUID | șterge numai poziția userului | ✅ | ✅ | ✅ |
| `disapproveAction` | ✅ | target + justificare | poziția userului | ✅ | ✅ | ✅ justificare impusă |
| `addComment/edit/deleteCommentAction` | ✅ | target/corp + UUID | autor din sesiune | ✅ | ✅ | ✅ |
| `startSketchAction` (createDraft) | ✅ | rol + detaliu + UUID | autor din sesiune | ✅ | ✅ sketch | ✅ |
| `saveStrokesAction` | ✅ | structură/limite strokes + UUID | numai autorul schiței | ✅ | ✅ | ✅ |
| `sendSketchAction` | ✅ | strokes + state machine + UUID | numai autorul schiței | ✅ | ✅ | ✅ atomic (SEC-07) |
| `accept/rejectSketchAction` | ✅ | stare + UUID | autorul detaliului-mamă | ✅ | ✅ | ✅ atomic (SEC-07) |
| `markReadAction` | ✅ | n/a | notificările userului | ✅ | ⚠️ | ✅ scope anti-IDOR |
| Pagini protejate `(app)` + `/onboarding` | ✅ | UUID pe params (SEC-11) | guards în services | n/a | ⚠️ E2E | ✅ deny-by-default |
| Rute/actions admin | n/a | n/a | `requireAdmin()` | n/a | n/a | ❌ neimplementate |

## 6. Controale confirmate în cod

- Proxy-ul este deny-by-default pentru rutele normale.
- Server Actions folosesc user ID-ul din sesiune, nu din formular.
- Editarea/trimiterea schiței verifică autorul; accept/reject verifică autorul detaliului-mamă.
- Notificările sunt citite și marcate numai în scope-ul utilizatorului curent.
- Comentariile și validările verifică existența și publicarea țintei.
- Dezaprobarea impune justificare server-side.
- Unicitatea poziției per user/țintă este garantată și în DB.
- Drizzle parametrizat este folosit consecvent; nu există SQL construit din input brut.
- React escapează textul; nu există `dangerouslySetInnerHTML`, `eval` sau `new Function` în producție.
- HTML-ul emailurilor escapează numele și titlul; subiectul elimină newline-urile.
- Nu există fetch server-side către URL-urile resurselor, deci nu a fost găsit SSRF activ.
- SVG nu este permis la upload.
- Magic linkul are TTL configurabil; Auth.js aplică redirect same-origin implicit.
- Fișierele env sunt ignorate de Git; scanarea fișierelor urmărite a găsit doar placeholders în `.env.example`.
- Nu există rute de dev/bypass: `app/dev/` și dev-login au fost eliminate complet (vezi CHANGELOG).

## 7. Constatările auditului

### High

#### SEC-01 — Lipsesc rate limitingul, cotele și protecțiile anti-abuz — BLOCKER

Magic linkul public poate fi solicitat repetat fără limită pe IP, hash de email sau fereastră de timp. După autentificare, comentariile, validările, ciornele, notificările și uploadurile nu au limite per user.

Un utilizator cu rol poate trimite repetat schițe și genera scrieri DB plus emailuri către autori. Riscul include email bombing, cost amplification, storage/DB exhaustion și degradarea serviciului.

**Dovezi:**

- `app/auth-actions.ts:16-22`;
- `lib/auth.ts:27-41`;
- `app/details/new/actions.ts:54-99`;
- `app/sketches/[id]/edit/sketch-actions.ts:47-69`;
- `server/services/notificationService.ts:34-55`;
- nicio implementare de limiter în `app/`, `lib/`, `server/` sau dependențe.

**Remediere obligatorie:** limiter distribuit pentru serverless; login limitat pe IP + hash email; mutații limitate pe user/acțiune; cote de upload; deduplicare/limită la emailuri; răspunsuri generice anti-enumerare.

#### SEC-02 — Pipeline-ul de upload este abuzabil și validează insuficient conținutul — BLOCKER

Validarea folosește `file.type` controlat de client și dimensiunea. Nu verifică magic bytes, decodarea sau pixel count. Thumbnail-ul verifică numai dimensiunea și este declarat PNG indiferent de conținut.

Bloburile sunt publice. Imaginea detaliului este urcată înainte de rol/categorie/validarea finală, iar thumbnail-ul înainte de ownership/state/strokes. La eșec, bloburile rămân orfane; nu există cleanup.

**Dovezi:**

- `lib/storage.ts:20-39,58-67`;
- `app/details/new/actions.ts:69-99`;
- `app/sketches/[id]/edit/sketch-actions.ts:55-64`;
- nu există apel de ștergere Vercel Blob.

**Remediere obligatorie:** authz și validări ieftine înainte de upload; verificare semnătură + decodare; re-encodare fără metadata; limite de dimensiuni/pixeli; cote; cleanup; verificarea headerelor reale Blob.

### Medium

#### SEC-03 — URL-urile userului nu au allowlist de protocol

Resursele sunt validate doar ca string nenul și randate direct în `href`; `website` are doar limită de lungime. Sunt acceptate scheme nedorite.

**Dovezi:** `server/domain/detail.ts:86-98`, `app/details/[id]/page.tsx:189-209`, `app/onboarding/actions.ts:59-72`.

**Remediere:** `new URL()`, allowlist strict `http:`/`https:`, normalizare și limită de lungime.

#### SEC-04 — Conturile `SUSPENDED` nu sunt blocate

Schema definește `SUSPENDED`, dar Auth.js și proxy-ul verifică doar existența sesiunii. Un cont suspendat își păstrează accesul.

**Dovezi:** `db/schema.ts:22,66`, `lib/auth.ts:43-52`, `proxy.ts:19-29`.

**Remediere:** refuz la sign-in și la sesiune pentru status diferit de `ACTIVE`; revocarea sesiunilor existente; test dedicat.

#### SEC-05 — Dovezile de verificare sunt PII fără limită și fără lifecycle

`verificationEvidence` nu are limită, este păstrat ca text și nu este șters după decizie sau schimbarea rolului. Fluxul admin lipsește, deci datele pot rămâne permanent în `PENDING`.

**Dovezi:** `server/services/roleService.ts:87-127`, `server/repos/rolesRepo.ts:42-47`, `db/schema.ts:137-140`, `docs/CONFIDENTIALITATE-GDPR.md`.

**Remediere:** minimizare și structurare, limită strictă, acces admin auditat, retenție automată și ștergere după decizie/expirare; criptare la nivel de câmp dacă modelul de amenințare o cere.

#### SEC-06 — Ștergerea contului și a datelor nu este complet implementabilă

Nu există export/ștergere. FK-urile `details.authorId` și `sketches.authorId` nu au strategie de ștergere, iar avatarurile/coperțile publice nu sunt eliminate la înlocuire sau ștergere.

**Dovezi:** `db/schema.ts:181-190,228-235`, `lib/storage.ts:29-55`, `docs/CONFIDENTIALITATE-GDPR.md`.

**Remediere:** politică de anonimizare/păstrare/cascade, workflow tranzacțional și inventar/cleanup Blob.

#### SEC-07 — Accept/reject pentru schițe nu este atomic

Serviciul citește statusul și face ulterior update numai după ID. Requesturi concurente pot scrie rezultate opuse și trimite notificări contradictorii.

**Dovezi:** `server/services/sketchService.ts:117-141`, `server/repos/sketchesRepo.ts:34-45`.

**Remediere:** compare-and-set `WHERE id = ? AND status = 'PENDING_ACCEPTANCE'`, verificarea rândurilor afectate și outbox/deduplicare pentru notificări.

#### SEC-08 — Security headers nu sunt configurate explicit

`next.config.ts` definește doar imaginile remote. Lipsesc CSP, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` și politica de frame embedding. HSTS trebuie verificat pe platformă.

**Dovadă:** `next.config.ts:1-15`.

**Remediere:** headere în aplicație/edge, CSP adaptat aplicației și verificare pe răspunsurile reale de staging.

#### SEC-09 — Dependențe cu advisories moderate

`npm audit --json` a raportat 6 pachete vulnerabile, 0 high și 0 critical:

- runtime/build: `next@16.2.9` → `postcss@8.4.31`, [GHSA-qx2v-qp2m-jg93](https://github.com/advisories/GHSA-qx2v-qp2m-jg93);
- tooling: `drizzle-kit@0.31.10` → `@esbuild-kit` → `esbuild@0.18.20`, [GHSA-67mh-4wv8-2f99](https://github.com/advisories/GHSA-67mh-4wv8-2f99).

Reachability este redusă: aplicația nu procesează CSS al utilizatorului, iar esbuild-ul vechi este tooling. Rezultatul trebuie totuși remediat sau acceptat documentat. Nu se aplică automat downgrade-urile majore sugerate de npm.

#### SEC-10 — Controalele critice nu au teste comportamentale

Nu există fișiere de test. `npm test` cere Vitest, dar `vitest` nu este instalat. Authz, IDOR, concurența și protecțiile anti-abuz nu au plasă de regresie.

**Dovezi:** `package.json:13-14,40-53`; niciun `*.test.*` sau `*.spec.*`.

**Remediere:** runner funcțional și teste de integrare cu autor, utilizator străin și cont suspendat; cazuri negative pentru fiecare Action; teste de concurență, upload și limitare.

### Low

#### SEC-11 — Inputuri și UUID-uri validate incomplet

`climateZone`/`seismicZone` nu au limită. Mai multe Actions acceptă ID-uri arbitrare, iar un UUID malformat poate produce DB error/500.

**Dovezi:** `server/domain/detail.ts:101-103`, `app/details/[id]/validation-actions.ts:20-30`, `app/details/[id]/comment-actions.ts:26-30`, `server/services/validationService.ts:33-40`.

**Remediere:** scheme server-side centralizate, UUID parsing și limite pentru fiecare string.

#### SEC-12 — Invitații (ELIMINAT)

~~Invitațiile dormante aveau token în clar și consum neatomic.~~ **Rezolvat prin eliminare** (2026-06-28, vezi
CHANGELOG): tot codul de invitații a fost șters (serviciu, repo, tabel DB, env). Înregistrarea e public/magic-link.
Constatarea nu mai are obiect. Dacă invitațiile se reintroduc vreodată, se construiesc de la zero, sigur (hash token
+ consum atomic).

#### SEC-13 — Matcherul proxy exclude generic căile care conțin punct

Patternul `.*\..*` poate omite viitoare rute cu extensie. Rutele active au guards locale, deci nu a fost găsit bypass actual.

**Dovadă:** `proxy.ts:38-42`.

**Remediere:** excluderi explicite pentru asseturi și guard local obligatoriu pe orice rută nouă.

#### SEC-14 — Nu există audit trail sau monitorizare de securitate

PII nu este logat, ceea ce este corect, dar lipsesc evenimente pentru volum anormal, suspendări, decizii admin, eșecuri repetate și cote depășite.

**Remediere:** evenimente structurate fără PII brut, correlation ID, alerte pe rate/cost și retenție controlată.

### Informativ

#### INFO-01 — Signupul este public (invitațiile au fost eliminate)

Comportament declarat (decizie Edi): înregistrare publică prin magic link. Logica de invitații a fost eliminată
complet (2026-06-28). Dacă produsul ar trebui vreodată să fie beta închis, se reconstruiește un mecanism de acces nou.

#### INFO-02 — `trustHost: true` depinde de deployment

Este uzual în Vercel, dar presupune host controlat și `AUTH_URL` canonic. Pe staging trebuie verificat că magic linkurile nu pot primi host arbitrar.

## 8. Situația celor 13 categorii

| # | Categorie | Stare reală |
|---|---|---|
| 1 | Autentificare | ⚠️ Auth.js magic link și TTL; fără rate limit și fără enforcement `SUSPENDED` |
| 2 | Autorizare/access control | ⚠️ structură bună și fără IDOR evident; fără teste |
| 3 | Validare/injection | ⚠️ Drizzle sigur; validări manuale incomplete, nu Zod peste tot |
| 4 | Date sensibile | ❌ retention/ștergere pentru dovezi și bloburi incomplete |
| 5 | Secrete/config | ⚠️ env și `.gitignore` corecte; istoricul și deploymentul neverificate |
| 6 | Sesiuni | ⚠️ database sessions; suspendarea și revocarea neaplicate |
| 7 | Rate limiting/DoS | ❌ absent — BLOCKER |
| 8 | Error handling | ⚠️ mesaje UI generice; cazuri de UUID invalid pot produce 500 |
| 9 | Logging/monitoring | ❌ fără audit trail și alerte |
| 10 | Supply chain | ⚠️ 6 pachete moderate raportate de npm audit |
| 11 | Upload | ❌ validare insuficientă, public, fără cote/cleanup — BLOCKER |
| 12 | CSRF/SSRF | ⚠️ Server Actions/Next oferă protecție de origine; fără test dinamic; fără SSRF activ găsit |
| 13 | Security headers | ❌ neconfigurate în aplicație și neverificate pe staging |

## 9. Riscuri de domeniu care trebuie păstrate în orice refactor

- `validations` și `comments` sunt polimorfice și nu au FK pe target; service-ul trebuie să verifice tipul și existența.
- Ownership-ul schiței are două reguli diferite: edit/send = autorul schiței; accept/reject = autorul detaliului.
- Poziția este unică și reversibilă per user/țintă; constrângerea DB trebuie păstrată.
- Dezaprobarea fără justificare este întotdeauna respinsă server-side.
- Tokenul de magic link trebuie să fie one-time și să expire.
- Orice viitoare suprafață `/admin` trebuie să cheme `requireAdmin()` server-side; ascunderea UI nu este authz.

## 10. Plan de implementare pe faze (în ordinea de făcut)

Ordinea de mai jos acoperă **toate** constatările (SEC-01..14 + §11c). Numerotare continuă = ordinea recomandată.

### FAZA 1 — BLOCANTE (înainte de ORICE trafic public)
Fără acestea, lansarea publică e oprită (verdict actual: BLOCAT).

1. ✅ **SEC-01 — Rate limiting + cote** (rezolvat 2026-06-28, vezi CHANGELOG). Limiter distribuit Upstash Redis
   (`lib/rate-limit.ts`, fail-open): login pe IP + hash email; mutații + publicare + cotă upload pe user/acțiune;
   răspunsuri generice anti-enumerare. *Email bombing acoperit indirect prin limitarea mutațiilor care trimit email
   (send/accept/reject), nu printr-un limiter de email separat.*
2. ✅ **SEC-02 — Upload sigur** (rezolvat 2026-06-28, vezi CHANGELOG). `lib/image-processing.ts` (sharp): la
   persistare descărcăm + validăm format real (magic bytes) + `limitInputPixels` (anti-bombă) + re-encodare fără
   metadata (strip EXIF/GPS) + plafon dimensiuni + cleanup blob orfan la eșec. Fetch restrâns la store-ul nostru
   (anti-SSRF). Cablat în details/profile/onboarding/thumbnail. *authz + cota de upload deja la token (SEC-01).*
3. ✅ **SEC-03 — Allowlist URL** (rezolvat 2026-06-28, vezi CHANGELOG). Resurse detaliu: `isHttpUrl` la input (deja).
   Website: `lib/url.ts normalizeWebsite` — allowlist http/https la INPUT (onboarding + profil), nu doar la randare
   (`safeWebsite`). Scheme periculoase respinse, nu stocate.
4. ✅ **SEC-04 — Blochează conturile `SUSPENDED`** (rezolvat 2026-06-28, vezi CHANGELOG). `signIn` callback refuză
   status ≠ ACTIVE (la trimitere magic link + la click); proxy blochează sesiunile non-ACTIVE (status proaspăt din
   DB, strategie database) → re-login imposibil + sesiuni existente moarte la următorul request. *Revocarea explicită
   a rândurilor din `sessions` se face la ștergerea contului (vezi mai jos); UI de suspendare încă nu există.*

### FAZA 2 — înainte de production-ready

5. ✅ **SEC-10 — Runner de teste + teste de securitate** (rezolvat 2026-06-28, vezi CHANGELOG). Instalat `vitest`
   + `vite-tsconfig-paths` (`vitest.config.ts`, env node, alias `@/`). Suită de securitate (54 aserțiuni):
   domeniu pur (`validateStrokes` coordonate 0..1/limite, `validateJustification` „fără dezaprobare mută",
   `validateDetailInput`/`isHttpUrl` allowlist URL, `normalizeWebsite`, `BLOB_URL_RE` allowlist Blob anti-SSRF,
   `hashEmail`/`checkLimit` fail-open) + servicii cu repo-uri mock-uite (`sketchService`: IDOR autor schiță/autor
   mamă + atomicitate send/accept/reject fără notificare la cursă pierdută; `validationService`: NO_ROLE,
   justificare obligatorie, fără comentariu duplicat). `HUMAN_RUNS_TESTS` → Liviu rulează `npm test`.
6. ✅ **SEC-07 — Tranziții atomice** (rezolvat 2026-06-28, vezi CHANGELOG). Accept/reject erau deja atomice;
   adăugat guard atomic și pe SEND (`transitionFromDraft`, `WHERE author_id AND status='DRAFT'`) → notificare doar pe
   câștigătorul tranziției (idempotent, fără email dublu). Outbox = nenecesar la altitudinea asta.
7. ✅ **SEC-06 — Ștergere cont + lifecycle date** (rezolvat 2026-06-28, vezi CHANGELOG). Ștergere cont = anonimizare
   (tombstone păstrează rândul → FK `details.authorId`/`sketches.authorId` rămân valide); cleanup blob avatar/cover la
   înlocuire ȘI la ștergere. *Export date (portabilitate) = încă manual.*
8. ✅ **SEC-08 — Security headers** (rezolvat 2026-06-28; **CSP întărit cu nonce 2026-06-29**, vezi CHANGELOG).
   Statice în `next.config.ts headers()`: nosniff + Referrer-Policy + X-Frame-Options DENY + Permissions-Policy +
   HSTS. **CSP cu NONCE per request** (`lib/csp.ts` + `proxy.ts`): `script-src` fără `'unsafe-inline'` (doar nonce
   + host vercel.live). Excepție deliberată: `style-src 'unsafe-inline'` (atributele `style` din React nu pot fi
   noncuite). *DE VERIFICAT în consola preview-ului (inclusiv toolbar-ul vercel.live).*
9. ✅ **SEC-09 — Dependențe** (evaluat 2026-06-28). `npm audit` = 6 moderate, **toate dev/build-time, zero în runtime**:
   (a) `esbuild ≤0.24.2` via `@esbuild-kit` → `drizzle-kit`; (b) `postcss <8.5.10` bundle-uit în `next`. Suntem pe
   **latest** la ambele (drizzle-kit 0.31.10, next 16.2.9) → niciun upgrade nu rezolvă; `--force` ar face downgrade
   major (drizzle-kit 0.18 / next 9), inacceptabil. **RISK-ACCEPTANCE:** fără modificări; tranzitive de tooling, nu
   ajung la useri. De re-evaluat când Next/drizzle-kit își update-ază tranzitivele.
10. **SEC-05 — PII verificare rol** *(cuplat cu feature-ul „verificare rol", acum PE HOLD).* Dacă feature-ul rămâne
    dezactivat, **ascunde fluxul de trimitere dovezi** ca să nu colectezi PII deloc. Dacă se activează: limită + structurare
    + flux admin de review + retenție/ștergere după decizie.

### FAZA 3 — hardening (înainte și imediat după lansare)

11. ✅ **SEC-11 — Validare centralizată inputuri** (rezolvat 2026-06-28, vezi CHANGELOG). Helper central `isUuid`
    (`server/domain/ids.ts`) aplicat la fiecare graniță de serviciu care primește un id de la client
    (detail/validation/comment/sketch) → UUID malformat dă „not found"/no-op, nu eroare SQL (500). Limite de
    lungime: `climateZone`/`seismicZone` (`MAX_ZONE_LENGTH=64`), URL resursă (`MAX_RESOURCE_URL_LENGTH=2048`),
    body TEXT (`DESCRIPTION_MAX_LENGTH`). Teste în `server/domain/ids.test.ts` + extinse detail/sketch/validation.
12. ✅ **SEC-13 — Matcher proxy** (rezolvat 2026-06-28, vezi CHANGELOG). `proxy.ts` exclude acum extensii statice
    EXPLICITE la finalul căii (svg/png/.../woff2) în loc de `.*\..*` → o rută viitoare cu punct în segment nu mai
    scapă tăcut de poarta de auth. Notă deny-by-default + „adaugă rute publice doar în PUBLIC_PATHS" în comentariu.
13. ✅ **SEC-14 — Audit trail** (rezolvat 2026-06-28, vezi CHANGELOG). Helper `lib/audit.ts` (edge-safe, fără
    `node:crypto`) emite evenimente JSON structurate în Vercel Runtime Logs, **fără PII brut** (id-uri hash-uite /
    userId uuid). Cablat central: `checkLimit` → `rate_limited` (cotă depășită, toate buckets, idHash); `proxy.ts`
    → `access_denied_suspended` (cont non-ACTIVE). **Alertele (rate/cost) se configurează în dashboard-urile Vercel
    Logs + Upstash** pe baza acestor evenimente (operațional, nu cod). Extensibil: suspendări/decizii admin când apar.
14. ✅ **SEC-12 — Invitații ELIMINATE** (2026-06-28, vezi CHANGELOG). Tot codul de invitații (serviciu/repo/tabel/env)
    a fost șters → constatarea nu mai are obiect. Dacă se reintroduc vreodată, se construiesc de la zero, sigur.

### FAZA 4 — igienă cod / corectitudine / UX (§11c, non-blocante)

15. ✅ **§11c #1** (rezolvat 2026-06-29, vezi CHANGELOG). Mutațiile de profil (avatar/cover/poziție/detalii) au
    trecut din Server Actions în `profileService` (`setAvatar`/`setCover`/`removeAvatar`/`removeCover`/
    `setCoverPosition`/`updateProfileDetails`); acțiunile rămân subțiri (extrag FormData → deleagă → revalidatePath).
16. ✅ **§11c #2** (rezolvat 2026-06-29). `zod` (nefolosit, zero importuri) scos din `package.json` + lockfile.
17. ✅ **§11c #3** (rezolvat 2026-06-29, vezi CHANGELOG). Activity-ul de profil afișează rolul din `roleSnapshot`
    (de la momentul votului); fallback la rolul curent DOAR pentru validările vechi fără snapshot. (Afișarea pe
    detaliu folosea deja snapshot-ul.)
18. ✅ **§11c #4 — erori silențioase** (rezolvat 2026-06-29, vezi CHANGELOG). `sendEmail` loghează eșecurile
    (config lipsă / Resend respins / rețea) fără PII; cleanup-ul de blob orfan din `image-processing` (5 locuri)
    trece prin `delOrphan` care loghează eșecul (nu mai e `.catch(()=>{})` tăcut). Restul catch-urilor sunt
    validare pură de input (isHttpUrl/normalizeWebsite/parseStrokes/sharp) — corecte, lăsate.
19. ✅ **§11c #5** (rezolvat 2026-06-29, vezi CHANGELOG). `maxLength={COMMENT_MAX_LENGTH}` pe toate textareele de
    justificare/comentariu (validation-panel, feed-validation-actions, comments-section creare+editare). Loading
    states pe butoane existau deja (`disabled={pending}` + text „Se trimite…/Se salvează…").

> **CI permanent (transversal):** `npm audit` + scanare de secrete + rularea testelor pe fiecare PR (SEC-09/10/14).
> **INFO-02** (`trustHost`) se validează în poarta de staging (§11), nu e un task separat.

## 11. Poarta finală de securitate pe staging

Ultima verificare **manuală, adversarială** înainte de a schimba verdictul din **BLOCAT** în **APPROVED**.
NU e cod de scris — controalele (SEC-01..14) sunt deja implementate și testate unitar; aici **încerci efectiv
să le spargi** pe preview, cu un checklist. Rulează pe URL-ul de preview al PR-ului (bază Neon `preview/dev`,
separată de producție). Bifează fiecare pas; orice rezultat ≠ „așteptat" = constatare de închis înainte de APPROVED.

### 11.0 — Pregătire (o singură dată)
- [ ] **3 conturi** pe preview, fiecare cu rol declarat (onboarding complet):
  - **A = autor** (publică ≥1 detaliu + ≥1 schiță proprie),
  - **B = străin** (alt user, fără legătură cu conținutul lui A),
  - **C = suspendat** (în Neon SQL editor pe `preview/dev`: `UPDATE users SET status='SUSPENDED' WHERE email='<C>';`).
- [ ] Notează ID-urile reale (detaliu, schiță, comentariu, validare) ale lui A — le folosești ca ținte IDOR.
- [ ] Ai deschis **DevTools → Network + Console** și știi să citești `Set-Cookie`, headerele de răspuns și CSP.

### 11.1 — Authz / IDOR (fiecare Server Action)  → *acoperă SEC-11, deny-by-default, audit.md #2/#4*
Logat ca **B**, încearcă să operezi pe obiectele lui **A** (din UI și prin replay POST în Network):
- [ ] ștergere detaliu al lui A → **403/NOT_FOUND**, nu 500, obiectul rămâne;
- [ ] accept/reject pe o schiță unde A e autorul detaliului-mamă → **respins** (doar A poate);
- [ ] editare profil / avatar / cover ale lui A → **respins**;
- [ ] marcare „citită" pe notificarea lui A → **respins**;
- [ ] vot/validare în numele altui user (modifică `userId` în payload) → **ignorat** (autorul vine din sesiune, nu din body);
- [ ] **UUID malformat** pe orice id (`...&id=abc`) → **not-found/no-op**, NU 500 (SEC-11);
- [ ] **deny-by-default**: deschis ca anonim (incognito) orice rută `(app)` → redirect `/login`, nu conținut.

### 11.2 — Cont suspendat (C)  → *SEC-04*
- [ ] login cu C → după magic link, orice rută protejată îl scoate cu `?error=AccessDenied`; nu poate publica/valida/comenta;
- [ ] mutația prin Server Action (replay POST) ca C → **respins pe server** (nu doar ascuns în UI).

### 11.3 — Magic link & rate limiting  → *SEC-01, INFO-02 (`trustHost`)*
- [ ] **replay**: folosește un link de acces, apoi accesează același URL a doua oară → **respins** (one-time);
- [ ] **expirare**: link mai vechi decât TTL → respins, mesaj „expirat", fără login;
- [ ] **enumerare**: cere link pt email inexistent → același răspuns ca pt unul existent (fără diferență observabilă);
- [ ] **rate limit**: cere repede >limită linkuri pe același email/IP → **429**; la fel pe validări/comentarii/upload;
- [ ] verifică în Vercel Logs evenimentul `rate_limited` (audit trail, fără PII brut).

### 11.4 — Upload (Blob)  → *SEC-02, SEC-06*
- [ ] **MIME fals**: redenumește `payload.html`/`.svg` în `.png` și încarcă → respins (validare pe conținut, nu pe extensie);
- [ ] **fișier corupt** (imagine trunchiată) → respins curat, fără 500;
- [ ] **imagine foarte mare** (>limita configurată, ex. >25MB) → respins;
- [ ] **volum repetat** (spam upload) → prins de rate limit;
- [ ] după **înlocuirea** unei poze, vechiul blob nu mai e accesibil (cleanup, SEC-06).

### 11.5 — URL-uri resurse  → *SEC-03*
La adăugarea unei resurse pe detaliu, încearcă pe rând și confirmă **respins**:
- [ ] `javascript:alert(1)` · `data:text/html,...` · `file:///etc/passwd` · scheme necunoscute (`foo://`);
- [ ] URL valid dar **foarte lung** (>2048) → respins (limită lungime);
- [ ] doar `http(s)://` trec.

### 11.6 — Concurență & dublu-submit  → *SEC-07*
- [ ] **accept + reject** pe aceeași schiță aproape simultan (2 taburi) → o singură tranziție de stare câștigă, fără stare coruptă;
- [ ] **dublu „SEND"** pe aceeași ciornă → o singură notificare/tranziție, nu două;
- [ ] dublu vot pe aceeași țintă → constrângerea unică `(userId,targetType,targetId)` ține (o poziție, reversibilă).

### 11.7 — Headers / cookie / CSP  → *SEC-08, SEC-13*
În Network, pe un răspuns de document:
- [ ] **CSP** prezent, cu **nonce per request** (se schimbă la fiecare reload), `script-src` fără `unsafe-inline`;
- [ ] Console **fără** erori CSP pe fluxurile reale (upload, vercel.live) — dacă apar, ceva legitim e blocat → de remediat;
- [ ] `Set-Cookie` sesiune = **HttpOnly + Secure + SameSite**; tokenul nu apare în JS (`document.cookie` nu-l vede);
- [ ] HSTS + celelalte security headers prezente.

### 11.8 — Igienă infra & dependențe
- [ ] `npm audit` rerulat → fără High neacceptat (vezi SEC-09 risk-acceptance);
- [ ] scanare de secrete pe repo (hook `block-secrets` + grep manual) → niciun secret în cod/loguri;
- [ ] `npm test` (suita de securitate) verde; `next build` verde;
- [ ] **rotația secretelor** posibilă (AUTH_SECRET, chei Resend/Blob/Upstash) fără downtime; **backup/restore** Neon verificat; **regiunea** procesatorilor (Resend/Blob/Neon) confirmată (GDPR — date în UE/zonă acceptată).

### 11.9 — Verdict
- [ ] Toate constatările **High închise**; **Medium** închise SAU acceptate explicit cu **owner + termen** (în SEC-09);
- [ ] SEC-05 (PII verificare rol) rămâne pe HOLD — nu blochează lansarea (fluxul de verificare e dezactivat în MVP);
- [ ] Schimbă verdictul din **BLOCAT** în **APPROVED** (sus în acest document) + notează data și cine a rulat poarta.

## 11b. Crosswalk consolidare — fiecare constatare din audit.md + opencode.md (2026-06-27)

`audit.md` (24 iun, aliniere FE↔BE) și `opencode.md` (26 iun, audit 100% cod) au fost **integrate aici și arhivate**.
Maparea de mai jos e **cap-la-cap**, ca să nu se piardă nimic. „Unde" = unde trăiește constatarea acum.

### Din `audit.md`
| # | Constatare | Unde acum |
|---|---|---|
| 1 | Verificarea rolului = flux fără ieșire (fără review admin) | **SEC-05** + matrice `requestVerificationAction` (deschis) |
| 2 | „Vezi profilul" deschidea persoana greșită | ✅ REZOLVAT — există `/profile/[userId]` |
| 3 | Linkul de categorie nu filtra feedul (`?category=slug` vs `cat`) | ✅ REZOLVAT — folosește `cat=<uuid>` |
| 4 | Aprob/Dezaprob din feed erau doar linkuri | ✅ REZOLVAT — `feed-validation-actions.tsx` face validare inline reală |
| 5 | Ciornele nu puteau fi reluate | ✅ REZOLVAT — există `/sketches/drafts` |
| 6 | Onboarding poate lăsa profil parțial (rol+profil neatomice) | matrice `onboardingAction` ⚠️ (deschis) |
| 7 | Accept/reject schiță neatomic (concurență) | **SEC-07** |
| 8 | URL-uri resurse nevalidate http/https | **SEC-03** |
| 9 | Snapshot de rol salvat dar ignorat la afișare | **§11c #3** |

### Din `opencode.md`
| Constatare | Unde acum |
|---|---|
| Rate limiting absent (auth, validări, comentarii, upload) | **SEC-01** |
| Eliminat `dev/login` din build | ✅ REZOLVAT — șters complet |
| Security headers lipsă (CSP/HSTS) | **SEC-08** |
| Upload abuzabil / validare insuficientă fișiere | **SEC-02** |
| Anti-IDOR (userId din sesiune) — confirmat OK | matrice §5 + §6 (pozitiv) |
| `trustHost: true` de revizuit | **INFO-02** |
| Docs `API.md`/`SCHEMA.md` stale | ✅ REZOLVAT — curățenie docs (CHANGELOG 2026-06-27) |
| Profile actions ocolesc service-ul | **§11c #1** |
| `zod` în dependențe, nefolosit | **§11c #2** |
| Erori silențioase (sendEmail/thumbnail best-effort) + resurse orfane | **§11c #4** (legat de SEC-02) |
| `maxLength` pe textarea justificare; loading states pe butoane | **§11c #5** (UX, low) |
| Website safety (`safeWebsite`) / hardcodări TTL/feed-size | confirmate OK (pozitiv/info) |

## 11c. Constatări non-securitate carry-over (igienă cod / corectitudine / UX)

1. **Profile actions ocolesc service-ul:** `updateAvatarAction` / `updateCoverAction` / `updateProfileDetailsAction`
   scriu direct în `usersRepo`, nu prin `profileService`. Nu e gaură (userId din sesiune), dar încalcă convenția pe straturi.
2. **`zod` în dependențe, nefolosit** — validările sunt manuale. De eliminat din `package.json` sau de adoptat în `domain`.
3. **Snapshot de rol ignorat la afișare:** `roleSnapshot` pe `validations` se salvează, dar afișarea face join cu rolul
   curent → schimbarea ulterioară a rolului rescrie retrospectiv validările vechi. (De reverificat în cod.)
4. **Erori silențioase + resurse orfane:** `sendEmail` înghite erorile (intenționat); thumbnail upload e best-effort;
   bloburile/resursele orfane la eșec nu au cleanup (legat de **SEC-02** — Neon HTTP nu are tranzacții interactive).
5. **UX (low):** `maxLength` pe textarea de justificare; loading states consistente pe butoanele de formular.

> Constatări deja **rezolvate** (nu mai sunt valabile): vezi coloana „REZOLVAT" din tabelele de mai sus.

## 12. Întreținerea documentului

1. Orice rută sau Server Action nouă primește un rând în matrice.
2. Marcajul ✅ se acordă numai după implementare și test negativ.
3. Schimbările Auth.js, storage, notificări, roluri sau admin cer re-auditarea amenințărilor aferente.
4. `npm audit` și scanarea de secrete rulează în CI.
5. La fiecare release se actualizează data, verdictul și constatările închise.
6. Acest fișier rămâne singurul document de securitate; rapoartele temporare se integrează aici, nu se păstrează în paralel.
