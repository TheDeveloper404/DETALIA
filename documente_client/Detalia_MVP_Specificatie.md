# Detalia — Specificația MVP
## Structura și conținutul produsului minim viabil

**Versiune:** 1.0 (document de lucru, se rafinează pe parcurs)
**Data:** Iunie 2026
**Autor:** Eduard — Fondator, Owner & CTO
**Relație cu documentul fundamental:** acesta este planul de execuție al MVP-ului; documentul fundamental (v3.0) rămâne referința de concept și viziune.
**Confidențial**

---

## NOTĂ DE METODĂ — disciplina MVP

> **Regula de aur a acestui document:** fiecare element inclus în MVP trebuie să-și justifice locul răspunzând la o singură întrebare — *„dacă scot asta, mai pot testa premisa centrală?"* Dacă răspunsul e „da, încă pot testa", elementul iese sau se amână. Dacă „nu, fără el nu pot testa", elementul rămâne.

Un MVP nu este versiunea mică a produsului final. Este experimentul minim care dovedește că premisa centrală este adevărată în realitate, nu doar în concept. Tot ce nu servește direct acestui scop este balast.

---

## CUPRINS

0. Premisa și criteriul de succes
1. Cele 4 roluri la înregistrare
2. Obiectul „Detaliu" — anatomia minimă
3. Crearea unui detaliu — fluxul de upload
4. Vizualizarea unui detaliu — ecranul-vedetă
5. Validarea pe roluri — inima MVP-ului
6. Comentarii
7. Descoperire — căutare și listă
8. Portofoliul minim
9. Ce NU intră în MVP — lista de tăieri
10. Ce facem manual, nu în cod
11. Stack tehnic minim și efort estimat
12. Decizii deschise pentru MVP

---

# CAPITOLUL 0 — PREMISA ȘI CRITERIUL DE SUCCES

## 0.1 Premisa centrală pe care MVP-ul o testează

> **Există specialiști care, văzând un detaliu tehnic validat de comunitate pe roluri, capătă suficientă încredere și interes încât să intre în joc — să comenteze, să aprobe/dezaprobe cu argument, și să se întoarcă.**

Aceasta NU este o premisă despre „pot construi platforma" (se poate, cu timp și AI). Este o premisă despre **comportamentul uman**: se aprinde dezbaterea structurată pe roluri în jurul aceluiași detaliu, sau nu?

## 0.2 Ce testăm / ce NU testăm

```
TESTĂM:
├── Oamenii intră și înțeleg instant ce e diferit (efectul „wow")
├── Validarea pe roluri produce încredere (beneficiarul/specialistul o simte)
├── Dezaprobarea cu justificare obligatorie generează discuție tehnică reală
├── Oamenii se întorc (retenție) și contribuie (nu doar consumă)
└── Compoziția aprobărilor pe roluri e citită și are sens pentru utilizatori

NU TESTĂM ÎNCĂ (vine după ce premisa e validată):
├── Dacă se poate monetiza (Marketplace, Pro, furnizori)
├── Dacă schițarea colaborativă cu versionare completă funcționează la scară
├── Dacă platforma scalează tehnic la zeci de mii de utilizatori
└── Dacă SEO / creșterea organică funcționează
```

## 0.3 Criteriul de succes — măsurabil

MVP-ul rulează într-un **beta închis** cu ~50–100 de utilizatori invitați manual, pe o perioadă de ~6–8 săptămâni. Considerăm premisa validată dacă:

```
CONȚINUT
├── ≥ 50 de detalii publicate (din care seed-ul fondatorului + parteneri)
└── ≥ 10 detalii ating pragul North Star (min. 10 aprobări din min. 3 roluri)

INTERACȚIUNE
├── ≥ 40% dintre utilizatorii activi dau cel puțin o aprobare/dezaprobare
├── ≥ 25% lasă cel puțin un comentariu sau o justificare de dezaprobare
└── Apar dezbateri reale pe roluri (criteriu calitativ: cel puțin câteva
    fire în care un rol contestă argumentat și altul răspunde)

RETENȚIE
└── ≥ 30% dintre utilizatori revin în a doua și a treia săptămână
    (fără a fi împinși de notificări automate — pentru că nu le avem încă)
```

