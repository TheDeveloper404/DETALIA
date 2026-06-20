# DETALIA — Plan non-tehnic

> Document pentru Edward, în limbaj simplu (fără termeni tehnici).
> Patru părți, fiecare subiect explicat **o singură dată**:
> **A.** Cum funcționează platforma · **B.** Ce e gata acum vs. ce urmează · **C.** De ce am construit-o așa ·
> **D.** Ce ai confirmat și ce mai avem nevoie de la tine.
> Actualizat: iunie 2026.

---

# A. Cum funcționează DETALIA (pe înțelesul tuturor)

## A1. Cum intri în platformă — „login fără parolă" (magic link)

La DETALIA **nu există parole.** Intrarea se face printr-un link trimis pe email. Concret:

1. Omul intră pe pagina de **login** și scrie doar **adresa de email**.
2. Primește pe email un **link unic** și dă click pe el.
3. Clickul îl bagă direct în platformă. **Dacă e prima oară, contul i se creează automat** chiar atunci.
4. Imediat după, **își alege rolul** (vezi A2) și are acces.

Acest link se numește **„magic link"** — „magic" pentru că dai un singur click și ești înăuntru, fără să ții
minte nicio parolă.

**De ce am ales așa:**
- Nimeni nu uită parola — pentru că nu există.
- Nu avem parole care se pot fura sau scurge → mai sigur.
- Se potrivește perfect cu beta-ul pe invitație: invitația *este* cheia.

**Important de reținut:** nu există „înregistrare" separată de „login". E **același drum** — prima intrare
înseamnă cont nou. Linkul e de **o singură folosință** și **expiră repede** (câteva minute), ca să fie sigur.

## A2. Rolul — „îl declari, apoi îl verifici"

