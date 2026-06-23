# CHANGELOG — DETALIA

Jurnal detaliat al modificărilor, cu dată. Cel mai recent sus.

---

## 2026-06-23

### Design — restul suprafețelor pe shadcn (migrare completă)
- **profil** (`page.tsx` + `profile-forms.tsx`): Button/Input/Label + select stilizat + alerte pe tokeni.
- **notificări** (`page.tsx`): listă + empty-state pe tokeni (unread = `bg-muted/50`).
- **header + clopoțel** (`app-header.tsx`, `notification-bell.tsx`): tokeni (badge necitite rămâne roșu = semnal).
- **`/details/new`** (`detail-form.tsx` + `page.tsx`): Input/Textarea/Label/Button + preview pe `ring`.
- **editor schiță** (`sketch-canvas.tsx`, `sketch-editor`, `sketch-viewer`, `edit/page.tsx`): chrome-ul (toolbar/butoane/
  suprafață/alertă) pe `Button` + tokeni; **logica de desen și `STROKE_COLORS` neatinse**.
- **`author-badge.tsx`** tokenizat (folosit peste tot). **Migrarea design pe shadcn = COMPLETĂ** — zero `zinc-*`/`dark:` rămase
  în afară de culorile semantice intenționate (emerald=aprobă/salvat, destructive=dezaprobă, roșu=badge necitite, amber=★ verificat,
  culorile creionului). `lint`+`build` VERZI.

### Design — pagina de detaliu pe shadcn (`/details/[id]` + sub-componente)
- Adăugat `textarea`. **`page.tsx`** — back-link + descriere + imagine + resurse pe tokeni; categoria = `Badge`.
- **`validation-panel.tsx`** — pe `Button` (Aprob default/outline; Dezaprob destructive/outline) + `Textarea`; carcasă pe
  `bg-card`/`ring`. Păstrate culorile semantice (aprobă=emerald, dezaprobă=destructive) ca afordanță, restul pe tokeni.
- **`comments-section.tsx`** — `Textarea` + `Button`; tag „dezaprobare" = `Badge` destructive.
- **`sketch-section.tsx`** — taburi teanc + accept/respinge pe `Button` (accept=primary, drop emerald); secțiunea „în așteptare"
  pe `bg-card`/`ring` cu `Badge` în loc de wash amber. Logica (state machine, authz, polimorfism) neatinsă. VERZI.

### Design — feed pe shadcn (`Badge`/`Button` + tokeni)
- Adăugat `badge`. **`detail-card.tsx`** — card pe tokeni (`bg-card`/`ring-foreground/10`), categoria devine `Badge` secondary.
- **`category-filter.tsx`** — chip-uri pe `Button asChild` (default=activ / outline=inactiv, `rounded-full`).
- **`app/feed/page.tsx`** — „Adaugă detaliu" pe `Button`, header + empty-state pe tokeni (`text-muted-foreground`, `border-border`).

### Design — onboarding pe shadcn (`Card`/`Button`/`Input`/`Label`)
- **`app/onboarding/page.tsx`** — wrap în `Card` (titlu + descriere), tokeni de temă.
- **`app/onboarding/role-form.tsx`** — `Button` + `Label` + `Input` (file) + alertă `destructive`. Logica neschimbată.
  **`select` rol/subrol rămâne native** (stilizat ca Input) — subrolul are opțiune goală, iar Radix Select interzice
  `value=""` → native = robust + submit curat în server action, fără sentinel.

### Design — login + signup pe shadcn (`Card`/`Input`/`Label`/`Button`)
- Adăugate componente shadcn: `card`, `input`, `label`, `separator`.
- **`components/auth-form.tsx`** — rescris pe `Button` (outline pt Google, default pt email) + `Input` + `Label`, tokeni de temă.
  Logica neschimbată (Google + magic link, două server actions, hidden `callbackUrl`/`authPath`).
- **`app/login` + `app/signup`** — wrap în `Card` (header titlu+descriere + content), alertă de eroare pe tokeni `destructive`.
  **Confirmat cu Liviu: păstrăm două pagini** (signup→`/onboarding`, login→`/`) — diferă doar copy-ul + destinația; mecanic e
  același flux passwordless. Garanția new-vs-returning rămâne check-ul de rol, nu pagina. VERZI.

### Design — fundație shadcn/ui + landing minimalist
- **shadcn/ui inițializat** (`init -d --base radix`): `components.json`, `lib/utils.ts` (`cn`), `components/ui/button.tsx`,
  dependențe (radix-ui, cva, clsx, tailwind-merge, lucide). `globals.css` rescris cu tokeni de temă (oklch, light + `.dark`).
- **Fix gotcha Tailwind v4:** init-ul a stricat fontul (`--font-sans: var(--font-sans)`, circular) → re-legat la
  `var(--font-geist-sans)`/`var(--font-geist-mono)` (variabilele încărcate de `layout.tsx`). Acum aplicația folosește Geist
  (înainte body cădea pe Arial). Dark mode devine class-based (`.dark`) — fără toggle deocamdată (light-only).
