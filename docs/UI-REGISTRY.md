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

## Cardul detaliului din feed

`DetailCard` pastreaza formatul existent. La hover cu mouse-ul pe card, imaginea alterneaza la 1,5 secunde intre detaliu si miniaturile schitelor publicate, cronologic. Iesirea cursorului sau o eroare opreste succesiunea si revine la detaliu. Touch si reduced-motion pastreaza imaginea statica. Fara miniaturi disponibile nu porneste temporizatorul; celelalte liste nu primesc preview-uri.
`getFeed` aduce metadatele miniaturilor intr-un singur lot pentru pagina, fara stroke-uri sau request pe fiecare card; nu modifica paginarea. Ciornele, adnotarile, foile ascunse si detaliile de proiect sunt excluse ca in feed.

## Pagina detaliului pe desktop/tableta

`app/(app)/details/[id]/detail-workspace.tsx`: de la 768 px, doua coloane; informatii de 220–300 px in stanga, taburi si imagine in dreapta. Data sta deasupra titlului, aliniata la dreapta; resursele sunt in coloana de informatii.
Titlul de 22 px, descrierea de 14 px si spatierea compacta reduc scroll-ul paginii. Explicatia schitei/adnotarii active sta jos in stanga; fara scroll intern, trunchiere sau inaltime fixa: continutul lung poate extinde pagina.
Taburile, voturile si CTA-ul suprapus „Schiteaza” folosesc componentele existente; meniul unic sta vizual langa voturi. Sub 768 px, structura anterioara ramane. Viewer-ul nu mai are plafon de latime pe desktop/tableta, iar marginea grilei scade la 8 px.

## Zoom in pagina detaliului

Mentiunile de schita din comentarii se afiseaza „Vezi schita - Nume” (cu numerotarea existenta cand este cazul); clickul selecteaza foaia si deruleaza la desen, cu spatiu pentru header. Taburile nu declanseaza aceasta derulare.

`components/detail-image-viewer.tsx`: cadru 4:3 cu imaginea si overlay-urile sub aceeasi transformare. Controalele - / procent (reset) / + stau in dreapta sus, cu tinte de 44 px, fara a intra in editare.
Marire 100–350%, Ctrl+rotita pe desktop, pinch cu doua degete pe touch si drag la marire; la 100%, scroll vertical al paginii. Sursa originala se cere la marire; taburile pastreaza imaginea si zoom-ul montate.
`SketchViewer.resolutionScale` urmareste zoom-ul: rezolutia canvasului creste, dimensiunile CSS raman aceleasi. Exportul PDF fara thumbnail foloseste acelasi viewer peste imaginea de baza, cu rezolutie 3x.
`SketchPrintContent` pastreaza „Salveaza PDF” dezactivat pana cand imaginea de baza si overlay-ul sunt gata; o eroare de incarcare afiseaza mesaj si pastreaza butonul blocat.

## Export PDF din schita

`StackPrintDocument` este comun detaliului si schitei: logo oficial, slogan, titlu, autor detaliu si autori deduplicati, apoi desenul mare si explicatiile foilor capturate. „Export PDF” captureaza aceleasi ID-uri ordonate ca „Schiteaza peste”, in query-ul `stack`; foile inchise nu intra, adnotarea deschisa intra. Desenul se recompune vectorial 3x, fara thumbnail-ul vechi. Fara query, linkul direct al schitei foloseste reteta salvata; detaliul de baza ramane curat.
`SketchPrintContent` actualizeaza data si ora cu `beforeprint` + `flushSync`, in `Europe/Bucharest`, inclusiv la exporturi repetate sau print din browser; `<time>` pastreaza momentul ISO. A4 cu margini de 15mm, linkuri cu etichete scurte; instructiunile cer dezactivarea anteturilor/subsolurilor browserului.

## Resurse compacte si lista validarilor

