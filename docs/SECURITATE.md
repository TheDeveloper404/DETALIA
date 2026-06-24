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

`lib/admin.ts` oferă allowlist `ADMIN_EMAILS` și `requireAdmin()`, deny-by-default. Nu există însă rute sau Server Actions admin active. Reviewul invitațiilor și verificarea rolurilor sunt doar planificate.

### Dormant

Serviciul de invitații există, dar nu este cablat în signup. Înregistrarea curentă este publică.

## 5. Matricea suprafeței active

| Suprafață reală | Auth | Validare server | Authz/ownership | Anti-abuz | Test | Stare |
|---|---|---|---|---|---|---|
| Magic link — `signInWithEmailAction` | public | Auth.js + input HTML | n/a | ❌ | ❌ | **BLOCKER:** fără rate limit/cooldown |
| `onboardingAction` | ✅ | manual + domain role | user din sesiune | ❌ | ❌ | ⚠️ rol și profil neatomice |
| `updateAvatarAction` | ✅ | MIME declarat + mărime | user din sesiune | ❌ | ❌ | ⚠️ validare fișier insuficientă |
| `updateRoleAction` | ✅ | domain role/subrol | rolul userului | ❌ | ❌ | ⚠️ structural corect |
| `requestVerificationAction` | ✅ | doar non-empty | rolul userului | ❌ | ❌ | ❌ fără review admin/limită/retention |
| `createDetailAction` | ✅ | manual + domain | autor din sesiune, rol cerut | ❌ | ❌ | ⚠️ upload înainte de validarea completă |
| `approveAction` | ✅ | target type/existență | poziția userului | ❌ | ❌ | ⚠️ structural corect |
| `retractAction` | ✅ | target type | șterge numai poziția userului | ❌ | ❌ | ⚠️ structural corect |
| `disapproveAction` | ✅ | target + justificare | poziția userului | ❌ | ❌ | ⚠️ justificare corect impusă |
| `addCommentAction` | ✅ | target + corp | autor din sesiune | ❌ | ❌ | ⚠️ structural corect |
| `startSketchAction` | ✅ | rol + detaliu existent | autor din sesiune | ❌ | ❌ | ⚠️ fără cotă de ciorne |
| `saveStrokesAction` | ✅ | structură/limite strokes | numai autorul schiței | ❌ | ❌ | ⚠️ structural corect |
| `sendSketchAction` | ✅ | strokes + state machine | numai autorul schiței | ❌ | ❌ | **BLOCKER:** thumbnail urcat înainte de authz |
| `accept/rejectSketchAction` | ✅ | stare schiță | autorul detaliului-mamă | ❌ | ❌ | ⚠️ tranziție neatomică |
| `markReadAction` | ✅ | n/a | notificările userului | ❌ | ❌ | ✅ scope anti-IDOR corect |
| Pagini protejate | ✅ | params parțial | guards locale | n/a | ❌ | ⚠️ neverificat end-to-end |
| Rute/actions admin | n/a | n/a | helper existent | n/a | ❌ | ❌ neimplementate |

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
- Preview-urile `/dev` sunt blocate în producție prin două bariere.

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

#### SEC-12 — Invitațiile dormante au token în clar și consum neatomic

Nu există rută activă, dar activarea codului curent ar permite ca două consumări concurente să treacă validarea; tokenul este stocat în clar.

**Dovezi:** `db/schema.ts:150-160`, `server/services/invitationService.ts:48-66`, `server/repos/invitationsRepo.ts:27-37`.

**Remediere înainte de activare:** stocarea hashului și update atomic cu `used_at IS NULL AND expires_at > now()`.

#### SEC-13 — Matcherul proxy exclude generic căile care conțin punct

Patternul `.*\..*` poate omite viitoare rute cu extensie. Rutele active au guards locale, deci nu a fost găsit bypass actual.

**Dovadă:** `proxy.ts:38-42`.

**Remediere:** excluderi explicite pentru asseturi și guard local obligatoriu pe orice rută nouă.

#### SEC-14 — Nu există audit trail sau monitorizare de securitate

PII nu este logat, ceea ce este corect, dar lipsesc evenimente pentru volum anormal, suspendări, decizii admin, eșecuri repetate și cote depășite.

**Remediere:** evenimente structurate fără PII brut, correlation ID, alerte pe rate/cost și retenție controlată.

### Informativ

#### INFO-01 — Signupul este public; invitațiile sunt inactive

Acesta este comportament declarat, nu bypass. Dacă produsul trebuie să rămână beta închis, invitațiile trebuie finalizate înainte de publicarea domeniului.

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
- Tokenurile de invitație și magic link trebuie să fie one-time și să expire.
- Orice viitoare suprafață `/admin` trebuie să cheme `requireAdmin()` server-side; ascunderea UI nu este authz.

## 10. Plan și porți de remediere

### P0 — înainte de orice trafic public

- SEC-01: limiter distribuit și cote;
- SEC-02: validare reală a fișierelor, reordonarea uploadurilor și cleanup;
- SEC-03: allowlist URL;
- SEC-04: blocarea conturilor suspendate.

### P1 — înainte de production-ready

- SEC-05/06: retenție PII, ștergere cont și Blob lifecycle;
- SEC-07: tranziții atomice și notificări idempotente;
- SEC-08: security headers;
- SEC-09: actualizare sau risk acceptance documentat pentru advisories;
- SEC-10: teste authz și anti-abuz.

### P2 — hardening înainte și imediat după lansare

- validare centralizată pentru toate inputurile;
- audit trail și alerte;
- hardening invitații înainte de activare;
- scanare automată de dependențe și secrete în CI.

## 11. Poarta finală de securitate pe staging

Înainte de schimbarea verdictului în APPROVED:

- test cu minimum trei conturi: autor, utilizator străin și cont suspendat;
- încercări IDOR pentru fiecare Server Action;
- magic-link replay, expirare, enumerare și rate limiting;
- upload MIME fals, fișiere corupte, imagini foarte mari și volum repetat;
- URL-uri `javascript:`, `data:`, scheme necunoscute și URL-uri foarte lungi;
- accept/reject concurent și duplicate submit;
- verificarea cookie-urilor, CSP și a tuturor security headers;
- verificarea rotației secretelor, backup/restore și regiunii procesatorilor;
- rerulare `npm audit`, teste și scanare de secrete;
- toate constatările High închise și Medium fie închise, fie acceptate explicit cu owner și termen.

## 12. Întreținerea documentului

1. Orice rută sau Server Action nouă primește un rând în matrice.
2. Marcajul ✅ se acordă numai după implementare și test negativ.
3. Schimbările Auth.js, storage, notificări, roluri sau admin cer re-auditarea amenințărilor aferente.
4. `npm audit` și scanarea de secrete rulează în CI.
5. La fiecare release se actualizează data, verdictul și constatările închise.
6. Acest fișier rămâne singurul document de securitate; rapoartele temporare se integrează aici, nu se păstrează în paralel.