- **Landing (`app/page.tsx`) — redesign minimalist** (direcție „centrat, esențial" aleasă de Liviu): wordmark + o frază +
  CTA pe componenta `Button` (default + outline) / „Mergi la feed" pt logați. Tokeni de temă, fără hex ad-hoc. VERZI.

### Pagina de profil (`/profile`) — editare poză/rol + „Verifică rolul" (Poarta 2)
- **`app/profile/page.tsx`** — server component: avatar + `AuthorBadge` (nume/rol/★) + email (read-only).
  Logat fără rol → redirect `/onboarding`. Trei secțiuni: poză, rol, verificare + buton de deconectare.
- **`app/profile/profile-forms.tsx`** (client) — `AvatarForm`, `EditRoleForm` (pre-completat, subrol resetat la
  schimbarea rolului principal), `VerificationSection`/`VerificationForm`, `SignOutButton`. Feedback succes/eroare.
- **`app/profile/actions.ts`** — `updateAvatarAction` (reuse `uploadAvatarImage`+`updateUserImage`),
  `updateRoleAction`, `requestVerificationAction`, `signOutAction`. userId din sesiune; `revalidatePath`.
- **`server/services/roleService`** — `getUserRole`, `updateRole` (validare rol/subrol + **reset verificare la DECLARED**
  dacă revendicarea se schimbă), `requestRoleVerification` (DECLARED/REJECTED → PENDING; respinge dacă deja VERIFIED/PENDING/dovadă goală).
- **`server/repos/rolesRepo`** — `updateRoleClaim`, `setRoleVerificationPending` (dovada OAR/CUI = PII, nu se loghează).
- **`server/repos/usersRepo`** — `getUserProfile` (nume/email/poză).
- **`components/app-header.tsx`** — adăugat avatar-link spre `/profile` lângă clopoțel.
- **Aprobarea verificării (latura admin) = task separat** (nu există încă admin UI). `typecheck`+`lint`+`build` VERZI.

## 2026-06-22

### Schițare — pas 6: dezbatere pe schiță (validare + comentarii polimorfice)
- **Generalizat UI-ul de la `DETAIL` la orice target:** `validation-actions` + `validation-panel` și `comment-actions`
  + `comments-section` primesc acum `targetType` + `targetId` (+ `detailId` = pagina de revalidat). Butonul „Dezaprob
  și fac o schiță" apare doar pe DETAIL (`allowSketch`).
- **`sketch-section`** — pe schița activă din teanc montează `ValidationPanel` + `CommentsSection` cu `targetType=SKETCH`
  (reuse total; dezbaterea per schiță vine „gratis", cum prevedea schema polimorfică).
- **Pagina de detaliu** — pasează `targetType="DETAIL"` + îmbogățește fiecare schiță publicată cu validarea + comentariile ei.
- **Schițarea = COMPLETĂ** (pașii 1–6): nucleu server → canvas → editor (din Dezaprob) → teanc/review → notificări → dezbatere.
- `typecheck`+`lint`+`build` VERZI.

### Schițare — pas 5: clopoțel notificări + pagina de notificări
- **Header global** (`components/app-header.tsx` în `app/layout.tsx`) — apare DOAR pentru useri autentificați:
  logo „DETALIA" → feed + **clopoțel** (`components/notification-bell.tsx`) cu badge de necitite.
- **`server/services/notificationService`** — citiri: `getNotifications`, `getUnreadCount`, `markNotificationsRead`.
- **`app/notifications/`** — `page.tsx` (listă, necitite evidențiate, link la detaliu, gol-state), `actions.ts`
  (`markReadAction` — userId din sesiune), `mark-read-on-view.tsx` (la deschidere marchează citite + `router.refresh()`
  → clopoțelul se golește). Protejat de proxy deny-by-default.
- Notă: layout-ul citește sesiunea → toate rutele devin dinamice (corect pt această aplicație). `typecheck`+`lint`+`build` VERZI.
- **Rămas (ultimul pas schițare):** dezbatere (validare/comentarii) pe pagină proprie de schiță publicată.

### Schițare — pas 4: UI autor-mamă (teanc + accept/respinge)
- **`components/sketch/sketch-viewer.tsx`** — viewer read-only: imaginea-mamă (intensitate normală) + stroke-uri deasupra.
- **`app/details/[id]/sketch-section.tsx`** — pe pagina de detaliu: **teancul** (taburi „Original" + schițe PUBLISHED,
  navigabile, cu autor+rol) + **coada de review** (doar autorul-mamă) cu butoane **Acceptă/Respinge** (fără justificare).
- **`app/details/[id]/sketch-review-actions.ts`** — `acceptSketchAction`/`rejectSketchAction` (authz în `sketchService`:
  doar autorul-mamă; PENDING→PUBLISHED/REJECTED + notifică autorul schiței). `actorUserId` din sesiune.
- **`sketchesRepo`** — `strokesJson` inclus în query-urile teanc/coadă (randare în pagină); `getTeanc`/`getPendingForOwner` îl expun.
- **Bucla de schițare e acum completă funcțional:** Dezaprob → desen → trimite → autor-mamă acceptă → intră în teanc (public).
- `typecheck`+`lint`+`build` VERZI. **Urmează:** clopoțel notificări + dezbatere (validare/comentarii) pe schiță.

### Schițare — pas 3: pagina-editor (din fereastra de Dezaprob)
- **Enforcement „schițarea doar din Dezaprob":** editorul cere un DRAFT existent, iar draftul se creează **doar** de
  acțiunea de Dezaprob → nu există altă cale către editor. Buton nou „Dezaprob și fac o schiță" în panoul de validare
  (intent `sketch`): `disapproveDetailAction` face dezaprobarea (justificare obligatorie) → `createDraft` → redirect editor.
- **`app/sketches/[id]/edit/`** — `page.tsx` (guard `auth()` + `getDraftForEdit` = doar autorul, doar DRAFT → altfel 404),
  `sketch-editor.tsx` (leagă `SketchCanvas` de actions, stări pending/error/„salvat"), `sketch-actions.ts`
  (`saveStrokesAction`; `sendSketchAction` = upload thumbnail → `sketchService.send` → redirect la detaliu).
- Protejat de proxy deny-by-default + guard pagină + authz în service. `typecheck`+`lint`+`build` VERZI.
- **Urmează:** UI autor-mamă (teanc/taburi + accept/respinge) + clopoțel notificări + dezbatere pe schiță.

### Fix securitate (XSS în email) în `server/services/notificationService.ts`
- `detailTitle` / `sketchAuthorName` (user-controlled) intrau neescapate în HTML-ul de email → XSS stocat. **Fix:**
  helper `esc()` (HTML-escape) pe toate valorile interpolate + `plain()` pe subiect (anti header-injection).
  (Flag de la security review automat; MEDIUM, rezolvat.)

### Schițare — pas 2: canvas de desen (perfect-freehand)
- **Dependență nouă:** `perfect-freehand`. **`lib/sketch-render.ts`** — `renderStrokes(ctx, strokes, w, h)` partajat
  (editor + viewer); coordonate normalizate 0..1, grosime scalată față de `REFERENCE_WIDTH=1000`.
- **`components/sketch/sketch-canvas.tsx`** — editor: desen peste imaginea-mamă **slabă (fill 0.3)**, unelte MVP
  (6 culori stridente + 3 grosimi + radieră + undo/redo), pointer events (mouse/touch/pen), output stroke-uri
  normalizate. La „Trimite" randează **thumbnail PNG** client-side (best-effort, taint CORS → null). Butoane
  „Salvează ciorna" / „Trimite propunerea" (handlerele = props, cablate la pasul 3).
- **`lib/storage.uploadSketchThumbnail`** (Blob PNG → Blob `sketches/`). `STROKE_WIDTHS` ajustate la [8,16,28] (vizibile).
- Fix lint (React Compiler strict): fără assignment de ref în render; `ResizeObserver` în loc de listener manual.
- `typecheck` + `lint` + **build VERZI**. **Urmează:** editor-page (din fereastra de Dezaprob) + UI autor mamă (teanc/review) + clopoțel notificări.

### Schițare — pas 1 (CRITICAL): nucleul de server (state machine + notificări)
- **`server/domain/sketch.ts`** — `SKETCH_STATUS`, paletă (culori stridente + 3 grosimi), tip `Stroke` (puncte
  normalizate 0..1) + `validateStrokes` (structural + limite anti-abuz: max 2000 stroke-uri / 10000 puncte / size 100).
- **`server/repos/sketchesRepo.ts`** — `insertDraft`, `getSketchById`, `updateStrokes`, `updateStatus`,
  `listPublishedByDetail` (teancul), `listPendingByDetail` (coadă review), cu autor nume+rol.
- **`server/repos/notificationsRepo.ts`** + **`server/repos/usersRepo.getUserContact`** — notificări in-app + contact.
- **`lib/email.ts`** — trimitere best-effort via Resend REST (no-op fără credențiale; fără PII logat).
- **`server/services/notificationService.ts`** — in-app (mereu) + email (best-effort) pentru SKETCH_PROPOSED/ACCEPTED/REJECTED.
- **`server/services/sketchService.ts`** — state machine + authz: `createDraft`, `saveStrokes`, `send`
  (DRAFT→PENDING_ACCEPTANCE + notifică autorul mamă), `accept`/`reject` (doar autorul mamă; →PUBLISHED/REJECTED +
  notifică autorul schiței), `getTeanc`, `getPendingForOwner`, `getDraftForEdit`, `getPublishedSketch`.
- **Datorie veche închisă:** validarea/comentariile pe **SKETCH** activate (`validationService.targetExists` →
  schițe PUBLISHED). Dezbaterea per schiță vine gratis (polimorfic).
- **Securitate:** `actorUserId` din sesiune (fără IDOR); doar autorul schiței editează/trimite, doar autorul mamă
  acceptă/respinge; tranziții invalide respinse; stroke-uri validate; fără PII logat. `typecheck`+`lint`+`build` VERZI.
- **Urmează:** canvas perfect-freehand (desen + thumbnail PNG) + UI (editor din fereastra de Dezaprob, teanc/taburi, review autor mamă).

### Faza 0.5 (CRITICAL — auth): Google OAuth + signup public + onboarding cu poză
- **Google OAuth** (`lib/auth.ts`): provider `Google` adăugat lângă Resend; `allowDangerousEmailAccountLinking: true`
  (linkare pe email sigură — ambele fluxuri passwordless dovedesc deținerea email-ului). Env noi în `.env.example`:
  `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` (+ redirect URI documentat).
- **Auth public partajat** (`app/auth-actions.ts` + `components/auth-form.tsx`): „Continuă cu Google" + magic link pe
  email, reutilizat de `/login` și `/signup`. `redirectTo` sanitizat la same-origin de Auth.js (fără open-redirect).
- **`/signup` (public)** — înregistrare deschisă (fără invitație); după auth → `/onboarding`. **`/login`** rescris
  (Google + email, link spre signup). Texte „beta închis / invitație" **eliminate**. Proxy: `/signup` adăugat la public.
- **Landing `/`** — acum dinamic: CTA „Creează cont" / „Autentificare" pentru vizitatori, „Mergi la feed" pentru cei logați.
- **Onboarding cu poză** — `lib/storage.ts` refactorizat (`validateImageFile` + `uploadAvatarImage`); `usersRepo.updateUserImage`;
  `app/onboarding` acceptă poză opțională (validare ieftină înainte de declararea rolului, upload best-effort după).
- **Securitate:** rutele rămân deny-by-default (doar `/`,`/login`,`/signup` publice); fără secrete în cod; fără PII logat.
  `typecheck` + `lint` + **build VERZI**. Testare end-to-end Google/magic link → cere credențiale reale (Edi/Liviu).

### Fix securitate (open-redirect) în `app/auth-actions.ts`
- `authPath` (client-controlled, din formular) era interpolat direct în `redirect()` → un `//evil.com` ar fi fost
  protocol-relative (redirecționare externă post-eroare auth). **Fix:** whitelist strict `safeAuthPath()` → doar
  `/login` | `/signup`, + `encodeURIComponent` pe `error.type`. (Flag de la security review automat; MEDIUM, rezolvat.)
  `callbackUrl` era deja sigur — sanitizat same-origin de Auth.js. `typecheck` + `lint` VERZI.

### Faza 1 — pas 5: comentarii (afișare + adăugare)
- **`server/domain/validation.ts`** — `validateCommentBody` (aceleași limite ca justificarea).
- **`server/services/commentService.ts`** — `addComment` (enforce: rol declarat, corp non-vid ≤5000, țintă
  `PUBLISHED`, `authorId` din sesiune) + `getComments`. Refolosește `targetExists` (exportat din `validationService`).
- **`app/details/[id]/comment-actions.ts`** + **`comments-section.tsx`** — listă cronologică (nume+rol+★, badge
  „dezaprobare" pe comentariile cu `originValidationId`) + form de adăugare (reset pe succes). Cablate în pagină.
- Justificările-dezaprobare de la pas 4 **devin acum vizibile** în coloana de comentarii. Polimorfic (Detail acum).
- `typecheck` + `lint` + **build VERZI**. **Faza 1 (detaliu + feed + validare + comentarii) = încheiată structural.**

### Faza 1 — pas 4 (CRITICAL): validarea pe roluri (INIMA)
- **`server/domain/validation.ts`** — poziții (APPROVE/DISAPPROVE), target (DETAIL/SKETCH), `validateJustification`
  („nu există dezaprobare mută"), tip `RoleSnapshot`.
- **`server/repos/validationsRepo.ts`** — `getUserPosition`, `upsertPosition` (**`onConflictDoUpdate` pe constrângerea
  unică** `(userId,targetType,targetId)` = o poziție/user, reversibilă), `deletePosition`, `listPositionsForTarget`
  (cu nume+rol curent).
- **`server/repos/commentsRepo.ts`** — `insertComment` (cu `originValidationId`) + `listCommentsForTarget` (pt pas 5).
- **`server/services/validationService.ts`** — `approve` (1 click, idempotent), `disapprove` (justificare OBLIGATORIE
  → respinsă fără ea; devine automat `Comment` cu `originValidationId`; fără duplicate la re-trimitere), `retract`
  (reversibilitate; comentariul rămâne în dezbatere), `getTargetValidationView` (poziții + totaluri + poziția mea).
  Polimorfic (DETAIL acum; SKETCH reuse la schițare). Snapshot rol la momentul poziției.
- **`app/details/[id]/validation-actions.ts`** + **`validation-panel.tsx`** — butoane Aprob/Dezaprob (identice),
  form justificare la Dezaprob, „Retrage poziția", listă poziții cu rol (+ ★ verificat). Cablat în pagina de detaliu.
- **Securitate (CRITICAL):** `userId` EXCLUSIV din sesiune (fără IDOR — upsert/delete keyed pe userul sesiunii);
  poziția cere rol declarat (`NO_ROLE`→onboarding); justificarea enforce pe server (echivalent **422**), nu doar în
  HTML; doar ținte `PUBLISHED`; fără 404 ascuns; fără PII logat; constrângerea unică DB ca plasă de siguranță.
  `typecheck` + `lint` + **build VERZI**. (Audit formal 13-cat disponibil la cerere înainte de merge în `main`.)

### Faza 1 — pas 3: pagina de detaliu (`/details/[id]`)
- **`server/repos/detailsRepo.ts`** — `getDetailResources(detailId)` (cele 0–3 resurse atașate).
- **`server/services/detailService.ts`** — `getDetail` validează acum **formatul UUID** (id malformat → `null` → 404,
  nu eroare SQL/500) și întoarce detaliul + `resources`.
- **`app/details/[id]/page.tsx`** — guard `auth()`; `getDetail` → `notFound()` dacă lipsește. Layout pe 2 coloane:
  detaliul (categorie + titlu + `AuthorBadge` + descriere + imagine `next/image` + listă resurse) și o coloană
  laterală cu **placeholdere marcate** pentru panoul de validare (pas 4) și comentarii (pas 5). Link „înapoi la feed".
- Cardurile din feed (link spre `/details/[id]`) **nu mai dau 404**. Protejat de proxy deny-by-default.
- `typecheck` + `lint` + **build VERZI**.

### Faza 1 — pas 2: feed finit + filtre pe categorii + sortare după interacțiuni
- **`listFeed` sortează acum după interacțiuni** (validări + comentarii polimorfice pe DETAIL + schițe PUBLISHED),
  tie-break după dată — via subquery-uri corelate (fără dublare pe join). Achită datoria de la pas 1 (era după dată).
  `FeedItem` expune `interactionCount`.
- **`next.config.ts`** — `images.remotePatterns` pentru `**.public.blob.vercel-storage.com` (afișare cu `next/image`).
- **Componente noi** (`components/`): `author-badge.tsx` (nume + rol + **steluță galbenă** la rol VERIFICAT),
  `detail-card.tsx` (imagine `next/image` + titlu + excerpt + autor/rol + categorie, link spre `/details/[id]`),
  `category-filter.tsx` (chip-uri link, „Toate" + per categorie; MVP plat, refinare arbore ulterior).
- **`app/feed/page.tsx`** — suprafața autenticată principală: guard `auth()`, feed finit (~20, fără scroll infinit),
  filtru pe categorie via `?cat=` (acceptat doar dacă e categorie reală), grilă responsivă, **stare empty**, buton
  **„Adaugă detaliu"** (cablează linkul lipsă către `/details/new`). Protejat de proxy deny-by-default.
- `typecheck` + `lint` + **build VERZI**. Testabil end-to-end după seed (categorii + detalii) + `DATABASE_URL`/Blob.

### Faza 1 — pas 1 (cont.): wiring Blob + UI „Adaugă detaliu"
- **Dependență nouă:** `@vercel/blob`. **`lib/storage.ts`** — `uploadDetailImage(file)` cu validare pe SERVER
  (tip ∈ PNG/JPG/WebP/AVIF, max **8 MB**); urcă în Blob (acces public, nume uuid) și întoarce URL-ul.
  Tokenul `BLOB_READ_WRITE_TOKEN` (deja în `.env.example`) e citit automat de `put()`.
- **`server/services/categoryService.ts`** — `listCategories()` pentru UI (UI citește prin service, nu repo).
- **`app/details/new/`** — pagină + form + action „Adaugă detaliu":
  - `page.tsx` (RSC): guard `auth()` + `userHasRole` → fără sesiune `/login`, fără rol `/onboarding`; stare empty
    dacă nu există categorii.
  - `detail-form.tsx` (client): titlu/descriere/categorie/imagine + **preview local** + stări loading/error.
  - `actions.ts` (server action): **`authorId` EXCLUSIV din sesiune**; guard ieftin înainte de upload (evită blob
    orfan); upload imagine → `createDetail`; `NO_ROLE` → redirect `/onboarding`. Redirect post-creare → `/` (feed
    vine la pasul 3).
- **Securitate:** rută protejată de proxy deny-by-default (`/details` nu e public) **+** guard în pagină + enforce
  în service — trei straturi. `typecheck` + `lint` + **build VERZI**.

### Faza 1 — pas 1: stratul `server/` pentru Detaliu (domain + repo + service)
- **`server/domain/detail.ts`** — reguli pure: status (`PUBLISHED`/`REMOVED`), limite (titlu ≤200, descriere ≤5000,
  **max 3 resurse**, feed implicit **20**), tipuri de resurse (IMAGE/LINK/TEXT/PDF) + `validateDetailInput()` care
  normalizează și respinge inputul invalid (titlu obligatoriu, imagine obligatorie, resurse validate pe tip).
- **`server/repos/categoriesRepo.ts`** — `getCategoryById` (existență) + `listCategories` (pentru filtre/form).
- **`server/repos/detailsRepo.ts`** — `insertDetail`, `insertDetailResources`, `getDetailById` și `listFeed`
  (ambele cu autor nume+rol+verificare + categorie, doar `PUBLISHED`). Feed sortat provizoriu după `createdAt`
  (TODO pas 2: sortare „după interacțiuni"). Toate prin `leftJoin` pe `categories`/`users`/`roles`.
- **`server/services/detailService.ts`** — `createDetail` enforce pe SERVER: (1) **autor cu rol declarat**
  (`userHasRole`, nu doar admin/seed, nu trebuie verificat) → altfel `NO_ROLE`; (2) validare/normalizare;
  (3) categorie existentă → altfel `INVALID_CATEGORY`; (4) insert detaliu + resurse. Plus `getDetail` și `getFeed`.
- **Upload Blob ținut în afara service-ului** (primește `imageUrl` rezolvat) — clean architecture, business testabil
  fără infra. Wiring-ul Blob + UI = pașii următori. `typecheck` + `lint` VERZI. Fără UI, fără migrație.

### Schemă: `details.description` (text liber „deasupra" imaginii, stil post)
- Adăugat coloana **`description` (text, nullable)** pe `details` — caption/text bogat afișat deasupra imaginii
  (model post LinkedIn). `title` rămâne obligatoriu; `description` e opțional. Decizie de produs (Edi).
- Migrație **`0001_familiar_darkhawk.sql`** (`ADD COLUMN`, reversibilă prin `DROP COLUMN`). `typecheck` VERDE.
- **Doc afectate:** `db/schema.ts`, `docs/SCHEMA.md` (tabel `details`). Rulare pe DB (`db:push`/`db:migrate`)
  blocată de lipsa `DATABASE_URL` — migrația e generată și gata de aplicat.

### Decizii de produs confirmate de Edi (răstoarnă câteva decizii „confirmat/HOLD" anterioare)
- **Login: passwordless = magic link (Resend) + Google OAuth** („Continuă cu Google"). **Fără parolă** (s-a
  clarificat ambiguitatea „parolă vs magic link" → rămâne passwordless, se adaugă Google).
- **Acces PUBLIC** (înregistrare deschisă) — se renunță definitiv la beta pe invitație. Schela `Invitation`
  rămâne **dormantă** în cod (neutilizată), nu se cablează în signup. Flux: landing → creare cont → email magic
  link → onboarding profil (rol, subrol, poză) → feed.
- **Upload de detalii DESCHIS** oricărui user cu rol declarat (nu mai e seed-only/admin-only). Moderare
  post-publicare; fără cozi de aprobare în MVP.
- **Taxonomia categorii + subroluri** — OK pentru MVP (draftul curent e suficient; Edi se mai gândește la roluri).
- **Seed 50–100 detalii** (~2/categorie), prin conturi reale (Edi + useri din toate categoriile + portofoliul Edi).
- **Pe HOLD (neschimbat):** lista fixă zone climatice/seismice; sursele de verificare automată a rolului.
- **Doc afectate:** `CLAUDE.md` (Stack, Glosar, Poarta 1, Upload, Divergență Backend.md, Decizii confirmate/deschise).
  Cod neatins în acest set — doar aliniere de decizii. (Implementarea Google OAuth + onboarding poză = task viitor.)

---

## 2026-06-20

### Fix CI: warning Node 20 deprecated pe GitHub Actions
- `actions/checkout@v4`→`v5`, `actions/setup-node@v4`→`v5` (rulează nativ pe Node 24, nu mai sunt forțate de pe Node 20).
- `node-version: 20`→`24` (LTS curent) pentru build-ul aplicației. Doar workflow CI; cod neafectat.

### Faza 0 — pasul 5 (complet): cont admin/seed + authz admin
- **Model admin (decizie):** NU există coloană `is_admin` — admin = user normal al cărui email e în allowlist-ul
  **`ADMIN_EMAILS`** (env, separat prin virgulă), deny-by-default. Fără migrație, reversibil; un admin rămâne rând
  în `users` (deci poate fi autor de detalii / `created_by_admin_id`).
- **`lib/admin.ts`** — `isAdminEmail` · `isAdminSession` · `requireAdmin()` (guard pt rute/acțiuni admin, aruncă
  `FORBIDDEN`; callerul decide 403 vs redirect).
- **`db/seed.ts`** + script **`db:seed`** (tsx) — creează idempotent conturile din `ADMIN_EMAILS` (`onConflictDoNothing`
  pe email). Încarcă `.env.local` apoi `.env`; guard pe `DATABASE_URL`; **fără PII în loguri** (doar numere). Rolul
  acestor rânduri: autor pt detaliile seed + țintă pt FK admin, înainte de primul login (magic link leagă același rând).
- **`.env.example`** — adăugat `ADMIN_EMAILS`. **+dep:** `tsx` (runner scripturi TS).
- **Notă repo:** `drizzle.config.ts` încarcă `.env` (`dotenv/config`), dar `.env.example` documentează `.env.local`
  — inconsistență; seed-ul încarcă ambele ca plasă. (De aliniat ulterior.)
- **Verde:** `typecheck` ✓ · `lint` ✓ · `build` ✓. Seed verificat: rulează prin tsx, guard-ul DATABASE_URL oprește curat
  (rularea reală cere credențiale Neon).

### Faza 0 — pasul 4 (complet): onboarding rol + schelet invitație (HOLD)
- **Arhitectură pe straturi (server/):** `domain/roles.ts` (roluri principale confirmate + subroluri DRAFT de reconfirmat;
  validatori `isValidRoleMain`/`isValidSubRole`; fără import DB → safe în client) · `repos/rolesRepo.ts` (Drizzle) ·
  `services/roleService.ts` (`declareRole`: un rol/user, subrol ∈ rol principal, enforce pe server + constrângere DB).
- **UI onboarding:** `app/onboarding/page.tsx` (server, guard `auth()` → /login dacă nelogat, → / dacă are deja rol) +
  `role-form.tsx` (client: select rol → subrolurile se filtrează; `useActionState` pt erori/pending) +
  `actions.ts` (server action: ia userId din sesiune, deleagă la service, redirect / la succes).
- **Schelet invitație (Poarta 1 = HOLD, NEcablat):** `repos/invitationsRepo.ts` + `services/invitationService.ts`
  (`createInvitation` token criptografic `randomBytes(32).base64url` + TTL din `INVITATION_TTL_HOURS`; `validateInvitation`/
  `consumeInvitation` one-time + expirare). NU e legat de signup — activarea invite-only e o decizie de produs deschisă.
- **Verde:** `typecheck` ✓ · `lint` ✓ · `build` ✓ (`ƒ /onboarding` în rute).

### Faza 0 — pasul 4 (început): pagina /login (magic link) + verificare runtime pas 3
- **Smoke test pas 3 (runtime, fără credențiale):** `/api/auth/providers` → listează Resend ✓ · `/api/auth/csrf` → token ✓ ·
  rută protejată → **302 → `/login?callbackUrl=...`** ✓ (deny-by-default confirmat). Cookie-uri `HttpOnly; SameSite=Lax`.
- **`app/login/page.tsx`** — pagină de login passwordless: formular email → server action `signIn("resend", { email, redirectTo })`.
  `AuthError` → redirect `/login?error=<type>` cu mesaje prietenoase (fără internals). `redirectTo` = `callbackUrl` din query.
  Randare verificată live: status 200, formular + mesaj de eroare prezente.
- **`lib/auth.ts`** — adăugat `pages: { signIn: "/login" }` (Auth.js folosește pagina noastră, nu cea default). `verifyRequest` rămâne pe default.
- **Verde:** `typecheck` ✓ · `lint` ✓ · `build` ✓ (`ƒ /login` în rute).
- ⏳ Rămâne din pas 4: onboarding rol (tabel `roles`) + schelet invitație (Poarta 1 = HOLD). Testarea trimiterii reale a
  magic link-ului cere `AUTH_RESEND_KEY` + domeniu + `DATABASE_URL`.

### Faza 0 — pasul 3: autentificare Auth.js v5 (magic link) + deny-by-default (verde)
- **`lib/auth.ts`** — config central Auth.js v5: `DrizzleAdapter` (tabele mapate explicit:
  users/accounts/sessions/verificationTokens) + provider **Resend** (magic link, `from` din `EMAIL_FROM`,
  `maxAge` din `MAGIC_LINK_TTL_MINUTES`). Strategie sesiune **`database`** (folosim tabelul `sessions`),
  `trustHost: true`. Callback `session` expune `user.id` (pentru authz pe server). Export `handlers/auth/signIn/signOut`.
  - **Decizie:** fără split-config `auth.config.ts`+JWT — driverul Neon (HTTP/fetch) e edge-compatible,
    deci configul complet rulează și în proxy. Mai simplu + folosim sesiuni DB.
- **`app/api/auth/[...nextauth]/route.ts`** — re-exportă `GET/POST` din `handlers`.
- **`proxy.ts`** (Next 16 înlocuiește `middleware.ts`) — **deny-by-default**: tot ce nu e public cere sesiune;
  neautentificat pe rută protejată → redirect la `/login?callbackUrl=...`. Public: `/`, `/login`, `/api/auth/*`, assets.
- **Fix latent `db/index.ts`:** clientul Neon se construia la import (`neon(DATABASE_URL!)`) → `next build`
  (page-data collection) pica fără `DATABASE_URL`. Soluție: connection string cu **placeholder ca fallback**
  (driver Neon HTTP e lazy — se conectează abia la prima interogare; la runtime DATABASE_URL real e mereu setat).
  `db` rămâne instanță drizzle reală → `DrizzleAdapter` o detectează corect.
- **Verde:** `typecheck` ✓ · `build` ✓ (`ƒ /api/auth/[...nextauth]`, Proxy activ) · `lint` ✓.
- ⚠️ **Testare end-to-end a magic link-ului** cere `AUTH_RESEND_KEY` + domeniu verificat (de la Edi) + `DATABASE_URL`
  pe Neon — structural complet, funcțional după credențiale.

### Fix: CI invalid de la primul commit (toate rulările roșii)
- **Cauză:** `.github/workflows/ci.yml#L52` — pasul „Pre-scaffold" avea `run: echo "Pre-scaffold: ..."` inline;
  `:` urmat de spațiu într-un scalar YAML neîncadrat = interpretat ca mapping → **fișier de workflow invalid**.
  Efect: GitHub respinge workflow-ul la parsare (`startup_failure`, 0 jobs, 0s) și atașează eșecul fiecărui push
  (dev + merge-uri pe main) — de aici toate 6 rulările roșii, „triggered via push" deși `on: pull_request`.
- **Fix (soluția cea mai sigură):** scos colon-ul din mesajul echo (`Pre-scaffold -` în loc de `Pre-scaffold:`),
  pe o singură linie inline. Block scalar `run: |` trecea js-yaml, dar linter-ul Red Hat din VS Code încă reclama
  („Nested mappings are not allowed in compact mappings") → am ales forma fără colon, validă în ORICE parser.
- **Validat:** `npx js-yaml ci.yml` → VALID; niciun alt `run:` inline cu colon-space în fișier.
- **+ trigger `push` pe dev/main** (pe lângă `pull_request`): cu workflow valid, pushurile directe pe dev nu
  declanșau nimic vizibil; acum CI rulează și pe push, și pe PR → feedback verde imediat. Comentarii trecute pe ASCII.
- ⚠️ **Necesită push:** fixul e local; cele 6 rulări roșii sunt istoricul vechi (workflow invalid). Până la push,
  GitHub are tot fișierul invalid → nu rulează nimic. După push pe dev → ar trebui să apară prima rulare verde.
- Notă: era doar fișierul de workflow — codul/schema/scaffold neafectate; CI nici n-a apucat să verifice ceva.
  Lecție: validez YAML-ul de workflow (js-yaml/actionlint) înainte să mă bazez pe el.

### Faza 0 — pasul 2: schema DB în cod + migrații (verde)
- **`db/schema.ts`** — schema Drizzle completă (13 tabele), sursa de adevăr a modelului (`SCHEMA.md` rămâne design doc):
  - **Tabele Auth.js** (adapter Drizzle): `users` (extins cu `status`, `invited_by_id`, `created_at`), `accounts`,
    `sessions`, `verification_tokens` — cu cheile TS exacte cerute de adapter (emailVerified, sessionToken, userId, providerAccountId).
  - **Tabele de domeniu:** `roles`, `invitations`, `categories` (self-FK), `details`, `detail_resources`, `sketches`,
    `validations`, `comments`, `notifications`. 8 enum-uri (user_status, role_main, verification_status, target_type,
    validation_position, sketch_status, detail_resource_type, notification_type).
  - Constrângeri cheie: **unică `(user_id, target_type, target_id)` pe `validations`**, FK indexate, `uuid gen_random_uuid()`,
    `created_at`/`updated_at` (cu `$onUpdate`). `casing: "snake_case"` → coloane snake_case din chei camelCase.
- **`db/index.ts`** — client Drizzle (Neon HTTP), `casing: snake_case`. **`drizzle.config.ts`** — dialect postgresql, out `db/migrations`.
- **Migrație generată:** `db/migrations/0000_equal_alice.sql` (13 tabele, FK, indici, enum-uri). Verificat: snake_case + unique + gen_random_uuid().
- **Verde:** `typecheck` ✓ · `db:generate` ✓ · `lint` ✓ · `build` ✓. Rămâne `db:push` pe Neon (cere `DATABASE_URL`).

### Faza 0 — pasul 1: schelet Next.js + tooling (verde)
- **Scaffold Next.js** generat cu `create-next-app` și integrat în repo (păstrând docs/`.github`/`CLAUDE.md`/`README`
  existente): **Next 16.2.9 · React 19.2.4 · Tailwind v4 · ESLint 9 (flat) · TypeScript 5 strict**.
- **Dependențe adăugate:** `drizzle-orm`, `@neondatabase/serverless`, `next-auth@beta` (v5), `@auth/drizzle-adapter`,
  `zod`; dev: `drizzle-kit`, `dotenv`, `prettier`. (`vitest` se adaugă când scriem testele — Faza 1.)
- **Scripturi `package.json`:** `dev/build/start/lint` + `typecheck` (tsc --noEmit) + `format` + `db:generate/push/migrate/studio`.
  Astea **activează CI-ul** (`.github/workflows/ci.yml` nu mai trece „gol").
- **ESLint:** exclus tooling-ul local din lint (`.claude/`, `.agents/`, `.remember/`). **Prettier:** `.prettierrc.json` + `.prettierignore`.
- **Curățare boilerplate:** `app/page.tsx` = placeholder DETALIA (nu mai e pagina default Next); `layout.tsx`
  metadata DETALIA + `lang="ro"`; SVG-urile default Next șterse din `public/`. `.env.example` aliniat la
  **`AUTH_RESEND_KEY`** (convenția Auth.js v5, în loc de `RESEND_API_KEY`).
- **Verificat verde:** `typecheck` ✓ · `build` (Turbopack) ✓ · `lint` ✓.
- Încă NU: schema DB în cod, Auth.js, middleware, onboarding (pașii 2–5). Independente de credențiale.

### Document de securitate (nou) — evidență per-endpoint
- **`docs/SECURITATE.md`** (nou) — document viu, construit ca **listă de bifat** ca să nu rămână rute neacoperite:
  matrice de protecție per endpoint (auth/rol/input/rate-limit/business/ownership-IDOR/test/status), model de
  zone deny-by-default, mapare pe cele 13 categorii din `Audit_checklist`, riscuri specifice DETALIA (polimorfism,
  ownership dublu pe schițe, poziție unică), poartă de securitate per fază. Regula: endpoint fără rând verde = neacoperit.
- Capcanele clasice (authz uitată, IDOR, validare doar pe frontend, leak prin erori, enumerare) listate cu antidot.
  README actualizat.

### Guardrails de proces — PR template, CI, hooks noi (înainte de scaffold)
- **`.github/pull_request_template.md`** (nou, se comite) — checklist la fiecare PR: documentația la zi,
  build verde local, teste, securitate, business enforce pe server, branch = dev. Vizibil și pentru Edi.
- **`.github/workflows/ci.yml`** (nou, se comite) — CI pe PR (dev/main): type-check + lint + build. Guardat
  pentru pre-scaffold (trece gol fără package.json; devine activ automat după Faza 0).
- **Hooks noi (locale, `.claude/` rămâne gitignored — opțiunea A):**
  - `block-push-main.js` — blochează push direct pe `main` prin tool-ul Bash.
  - `block-secrets.js` — blochează scrierea de secrete reale în fișiere (permite .env locale + placeholdere .env.example).
  - Înregistrate în `.claude/settings.json` lângă `block-pii-log` și `lint-web`.
- **Regula „codul = sursa de adevăr"** marcată explicit în antetul `SCHEMA.md` și `API.md` (design docs;
  la divergență câștigă codul; câmp „ultima verificare").

### Plan de execuție MVP (nou)
- **`docs/PLAN-EXECUTIE.md`** (nou) — planul operațional: tabel de servicii terțe (cine setează ce, cost),
  faze 0/1/1.5/2 cu pași concreți + prerechizite + definiție de „gata" per fază, backlog, diagramă de
  dependențe și tabel „ce blochează ce". Calea critică = conturi terțe + inputurile lui Edi (DNS Resend, seed).
  Completează roadmap-ul de nivel înalt din `ARHITECTURA.md §12`. README actualizat.

### Documente lipsă — adăugat restul (🟡 + 🟢), set complet de docuri pre-scaffold
- **`docs/API.md`** (nou) — contractul API: inventar endpoint-uri (auth, invitații, detalii, validări,
  comentarii, schițe, notificări, verificare), cu reguli enforce pe server + coduri de eroare standard.
- **`docs/SCHEMA.md`** (nou) — proiectarea concretă DB: enum-uri, tabele, constrângeri (inclusiv unica
  `(user_id, target_type, target_id)` pe validări), indici, decizii de modelare. Devine cod Drizzle în Faza 0.
- **`docs/UX-ECRANE.md`** (nou) — harta de ecrane + flow-uri (cu săgeți) + stările obligatorii empty/loading/error
  + reguli UX transversale (buton identic, dezaprob cu justificare, fill slab, verificare non-blocantă).
- **`docs/EMAILURI.md`** (nou) — copy pentru magic link, invitație, notificări schiță (propusă/acceptată/respinsă).
- **`docs/CONFIDENTIALITATE-GDPR.md`** (nou) — registru de prelucrări + schelet notă confidențialitate/ToS;
  marcat clar „de finalizat (jurist) înainte de Val 2 / public".
- **`docs/PLAN-TESTE.md`** (nou) — piramida de teste, reguli business de testat, scenarii de securitate (IDOR,
  escalare), scenarii E2E Playwright. Marker `HUMAN_RUNS_TESTS` respectat.
- **`docs/ADR.md`** (nou) — 10 decizii de arhitectură în formă scurtă (single-app, magic link, schiță asincronă,
  vectorial, polimorfism, fără scoring, două porți, invitație ÎN HOLD, seed-only, Neon+Drizzle).
- **`README.md`** — tabelul de documentație actualizat cu toate fișierele noi.

### Documente lipsă — adăugate cele 3 blocante înainte de scaffold (Faza 0)
- **`README.md`** (nou, rădăcină) — pagina de intrare pe GitHub pentru Edi (Collaborator): ce e proiectul,
  stack, structură țintă, rulare locală, glosar, flux de lucru. Onest marcat **pre-scaffold**.
- **`.env.example`** (nou) — inventarul complet de variabile de mediu cu placeholdere și comentarii (DB, Auth.js,
  Resend, Blob, TTL-uri tunable). Fără secrete reale. Confirmat că `.gitignore` îl lasă să se comită.
- **`docs/PLAN-SEED.md`** (nou) — planul de conținut seed pentru lansare: câte detalii, criteriul „polarizant
  pe rol", distribuție pe categorii, autori seed, pump inițial autentic (fără falsuri), invitați, metrici de
  validare. Marcate clar deciziile de produs pentru Edi.

### Fluxul de cont — clarificat „două porți" + verificare „pull, nu push" (mesaj nou de la Edi)
- **Decuplate explicit cele două porți** (se confundau): **Poarta 1 = accesul** (cine intră → invitația),
  **Poarta 2 = credibilitatea** (cât „cântărești" odată intrat → rol declarat → verificat). Sunt independente.
- **Verificarea rolului reformulată ca „pull, nu push"** (confirmat de Edi): opțională, fără blocare; rol
  neverificat = **funcțional 100%**; doar un **nudge blând permanent** („Rolul tău nu e verificat → Verifică");
  userii vin **singuri** să se verifice, motivați de credibilitate (rol verificat „cântărește" mai mult în
  ochii cititorului). La verificare le cerem date → aprobare manuală admin → **badge steluță galbenă**. Fără scoring.
- **Invitația (Poarta 1) marcată ÎN HOLD** — rămâne în plan, dar e **sub reevaluare cu Edi** (invite-only vs.
  deschidere publică la lansare). Mesajul lui Edi viza doar verificarea, nu modul de acces → invitația neatinsă deocamdată.
- Actualizat: `ARHITECTURA.md` §3 (+ notă poartă acces), §9, §13; `CLAUDE.md` „Acces & roluri" + decizii.

---

## 2026-06-19

### Aliniere `CLAUDE.md` la documentele clientului (3 docuri de la Edi)
- Citite integral cele 3 documente din `documente_client/` (Document Fundamental v3.0, Specificația MVP,
  răspunsurile lui Edi). Edi a precizat: **Documentul Fundamental = gândirea inițială** → unde bate altfel,
  câștigă Specificația MVP / răspunsurile mai noi.
- **Verificarea rolului — corectat:** rolul e **auto-declarat de user la signup** (acces imediat, frecare minimă);
  `Invitation` dă **doar acces** la beta închis (NU mai atribuie rolul). Verificarea = **flux separat în platformă**
  → **badge steluță galbenă**; aprobare manuală (admin) în MVP. Actualizat glosarul + secțiunea „Acces & roluri".
- **Schiță — detalii UX adăugate** (de la Edi, păstrată ca feature OBLIGATORIU în MVP): **fill slab** pe
  detaliul-mamă la intrarea în modul schiță; unelte = mai multe **culori stridente** + 3 grosimi + radieră +
  undo/redo (viitor: Line/Circle/Square/Arrow/casetă text); model **asincron** confirmat de Edi.
- **Notificări:** in-app **ȘI email** de la început (via Resend) — brand awareness/recall.
- **Discovery:** adăugată secțiune — feed finit **~20 detalii** după interacțiuni, fără scroll infinit.
- **Decizii confirmate de Edi** mutate într-o secțiune dedicată (magic link, schiță asincronă, un singur rol,
  rol auto-declarat, zone listă fixă + „General", notificări email). **Upload v1 = seed-only (confirmat)**;
  deschiderea uploadului pentru useri = Val 2.

### Aliniere `docs/ARHITECTURA.md` + rescriere `docs/plan nontehnic.md` (pentru prezentare la Edi)
- **`docs/ARHITECTURA.md`** adus la zi cu deciziile confirmate: verificare rol (auto-declarat la signup +
  flux în platformă cu badge, `Invitation` = doar acces); model de date corectat (scos `isLifetime`, scos
  rolul din `Invitation`, un singur rol/user, imagine jpg/png/webp ~5MB, max 3 resurse, zone listă fixă +
  default „General"); schiță (fill slab + culori stridente + 3 grosimi); notificări in-app + email; feed
  ~20; roadmap (schițare = obligatorie MVP, upload seed-only în v1); hooks (ntfy eliminat); §13 restructurat
  în „confirmate" vs „deschise".
- **`docs/plan nontehnic.md`** rescris integral: Partea I actualizată (rol declarat→verificat, schiță cu
  fill slab, notificări email, feed ~20); Partea II transformată din „întrebări cu spații goale" în
  „ce ai confirmat (integrat)" + „ce mai avem nevoie" (subroluri, taxonomie categorii, verificare auto rol).

### Consolidare doc Edi (un singur document) + completare `.gitignore`
- Întrebările pentru Edi mutate în documentul non-tehnic și fuzionate cu el; rezultat:
  **`docs/plan nontehnic.md`** = Partea I (de ce arhitectura asta) + Partea II (întrebări + default-uri).
  Șterse `docs/DE-CE-ARHITECTURA-ASTA.md` și `docs/INTREBARI-PENTRU-EDI.md`. Referințe actualizate în
  `CLAUDE.md` și `.remember/remember.md`.
- **`.gitignore`** completat: `playwright/.cache/`, `.eslintcache`, `.turbo/`, certuri locale (`*.pem`,
  `*.local.key/crt`).

### `CLAUDE.md` de proiect (instrucțiuni domeniu — fără cod)
- **`CLAUDE.md`** (rădăcină) — completează globalul cu specificul DETALIA: glosar de domeniu, stack
  confirmat, reguli de business non-negociabile (validare pe roluri, state machine schiță, acces/roluri),
  arhitectură pe straturi, securitate, convenții de lucru, decizii deschise. Enforce business pe server.
- Adăugată secțiunea **„Standarde moștenite (`D:\Claude_Development_Rules`)"** — pinuiește convențiile
  concrete de la scaffold: format unic de eroare API + coduri standard, authz 401/403 (nu 404), config în
  env; DB Drizzle (snake_case, uuid `gen_random_uuid()`, FK indexate, migrații reversibile). Notează
  divergența: DETALIA = magic link → endpoint-urile parolă/MFA din `Backend.md` nu se aplică; Auth.js
  gestionează sesiuni/tokeni.

### Setup inițial proiect & arhitectură (faza de planificare, fără cod)
- **`docs/ARHITECTURA.md`** — document de arhitectură complet (prezentabil clientului): principiul
  organizator „GitHub pentru construcții", stack recomandat cu justificare, model de roluri + verificare,
  model de date, arhitectură pe straturi, inima (validarea pe roluri), deep-dive schițare colaborativă,
  feed/căutare, securitate, tabel de cost, roadmap în faze, decizii deschise.
- **`docs/DE-CE-ARHITECTURA-ASTA.md`** — varianta non-tehnică a deciziilor de arhitectură, pentru Edi
  (client non-tehnic). *(redenumit ulterior în `docs/plan nontehnic.md`)*
- **Decizie de stack confirmată:** single-app Next.js (App Router) pe Vercel; Neon Postgres + Drizzle;
  Auth.js magic link; Resend (email); Vercel Blob (stocare); Canvas + perfect-freehand pentru schiță
  (stroke-uri vectoriale). NU monorepo Fastify în faza de validare (motivare în ARHITECTURA.md §2).
  Migrarea la API separat rămâne posibilă fără rescriere (business izolat în `server/`).
- **Hooks recalibrate de la WhatsappAI la DETALIA:**
  - `block-pii-log.js` — PII-ul vizat schimbat din mesaje/imagini WhatsApp în emailuri, parole, tokenuri
    (invite/magic-link/sesiune), OTP, secrete, dovezi verificare rol (OAR/CUI); scoping pe structura
    single-app în loc de `apps/api/src`.
  - `lint-web.js` — ESLint single-file mutat de pe `apps/web/` pe structura single-app la rădăcină
    (`app/`, `components/`, `lib/`, `server/`, `db/`).
  - **Eliminat hook-ul `Stop` (ntfy)** — nu se mai folosește.
- **`.gitignore`** creat — ignoră node_modules/.next/.env*/.vercel/loguri/teste + fișierele Claude locale
  (`settings.local.json`, `.loop-state`, lock-uri) și partea volatilă din `.remember/`. Se comit: `docs/`,
  hook-urile partajate, `settings.json`, `.env.example`, `.remember/remember.md`.

### Decizii deschise rămase (pentru Edi)
- Schițarea în MVP: așteptăm cum o vede Edi (asincron tip GitHub vs. altceva).
- Lista de subroluri per rol principal.
- Metoda de verificare a rolului (MVP = manual admin; surse automate ulterior, ex. OAR).
