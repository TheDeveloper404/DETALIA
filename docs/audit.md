# Audit de aliniere frontend–backend

**Data auditului:** 24 iunie 2026  
**Tip:** audit static al integrării funcționale  
**Verdict:** frontendul și backendul nu sunt încă aliniate complet.

Fluxurile principale sunt conectate, însă există promisiuni vizibile în interfață care nu au un flux backend complet sau nu execută acțiunea sugerată utilizatorului. În forma actuală, aplicația nu poate susține afirmația că fiecare control din frontend reflectă corect comportamentul backendului.

## Domeniul auditului

Au fost verificate rutele de producție, server actions, serviciile, repository-urile, regulile de domeniu, schema bazei de date și logica de autentificare/autorizare existente în repository.

Prin „audit complet” se înțelege acoperirea statică a suprafeței funcționale existente în cod la data de mai sus. Nu este un audit de securitate exhaustiv și nici un audit comportamental end-to-end în browser. Acoperirea comportamentală automată lipsește, deoarece proiectul nu conține teste, iar comanda `npm test` nu poate porni: scriptul folosește Vitest, dar pachetul `vitest` nu este instalat.

## Rezumat

| Severitate | Număr | Constatări |
|---|---:|---|
| Ridicată | 2 | verificarea rolului este fără ieșire; profilul autorului deschide utilizatorul greșit |
| Medie | 6 | filtrare categorie, controale de validare din feed, reluare ciorne, onboarding parțial, concurență acceptare/respingere, validare URL |
| Redusă | 1 | snapshoturile istorice de rol sunt salvate, dar ignorate la afișare |

## Severitate ridicată

### 1. Verificarea rolului este un flux fără ieșire

Butonul de verificare salvează dovada și schimbă statusul rolului în `PENDING`. Interfața îi spune utilizatorului că solicitarea va fi evaluată și că va primi un răspuns.

Nu există însă o acțiune, un serviciu, o metodă de repository sau o interfață administrativă care să poată trece solicitarea în `VERIFIED` ori `REJECTED`. Nu există nici un tip sau flux de notificare pentru rezultatul verificării. Tipurile de notificare implementate acoperă doar schițele.

**Impact:** orice rol trimis spre verificare rămâne permanent în `PENDING`, cu excepția unei intervenții directe în baza de date sau a schimbării revendicării de rol. Promisiunea „Te anunțăm când e gata” nu poate fi îndeplinită de aplicație.

**Dovezi:**

- `server/services/roleService.ts:100-127` — acceptă cererea și setează `PENDING`;
- `server/repos/rolesRepo.ts:42-47` — există doar operația `setRoleVerificationPending`;
- `app/profile/profile-forms.tsx:143-181` — UI-ul promite evaluare și răspuns;
- `server/repos/notificationsRepo.ts:7` — notificările definite sunt exclusiv pentru schițe.

**Criteriu minim de remediere:** trebuie să existe un flux autorizat de review care face tranziția atomică `PENDING → VERIFIED | REJECTED`, păstrează rezultatul evaluării și notifică utilizatorul.

### 2. „Vezi profilul” deschide persoana greșită

Pe pagina unui detaliu, butonul autorului trimite întotdeauna la `/profile`. Acea rută încarcă profilul utilizatorului autentificat din sesiune, nu profilul autorului detaliului. Nu există o rută publică de forma `/profile/[userId]`.

În plus, datele colectate în onboarding nu sunt reprezentate complet într-un profil real. `headline`, `location`, `website` și `coverImage` sunt salvate, iar formularul promite că headline-ul apare în profil, dar query-ul paginii `/profile` citește doar `name`, `email` și `image`. Pagina curentă este în esență o pagină privată de setări, nu un profil public.

**Impact:** utilizatorul care încearcă să vadă autorul unui detaliu ajunge la propriile setări. Informațiile publice promise în onboarding nu au o suprafață completă de afișare.

**Dovezi:**