Pe detaliu, resursele sunt controale scurte PDF / CAD / Link / Imagine, alaturi de eticheta „Resurse”; URL-ul complet ramane in tooltip si numele accesibil al linkului. `resource-image.tsx` deschide acelasi lightbox, fara thumbnail permanent.
`validation-panel.tsx`: numarul dintre sageti deschide „Validari”, cu filtre Aprobari / Dezaprobari, nume, roluri si linkuri de profil; lista nu mai apare sub desen. Modalul foloseste `DialogOverlay` si portal in `document.body`, pentru focus, Escape si suprapunere peste header. Actiunile de vot si datele raman cele existente.

## Filtru multiplu de categorii

`components/category-filter-list.tsx`, comun pentru sidebar desktop si panoul mobil: categoriile selectate au fundalul activ existent si un X de 44 px pentru eliminare individuala, separat de linkul numelui.
Selectia se pastreaza in `cat=id1,id2,...`; „Toate detaliile” elimina selectia de categorii si pastreaza celelalte filtre.

## Lipire imagine in formularul detaliului

`app/(app)/details/new/detail-form.tsx`: de la 640 px, clickul pe zona de upload ii da focus, iar Ctrl+V preia imaginea din clipboard la focus sau hover. „Alege fisier” deschide selectorul clasic; sub 640 px, clickul pe zona continua sa deschida selectorul.
Aceeasi validare, previzualizare si incarcare ca selectia normala; modurile de desenare/adnotare nu preiau paste-ul.

## Utilizatori dupa rol

`components/feed-role-users.tsx`: deasupra postarilor cand este ales Rol autor, inclusiv persoane fara postari. De la 640 px: maximum 6 profiluri in doua coloane; sub 640 px: doar titlu si numar. „Afiseaza” deschide lista completa: text discret, fara chenar, in dreapta jos, cu zona de apasare de minimum 44 px; pe desktop/tableta apare doar peste 6 rezultate.
Modal comun prin `DialogOverlay`, lista cu scroll si linkuri spre profil; avatarul reutilizeaza `AvatarInitials`. Contoarele includ doar detalii publice neanonimizate.

## Taburi de schite pe mobil

`detail-workspace.tsx`: pastila activa (schita sau autorul detaliului) are maximum 190 px sub 640 px: avatar, nume trunchiat cu „…” (link spre profil), rol si „#N”. Langa ea sta cel mult un avatar inactiv; de la doua in sus apare „+N” (`sketch-overflow-menu.tsx`), care deschide pe `DialogOverlay` lista tuturor foilor, cu cea activa bifata. De la 640 px: toate taburile, ca inainte.

## Bara de unelte pe mobil (editor schita)

`components/sketch/sketch-canvas.tsx`: sub 640 px bara are 44 px, o singura coloana, fara etichete, cu toate uneltele la vedere (fara strângere). De la 640 px: 86 px, doua coloane, ca inainte.

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
implementări identice caracter cu caracter (QODO, 2026-08-11). Al treilea consumator: `MaterialOfferModal`
(`app/(app)/details/[id]/material-offer-modal.tsx`, 2026-08-25) — modalul de trimis/editat/retras oferte
de materiale.

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

Pentru listele din pagina care ar putea crește nelimitat (detalii/schițe/activitate pe profil):
afișează primele N (constantă locală, ex. `TAB_PAGE_SIZE`), plus `ShowMoreButton`
care comută `expanded` la `true` — client-side, fără paginare reală pe server (potrivit doar pentru
liste mărginite realist, nu pentru mii de rânduri). Nu construi un alt „Vezi mai multe" ad-hoc.

## Primitive shadcn disponibile