## 0.4 Semnalul de abandon / pivot (stabilit la rece, acum)

```
DACĂ după 8 săptămâni de beta activ, cu seed content de calitate și
fondatorul moderând personal:
├── utilizatorii intră, se uită și NU validează / NU comentează, SAU
├── dezbaterea pe roluri pur și simplu nu apare (oamenii tac), SAU
├── retenția la 3 săptămâni e sub ~10%
→ atunci premisa NU s-a confirmat în forma actuală.
   Nu se toarnă mai mult cod. Se reanalizează: e problema de produs,
   de public, de moment, sau de concept? Se pivotează conștient,
   nu din inerție emoțională.
```

Acest capitol se citește înaintea oricărei decizii de scope. El este filtrul prin care trece tot restul documentului.

---

# CAPITOLUL 1 — CELE 4 ROLURI LA ÎNREGISTRARE

## 1.1 Principiul: cere minimul, verifică manual

La MVP avem 50–100 de oameni, invitați. Nu construim sisteme de verificare automată. Cerem strictul necesar la înscriere ca să nu pierdem oameni în formular, și verificăm rolul **manual** (vezi cap. 10).

## 1.2 Câmpuri la înregistrare (minim)

```
ÎNREGISTRARE
├── Email
├── Parolă  (sau „Continuă cu Google" — OAuth, dacă e ieftin de pus)
├── Nume / Nume firmă  (afișat public)
├── Rol — categorie  (obligatoriu)
└── Rol — sub-rol     (obligatoriu, din lista categoriei alese)
```

Nimic altceva obligatoriu. Bio, localitate, foto de profil — toate **opționale**, completabile ulterior din profil. Cu cât formularul e mai scurt, cu atât pierdem mai puțini oameni.

## 1.3 Structura de roluri (categorie + sub-rol granular)

```
PROIECTANȚI
├── Arhitect
├── Inginer structurist (rezistență)
├── Inginer instalații (HVAC, termice, sanitare)
├── Inginer electrician
└── Alt proiectant (geotehnician, drumuri, peisagist...)

EXECUTANȚI
├── Constructor general
├── Electrician
├── Instalator (sanitare / termice)
├── Dulgher / structuri lemn
├── Zidar
├── Fierar-betonist
├── Acoperișuri / învelitori
└── Finisaje (faianțar, zugrav, rigipsar...)

FURNIZORI
└── Furnizor de materiale

BENEFICIARI
├── Beneficiar (construiește cu echipă)
└── Auto-constructor (își ridică singur)
```

Lista este editabilă din administrare; pornim cu ea și o ajustăm dacă apar cereri reale.

## 1.4 Declarat vs. verificat (la MVP)

```
La înscriere: rolul este DECLARAT → acces imediat la platformă.
Verificarea: MANUALĂ, făcută de fondator (vezi cap. 10.2).
  → Cei verificați primesc un badge „Verificat" lângă rol.
  → La 50–100 de oameni cunoscuți, verificarea e o conversație, nu un sistem.
```

Rolul este **vizibil permanent** lângă nume, peste tot în platformă. Aceasta este informația-cheie care dă greutate fiecărei aprobări.

## 1.5 Wireframe — ecran de înregistrare

```
┌──────────────────────────────────────────┐
│  Detalia — Creează cont                 │
│                                            │
│  [ Continuă cu Google ]                    │
│  ──────────── sau ────────────             │
│  Email      [______________________]       │
│  Parolă     [______________________]       │
│  Nume       [______________________]       │
│                                            │
│  Eu sunt:                                  │
│  ( ) Proiectant   ( ) Executant            │
│  ( ) Furnizor     ( ) Beneficiar           │
│                                            │
│  Specializarea mea: [ dropdown sub-rol ▼ ] │
│                                            │
│           [ Creează cont ]                 │
└──────────────────────────────────────────┘
```

---

