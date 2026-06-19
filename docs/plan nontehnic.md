# DETALIA — Plan non-tehnic

> Document pentru Edward. Două părți:
> **Partea I** — *de ce* am construit fundația așa cum am construit-o (ce înseamnă pentru bani, viteză, riscuri).
> **Partea II** — *ce am confirmat împreună* (din răspunsurile tale) și *ce mai avem nevoie de la tine*.
> Actualizat după runda ta de răspunsuri (iunie 2026).

---

# PARTEA I — De ce am ales arhitectura asta

## Pe scurt:

Am ales o variantă **simplă, ieftină și rapidă** pentru faza în care suntem — cea în care testăm dacă
oamenii vor platforma. Costă aproape nimic să o ținem pornită, o livrăm repede, și — important — am
construit-o în așa fel încât **mai târziu, când crește, NU trebuie aruncată și făcută din nou.** Crește
odată cu noi.

---

## 1. „Construim o singură clădire, nu un cartier"

Puteam să facem produsul din mai multe bucăți separate care vorbesc între ele (mai multe „clădiri" cu
drumuri între ele). Sună impresionant, dar pentru faza de acum ar fi însemnat:
- mai mulți bani de chirie (plătești fiecare bucată separat),
- mai mult timp pierdut conectând bucățile,
- mai multe lucruri care se pot strica.

Am ales **o singură construcție bine compartimentată** — un singur produs, cu camere clar separate
înăuntru. E mai ieftin, se face mai repede, și **camerele sunt deja despărțite cu pereți**, așa că dacă
într-o zi vrem să mutăm o cameră în altă clădire (când scalăm), o desprindem curat, fără să dărâmăm casa.

**Ce înseamnă pentru tine:** plătești o chirie, nu cinci. Și nu te blochezi — creșterea de mai târziu e
pregătită din temelie.

---

## 2. „Cât mai aproape de zero, cât suntem în validare"

Am ales doar unelte care au **variantă gratuită reală** la traficul mic de început:
- locul unde stă aplicația (hosting),
- baza de date (unde ținem detaliile, userii, validările),
- trimiterea de emailuri (pentru invitații, login și notificări),
- stocarea imaginilor și a schițelor.

Toate stau pe gratuit cât timp suntem mici. **Singurul cost cvasi-sigur e hostingul** — pornim pe varianta
gratuită pentru validare, iar când produsul devine clar comercial/public trecem pe varianta plătită,
**~20$/lună**. Atât. Restul costurilor apar doar dacă explodează traficul — adică o „problemă de succes",
nu o cheltuială de pornire.

**Ce înseamnă pentru tine:** poți testa piața fără să bagi bani serioși. Costul crește doar dacă și
încasările justifică.

---

## 3. „Login fără parolă" (magic link) — confirmat de tine

La intrare, userul primește pe email un link pe care dă click și e înăuntru — fără parolă de ținut minte.
Am ales asta pentru că:
- se potrivește perfect cu **beta-ul pe invitație** (invitația *este* cheia de acces),
- nu avem parole care se pot fura sau uita,
- mai puține bătăi de cap și pentru useri, și pentru noi.

**Ce înseamnă pentru tine:** tu trimiți invitația, omul dă click pe link și e înăuntru. Invitația îi dă
**accesul**; rolul și-l alege singur la intrare (vezi punctul 4).

---

## 4. Rolul: „îl declari, apoi îl verifici" — exact cum ai cerut

Ca să nu pierdem oameni la primul contact, **fiecare își declară singur rolul** la înscriere (proiectant /
executant / furnizor / beneficiar + specializarea) și intră imediat. Apoi, în platformă, există un pas de
**„Verificare rol"**: odată verificat, lângă rol apare un **badge cu steluță galbenă**.

Logica e cea pe care ai descris-o: greutatea unei păreri o dă **întâi rolul**, apoi **faptul că rolul e
verificat** — așa că fiecare va vrea să-și verifice rolul, fără să-l forțăm noi de la început. La 50–100 de
oameni cunoscuți, verificarea o faci tu manual (o conversație, nu un sistem). **Un singur rol per om** —
mai curat de afișat și de verificat.