`components/ui/`: `button.tsx`, `card.tsx`, `input.tsx`, `label.tsx`, `skeleton.tsx`, `textarea.tsx`.
CTA cărămiziu aliniat cu landing-ul: `Button variant="technical" size="cta"` — colțuri 2 px,
IBM Plex Mono 13 px majusculă, bordură/hover `--primary-button-border`; 38 px desktop, 44 px mobil.
Folosit de Adaugă, Comentează, Schițează și Invită un prieten. Nu modifica varianta `default` global
pentru o aliniere locală. Stările disabled/pending, focus și props native sunt cele ale `Button`.
Butonul de referral afișează „Invită” sub breakpoint-ul `sm`, cu contorul păstrat; pe desktop
afișează „Invită un prieten”. Numele accesibil rămâne complet și include contorul când există.
Set minimal — dacă ai nevoie de `dialog`/`dropdown-menu`/`select` etc., verifică întâi dacă chiar
lipsește (`npx shadcn add ...`) înainte de a construi manual echivalentul (parte din motivul pentru
care modalul e reimplementat de 9 ori mai sus — nu există un `<Dialog>` shadcn instalat încă).

---

## Badge-uri de profil (`BadgePill`)
`components/profile-view.tsx` — pill Bronz/Argint/Aur cu emoji tematic per tip (`BADGE_EMOJI`),
calculate LIVE (fără DB nouă) de `server/domain/badges.ts` (`computeBadges`), pe praguri fixe din
statisticile deja afișate în profil (detalii publicate, schițe, validări date/primite, zile activ/an
din heatmap, referral, + combinații derivate: `combinedContribution` (min publicări/schițe),
`activityVolume` (sumă)). Scurt experiment cu variantă de card cu iconiță lucide (2026-08-26), respins
— revenit la pill cu emoji. Prag nou/badge nou → editează `BADGE_DEFS` + `BADGE_EMOJI` (profile-view.tsx)
în `badges.ts`, testat de `badges.test.ts`.

## Tur ghidat (`ProductTour` / `DetailProductTour`)

Disponibil de la 768px (tableta/desktop); sub acest prag nu porneste. Pe telefon, vizita la detaliu
nu marcheaza tutorialul drept vazut. Popup-ul „Ce e nou” a fost eliminat (2026-10-27).
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
- **Feed — pași care pot lipsi legitim din DOM**: `categories`, `profile`, `my-content` sunt in sidebar
  (`hidden lg:flex`, ascuns sub 1024px), `feed-first-card` există doar când feed-ul are ≥1 detaliu.
  `getTourSteps({ isDesktop, hasFeedItems })` îi filtrează EXPLICIT înainte de `driver()` — nu te baza
  pe skip-ul silențios, strică numărătoarea „X din N". Orice pas nou pe o țintă condiționată trece
  prin același filtru.
- **BUG găsit 2026-08-17, aplicabil la ambele:** dacă efectul care pornește turul depinde direct de
  prop-ul de activare (`active`/`seen`), un re-render care schimbă acel prop (ex. `router.replace`
  care re-randează Server Component-ul părinte) rulează cleanup-ul efectului (`tour.destroy()`) —
  turul se închide instant, la o secundă de la primul pas. Fix, în AMBELE componente: prop-ul se
  capturează O SINGURĂ DATĂ cu `useState` la mount (`shouldRun`), iar efectul depinde DOAR de acel
  snapshot, nu de prop-ul live.

---

## Paginare stil forum (`FeedPagination`)
**Componentă canonică:** [`app/(app)/feed/feed-pagination.tsx`](../app/(app)/feed/feed-pagination.tsx).