Ca să nu pierdem oameni la primul contact, **fiecare își declară singur rolul** când intră prima oară:
proiectant / executant / furnizor / beneficiar, plus o specializare (ex. „arhitect"). **Un singur rol per om.**
După ce l-a declarat, are acces imediat — nu-l blocăm cu nimic.

Mai târziu, în platformă, există un pas opțional de **„Verificare rol"**: omul trimite o dovadă, iar tu
(la MVP, manual) o aprobi. Odată verificat, lângă numele lui apare un **badge cu steluță galbenă ⭐.**

Ideea, exact cum ai descris-o: greutatea unei păreri o dă **întâi rolul**, apoi **faptul că e verificat.** Așa
fiecare va vrea să se verifice singur, fără să-l forțăm. **Nu există note sau scoruri** — doar rolul afișat,
iar cititorul cântărește singur.

## A3. Detaliile și validarea (inima platformei)

Un **detaliu** = unitatea de conținut: o imagine 2D (un detaliu de execuție), cu titlu, autor + rolul lui, și
categorie. Lângă fiecare detaliu, oamenii își spun poziția — asta e **validarea**:
- **Aprob** = un singur click.
- **Dezaprob** = obligatoriu **cu o justificare** (nu poți dezaproba „mut"); justificarea devine automat un comentariu.

Fiecare om are **o singură poziție** per detaliu, dar o poate schimba. Nu-ți poți valida propriul detaliu.
Toți pot valida orice — diferența o face **rolul afișat** lângă nume.

## A4. Schițele — „propuneri de modificare", ca pe GitHub

O **schiță** = o foaie desenată **peste** un detaliu existent, ca o propunere de îmbunătățire. Aici e cheia care
face lucrul fezabil: oamenii **NU desenează toți deodată** pe aceeași foaie (ca în Google Docs). Fiecare își face
**foaia lui**, o trimite, iar **autorul detaliului o acceptă sau o respinge** — exact ca o propunere pe care o aprobi.

Detalii pe care le-ai cerut și le-am prins:
- Când intri în modul schiță, **detaliul de dedesubt se estompează ușor** (un „fill slab"), ca să desenezi comod peste el.
- **Unelte:** mai multe culori stridente, 3 grosimi de creion, radieră, înapoi/înainte. (Mai târziu: linie, cerc, pătrat, săgeată, casetă text.)
- Schițele le ținem ca **„rețetă de desen" (linii), nu ca poză** — e mic, se rejoacă, se scalează pe orice ecran și se poate dezbate în detaliu.

Fiecare schiță acceptată intră în **„teancul"** detaliului și poate fi **dezbătută separat** (validări + comentarii pe ea).

## A5. Cum găsești conținut, notificări, conținut de start

- **Feed-ul** arată primele **~20 de detalii** după interacțiuni, **fără scroll infinit** (e comunitate, nu social media).
- La început cauți **alegând din categorii** (filtre). Căutarea liberă „cu vorbele tale" vine mai târziu (e scumpă de făcut bine).
- **Notificările** merg **și în aplicație, și pe email** de la început (ajută oamenii să revină — brand recall).
- La lansare, **doar noi încărcăm detalii** (conținut „de start"), cu creatorii aleși de tine. Așa controlăm prima impresie.

---

# B. Ce e gata acum vs. ce urmează

Construim în etape. Prima etapă (**fundația**) e gata; restul urmează.

## ✅ B1. Gata acum — fundația (intrarea în platformă și conturile)

- **Login cu magic link** — funcționează (cum e descris la A1).
- **Crearea contului** — automată la prima intrare.
- **Alegerea rolului** la intrare (A2).
- **Ușă încuiată implicit** — cine nu e logat **nu intră** în zonele protejate; e trimis automat la login.
- **Conturi de admin (noi)** — sistemul știe cine suntem „noi", ca să putem pune conținutul de start.
- **Invitațiile** — mecanismul e pregătit, dar **lăsat pe pauză**: îl aprindem cu un singur comutator când
  decidem dacă lansăm pe invitație sau deschis.

> Tot ce e mai sus e scris și **verificat** că funcționează.

## ⏳ B2. Două „chei" lipsă (nu muncă de programare)

Ca fundația să fie 100% live, mai trebuie conectate două lucruri din exterior:
- **Serviciul de email cu domeniul nostru verificat** — fără el, linkul de login nu pleacă efectiv pe email.
- **Baza de date online pornită** — e gata de conectat, durează minute.

## 🔜 B3. Ce urmează (etapele următoare)

1. **Inima:** detaliile, feed-ul, validarea (aprob/dezaprob) — aici aflăm dacă „se aprinde dezbaterea pe roluri".
2. **Schițarea** (A4) — partea grea, obligatorie în MVP.
3. **Verificarea rolului** (badge ⭐) + lustruirea pentru lansarea în beta.

---

# C. De ce am construit fundația așa (ieftin, rapid, fără fundături)

## C1. „O singură clădire bine compartimentată, nu un cartier"

Puteam face produsul din mai multe bucăți separate care vorbesc între ele. Sună impresionant, dar acum ar fi
însemnat mai mulți bani, mai mult timp de conectat și mai multe lucruri care se pot strica. Am ales **un singur
produs, cu camere clar despărțite înăuntru.** E mai ieftin și mai rapid — iar pereții dintre camere sunt deja
ridicați, așa că dacă într-o zi vrem să mutăm o cameră în altă clădire (când creștem), o desprindem curat,
fără să dărâmăm casa.

## C2. „Cât mai aproape de zero, cât suntem în validare"

Folosim doar unelte cu **variantă gratuită reală** la traficul mic de început (găzduire, bază de date, email,
stocare imagini). **Singurul cost cvasi-sigur e găzduirea**: pornim gratuit pentru validare, iar când produsul
devine clar comercial trecem pe varianta plătită, **~20$/lună.** Restul costurilor apar doar dacă explodează
traficul — adică o „problemă de succes", nu o cheltuială de pornire.

## C3. Cele trei principii, în ordine

1. **Ieftin acum** — ca să poți valida piața aproape gratis.
2. **Repede** — ca să avem ce arăta și testa cât mai curând.
3. **Fără fundături** — tot ce construim acum se poate extinde, nu se aruncă.

> Nu construim o catedrală înainte să știm că vine lumea la slujbă. Construim exact cât trebuie ca să aflăm —
> dar bine, ca să putem clădi mai sus pe ea.

---

# D. Ce ai confirmat și ce mai avem nevoie de la tine

## D1. Ce ai confirmat (deja integrat — spune dacă am înțeles greșit ceva)

- Login fără parolă (magic link). ✔
- Un singur rol per om; declarat la intrare, verificat ulterior → badge ⭐ (verificare manuală la MVP). ✔
- La înscriere cerem minimul (nume + email + rol); restul opțional. ✔
- Schiță: o foaie = un autor, model GitHub (nu desen simultan); peste detaliu cu „fill slab"; culori + 3 grosimi
  + radieră + undo/redo; doar de la detaliul-mamă; autorul detaliului acceptă/respinge. ✔
- Detaliu: o imagine 2D (până la ~5MB) + maxim 3 resurse; zone climatică/seismică = listă fixă cu „General"
  (cu atenționare că datele reale dau mai multă greutate). ✔
- Validare: fără note/scoruri; nu-ți validezi propriul conținut; toți pot valida, diferența o face rolul. ✔
- Feed ~20 fără scroll infinit; doar filtre la început; notificări în app + email; la lansare doar noi încărcăm (seed). ✔

## D2. Ce mai avem nevoie de la tine

- ⭐ **Lista exactă de subroluri** per rol principal (e schițată în Documentul Fundamental — confirmă varianta de lansare).
- ⭐ **Taxonomia de categorii** pentru filtre (primele 1–2 niveluri — ca să avem pe ce pune conținutul de start).
- **Verificarea automată a rolului** (mai târziu, nu la MVP): pe lângă verificarea ta manuală, folosim surse
  oficiale? (ex. **OAR** pentru arhitecți, **CUI** pentru firme.)
- **Decizia de acces la lansare:** pe invitație sau deschis? (Mecanismul de invitație e gata și pe pauză.)

## D3. De discutat când are sens (nu grăbim)

- Cine deține conținutul postat (detalii/schițe) și ce drepturi avem — pentru Termeni & Condiții. (Doc. Fundamental, cap. 17.)
- O politică minimă de confidențialitate (GDPR), din moment ce strângem emailuri. (Doc. Fundamental, cap. 13.6.)