**Ce înseamnă pentru tine:** intrare ușoară pentru invitați + un mecanism natural prin care lumea își
verifică rolul singură, pentru greutate.

---

## 5. „Pornim cu conținutul nostru, controlat" (seed) — confirmat

La lansare **nimeni nu încarcă nimic** în afară de noi. Tu pui detaliile de start, cu cei 10–20 de creatori
aleși. Așa controlăm exact calitatea și diversitatea, și ne asigurăm că de la prima zi e ceva interesant de
dezbătut, nu un loc gol. Deschiderea încărcării pentru toți vine la pasul următor, când e clar că lumea o
cere.

**Ce înseamnă pentru tine:** controlezi total prima impresie. Și e mai sigur — mai puține lucruri care pot
merge prost la lansare.

---

## 6. Partea grea: schițarea — obligatorie în MVP, în varianta inteligentă

Schițarea (foile peste detaliu, fiecare cu autorul ei) e cea mai grea piesă — și o facem **din MVP**, pentru
că fără ea platforma nu e ea însăși. Cheia care o face fezabilă: oamenii **NU desenează toți deodată pe
aceeași foaie** (ca în Google Docs). Fiecare își face **foaia lui**, o trimite, iar autorul detaliului o
acceptă — exact ca o „propunere de modificare" pe care o aprobi.

Asta seamănă izbitor cu felul în care programatorii colaborează pe GitHub (de unde a și pornit ideea ta):
fiecare vine cu propunerea lui, iar proprietarul o acceptă. **Modelul ăsta ne scutește de partea cea mai
scumpă și mai riscantă** (desenatul simultan în timp real), pe care o lăsăm pentru mult mai târziu, dacă va
fi nevoie.

