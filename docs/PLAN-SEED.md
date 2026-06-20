# DETALIA — Plan de conținut seed (lansare beta închis)

> De ce există acest document: validarea de piață stă sau cade pe premisa
> *„dacă pun în fața specialiștilor un detaliu BUN, se aprinde debatea pe roluri?"*.
> Un feed gol sau cu detalii fade NU testează premisa — testează doar dacă oamenii se plictisesc.
> Deci conținutul seed **nu e umplutură, e instrumentul de măsură**. Îl proiectăm intenționat.
>
> Status: **draft de lucru.** Secțiunile marcate 🟦 **DECIZIE EDI** sunt de produs și se confirmă cu Edi.

---

## 1. Obiectiv

Lansăm un feed inițial care **provoacă** dezbaterea pe roluri din prima zi, nu unul care doar „există".
Țintă măsurabilă: la X zile de la lansare, cel puțin un detaliu să aibă **poziții divergente între roluri
diferite** (ex. un proiectant aprobă, un executant dezaprobă cu argument). Asta = premisa validată.

---

## 2. Câte detalii la lansare

🟦 **DECIZIE EDI** — recomandarea mea: **10–15 detalii**, nu 20.
- Prea puține (< 8) → feed-ul pare mort, nimeni nu simte „comunitate".
- Prea multe (> 20) → diluăm atenția; niciun detaliu nu strânge masa critică de interacțiuni.
- Feed-ul oricum afișează ~20 după interacțiuni (fără scroll infinit) — 10–15 detalii bune îl umplu sănătos.

---

## 3. Ce înseamnă un detaliu „bun" pentru seed (criteriul de selecție)

Un detaliu seed bun **invită la poziție din mai multe roluri**. Filtru practic:

1. **Polarizant pe rol** — există o tensiune reală proiectant ↔ executant ↔ furnizor.
   *Exemplu clasic:* o soluție de hidroizolare „corectă pe hârtie" (proiectant) dar greu/imposibil de executat
   curat pe șantier (executant). Aici se aprinde dezbaterea — exact ce vrem.
2. **Concret și recognoscibil** — un detaliu pe care oricine din breaslă l-a întâlnit (fundație, cornișă,
   racord tâmplărie-perete). Nu exotic, nu de nișă.
3. **Cu o singură imagine 2D clară** (jpg/png/webp, ~5MB) — lizibilă, nu un plan A3 ilizibil micșorat.
4. **Discutabil, nu „rezolvat"** — dacă răspunsul e evident și unanim, nu generează dezbatere. Vrem zona gri.
5. **Acoperă roluri diferite** — pe ansamblul celor 10–15, toate cele 4 roluri principale au de ce să se
   pronunțe (nu doar proiectanți).

> Anti-exemplu: „cum se toarnă o fundație corect, manual de manual". Corect, dar mut — nimeni n-are ce contesta.

---

## 4. Distribuția pe categorii

🟦 **DECIZIE EDI** (depinde de taxonomia finală de categorii, încă deschisă). Principiu: **împrăștiere, nu
concentrare** — 1–2 detalii per categorie majoră, ca filtrele să aibă ce arăta și fiecare breaslă să se
regăsească. Draft de acoperire (de ajustat la taxonomia reală):

| Zonă | Exemple de detalii (orientativ) |
|---|---|
| Fundație / infrastructură | hidroizolare cuvă, racord fundație-elevație |
| Anvelopă / termoizolare | punte termică la buiandrug, racord termosistem-soclu |
| Acoperiș | cornișă + jgheab, racord coș-învelitoare |
| Tâmplărie | racord fereastră-perete (etanșare), glaf |
| Instalații | trecere conductă prin element structural, etanșare |
| Finisaje / interior | racord pardoseală-perete în zonă umedă |

---

## 5. Cine creează seed-ul (conturi + roluri)