- `app/details/[id]/page.tsx:251-284` — cardul afișează autorul, dar linkul este fix `/profile`;
- `app/profile/page.tsx:15-24` — profilul este încărcat folosind ID-ul din sesiune;
- `server/repos/usersRepo.ts:33-40` — query-ul profilului selectează numai nume, email și avatar;
- `app/onboarding/onboarding-form.tsx:264` — headline-ul este prezentat ca informație de profil;
- `app/onboarding/actions.ts:100-120` — câmpurile extinse și imaginile sunt salvate.

**Criteriu minim de remediere:** separarea paginii private de setări de un profil public adresabil prin ID sau slug și afișarea controlată a câmpurilor publice colectate la onboarding.

## Severitate medie

### 3. Linkurile de categorie din detalii nu filtrează feedul

Pagina detaliului construiește un URL de forma `?category=<slug>`. Feedul citește exclusiv parametrul `cat` și îl validează ca UUID de categorie.

**Impact:** clickul pe categoria unui detaliu deschide feedul nefiltrat.

**Dovezi:**

- `app/details/[id]/page.tsx:89-97` — generează `?category=<slug>`;
- `app/feed/page.tsx:16-33` — citește `cat` și îl compară cu `category.id`.

**Criteriu minim de remediere:** ambele capete trebuie să folosească același nume de parametru și același identificator: fie UUID, fie slug rezolvat explicit.

### 4. Controalele „Aprob” și „Dezaprob” din feed nu execută acele acțiuni

Ambele controale sunt linkuri obișnuite spre pagina detaliului. Clickul pe „Aprob” nu înregistrează o aprobare, iar clickul pe „Dezaprob” nu deschide direct fluxul de justificare. Comentariul din cod recunoaște că validarea nu se face inline, însă etichetele și stilul controalelor promit mutații.

**Impact:** comportamentul real contrazice limbajul interfeței și poate induce utilizatorul în eroare cu privire la înregistrarea votului său.

**Dovezi:**

- `components/detail-card.tsx:4-6` — codul declară explicit că acțiunile nu se fac în feed;
- `components/detail-card.tsx:83-96` — ambele controale sunt `Link` către același `href`.

**Criteriu minim de remediere:** fie controalele execută acțiunile declarate, cu justificare obligatorie pentru dezaprobare, fie sunt redenumite ca navigare neutră, de exemplu „Vezi și validează”.

### 5. Ciornele de schiță salvate nu pot fi reluate realist

Editorul confirmă „Ciornă salvată — o reiei oricând”, iar backendul păstrează schița cu status `DRAFT`. Nu există însă o pagină care să listeze ciornele utilizatorului și nici o cale de navigare înapoi către o ciornă salvată. „Renunță” revine la detaliu fără să ofere acces ulterior la draft.

**Impact:** o ciornă poate fi reluată numai dacă utilizatorul păstrează manual URL-ul exact al editorului.

**Dovezi:**

- `app/sketches/[id]/edit/sketch-editor.tsx:81-87` — „Renunță” navighează la detaliu;
- `app/sketches/[id]/edit/sketch-editor.tsx:149-154` — mesajul promite reluarea oricând;
- `server/services/sketchService.ts:155-178` — există logica de creare și încărcare a draftului, dar nu o listare pentru utilizator;
- structura rutelor `app/` — nu există o rută de listare a ciornelor.

**Criteriu minim de remediere:** o listă „Ciornele mele” sau un punct de reluare contextual care enumeră drafturile deținute de utilizator și deschide editorul aferent.

### 6. Onboardingul poate lăsa un profil permanent parțial

Acțiunea creează rolul înainte de actualizarea profilului și fără tranzacție comună. Dacă actualizarea profilului eșuează după crearea rolului, următoarea accesare a onboardingului detectează rolul existent și redirecționează direct în feed.

Uploadurile pentru avatar și copertă sunt tratate „best effort”: dacă uploadul eșuează, eroarea este ignorată și utilizatorul este redirecționat în feed fără informare.

**Impact:** utilizatorul poate rămâne cu rol creat, dar profil incomplet, fără posibilitatea de a relua onboardingul. Poate crede și că imaginile au fost salvate când ele au eșuat.

**Dovezi:**