Două lucruri pe care le-ai cerut și le-am prins:
- **Când intri în modul schiță, detaliul-mamă se estompează ușor** (un „fill slab"): vezi că s-a declanșat
  schițarea și desenezi mai ușor peste un detaliu colorat intens.
- **Unelte:** mai multe culori stridente, 3 grosimi de creion, radieră, înapoi/înainte. (Mai târziu:
  linie, cerc, pătrat, săgeată, casetă de text.)

Iar schițele le ținem ca **„rețetă de desen" (linii), nu ca poză.** O rețetă e mică, se poate rejuca, se
poate scala pe orice ecran și se poate discuta în detaliu. Pentru o platformă unde schița se dezbate, rețeta
e alegerea corectă.

**Ce înseamnă pentru tine:** facem partea cea mai grea într-o variantă realistă, fără să-i tăiem esența
(fiecare foaie e a cuiva și poate fi dezbătută separat).

---

## 7. Notificările: și pe email de la început — cum ai cerut

Pe lângă notificările din aplicație („cineva a propus o schiță pe detaliul tău"), trimitem și **email** de
la început. E ușor de pus și, cum ai zis, ajută la **brand awareness & recall** — oamenii revin pe platformă.

---

## 8. Căutarea: filtre acum, „caută cu vorbele tale" mai târziu

La început, găsești detalii **alegând din categorii** (ex: Fundație → Beton → Hidroizolare). E ieftin,
rapid și predictibil. Căutarea liberă, în care scrii o frază întreagă și sistemul „înțelege" ce vrei, e mult
mai scumpă și mai grea de făcut bine — o lăsăm pentru când avem destui useri ca să merite. Feed-ul arată
**primele ~20 de detalii** după interacțiuni, fără scroll infinit (e comunitate, nu social media).

**Ce înseamnă pentru tine:** oamenii găsesc ce caută din prima zi, fără să cheltuim pe tehnologie scumpă
înainte să fie nevoie.

---

## Concluzia Părții I

Fundația e gândită pe trei principii, în ordinea asta:
1. **Ieftin acum** — ca să poți valida piața aproape gratis.
2. **Repede** — ca să avem ce arăta și ce testa cât mai curând.
3. **Fără fundături** — tot ce construim acum se poate extinde mai târziu, nu se aruncă.

Nu construim o catedrală înainte să știm că vine lumea la slujbă. Construim exact cât trebuie ca să aflăm —
dar bine, ca să putem clădi mai sus pe ea.

---

# PARTEA II — Ce am confirmat și ce mai rămâne

## A. Ce ai confirmat (am integrat deja — spune dacă am înțeles greșit ceva)

**Acces & roluri**
- **Login fără parolă (magic link).** ✔
- **Un singur rol** per om. ✔
- **Rolul se declară la înscriere**, apoi se **verifică în platformă** → badge cu steluță galbenă lângă rol.
  Verificarea o aprobi tu manual la MVP. ✔
- La înscriere cerem minimul (nume + email + rolul declarat); restul (bio, localitate, poză) — opțional.
- **Fără bifă „pe viață"** la invitație. ✔

**Schiță**
- Fiecare foaie are **un singur autor**; oamenii adaugă foi în teanc, **nu desenează toți pe aceeași foaie**
  (model GitHub). ✔
- Se desenează **peste imaginea detaliului-mamă**, cu un **fill slab** care estompează detaliul-mamă când
  intri în modul schiță. ✔
- Unelte: **mai multe culori stridente, 3 grosimi**, radieră, înapoi/înainte. (Viitor: linie/cerc/pătrat/
  săgeată/casetă text.) ✔
- O schiță pornește doar de la detaliul-mamă (nu „schiță din schiță", deocamdată). ✔
- Autorul detaliului acceptă/respinge schițele propuse; nu modifică schițele altora. ✔

**Detaliu & zone**
- O imagine 2D per detaliu (jpg/png/webp, până la ~5MB). ✔
- Maxim 3 resurse suplimentare (imagine + link; PDF/text mai târziu). ✔
- **Zone climatică/seismică = listă fixă**, cu opțiune „General"; când alegi „General" apare o **atenționare**
  că datele reale dau mai multă greutate detaliului. ✔

**Validare**
- Fără note/scoruri — afișăm doar rolul lângă nume; cititorul cântărește singur. ✔
- Nu îți poți valida propriul detaliu/schiță. ✔
- Toți pot valida orice (inclusiv beneficiarii) — diferența o face rolul afișat. ✔

**Feed, căutare, notificări, conținut de start**
- Feed cu **~20** detalii după interacțiuni, fără scroll infinit. ✔
- Doar **filtre** la început; căutarea liberă vine mai târziu. ✔
- Notificări **în aplicație + pe email** de la început. ✔
- La lansare, **doar noi încărcăm** detalii (seed); deschiderea pentru toți vine în pasul următor. ✔

---

## B. Ce mai avem nevoie de la tine

- ⭐ **Lista exactă de subroluri** per rol principal. Ai zis că e în Documentul Fundamental — o folosim de
  acolo ca atare; confirmă dacă vrei ajustări sau adăugiri pentru lansare.
- ⭐ **Taxonomia de categorii** pentru filtre (primele 1–2 niveluri, ca să avem pe ce pune conținutul de
  start). E schițată în Documentul Fundamental — o finalizăm împreună ca listă de lansare.
- **Verificarea automată a rolului** (mai târziu, nu la MVP): pe lângă verificarea manuală făcută de tine,
  vrem să folosim surse oficiale? (ex. **OAR** pentru arhitecți, **CUI** pentru firme.)

---

## C. De discutat când are sens (nu grăbim)
- Cine deține conținutul postat (detalii/schițe) și ce drepturi avem asupra lui — pentru Termeni & Condiții.
  (Tratat în Documentul Fundamental, cap. 17.)
- O politică minimă de confidențialitate (GDPR), din moment ce strângem emailuri. (Documentul Fundamental,
  cap. 13.6.)
