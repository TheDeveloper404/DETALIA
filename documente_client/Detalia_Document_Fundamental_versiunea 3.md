# DETALIA
## Document Fundamental de Concept și Implementare

**Versiune:** 3.0 (integrare analiză de piață, competiție și completări structurale)
**Data:** Iunie 2026
**Inițiator:** Eduard Nemes — Fondator
**Statut:** Document de lucru — baza dezvoltării produsului și business-ului
**Confidențial**

---

## CUPRINS

1. Viziune și problemă
2. Dimensiunea pieței și nevoile actorilor
3. Conceptul central — Detaliul tehnic de execuție
4. Anatomia unui detaliu
5. Roluri, conturi și verificare
6. Sistemul de validare și interacțiune
7. Sistemul de versiuni — Schițarea colaborativă
8. Portofoliu și organizarea pe proiecte
9. Fluxurile pe actori
10. Arhitectura platformei la maturitate
11. Discovery — Feed și căutare
12. Marketplace
13. Specificații tehnice
14. Strategia de lansare (inclusiv problema cold start)
15. Modelul de business
16. Echipă și fondator
17. Aspecte legale și proprietate intelectuală
18. Analiza competiției
19. Metrice de succes
20. Roadmap de dezvoltare
21. Riscuri și mitigare
22. Glosar și anexe

---

# 1. VIZIUNE ȘI PROBLEMĂ

## 1.1 Declarația de viziune

> **DETALIA este prima platformă din România care aduce în același loc proiectanții, executanții, furnizorii de materiale și beneficiarii, cu detaliul tehnic de execuție ca element central de interacțiune și ca limbaj comun.**

Orice produs, inclusiv construcțiile, are nevoie de un detaliu tehnic de execuție înainte de a intra în producție — adică de o reprezentare clară a modului în care se realizează efectiv. În jurul acestei unități atomice se construiește totul: inspirație, validare, educație, comerț și încredere.

Dacă LinkedIn validează experiența profesională prin conexiuni și recomandări, DETALIA validează **competența tehnică reală prin interacțiunea cu detalii de execuție**.

## 1.2 Cele patru fracturi ale industriei

Industria construcțiilor din România suferă de patru fracturi simultane pe care DETALIA le rezolvă:

**Fractura 1 — Cunoaștere fragmentată.** Proiectantul gândește în birou, executantul lucrează pe șantier, furnizorul vinde în paralel. Nu comunică sistematic. Rezultatul: detalii proiectate care nu pot fi executate și detalii executate greșit din lipsă de documentare.

**Fractura 2 — Validare inexistentă.** Nu există nicio platformă unde un detaliu tehnic să fie aprobat sau contestat de comunitatea de specialiști înainte de execuție. Astăzi, calitatea unui detaliu se verifică doar după ce clădirea e ridicată — adesea prea târziu.

**Fractura 3 — Reputație nedovedită.** Oricine se poate declara constructor bun sau arhitect de calitate. Nu există un sistem public, obiectiv, bazat pe competență demonstrată.

**Fractura 4 — Beneficiarul izolat.** Beneficiarul de azi este documentat și pretențios, dar nu are un loc de încredere unde să se informeze, să înțeleagă ce se execută pe banii lui și să găsească profesioniști verificați.

## 1.3 Soluția

O platformă structurată în jurul detaliului tehnic de execuție, unde:

- Oricine poate **contribui** cu cunoaștere (detaliu, schiță, comentariu).
- Comunitatea **validează** acea cunoaștere, fiecare rol cu greutatea lui.
- Reputația se **construiește** prin contribuție tehnică reală, nu prin autodeclarare.
- Tranzacțiile comerciale se nasc **organic** din contextul tehnic.

## 1.4 Originea — de ce funcționează povestea

Fondatorul este simultan **arhitect** (la bază), **executant** (ani de experiență pe șantier), **furnizor de materiale** (franciza Depozitul Virtual) și **beneficiar** (urmează să își construiască propria casă). Înțelege frustrarea fiecăruia dintre cele patru roluri din interior.

Aceasta nu este doar o garanție de relevanță a produsului, ci și cel mai puternic instrument de marketing al platformei: o poveste autentică, imposibil de inventat sau cumpărat. (Detaliere în capitolul 16.)

## 1.5 Poziționarea „România-first" — haosul ca piață

> **DETALIA nu este o copie românească a unui produs occidental. Este un produs care nu putea fi gândit decât în România — pentru că rezolvă un haos pe care Vestul nu îl are. Acolo unde proiectarea este strictă, suntem opționali. Acolo unde se „descurcă pe șantier", suntem indispensabili.**

Logica este contraintuitivă, dar corectă: cu cât industria este mai prost reglementată, cu atât e mai mare nevoia de o platformă care să suplinească lipsa. În Germania, detaliul de execuție vine deja standardizat, verificat și conform normelor; golul pe care l-ar umple DETALIA este mic — deci platforma ar fi „nice to have". În România, golul este o prăpastie: proiectantul predă adesea doar documentația de autorizare, fără detalii de execuție, iar clientul și constructorul se descurcă pe șantier. Aici platforma nu este „nice to have", ci **infrastructură lipsă**.

Avantajul de localizare profundă acționează pe trei niveluri:

- **Cunoașterea realității de teren.** La noi, „constructorul" este adesea o echipă fără proiectant în spate; beneficiarul devine propriul diriginte de șantier; deciziile se iau ad-hoc cu materialul de la depozit. Un produs gândit pentru fluxul de lucru occidental nu se potrivește pe această realitate.
- **Limbajul normativ și cultural corect.** Zonele seismice ale României, NP-urile și C-urile locale, obiceiurile de execuție — toate sunt context pe care doar cineva din interior îl poate codifica într-un produs.
- **Invizibilitatea pe radarul global.** Jucătorii internaționali nu se vor uita serios la o piață mică, fragmentată și „haotică". Prea mic și prea complicat pentru ei — ceea ce oferă ani de avans neîngrijorat pentru construirea comunității.

**Două nuanțe de echilibru, ca avantajul să nu devină capcană:**

1. Haosul ajută la **cerere**, dar îngreunează **calitatea conținutului** la început. Dacă mulți proiectanți nu fac detalii de execuție, platforma pornește cu mulți „consumatori flămânzi" și relativ puțini „creatori de detalii de calitate". De aceea seed content-ul fondatorului și al primilor parteneri este critic: el stabilește etalonul de calitate. Mecanismele de dezaprobare justificată și rol vizibil sunt antidotul, dar trebuie cultivate activ.
2. „România-first" nu înseamnă „doar România pentru totdeauna". Ținta de expansiune nu este Germania, ci **„celelalte Românii ale lumii"** — piețe cu aceeași durere: Republica Moldova, Bulgaria, restul Balcanilor, diaspora, eventual piețe non-europene în curs de dezvoltare. Aceasta lărgește povestea pentru un investitor fără a dilua focusul de lansare.

---

# 2. DIMENSIUNEA PIEȚEI ȘI NEVOILE ACTORILOR

Acest capitol separă onest trei tipuri de informație: **date dure** (statistică oficială), **estimări triangulate** și **necunoscute de măsurat** prin sondaje proprii (postări LinkedIn în Faza 0).

## 2.1 Datele dure

```
CONSTRUCȚII REZIDENȚIALE (sursa: INS, 2025)
├── Autorizații de construire rezidențiale 2025:  37.252 (+4,4% vs 2024)
├── Locuințe estimate a fi construite:            ~80.000
└── Pondere autorizații în mediul rural:          ~70%
    → exact zona auto-construcției și a „ne descurcăm pe șantier"

FORȚA DE MUNCĂ ÎN EXECUȚIE
├── Angajați în construcții (iul. 2025):          ~462.000 (maxim istoric)
└── Muncitori non-UE doar în construcții:         ~28.000+
    → vin fără cunoașterea practicii locale; nevoie acută de documentație clară

PROIECTANȚI
├── Membri OAR București (singura filială):       4.592
└── Total național arhitecți (estimare):          ~9.000–10.000
    → de confirmat direct de la OAR
```

