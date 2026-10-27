# DETALIA — Decizii de arhitectură (ADR — formă scurtă)

> **Actualizat 2026-08-07: proiectul a trecut din faza MVP în v1 — 100% funcțională, 26 useri activi
> (2026-08-25).**
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

## ADR-017 — Fisiere de continut in Blob privat, citire autorizata prin aplicatie
**Decizie aprobata de Liviu (2026-10-26):** doua store-uri. Avatarele, cover-urile si imaginile din
comentarii pastreaza storage public. Imaginile/resursele de detaliu, thumbnail-urile schitelor,
plansele personale/partajate si atasamentele ofertelor folosesc storage privat, inclusiv dupa release.
Regulile de vizibilitate existente decid citirea; publicarea nu copiaza fisiere intre store-uri.
**Alternative:** proxy peste public nu protejeaza URL-ul brut; promovarea fizica public/private adauga
operatii Blob/DB fara tranzactie comuna. Varianta privata permanenta elimina aceasta sincronizare.
**Contract:** GET `/api/files/[kind]/[id]`, identificator UUID si tip explicit; URL-ul se citeste numai
din DB. Service-ul verifica owner/proiect/status/hiddenAfterRelease. Ofertele: autorul real al detaliului
sau furnizorul propriei oferte. Drafturile si plansele personale nu devin publice. Stream fara cache
public; Next Image foloseste `unoptimized` pentru aceste rute. Cheile raman exclusiv server-side.
**STRIDE:** IDOR si acces dupa revocare → verificare pe entitate la fiecare cerere; SSRF → store-uri
configurate strict; furt de token → niciun token in client/loguri; divulgare prin cache → no-store;
pierdere la migrare → copie verificata, manifest, actualizare conditionata a referintelor, retragere
publica doar dupa verificarea tuturor bazelor care folosesc store-ul comun si oprirea scrierilor vechi.
**Consecinte:** citirile trec prin server (cost/latenta suplimentare); fara schema noua sau dependente.
Migrarea necesita cutover coordonat si backup privat; revenirea la codul vechi dupa cutover nu e sigura.
Nu putem retrage fisiere deja descarcate. DET-01/02 si imaginile comentariilor raman in afara acestui task.

> Deciziile noi sau schimbările se consemnează aici (formă scurtă) + în `CHANGELOG.md` (cronologic, cu dată).

## ADR-018 — JWT revocabil pe sesiune si expirare absoluta (2026-10-27)

**Decizie aprobata:** pastram Auth.js JWT si adaugam un sid stabil, aleator, inregistrat in tabelul
existent sessions. Expirarea din DB se seteaza o singura data la login (+7 zile), fara prelungire.
**Alternative:** sesiuni database native schimba decoderul proxy si mai multe contracte existente;
sessionVersion pe user ar deloga toate dispozitivele, comportament necerut.
**Flux:** login → sid + rand sessions → auth()/proxy verifica registrul → autorizare existenta.
Proxy combina sesiune/status/rol in query-ul existent; auth() face verificarea proaspata necesara.
Revocarea server-action este asteptata explicit inainte de signOut. La POST HTTP, Auth.js valideaza
intai CSRF, apoi revocarea trebuie sa reuseasca inaintea livrarii raspunsului care sterge cookie-ul.
**STRIDE:** replay cookie → rand revocat; prelungire JWT → expirare DB fixa; CSRF logout → validare
Auth.js inainte de revocare; substituire user/sid → asociere verificata; DB indisponibila → acces
refuzat / logout nereportat ca succes. Nu logam sid/cookie/email.
**Consecinte:** o reconectare pentru cookie-urile vechi fara sid; celelalte dispozitive raman
conectate la logout. Nu expunem sid in sesiunea publica. Requesturile deja autorizate pot termina,
dar un cookie reemis concurent nu poate reactiva randul sters. Fara schema, dependinte sau env noi.

## ADR-019 — Retentia fizica a atasamentelor ofertelor (2026-10-27)

**Decizie aprobata:** editarea/retragerea ofertei, retragerea/stergerea detaliului si stergerea
proiectului elimina referintele ofertei din DB, fara stergerea fizica a atasamentelor.
**Motiv:** acelasi furnizor poate reutiliza un URL in mai multe oferte; o stergere imediata poate
elimina fisierul altei oferte. Un pre-check de referinte singur nu inchide cursa cu reutilizarea.
**Alternative:** stergere imediata (risc de pierdere), GC automat coordonat cu writer-ii (complexitate
neceruta acum). Alegem retentie si curatenie separata, fara schema/registru/cron nou.
**Consecinte:** fisierele fara referinte continua sa ocupe storage; curatenia initiala recomandata
necesita inventar/dry-run, backup, toate bazele care impart store-ul si o fereastra fara scrieri.
Se poate executa pe infrastructura curenta; VPS-ul nu este o dependenta tehnica. Nu se schimba
stergerea imaginilor/resurselor detaliilor, schitelor sau planselor.