# CAPITOLUL 2 — OBIECTUL „DETALIU" — ANATOMIA MINIMĂ

## 2.1 Principiul: un detaliu nu se citește izolat de datele lui

Header-ul rămâne esențial chiar și la MVP, pentru că fără context (zonă climatică/seismică) validarea devine superficială și greșită. Dar separăm clar ce e **obligatoriu** de ce e **recomandat**, ca să nu îngreunăm uploadul.

## 2.2 Structura unui detaliu în MVP

```
DETALIU (MVP)
│
├── HEADER
│   ├── Titlu                         [OBLIGATORIU]
│   ├── Autor + Rol granular          [automat, din cont]
│   ├── Categorie (din taxonomie)     [OBLIGATORIU]
│   ├── Zonă climatică (I/II/III/IV/General)   [RECOMANDAT, default „General"]
│   ├── Zonă seismică (specificată/General)    [RECOMANDAT, default „General"]
│   ├── Sistem constructiv            [RECOMANDAT]
│   ├── Fază de execuție              [RECOMANDAT]
│   ├── Rezistență la foc             [OPȚIONAL]
│   ├── Listă materiale (text liber)  [OPȚIONAL]
│   ├── Tag-uri                       [OPȚIONAL]
│   └── Data + autor                  [automat]
│
├── CORP VIZUAL
│   ├── Stratul 1: VIZUALIZARE DE BAZĂ 2D   [OBLIGATORIU]
│   │   → o imagine clară: CAD exportat, scan, foto la o schiță, PDF
│   └── Stratul 2: GALERIE SURSE (foto)     [OPȚIONAL]
│
└── EXPLICAȚII (text liber)           [OPȚIONAL]
```

## 2.3 Mecanismul de credibilitate „General"

Opțiunea „General" la zone există, dar interfața semnalează **neintruziv** că detaliile cu parametri specificați au credibilitate mai mare. Nu e o restricție — e o ierarhie de încredere. (Implementare minimă: o etichetă vizuală discretă „Parametri completați" vs. lipsa ei.)

## 2.4 Ce NU conține detaliul la MVP

```
× Fișiere DWG/IFC pentru download   → amânat (val 2; e mecanism de rating, nu esență)
× Viewer 3D / IFC                    → amânat
× Video                              → amânat
× Sistemul de versiuni               → amânat (vezi cap. 9)
```

La MVP, „corpul vizual curat" = o imagine 2D de bază + eventual câteva poze explicative. Atât. E suficient ca specialiștii să discute pe piesă tehnică.

---

# CAPITOLUL 3 — CREAREA UNUI DETALIU — FLUXUL DE UPLOAD

## 3.1 Principiul: chestionar simplu, intuitiv, scurt

Fluxul de upload este organizat ca un chestionar pe pași. Doar pasul cu titlul, categoria și vizualizarea de bază sunt blocante; restul se poate sări.

## 3.2 Fluxul pas cu pas (MVP)

```
PASUL 1 — Ce este?               [OBLIGATORIU]
  → Titlu
  → Categorie (dropdown din taxonomie)

PASUL 2 — Vizualizarea de bază   [OBLIGATORIU, alegi una]
  → [ Încarcă imagine / PDF ]   (JPEG, PNG, PDF)
  → [ Desenează un detaliu ]    (vezi 3.4 — decizie deschisă)

PASUL 3 — Context tehnic         [RECOMANDAT, se poate sări]
  → Zonă climatică · Zonă seismică · Sistem constructiv · Fază
  → Rezistență foc · Materiale · Tag-uri

PASUL 4 — Surse suplimentare     [OPȚIONAL]
  → [ Încarcă imagini ]  /  [ Fă o poză ]

PASUL 5 — Explicații             [OPȚIONAL]
  → Text liber

PASUL 6 — Vizibilitate           [OBLIGATORIU, default Public]
  → ( ) Public   ( ) Vizibil doar pentru mine

PASUL 7 — Publică
```

## 3.3 Opțiunea „Vizibil doar pentru mine"

Permite autorului să-și pregătească detaliile înainte de a le expune. La MVP e o simplă bifă de status (draft/public), fără complexitate.