## 2.2 Durerea centrală — practica „doar DTAC"

Miezul tezei platformei este bine documentat calitativ de profesioniștii din domeniu, dar **nu există statistică oficială**. Practica dominantă: beneficiarul depune la primărie DTAC-ul (obligatoriu pentru autorizație) și rămâne adesea doar cu atât, pentru că este mai ieftin. Un proiect ieftin nu conține detalii de execuție, liste de cantități sau caiete de sarcini — iar constructorii sunt nevoiți să ia decizii pe cont propriu.

Mecanismul economic care justifică întreaga platformă: o problemă identificată în faza de proiectare se rezolvă modificând un desen; aceeași problemă identificată pe șantier costă mii de euro la remediere.

```
ORDINUL DE MĂRIME AL PREȚURILOR (estimări de piață, lei/mp util)
├── Proiect doar DTAC (autorizare):        de la ~38 lei/mp
├── Proiect Tehnic (PTh):                  ~63–140 lei/mp
└── Proiect complet (cu detalii execuție): ~50–190 lei/mp
```

Diferența de preț explică totul: beneficiarul alege ieftinul, iar golul de detalii cade pe șantier — adică pe terenul DETALIA.

## 2.3 Profilul fiecărui actor și nevoia urgentă

**Beneficiarul / auto-constructorul** — segmentul cel mai numeros și cel mai dureros. Cele ~80.000 de locuințe/an, majoritar rurale, sunt în mare parte case individuale ridicate de oameni care cumpără un proiect ieftin și se trezesc fără instrucțiuni de execuție. *Nevoia urgentă:* să înțeleagă ce se face pe banii lui și să aibă pe cine crede.

**Executantul** — ~462.000 de oameni, plus zeci de mii de muncitori străini fără cunoașterea practicii locale. Mulți primesc doar un DTAC și „se descurcă". *Nevoia urgentă:* soluția corectă pentru faza pe care nu o știe, validată de alți executanți, accesibilă pe telefon, pe șantier, acum.

**Proiectantul** — ~9.000–10.000 de profesioniști, într-o piață unde mulți vând proiecte ieftine doar-DTAC din presiune de preț. *Nevoia urgentă (pentru cei buni):* diferențierea — să demonstreze că dau detalii de calitate și să fie aleși și plătiți pentru asta. Pentru ceilalți, platforma este și presiune sănătoasă, și resursă de învățare.

**Furnizorul** — vrea să fie lângă decizia de cumpărare, care se ia la detaliu. *Nevoia urgentă:* leads calificate, într-o piață unde marketingul actual ajunge la lume rece.

## 2.4 Necunoscutele de măsurat (sondaje LinkedIn în Faza 0)

Două cifre care ar întări enorm pitch-ul **nu există ca statistică** și trebuie produse prin sondaje proprii. Acestea fac dublu serviciu: produc date citabile unice și, simultan, construiesc audiența și validează problema înainte de lansare.

```
SONDAJ 1 — ponderea proiectelor care rămân la DTAC
  Către proiectanți: „Din proiectele tale din ultimul an, la câte
   s-au cerut și detalii de execuție, nu doar DTAC?"
  Către beneficiari: „Când ți-ai construit casa, ai primit detalii
   de execuție de la arhitect? Da / Nu / Nu știu ce sunt acelea."

SONDAJ 2 — ponderea auto-constructorilor
  Către beneficiari: „Cine ți-a coordonat șantierul? Constructor cu
   contract / Diriginte / M-am descurcat singur."
  Către executanți: „Pe ultimul șantier, ai avut un proiect tehnic
   complet sau doar autorizația?"
```

---

# 3. CONCEPTUL CENTRAL — DETALIUL TEHNIC DE EXECUȚIE

## 3.1 Detaliul ca unitate atomică

Detaliul tehnic de execuție este alegerea fundamentală a platformei. Spre deosebire de „sfaturi de construcție" vagi, detaliul este:

- **Concret** — arată cum se face efectiv un lucru.
- **Acționabil** — poate fi aplicat direct pe șantier.
- **Verificabil** — poate fi aprobat sau contestat tehnic.
- **Viu** — evoluează prin schițe, discuții și versiuni.

Toate funcțiile platformei gravitează în jurul detaliului. Nu există funcționalitate care să nu fie conectată la el.

## 3.2 Limbajul comun: desenul 2D

Principiul fundamental al platformei: **specialiștii vorbesc cel mai bine pe piese tehnice — desene și schițe — nu pe poze.** Orice specialist trebuie să fie capabil să își exprime gândurile printr-un desen. Nu toți lucrează în CAD, dar toți trebuie să știe să facă o schiță cu pixul pe o foaie.

De aceea, **modul principal de vizualizare al oricărui detaliu este un desen 2D** (CAD sau schiță de mână). Acesta este și suportul pe care se desfășoară dezbaterea, schițarea colaborativă și versionarea (vezi capitolul 7).

## 3.3 Toți privesc același detaliu

Momentul magic al platformei: la același detaliu, fiecare actor are ceva de spus și fiecare poate să aprobe sau să conteste, fiecare din perspectiva rolului său.

```
Arhitect publică: "Racordare perete BCA la fundație cu hidroizolație"

  Inginer structurist (comentariu, secțiunea Proiectanți):
  "Atenție la continuitatea hidroizolației în colț."
  → Dezaprobă, cu justificare obligatorie

  Constructor general (comentariu, secțiunea Executanți):
  "Am executat similar — problema reală e accesul cu mistria."
  → Schițează direct peste detaliu o variantă de racord

  Furnizor (secțiunea Furnizori):
  "Membrana X rezolvă exact zona menționată."

  Beneficiar (secțiunea Beneficiari):
  "Dacă fundația e deja turnată, mai pot face ceva?"

  Arhitectul integrează schița relevantă → versiune nouă
  → după agreare, setează versiunea finală
```

Rezultat: un detaliu îmbunătățit colectiv, cu trasabilitate completă a deciziilor.

---

# 4. ANATOMIA UNUI DETALIU

## 4.1 Header-ul — datele care însoțesc detaliul

> **Principiu critic: un detaliu nu se citește niciodată izolat de datele care îl însoțesc.**

Exemplu: un detaliu de stratificație de perete cu doar 10 cm de polistiren nu se dezaprobă pe motiv de eficiență energetică fără a verifica întâi zona climatică. Două detalii identice ca desen, dar cu zone climatice sau seismice diferite, pot fi unul corect și celălalt greșit.

```
HEADER DETALIU
├── Titlu
├── Autor + Rol granular (vizibil permanent)
├── Zonă climatică  (I / II / III / IV / General)
├── Zonă seismică   (specificată / General)
├── Rezistență la foc
├── Sistem constructiv
├── Fază de execuție
├── Listă materiale
├── Data publicării + versiunea curentă
└── Tag-uri
```

**Opțiunea „General".** Pentru zone climatice/seismice există opțiunea „General", dar credibilitatea se construiește pe măsură. Detaliile care țin cont de toți parametrii oferă o credibilitate net superioară celor care au bifat „General" peste tot. Acesta este un mecanism natural de calitate — nu o restricție, ci o ierarhie de încredere.

## 4.2 Corpul vizual — curat și clar

Corpul vizual al detaliului are o arhitectură pe două straturi și trebuie să rămână **curat**:

**Stratul 1 — Vizualizarea de bază (obligatorie de facto):**
Un desen 2D — CAD sau schiță de mână. Acesta este:
- Suportul pe care se face dezbaterea.
- Suportul pe care se desenează schițele colaborative.
- Baza versiunilor.

Cu cât desenul este mai îngrijit și mai clar, cu atât detaliul are șanse mai mari să urce în interacțiuni.

**Stratul 2 — Galeria de surse explicative:**
Surse suplimentare atașate pentru o înțelegere mai bună — la început foto, ulterior video și 3D. Acestea ajută la înțelegere, dar nu sunt suportul dezbaterii.

## 4.3 Politica privind schița de bază (decizie de design)

