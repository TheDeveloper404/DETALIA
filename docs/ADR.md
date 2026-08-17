# DETALIA — Decizii de arhitectură (ADR — formă scurtă)

> **Actualizat 2026-08-07: proiectul a trecut din faza MVP în v1 — 100% funcțională, 19 useri activi.**
> Deciziile de mai jos rămân valabile ca înregistrare istorică (context → decizie de la momentul
> respectiv) — referințele la „MVP" din corpul lor nu sunt retro-editate.
>
> Registru compact al deciziilor structurante și **de ce** au fost luate (context → decizie → consecințe).
> Forma e deliberat **ușoară** (nu ceremonie enterprise): la scara unui MVP de validare, `CHANGELOG.md` ține
> jurnalul cronologic, iar acest fișier fixează deciziile *durabile* într-un singur loc, ușor de revizitat.
> O decizie marcată **ÎN HOLD** rămâne reversibilă până la confirmare.

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

---

> Deciziile noi sau schimbările se consemnează aici (formă scurtă) + în `CHANGELOG.md` (cronologic, cu dată).
