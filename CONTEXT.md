# DETALIA — Context de business & domeniu

> Detaliile de domeniu/business ale produsului: ce este, stack, glosar, reguli de business,
> decizii de produs. Citește acest fișier DOAR când ai nevoie de detaliul respectiv — nu se
> încarcă automat. Regulile de proces/clasificare/quality gates/capcane tehnice rămân în
> `CLAUDE.md` (mereu în context).

---

## Ce este DETALIA
Comunitate profesională din construcții, organizată în jurul **detaliului de execuție**. Modelul mental:
**„GitHub pentru construcții"** — detaliu = repo, schiță = fork+PR, validare = code review. Faza curentă:
**validare de piață** (cost ~$0, livrare rapidă, fundație care scalează fără rescriere). Lansare = **acces
public deschis** (înregistrare liberă), cu **conținut seed** pus la început prin conturi reale (echipa +
useri aduși din toate categoriile) ca platforma să nu fie goală la primul contact.

Întrebarea pe care MVP-ul o testează: *dacă pun un detaliu bun în față, se aprinde dezbaterea pe roluri?*

---

## Stack (confirmat)
Single-app **Next.js (App Router)** pe **Vercel** · **Neon Postgres** + **Drizzle** · **Auth.js v5** —
**magic link (Resend)**, passwordless (fără parolă) — *Google OAuth scos pentru MVP; schela de re-adăugare e documentată
în comentarii (`lib/auth.ts`)* · **Resend** (email) · **Vercel Blob** (stocare) · **Canvas + perfect-freehand** pentru schiță.
NU monorepo Fastify în această fază (motivare: `docs/ARHITECTURA.md §2`). Business izolat în `server/` ca
extragerea spre API separat ulterior să fie posibilă fără rescriere.

---

## Glosar de domeniu (limbaj unic — folosește acești termeni în cod și UI)
- **Detaliu** (`Detail`) — unitatea de conținut (~repo). Titlu, autor+rol, categorie, opțional zonă
  climatică/seismică, 1 imagine 2D, opțional 2–3 resurse.
- **Schiță** (`Sketch`) — o „foaie" desenată peste un detaliu-mamă, cu **un singur autor** (~fork+PR).
  Termenul se referă la contribuția **altcuiva** peste detaliul tău.
- **Adnotare** (2026-07-31) — desenul autorului peste **propriul** detaliu: notițe/săgeți/cote prin care
  se explică singur. Structural e tot un rând în `sketches` (`sketch.authorId === detail.authorId`,
  predicatul `isSelfAnnotation`), dar semantic NU e o contribuție primită → nu intră în teanc, nu se
  numără la „N schițe", nu generează notificare. Se afișează peste imaginea de bază a detaliului.
  **Actualizat 2026-08-02:** un detaliu poate avea **până la 3 adnotări** (`MAX_ANNOTATIONS_PER_DETAIL`,
  impus în `publish`), fiecare o explicație distinctă. Se deschid **una câte una, la cerere** — implicit
  imaginea de bază se vede curată. Autorul le poate **șterge** (singura cale de a scăpa de una); nu există
  editare pe loc: corectezi ștergând și desenând alta. (Între 07-31 și 08-01 regula era „exact una,
  re-adnotarea o înlocuiește" — vezi CHANGELOG.)
- **Validare** (`Validation`) — poziția unui user pe un detaliu SAU pe o schiță: **Aprob** / **Dezaprob**.
- **Rol / Subrol** — PROIECTANT / EXECUTANT / FURNIZOR / BENEFICIAR + subrol (arhitect, inginer, etc.).
- **Teanc** — totalitatea schițelor PUBLISHED ale unui detaliu (navigabile prin taburi).

---

## Reguli de business NON-NEGOCIABILE (enforce pe SERVER, nu pe frontend)

### Validarea pe roluri (inima)
- Buton **identic** pentru toți. Lângă fiecare poziție/comentariu se afișează **numele + rolul**.
- **Aprob = 1 click.** **Dezaprob = justificare OBLIGATORIE** → respinge pe server dacă lipsește; justificarea
  devine automat un `Comment` (cu `originValidationId`), atribuit nume+rol. **Nu există „dezaprobare mută".**
- **O singură poziție per user per țintă, reversibilă** — garantat de constrângere unică în DB
  `(userId, targetType, targetId)`.
- **FĂRĂ ponderare numerică / scor / reputație în MVP.** Greutatea o judecă cititorul uitându-se la rol.
  Noi doar afișăm rolul corect și transparent. (Scoring = backlog, decizie de produs separată.)

### Discovery (feed & căutare)
- Feed **finit, ~20 detalii**, sortare **strict cronologică** (cele mai noi primele) — **FĂRĂ scroll infinit**
  (caracter de comunitate, nu social media). *(Corectat 2026-07-23: comentariul din cod zicea „sortat
  după interacțiuni", dar `listFeed` a fost dintotdeauna cronologic; decizie explicită — rămâne cronologic,
  interacțiunile se văd per card. Sortarea după scor există separat, în rail-ul „cele mai dezbătute"
  — `listTopDebated`.)*
- La început doar **filtre** + căutare simplă; căutarea liberă „cu vorbele tale" vine mai târziu.

### Schița — state machine (enforce în `SketchService`)
```
DRAFT ──(autorul dă PUBLISH)──▶ PUBLISHED  (intră DIRECT în teanc, public)
```
- **Simplificat 2026-06-30:** schițele se publică **direct** (fără coadă de acceptare). Modelul
  „accept autor-mamă" a fost eliminat. *(Valorile `PENDING_ACCEPTANCE`/`REJECTED` rămân în enumul DB doar pentru
  date istorice — nu se mai produc.)*