**Decizia adoptată: fără restricție tehnică, cu selecție naturală.** Un detaliu poate fi încărcat și fără desen 2D, dar:
- Platforma semnalează (vizibil, dar neintruziv) că detaliile cu desen 2D ca vizualizare de bază performează mai bine în dezvoltare și dezbatere.
- Detaliile fără desen 2D vor fi selectate natural în jos (nu vor fi la fel de populare), pentru că specialiștii preferă să discute pe piese tehnice.

Practica va arăta dacă această abordare e suficientă sau dacă e nevoie de o restricție mai fermă. Rămâne un punct de monitorizat după lansare.

## 4.4 Fișierele digitale (DWG, IFC) — tratate separat

Fișierele digitale **nu se încarcă automat** împreună cu celelalte surse vizuale, pentru a păstra corpul vizual curat.

```
FIȘIERE DIGITALE
├── Buton dedicat de Download
├── Disponibile doar acolo unde autorul decide să le încarce
└── Funcție de promovare a detaliului
```

Oferirea variantei digitale (DWG/IFC) este un **mecanism de creștere a ratingului**: când utilizatorul vede că primește și varianta digitală, este mai tentat să aprecieze detaliul. Practic, generozitatea tehnică se traduce în reputație. Linkurile către surse externe se pot adăuga în comentarii.

## 4.5 Fluxul de upload al unui detaliu

```
PASUL 1 — Date header
  → Nume, zonă climatică, zonă seismică, rezistență la foc,
    sistem constructiv, fază, listă materiale, tag-uri

PASUL 2 — Vizualizarea de bază (alegi una)
  → [ Încarcă document ]  (PDF, JPEG)
  → [ Desenează un detaliu ]  (fereastră cu tooluri de desen)

PASUL 3 — Surse suplimentare (opțional)
  → [ Încarcă document ]  (JPEG, PDF)
  → [ Fă o poză ]

PASUL 4 — Explicații
  → Secțiune de text liber

PASUL 5 — Fișiere digitale (opțional)
  → Încarcă DWG / IFC pentru download (crește ratingul)

PASUL 6 — Vizibilitate și notificări
  → Public  /  Vizibil doar pentru mine  /  Pro
  → Setări notificări

PASUL 7 — Publicare
```

Opțiunea „Vizibil doar pentru mine" permite autorului să își organizeze publicarea exact cum vrea, înainte de a expune detaliul comunității.

---

# 5. ROLURI, CONTURI ȘI VERIFICARE

> **Granularitatea rolului ESTE informația.** Un „Proiectant" și un „Executant" ca roluri unice ar distruge exact valoarea pe care platforma vrea să o creeze: la o dezbatere între un arhitect și un structurist, cititorul nu ar mai ști cine ridică obiecția structurală și cine pe cea de concept.

## 5.1 Structura de roluri pe două niveluri (categorie + sub-rol)

```
PROIECTANȚI
├── Arhitect
├── Inginer structurist (rezistență)
├── Inginer instalații (HVAC, termice, sanitare)
├── Inginer electrician (instalații electrice)
└── (extensibil: geotehnician, inginer drumuri, peisagist etc.)

EXECUTANȚI
├── Constructor general
├── Electrician
├── Instalator (sanitare / termice)
├── Dulgher / structuri lemn
├── Zidar
├── Fierar-betonist
├── Acoperișuri / învelitori
└── Finisaje (faianțar, zugrav, rigipsar etc.)

FURNIZORI
└── Furnizor de materiale (sub-rol opțional pe tip de material)

BENEFICIARI
├── Beneficiar (își construiește cu echipă)
└── Auto-constructor (își ridică singur casa)
```

Structura este **extensibilă** — sub-rolurile se pot completa pe parcurs, fără a schimba arhitectura.

## 5.2 Afișarea sub-rolului în interfață (decizie de design)

**Decizia adoptată:** se păstrează **cele patru taburi de comentarii pe categorie** (Proiectanți / Executanți / Furnizori / Beneficiari), iar **sub-rolul apare ca etichetă vizibilă lângă fiecare nume** în interiorul tabului.

```
Tab: PROIECTANȚI
├── [Arh.] Ionescu M.        — comentariu...
├── [Ing. structurist] Popescu — comentariu (cu justificare dezaprobare)
└── [Ing. instalații] Vasile  — comentariu...
```

