# DETALIA — Registry de pattern-uri UI

> Scop: înainte de a construi UI nou, verifică aici dacă pattern-ul există deja — nu reinventa un
> modal/card/pastilă cu stil ușor diferit. După ce adaugi o componentă/pattern nou reutilizabil,
> adaugă-l aici (o secțiune scurtă, nu un roman). Codul e sursa de adevăr; acest fișier e index +
> convenție, nu duplicare de CSS.
>
> Tokenii de culoare/radius/font sunt definiți o singură dată în `app/globals.css` (`@theme`) — NU se
> repetă aici. Acest fișier documentează **compoziția** (cum se combină tokenii într-un pattern), nu
> valorile brute.

## Cum se folosește
- **Înainte de UI nou:** caută mai jos dacă pattern-ul (modal, card, pastilă, buton de pericol etc.)
  există deja — copiază structura/clasele, nu inventa una nouă „similară".
  Regula existentă rămâne: nu adaug elemente noi doar „ca să arate complet" — dacă pattern-ul de mai
  jos nu acoperă cazul, întreabă înainte de a inventa unul nou (vezi `CLAUDE.md` §„Nu iau decizii de
  design/UI singur").
- **După UI nou reutilizabil:** adaugă o secțiune scurtă (10-15 linii) — nu documentezi orice `<div>`,
  doar pattern-uri care s-ar putea repeta (modal, card de listă, badge, stare goală/eroare).

---

## Modal / Dialog de confirmare

**Componentă canonică:** [`components/confirm-dialog.tsx`](../components/confirm-dialog.tsx).

Structură: overlay full-screen (`fixed inset-0 z-50 flex items-center justify-center bg-black/50`,
click pe overlay = cancel, `stopPropagation` pe panou) + panou (`w-full max-w-sm rounded-xl border
border-border bg-card p-5`) + `role="dialog" aria-modal="true"` + `Escape` = cancel (via `useEffect` pe
`keydown`).

**NU folosi `window.confirm()` nativ** — inconsecvent vizual (lecție 2026-07-16, vezi comentariul din
`confirm-dialog.tsx`).

**Componentă canonică pentru panouri centrate (nu lightbox-uri):**
[`components/dialog-overlay.tsx`](../components/dialog-overlay.tsx) — extrage backdrop + Escape-to-
close + wrapper `role="dialog" aria-modal="true"`, lăsând `panelClassName`/`children` complet la
latitudinea apelantului (nu impune stil vizual, doar structura+comportamentul comune). Folosit de
`InviteMembersButton` și `AddContentModal` (`app/(app)/projects/[id]/`) — extras 2026-08-16 din 2
implementări identice caracter cu caracter (QODO, 2026-08-11).

**Divergență rămasă (de reconciliat, nu de rezolvat acum):** același `role="dialog"` + `aria-modal="true"`
e încă reimplementat manual, cu markup diferit, în: `intro-splash.tsx`, `profile-view.tsx`,
`send-to-canvas-modal.tsx`, `app/(app)/details/[id]/comment-likers-modal.tsx`,
`app/(app)/details/[id]/resource-image.tsx`, și lightbox-ul din
`app/(app)/projects/[id]/content-grid.tsx` (`CanvasShareTile`) — familie structurală DIFERITĂ (un
singur div full-screen, backdrop+conținut combinate, fără panou separat) de `DialogOverlay`, nu
aceeași duplicare, consolidarea lor ar fi o abstracție forțată. Un modal-panou NOU folosește
`DialogOverlay`; un lightbox nou urmează tiparul din `resource-image.tsx`. Gap-ul de accesibilitate
(QODO 2026-08-11: `aria-modal` lipsă + fără Escape-to-close) — ÎNCHIS 2026-08-16 peste tot, toate au
acum ambele; ce rămâne e doar markup duplicat pe familia de lightbox, nu absent funcțional.

## Card de conținut

Pattern: `rounded-xl border border-border bg-card p-5` (± padding, vezi variații reale în cele ~10
locuri care îl folosesc). Radius `xl` + `border-border` + `bg-card` e combo-ul standard pentru orice
suprafață ridicată (card, panou de modal, panou lateral) — nu inventa alt radius/border pentru o
suprafață nouă de același nivel.

## Buton de pericol (acțiune distructivă)

`rounded-lg border border-destructive bg-destructive px-3.5 py-2 text-sm font-semibold text-white
hover:bg-destructive/90` — vezi butonul „Șterge" din `confirm-dialog.tsx`. Butonul de anulare/neutru
alături: `rounded-lg border border-border px-3.5 py-2 text-sm font-semibold text-foreground
hover:bg-secondary`.

## Pastilă de rol (`RolePill`)

**Componentă canonică:** [`components/role-pill.tsx`](../components/role-pill.tsx).

Culorile per rol (`PROIECTANT`/`EXECUTANT`/`FURNIZOR`/`BENEFICIAR`) sunt **inline, nu tokeni shadcn** —
decizie deliberată (marker specific de rol, nu culoare de sistem), documentată în comentariul
fișierului. Orice badge nou de „categorie/status colorat" ar trebui să urmeze același model (map
`Record<Enum, {bg, fg}>`), nu culori hardcodate ad-hoc în JSX.