## ADR-020 — Invariantele dezaprobarii si onboarding-ului intr-un singur statement (2026-10-27)

**Scop aprobat:** pozitie + justificare fara scriere partiala; onboarding respins fara profil modificat.
**Decizie:** SQL parametrizat cu CTE modificator, fara schema noua. validationsRepo decide tranzitia
DISAPPROVE prin upsert conditionat si insereaza comentariul din RETURNING; un esec anuleaza statement-ul.
Onboarding valideaza rolul in domain si verifica rolul existent inaintea procesarii imaginilor.
usersRepo insereaza rolul cu ON CONFLICT DO NOTHING si actualizeaza profilul numai din claim-ul obtinut.
Rolul si profilul devin vizibile impreuna la commit; o cerere concurenta pierzatoare nu modifica profilul.
**Alternative:** preflight singur lasa cursa intre verificare si scriere; tranzactiile interactive nu
sunt suportate de driverul neon-http instalat. batch atomic este posibil, dar CTE-ul exprima direct
dependenta dintre rezultate fara exceptii de conflict folosite ca flux de control.
**Consecinte:** erorile/codurile publice si gardurile actorului raman existente. Imaginile omise se
pastreaza. Fisierele reprocesate se curata la conflict explicit sau esec cunoscut inainte de DB;
la eroare de retea cu rezultat de commit incert nu se sterg, pentru a nu pierde o imagine deja referita.
SQL PGlite verifica rollback real de statement; concurenta intre conexiuni si HTTP real necesita Preview.

## ADR-021 — Eliminarea membrului dupa obtinerea lock-ului de proiect (2026-10-27)

**Scop aprobat:** eliminarea ramane efectiva cand membrul reintra simultan, inclusiv prima intrare.
**Decizie:** doua instructiuni SQL parametrizate in acelasi `db.batch` Neon HTTP: rotire invitatie,
apoi UPDATE membership. La READ COMMITTED, a doua instructiune vede commit-ul reintrarii care
tinea lock-ul proiectului. Ambele scrieri se confirma sau se anuleaza impreuna.
**Alternativa respinsa:** CTE-ul modificator are un singur snapshot si poate rata randul
nou/reactivat. Eliminarea filtrului removed_at singura nu rezolva randul inca inexistent.
**STRIDE:** reintrare cu token vechi → serializare pe proiect si reverificare la join;
acces pastrat dupa eliminare → snapshot nou inaintea UPDATE-ului; eroare la eliminare → rollback
al rotirii. Gardul de owner si ramura fara token nou raman existente, fara schimbare de API/schema.
**Consecinte:** un singur round-trip HTTP, doua instructiuni in tranzactie; READ COMMITTED este
preconditie verificata pe preview/dev si production. Testele locale cu conexiuni independente
controleaza ambele ordini ale lock-ului, inclusiv membru nou, si esecul celei de-a doua scrieri.

## ADR-022 — Miniatura plansei in afara cozii de Server Actions (2026-10-27)

**Scop aprobat:** miniatura optionala nu blocheaza urmatorul document sau iesirea din editor.
**Decizie:** task-ul client separat incarca Blob-ul si foloseste fetch POST
`/api/canvases/[id]/thumbnail`, JSON `{ thumbnailUrl: string }`. Salvarea documentului ramane
Server Action. Serviciul existent `saveCanvasThumbnail` primeste acum URL staging, verifica owner-ul,
valideaza namespace-ul canonic si reproceseaza imaginea inainte de persistare; actiunea veche dispare.
**Alternativa respinsa:** un Promise detasat pentru thumbnail Server Action intra tot in dispatcher-ul
FIFO Next.js. Nu activam optiuni experimentale globale si nu adaugam o abstractie de service.
**Contract:** Origin identic obligatoriu (403); sesiune/status ACTIVE (401); mutation limiter (429);
JSON/tip URL invalid sau imagine invalida (400); plansa lipsa/nedetinuta (404, contractul privat existent);
eroare neasteptata (500 generic); succes 200 `{ ok: true }`. Identitatea vine numai din sesiune.
**STRIDE:** CSRF → Origin; IDOR → ownership in service; stergere cross-user/SSRF → staging propriu
canonic si pipeline existent; abuz → cota existenta si cel mult o miniatura client in curs.
Un UPDATE explicit respins curata numai fisierul nou; o exceptie DB cu commit incert nu-l sterge.
**Verificare:** integrare prin ruta/gard/service reale cu DB/Blob simulate; E2E Preview tine POST-ul
miniaturii in asteptare si verifica o noua salvare document plus navigarea. Fara schema/dependinte/env noi.