## 3.4 DECIZIE DESCHISĂ — toolul de desen la MVP

Avem două variante pentru Pasul 2:

```
VARIANTA A (minim absolut): doar upload imagine/PDF.
  + cel mai rapid de construit (zile)
  − pierdem „efectul wow" al desenului direct în platformă

VARIANTA B (recomandată): upload + un tool de desen/adnotare SIMPLU.
  → canvas cu linii, săgeți, text, ștergere (librărie gata: tldraw/Excalidraw/Fabric.js)
  + adaugă spectaculozitate și e relativ ieftin (1–2 săptămâni cu librărie)
  − atenție: ACESTA este DOAR desenul, NU sistemul de versiuni
    (versionarea = val 2, e partea grea — vezi cap. 9)
```

**Recomandare:** Varianta B, dar **strict desenul/adnotarea**, fără logica de versiuni. Decizia finală se ia împreună (cap. 12).

---

# CAPITOLUL 4 — VIZUALIZAREA UNUI DETALIU — ECRANUL-VEDETĂ

> **Acesta este ecranul pe care stă sau cade produsul.** Aici se întâmplă „magia": omul vede ceva real, diferit de orice a văzut, și e atras să intre în joc. Îi dedicăm cea mai mare atenție de design.

## 4.1 Ce trebuie să comunice ecranul în primele 3 secunde

```
1. „Uite un detaliu tehnic clar."          → vizualizarea 2D, mare, curată
2. „Uite cine îl confirmă și cine nu."       → panoul de aprobări pe roluri
3. „Și eu pot să-mi spun părerea."           → butoanele aprob/dezaprob, comentariile
```

## 4.2 Wireframe — ecranul de detaliu (desktop)

```
┌───────────────────────────────────────────────────────────────┐
│  ‹ înapoi      Racordare perete BCA la fundație                 │
│  [Arh.] Ionescu M. · 12 iun 2026 · Categorie: Închideri        │
│  Zonă climatică: III · Zonă seismică: specificată · ✓Parametri  │
├──────────────────────────────────────┬────────────────────────┤
│                                       │  VALIDARE              │
│                                       │                        │
│        [ VIZUALIZARE 2D ]             │  ✅ Aprobări            │
│        (zoom / pan)                   │   Proiectanți    37    │
│                                       │    ├ Arhitecți   20    │
│                                       │    ├ Structuriști 12   │
│                                       │    └ Instalații   5    │
│                                       │   Executanți     24    │
│                                       │   Furnizori       4    │
│                                       │   Beneficiari     2    │
│                                       │                        │
│                                       │  ❌ Dezaprobări         │
│                                       │   Proiectanți     2    │
│                                       │   Executanți      1    │
│                                       │   (vezi justificările) │
│  [ galerie surse: ▢ ▢ ▢ ]            │                        │
│                                       │  ┌──────────────────┐  │
│  EXPLICAȚII:                          │  │   ✅ Aprob        │  │
│  Lorem ipsum despre detaliu...        │  │   ❌ Dezaprob     │  │
│                                       │  └──────────────────┘  │
├───────────────────────────────────────┴────────────────────────┤
│  COMENTARII  (rol vizibil lângă fiecare nume)                   │
│  [Ing. structurist] Popescu: „Atenție la continuitatea hidro…"  │
│  [Constructor general] Radu: „Am executat similar, problema e…" │
│  [ scrie un comentariu... ]                                     │
└─────────────────────────────────────────────────────────────────┘
```

## 4.3 Wireframe — ecranul de detaliu (mobil)

Pe mobil, totul devine vertical, în această ordine de prioritate:

```
┌─────────────────────┐
│ Titlu + autor + rol │
│ header (zone, etc.) │
├─────────────────────┤
│   VIZUALIZARE 2D    │
│   (zoom / pan)      │
├─────────────────────┤
│  ✅ Aprob  ❌ Dezaprob│  ← butoane mari, la îndemână
├─────────────────────┤
│  Compoziția pe roluri│
│  (aprobări/dezapr.) │
├─────────────────────┤
│  Explicații          │
├─────────────────────┤
│  Comentarii          │
└─────────────────────┘
```