- **Moderare POST-publicare:** autorul detaliului-mamă **SAU** autorul schiței poate **ȘTERGE** o schiță
  (`deleteSketch`, ownership pe server, cascadă validări+comentarii+blob). Nu există aprobare/respingere.
- La PUBLISH → `Notification` către autorul detaliului-mamă („X a schițat peste «detaliu» → vezi în teanc").
  La ștergerea de către autorul-mamă → `Notification` (`SKETCH_DELETED`) către autorul schiței.
  **Notificările merg doar in-app** (decizie 2026-07-03: emailurile de notificare OPRITE — cota Resend
  free rămâne pentru magic link-uri; repornibile cu `NOTIFICATION_EMAILS_ENABLED=true`).
- **Validarea pe propriul conținut e interzisă** (`CANNOT_VALIDATE_OWN`, enforce pe server): autorul nu vede
  Aprob/Dezaprob pe propriul detaliu/schiță. Aprobarea propriului conținut e implicită prin publicare.
- **Dezaprobare = alegere binară** (pe detaliu): „Scrie o justificare" (text → comentariu) SAU „Fă o schiță"
  (desenul **e** justificarea). La varianta schiță, poziția DISAPPROVE + comentariul se materializează **la
  publicarea schiței** (draft marcat `disapprovesParent`), nu la click → fără „dezaprobare mută" la abandon.
- Schițarea e **asincronă** (fiecare foaie un autor). **FĂRĂ co-desenare real-time în MVP.** (Model confirmat.)
- Stroke-uri stocate **vectorial** (`strokesJson`, coordonate **normalizate 0..1** față de imaginea-mamă).
  La publicare se randează **o singură dată** un thumbnail PNG (Blob) pentru hover-slideshow/liste.
- **UX la intrarea în modul schiță:** detaliul-mamă se afișează cu **fill slab** (intensitate redusă, nu la
  intensitatea naturală) — semnal vizibil că s-a declanșat schițarea + ajută la desenat peste detalii colorate intens.
- **Unelte MVP:** mai multe **culori stridente** + **3 grosimi** de creion + **radieră** + **undo/redo**.
  (Viitor: Line / Circle / Square / Arrow / inserare casetă text.)
- `Validation` și `Comment` sunt **polimorfice** (Detail SAU Sketch) → dezbaterea per schiță vine gratis.

### Acces & roluri
> **Două porți distincte, nu le confunda:** Poarta 1 = **accesul** (cine intră în platformă).
> Poarta 2 = **credibilitatea** (cât „cântărești" odată intrat → rol declarat → verificat). Sunt independente.

- **Poarta 1 — acces: PUBLIC (confirmat, iunie 2026).** Înregistrare deschisă, fără invitație. Flux:
  landing → „creare cont" → email → magic link → onboarding profil (rol, subrol, poză) → feed. *(Logica de
  invitații a fost eliminată complet — 2026-06-28, vezi CHANGELOG; dacă vreodată se vrea acces restricționat,
  se construiește un mecanism nou de la zero.)*
- **Rolul e auto-declarat de user la signup** (categorie + subrol). Acces imediat după declarare → minimizează
  frecarea la primul contact. Rolul e **vizibil permanent** lângă nume.
- **Poarta 2 — verificare rolului = „pull, nu push":** flux separat în platformă ("Verificare rol", inițiat de
  user), **opțional, fără blocare**. Rol neverificat = **funcțional 100%**. Nu stresăm pe nimeni: doar un
  **nudge blând permanent** („Rolul tău nu e verificat → Verifică rolul"). Userii vin **singuri** să se
  verifice, motivați de credibilitate (rol verificat „cântărește" mai mult în ochii cititorului). La verificare
  le cerem niște date; **aprobarea e manuală (admin)** în MVP; OAR/CUI auto = ulterior. Odată verificat →
  **badge cu steluță galbenă** lângă rol (poziția UI exactă — lângă rol și/sau avatar — se decide la implementare).
  Fără scoring numeric: greutatea e dată de rol + faptul că e verificat, judecată de cititor.
- **Upload de detalii DESCHIS userilor (confirmat, iunie 2026).** Orice user autentificat cu **rol
  declarat** poate publica detalii (nu trebuie să fie verificat). **Moderare post-publicare** (publici direct,
  ștergem abuzurile ulterior) — fără cozi de aprobare în MVP. Calitatea o dă validarea/dezbaterea pe roluri.
  Seed-ul inițial e tot prin conturi reale (vezi mai jos), dar uploadul NU mai e limitat la admin/seed.

---

## Decizii de produs confirmate
> Accesul public, uploadul deschis, rolul auto-declarat, verificarea „pull nu push", magic link-ul
> passwordless, schița asincronă și notificările doar in-app sunt descrise o singură dată, mai sus
> (§„Reguli de business", §„Acces & roluri", §„Schița"). Aici stau doar deciziile care nu apar acolo:

- **Taxonomia de categorii + meseriile** — finalizate și implementate 2026-07-02 (vezi CHANGELOG).
- **Zone climatice/seismice + încărcare zăpadă/vânt** — liste fixe, implementate 2026-07-02 (vezi CHANGELOG).
- **Resurse suplimentare** — rămân IMAGE/LINK/PDF/TEXT (nu doar imagini).
- **Un singur rol per user** (nu roluri multiple), plus **rol adițional opțional** (Administrativ/Educație), aditiv.

## Decizii deschise
- **Surse de verificare automată a rolului** (OAR/CUI confirmate?), dincolo de manual-admin: **pe HOLD**.
- Vezi `.remember/remember.md` §„Decizii / HOLD" pentru lista completă la zi (Termeni și Condiții, firmă/SRL,
  specializări pe profil).
