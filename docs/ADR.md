# DETALIA — Decizii de arhitectura (ADR — forma scurta)

Doar decizii de design (stack, model de date, auth, acces, storage), fiecare in 3–4 randuri: context → decizie → consecinte.
Fix-urile si detaliile de implementare stau in `CHANGELOG.md`, nu aici.

---

## ADR-001 — Single-app Next.js, nu monorepo cu backend separat
**Context:** fază de validare, buget ~$0, un dev, viteză până la MVP.
**Decizie:** o singură aplicație Next.js (App Router) pe Vercel; business izolat în `server/`.
**Consecințe:** cost și ops minime; extragerea unui API separat (Fastify) rămâne posibilă **fără rescriere**
fiindcă logica e deja izolată. Re-evaluăm doar dacă apar consumatori externi (mobil nativ, integrări). _(ARHITECTURA §2)_

## ADR-002 — Auth = magic link (passwordless), via Auth.js v5
**Context:** acces controlat, suprafață de atac minimă, fără management de parole.
**Decizie:** Auth.js Email provider (magic link), tokenuri scurte one-time.
**Consecințe:** endpoint-urile de parolă/reset/MFA din standardele moștenite **NU se aplică**; sesiuni/tokenuri
gestionate de framework (strategie `jwt` din 2026-07-02, perf — vezi CHANGELOG). _(CLAUDE.md „Divergență Backend.md")_

## ADR-003 — Schițare asincronă „GitHub-style", NU co-desenare real-time
**Context:** co-desenarea real-time (CRDT/websockets) = cea mai scumpă și riscantă piesă.
**Decizie:** fiecare foaie = o schiță cu **un singur autor**, peste detaliul-mamă (overlay); colaborare prin
teanc (fork→PR), nu pe aceeași pânză. Decizie confirmată.
**Consecințe:** elimină luna de complexitate real-time; schițarea rămâne feature **obligatoriu** în MVP. _(ARHITECTURA §7)_

## ADR-004 — Stroke-uri stocate VECTORIAL (jsonb, normalizat 0..1), nu PNG
**Context:** schițele trebuie redabile, scalabile pe orice ecran, dezbătute per foaie.
**Decizie:** `strokes_json` (jsonb) cu coordonate normalizate 0..1; thumbnail PNG randat **o singură dată** la publicare.
**Consecințe:** mic în DB, scalabil, viitor-proof; fără re-randare la fiecare hover. _(ARHITECTURA §7.3, SCHEMA)_

## ADR-005 — Validare/Comentariu POLIMORFICE (Detail SAU Sketch)
**Context:** vrem dezbatere și pe detaliu, și pe fiecare schiță, fără mecanisme duplicate.
**Decizie:** `target_type` + `target_id` pe `validations`/`comments`; constrângere unică `(user, target_type, target_id)`.
**Consecințe:** „o poziție/user, reversibilă" garantată de DB; dezbaterea per schiță iese gratis. Compromis:
fără FK forțat pe `target_id` → integritate în service + indici compuși. _(SCHEMA, ARHITECTURA §4)_

## ADR-006 — FĂRĂ ponderare numerică / scoring pe VALIDĂRI
**Context:** cererea clientului — greutatea o judecă cititorul după rol, nu un algoritm.
**Decizie:** construim doar **afișarea transparentă a rolului** lângă fiecare poziție; zero scor/reputație
**pe validări** (Aprob/Dezaprob rămân fără pondere numerică, nu se schimbă).
**Consecințe:** simplifică enorm inima aplicației (validarea rămâne calitativă, nu un algoritm).
**PARȚIAL SUPRASEDAT de ADR-015:** badge-urile de reputație introduc totuși un scor —
dar calculat din ALTĂ suprafață (statistici de activitate: publicări/schițe/validări date-primite), nu
din greutatea unei poziții individuale. Validarea propriu-zisă rămâne exact cum a decis acest ADR — fără
pondere numerică pe fiecare vot. _(ARHITECTURA §5)_

## ADR-007 — „Două porți": acces vs. credibilitate (verificare rol)
**Context:** confuzie frecventă între cine intră și cât „cântărește" odată intrat.
**Decizie:** le tratăm ca mecanisme **independente**. Verificarea = „pull, nu push" (opțională, fără blocare,
nudge blând, badge la verificat). Rol auto-declarat la signup.
**Consecințe:** frecare minimă la intrare + cerere organică de verificare din credibilitate. _(ARHITECTURA §3)_