- `app/onboarding/actions.ts:94-108` — rolul este creat înaintea profilului;
- `app/onboarding/actions.ts:110-125` — eșecurile de upload sunt ignorate, apoi se face redirect;
- `app/onboarding/page.tsx:13-16` — existența rolului este singurul criteriu pentru a considera onboardingul încheiat.

**Criteriu minim de remediere:** profilul și rolul trebuie salvate atomic sau trebuie introdus un marker explicit de onboarding complet; erorile de upload trebuie raportate ori prezentate clar ca operații opționale nesalvate.

### 7. Tranzițiile de acceptare/respingere a schițelor sunt vulnerabile la concurență

Serviciul citește schița, verifică dacă este `PENDING_ACCEPTANCE`, apoi execută separat un update necondiționat după ID. Două requesturi concurente pot citi ambele statusul `PENDING_ACCEPTANCE` și pot scrie ulterior rezultate opuse. Ultima scriere câștigă, iar ambele fluxuri pot emite notificări contradictorii.

**Impact:** aceeași schiță poate fi raportată ca acceptată și respinsă, iar starea finală depinde de ordinea de execuție a requesturilor.

**Dovezi:**

- `server/services/sketchService.ts:117-141` — verificarea și actualizarea sunt operații separate;
- `server/repos/sketchesRepo.ts:34-45` — updateul filtrează numai după ID, nu și după statusul inițial.

**Criteriu minim de remediere:** tranziția trebuie făcută prin update condiționat `WHERE id = ? AND status = 'PENDING_ACCEPTANCE'`, verificând numărul de rânduri afectate, ideal în aceeași tranzacție cu efectele secundare persistente.

### 8. URL-urile resurselor nu sunt validate ca HTTP/HTTPS

Validarea server-side verifică doar existența unui string nenul pentru resursele `IMAGE`, `LINK` și `PDF`. Valoarea este apoi folosită direct în atributul `href` al unui link.

**Impact:** pot fi stocate scheme nedorite sau periculoase în loc de URL-uri web valide. `rel="noopener noreferrer"` protejează relația cu fereastra nouă, dar nu validează schema URL-ului.

**Dovezi:**

- `server/domain/detail.ts:86-98` — URL-ul este doar curățat și verificat ca nenul;
- `app/details/[id]/page.tsx:189-209` — valoarea stocată este folosită direct ca `href`.

**Criteriu minim de remediere:** parsare server-side cu `new URL(...)` și allowlist strict pentru protocoalele `http:` și `https:` înainte de persistare.

## Severitate redusă

### 9. Snapshoturile istorice de rol sunt salvate, dar ignorate

La fiecare aprobare sau dezaprobare este salvat `roleSnapshot`, inclusiv rolul, subrolul și starea verificării din acel moment. Query-ul de afișare nu citește snapshotul; face join cu rolul curent al utilizatorului.

**Impact:** schimbarea ulterioară a rolului sau a stării de verificare rescrie retrospectiv felul în care apar validările vechi. Istoricul afișat nu mai reprezintă contextul în care a fost exprimată poziția.

**Dovezi:**

- `server/services/validationService.ts:43-52,67-73,101-107` — construiește și salvează snapshotul;
- `server/repos/validationsRepo.ts:29-48` — persistă `roleSnapshot`;
- `server/repos/validationsRepo.ts:69-86` — afișarea citește rolul curent din join și nu selectează snapshotul.

**Criteriu minim de remediere:** afișarea validărilor istorice trebuie să folosească `roleSnapshot`, cu fallback documentat la rolul curent numai pentru înregistrările vechi fără snapshot.

## Fluxuri conectate corect

- Publicarea unui detaliu trece prin autentificare, validarea din service și repository-urile de persistență.
- Aprobările, dezaprobările și comentariile pentru detalii și schițe ajung la serviciile backend aferente din pagina de detaliu.
- Justificarea dezaprobării este obligatorie și validată server-side.
- Pozițiile de validare sunt asociate utilizatorului autentificat, nu unui ID furnizat arbitrar de client.
- Accesul la editarea unei schițe și decizia asupra unei propuneri au verificări de proprietate în service.