Anterior/Următor + numere (fereastră ±2 din pagina curentă, cu „…" — `feedPageWindow` în
`server/domain/detail.ts`), paginare REALĂ pe server (`?page=`), NU scroll infinit — decizie de produs
2026-08-16 („caracter de comunitate", vezi CONTEXT.md). Diferă de `ShowMoreButton` de mai sus (aia e
expand client-side pe liste mărginite, nu paginare reală). `?page=` peste ultima pagină → redirect la
ultima pagină validă (nu „Niciun rezultat" fals), vezi `feed/page.tsx`. Pentru orice listă nouă care
poate crește nelimitat pe server (nu doar N vizibile din DB), reutilizează acest pattern.

## Suprafețe publice editoriale (landing + auth)

Emailuri: `lib/email.ts` folosește tabele și CSS inline, fonturi de sistem, logo oficial în PNG
(`public/brand/logo-email.png`, export din `public/logo.svg`, URL public fix pe detalia.ro).
Magic link: preview în inbox, titlu și mesaj scurt, un CTA principal, expirarea separat, link de fallback.
Formatul text simplu păstrează aceleași instrucțiuni. Badge-ul/accentul emailului admin rămân distincte.

`components/public-pages/public-pages.module.css` — folosește tokenurile globale fără a le
modifica. Archivo pentru text/titluri, IBM Plex Mono pentru rubrici. Linii fine și spațiere
separă secțiunile; un singur CTA principal per context. Landing-ul este compus în
`landing-page.tsx`, iar `technical-sheet.tsx` combină un desen WebP cu observații HTML semantice.
`BrandLogo` folosește întotdeauna asset-ul oficial, niciodată un wordmark refăcut.
Header + footer public = `PublicHeader` / `PublicFooter` din `public-chrome.tsx` (landing + `/ghid`, NU le
duplica): logo 44 px, fundal crem `--secondary`; header: Ghid | Autentificare (text mono) ·
Creează cont (`primaryLink`) | LinkedIn · GitHub, cu separatoare; footer: slogan sub logo, texte 15 px/600.
Desktop footer: logo + tagline in the left column, links aligned with the logo in the right column.
Landing only: `PublicFooter` accepts a short Romanian `description` below the links, separated
by a fine border (14 px, natural wrapping on narrow screens). Mobile stacks brand, links, description.
`BackToTop` appears after 400 px of
scrolling, fixed bottom-right: 44×44 px, technical 2 px corners, primary colors, accessible label
„Înapoi sus”. Returns smoothly to page coordinates (0, 0), keeping the arrow visible throughout
the ascent; reduced motion uses an instant return. The hidden control is excluded from keyboard navigation.
CTA public = stil „tehnic” (2 px, IBM Plex Mono 13 px majusculă, 38 px); mono mic ≤12 px = 600. `/ghid` = layout de documentație
(`app/ghid/ghid.module.css`: secțiuni · conținut · cuprins).
Sub 1000 px header-ul public = logo + meniu `<details>` (panou compact de maximum 280 px lângă buton,
sub header, cu toată navigația și ținte de atingere de minimum 44 px). Footer: logo stânga, linkuri
dreapta; pe telefon: logo, slogan imediat sub el pe o singură linie, Ghid · Termeni · Confidențialitate ·
Suport, apoi LinkedIn · GitHub. Eticheta scurtă „Termeni” păstrează numele accesibil „Termeni și condiții”. Butonul de trimitere
login/signup = același stil tehnic ca CTA-ul (44 px).

Landing-ul are propriul `landing-experience.module.css`: grid blueprint, secțiuni late (maximum
1640 px, `--landing-max` = `--container-max`, aceeași lățime ca aplicația), ton teracotă închis `#33201a` din landing-ul de pe detalia.ro. Gridul din hero este
mascat radial, nu pe toată suprafața. Banda de beneficii are accent teracotă, intrare succesivă
și hover decorativ (nu controale). Header-ul și stilurile auth nu sunt modificate de aceste ajustări.
`landing-demos.tsx` conține demonstrații locale: detaliu → schiță → argumente, Proiecte/Planșe și
perspective pe roluri. Taburi native cu `aria-selected`, `aria-controls`, focus roving,
săgeți/Home/End; panouri inactive `hidden`. Exemplele sunt marcate ilustrative/fictive.
Secțiunea 03: după taburile de roluri, trei exemple statice explică autorul/meseria (AvatarInitials +
RolePill existente), dezacordul justificat și legătura detaliu–schiță (aceleași imagini din demonstrația
01). Exemplele nu mimează controale; lista devine verticală sub 1000 px.
Intrare discretă o singură dată în hero și la intrarea demonstrațiilor în viewport; fără bucle,
autoplay sau cursor simulat. `prefers-reduced-motion` dezactivează animațiile.
Secțiunea 02 folosește desenul de fundație furnizat de user (`public/landing/foundation-detail.jpg`):
detaliu în Proiecte și a doua foaie în Planșe, fără decuparea desenului.
CTA-ul final păstrează textele și fundalul teracotă; `FinalCtaScene` compune o masă conturată și foi
tehnice în perspectivă (poartă de acces stânga, coamă de acoperiș dreapta; originalele furnizate de user).
„Ai deja cont?” are un spațiu de 12 px sub CTA. Foile se așază succesiv o singură dată la intrarea în viewport și se desfac
discret la hover/focus. Sub 1200 px decorul se mută sub mesaj; sub 600 px foile devin compacte.
Decorul are `aria-hidden` și `pointer-events: none`; CTA-ul rămâne accesibil fără JavaScript.
Reduced motion elimină animațiile și deplasările la hover/focus. Fără librărie nouă de animație.

`AuthShell` — logo + revenire la site, desen ilustrativ pe desktop, formular direct pe
suprafață și linkuri legale/suport. Login/signup/confirmare folosesc un singur `h1`, iar
`AuthForm` păstrează comportamentul passwordless, pending, Turnstile și câmpurile ascunse.
Pe mobil formularul are prioritate; cadrul nu ascunde acțiunea de login.
Login/signup folosesc `presentation="entry" showDrawing={false}`: formular centrat, fără desen și fără
footer, cu același header, stiluri de formular și fundal crem ca înainte. `formOnlyMain` păstrează
lățimea maximă de 420 px a formularului; `#formular` rămâne focusabil prin skip-link.
Varianta `presentation="entry"` cu desen, folosită de `/verify-request`, are DOUĂ fundaluri: stânga
cremul deschis al paginii (`--background`), în gradient spre `--secondary` la margine (fără linie
de despărțire), cu grila din hero-ul landing-ului (`::before`, 34 px, opacitate 0.6, mască radială);
desen în tuș cu cote/racord teracotă; header + coloana formularului — cremul `--secondary`. Header-ul e identic cu cel al landing-ului (aceleași clase
din `landing-experience.module.css`) și NU are footer. `AnimatedAuthDrawing`
construiește în cod un racord schematic 2D de fereastră, fără raster, animat în ciclu lent de
14 s (contur/profil → hașuri → cote → racord, cu pauză în starea completă). CSS separat în
`auth-experience.module.css`; singura stare client controlează pauza/reluarea prin buton nativ
de 44 px, în afara formularului. SVG cu titlu/descriere și ID-uri unice; desenul nu este o
soluție de execuție. Reduced motion afișează direct desenul complet și ascunde controlul redundant.
`/verify-request` folosește `hideDrawingOnMobile`: la ≤760 px banda cu desen și controlul sunt
ascunse, iar mesajul începe direct sub header; desktop-ul păstrează desenul și controlul.
Skip-link sare direct la formular. Intrarea discretă
a elementelor formularului și hover/focus pe email rămân, dezactivate pentru reduced motion.
`/verify` folosește `presentation="centered"`, fără desen; shell-ul implicit păstrează desenul static.

Antet profil (`ProfileView`): sub `sm`, linkul „Editează profil” este în dreapta avatarului,
în zona albă de sub cover, cu target 44 px. La ≥640 px păstrează poziția din rândul numelui.
Este randat în continuare doar pentru proprietarul profilului.

## Suport în aplicație (`components/support/`)

- `SupportDialog` — formularul „Ai nevoie de ajutor?" (pe `DialogOverlay`, portal în `body`, strat
  `z-[70]` ca să apară și peste editoarele full-screen). Trimite prin `submitSupportRequestAction`
  (`app/support-actions.ts`) în Slack; fără sesiune arată emailul de suport.