## Buton „Vezi mai multe" (liste tăiate)

**Componentă canonică:** [`components/show-more-button.tsx`](../components/show-more-button.tsx).

Pentru orice listă care ar putea crește nelimitat (validatori, detalii/schițe/activitate pe profil):
afișează primele N (constantă locală, ex. `TAB_PAGE_SIZE`/`VISIBLE_POSITIONS`), plus `ShowMoreButton`
care comută `expanded` la `true` — client-side, fără paginare reală pe server (potrivit doar pentru
liste mărginite realist, nu pentru mii de rânduri). Nu construi un alt „Vezi mai multe" ad-hoc.

## Primitive shadcn disponibile

`components/ui/`: `button.tsx`, `card.tsx`, `input.tsx`, `label.tsx`, `skeleton.tsx`, `textarea.tsx`.
Set minimal — dacă ai nevoie de `dialog`/`dropdown-menu`/`select` etc., verifică întâi dacă chiar
lipsește (`npx shadcn add ...`) înainte de a construi manual echivalentul (parte din motivul pentru
care modalul e reimplementat de 9 ori mai sus — nu există un `<Dialog>` shadcn instalat încă).

---

## Badge-uri de profil (`BadgePill`)
`components/profile-view.tsx` — pill Bronz/Argint/Aur, calculate LIVE (fără DB nouă) de
`server/domain/badges.ts` (`computeBadges`), pe praguri fixe din statisticile deja afișate în profil
(detalii publicate, schițe, validări date/primite, zile active/an din heatmap). Prag nou/badge nou →
editează `BADGE_DEFS` în `badges.ts`, testat de `badges.test.ts`.

## Tur ghidat (`ProductTour` / `DetailProductTour`)
Pattern comun (driver.js, restilizat pe paletă — `.detalia-tour-popover` în `globals.css`), DOUĂ
instanțe cu declanșare DIFERITĂ după cum arată punctul de intrare al paginii:
- **Feed** (`components/product-tour.tsx`) — declanșat o singură dată, prin `?tour=1` în URL (NU un
  flag persistat), setat exact la finalul onboarding-ului (`app/onboarding/actions.ts`) — un singur
  punct de intrare posibil, deci URL-ul e suficient. Efectul curăță `?tour=1` din URL la pornire
  (`router.replace`), fără reload.
- **Detaliu** (`components/detail-product-tour.tsx`) — declanșat de un flag persistat pe user
  (`users.seen_detail_tour`), NU URL — pagina de detaliu se deschide din zeci de locuri (feed, profil,
  @mention, link direct), fără un singur punct de intrare de agățat un query param. Rulează o singură
  dată, la prima pagină de detaliu deschisă vreodată; marcată prin `confirmDetailTourSeenAction`.
- **Ambele**: țintele sunt atribute `data-tour="..."` puse pe elementele reale de UI (nu wrapper-e
  noi) — adaugă un pas nou punând `data-tour` pe elementul existent + o intrare în `TOUR_STEPS`
  (feed) / `DETAIL_TOUR_STEPS` (`lib/detail-tour-steps.ts`), verificate de `product-tour.test.ts` /
  `lib/detail-tour-steps.test.ts` (selectori reali, fără duplicate).
- **BUG găsit 2026-08-17, aplicabil la ambele:** dacă efectul care pornește turul depinde direct de
  prop-ul de activare (`active`/`seen`), un re-render care schimbă acel prop (ex. `router.replace`
  care re-randează Server Component-ul părinte) rulează cleanup-ul efectului (`tour.destroy()`) —
  turul se închide instant, la o secundă de la primul pas. Fix, în AMBELE componente: prop-ul se
  capturează O SINGURĂ DATĂ cu `useState` la mount (`shouldRun`), iar efectul depinde DOAR de acel
  snapshot, nu de prop-ul live.

---

## Neacoperit încă (adaugă pe măsură ce apare)
Stări goale/loading/eroare, tabele, dropdown/meniu contextual, tabs, toast/notificare inline.