- **Upload de detalii e seed-only în v1** → doar conturi admin/seed creează detalii (confirmat).
- 🟦 **DECIZIE EDI:** cine sunt autorii afișați ai detaliilor seed? Variante:
  - **(a)** un singur cont „DETALIA / Editorial" — onest, dar nu arată diversitate de roluri.
  - **(b)** câteva conturi seed cu **roluri reale diferite** (un proiectant, un executant, un furnizor) —
    arată din start că platforma e populată de roluri variate. **Recomandarea mea: (b)**, e mai credibil și
    pune rolul în evidență de la primul scroll.
- Dacă (b): avem nevoie de 3–4 persoane reale dispuse să figureze ca autori (sau personae cu acordul lor).

---

## 6. „Primim pump-ul" — interacțiuni seed (decizie sensibilă)

Un detaliu cu **zero** interacțiuni descurajează prima poziție (efectul „sala goală"). Opțiuni:

- 🟦 **DECIZIE EDI:** punem **câteva validări/comentarii seed autentice** pe 2–3 detalii (de la oamenii noștri
  reali, cu rolul lor real), ca să arătăm *cum arată o dezbatere bună* și să spargem gheața?
  - **Pro:** modelează comportamentul dorit, reduce frica de a fi primul.
  - **Contra / linie roșie:** **doar interacțiuni reale, semnate cu rol real.** Niciodată poziții false /
    conturi-fantomă care simulează dezbatere — ar distruge exact încrederea pe care o vindem. Transparența
    rolului e inima produsului; o falsificare aici e fatală.
- Recomandarea mea: **da, dar minimal și 100% autentic** — 1–2 poziții reale pe câteva detalii, ca exemplu viu,
  nu dezbateri fabricate.

---

## 7. Schițe seed (opțional, dar puternic)

Schițarea e feature obligatoriu în MVP. Un **teanc cu 1–2 schițe reale** pe un detaliu polarizant arată
instant la ce folosește unealta („cineva a propus o soluție alternativă, desenată peste"). 🟦 **DECIZIE EDI:**
pregătim 1–2 schițe seed pe cel mai discutabil detaliu, ca demonstrație vie a fluxului fork→PR?

---

## 8. Lista de invitați (cine intră în beta)

- Beta închis: 🟦 **DECIZIE EDI** — lista de **50–100 de oameni cunoscuți**, echilibrată pe roluri
  (nu doar proiectanți — altfel nu testăm dezbaterea inter-rol). Ideal: un mix proiectant / executant /
  furnizor / beneficiar.
- Notă: mecanismul exact de acces (invitație vs. deschidere) e încă **ÎN HOLD** (vezi `ARHITECTURA.md §3`) —
  dar **lista de oameni** se poate pregăti oricum, indiferent de mecanism.

---

## 9. Metrici de validare (cum știm că premisa s-a confirmat)

Definim succesul *înainte* de lansare, ca să nu raționalizăm după:

- **Semnal primar:** ≥ 1 detaliu cu **poziții divergente între roluri diferite** + justificări reale.
- **Adâncime:** dezbatere care trece de o singură rundă (cineva răspunde la o dezaprobare).
- **Schiță:** cel puțin o schiță propusă și acceptată (fork→PR funcționează social, nu doar tehnic).
- **Verificare „pull":** cel puțin câțiva useri vin **singuri** să-și verifice rolul (validează ipoteza
  „pull, nu push").
- 🟦 **DECIZIE EDI:** praguri numerice concrete + orizont de timp (ex. „în 2 săptămâni").

---

## 10. Rezumat — ce trebuie de la Edi ca să putem produce seed-ul

1. Câte detalii (recomand 10–15) + confirmarea criteriului „polarizant pe rol".
2. Taxonomia finală de categorii (deja deschisă) — ca să distribuim detaliile.
3. Autorii seed: cont editorial unic vs. conturi cu roluri reale diferite (recomand al doilea).
4. Acord pentru interacțiuni/schițe seed **autentice** (fără falsuri) ca pump inițial.
5. Lista de invitați echilibrată pe roluri.
6. Pragurile de succes + orizontul de timp pentru validare.