- `SupportHint` — rândul pus SUB un mesaj de eroare existent: nimic la primul eșec, „Raportează
  problema" de la al doilea, + WhatsApp de la al treilea (`supportLevel`, `lib/support-contact.ts`).
  Randat ca `<span>`, încape într-un `<p role="alert">`. Contorul: `useFailureCount(stareaEșuată)` pentru
  formulare cu `useActionState`/mesaj resetat la null; contor explicit unde eroarea nu se resetează
  (autosave planșă).
- `LoginSupportHint` — doar pe `/login?error=Verification`: TTL-ul linkului + caseta WhatsApp/email de la
  al doilea link eșuat în 24h (localStorage).
- WhatsApp NU apare în meniu; contactele stau în `lib/support-contact.ts` (sursă unică).

## Neacoperit încă (adaugă pe măsură ce apare)

Stări goale/loading/eroare, tabele, dropdown/meniu contextual, tabs, toast/notificare inline.


## Urmarire si filtre avansate
### Preferinte de email
In `/profile/edit`, `EditDetailsForm` are selectul „Emailuri de activitate”: Doar in aplicatie / Interactiuni importante / Rezumat zilnic. Setarea este privata, validata server-side si distincta de bifa digestului saptamanal. Clopotelul si pagina notificarilor afiseaza aprobarile grupate cu numarul actorilor distincti; nu este un contor live al voturilor.