Astfel se păstrează simplitatea celor 4 taburi, dar nu se pierde informația de sub-rol. **Filtrarea fină** (ex. „arată-mi doar structuriștii") se adaugă ca îmbunătățire ulterioară, dacă volumul de comentarii o cere.

## 5.3 Verificarea rolului — declarat vs. verificat

La înregistrare, utilizatorul declară un rol. Întreg sistemul de greutate pe roluri se prăbușește dacă oricine se poate declara orice — deci verificarea este esențială. Soluția: două niveluri, cu badge vizibil.

```
NIVEL 1 — Rol DECLARAT (la înregistrare, acces imediat)
NIVEL 2 — Rol VERIFICAT (badge „Verificat" lângă rol)
```

Verificarea înseamnă lucruri diferite pe roluri — și este corect să fie așa:

```
├── Arhitect       → nr. din Tabloul Național al Arhitecților (OAR)
├── Ingineri       → drept de semnătură / registrul profesional aferent
├── Furnizor       → date firmă (CUI / înregistrare comercială)
└── Executant      → NU are registru național
                     → se verifică prin lucrări finalizate cu review
                       pe platformă (reputație demonstrată în timp)
```

Badge-ul „Verificat" lângă rol schimbă fundamental greutatea percepută a unei aprobări. (Mecanismul exact de calcul al reputației — punct deschis, vezi Anexa B.)

---

# 6. SISTEMUL DE VALIDARE ȘI INTERACȚIUNE

## 6.1 Validare simplă, pe roluri — fără granularitate artificială a aprobării

> **Decizie de design: nu introducem tipuri separate de aprobare (corectitudine conceptuală, rezistență, normative). Validarea este simplă — aprobare sau dezaprobare — iar rolul (granular) al celui care o acordă este mereu vizibil.**

Remarcile specifice (corectitudine conceptuală, rezistență structurală, conformitate cu normative) se exprimă **în comentarii**, nu printr-un sistem complicat de dimensiuni multiple. Lângă numele fiecărei persoane apare permanent rolul granular. Simplitatea este o trăsătură, nu o limitare.

**Terminologie de stabilit:** perechea recomandată preliminar este **„Aprob / Dezaprob"** (clară, fără ambiguitate); decizia rămâne deschisă pentru testare cu utilizatorii (alternative: „Confirm / Contest", „Validez / Obiectez").

## 6.2 Greutatea diferită a aprobărilor

Butonul de interacțiune este **identic pentru toți actorii**. Diferența o face **cititorul**, care cântărește singur greutatea fiecărei aprobări în funcție de rolul celui care a dat-o.

```
Detaliul A:  345 aprobări beneficiari  +   3 aprobări proiectanți
Detaliul B:   37 aprobări proiectanți  +   2 aprobări beneficiari

→ Pentru un specialist, Detaliul B are mai multă credibilitate tehnică,
  deși are mult mai puține aprobări totale.
```

Platforma afișează transparent compoziția pe roluri; interpretarea aparține utilizatorului.

```
✅ APROBĂRI
   Proiectanți:   37   (din care: 20 arhitecți, 12 structuriști, 5 instalații)
   Executanți:    24
   Furnizori:      4
   Beneficiari:    2

❌ DEZAPROBĂRI (cu justificări vizibile)
   Proiectanți:    2  → vezi justificările în comentarii
   Executanți:     1
```

## 6.3 Justificarea obligatorie la dezaprobare — punctul crucial

> **Unul dintre cele mai importante mecanisme ale platformei.**

- **Aprobarea NU cere justificare.** A aproba înseamnă acord cu tot ce conține detaliul. Un singur click.
- **Dezaprobarea CERE justificare obligatorie.** La apăsarea „Dezaprob" apare o fereastră care cere motivul. Aici se invocă normativele, argumentele structurale sau cele tehnice.

Astfel, secțiunea de normative și argumente tehnice este **atinsă natural prin justificările de dezaprobare**, fără a complica uploadul.

**Mecanism cheie:** fiecare justificare de dezaprobare se adaugă **automat în comentarii**, cu numele și rolul granular al persoanei. Nu există dezaprobare „mută". Acest lucru obligă la responsabilitate, hrănește discuția tehnică și permite comunității să voteze utilitatea justificării.

## 6.4 Comentarii organizate pe taburi de rol

```
┌─────────────┬─────────────┬─────────────┬─────────────┐
│ PROIECTANȚI │ EXECUTANȚI  │  FURNIZORI  │ BENEFICIARI │
└─────────────┴─────────────┴─────────────┴─────────────┘
       ▲
   tab activ → văd doar ce spun proiectanții
   (cu sub-rolul ca etichetă lângă fiecare nume)
```

Caseta de comentarii are patru taburi, fiecare cu iconiță specifică. **Alternativă de adăugat ulterior:** filtrare fină prin bifă (inclusiv pe sub-rol).

---

# 7. SISTEMUL DE VERSIUNI — SCHIȚAREA COLABORATIVĂ

> **Funcționalitatea distinctivă a platformei. Nimeni din piață nu o are.**

## 7.1 Conceptul: toți la aceeași masă, pe aceeași foaie

Toți actorii sunt la o masă, cu un singur detaliu de execuție în față, și fiecare poate desena câte ceva peste el. DETALIA digitalizează această experiență. Peste vizualizarea de bază, oricine poate **schița** — linii, săgeți, corecturi, propuneri. Schițele rămân în **istoricul detaliului** ca versiuni schițate de alții.

## 7.2 Două tipuri de discuție

1. **Discuție text** — comentariile clasice, pe taburi de rol.
2. **Discuție prin desen** — schițe peste detaliu, fiecare cu autor și rol vizibil.

## 7.3 Structura versiunilor unui detaliu

```
DETALIU "Racordare perete BCA la fundație" — Autor: Arhitect X

[ Vezi istoric ]
│
├── VERSIUNI SCHIȚATE DE ALȚII
│   ├── Schiță de Constructor general A — propunere racord colț
│   ├── Schiță de Inginer structurist B — corectură hidroizolație
│   └── Schiță de Constructor general C — variantă acces mistrie
│
└── VERSIUNI ACTUALIZATE (de autor)
    ├── v2 — autorul a integrat schița lui A
    ├── v3 — autorul a integrat corectura lui B
    └── v4 ★ VERSIUNE FINALĂ (setată de autor)
```

Fiecare versiune are **propriul set de interacțiuni**. O singură versiune actualizată poate fi setată drept **Versiune finală**.

## 7.4 Fluxul „cineva schițează peste detaliul meu"

```
Constructor X desenează o schiță peste detaliul D al lui Arhitect X
        ▼
Arhitect X primește notificare:
"Constructor X vrea să adauge o schiță pe detaliul D. [ Vezi schița ]"
        ▼
Arhitect X alege:
  ├── [ Respinge schița ]  → Constructor X: "Schița a fost respinsă"
  └── [ Acceptă și adaugă versiune nouă ]
        → schița apare la versiuni, cu propriul proces de interacțiuni
```

Autorul păstrează controlul; comunitatea contribuie activ.

## 7.5 Versiunea finală și automatizarea aprobărilor

**Problema:** când autorul revine cu versiunea actualizată (cea pe care vrea să o promoveze), aceasta pornește fără nicio interacțiune, deși a rezultat dintr-un proces lung.

**Soluția:** la setarea unei versiuni drept „Versiune finală", toți actorii care au interacționat în proces (comentat, schițat, aprobat versiuni anterioare) primesc notificarea:

```
"Arhitect X a revenit cu versiunea actualizată a detaliului D.
 [ Aprobă versiunea finală ]"
```

Astfel versiunea finală se populează rapid cu aprobări de la oameni deja implicați în construirea ei.

## 7.6 De la rating la oportunități comerciale

```
Detaliu în TOP aprobări (proiectanți + executanți)
   ├──→ Furnizorii îl iau în vizor → contactează autorul pentru colaborări
   └──→ Beneficiarii contactează autorii cu rating mare
```

---

# 8. PORTOFOLIU ȘI ORGANIZAREA PE PROIECTE

## 8.1 Portofoliul „Detaliile mele"

```
DETALIILE MELE
├── 1. Create de mine   → detaliile publicate (versiuni, rating, interacțiuni)
└── 2. Apreciate        → detaliile aprobate / salvate (biblioteca de referință)
```

## 8.2 Organizarea pe proiecte

Funcția **„Creează un proiect nou"** permite împărțirea detaliilor pe proiecte. Beneficiarul își organizează detaliile pe casa lui; arhitectul pe proiectele de lucru; executantul pe șantierele active. Fiecare proiect este un container logic.

---

# 9. FLUXURILE PE ACTORI

## 9.1 Beneficiarul / Auto-constructorul

**Profil:** documentat dar nesigur — problema lui nu e lipsa de informație, ci lipsa de încredere în informație.

```
Caută un detaliu → vede compoziția aprobărilor pe roluri
  → citește comentariile pe taburi (mai ales Executanți și Beneficiari)
  → înțelege ce se execută pe banii lui
  → cont (Beneficiar), salvează în "Apreciate", pune în proiect ("Casa mea")
  → găsește constructor cu rating mare → găsește furnizorul recomandat
  → contactează direct
```

## 9.2 Executantul / Constructorul

**Profil:** practic, pe teren, vrea soluții rapide. Inclusiv „constructorul pentru el însuși".

```
Problemă concretă pe șantier → caută rapid pe mobil (sistem / fază / material)
  → găsește detaliu aprobat de alți executanți → citește tabul Executanți
  → aplică soluția → revine: aprobă / comentează / SCHIȚEAZĂ o îmbunătățire
  → își construiește reputația
```

## 9.3 Arhitectul / Proiectantul

```
Creează un detaliu → primește aprobări/dezaprobări pe roluri
  → primește schițe de la executanți și ingineri
  → acceptă schițele relevante → versiuni noi → versiune finală (aprobări auto)
  → detaliul urcă în top → furnizorii și beneficiarii îl contactează
  → (opțional) împachetează detalii și le vinde în Marketplace
```

## 9.4 Furnizorul de materiale

```
Profil + catalog → pune materiale gratuite de calitate în Marketplace
  → urmărește detaliile în top → contactează autorii pentru colaborări
  → primește feedback (like/dislike) → motivat să mențină calitatea
```

## 9.5 Sinteza interacțiunii multi-actor

Toți privesc același detaliu; fiecare contribuie din perspectiva rolului său; detaliul se perfecționează colectiv; reputația se construiește transparent; comerțul apare organic. Acesta este nucleul de valoare al DETALIA.

---

# 10. ARHITECTURA PLATFORMEI LA MATURITATE

```
DETALIA
├── DISCOVERY: Feed (top ~10, fără infinite scroll) + Căutare țintită pe rating
├── DETALIUL: header date · corp vizual 2D + galerie · fișiere digitale separate
│             validare pe roluri granulare · justificare dezaprobare → comentariu
│             comentarii pe taburi · sistem de versiuni (schițe + actualizate)
├── PORTOFOLIU: Detaliile mele (Create / Apreciate) + Proiecte
├── COMUNITATEA: forum/discuții · notificări · rețea profesională
├── MARKETPLACE: materiale gratuite furnizori · pachete proiectanți (preview)
│               promovare executanți & proiectanți generali · like/dislike
└── PROFILUL: public (statistici, rol, rating, portofoliu) + dashboard privat
```

Platforma poate fi lansată cu un subset (MVP) și extinsă în valuri.

---

# 11. DISCOVERY — FEED ȘI CĂUTARE

## 11.1 Caracter de comunitate, nu de social media

> **DETALIA NU este o platformă de infinite scrolling.**

Feed-ul este finit. Apar, de exemplu, **cele mai populare ~10 detalii din toată comunitatea**. În rest, platforma se bazează pe **căutare țintită** — utilizatorul vine cu o nevoie concretă, caută, găsește, aplică. Aceasta respectă timpul profesionistului.

## 11.2 Căutarea țintită

**Tipuri (deocamdată două):** Liberă (text liber) și Structurată (filtre). Căutarea vizuală și prin normativ rămân pentru o fază ulterioară.

**Sortare:** rezultatele vin **în funcție de rating** — cele cu rating mai mare primele.

```
FILTRE STRUCTURATE
Sistem constructiv · Fază de execuție · Tip element · Tip clădire
Zonă climatică · Material dominant · Format vizualizare (2D/3D/video/DWG-IFC)
```

**Notă:** filtrarea pe regiune geografică NU se introduce deocamdată.

## 11.3 Taxonomia de categorii

```
├── FUNDAȚII & INFRASTRUCTURĂ      ├── TÂMPLĂRIE & GOLURI
├── STRUCTURĂ                       ├── COMPARTIMENTĂRI INTERIOARE
├── ÎNCHIDERI & FAȚADE             ├── INSTALAȚII
├── ACOPERIȘ                        ├── FINISAJE
                                    └── SISTEME SPECIALE
```

Definirea exhaustivă a sub-categoriilor este o sarcină dedicată înainte de lansare — o taxonomie greșită afectează direct adoptarea.

---

# 12. MARKETPLACE

## 12.1 Caracter

> **Marketplace-ul NU este zona de dezbatere și schițe. Este un magazin cu produse finale, de calitate.** Intră doar actorii specialiști cu abonament.

## 12.2 Furnizorii — materiale gratuite în lumină bună

```
MATERIALE FURNIZORI (gratuite)
├── Detalii tehnice oficiale ale produselor   ├── Paletare de culoare
├── Cataloage                                  └── Fișe tehnice
```

Materialele sunt gratuite peste tot, dar aici sunt prezentate **într-o lumină bună**, descărcabile în cantități mari, cu date organizate și actualizate.

## 12.3 Like/dislike și controlul calității

Și în Marketplace se dau like/dislike. Scenariul de control comunitar: cineva preia un material de la un furnizor și îl aduce în feed/forum spre discuție („Ce e cu folia aceea sub șapa uscată?"). Mecanismul **ambiționează furnizorul** să pună doar materiale de calitate.

## 12.4 Proiectanții — pachete cu cost

```
PACHET PROIECTANT
├── Titlu + descriere
├── Preview: 1 detaliu gratuit (mostră de calitate)
├── Preț pachet complet
├── Activitate autor în comunitate (rating, detalii, aprobări)
└── Link către profilul autorului
```

**Condiție de credibilitate:** proiectantul trebuie să fie activ în comunitate. **Preview obligatoriu:** dacă utilizatorului îi place mostra, cumpără tot pachetul.

## 12.5 Executanții și proiectanții generali — promovare pe competență

Constructorii cu abonament se pot promova, dar beneficiarul vede **și activitatea lor reală în platformă** — decizie informată, nu simplă declarație. Același mecanism pentru proiectanții generali (proiecte complete).

## 12.6 Diferența față de necesit.ro și similare

Platformele existente pleacă de la ce **zice** omul. DETALIA pleacă de la ce **demonstrează** prin activitate tehnică reală. Reputația nu se cumpără și nu se declară — se construiește.

---

# 13. SPECIFICAȚII TEHNICE

## 13.1 Stack tehnologic recomandat

```
FRONTEND
├── Web: React                ├── Mobil: React Native
├── Design system: Tailwind   ├── Viewer 2D: PDF.js + canvas custom
├── Tool de schițare: canvas custom (HTML5 Canvas / Fabric.js) — CRITIC
├── Viewer 3D: Three.js / Speckle (IFC)
└── Video: player custom / Cloudflare Stream

BACKEND
├── Runtime: Node.js cu NestJS
├── API: REST + WebSocket (notificări live)
└── Autentificare: JWT + OAuth (Google, Apple)

DATE
├── Principal: PostgreSQL     ├── Căutare: Meilisearch / Elasticsearch
├── Cache: Redis              └── Fișiere: Cloudflare R2 / AWS S3

INFRASTRUCTURĂ
├── Cloud: AWS / Google Cloud ├── CDN: Cloudflare
├── CI/CD: GitHub Actions     └── Monitoring: Sentry + Datadog
```

## 13.2 Componenta tehnică critică — tool-ul de schițare

Funcția de schițare colaborativă este diferențiatorul produsului și cea mai complexă componentă. Necesită: canvas suprapus peste vizualizarea de bază; salvarea schiței ca strat separat legat de versiune și autor; fluxul notificare → accept/respinge → versiune nouă; istoric complet cu autor și rol. **Recomandare: prototip dedicat înainte de a construi restul** (vezi cap. 20).

## 13.3 Strategia mobile-first — concret

Mobilul nu este o versiune redusă a web-ului; este contextul principal al executantului. Decizia de produs separă clar ce se face pe mobil de ce se face pe ecran mare:

```
PE MOBIL (prioritate — executantul pe șantier)
├── Căutare + citire detaliu + vizualizare aprobări
├── Aprobare / dezaprobare cu justificare
├── Comentarii
└── Contribuție ușoară: fă o poză, adnotare simplă peste detaliu

PE TABLETĂ / DESKTOP (creație „grea")
├── Schițare colaborativă complexă peste vizualizarea de bază
├── Upload detaliu complet (chestionar, fișiere DWG/IFC)
└── Versionare avansată, comparator
```

Schițarea complexă cu degetul, pe un ecran mic, în condiții de șantier, nu este experiența optimă — de aceea creația grea se ancorează pe ecran mare, iar mobilul rămâne pentru consum și contribuție ușoară. Aceasta este o decizie de produs explicită, nu o consecință implicită.

## 13.4 Pregătirea pentru internaționalizare (decizie de arhitectură)

Pentru că expansiunea regională este reală (cap. 1.5), anumite lucruri se gândesc multilingv **de la prima linie de cod** — este mult mai ieftin acum decât la rescriere:

```
├── Texte de interfață externalizate (i18n) — nu hardcodate
├── Taxonomie și normative parametrizabile pe țară
├── Zone climatice/seismice ca seturi de date înlocuibile pe regiune
└── Separarea conținutului de limbă de logica platformei
```

## 13.5 Arhitectură: monolith bine structurat

La start NU este nevoie de microservicii. Un **monolith bine structurat** este suficient pentru primii 2-3 ani și primii ~50.000 de utilizatori. Microserviciile se introduc doar când scara o cere.

## 13.6 Securitate și GDPR

```
├── Date personale stocate în UE   ├── Parole: hashing bcrypt
├── Fișiere private: URL-uri semnate temporar
├── Cookies: banner conform, doar esențiale fără consimțământ
├── Drepturi utilizator: export date, ștergere cont
└── Proprietate intelectuală: autorul rămâne proprietar (vezi cap. 17)
```

---

# 14. STRATEGIA DE LANSARE (INCLUSIV PROBLEMA COLD START)

> **O platformă de comunitate nu se lansează când e gata tehnic, ci când are suficientă viață în ea încât primul utilizator nou să nu se simtă singur.**

## 14.1 Problema cold start — mecanica primei mase critice

O platformă multi-actor are o problemă structurală de tip „ou și găină": arhitecții nu vin fără executanți care să-i valideze; executanții nu vin fără detalii de calitate; furnizorii nu vin fără trafic. Strategia de rezolvare are trei piloni:

**Pilonul 1 — Fondatorul rezolvă singur primul „colț" al rețelei.** Fondatorul fiind simultan arhitect, executant, furnizor (Depozitul Virtual) și viitor beneficiar, poate popula și anima toate cele patru roluri la început. Depozitul Virtual este primul furnizor model. Acesta este un avantaj de cold start pe care puține platforme îl au.

**Pilonul 2 — Seed content înainte de public.** 50–100 de detalii de calitate (fondator + primii parteneri) în categoriile cele mai căutate, astfel încât primul utilizator nou să găsească imediat valoare.

**Pilonul 3 — Valoare „single-player" înainte de efectul de rețea.** Platforma trebuie să fie utilă și pentru un singur om, înainte ca rețeaua să se activeze. Un arhitect își poate organiza propriile detalii și proiecte; un beneficiar își poate construi biblioteca „Casa mea"; un executant își poate salva soluții. Astfel utilizatorul are motiv să rămână chiar și când comunitatea e încă mică — iar contribuțiile lui hrănesc rețeaua pe măsură ce crește.

**Ordinea de atragere:** întâi creatorii de conținut (proiectanți + executanți buni, mobilizați manual de fondator) → apoi beneficiarii (atrași de conținutul de calitate și SEO) → apoi furnizorii (atrași de trafic și de detaliile în top).

## 14.2 Faza 0 — Fundația (lunile 1-3)

- **Audiență înainte de produs:** conținut educațional pe LinkedIn, Instagram/Facebook, TikTok, YouTube. Țintă: 1.000 de urmăritori. Aici se rulează și **sondajele din cap. 2.4**.
- **Landing page + listă de așteptare** segmentată pe rol. Țintă: 300-500.
- **20-30 de Fondatori ai Comunității** (acces gratuit pe viață, badge „Fondator", influență asupra produsului).
- **Seed content** (vezi 14.1, Pilonul 2).

## 14.3 Faza 1 — Beta închis (lunile 3-5)

Invitații în valuri de ~50; feedback structurat după fiecare val; primele relații cu presa (unghiul: **omul cu patru roluri**, nu produsul).

## 14.4 Faza 2 — Lansarea publică (luna 6)

Plan orar al zilei Z; post de lansare LinkedIn (povestea personală); lansare pe Product Hunt.

## 14.5 Faza 3 — Creștere organică (lunile 7-12)

Motor de conținut săptămânal; parteneriate (OAR, AICPS, ARACO, producători mari, universități, influenceri); SEO; referral.

## 14.6 Faza 4 — Accelerare (lunile 13-24)

Prima conferință DETALIA; expansiune regională („celelalte Românii ale lumii").

## 14.7 Cele trei reguli de aur

1. Comunitatea înaintea produsului.
2. Povestea personală a fondatorului este cel mai puternic instrument de marketing.
3. Calitatea primilor 100 de utilizatori contează mai mult decât numărul lor.

---

# 15. MODELUL DE BUSINESS

> **DETALIA nu vinde un produs, ci acces la o comunitate de încredere și la cunoaștere validată. Monetizarea este consecința valorii.**

## 15.1 Cele patru surse de venit

```
1. ABONAMENTE PRO (SaaS recurent)
2. MARKETPLACE (comisioane tranzacții + promovare)
3. FURNIZORI (B2B — pachete vizibilitate, leads, date)
4. EVENIMENTE & EDUCAȚIE
```

Fiecare sursă hrănește celelalte: furnizorii care plătesc atrag proiectanți care publică detalii care atrag executanți care atrag beneficiari care atrag furnizori.

## 15.2 Freemium

```
GRATUIT PENTRU TOTDEAUNA: vizualizare detalii publice · aprobare/dezaprobare/
comentarii/schițe · upload limitat · portofoliu de bază · proiecte de bază · căutare standard
```

Utilizatorul gratuit construiește comunitatea și conținutul fără de care platforma nu valorează nimic.

## 15.3 Planuri Pro (diferențiate pe rol)

```
PRO BENEFICIAR    —   5 EUR/lună  (39 EUR/an)
PRO EXECUTANT     —  10 EUR/lună  (80 EUR/an)
PRO ARHITECT/ING. —  15 EUR/lună  (120 EUR/an)
PRO FURNIZOR      —  99 EUR/lună  (799 EUR/an)
```

> Accesul la Marketplace (vânzare/promovare) este condiționat de abonament — principalul motor de conversie spre Pro.

## 15.4 Marketplace — comisioane

```
Vânzare planșe/pachete:   comision platformă 20% (autorul ia 80%)
Bursă lucrări:            plată per aplicare peste limită / featured listing
Consultanță la cerere:    comision platformă 15% (specialistul ia 85%)
```

## 15.5 Furnizori (B2B) — pachete de vizibilitate

```
STARTER   —   199 EUR/lună   BUSINESS  —   499 EUR/lună   PREMIUM   — 1.499 EUR/lună
```
Plus: sponsorizarea Detaliului săptămânii, rapoarte de piață, licitații transparente pentru „furnizor recomandat".

## 15.6 Proiecție financiară orientativă (3 ani)

```
                        AN 1        AN 2        AN 3
TOTAL VENITURI       222.000 €  1.090.000 €  2.670.000 €
TOTAL COSTURI        180.000 €    395.000 €    650.000 €
EBITDA                42.000 €    695.000 €  2.020.000 €

Evoluție MRR: L6 ~500€ → L12 ~9.000€ (breakeven) → L24 ~44.000€
```
*Cifrele sunt estimări de planificare, nu garanții; depind de execuție și de ritmul de adopție.*

---

# 16. ECHIPĂ ȘI FONDATOR

## 16.1 Fondatorul — un founder-operator complet implicat

DETALIA nu este un concept cumpărat sau externalizat — este construit și condus de un fondator care le acoperă pe toate.

**Founder-market fit excepțional.** Fondatorul este simultan arhitect (la bază), executant (ani de șantier), furnizor de materiale (franciza Depozitul Virtual) și viitor beneficiar (își construiește propria casă). Cei patru actori pe care platforma îi aduce la aceeași masă există deja, integrați, într-o singură persoană. Conceptul nu este o ipoteză de business — este cristalizarea directă a unei experiențe trăite în toate rolurile. Acest lucru nu poate fi copiat, cumpărat sau inventat de un competitor.

**Fondator, owner și CTO — implicare totală, în toate fazele.** Fondatorul conduce personal atât viziunea, cât și execuția tehnică. Partea tehnică îi aparține: se implică direct în dezvoltarea produsului, de la arhitectură până la ultimul buton, folosind inclusiv unelte AI ca **accelerator** al programării. Nu este un vizionar care deleagă — este un operator hands-on care își asumă produsul integral, exact pentru că platforma s-a născut din convingerea lui personală și din experiența lui directă.

```
ROLUL FONDATORULUI — ÎNTREG CICLUL
├── PRODUS & TEHNIC: arhitectură, dezvoltare, decizii de produs (cu suport AI)
├── CONȚINUT: primele detalii din practica proprie = etalonul de calitate
├── COMUNITATE: recrutarea primilor utilizatori, formarea echipei de fondatori,
│               moderare în faza incipientă
└── MARKETING & VOCE: social media, explicații, povestea celor 4 roluri
```

## 16.2 Echipa se construiește în jurul fondatorului, nu în locul lui

Pe măsură ce platforma crește, fondatorul aduce oameni pentru a **scala**, nu pentru a prelua.

```
LA NEVOIE (scalarea dezvoltării):
├── Frontend / mobile developer (suport pentru fondator)
└── UI/UX designer (colaborare punctuală)

POST-LANSARE (creștere):
├── Community manager (esențial pentru o platformă de comunitate)
└── Suport vânzări B2B (relația cu furnizorii la scară)
```

## 16.3 Finanțarea — opțiune deschisă, cu o recomandare

Finanțarea nu este încă decisă. Opțiunile, evaluate onest:

- **Bootstrapping** — control total, creștere lentă.
- **Investitor** — capital + presiune + diluție.
- **Mixt** — bootstrapping pentru MVP, finanțare după tracțiune.

*Recomandare pragmatică:* MVP-ul minim poate fi bootstrapped (mai ales cu fondatorul ca CTO), iar finanțarea serioasă are sens **după** ce North Star-ul începe să crească — banii vin mai ieftin și cu mai puțină diluție când există deja dovada adopției.

## 16.4 Notă de risc — key person

Implicarea totală a fondatorului este un avantaj major, dar creează o **dependență de o singură persoană** (key person risk). Este firesc în acest stadiu; pe termen mediu se diluează prin construirea echipei. Documentul o numește deschis — semn de maturitate, nu de slăbiciune.

---

# 17. ASPECTE LEGALE ȘI PROPRIETATE INTELECTUALĂ

## 17.1 Forma juridică

```
├── Entitate: SRL în România
├── CAEN principal: 6312 — Activități ale portalurilor web
├── CAEN secundar: 8559 — Alte forme de învățământ
```

## 17.2 Proprietatea intelectuală a conținutului

> **Principiu:** autorul unui detaliu rămâne proprietarul intelectual. Prin publicare, acordă platformei DETALIA o licență neexclusivă, gratuită, de afișare și distribuire în cadrul platformei.

- Autorul poate șterge detaliul oricând.
- DETALIA nu poate vinde conținutul altora.
- Detaliile de vânzare: tranzacție directă autor–cumpărător; platforma reține comision.
- Conținut plagiat: procedură clară de reclamare și eliminare.

## 17.3 Proprietatea pe schițele colaborative — clauză critică de rezolvat înainte de Marketplace

Când un executant desenează o schiță peste detaliul unui arhitect, iar acesta o integrează într-o versiune pe care apoi o **vinde** în Marketplace, contributorul a contribuit la un produs comercial. Cine ia banii? Această zonă trebuie clarificată în T&C **înainte de prima dispută**, nu după.

```
PRINCIPII PROPUSE (de confirmat juridic)
├── Schița rămâne mereu ATRIBUITĂ autorului ei (cu rol vizibil).
├── Integrarea într-o versiune nouă se face DOAR cu acceptul autorului detaliului.
└── Pentru versiunile VÂNDUTE în Marketplace, T&C trebuie să stabilească explicit
    una dintre variante:
      (a) contribuția publică acordă o licență de utilizare derivată, cu
          atribuire, dar fără pretenție asupra venitului; SAU
      (b) integrarea unei schițe într-un produs comercial necesită acordul
          contributorului și, eventual, un mecanism de revenue-share.
```

**Decizie de luat explicit înainte de lansarea Marketplace-ului.** (Punct deschis — Anexa B.)

## 17.4 Limitarea răspunderii tehnice — clauză esențială

> DETALIA este o platformă de schimb de informații între profesioniști. Detaliile publicate reprezintă opiniile autorilor și nu constituie consultanță tehnică certificată. Utilizatorul este responsabil pentru validarea conformității cu normativele în vigoare înainte de execuție.

Clauză critică: un detaliu aplicat greșit poate genera prejudicii. Platforma facilitează schimbul și validarea comunitară, dar nu certifică soluțiile tehnice.

---

# 18. ANALIZA COMPETIȚIEI

**Concluzia centrală:** niciun jucător nu combină simultan cele trei elemente care definesc DETALIA — *detaliul ca unitate centrală + validarea multi-actor pe roluri + comerțul organic*. Fiecare competitor are unul, maxim două. Intersecția celor trei este goală — acolo se află DETALIA. Plus funcția unică de schițare colaborativă, pe care nu o are nimeni.

## 18.1 Cele patru categorii de competiție

**Categoria 1 — Managementul detaliilor (ex. Pirros, SUA).** Unealtă internă de firmă, mono-actor (doar proiectanți), fără validare comunitară sau comerț. Validează premisa că detaliul e o unitate de cunoaștere reutilizabilă, dar nu este competitor direct.

**Categoria 2 — Bibliotecile de detalii (Detail Library UK, DETAIL.de, Green Building Advisor).** Cele mai apropiate ca *obiect*, dar opuse ca *model*: conținut curat editorial, de sus în jos (o autoare sau o redacție), nu de jos în sus, validat de comunitate. DETAIL.de este cel mai serios reper european (brand de 65 de ani, bază de date de 5.500+ proiecte, catalog de produse), dar premium, editorial, orientat spre arhitectul de elită occidental — nu spre executantul de pe șantier sau beneficiarul român.

**Categoria 3 — Conținut BIM de la producători (BIMobject, BIMcontent, Bimstore, ProdLib, ARCAT).** Industrie matură global; producătorii publică obiecte BIM/detalii gratuit pentru a fi specificați. Acesta este „marketingul tehnic" deja industrializat. *Implicație dublă:* validează fluxul de venit „furnizori", dar înseamnă că **conținutul de furnizor singur nu diferențiază** — diferențiatorul DETALIA este că furnizorul apare lângă un detaliu viu, validat de comunitate, nu într-un catalog mort.

**Categoria 4 — „Găsește meșter" în România (necesit.ro, mesterilocali, mesterache, meseriasii, constructbid, prolist).** Piață aglomerată, pe model de lead-generation cu auto-declarare și recenzii. Toate pleacă de la ce *zice* omul, nu de la ce *demonstrează*. DETALIA nu este pe această piață; o piață vecină din care *culege* clienți, pe un fundament diferit (competență dovedită prin detalii).

## 18.2 Tabel comparativ

```
                          Detaliul   Validare    Multi-   Comerț    Schițare
                          central    pe roluri   actor    organic   colaborativă
Pirros                       ✔          ✘          ✘         ✘          ✘
Detail Library / DETAIL.de   ✔          ✘          ✘        parțial     ✘
BIMobject & co.            parțial      ✘        parțial     ✔          ✘
necesit.ro & co.             ✘          ✘        parțial     ✔          ✘
DETALIA                   ✔          ✔          ✔         ✔          ✔
```

## 18.3 Moatul și singurul risc real

**Moatul nu este codul, ci comunitatea** — un moat de tip efect de rețea. Codul se copiază; o comunitate de specialiști care se validează reciproc, reputațiile câștigate în ani și încrederea acumulată, nu. Un produs identic, dar gol, nu valorează nimic.

**Singurul risc real** nu vine din față, ci din lateral: un jucător adiacent care „alunecă" spre model (un DETAIL.de care adaugă validare comunitară, sau un BIMobject care adaugă discuție pe detalii). Puțin probabil pe termen scurt (sunt mari, lenți, mulțumiți de model), dar este motivul pentru care cele trei reguli de aur ale lansării nu sunt opționale.

---

# 19. METRICE DE SUCCES

## 19.1 Metrica polară (North Star)

> **Numărul de detalii cu minimum 10 aprobări din cel puțin 3 roluri diferite.**

Aceasta arată că platforma funcționează cu adevărat — nu numărul de utilizatori sau de detalii, ci detaliile cu validare reală, multidimensională.

## 19.2 Indicatori urmăriți

```
PRODUS:    DAU/MAU >25% · detalii noi/săpt. 20+ · interacțiune activă >35%
           schițe colaborative acceptate/săpt. (indicator al funcției distinctive)
COMERCIAL: MRR și creștere · churn <5%/lună · LTV/CAC >3:1 · venit/furnizor activ
COMUNITATE:North Star · retenție 30 zile >40% · versiuni finale/lună · NPS >50
```

*Pragurile precise de „sănătate" pe fază (câți utilizatori la L6 = succes vs. pivot) — punct deschis, Anexa B.*

---

# 20. ROADMAP DE DEZVOLTARE

## 20.1 Fazele

```
FAZA 0 — Pre-lansare (L1-3): MVP în dezvoltare · seed content · 20 fondatori · beta
FAZA 1 — Lansare publică (L4-6): MVP live · campanie · primele 500 conturi active
FAZA 2 — Funcția distinctivă (L7-12): SCHIȚAREA COLABORATIVĂ + versiuni · forum · notificări
FAZA 3 — Marketplace (L13-18): materiale furnizori · pachete proiectanți · promovare
FAZA 4 — Monetizare & accelerare (L19-24): Pro complet · B2B furnizori · conferință · expansiune
```

## 20.2 Conținutul MVP — linia de demarcație

```
MVP (obligatoriu la lansare):
├── Cont cu rol granular declarat (+ început de verificare)
├── Upload detaliu (chestionar + header zone climatice/seismice)
├── Vizualizare de bază 2D + galerie surse
├── Validare pe roluri (aprob/dezaprob) + justificare obligatorie
├── Comentarii pe taburi de rol (sub-rol ca etichetă)
├── Portofoliu (Create de mine / Apreciate) + Proiecte
├── Căutare liberă + structurată, sortare pe rating
└── Feed cu top detalii populare

ÎN VAL 2 (după lansare):
├── SCHIȚAREA COLABORATIVĂ + sistemul complet de versiuni
├── Forum / discuții · notificări avansate · Marketplace
```

## 20.3 Tensiunea de rezolvat: lansăm fără funcția distinctivă?

Schițarea colaborativă este **cel mai mare diferențiator** și **cel mai mare risc tehnic**. Tensiunea: dacă o lansăm în Faza 2, lansăm MVP-ul fără exact lucrul care ne face unici.

**Decizia adoptată:**
1. MVP-ul lansează cu **validarea multi-actor pe roluri granulare** — care este, ea singură, suficient de diferențiată față de orice competitor (vezi cap. 18).
2. Se construiește un **prototip tehnic timpuriu al schițării încă din Faza 0**, pentru a-i valida fezabilitatea (cel mai mare risc tehnic), chiar dacă funcția lustruită se livrează în Faza 2.
3. Schițarea urmează **rapid** după lansare, ca prim mare upgrade — nu se amână la nesfârșit.

---

# 21. RISCURI ȘI MITIGARE

```
RISC                              IMPACT   MITIGARE
─────────────────────────────────────────────────────────────────────────
Creștere lentă a comunității       mare    Seed content + fondatori activi + cold
                                           start rezolvat (cap. 14.1) + content marketing
Conținut tehnic greșit validat   f. mare   Clauze T&C + moderare + raportare + roluri
   în masă (vezi punct deschis)            verificate; necesită sistem dedicat (Anexa B)
Schițarea colaborativă nefezabilă  mare    Prototip tehnic timpuriu în Faza 0 (cap. 20.3)
Furnizorii nu adoptă               mare    Depozitul Virtual = furnizor model; pachete
                                           entry-level; demonstrarea ROI primului furnizor
Copierea conceptului de un mare    mediu   Moatul = comunitatea (cap. 18.3); viteză în 2 ani
Key person (dependența fondator)   mediu   Construirea echipei pe termen mediu (cap. 16.4)
Abuz / reputație coruptibilă     f. mare   Sistem anti-abuz dedicat (punct deschis, Anexa B)
```

---

# 22. GLOSAR ȘI ANEXE

## 22.1 Glosar de termeni cheie

- **Detaliu tehnic de execuție** — reprezentare grafică/descriptivă a modului concret de realizare a unui element de construcție.
- **Vizualizare de bază** — desenul 2D pe care se desfășoară dezbaterea și schițarea; obligatoriu de facto.
- **Schiță colaborativă** — desen făcut de un alt utilizator peste vizualizarea de bază, păstrat în istoric ca versiune, cu autor și rol.
- **Versiune finală** — singura versiune actualizată marcată de autor ca definitivă; declanșează aprobarea automată de către cei implicați.
- **Rol granular** — categoria (proiectant/executant/furnizor/beneficiar) plus sub-rolul specific (arhitect, structurist, electrician etc.).
- **Rol verificat** — rol confirmat (OAR / drept de semnătură / lucrări cu review), marcat cu badge.
- **Validare pe roluri** — aprobare/dezaprobare simplă, unde rolul granular e mereu vizibil și greutatea o cântărește cititorul.
- **Cold start** — problema „ou și găină" a unei platforme multi-actor goale la lansare.
- **North Star Metric** — numărul de detalii cu min. 10 aprobări din min. 3 roluri.
- **Moat** — avantajul durabil care protejează afacerea de competiție (aici: efectul de rețea al comunității).

## 22.2 Anexa A — Decizii de design adoptate

```
1.  Validare simplă pe roluri, fără dimensiuni multiple de aprobare.
2.  Roluri GRANULATE (categorie + sub-rol); sub-rolul ca etichetă lângă nume.
3.  Cele 4 taburi de comentarii se păstrează; filtrarea fină — ulterior.
4.  Rol declarat vs. verificat; verificare diferită pe roluri; badge „Verificat".
5.  Schițare colaborativă în timp real + sistem de versiuni.
6.  Flux accept/respinge schiță; doar autorul controlează versiunile.
7.  Aprobare automată a versiunii finale de către cei implicați.
8.  Portofoliu cu 2 categorii (Create de mine / Apreciate) + Proiecte.
9.  Fără normative la upload; intră prin justificările de dezaprobare.
10. Aprobarea fără justificare; dezaprobarea CU justificare obligatorie → comentariu.
11. Buton identic pentru toți; greutatea o cântărește cititorul.
12. Feed finit (top ~10), fără infinite scroll; căutare țintită, sortare pe rating.
13. Fără regiune geografică și fără căutare vizuală/normativ deocamdată.
14. Corp vizual: vizualizare de bază 2D + galerie; fișiere DWG/IFC separate (download).
15. Header cu zone climatice/seismice, foc, materiale; „General" scade credibilitatea.
16. Mobile-first: mobil = consum + contribuție ușoară; desktop/tabletă = creație grea.
17. Pregătire i18n de la prima linie de cod (texte, taxonomie, normative pe țară).
18. Marketplace = magazin de produse finale; like/dislike + control comunitar.
19. MVP fără schițare (val 2), DAR prototip tehnic al schițării în Faza 0.
20. Fondator = owner + CTO, implicare totală; echipa scalează, nu preia.
```

## 22.3 Anexa B — Puncte deschise de decis

```
□ Terminologia finală pentru aprobare/dezaprobare.
□ Definirea exhaustivă a taxonomiei de sub-categorii.
□ Proprietatea intelectuală a schițelor integrate în versiuni VÂNDUTE (cap. 17.3).
□ MODERARE & CALITATE: cine moderează, cum se escaladează o dispută tehnică,
  mecanism de „red flag" pentru un detaliu periculos cu multe aprobări greșite.
□ FORMULA DE RATING & REPUTAȚIE: cum se calculează ratingul unui detaliu și al
  unei persoane; cântărește mai mult aprobarea unui cont verificat / cu reputație?
□ ANTI-ABUZ & INTEGRITATE: prevenirea conturilor false care se aprobă reciproc,
  a dezaprobării sistematice a concurenței, a furnizorilor cu conturi-marionetă.
□ PRAGURI DE SĂNĂTATE PE FAZĂ: câți utilizatori activi / ce retenție la L6, L12
  înseamnă succes vs. semnal de pivot.
□ Modelul exact de comision pentru Bursa de lucrări.
□ Pragurile precise pentru badge-uri și specializări validate.
□ Decizia finală privind restricția de desen 2D la upload (după date reale).
```

## 22.4 Anexa C — Normative relevante (referință)

```
├── Legea 10/1995 — Calitatea în construcții     ├── NP 112 — Fundații directe
├── NP 069 — Proiectarea clădirilor              ├── SR EN 1990-1997 — Eurocoduri
├── C 107 — Calcul termotehnic                    └── GP 123 — Hidroizolații
```

## 22.5 Anexa D — Date de piață (surse)

```
├── Autorizații rezidențiale 2025: 37.252 (+4,4%); ~80.000 locuințe; ~70% rural — INS
├── Forța de muncă în construcții: ~462.000 (iul. 2025); +28.000 non-UE — INS / presă
├── Arhitecți: OAR București 4.592; total național ~9.000–10.000 (de confirmat la OAR)
├── Practica „doar DTAC": documentată de profesioniști; preț DTAC ~38 lei/mp vs
│   PTh 63–140 lei/mp (estimări de piață)
└── Cifre de necunoscut, de măsurat prin sondaje proprii (cap. 2.4)
```

---

*Document fundamental DETALIA v3.0.*
*Integrează analiza de piață, analiza competiției și completările structurale (roluri granulare, verificare, cold start, mobile-first, i18n, echipă & fondator, IP schițe, riscuri consolidate).*
*Stă la baza dezvoltării produsului și a business-ului și va fi actualizat pe măsură ce conceptul evoluează.*