Mobilul e pentru **consum + contribuție ușoară** (citește, aprobă, comentează, fă o poză). Crearea complexă de detalii rămâne mai comodă pe ecran mare.

---

# CAPITOLUL 5 — VALIDAREA PE ROLURI — INIMA MVP-ULUI

> **Acesta este diferențiatorul. Dacă tăiem ceva de aici, nu mai testăm Detalia, testăm un forum oarecare.**

## 5.1 Buton identic pentru toți, greutatea o cântărește cititorul

Nu există butoane diferite pe rol. Toți apasă același „Aprob" / „Dezaprob". Diferența o face afișarea: lângă fiecare aprobare se vede rolul granular, iar cititorul cântărește singur greutatea.

## 5.2 Regulile de bază ale validării

```
APROBARE
├── Un singur click. NU cere justificare.
├── Înseamnă „sunt de acord cu tot ce conține acest detaliu".
└── Se înregistrează cu rolul granular al celui care aprobă.

DEZAPROBARE
├── La click pe „Dezaprob" → se deschide OBLIGATORIU o fereastră de justificare.
├── Fără justificare, dezaprobarea NU se înregistrează. Nu există dezaprobare „mută".
├── Justificarea se adaugă AUTOMAT în comentarii, cu nume + rol granular.
└── Aici intră normativele, argumentele structurale, observațiile tehnice.

REGULI COMUNE
├── Un utilizator = o singură poziție per detaliu (aprob SAU dezaprob).
├── Poziția se poate schimba (din aprob în dezaprob și invers).
│   La trecerea spre dezaprob, se cere justificarea.
└── Autorul nu se poate auto-aproba.
```

## 5.3 Fereastra de justificare la dezaprobare

```
┌───────────────────────────────────────────┐
│  De ce dezaprobi acest detaliu?            │
│  (justificarea va apărea public în          │
│   comentarii, cu numele și rolul tău)       │
│                                            │
│  [_________________________________]        │
│  [_________________________________]        │
│                                            │
│         [ Anulează ]  [ Trimite ]          │
└───────────────────────────────────────────┘
```

Acest mecanism face trei lucruri simultan: obligă la responsabilitate, hrănește discuția tehnică reală și transformă orice conflict în conținut de calitate.

## 5.4 Panoul de compoziție pe roluri

Afișează transparent cine a aprobat și cine a dezaprobat, defalcat pe categorii și (la aprobări) pe sub-roluri. Exemplul ilustrativ care explică de ce contează:

```
Detaliul A:  345 aprobări beneficiari  +   3 aprobări proiectanți
Detaliul B:   37 aprobări proiectanți  +   2 aprobări beneficiari
→ Pentru un specialist, B are mai multă credibilitate tehnică,
  deși are mult mai puține aprobări totale.
```

## 5.5 Ce NU facem la MVP în privința ratingului

```
× Formulă algoritmică de pondere (aprobarea unui cont „cu reputație" NU
  cântărește automat mai mult decât a unui cont nou) → punct deschis, post-MVP
× Scor numeric unic de reputație per utilizator → post-MVP
La MVP: afișăm CIFRELE BRUTE pe roluri și lăsăm cititorul să interpreteze.
Simplu, transparent, suficient pentru a testa premisa.
```

---

# CAPITOLUL 6 — COMENTARII

## 6.1 Principiul: rol vizibil, simplu la început

Comentariile au întotdeauna rolul granular vizibil lângă nume. Aceasta e informația care dă sens discuției.

## 6.2 Decizie pentru MVP: listă simplă, nu taburi (încă)

```
LA MVP: o singură listă de comentarii, cu rolul vizibil lângă fiecare nume.
  + simplu, rapid de construit
  + cu 50–100 de oameni, volumul de comentarii nu cere încă filtrare

ÎN VAL 2 (fast-follow): cele 4 taburi pe rol (Proiectanți / Executanți /
  Furnizori / Beneficiari) + eventual filtrare prin bifă.
  → se adaugă când volumul de comentarii o cere.
```