- `components/following-users-button.tsx`: „Persoane urmarite” apare doar pe profilul propriu; deschide `DialogOverlay` prin portal, cu avatar/nume/rol si link la profil. Stari incarcare/gol/eroare cu reincercare; pagini de 20 prin „Vezi mai multe”, fara plafon total. Server Action foloseste exclusiv identitatea din sesiune; nu trimite email/telefon.
- `components/follow-button.tsx`: pe profil, „Urmareste” teracota plin cu `UserPlus`, colturi `rounded-lg`, 44 px; „Anuleaza urmarirea” ramane alb cu hover rosu. In `ProfileView`, rolul sta sub nume, iar urmarirea si „Date de contact” sunt pe acelasi rand, aliniate sus si cu aceeasi inaltime/padding/font, pe mobil/tableta/desktop. Urmarirea categoriilor din feed pastreaza pastila soft.
- `components/feed-filters.tsx`: bara feed-ului (slot-uri `search` + `categoryFilter`) cu butonul „Filtre · N"; panoul (`DialogOverlay`: de jos pe telefon, popover de la `sm`) are „Ce vezi" (Doar ce urmăresc, Așteaptă ajutor), „Autor" (rol), „Locație" (județ). Lucreaza pe o ciorna: se aplica la „Aplică"/„Arată detaliile", Esc/click afara = fara schimbari. Fara rand de chip-uri sub bara (feed-ul nu se misca); filtrele active = numarul de pe buton + starea panoului. Numararea/resetarea in `lib/feed-filters.ts`.
- `components/dialog-overlay.tsx`: focusul intra in panou la deschidere, Tab ramane in dialog, revine pe elementul de dinainte la inchidere; click oriunde in afara panoului (inclusiv header-ul) il inchide.
- **Regula meniuri:** orice meniu dropdown foloseste `components/use-dismiss.ts` (click in afara / Escape → se inchide), nu un backdrop transparent — backdrop-ul ramane sub header (`z-50`) si lasa doua meniuri deschise simultan.
- Export PDF in meniul detaliului (pe tab de schita exporta schita activa) → pagina dedicata fara header/nav din aplicatie; controalele dispar la print. Foloseste dialogul browserului, nu un modal nou.
