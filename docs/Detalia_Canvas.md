# Detalia — Specificație tehnică: PLANȘA (Canvas privat)

**Versiune:** 1.0 — document de lucru (concept inițial, PARȚIAL NEACTUAL)
**Data:** Iulie 2026
**Autor:** Eduard (concept) — pentru Liviu (implementare)
**Statut:** Implementat și live — reconstruit ca **v2** (2026-07-05) cu engine propriu, pe un model diferit
în puncte concrete față de conceptul inițial de mai jos.
**Relație cu restul documentelor:** extinde Specificația MVP v1.0; absoarbe prototipul tehnic al schițării
colaborative cerut în Documentul Fundamental cap. 20.3

> ⚠️ **Sursa de adevăr pentru implementarea curentă = `ARHITECTURA.md §7.7` + `SCHEMA.md` (tabelele
> `canvases`/`canvas_items`) + codul (`components/plansa/`).** Acest document rămâne conceptul original,
> util pentru intenția de UX, dar **diverge pe puncte concrete**:
> - **Canvas FIX (rație 16:10), NU infinit** — „canvas infinit" (§1, §2.4 mai jos) a fost respins explicit
>   ca linie roșie pentru v1.
> - Unelte confirmate: culori + grosimi + radieră + undo/redo (nu linii/săgeți/text/forme, ca în §1).
> - Modelul de date real: `canvases` (owner_id, name, `state` jsonb = items+strokes, thumbnail_url) +
>   `canvas_items` (relația cu detalii/schițe) — vezi `SCHEMA.md`.
> - Strict privat, fără share/public/colaborare/rotație/multi-select — confirmat, neschimbat față de §1.
> Restul documentului (fluxul „Trimite în Planșă", cazul de utilizare fondator) rămâne conceptual valabil.

---

## 1. REZUMAT EXECUTIV

Planșa este un spațiu de lucru privat, per utilizator, de tip canvas infinit, în care utilizatorul:

1. **Adună** detalii de execuție din platformă (din feed, din căutare, din pagina unui detaliu) printr-un buton „Trimite în Planșă".
2. **Aranjează** liber aceste detalii pe suprafața de lucru (mută, scalează, poziționează unul lângă altul).
3. **Schițează** peste ansamblu cu unelte simple de desen (linii, săgeți, text, forme, ștergere) — peste toate detaliile deodată, nu pe fiecare în parte.

**Cazul de utilizare fondator:** compunerea unei secțiuni de perete din detalii disparate — detaliu de fundație + detaliu de tâmplărie + detaliu de cornișă, așezate în relația lor reală, cu schițe de legătură între ele, pentru o imagine de ansamblu.

**La MVP: strict privat.** Nimeni în afară de proprietar nu vede planșele. Fără share, fără publicare, fără colaborare.

**Valoare strategică dublă:**
- Valoare single-player pentru cold start (utilizatorul are motiv să revină chiar și cu comunitate mică).
- Prototipul tehnic al schițării colaborative (Val 2) — validăm engine-ul de canvas, stocarea stării de desen și suprapunerea straturilor pe date reale, înainte de a construi versionarea multi-utilizator.

---

## 2. CONCEPT UX

### 2.1 Entitatea „Planșă"

```
PLANȘĂ
├── Aparține unui singur utilizator (owner)
├── Are un nume dat de utilizator (ex. „Secțiune perete casa mea")
├── Conține N instanțe de detalii (referințe la detalii din platformă)
├── Conține un strat de schiță liberă (desen peste tot ansamblul)
└── Un utilizator poate avea mai multe planșe
```

### 2.2 Punctele de intrare

```
1. „Planșele mele" — secțiune nouă în portofoliu (lângă Create / Apreciate)
   ├── Listă planșe (nume + thumbnail + data ultimei modificări)
   ├── [ + Planșă nouă ]
   └── Click pe planșă → se deschide editorul

2. Butonul „Trimite în Planșă" — prezent pe:
   ├── Cardul detaliului în feed / listă / rezultate căutare
   └── Pagina detaliului (ecranul-vedetă)
```

### 2.3 Fluxul „Trimite în Planșă" (cerință centrală)

```
Utilizatorul vede un detaliu în feed
  → apasă [ Trimite în Planșă ]
  → se deschide un mic popover/modal:
      ├── Lista planșelor existente (nume + mini-thumbnail)
      ├── [ + Creează planșă nouă ] (inline: doar câmp de nume)
      └── selectează planșa → confirmare vizuală discretă
         („Adăugat în «Secțiune perete casa mea»" + link „Deschide planșa")
  → detaliul apare în planșă ca instanță nouă, plasat automat
    într-o zonă liberă a canvas-ului (nu peste elementele existente)
```

Important UX: acțiunea NU navighează utilizatorul afară din feed. Adaugă și rămâi unde ești. Link opțional dacă vrea să sară în planșă.

### 2.4 Editorul de planșă

```
┌────────────────────────────────────────────────────────────┐
│  ‹ Planșele mele    „Secțiune perete casa mea"    [salvat ✓]│
├──────────┬─────────────────────────────────────────────────┤
│ TOOLBAR  │                                                 │
│ ├ Select │        CANVAS INFINIT (pan + zoom)              │
│ ├ Mână   │                                                 │
│ ├ Creion │   ┌──────────┐      ┌──────────┐               │
│ ├ Linie  │   │ Detaliu  │      │ Detaliu  │               │
│ ├ Săgeată│   │ cornișă  │      │ tâmplărie│               │
│ ├ Text   │   └──────────┘      └──────────┘               │
│ ├ Formă  │         ~~~schiță liberă între ele~~~           │
│ └ Radieră│   ┌──────────┐                                  │
│          │   │ Detaliu  │                                  │
│          │   │ fundație │                                  │
│          │   └──────────┘                                  │
└──────────┴─────────────────────────────────────────────────┘
```

Comportamentul instanței de detaliu pe canvas:
```
├── Mutare (drag) și scalare (colțuri) — transformări libere
├── Imaginea afișată = VIZUALIZAREA DE BAZĂ 2D a detaliului
├── Click-dreapta / long-press → meniu contextual:
│   ├── „Deschide detaliul" (link către pagina detaliului, tab nou)
│   ├── „Adu în față / Trimite în spate" (z-order)
│   └── „Elimină de pe planșă" (scoate instanța, nu afectează detaliul)
└── Eticheta discretă cu titlul detaliului + autorul (hover / colț)
```

Schița liberă:
```
├── Se desenează DEASUPRA întregului ansamblu (strat global al planșei)
├── Unelte: creion liber, linie, săgeată, text, dreptunghi/elipsă, radieră
├── Culori: paletă mică (4–6 culori), grosime linie (2–3 trepte)
└── NU există straturi multiple per autor la MVP — un singur strat de schiță
    (straturile per autor+rol = schițarea colaborativă, Val 2)
```

### 2.5 Mobil vs. desktop

Consecvent cu strategia mobile-first din Documentul Fundamental (cap. 13.3):
```
MOBIL:   „Trimite în Planșă" din feed — DA, complet funcțional
         Vizualizare planșă (pan/zoom, read-only sau editare minimă) — DA
         Compoziție și schițare complexă — descurajată, nu blocată
DESKTOP/TABLETĂ: experiența completă de editare
```

---

## 3. DECIZII TEHNICE (cu recomandări)

### 3.1 Engine-ul de canvas — DECIZIA CRITICĂ

**Recomandare: tldraw** (licență de verificat — watermark/licență comercială; alternativă: Excalidraw sau Fabric.js pur).

Motivare:
```
├── Canvas infinit + pan/zoom out-of-the-box
├── Suport nativ pentru imagini ca obiecte pe canvas (drag, resize, rotate)
├── Unelte de desen gata făcute (creion, forme, săgeți, text)
├── Serializare completă a stării în JSON (snapshot al store-ului)
├── React-native-friendly la nivel de web (funcționează în Next.js)
└── Este exact stack-ul pe care îl vom refolosi la schițarea colaborativă
    → Planșa devine prototipul tehnic din Faza 0
```

Dacă tldraw pică pe licență/greutate, ordinea alternativelor: Excalidraw (embed) → Fabric.js (mai mult de construit manual: toolbar, serializare proprie).

### 3.2 Referință vs. snapshot al detaliului

Întrebarea: când adaug un detaliu pe planșă, planșa ține o **copie a imaginii** sau o **referință vie** la detaliu?

**Recomandare: referință vie la detaliu + imaginea servită din storage-ul existent.**

```
├── canvas_item stochează detail_id, NU o copie a fișierului
├── Imaginea de bază se încarcă din Supabase Storage (URL existent)
├── La MVP nu există sistem de versiuni → imaginea de bază e stabilă,
│   deci problema „detaliul s-a schimbat sub mine" practic nu există încă
├── Cazuri limită de tratat:
│   ├── Detaliul e șters de autor → instanța pe planșă afișează
│   │   placeholder „Detaliu indisponibil" (păstrăm poziția, nu crăpăm)
│   └── Detaliul devine „Vizibil doar pentru mine" (al altcuiva)
│       → același placeholder
└── Când vine versionarea (Val 2), adăugăm câmp version_id pe canvas_item
    → planșa „îngheață" pe versiunea adăugată. Modelul e pregătit, nu construit.
```

### 3.3 Stocarea stării planșei

**Recomandare: un document JSON per planșă** (snapshot-ul serializat al store-ului tldraw), plus tabele relaționale minime pentru interogare.

```
├── Starea completă a canvas-ului (poziții, transformări, schițe) = JSONB
│   într-o coloană a tabelei canvases → simplu, un singur write la salvare
├── Tabelă separată canvas_items pentru relația planșă ↔ detalii
│   → ne trebuie relațional pentru: „în ce planșe apare detaliul X",
│     integritate la ștergerea unui detaliu, viitoare features
├── Salvare: autosave cu debounce (ex. la 2–3s după ultima modificare)
└── Fără sync în timp real (nu există colaborare la MVP) → fără WebSocket
```

---

## 4. MODEL DE DATE (Supabase / PostgreSQL)

```sql
-- Planșele
create table canvases (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references profiles(id) on delete cascade,
  name          text not null,
  state         jsonb not null default '{}',  -- snapshot serializat tldraw
  thumbnail_url text,                          -- generat la salvare (opțional v1)
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Relația planșă ↔ detalii/schițe (pentru interogare și integritate)
-- 2026-07-06: `sketch_id` opțional — un item poate fi „detaliu-mamă" (null) SAU „schiță" (imaginea
-- COMPUSĂ, deja randată la publicare — sketches.thumbnailUrl, nu se randează a doua oară). Același
-- detaliu poate apărea de mai multe ori pe o planșă (o dată ca detaliu-mamă + câte o dată per schiță
-- trimisă) → unicitatea NU mai e pe (canvas_id, detail_id) simplu, ci pe doi indecși parțiali.
create table canvas_items (
  id                uuid primary key default gen_random_uuid(),
  canvas_id         uuid not null references canvases(id) on delete cascade,
  detail_id         uuid not null references details(id) on delete cascade,
  sketch_id         uuid references sketches(id) on delete cascade,
  added_at          timestamptz not null default now()
);
create unique index canvas_items_detail_only_uidx on canvas_items (canvas_id, detail_id) where sketch_id is null;
create unique index canvas_items_sketch_uidx on canvas_items (canvas_id, sketch_id) where sketch_id is not null;

-- RLS: STRICT privat la MVP
alter table canvases enable row level security;
create policy "owner only" on canvases
  for all using (auth.uid() = owner_id);

alter table canvas_items enable row level security;
create policy "owner only via canvas" on canvas_items
  for all using (
    exists (select 1 from canvases c
            where c.id = canvas_id and c.owner_id = auth.uid())
  );
```

Note:
- Sursa de adevăr pentru randare = `canvases.state` (JSONB). `canvas_items` e index relațional, sincronizat la add/remove.
- `unique(canvas_id, detail_id)` e propunerea inițială — vezi decizia deschisă 6.3.
- Thumbnail: tldraw poate exporta PNG/SVG al canvas-ului → upload în Storage la salvare. Dacă e scump în v1, listăm planșele fără thumbnail (doar nume + dată) și adăugăm ulterior.

---

## 5. API / OPERAȚIUNI

Cu Supabase, majoritatea merg direct pe client cu RLS. Operațiunile logice:

```
CANVAS CRUD
├── createCanvas(name)                    → insert canvases
├── renameCanvas(id, name)
├── deleteCanvas(id)                      → cascade pe canvas_items
├── listMyCanvases()                      → pentru „Planșele mele" + popover
└── saveCanvasState(id, state)            → autosave debounced (update JSONB)

ITEMS
├── addDetailToCanvas(canvasId, detailId)
│     1. insert canvas_items
│     2. injectează obiectul-imagine în state (client-side, tldraw)
│        cu plasare automată în zonă liberă
└── removeDetailFromCanvas(canvasId, detailId)
      → șterge din canvas_items + din state

INTEGRITATE
└── La randare: pentru fiecare item cu detaliu inaccesibil (șters/privat)
    → placeholder „Detaliu indisponibil", fără crash
```

---

## 6. DECIZII DESCHISE (pentru discuția Eduard ↔ Liviu)

```
6.1 LICENȚA tldraw — verificată înainte de prima linie de cod.
    Dacă nu convine → Excalidraw sau Fabric.js. Liviu evaluează efortul
    comparativ și vine cu recomandare în max. 2-3 zile de research.

6.2 CONVERGENȚA cu decizia din Specificația MVP cap. 3.4 (tool de desen
    la upload, Varianta B): FOLOSIM ACELAȘI ENGINE pentru ambele.
    Un singur engine de desen în toată platforma. Dacă Planșa intră,
    Varianta B devine aproape gratuită (același toolbar, alt context).

6.3 Același detaliu de 2 ori pe aceeași planșă: propunere = NU la v1
    (simplifică integritatea). De confirmat că nu strică un caz real.

6.4 Limită de items per planșă (performanță): propunere ~30 detalii/planșă
    la v1. De validat cu un test de încărcare simplu.

6.5 Thumbnail la listare: în v1 sau amânat? (nice-to-have, nu blocant)

6.6 Export PNG al planșei (tldraw îl dă aproape gratis): îl expunem în v1
    sau îl ținem ascuns? Propunere: DA dacă e sub o zi de muncă —
    utilizatorul își poate printa secțiunea compusă pentru șantier.
```

---

## 7. CE NU INTRĂ ÎN V1 — LINIA ROȘIE

```
× Share / planșă publică / link de vizualizare        → NU. Strict privat.
× Colaborare în timp real pe planșă                    → NU. Asta e Val 2.
× Straturi de schiță per autor + rol                   → NU. Val 2.
× Transformarea planșei într-un detaliu nou publicabil → NU. Deschide
    probleme de IP (cap. 17.3 din Documentul Fundamental) — se decide acolo.
× Versionarea planșei / istoric modificări             → NU.
× Snapping, aliniere inteligentă, grid magnetic        → NU. Drag liber e destul.
× Planșe pe mobil ca experiență de creație completă    → NU. Consum, da.
```

Orice element din lista asta care „ar fi mic de adăugat" se respinge din oficiu. Planșa v1 = adună + aranjează + schițează + rămâi privat. Punct.

---

## 8. EFORT ESTIMAT (ordin de mărime, de calibrat de Liviu)

```
MODUL                                              EFORT ORIENTATIV
──────────────────────────────────────────────────────────────────
Research + decizie engine (6.1)                    ~2–3 zile
Model de date + RLS + CRUD planșe                  ~2–3 zile
Integrare engine canvas + imagini detalii           ~4–6 zile
Buton „Trimite în Planșă" + popover (feed+detaliu) ~2–3 zile
Toolbar schițare (dacă nu vine gratis din engine)  ~1–3 zile
„Planșele mele" în portofoliu + listare             ~2 zile
Placeholder detalii indisponibile + edge cases      ~1–2 zile
Polish + testare                                    ~3–4 zile
──────────────────────────────────────────────────────────────────
TOTAL: ~2,5–3,5 săptămâni de lucru concentrat
```

Nota strategică: din acest efort, integrarea engine-ului (~o săptămână) este muncă pe care oricum o datorăm prototipului de schițare colaborativă din Faza 0. Costul net real al Planșei față de planul existent: ~1,5–2,5 săptămâni.

---

## 9. CRITERIUL DE VALIDARE AL FEATURE-ULUI (beta)

Planșa își justifică locul dacă, în beta-ul închis:
```
├── ≥ 30% dintre utilizatorii activi creează cel puțin o planșă
├── ≥ 15% au o planșă cu ≥ 3 detalii (semnul compoziției reale, nu al testului)
└── Calitativ: cel puțin câțiva utilizatori descriu spontan cazul
    „mi-am compus secțiunea" în feedback
```
Dacă nimeni nu compune, feature-ul rămâne, dar NU primește nicio investiție
suplimentară până după validarea premisei centrale.

---

*Se citește împreună cu Specificația MVP v1.0 și Documentul Fundamental v3.0 (cap. 7 — schițarea colaborativă, cap. 13.2 — componenta tehnică critică, cap. 20.3 — prototipul din Faza 0).*