Taburile sunt UX de organizare, nu esența mecanismului. Le amânăm fără a pierde nimic din test.

## 6.3 Reguli comentarii (MVP)

```
├── Orice utilizator logat poate comenta (cu rolul vizibil).
├── Justificările de dezaprobare apar automat aici, marcate distinct.
├── Comentariile se afișează cronologic (cel mai nou jos sau sus — de testat).
└── Vot pe comentarii (util / nu e util) → OPȚIONAL la MVP, poate fi amânat.
```

---

# CAPITOLUL 7 — DESCOPERIRE — CĂUTARE ȘI LISTĂ

## 7.1 Principiul: căutare țintită, nu feed nesfârșit

Detalia nu este infinite scrolling. La MVP, descoperirea e minimă dar funcțională.

## 7.2 Componente (MVP)

```
CĂUTARE LIBERĂ
  → câmp de text care caută în titlu + categorie + tag-uri
  → nu e nevoie de Elasticsearch la MVP; căutare simplă în baza de date e suficientă

LISTARE / RĂSFOIRE
  → pagină cu detaliile dintr-o categorie aleasă
  → SORTARE: după numărul de aprobări (cele mai validate, primele)
  → simplu, o singură regulă de sortare

PAGINĂ „TOP DETALII"
  → o listă cu cele mai apreciate ~10 detalii din toată comunitatea
  → echivalentul minim al „feed-ului", fără algoritm complex
```

## 7.3 Ce NU intră la MVP

```
× Căutare structurată cu filtre combinate avansate → val 2
  (la MVP, eventual 1–2 filtre simple: categorie + sistem constructiv)
× Căutare vizuală (după poză)        → fază ulterioară
× Căutare prin normativ              → fază ulterioară
× Feed personalizat pe comportament  → post-MVP
```

---

# CAPITOLUL 8 — PORTOFOLIUL MINIM

## 8.1 Principiul: valoare „single-player" pentru cold start

Portofoliul dă utilizatorului un motiv să rămână chiar și când comunitatea e mică — își organizează propriile lucruri. Este crucial pentru perioada de cold start, când rețeaua încă nu s-a aprins.

## 8.2 Structura (MVP)

```
DETALIILE MELE
├── Create de mine   → detaliile pe care le-am publicat
└── Apreciate        → detaliile pe care le-am aprobat / salvat
                       (biblioteca mea de referință)
```

## 8.3 Ce NU intră la MVP

```
× Funcția „Proiecte" (containere de organizare) → val 2
  → utilă, dar nu testează premisa; un beneficiar poate trăi la MVP
    doar cu lista „Apreciate"
× Statistici / analytics de profil → post-MVP
× Badge-uri (în afară de „Verificat" manual) → post-MVP
```

## 8.4 Profilul public minim

```
PROFIL PUBLIC (MVP)
├── Nume + Rol granular (+ badge „Verificat" dacă e cazul)
├── Detalii publicate (listă)
└── (opțional) bio scurtă
```

---

# CAPITOLUL 9 — CE NU INTRĂ ÎN MVP — LISTA DE TĂIERI

> La fel de important ca ce includem. Această listă ne ține disciplinați și ne apără de „doar adăugăm și asta...".

