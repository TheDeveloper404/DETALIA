# DETALIA — Inventar de ecrane & flow-uri UX (MVP)

> Lista ecranelor + flow-urile cheie + stările obligatorii (empty / loading / error), înainte de a le coda.
> Nu e Figma — e harta funcțională, ca să nu improvizăm ecran cu ecran. Aliniat la `ARHITECTURA.md` + `CLAUDE.md`.
> Regulă (din `ui-ux-review`): fiecare ecran cu date are stări **empty/loading/error** explicite, nu doar „happy path".

---

## Harta ecranelor

```
PUBLIC (neautentificat)
├─ Landing invitație        /invite/[token]      — „Ai fost invitat în DETALIA"
├─ Login (cere email)       /login               — magic link
└─ „Verifică-ți emailul"    /login/sent          — confirmare trimitere magic link

ONBOARDING (autentificat, fără rol declarat)
└─ Declară rolul            /onboarding/rol      — rol principal + subrol → acces imediat

APP (autentificat, zona protejată)
├─ Feed                     /                     — ~20 detalii după interacțiuni, filtre, fără infinite scroll
├─ Detaliu                  /detalii/[id]         — imagine + validare + comentarii + teanc (taburi schițe)
├─ Mod schiță (canvas)      /detalii/[id]/schita  — desen peste detaliul-mamă cu fill slab
├─ Vizualizare schiță       /schite/[id]          — o foaie din teanc + dezbaterea ei (validări+comentarii)
├─ Notificări               /notificari           — in-app (+ email în paralel)
├─ Verificare rol           /verificare-rol       — fluxul „pull": trimite dovezi → PENDING
└─ Profil                   /profil/[id]          — nume + rol + badge (dacă verificat)

ADMIN (rol admin)
├─ Creare detaliu (seed)    /admin/detalii/nou    — upload seed-only v1
├─ Invitații                /admin/invitatii      — emite/lista (poartă acces — ÎN HOLD)
└─ Aprobare verificări      /admin/verificari     — listă PENDING → approve/reject (badge)
```

---

## Flow-uri cheie (cu săgeți)

### A. Acces → cont → primă utilizare
```
/invite/[token] (validă?) ──► /login ──► email magic link ──► click ──► /onboarding/rol
   │ (token invalid/expirat → ecran eroare clar, fără a dezvălui existența)
   └──► declară rol (principal+subrol) ──► ACCES IMEDIAT ──► / (feed)
                                                   │
                                                   └─► banner permanent: „Rolul tău nu e verificat → Verifică"
```

### B. Validare pe un detaliu (inima)
```
/detalii/[id]
   ├─ Aprob ─────────────► 1 click ──► poziție APPROVE (reversibilă)
   └─ Dezaprob ─────────► modal cu justificare OBLIGATORIE
                              ├─ trimite gol ──► blocat (server 422) + mesaj
                              └─ trimite cu text ──► poziție DISAPPROVE + comentariu auto (nume+rol)
```

### C. Schiță (fork → PR)
```
/detalii/[id] ──► „Schițează" ──► /detalii/[id]/schita
   (detaliul-mamă cu FILL SLAB; unelte: culori stridente + 3 grosimi + radieră + undo/redo)
        │ desenează (auto-save strokes_json)
        ▼
   „Trimite" ──► PENDING_ACCEPTANCE ──► Notificare la autorul detaliului-mamă (in-app + email)
        │
        ▼
   Autorul detaliului-mamă: /schite/[id] ──┬─ Acceptă ──► PUBLISHED (intră în teanc + thumbnail) 
                                            └─ Respinge ──► REJECTED (notificare înapoi)
```

### D. Verificare rol („pull, nu push")
```
/ (banner blând) ──► /verificare-rol ──► trimite dovezi (OAR/CUI) ──► PENDING
        ▼                                                                  │
   admin: /admin/verificari ──► Approve ──► VERIFIED ──► BADGE ⭐ lângă rol/avatar
```

---

## Stări obligatorii per ecran (empty / loading / error)

| Ecran | Empty | Loading | Error |
|---|---|---|---|
| Feed | „Niciun detaliu încă" (la lansare nu apare — avem seed) | skeleton de carduri | „Nu am putut încărca feedul. Reîncearcă." |
| Detaliu | n/a (detaliul există sau 404) | skeleton imagine + panouri | 404 dedicat / eroare încărcare |
| Teanc schițe | „Încă nicio schiță. Fii primul care propune o variantă." | skeleton taburi | mesaj eroare |
| Comentarii | „Niciun comentariu. Începe discuția." | skeleton listă | mesaj eroare |
| Mod schiță | pânză goală + hint unelte | — (canvas instant) | „Salvarea a eșuat, reîncercăm" (auto-save) |
| Notificări | „Nicio notificare" | skeleton | mesaj eroare |
| Verificare rol | formular gol | — | validare câmpuri + eroare trimitere |
| Admin liste | „Nimic de procesat" | skeleton tabel | mesaj eroare |

---

## Reguli UX transversale (din decizii)

- **Buton de validare IDENTIC pentru toți** — lângă fiecare poziție/comentariu: **nume + rol** (+ badge dacă verificat).
- **Dezaprob = justificare obligatorie** — UI blochează trimiterea goală, dar adevărul e pe server (422).
- **Rol vizibil permanent** lângă nume, peste tot. Badge ⭐ la verificat (poziția — lângă rol și/sau avatar — TBD la implementare).
- **Feed fără infinite scroll** — caracter de comunitate, nu social media. Paginare clasică dacă e nevoie.
- **Mod schiță = fill slab pe detaliul-mamă** — semnal vizibil că s-a declanșat schițarea.
- **Notificările** apar in-app (clopoțel) și pleacă și pe email în paralel.
- **Verificarea nu blochează nimic** — nudge blând, niciodată gate. Rol neverificat = funcțional 100%.

---

## Responsive & accesibilitate (minim MVP)

- Layout funcțional pe mobil pentru **citit/validat/comentat** (consumul principal). Modul schiță e optimizat
  desktop/tabletă (desenul fin pe telefon e secundar în MVP).
- Contrast suficient, focus vizibil, butoanele de validare cu etichete text (nu doar iconițe), target tap ≥ 44px.