## ADR-008 — Poarta de acces = PUBLIC (înregistrare deschisă)
**Context:** decizie confirmată (iunie 2026) — minimizăm frecarea la primul contact; lansare = acces public deschis.
**Decizie:** înregistrare liberă, fără invitație. Flux: landing → creare cont → magic link → onboarding (rol+subrol) → feed.
**Consecințe:** logica de invitații a fost **eliminată complet** (2026-06-28, vezi CHANGELOG) — niciun cod dormant. Dacă se vrea vreodată acces restricționat, se construiește un mecanism nou. _(CLAUDE.md „Decizii de produs")_

## ADR-009 — Upload de detalii DESCHIS userilor cu rol declarat
**Context:** decizie confirmată (iunie 2026) — orice user autentificat cu rol declarat poate publica detalii (nu doar admin/seed).
**Decizie:** upload deschis + **moderare post-publicare** (publici direct, ștergem abuzurile ulterior); fără cozi de aprobare în MVP. Seed inițial rămâne prin conturi reale.
**Consecințe:** calitatea o dă validarea/dezbaterea pe roluri, nu un gatekeeper la intrare; mai multe fluxuri de securizat (validare input upload). _(CLAUDE.md „Decizii de produs")_

## ADR-010 — Stack de date: Neon Postgres + Drizzle
**Context:** avem nevoie de relații (roluri, validări, schițe); cold start mic pe serverless; free tier real.
**Decizie:** Neon (serverless Postgres) + Drizzle (ORM tip-safe, fără engine binar).
**Consecințe:** $0 la validare, scale-to-zero; pgvector disponibil pentru search semantic ulterior (upgrade, nu rescriere). _(ARHITECTURA §2, §8)_

## ADR-011 — Schiță: publicare DIRECTĂ, fără coadă de acceptare
**Context:** modelul inițial avea `DRAFT → PENDING_ACCEPTANCE → PUBLISHED/REJECTED` (autorul detaliului-mamă
aproba/respingea fiecare schiță înainte să intre în teanc) — o fricțiune suplimentară care încetinea
dezbaterea și adăuga o stare de așteptare fără beneficiu clar la scara unui MVP de validare.
**Decizie (2026-06-30):** simplificat la `DRAFT → PUBLISHED` — autorul schiței publică direct, intră imediat
în teanc, public. Moderarea rămâne **post-publicare**: autorul detaliului-mamă SAU autorul schiței poate
șterge schița oricând (nu aprobare/respingere).
**Consecințe:** `PENDING_ACCEPTANCE`/`REJECTED` rămân valori istorice în enumul `sketch_status` (date vechi),
dar nu se mai produc. Notificările „schiță acceptată/respinsă" au fost eliminate (`SKETCH_ACCEPTED`/
`SKETCH_REJECTED` rămân în `notification_type`, nemaifolosite). _(CHANGELOG 2026-06-30, SCHEMA.md)_

## ADR-012 — Ștergere condiționată + identitate mascată în SQL (`authorId` vs `ownerId`)
**Context:** ștergerea necondiționată a unui detaliu care strânsese deja discuție (comentarii, poziții,
schițe de la alții) rupea acea discuție pentru toți ceilalți — conținut real, dispărut fără urmă.
**Decizie (2026-08-06):** un detaliu FĂRĂ interacțiuni de la alții se șterge complet, ca înainte. Unul CU
interacțiuni nu se mai poate șterge fizic — autorul se RETRAGE (`anonymized_at`): nume/poză mascate la
citire, rolul (înghețat în `author_role_snapshot`) și conținutul rămân. Masca se aplică O SINGURĂ DATĂ,
în SQL, la interogare (`detailWithAuthorColumns`) — nu în componentele de afișare, altfel identitatea tot
ar fi ajuns în payload-ul trimis clientului. Rândul expune două identități: `authorId` (mascată, `NULL`
după retragere, sigură pentru client) și `ownerId` (reală, neschimbată, STRICT pentru autorizare
server-side, niciodată trimisă clientului).
**Consecințe:** orice verificare de ownership server-side NOUĂ trebuie să folosească `ownerId`, nu
`authorId` — o confuzie ușor de făcut (patru cazuri reale găsite și reparate la audit, 2026-08-07: vezi
`docs/SECURITATE.md` §„Audit țintit — retragerea autorului"). _(CHANGELOG 2026-08-06, ARHITECTURA §4)_

## ADR-013 — Planșă (canvas privat) cu engine PROPRIU, nu tldraw/Excalidraw
**Context:** primă implementare (2026-07-05) a folosit tldraw, apoi Excalidraw — un wrapper subțire peste
un whiteboard generic nu servea întrebarea pe care platforma o testa (dezbaterea pe roluri), și aducea
complexitate/dependențe nefolosite (multi-user live, layere, unelte generice).
**Decizie:** scos ambele ÎN ACEEAȘI ZI, reconstruit cu engine propriu (`components/plansa/plansa-canvas.tsx`),
pe modelul deja construit pentru Schiță (`perfect-freehand` prin `renderStrokes`, reutilizat 1:1).
Document serializat `{ version, items, strokes }`; zonă fixă (16:10), fără canvas infinit, fără rotație/
multi-select în v1.
**Consecințe:** zero dependențe externe grele; consistență de cod cu Schița (același engine de desen);
lățime funcțională mai mică decât un whiteboard generic (deliberat — planșa nu trebuie să fie Figma).
_(CHANGELOG 2026-07-05, ARHITECTURA §5)_

## ADR-014 — Proiecte: al treilea nivel de vizibilitate, cu o singură poartă de acces
**Context:** nevoie de colaborare restrânsă (owner + invitați) pe detalii, ÎNAINTE de publicare în
comunitate — diferit atât de „public" (Detaliu) cât și de „strict privat, un singur user" (Planșă).
**Decizie (2026-08-09):** un al treilea nivel, cu 2 poziții identice în drepturi (Autor/Invitați, fără
Viewer/Editor), invitație prin link opac regenerabil (nu email). Un detaliu combină `status` existent cu
`project_id`: DRAFT+null = ciornă, PUBLISHED+id = vizibil doar membrilor, PUBLISHED+null = public.
„Scoate în comunitate" e ireversibil. **Un singur punct de control server-side** (`canAccessProjectDetail`)
prin care trece orice citire de conținut de proiect — nu se duplică logica de acces în fiecare suprafață.
**Consecințe:** un invariant transversal nou peste cod scris sub presupunerea opusă produce goluri în
FIECARE loc care nu trece prin poartă, nu unul singur — 14 găsite și reparate în 6 runde de review la
implementare (feed/rail-uri, profil, teasere, notificări, liste private — vezi `CLAUDE.md` §„Capcane
tehnice"). Cascada de ștergere nu e doar `ON DELETE CASCADE` (validări/comentarii polimorfice + Blob nu
cad automat) — orchestrată explicit în service. _(CHANGELOG 2026-08-09, ARHITECTURA §4-5)_

## ADR-015 — Badge-uri de reputație CALCULATE LIVE, fără tabelă de scor
**Context:** cerere de produs pentru un semnal de reputație vizibil pe profil (Bronz/Argint/Aur), fără
să contrazică ADR-006 (validările rămân fără pondere numerică individuală).
**Decizie (2026-08-17):** badge-urile se calculează LIVE din statistici deja existente (detalii
publicate, schițe, validări date/primite, zile active) — fără tabelă proprie de scor, deci fără risc de
desincronizare. Un singur snapshot minimal (`users.seen_badges`, jsonb) reține ultimul set văzut de
user, strict pentru pop-up-ul de celebrare la un badge nou — nu e sursa de adevăr a badge-urilor, doar
un marcaj „ce am arătat deja".
**Consecințe:** niciun cron/job de recalculare necesar; badge-urile sunt mereu consistente cu statisticile
curente. Suprafață mică de securitate (citire agregată + un snapshot per user), verificată ad-hoc, nu
printr-un audit formal dedicat — vezi `docs/SECURITATE.md` §„Suprafață neacoperită de audit formal".
_(CHANGELOG 2026-08-17, ARHITECTURA §5)_

## ADR-016 — Captarea intenției de referral peste magic-link, prin cookie + consum la onboarding
**Context:** link de referral (`?ref=<cod>`) trebuie legat de contul nou creat — dar în auth passwordless
(ADR-002), contul se creează într-un request SEPARAT (click pe magic link din email), fără nicio legătură
directă cu vizita inițială pe `/signup?ref=`. Verificat cu context7: `events.createUser` (Auth.js v5) nu
primește `request`/cookies în semnătură — nu era un loc sigur de citit intenția.
**Decizie (2026-08-25):** `proxy.ts` pune un cookie de intenție (httpOnly, 30 zile) la vizita pe
`/signup?ref=<cod>`; `app/onboarding/actions.ts` (singurul punct din flux cu Server Action, deci cu
voie să scrie/citească cookie-uri) îl consumă O SINGURĂ DATĂ, la finalul contului nou — fără să ating
intern Auth.js/adapterul Drizzle.
**Consecințe:** pattern reutilizabil pentru orice intenție viitoare care trebuie să supraviețuiască
round-trip-ul de magic-link (nu doar referral) — cookie la intrare, consum la primul Server Action
disponibil după autentificare (azi: onboarding). _(CHANGELOG 2026-08-25, SCHEMA.md)_

---

## ADR-017 — Fisiere de continut in Blob privat, citite prin aplicatie (2026-10-26)
**Context:** imaginile detaliilor, schitele, plansele si atasamentele ofertelor erau pe URL-uri publice, accesibile si dupa revocare.
**Decizie:** doua store-uri: avatar/cover/imagini din comentarii raman publice; restul in Blob privat, citit prin `GET /api/files/[kind]/[id]` cu verificare de acces la fiecare cerere, fara cache public.
**Consecinte:** citirile trec prin server (cost/latenta); migrarea cere cutover coordonat si backup; ce s-a descarcat deja nu se poate retrage.

## ADR-018 — JWT revocabil pe sesiune, expirare absoluta (2026-10-27)
**Context:** logout/suspendare trebuiau sa aiba efect imediat, iar JWT-ul nu se putea revoca.
**Decizie:** pastram Auth.js JWT + un `sid` aleator in tabelul `sessions`; expirarea (+7 zile) se fixeaza la login; `auth()`/proxy verifica randul la fiecare cerere.
**Consecinte:** logout-ul deconecteaza doar dispozitivul curent; cookie-urile vechi fara `sid` cer o reconectare.

## ADR-019 — Atasamentele ofertelor nu se sterg fizic la editare/retragere (2026-10-27)
**Context:** acelasi furnizor poate refolosi un fisier in mai multe oferte; stergerea imediata putea lua fisierul altei oferte.
**Decizie:** se sterg doar referintele din DB; fisierele raman.
**Consecinte:** fisierele fara referinte ocupa storage; curatenia se face separat, cu inventar, dry-run si backup.

## ADR-020 — Dezaprobare + justificare si onboarding intr-un singur statement SQL (2026-10-27)
**Context:** driverul `neon-http` nu suporta tranzactii interactive, iar scrierile partiale lasau date inconsistente.
**Decizie:** CTE modificator (pozitie + comentariu) si `ON CONFLICT DO NOTHING` pentru rol; un esec anuleaza tot statement-ul.
**Consecinte:** fara schema noua; concurenta reala se verifica doar pe Preview.

## ADR-021 — Eliminarea membrului din proiect dupa lock (2026-10-27)
**Context:** un membru eliminat in timp ce reintra pe link ramanea in proiect.
**Decizie:** `db.batch` cu doua instructiuni (rotire invitatie, apoi UPDATE membership), sub READ COMMITTED.
**Consecinte:** un round-trip; READ COMMITTED e preconditie, verificata pe ambele baze.

## ADR-022 — Miniatura plansei pe ruta separata, nu Server Action (2026-10-27)
**Context:** Server Actions ruleaza in coada (FIFO); miniatura bloca salvarea urmatoare si iesirea din editor.
**Decizie:** upload Blob din client + `POST /api/canvases/[id]/thumbnail`; documentul ramane pe Server Action.
**Consecinte:** o ruta noua, cu Origin, sesiune, rate limit si ownership in service.

## ADR-023 — Mascarea linkului de magic link inainte de PostHog (2026-10-28)
**Context:** referrer-ul `/verify?u=...` trimitea in PostHog emailul si tokenul de login.
**Decizie:** `before_send` existent mascheaza `u`, `token`, `email`, `callbackUrl` in URL-uri, referrer si `$set`; `error=Verification` ramane.
**Consecinte:** istoricul PostHog si Session Replay nu se curata retroactiv.

## ADR-024 — Retry upload detaliu cu aceeasi imagine (2026-10-28)
**Context:** dupa o validare respinsa, retrimiterea formularului pierdea imaginea deja urcata.
**Decizie:** `reprocessBlobImage` cu `preserveOriginal` doar pentru detalii: originalul din staging ramane pana la succes.
**Consecinte:** originale abandonate pot ramane in staging; curatenia e separata.

## ADR-025 — Snapshot actual la partajarea plansei (2026-10-28)
**Context:** partajarea folosea miniatura veche, nu documentul salvat.
**Decizie:** la partajare se randeaza snapshot-ul din documentul salvat, cu rendererul existent; serverul verifica accesul si amprenta starii.
**Consecinte:** daca snapshot-ul esueaza, partajarea esueaza (fara fallback la miniatura veche); ADR-022 ramane valabil.

## ADR-026 — Cache de geometrie pentru trasee imuabile (2026-10-28)
**Context:** ambele editoare recalculau acelasi traseu freehand la fiecare `pointermove`.
**Decizie:** `renderStrokes` reutilizeaza outline/Path2D printr-un WeakMap pe obiectul Stroke.
**Consecinte:** fara dependinte noi; castigul e masurat doar pe CPU, nu in FPS de browser.

## ADR-027 — Notificari pe infrastructura existenta (2026-10-28)
**Context:** activitatea din discutii trebuie anuntata fara divulgarea continutului privat.
**Decizie:** notificari in-app catre autorul continutului/firului si destinatarul reply-ului, deduplicate, fara autonotificari sau extras din comentariu.
**Consecinte:** accesul se verifica la creare si citire; discutiile disparute sau devenite inaccesibile nu mai apar in notificari.

## ADR-028 — Urmarire explicita si filtre comune pentru feed (2026-10-28)
**Context:** personalizarea feed-ului trebuie sa pastreze vizibilitatea, anonimizarea si paginarea.
**Decizie:** doua relatii FK pentru useri/categorii, stare idempotenta; „Urmariti” include autor SAU categorie, cu aceleasi filtre pentru rezultate si total.
**Consecinte:** urmarirea nu acorda acces si nu dezvaluie autorii anonimi; rolul/verificarea respecta snapshot-ul afisat.

## ADR-029 — PDF prin tiparire autentificata (2026-10-28)
**Context:** exportul unui detaliu trebuie sa respecte accesul si anonimizarea existente.
**Decizie:** pagina de tiparire cu imagine, metadate si resurse; salvare PDF prin dialogul browserului.
**Consecinte:** fara renderer server sau fisier public persistent; PDF-ul descarcat nu poate fi revocat.

## ADR-030 — PWA online, fara continut privat offline (2026-10-28)
**Context:** instalarea pe telefon trebuie sa pastreze regulile de acces dupa logout sau suspendare.
**Decizie:** manifest si service worker minimal, fara cache de continut, acces offline sau push.
**Consecinte:** aplicatia necesita internet; fara librarie PWA noua.

## ADR-031 — Judet optional pe detaliu, filtru „Locație" in feed (2026-10-28)
**Context:** locatia unui detaliu din Romania era doar „România", deci filtrul pe locatie n-avea pe ce sa se bazeze.
**Decizie:** coloana `details.county` (nullable, lista fixa de 42), aleasa optional la publicare doar pentru Romania; filtrul `judet` in feed.
**Consecinte:** detaliile vechi raman fara judet si apar doar fara filtru de judet; „Autor verificat" si „Cu schițe" scoase din filtre.
