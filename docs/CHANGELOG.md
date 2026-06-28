# CHANGELOG — DETALIA

Jurnal detaliat al modificărilor, cu dată. Cel mai recent sus.

---

## 2026-06-28

### Fix buclă onboarding⇄feed + tool text revine la creion + ștergere detaliu de către autor
- **Buclă de loading onboarding⇄feed (prod):** user nou (fără rol) după magic link rămânea în buclă infinită
  de loading. Cauză: `redirect("/onboarding")` din `app/(app)/layout.tsx` se producea în timpul streaming-ului
  RSC → Next emite meta-refresh → buclă de reîncărcare (exact clasa de bug documentată deja în `proxy.ts`,
  rezolvată acolo pentru landing). **Fix:** poarta de onboarding mutată din layout în `proxy.ts` ca redirect
  307 curat (logat fără rol → `/onboarding`; logat cu rol pe `/onboarding` → `/feed`). Layout simplificat,
  fără redirect. (NU era Turbopack — prod rulează webpack.)
- **Tool de text (schiță):** după ce scrii un comentariu și confirmi (Enter / click în afară), unealta revine
  automat la **creion** — înainte rămânea pe „text" și deschidea o casetă la fiecare click. Pentru alt comentariu
  se reselectează tool-ul Text. (`components/sketch/sketch-canvas.tsx`.)
- **Ștergere detaliu de către autor:** buton „Șterge" pe pagina detaliului, vizibil DOAR autorului. Authz pe
  server (ownership în `detailService.deleteDetail`; FORBIDDEN/NOT_FOUND fără a dezvălui existența). Ștergere
  atomică prin `db.batch`: resurse+schițe cad în cascadă (FK), validările/comentariile polimorfice (detaliu +
  schițele lui) curățate manual. Blob-uri (imagine detaliu + thumbnail schițe) șterse best-effort. Notificările
  (referă prin payload, fără FK) rămân — link stale minor.

### Fix gating onboarding + separare dev/prod DB (date demo în prod)
- **Bug grav:** user logat fără rol intra direct în feed ca „anonim". Cauză: `app/(app)/layout.tsx` nu verifica rolul.
  Fix: layout async → logat fără rol → redirect `/onboarding` (un singur loc, acoperă toată zona autentificată).
- **Date demo în prod:** local și prod foloseau aceeași ramură Neon → `db:seed` local scria demo în producție.
  Remediere: (1) golit prod via Neon SQL Editor pe ramura `production` (păstrat `categories`); (2) ramură Neon nouă
  `dev-local` (persistentă), `.env.local` re-creat să arate spre ea, nu spre prod; (3) barieră `SEED_DEMO=true` în
  `db/seed.ts` — demo se seamănă doar cu opt-in explicit. Separarea documentată în `DEPLOY.md §2b`.

## 2026-06-27

### SECURITATE §10 — plan de implementare pe faze + gitignore docs
`SECURITATE.md §10` rescris ca **plan ordonat pe 4 faze** acoperind TOATE constatările (SEC-01..14 + §11c), în ordinea
de făcut: Faza 1 blocante (rate limit, upload, URL allowlist, conturi suspendate) → Faza 2 production-ready (teste,
atomicitate, ștergere date, headers, deps, PII rol) → Faza 3 hardening → Faza 4 igienă cod/UX.
`.gitignore`: adăugat `docs/_archive/` + untracked `documente_client/` (documente client, nu se comit).