```
TĂIAT DIN MVP — și de ce

SISTEMUL DE VERSIUNI + SCHIȚAREA CU ACCEPT/RESPINGE
  → cea mai mare complexitate tehnică; nu testează dacă oamenii VIN și VALIDEAZĂ.
  → NOTĂ: desenul/adnotarea SIMPLĂ poate intra (cap. 3.4); doar LOGICA DE
    VERSIUNI se amână. Schițarea completă = primul mare upgrade post-lansare.

MARKETPLACE (vânzare pachete, materiale furnizori, bursă lucrări, consultanță)
  → monetizare; vine după ce premisa de încredere e validată.

ABONAMENTE PRO / PLĂȚI
  → fără sens înainte de a avea valoare dovedită și trafic.

VIEWER 3D / IFC / VIDEO
  → 2D e suficient pentru dezbaterea pe piese tehnice (principiu fundamental).

FIȘIERE DWG/IFC PENTRU DOWNLOAD
  → mecanism de rating, nu esență; ușor de adăugat ulterior.

FORUM SEPARAT / DISCUȚII GENERALE
  → dezbaterea se testează întâi pe detaliu, nu în forum.

MESAGERIE DIRECTĂ / REȚEA (urmărire, conexiuni)
  → la 50–100 de oameni, comunicarea se face în afara platformei.

SISTEM DE NOTIFICĂRI AUTOMAT (complex)
  → înlocuit cu email simplu / mesaj manual (vezi cap. 10).

TABURI DE COMENTARII PE ROL
  → listă simplă cu rol vizibil e suficientă la volumul de MVP.

FUNCȚIA „PROIECTE"
  → organizare; nu testează premisa.

BADGE-URI, ANALYTICS, SPECIALIZĂRI VALIDATE
  → reputație avansată; post-MVP.

VERIFICARE AUTOMATĂ A ROLULUI
  → manuală la MVP (cap. 10).
```

---

# CAPITOLUL 10 — CE FACEM MANUAL, NU ÎN COD

> Principiu: la 50–100 de oameni, nu construim sisteme. Facem manual ce ar trebui automatizat — și automatizăm doar după ce dovedim că merită.

## 10.1 Onboarding manual prin invitație

```
├── Nu există înregistrare deschisă publicului la MVP.
├── Fondatorul invită personal fiecare utilizator (email / mesaj).
└── Fiecare invitat știe că e în „beta închis al fondatorilor comunității".
```

## 10.2 Verificarea rolului — manuală

```
├── Fondatorul cunoaște (sau verifică printr-o conversație) cine e cine.
├── Badge „Verificat" acordat manual din panoul de administrare.
└── La nevoie: numărul OAR / dovada profesională cerută informal.
```

## 10.3 Moderarea — fondatorul citește tot

```
├── Fondatorul e singurul moderator la MVP.
├── Citește detaliile noi și comentariile; intervine la conținut greșit/abuz.
└── Un detaliu periculos cu aprobări greșite → scos/marcat manual + discutat.
    (Sistemul de moderare propriu-zis = punct deschis, post-MVP.)
```

## 10.4 Notificările — email simplu / mesaj manual

```
ÎN LOC DE un sistem de notificări în timp real:
├── Email automat simplu pentru evenimente cheie
│   („cineva a comentat detaliul tău") — dacă e ușor de pus.
├── SAU chiar mesaj manual / grup de WhatsApp al fondatorilor la început.
└── Notificările live (WebSocket) = post-MVP, când avem volum.
```

## 10.5 Seed content — fondatorul + partenerii

```
├── Fondatorul încarcă primele detalii din practica proprie
│   (etalonul de calitate al platformei).
├── Primii parteneri (proiectanți/furnizori fondatori) adaugă detalii.
└── Țintă: ≥ 50 de detalii de calitate ÎNAINTE de a invita valul mare.
```

---

# CAPITOLUL 11 — STACK TEHNIC MINIM ȘI EFORT ESTIMAT

## 11.1 Principiul: viteză > puritate arhitecturală

Pentru un fondator-CTO solo (cu AI), prioritatea e să ajungem la ceva utilizabil rapid. Alegem unelte care reduc drastic munca de backend și infrastructură. Arhitectura „frumoasă" se rafinează după ce premisa e validată.

## 11.2 Stack recomandat pentru MVP (cel mai rapid de livrat solo)