## Verificări tehnice

- TypeScript: trece la momentul auditului.
- ESLint: trece la momentul auditului.
- Teste comportamentale: nu există fișiere de test în repository.
- `npm test`: eșuează înainte de rularea testelor, deoarece scriptul este `vitest run`, dar `vitest` nu apare în dependențe sau devDependencies.

## Concluzie

Arhitectura de bază este rezonabil separată între UI, actions, servicii, domeniu și repository-uri. Problemele identificate nu sunt însă doar cosmetice: două fluxuri majore sunt incomplete, iar alte controale și mesaje promit comportamente care nu există sau nu sunt fiabile.

Aplicația poate fi descrisă ca având fluxurile nucleu conectate, dar nu ca fiind complet aliniată frontend–backend sau solidă comportamental. Prioritatea recomandată este: finalizarea verificării rolului, introducerea profilului public corect, apoi eliminarea discrepanțelor de navigare/acțiune și întărirea tranzițiilor de stare.

----
  Document                          Verdict
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   docs/ADR.md                       Păstrat, dar ADR-008 (invite-only) și ADR-009 (seed-only) trebuie înlocuite.
  ────────────────────────────────  ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
   docs/API.md                       De arhivat/rescris. Aplicația folosește Server Actions; singurul API route real este Auth.js.
  ────────────────────────────────  ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
   docs/ARHITECTURA.md               Relevant conceptual, dar are multe decizii și stări depășite. Necesită condensare și actualizare.
  ────────────────────────────────  ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
   docs/CHANGELOG.md                 Relevant și actual. Bun ca istoric, nu ca sursă a stării curente.
  ────────────────────────────────  ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
   docs/CONFIDENTIALITATE-GDPR.md    Foarte relevant, dar trebuie actualizat urgent pentru signup public, uploaduri și lipsa ștergerii datelor.
  ────────────────────────────────  ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
   docs/EMAILURI.md                  Relevant doar ca draft de copy. Secțiunea invitației este depășită; trebuie sincronizat cu implementarea reală.
  ────────────────────────────────  ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
   docs/plan nontehnic.md            Puternic depășit: spune beta pe invitație, seed-only și că funcționalități deja implementate „urmează”. Aș rescrie complet sau arhiva.
  ────────────────────────────────  ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
   docs/PLAN-EXECUTIE.md             Majoritatea este istoric duplicat cu CHANGELOG. Aș înlocui cu un plan scurt de production-readiness.
  ────────────────────────────────  ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
   docs/PLAN-SEED.md                 Strategia de conținut rămâne valoroasă. Ipotezele despre beta închis, autori seed și 10–15 vs. 50–100 detalii trebuie actualizate.
  ────────────────────────────────  ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
   docs/PLAN-TESTE.md                Foarte relevant ca intenție, dar scenariile sunt vechi și Vitest nici nu este instalat. Trebuie aliniat la Server Actions și constatările de
                                     securitate.
  ────────────────────────────────  ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
   docs/SCHEMA.md                    Relevant, dar nu mai reflectă complet db/schema.ts; încă spune „pre-scaffold” și omite câmpurile noi de profil.
  ────────────────────────────────  ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
   docs/SECURITATE.md                Cel mai relevant și cel mai actual document. Trebuie păstrat ca sursă activă.
  ────────────────────────────────  ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
   docs/UX-ECRANE.md                 Principiile UX sunt bune, dar rutele și starea implementării sunt aproape integral depășite. Necesită rescriere.

  Problemele recurente sunt:

  - accesul este acum public, nu invite-only;
  - publicarea detaliilor este deschisă utilizatorilor cu rol, nu seed-only;
  - mutațiile folosesc Server Actions, nu contractul REST proiectat;
  - rutele reale sunt /feed, /details/..., /sketches/..., /profile, nu variantele românești documentate;
  - mai multe documente încă declară funcționalități implementate drept „viitoare”.

  Concluzie: toate au valoare istorică, dar numai SECURITATE.md și CHANGELOG.md sunt sănătoase ca documente active. Restul trebuie actualizate, rescrise sau arhivate pentru a nu induce în
  eroare.