### Consolidare audituri într-un singur document
Cele 3 documente de audit (`SECURITATE.md`, `opencode.md`, `audit.md`) aveau suprapunere mare. Consolidate în
**`SECURITATE.md`** (canonicul — cel mai riguros, se autodeclară „singurul doc de securitate"): adăugată §11b cu
constatările non-securitate unice (profile actions ocolesc service, `zod` nefolosit, snapshot rol ignorat la afișare)
+ lista constatărilor deja rezolvate. `opencode.md` și `audit.md` **arhivate** în `docs/_archive/` cu banner.

### Curățenie documentație (handoff #6)
Aliniere docs la deciziile confirmate de Edi (acces PUBLIC, upload deschis, Server Actions, rute reale).
- **Arhivate** în `docs/_archive/` (cu banner „NU mai e sursă activă"): `API.md` (ficțiune REST — appul folosește Server Actions), `plan nontehnic.md` (invite/seed-only + feature livrate ca „urmează"), `UX-ECRANE.md` (rute greșite).
- **Șters** `PLAN-EXECUTIE.md` — tot ce conținea e implementat (în CHANGELOG) sau restanță trecută în handoff (Faza 2: accesibilitate + audit securitate).
- **Actualizate țintit:** `ADR.md` (008→acces public, 009→upload deschis), `ARHITECTURA.md` (banner decizii suprascrise + §0/§13), `SCHEMA.md` (scos „pre-scaffold", adăugate câmpurile de profil reale din `db/schema.ts`), `CONFIDENTIALITATE-GDPR.md` (risc public de la lansare), `EMAILURI.md` (invitație dormantă), `PLAN-SEED.md` (50–100 detalii, upload deschis), `PLAN-TESTE.md` (0 teste/Vitest neinstalat, upload deschis, E2E verificare rol pe HOLD).
- Rămân surse active: `SECURITATE.md`, `CHANGELOG.md`, `DEPLOY.md`, `audit.md` (dated, încă util).
- **`docs/DECIZII-EDI.md` nou** — toate deciziile care depind de Edi într-un singur loc, în limbaj simplu (acum/mai târziu). Scoase din restul docurilor (ARHITECTURA „Încă deschise", GDPR, PLAN-SEED) → trimitere la el. PLAN-SEED rescris simplu, fără jargon.

### `docs/DEPLOY.md` — ghid de deploy + DNS
Document operațional nou: servicii third-party (Vercel/Neon/Blob/Resend/Google Workspace/Hostico/Cloudflare), stare actuală, și pașii rămași în ordine — migrare DNS pe Cloudflare, records Google Workspace (`support@detalia.ro`), records Resend pe `send.detalia.ro` (deblochează login real), legare opțională domeniu de Vercel. Include capcanele SPF (un singur record) + proxy Cloudflare (DNS only pe mail/verificare/Vercel).

### Pagina de detaliu — scos sidebar-ul dreapta, lățit conținutul
Eliminat sidebar-ul (carduri autor + „Despre detaliu" = redundante, info deja în antet; + „Regula de aur"). Pagina e acum o singură coloană lățită. „Detalii înrudite" mutat într-o secțiune **full-width** la baza paginii (grid responsive 1/2/3 coloane). `app/(app)/details/[id]/page.tsx` (scos `MetaRow` + importul `MapPin`).

### Deploy live pe Vercel (Neon branching + Blob)
Proiectul e deployat pe Vercel: `main` = producție, `dev`/PR = preview. Integrarea nativă **Neon ↔ Vercel** face branching automat (prod = ramura principală, fiecare preview = ramură Neon efemeră) și injectează `DATABASE_URL`. **Vercel Blob** injectează automat `BLOB_READ_WRITE_TOKEN`. `AUTH_URL` = URL-ul `.vercel.app` (domeniul `detalia.ro` încă nelegat), `AUTH_TRUST_HOST=true`. **Resend încă nesetat** → login real (magic-link) blocat pe prod până la `AUTH_RESEND_KEY` + `EMAIL_FROM`. Schimbările de env vars cer redeploy.

### Șters dev-login (bypass auth) — re-adăugat din greșeală
`app/dev/login/` (page + `devLoginAction`) re-apăruse prin commit `fac1249`. Eliminat din nou: folderul `app/dev/` șters, poarta publică `/dev` scoasă din `proxy.ts`, și **2 sesiuni reziduale** create de dev-login șterse din tabelul `sessions` (Neon). Login-ul rămâne doar magic-link real. (Eroarea tsc din `.next/dev/types/validator.ts` e generată, se regenerează la următorul dev/build.)

### Fix buclă de reload în Firefox (dev pe webpack)
La prima `npm run dev`, Firefox reîncărca `/feed` la infinit (Chrome nu). Cauză: HMR-ul Turbopack (default în Next 16) la compilare la rece — Firefox anulează chunk-urile lente (`NS_BINDING_ABORTED`) → Turbopack face full-reload → buclă. Diagnoza: Network arăta `/feed` 200 (nu redirect) + scripturi `[turbopack]_hmr-client` anulate. Fix: `dev` opt-out de Turbopack (`next dev --webpack`). `build`/`start` rămân pe Turbopack. `package.json`.

### Redirect authed `/` → `/feed`
User logat care intră pe landing e dus direct în feed; ramurile authed din landing au fost scoase (cod mort). `app/page.tsx`.

### Aliniere header între pagini
`scrollbar-gutter: stable` global pe `html` (`globals.css`) — gata diferența de centrare între paginile cu/fără scrollbar.

### Stivă de avatare validatori pe cardul de feed
Subquery `validatorAvatars` în `detailsRepo.listFeed` (max 5 validatori recenți) + componenta `ValidatorStack` în `detail-card.tsx` (cercuri suprapuse + „+N").

### Coloană `about` în profil
Schemă + migrația `0003` + repo (`getUserProfile`/`updateUserDetails`/`getPublicProfile`) + `Textarea` „Despre" în edit form + afișare în `ProfileView`. Aplicată în DB direct (migrate e rupt pe Neon HTTP → `db:push`/SQL).

### Constraint `validations_user_target_unique`
Adăugat în DB (lipsea) — regula „o poziție per user per țintă" e acum enforce la nivel de bază de date.

### Șters bypass-ul de acces dev
`app/dev/` (dev-login + preview + mock) ȘTERS, poarta `/dev` scoasă din `proxy.ts`, sesiunile din DB șterse. Login-ul rămâne doar magic-link real.

### Cardurile de schiță din profil linkează spre detaliul-mamă
Tab-ul Schițe: cardurile (înainte non-navigabile) duc acum la `/details/[detailId]`. `detailId` propagat prin `ProfileSketchItem` + `profileService`.

### Comentarii — editare și ștergere
Autorul își poate **edita** comentariile (inline) și **șterge** comentariile libere. Justificările de dezaprobare (`originValidationId`) NU se pot șterge (ar deveni „dezaprobare mută" — regulă de business), doar edita. Ownership enforce pe server (condiție `authorId` în repo, fără IDOR). Nou: `updateCommentByAuthor`/`deleteFreeCommentByAuthor` (repo) · `editComment`/`deleteComment` (service) · `editCommentAction`/`deleteCommentAction` (actions) · `CommentItem` cu edit inline (`comments-section.tsx`).

### Editor schiță — text manipulabil (mutare/rotire/mărime)
Textul plasat poate fi selectat (click cu unealta Text) și transformat: **mutare** prin drag, **rotire** ±15° și **mărime** ±, plus editare conținut și ștergere — printr-o bară flotantă ancorată la text + contur de selecție. Câmp nou `angle` (radiani) pe `Stroke` (validat în domain, randat rotit în `sketch-render.ts`). `sketch-canvas.tsx`.

---

## 2026-06-25 (datorie vie #4 — validare pe SKETCH, fix copy)

### Validare/comentarii pe schiță — confirmarea poziției urmează ținta
`typecheck` VERDE. (Verificarea vizuală o face Liviu.)
- **Constatare:** datoria „validare pe SKETCH" era deja implementată end-to-end în cod (service `targetExists`
  → schițe PUBLISHED; `page.tsx` aduce `getTargetValidationView("SKETCH")` + `getComments("SKETCH")` per schiță;
  `readTarget` acceptă SKETCH; `SketchSection` randează `ValidationPanel`/`CommentsSection` cu `targetType="SKETCH"`).
  Handoff-ul era depășit pe acest punct.
- **Singurul defect viu — copy:** mesajul de confirmare din `validation-panel.tsx` era hardcodat „acest detaliu",
  deci pe o schiță apărea „Ai dezaprobat acest detaliu." (greșit). Fix: `targetNoun` derivat din `targetType`
  („această schiță" / „acest detaliu") → confirmarea urmează ținta.

---

## 2026-06-24 (editare profil completă + rol DEFINITIV)

### Câmpuri lipsă în editare profil (#5) + rol blocat după alegere (#6)
`typecheck` + `lint` + `build` VERZI. (Verificarea vizuală o face Liviu.)
- **#5 — editare profil completă:** `/profile/edit` n-avea câmpuri pentru nume/headline/locație/website (apăreau pe profil
  dar nu se puteau seta), iar `getUserProfile` nici nu le aducea. Adăugat: `getUserProfile` întoarce acum
  `headline/location/website`; `updateUserDetails` (repo, doar câmpuri text, NU atinge rolul); `updateProfileDetailsAction`
  (nume obligatoriu, restul opțional → null, website fără schemă → `https://` prefixat); `EditDetailsForm` (nume, headline,
  locație, website) într-o secțiune nouă „Detalii profil" pe `/profile/edit`.
- **#6 — rol DEFINITIV (decizie Edi/Liviu):** rolul se alege o singură dată la onboarding și **nu se mai schimbă din UI**
  (stabilește credibilitatea). Scos `EditRoleForm` + `updateRoleAction` + `ROLE_ERRORS` din profil; secțiunea „Rolul tău"
  devine read-only (pill cu rol + steluță) + nota: schimbarea se cere prin email la `support@detalia.ro` (mailto cu
  subiect/motiv) — fără UI admin în MVP. Onboarding-ul deja bloca re-intrarea celor cu rol (`userHasRole → /feed`).
  `updateRole` rămâne în `roleService` dar **necablat** (fără cale din UI). **TODO:** adresa `support@detalia.ro` e
  placeholder — de înlocuit cu adresa reală.

## 2026-06-24 (follow-up-uri mărunte: detalii înrudite + search + rol în notificări)

### Detalii înrudite (sidebar) · căutare în header · rolul actorului în notificări
Trei follow-up-uri din handoff. `typecheck` + `lint` + `build` VERZI; verificat vizual (Playwright, logat ca Andrei).
- **Detalii înrudite**: `detailsRepo.listRelatedDetails` (aceeași categorie, PUBLISHED, exclus self, sortat după
  interacțiuni) + `detailService.getRelatedDetails` + card nou în sidebar-ul paginii de detaliu (titlu + autor/rol +
  contoare). Ascuns dacă nu există înrudite. Confirmat: arată detaliile din aceeași categorie.
- **Căutare simplă în AppHeader**: form GET nativ (merge fără JS) → `/feed?q=`. `listFeed` ia `q` → filtru `title ILIKE`
  (cu escape pe `%_\`). Feed: heading „Rezultate pentru …", `q` păstrat în linkurile de sortare, empty state pe „filtrat".
  Confirmat vizual.
- **Rolul actorului în notificări**: `usersRepo.getNotificationActor` (nume + rol + verificare); `notifySketchProposed`
  stochează `sketchAuthorRole`/`sketchAuthorVerified` în payload; clopoțelul afișează `RolePill` lângă nume la „a propus
  o modificare". Notificările vechi (fără rol în payload) rămân valide — pill-ul apare doar când există rolul (graceful).

## 2026-06-24 (fix clopoțel notificări — `<a>` imbricat)

### Hydration error în dropdown-ul de notificări — REZOLVAT
La deschiderea clopoțelului: 2 erori în consolă (`<a>` nu poate fi descendent de `<a>`). Rândul de notificare e
împachetat într-un `<Link>`, iar înăuntru titlul (`NotificationText`) ȘI butonul „Vizualizează & acceptă" erau tot
`<Link>` → ancore imbricate (HTML invalid → hydration error). Cauza găsită prin reproducere în browser (Playwright +
`/dev/login` ca Andrei), nu ghicită. Toate trei duceau la același `n.href` → titlul + CTA devin `span` (vizual identice),
rândul-Link rămâne singura navigare. `typecheck` + `lint` + `build` VERZI; verificat: 0 erori în consolă.

## 2026-06-24 (editor schiță — fix-uri audit Liviu + forme noi)

### Grilă pe foaie, zoom, riglă, radieră corectă, text-casetă + circle/square/arrow
Run de fix-uri pe editorul de schiță (feedback Liviu, verificat vizual cu Playwright pe `/dev/preview/sketch`).
`typecheck` + `lint` + `build` VERZI.
- **Bug text tool (nu apărea caseta) — REZOLVAT:** click-ul real pe canvas (`mousedown`) muta focusul pe `body` →
  textarea-ul abia deschis lua `onBlur` → `commitText` gol → se închidea instant. Fix: `onMouseDown preventDefault`
  pe canvas (desenul merge pe pointer events, neafectat). Cauza găsită prin reproducere în browser, nu ghicită.
- **#3 Text = etichetă curată** cu **halou alb** subțire (stil adnotare plan/CAD), în culoarea aleasă — FĂRĂ casetă/
  bordură (varianta cu casetă albă+bordură arăta lipită peste desen). Input flotant fără box (fundal-hârtie subtil doar
  la editare). Plasare prin click → scrii → Enter fixează.
- **#1 Grila** mutată de pe fundalul zonei pe **foaie** (desenată în canvas la `redraw`, deci NU intră în thumbnail).
- **#2 Zoom** 40–300%: controale −/100%/＋ (jos-dreapta) + **Ctrl/Cmd + rotiță** (listener non-passive). Transform pe
  wrapper; `normPoint` rămâne corect (folosește `getBoundingClientRect`, care include scalarea).
- **#4 Radieră — hit-test geometric** (distanță punct→segment per formă): prinde acum și liniile/formele (înainte
  verifica doar punctele, deci rata muchiile). Un singur pas de undo per tragere (batching în `eraseRef`).
- **#5 Riglă**: benzi cu ticks (la 26px = pasul grilei) pe marginile de sus și stânga ale foii, scalate cu zoom.
- **#6 Forme noi**: `rect` / `ellipse` / `arrow` (dreptunghi/cerc/săgeată cu vârf) — kind-uri în `Stroke`, validate pe
  server, randate în `lib/sketch-render.ts`; rail reorganizat în grilă 2 coloane (6 unelte).
- **Fix preview**: `sketch-preview-client` arăta `/preview/detail.svg` (404) → `/seed/detail.svg`. Robustețe: dacă
  imaginea-mamă nu se încarcă, editorul rămânea gol (dims 0) — de monitorizat pe editorul real.

## 2026-06-24 (#9 unelte schiță — line + text + paletă pe brand)

### Line tool, text tool și paletă aliniată la brand
Ultimul punct din auditul vizual Liviu (#9). Schița avea doar freehand + culori + grosimi + radieră → adăugate
**linie dreaptă** și **casetă de text**, plus **paletă de brand**. `typecheck` + `lint` + `build` VERZI.
- **`server/domain/sketch.ts`**: `Stroke.kind?: "free" | "line" | "text"` (opțional → stroke-urile vechi rămân „free");
  `text?: string` (doar pt kind text, validat: nevid, ≤ `MAX_TEXT_LENGTH` 200). `STROKE_KINDS` + validare server extinsă.
- **Paletă nouă** `STROKE_COLORS` = grafit `#211d18` + cărămiziu `#b0463c` + chihlimbar `#d97a1e` + ocru `#caa12e` +
  verde `#2f8f5f` + albastru `#2f6fb0` — stridente dar calde (brand), grafitul ca default pt adnotare tehnică.
- **`lib/sketch-render.ts`**: randare `kind: "line"` (segment drept, cap rotund) și `kind: "text"` (fillText multi-rând,
  baseline top, font scalat cu `TEXT_FONT_SCALE`). Partajat → liniile/textul apar identic în editor, teanc și thumbnail.
- **`components/sketch/sketch-canvas.tsx`**: `eraser` boolean → unealtă unică `tool: pen | line | text | eraser` cu selector
  în rail (Creion/Linie/Text). Linie = drag A→B cu preview live. Text = **click → input flotant** (textarea ancorată la
  poziția normalizată, font identic cu randarea, auto-grow, Enter fixează / Esc anulează / blur fixează).

## 2026-06-24 (Faza 2 #3 — stări loading/error/not-found)

### Schelete de încărcare + error boundaries + pagină 404
Punctul 3 din Faza 2 (`PLAN-EXECUTIE.md`): stările empty/loading/error „peste tot". **Empty states existau deja**
(feed, notificări, ciorne, comentarii) → completat ce lipsea: **loading** (fișiere `loading.tsx`) și **error/404**.
`typecheck` + `lint` VERZI. **Accesibilitatea minimă rămâne pe later** (decizie Liviu — vezi handoff).
- **`components/ui/skeleton.tsx`** (nou): primitivă `Skeleton` (puls discret, `bg-muted`, `aria-hidden`).
- **`app/loading.tsx`** (nou): fallback generic Suspense pentru rutele fără schelet dedicat.
- **`app/feed/loading.tsx`** · **`app/details/[id]/loading.tsx`** · **`app/profile/loading.tsx`** (noi): schelete pe
  forma reală a paginii (feed = grilă 3 coloane · detaliu = antet+imagine+validare+sidebar · profil = cover+avatar+stats).
  `loading.tsx` din `profile/` acoperă și `/profile/[userId]` + `/profile/edit` (segmente copil).
- **`app/error.tsx`** (nou): error boundary sub AppHeader — „Încearcă din nou" (`reset`) + „Mergi la feed". Log fără PII (digest/mesaj).
- **`app/global-error.tsx`** (nou): plasă pentru erorile din root layout (randează propriul `<html>/<body>`, stiluri inline).
- **`app/not-found.tsx`** (nou): pagina 404 pe brand — `notFound()` din pagina detaliu o folosește acum.

## 2026-06-24 (audit vizual Liviu — fix-uri + UX, val 1+2)

### Fix-uri bug + îmbunătățiri UX din verificarea vizuală
`typecheck` + `lint` + `build` VERZI. Pe puncte (numerotare din feedback-ul lui Liviu):
- **#8 (bug 500 upload poză):** `"use server"` nu poate exporta un obiect → mutat `initialProfileState` din `profile/actions.ts` în `profile-forms.tsx`.
- **#10/#13 (bug 500 Blob):** `lib/storage.ts` — `put()` în try/catch → întoarce `{ok:false, error:"UPLOAD_FAILED"}` în loc să arunce (fără 500).
  Send schiță merge fără thumbnail; creare detaliu dă eroare curată. **Cauza reală = store Blob PRIVAT** (config Vercel): trebuie un store PUBLIC.
- **#1 (feed):** Aprob/Dezaprob activ = **fill solid** (verde/roșu plin) home; Dezaprob deschide un **modal** (overlay) — nu mai mărește cardul.
- **#3:** „Detalii recente" → **„Detalii în dezbatere"**.
- **#4:** sortare **funcțională** (dropdown 2 opțiuni: „În dezbatere" după interacțiuni / „Recente" după dată) — `getFeed/listFeed` iau `sort`, param `?sort=`.
- **#11:** rail dreapta „Categorii populare" (redundant cu sidebar-ul) → **„Autori activi"** (top după detalii publicate, link la profilul public). Repo `listTopAuthors`.
- **#5:** avatar din header → **dropdown** (`UserMenu`): Vizualizare profil · Editează profil · **Deconectare** (reală, `signOut`).
- **#6:** **upload cover** adăugat (`updateCoverAction` + `CoverForm`).
- **#7:** `/profile/edit` **redesenat** — antet cu cover+avatar (preview live) + grid de carduri (mai puțin spațiu mort).
- **#12:** buton **ștergere ciornă** pe `/sketches/drafts` (`deleteDraftAction` → delete condiționat: doar autorul, doar DRAFT).
- **#2 (categorii count 0):** verificat — logica e corectă (subquery identic cu contoarele de pe detaliu); artefact de cache/timing pre-seed.

**Rămas din audit:** #9 unelte schiță (line/text tool + paletă aliniată la brand) — separat.

## 2026-06-24 (dev-login + seed — verificare vizuală localhost) 🔴 DE ȘTERS LA PROD

### Dev-login gated + seed de conținut demo
Infrastructură DOAR pentru verificare vizuală pe localhost (login + seed lipseau → paginile reale nevăzute cu DB).
**Gated dur la non-producție; DE ȘTERS înainte de prod** (reminder în `.remember/remember.md`). `typecheck` + `lint` + `build` VERZI.
- **`app/dev/login/`** (nou): pagină gated (`notFound` în prod) care listează userii și te loghează fără email. Cu sesiune `database`,
  „login" = inserăm rând în `sessions` + setăm cookie-ul Auth.js (`authjs.session-token` / `__Secure-` după AUTH_URL). `/dev` e deja public pe non-prod în `proxy.ts`.
- **`db/seed.ts`** extins: păstrează seedarea admin (ADMIN_EMAILS), adaugă **conținut demo idempotent** — 6 categorii, 4 useri cu roluri
  diferite (Andrei PROIECTANT verificat · Ioana · Mihai EXECUTANT verificat · Elena FURNIZOR), 9 detalii distribuite pe categorii,
  15 validări (cu dezaprobări→comentariu), ~18 comentarii Andrei împrăștiate pe an (densitate heatmap), 3 schițe (PUBLISHED/PENDING/DRAFT).
  Guard: dacă Andrei are deja detalii → skip. PII fără log (hook `block-pii-log`).
- **`public/seed/detail.svg`** (nou): placeholder blueprint local pentru `imageUrl` (next/image servește local fără remotePatterns).

## 2026-06-24 (epic Profil pe date reale — Faza 2: heatmap contribuții)

### Grafic de contribuții stil GitHub (heatmap „ultimul an")
Heatmap de contribuții pe profil, **derivat din aceleași timestamp-uri** (validări date + comentarii + detalii publicate + schițe trimise),
fără tabel de evenimente. `typecheck` + `lint` + `build` VERZI. **Neverificat vizual cu DB.**
- **`profileRepo.getContributionCounts(userId, since)`** (nou): 4 query-uri grupate pe zi (UTC, `to_char ... at time zone 'UTC'`),
  fuzionate într-un `Map<zi, număr>`. Helper `dayUtc(col)`.
- **`profileService`**: fereastră ~53 săptămâni aliniată la **Luni** (UTC), generează zilele cu `level` 0..4 (buckete 0 / 1-2 / 3-5 / 6-9 / 10+) +
  `contributionsTotal`. Adăugate în `ProfileViewData` (`contributions`, `contributionsTotal`).
- **`components/contribution-graph.tsx`** (nou): grilă săptămâni × 7 zile, scală verde, etichete lună/zi RO, legendă „Mai puțin→Mai mult",
  tooltip per zi. Randat în `ProfileView` sub bara de stats. Mock în `/dev/preview/profile`.
- Note lint react-compiler: etichete lună fără variabilă mutabilă în closure; mock fără `Date.now` (bază fixă `Date.UTC`).

**Rămas (din epic):** schema `bio/about/specializări` (decizie de produs); linkuri pe cardurile din tab-ul Schițe.

## 2026-06-24 (epic Profil pe date reale — Faza 1)

### Profil pe date REALE — ProfileView alimentat din DB + restructurare rute
Epicul „PROFIL pe date reale" (faza 1). Stats + activitate **derivate din tabelele existente** (validations/comments/details/sketches au
`created_at`) — **fără tabel de evenimente nou** (zero dual-write/backfill). `typecheck` + `lint` + `build` VERZI. **Neverificat vizual cu DB.**
- **`server/repos/profileRepo.ts`** (nou): `getProfileStats` (publicate / schițe propuse / validări date / validări primite — ultima pe ținte
  deținute de user, via `inArray` pe subquery), `listAuthorDetails` (cu contoare validări/schițe), `listAuthorSketches` (non-DRAFT, cu titlul
  detaliului-mamă), `listAuthorActivity` (validări + comentarii + publicări; titlul țintei polimorfice rezolvat prin join, SKETCH→detaliul-mamă cu `alias`).
- **`server/services/profileService.ts`** (nou): `getProfileView(userId, viewerId)` → `ProfileViewData`. Mapează statusuri schiță
  (PUBLISHED→„În teanc"/approved, REJECTED→„Respinsă"/disputed, PENDING_ACCEPTANCE→„În așteptare"/open), fuzionează activitatea (recent→vechi,
  sare peste comentariile-justificare ca să nu dubleze dezaprobarea), timp relativ RO, website sanitizat (allowlist http/https).
- **`ProfileView`** ajustat: `viewerIsOwner` (ascunde „Editează profil" pe profil public) în loc de `verifyHref`; **scoase CTA-urile „Verifică rolul"**
  (header/nudge/aside) — consecvent cu HOLD-ul de la verificarea rolului; **website** afișat în header; carduri Detalii **navigabile** (→ `/details/[id]`);
  **stări goale** pe cele 3 taburi; copy activitate generic (nu mai zice „o schiță" pentru validări pe detalii).
- **Restructurare rute:** `/profile` = **vizualizarea** proprie (ProfileView); **`/profile/edit`** (nou) = setările (mutate din `/profile`);
  **`/profile/[userId]`** = aceeași ProfileView read-only (înlocuiește pagina minimală de la #2). Linkul „Editează profil" → `/profile/edit`.
- **`bio/about/specializări`** rămân backlog (ProfileView le randează condiționat → ascunse); `headline` → slotul de tagline.
- `package.json`: `test` → `vitest run --passWithNoTests` (verde până scriem teste). **vitest = de instalat de Liviu** (`npm i -D vitest`).

**Rămas (faza 2):** grafic de contribuții stil GitHub (heatmap, derivă din aceleași timestamp-uri); schema `bio/about/specializări`; linkuri pe cardurile de schiță.

## 2026-06-24 (audit Codex — aliniere frontend↔backend)

### Remediere constatări audit (`audit.md`) — 8 fix-uri + 1 pus pe HOLD intenționat
Rulat un audit static de aliniere frontend↔backend (Codex). Tratate toate cele 9 constatări. `typecheck` + `lint` + `build` VERZI.

**Severitate ridicată**
- **#2 „Vezi profilul" deschidea persoana greșită → profil public nou.** Linkul din cardul autor (`details/[id]`) ducea fix la `/profile`
  (propriile setări). Adăugat **`/profile/[userId]`** read-only (cover/avatar/nume/rol+verificat/headline/locație/website), repo `getPublicProfile`
  (fără email/PII), website sanitizat (allowlist http/https). Propriul ID → redirect la `/profile`. *Statistici/taburi/activity log rămân pe epicul „Profil pe date reale".*
- **#1 Verificare rol „fără ieșire" → pusă pe HOLD (decizie Edi/Liviu).** Fluxul ducea userul în `PENDING` fără capăt de aprobare. În loc să
  construim UI admin birocratic (metodă în regândire), **ascuns butonul „Verifică rolul"** din profil; mesaj onest „disponibilă în curând".
  Rol declarat = funcțional 100%. Schela (`requestRoleVerification`) rămâne dormantă în service.

**Severitate medie**
- **#3 Link categorie din detaliu nu filtra feedul.** Genera `?category=<slug>`, feedul citea `?cat=<uuid>`. Aliniat la convenția unică `?cat=<categoryId>`.
- **#4 „Aprob/Dezaprob" din feed erau doar linkuri → cablate INLINE.** Componentă client `FeedValidationActions` (buton identic, Dezaprob cu
  justificare obligatorie), reutilizează acțiunile detaliului + `revalidatePath("/feed")`. Poziția curentă încărcată batch (`getMyPositions`, fără N+1).
- **#5 Ciornele DRAFT nu puteau fi reluate → pagina „Ciornele mele".** `/sketches/drafts` (listează drafturile userului cu titlul detaliului-mamă),
  `listDraftsByAuthor`/`getMyDrafts`, link în AppHeader (iconiță). Mesajul „o reiei oricând" devine real.
- **#6 Onboarding putea lăsa profil parțial permanent.** Reordonat: profil text + imagini ÎNTÂI, **`declareRole` ULTIMUL** (e markerul de
  „onboarding complet"). Dacă o scriere pică, rolul nu se creează → onboardingul se reia, nu rămâne rol fără nume.
- **#7 Accept/reject schiță vulnerabil la concurență.** Înlocuit read-then-write cu update condiționat atomic `transitionFromPending`
  (`WHERE id=? AND status='PENDING_ACCEPTANCE'`, verifică rândurile afectate) → fără rezultate opuse / notificări duble.
- **#8 URL resurse nevalidat.** Adăugat `isHttpUrl` (parsare `new URL` + allowlist http/https) la validarea resurselor detaliului (blochează `javascript:`/`data:`).

**Severitate redusă**
- **#9 `roleSnapshot` ignorat la afișare.** `listPositionsForTarget` afișa rolul CURENT (rescria retroactiv validările vechi la schimbarea rolului).
  Acum preferă snapshotul salvat la momentul votului; fallback la rolul curent doar pentru înregistrările vechi fără snapshot.

*Rămas separat (nu în acest set): rescrierea/arhivarea docs-urilor depășite semnalate de audit (ADR/API/ARHITECTURA/plan nontehnic etc.) + epicul „Profil pe date reale" (stats/activity log).*

## 2026-06-24

### Editor schiță — redesign full-screen din Claude Design (`Detalia Schita-editor.dc.html`)
Re-skin al editorului (`app/sketches/[id]/edit`) la layout full-screen. Toată logica de desen refolosită (perfect-freehand prin
`renderStrokes`, undo/redo, radieră, thumbnail PNG, coordonate normalizate, fill-slab 0.3 al detaliului-mamă).
- **`sketch-canvas.tsx`** refactorizat: acum **`forwardRef`** care expune `getStrokes()` + `exportThumbnail()` (citite din bara de context),
  randează **rail vertical de unelte** (Culori grid · 3 Grosimi · Radieră · Undo/Redo) + **canvas fit-to-area** (centrat, păstrează raportul,
  `ResizeObserver`), grid de lucru faint + badge „Mod schiță · detaliul-mamă estompat". Grup pen estompat când radiera e activă.
- **`sketch-editor.tsx`** rescris ca **shell full-screen** (`fixed inset-0 z-[60]`, acoperă AppHeader-ul global): bară de context
  (Renunță → detaliu, badge „Schiță peste" + titlu detaliu-mamă + autor cu `RolePill`, notă, **Salvează ciornă** + **Trimite propunerea**),
  suprafața de desen, **toast „ciornă salvată"**. Acțiunile citesc strokes/thumbnail prin ref.
- **`page.tsx`** pasează acum `detailTitle`/`authorName`/`authorRoleMain`/`authorVerified`; a renunțat la wrapper-ul `max-w` (editorul e full-screen).
- **`dev/preview/sketch`** aliniat la noul API (container cu înălțime fixă, fără handlere save/send).
- **Deviere onestă:** modalul „Propunere trimisă" din design = înlocuit de **redirect la `/details/[id]`** pe succes (flux MPA, nu SPA).
- `typecheck` + `lint` + `build` VERZI. **Neverificat vizual cu DB.**

### „Adaugă un detaliu" — redesign formular din Claude Design (`Detalia Publica.dc.html`)
Re-skin + completare a formularului de creare detaliu (`app/details/new`). Tot fluxul existent (upload imagine Blob, auth, rol declarat,
moderare post-publicare) refolosit; în plus **cablate câmpuri pe care service-ul le suporta deja dar formularul nu le trimitea**.
- **`detail-form.tsx`** rescris ca card pe design: label-uri mono uppercase, titlu, descriere (notă „apare deasupra desenului"),
  select categorie stilizat (săgeată proprie), **zonă climatică + seismică** (selecturi noi, default „General"), **dropzone imagine**
  (file input ascuns + preview cu grid blueprint, nume fișier, Înlocuiește/Elimină), **repeater resurse** (max 3, tip Imagine/Link/PDF +
  valoare, add/remove, serializat în câmp ascuns JSON), notă „devine public imediat", butoane Renunță / Publică detaliul.
- **`actions.ts`** citește acum `climateZone`, `seismicZone` și `resources` (parsare JSON defensivă, ignoră malformat/gol, max 3, validare
  finală în `DetailService`). După publicare **redirect la `/details/[id]`** (înainte mergea la `/`).
- **`page.tsx`:** breadcrumb + titlu + subtitlu, lățime `760px`.
- **Deviere/follow-up onest:** resursele suplimentare stochează un **URL/referință** (placeholder-ele cer link), NU upload de fișier secundar —
  uploadul de fișiere per-resursă nu există încă (decizie de produs deschisă: tipuri resurse). Tipul „Imagine/PDF" e doar etichetă peste un URL.
- `typecheck` + `lint` + `build` VERZI. **Neverificat vizual cu DB.**

### Notificări — dropdown din clopoțel (din Claude Design `Detalia Notificari.dc.html`)
La cererea lui Liviu, designul de notificări **NU** e tratat ca pagină separată, ci ca **dropdown care iese din clopoțelul** din header.
- **`components/notification-bell.tsx`** rescris ca **client component cu dropdown**: buton clopoțel (badge teracotă cu count), panou
  ancorat dreapta, închidere la click-în-afară + Escape. Header „Notificări" + „Marchează toate ca citite" (disabled fără necitite).
- **Rânduri fidele designului:** gutter cu punct de necitit, pătrat-iconiță colorat pe tip (proposed=creion teracotă / accepted=check verde
  / rejected=X cărămiziu), text + link «titlu detaliu» + timp relativ, buton „Vizualizează & acceptă" doar pe `SKETCH_PROPOSED`.
  Rândurile necitite au fundal cald + hover. **Empty state** desenat.
- **`components/app-header.tsx`** aduce acum lista (`getNotifications`) și o mapează la o formă serializabilă; trece `notifications` + `count`
  la clopoțel (înainte trimitea doar count-ul). „Marchează toate" → `markReadAction` (existentă) + `router.refresh()`.
- **Deviere/follow-up onest:** designul arată **rol + steluță** lângă nume; payload-ul de notificări **nu stochează rolul** actorului (doar
  numele, doar la „proposed") → rolul a fost **omis** (de adăugat prin îmbogățirea payload-ului în `notifySketch*`). Pentru accepted/rejected
  păstrăm formularea „Schița ta … a fost acceptată/respinsă" (nu stocăm identitatea autorului-mamă). Pagina `/notifications` rămâne **dormantă**
  (URL direct funcțional), dar clopoțelul nu mai duce la ea.
- `typecheck` + `lint` + `build` VERZI. **Neverificat vizual cu DB.**

### Pagina DETALIU — redesign din Claude Design (re-skin peste Faza 1)
Design importat din proiectul Claude Design (`Detalia Detaliu.dc.html`, via tool-ul `DesignSync`) și implementat peste pagina
de detaliu existentă (funcțional Faza 1) — **doar re-skin + reorganizare layout**, tot wiring-ul server (services/actions) refolosit.
- **Layout nou:** coloană principală (`minmax(0,1fr)`) + sidebar 320px (`lg:sticky`). Validarea, teancul și dezbaterea au trecut în
  coloana principală; sidebar = card autor / card meta („Despre detaliu") / „Regula de aur". Breadcrumb mono Detalii / categorie / titlu.
- **Antet:** H1 32px extrabold, rând autor (avatar + nume + `RolePill` + chip categorie + dată `formatDate`), strip zone climatice/seismice
  (afișat doar dacă există), descriere `max-w-[64ch]`. Imaginea 2D într-o ramă cu grid blueprint + resurse ca chipuri cu iconițe pe tip.
- **Bara de validare (`validation-panel`)** rescrisă: butoane mari Aprob (check, verde când activ) / Dezaprob (X, destructive când activ),
  hint „o singură poziție reversibilă", confirmarea poziției proprii cu retragere, rând de contoare (validări/comentarii/schițe „fără scor"),
  lista pozițiilor celorlalți (nume+rol). Justificarea rămâne **inline-expand** (nu modal — funcțional identic, deviere intenționată).
- **Teancul (`sketch-section`)** rescris: card cu taburi pe autor, viewport + panou meta (autor/rol/contoare/status „în teanc · publicată"),
  dezbaterea schiței active sub viewport, **empty state** desenat, secțiunea „propuneri în așteptare" (doar autorul-mamă). Butonul
  **„Schițează peste detaliu"** cablat la noua acțiune `startSketchAction` (creează DRAFT → editor; NO_ROLE → onboarding) — nu mai e
  accesibilă schițarea doar din „Dezaprob și fac o schiță".
- **Dezbaterea (`comments-section`)** rescrisă: composer cu avatar + listă cu avatar/nume/`RolePill`/timp relativ; dezaprobările marcate
  distinct (bară stânga + fundal `destructive`). Header „Dezbatere · N comentarii".
- **Componente noi reutilizabile:** `components/avatar-initials.tsx` (poză sau inițiale) + `lib/format.ts` (`formatDate` / `formatRelative` ro).
- **Schemă/repo:** `detailsRepo` aduce acum `authorLocation` + `authorHeadline` (cardul autor din sidebar). Mock-ul de preview aliniat la tip.
- **Deviere/follow-up:** secțiunea „Detalii înrudite" din design **omisă** (n-avem încă query de înrudite — de adăugat). Header-ul global
  `AppHeader` rămâne (n-am dublat header-ul cu search din mockup). Strip-ul de thumbnails al teancului redus la taburi (fără mini-previews).
- `typecheck` + `lint` + `build` VERZI. **Neverificat vizual cu DB** (vezi capcane env — magic link/seed).

### Design System — aliniere globală de dimensiuni + culori pe tokeni
Cerere (via Claude Design): UI uniform pe dimensiuni și culori prin tokenii shadcn, nu hex ad-hoc. Aplicat doar pe **design**
(dimensiuni/culori) — comportamentul (stări empty/loading/error, flux Dezaprob) a fost lăsat în afara scope-ului, la cererea lui Liviu.
- **Lățime container unică:** variabila `--container-max: 1280px` (globals.css) folosită pe **Auth/Onboarding/Feed/Landing** (erau
  1320/1280/1180/1320). **Profil rămâne 1080px intenționat** (lizibilitate). Paginile de conținut/formular (detaliu, notificări,
  schiță) rămân pe lățimi de citit mai înguste (`max-w-5xl/3xl/2xl`) — tier separat, deliberat.
- **Gutter unic 24px** (Onboarding era 28; landing deja 24).
- **Radius unic 10px** (`--radius` / `rounded-lg`) pe toate cardurile/butoanele/inputurile/panourile, inclusiv baza shadcn
  `components/ui/card.tsx` (era `rounded-xl`); eliminat amestecul 9/11/12/13/14/16/18px. Pastilele (`rounded-full`) și cercurile
  (`50%`) rămân. Radius-urile inline din landing → `var(--radius)`.
- **Culori pe tokeni:** `destructive` (#b0463c) pe **Dezaprob** (`detail-card`) și pe stările **disputat/dezaprobat** (`profile-view`
  — `SKETCH_STATUS_STYLE.disputed`, `ACTIVITY_ICON.disapprove`, bordura justificării); border input `#d8cfc0` → `--input` (Onboarding)
  / `border-border` (buton editare profil, feed-empty); borduri calde ad-hoc (`#e6ddcf/#e2d7c4/#e6dccd`) → `border-border`; bg activ
  categorie `#f6ede4` → `bg-secondary`.
- **Breakpoint** onboarding 680→720px (aliniat la breakpoint-ul de sistem al hero-ului).
- **Excepție păstrată:** landing-ul (`.dc-landing`) își păstrează **paleta proprie** (inclusiv pastila „disputat" #9a3a30 din
  preview-ul hero) — confirmat ca excepție; doar dimensiunile (container/gutter/radius) au fost aliniate.
- `typecheck` + `lint` + `build` VERZI.

### Onboarding — redesign din Claude Design (date de profil) + migrație schemă
- **Design importat** din proiectul Claude Design (`Detalia Onboarding.dc.html`) și implementat 1:1 ca pagină de brand bespoke
  (header cu „Conectat ca {email}" + fundal blueprint + titlu + card cu **preview live** „cum vei apărea").
- **Schemă — câmpuri noi pe `users`** (migrația `0002_tearful_puck`, reversibilă, toate nullable): `first_name`, `last_name`,
  `headline`, `location`, `website`, `cover_image`. `name` (Auth.js) rămâne și e compus din `first + last` la onboarding pentru
  compatibilitate cu codul care-l citește. **Necesită `db:push`/`db:migrate` pe Neon la următoarea rulare.**
- **Onboarding colectează acum** (era doar rol+subrol+poză): prenume, nume (**obligatorii** — magic link nu capturează numele),
  rol, subrol, headline, locație, website + **poză de profil** și **bandă de cover** (ambele opționale). Validare server-side
  (lungimi + tip/dimensiune imagine) în `app/onboarding/actions.ts` → `roleService.declareRole` + `usersRepo.updateUserProfile`.
- **Storage:** `uploadCoverImage` (prefix `covers/`) lângă avatar. **usersRepo:** `updateUserProfile` + `updateUserCoverImage`.
- **Fix redirect (handoff):** onboarding redirectează acum în **`/feed`** (era `/`), atât post-submit cât și pentru userul care
  are deja rol și reintră.
- Componente: `app/onboarding/onboarding-form.tsx` (client, preview live + previews imagini cu `URL.createObjectURL`) înlocuiește
  `role-form.tsx` (șters). Reguli scoped `.dt-onb` în `globals.css` (focus/hover/săgeată select/responsive 680px).
- `typecheck` + `lint` + `build` VERZI.

---

## 2026-06-23

### Design — login/signup la lățimea landing-ului + cadru bogat (AuthShell)
- **`components/auth-shell.tsx`** (nou) — cadru comun login/signup la **lățimea landing-ului (1320px)**: header de brand + corp pe
  două coloane (panou de pitch în stânga — eyebrow + titlu + 3 puncte cu rombul; cardul cu formular în dreapta) + footer dark ca pe
  landing. Panoul de pitch e ascuns pe mobil (rămâne cardul centrat). Rezolvă feedback-ul „prea sec / prea îngust".
- `app/login` + `app/signup` refactorizate să folosească `AuthShell` (header-ul propriu adăugat anterior a fost înlocuit). Verificat vizual.

### Design — temă de brand pe toată aplicația + preview dev (feed & schiță) fără DB
- **Tema unică (`globals.css`):** paleta landing-ului (bej `#faf8f4` / teracotă `#a9573a` / ink `#211d18` + borduri/muted
  calde) mapată pe **tokenii shadcn `:root`** + fonturile **Archivo/IBM Plex Mono** ca `--font-sans`/`--font-mono`. Efect: TOATE
  suprafețele pe tokeni (login/signup/feed/profil/notificări/detaliu/onboarding) se aliniază AUTOMAT la landing, fără rescriere.
- **`components/brand-logo.tsx`** (nou) — rombul teracotă + wordmark „DETALIA", partajat. Folosit pe login/signup + `AppHeader`.
- **Login/signup:** adăugat header de brand (logo + cross-link) + fundal bej din tokeni; cardul devine brand automat.
- **`AppHeader`:** sticky + bej translucid + `BrandLogo` (rombul), aliniat la header-ul landing.
- **Preview dev (`/dev/preview`, `/feed`, `/sketch`)** — randează componentele REALE (`DetailCard`, `CategoryFilter`, `SketchCanvas`)
  cu **date mock** (`app/dev/preview/mock.ts` + `/public/preview/detail.svg`), **fără DB și fără auth**. Pentru a vedea feed-ul și
  editorul de schiță fără a popula DB-ul. **Gated strict pe non-producție:** `/dev` e public în proxy DOAR dacă `NODE_ENV !==
  production`, iar fiecare pagină dă `notFound()` în prod (a doua barieră). `CategoryFilter` a primit prop opțional `basePath`
  (default `/feed` — comportament real neschimbat). `tsc`+`build` VERZI; verificat vizual (Playwright).
- GitGuardian (GitHub App) a semnalat un „Generic Password" în `app/page.tsx` — **fals pozitiv**: detectorul se agață de
  cuvântul „parolă" din `const SUBLINE = "...fără parolă..."` (copy UI passwordless), NU o credențială. Zero secrete reale.
- Adăugat **`.gitguardian.yaml`** (v2) cu `ignored_matches` pe acest text. **Atenție:** fișierul e citit de **ggshield** (CLI);
  GitHub App-ul îl respectă doar dacă workspace-ul are „honor repo config". Pe PR-ul curent, fixul sigur = „Skip: false positive"
  în check / resolve în dashboard. CI-ul propriu (`ci.yml`) NU rulează ggshield (doar type-check+lint+build).

### Auth — Google OAuth scos pentru MVP (rămâne doar magic link)
- **Decizie Edi/Liviu:** pentru MVP autentificarea e **doar passwordless prin magic link (Resend)**. Google OAuth scos din flux.
- **`lib/auth.ts`** — eliminat providerul `Google` + importul; rămâne doar `Resend`. (Schela de re-adăugare documentată în comentariu.)
- **`app/auth-actions.ts`** — eliminat `signInWithGoogleAction` (rămâne `signInWithEmailAction`).
- **`components/auth-form.tsx`** — scos butonul „Continuă cu Google", separatorul „sau" și `GoogleIcon`; formularul = doar email.
- **`/login` + `/signup`** — copy actualizat (fără „Google"), curățate mesajele de eroare OAuth (`OAuthSignInError`/`OAuthAccountNotLinked`).
- **`.env.example`** — secțiunea Google marcată DEZACTIVAT (variabile comentate + instrucțiuni de reactivare). `tsc`+`build` VERZI.

### Landing public — implementat din Claude Design (hero varianta B) + responsive
- **`app/page.tsx`** rescris complet din designul aprobat de Edi în Claude Design (proiect `Detalia Landing.dc.html`).
  Implementat **hero varianta B** (split: text + card preview cu planșă SVG și voturi pe roluri — M. Popa ✓ Aprobă /
  I. Radu ✕ Dezaprobă + justificare) + CTA final dark. Reproducere **fidelă**: paletă proprie de brand (bej `#faf8f4` /
  teracotă `#a9573a`) + fonturile **Archivo + IBM Plex Mono** (via `next/font` în `layout.tsx`) — separată intenționat de tokenii shadcn.
- Secțiuni: header sticky · hero B · 01 Problema&soluția · 02 Cum funcționează · 03 Ce câștigi · 04 Pentru cine (4 roluri) ·
  05 FAQ (`<details>` nativ, fără JS) · CTA final dark · footer.
- **Responsive (adăugat):** heading-uri + padding-uri verticale pe `clamp()` (fluide, fără media queries); grilele de carduri pe
  `repeat(auto-fit, minmax(...))` (colapsează singure); singura grilă cu media query e hero B → `.dc-hero-grid` în `globals.css`
  (1 coloană sub 880px). Hover-urile și markerul `<details>` scoped în `globals.css` la `.dc-landing`.
- Cablat `/signup` `/login` `/feed`; ramura **authed** (session → „Mergi la feed", fără sublinii de signup); `auth()` server-side păstrat.
  Copy fără „Google" (passwordless = doar email) și fără „GitHub". **`app/page.tsx` provizoriu** înlocuit definitiv. `tsc`+`build` VERZI.
- **Rafinări post-verificare vizuală (browser):** breakpoint hero coborât 880→720px (laptopuri cu scalare OS rămân pe 2 coloane);
  lățime conținut principal lărgită 1180→1320px (constanta `MAXW` — header/hero/01–04/footer; FAQ+CTA rămân înguste, centrate).

### Refresh documentație (README + PLAN-EXECUTIE aliniate la realitate)
- **`README.md`** rescris ca punct de intrare: secțiune **„Stare la zi"** consolidată (✅ făcut / ⏳ blocat de credențiale /
  ⛔ placeholder / 🔮 backlog), stack corectat (Google OAuth + shadcn), acces **PUBLIC** (nu „beta închis"), rulare reală
  (inclusiv `.env.local` doar cu `AUTH_SECRET` pt paginile publice), hartă de docuri grupată. „GitHub pentru construcții"
  marcat explicit ca metaforă internă (NU în UI).
- **`docs/PLAN-EXECUTIE.md`** — Faza 1 + 1.5 marcate **ÎNCHEIATE**, Faza 2 **PARȚIALĂ**; corectate notele depășite
  (upload deschis userilor, nu doar admin/seed; Poarta 1 = PUBLIC, rezolvată).
- Restul design-docs (SCHEMA/API/SECURITATE/EMAILURI/PLAN-SEED) aveau deja bannere „codul = sursa de adevăr" — neatinse.

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