```
APLICAȚIE
├── Web responsive (PWA) — funcționează și pe mobil, dintr-un singur cod
│   → la MVP NU facem app nativ separat; web responsive e mai rapid de livrat
├── Framework: Next.js (React) — full-stack într-un singur proiect
└── Stilizare: Tailwind CSS

BACKEND + DATE (minim de configurat)
├── Supabase SAU echivalent (Postgres gestionat + Auth + Storage într-un loc)
│   → reduce enorm munca de backend pentru un dezvoltator solo
│   → Auth gata făcut (email + Google), stocare fișiere gata făcută
└── Bază de date: PostgreSQL (prin Supabase)

DESEN (dacă mergem pe Varianta B din cap. 3.4)
└── Librărie gata: tldraw / Excalidraw / Fabric.js (NU construim de la zero)

CĂUTARE
└── Căutare simplă direct în Postgres (full-text) — fără Elasticsearch la MVP

GĂZDUIRE
└── Vercel (pentru Next.js) + Supabase — minim de DevOps
```

> Notă: stack-ul din documentul fundamental (NestJS, Meilisearch, Redis, R2, microservicii etc.) rămâne ținta de maturitate. La MVP alegem deliberat varianta cu cea mai mică suprafață de configurare, migrabilă ulterior.

## 11.3 Efort estimat orientativ (fondator-CTO + AI)

```
MODUL                                          EFORT ORIENTATIV
─────────────────────────────────────────────────────────────
Setup proiect + auth + roluri (cap. 1)         ~3–5 zile
Model de date + obiectul Detaliu (cap. 2)      ~3–5 zile
Flux upload detaliu (cap. 3, fără desen)       ~5–7 zile
   + tool de desen simplu (Varianta B)         +5–10 zile
Ecran vizualizare detaliu (cap. 4)             ~5–7 zile
Validare pe roluri + justificare (cap. 5)      ~5–7 zile  ← prioritate maximă
Comentarii listă simplă (cap. 6)               ~2–4 zile
Căutare + listare + sortare (cap. 7)           ~3–5 zile
Portofoliu + profil minim (cap. 8)             ~3–5 zile
Polissh, testare, fix-uri                       ~1–2 săptămâni
─────────────────────────────────────────────────────────────
ORDIN DE MĂRIME TOTAL: ~2–3 luni de lucru concentrat
  (variabil în funcție de timpul disponibil și de includerea desenului)
```

*Estimările sunt orientative și se calibrează pe parcurs; sunt menite să dea ordinul de mărime, nu un angajament.*

## 11.4 Ordinea de construcție recomandată

```
1. Fundația: setup + auth + roluri + model de date
2. Obiectul Detaliu + uploadul (fără desen întâi)
3. INIMA: ecranul de vizualizare + validarea pe roluri + justificarea
   → aici se vede prima dată „magia"; o construim devreme ca s-o putem testa
4. Comentarii
5. Descoperire (căutare + listă + top)
6. Portofoliu + profil
7. (Opțional, în paralel) prototip tehnic izolat al desenului/schițării
8. Polish + seed content + invitarea primului val
```

---

# CAPITOLUL 12 — DECIZII DESCHISE PENTRU MVP

Lucruri de stabilit împreună înainte sau în timpul construcției:

```
□ DESENUL la upload: Varianta A (doar upload) sau B (upload + desen simplu)?
  → recomandarea curentă: B, strict desen, fără versionare.

□ TERMINOLOGIA butoanelor: „Aprob / Dezaprob" sau altă pereche?
  → recomandare curentă: „Aprob / Dezaprob".

□ COMENTARII: confirmăm lista simplă la MVP (taburile în val 2)?

□ VOT PE COMENTARII (util/nu e util): îl includem sau îl amânăm?

□ NOTIFICĂRI: email automat simplu de la început, sau pur manual/WhatsApp?

□ OAUTH Google: îl punem de la MVP (Supabase îl oferă ușor) sau doar email+parolă?

□ TAXONOMIA: lista exactă de categorii și sub-categorii pentru lansare
  (sarcină dedicată — o taxonomie greșită afectează adopția).

□ STACK: confirmăm varianta Next.js + Supabase pentru viteză, sau preferi
  altă combinație cu care ești mai confortabil ca CTO?
```

---

*Specificația MVP Detalia v1.0 — document de lucru.*
*Se citește împreună cu Documentul Fundamental v3.0. Capitolul 0 (premisa și criteriul de succes) este filtrul prin care trece orice decizie de scope.*
