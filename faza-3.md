# DETALIA - Security correctness review

Data: 2026-10-25. Continuare a Fazelor 1 si 2, cu scop restrans la review static si propuneri de regresie.

Calibrare: HIGH = prejudiciu concret cu preconditii; MEDIUM = comportament incorect cu impact limitat. Clasificarea CRITICAL a taskului descrie suprafata analizata, nu severitatea unei descoperiri.

## Rezultat si limite

Registrul anterior ramane **0 CRITICAL / 3 HIGH / 3 MEDIUM**, fara remedieri observate pe traseele examinate. Nu am identificat un HIGH sau CRITICAL distinct nou. Doua extinderi sustinute static sunt incluse in constatarile existente: metadate ale comentariilor ascunse, la DET-04, si citirea listei de planse cu status de cont vechi, la DET-05. Nu sunt numarate separat.

Au fost citite integral ambele rapoarte, care se afla in acelasi fisier: Faza 1 incepe la `faza-1-2.md:1`, Faza 2 la `faza-1-2.md:255`. Au fost comparate cu sursele si testele permanente actuale, configuratia Vitest/CI si dovezile locale pastrate.

**Executie in aceasta etapa: zero teste, zero cereri HTTP, zero acces la servicii externe, zero scanari active.** Nu s-au citit credentiale, fisiere .env sau date reale. Nu s-au modificat codul aplicatiei, testele, configuratiile sau rapoartele existente. Singurul artefact nou este acest raport.

Cele 952 de teste trecute din 102 fisiere si cele 193 de cazuri suplimentare sunt rezultate **istorice ale Fazei 2**, confirmate ca inregistrari in `.tmp-phase2-existing-unit-results-2026-25-10.json` si `.tmp-detalia-phase2-2026-25-10/summary.json`; nu au fost rerulate acum. `numTotalTestSuites` din JSON nu reprezinta numarul fisierelor; acesta este dat de cele 102 intrari `testResults`.

Statusuri folosite:

- **CONFIRMED (static):** fluxul si conditiile sunt sustinute de sursa; nu implica o reproducere noua.
- **CONFIRMED anterior:** reproducerea apartine Fazelor 1/2, cu limitele lor.
- **INCONCLUSIVE:** lipseste o proba ori o politica explicita.
- **REQUIRES STAGING:** comportamentul depinde de transport/browser/cloud; nu s-a verificat live.

Nu se acorda statut general NOT EXPLOITABLE pe baza unui simplu control gasit in cod. Ipotezele respinse anterior raman limitate la cazurile exercitate atunci.

## Constatari si validari recomandate

### DET-02 - HIGH - Logout si limita absoluta a sesiunii

**Dovezi:** `lib/auth.ts:40-50` declara explicit sesiune fixa de la ultimul login; callback-ul `jwt` de la `lib/auth.ts:94-99` nu verifica un termen absolut sau revocarea. `app/(app)/profile/actions.ts:185-193` face signOut si sterge cookie-ul local. `app/api/auth/[...nextauth]/route.ts:7` expune GET-ul Auth.js, inclusiv session. Sursa instalata `node_modules/@auth/core/lib/actions/session.js:33-51` reincodifica JWT; `node_modules/@auth/core/lib/actions/signout.js:15-28` nu revoca un JWT intr-un registru server-side.

**Status:** CONFIRMED anterior; mecanismul ramane prezent static. Preconditia este detinerea unei copii valide a sesiunii. Nu s-a demonstrat o metoda de furt al cookie-ului. Verificarea ACTIVE de pe traseele care o folosesc continua sa conteze.

**Impact:** copia poate supravietui logout-ului si poate fi reinnoita peste cele sapte zile de la login. Testul `lib/session-config.test.ts:11-13` verifica numai valoarea 604800; nu poate verifica durata efectiva. `app/(app)/profile/actions.test.ts:81-124` verifica apeluri/ordine cu mock-uri, nu invalidarea unui token real.

**Validare propusa:** integrare locala cu Auth.js real, cheie sintetica, transport capturat si ceas controlat: citire de sesiune aproape de ziua 7, apoi acces dupa limita initiala; rezultatul asteptat este refuz. Separat, verifica invalidarea aceleiasi sesiuni la logout si comportamentul unui raspuns de session inceput inainte de logout. Distinge revocarea sesiunii curente de politica tuturor dispozitivelor, care nu trebuie inventata de test.

**Triaj recomandat: BLOCKING.** Decizia apartine lui Liviu; nu s-a aplicat nicio remediere.

### DET-03 - HIGH - Storage public pentru fisiere private

**Dovezi:** `lib/blob-upload.ts:68,88` si `lib/image-processing.ts:113,139` folosesc `access: "public"`. `lib/project-image-proxy.ts:12-18` documenteaza explicit limita: autorizarea proxy-ului nu protejeaza URL-ul brut public. `server/services/projectService.ts:437` foloseste acelasi upload pentru copia unei planse partajate. Ofertele au control de citire la `server/services/materialOfferService.ts:151-155`, dar atasamentele folosesc URL-uri Blob.

**Status:** CONFIRMED (static), pastrat din raportul anterior. Accesul anonim efectiv la obiectele cloud este REQUIRES STAGING. Preconditia este cunoasterea URL-ului, de exemplu prin acces anterior legitim; enumerarea URL-urilor nu este demonstrata.

**Impact:** autorizarea rutei sau retragerea apartenentei nu revoca singura capabilitatea reprezentata de URL. Clasele relevante sunt imaginile originale/procesate, derivatele de schita/plansa, resursele si atasamentele ofertelor.

**Validare propusa:** local, teste permanente pentru ambele handlere de imagine: anonim, SUSPENDED, DELETED, outsider, membru activ si membru eliminat; refuzul nu apeleaza transportul Blob. `lib/project-image-proxy.test.ts:19-43` testeaza helperul si cache-control, nu aceste porti de acces. Ulterior, numai intr-o etapa staging aprobata separat, verifica obiecte sintetice pentru fiecare clasa prin URL direct anonim si prin ruta autorizata, inclusiv dupa revocare. Un mock care returneaza artificial 403 nu dovedeste confidentialitatea store-ului real.

**Triaj recomandat: BLOCKING.**

### DET-01 - HIGH in registrul anterior - Eliminare si reutilizarea invitatiei

**Dovezi:** `server/services/projectService.ts:188-198` accepta invitatia inca valida si face upsert; `:218-223` elimina membrul fara rotirea invitatiei. `server/repos/projectMembersRepo.ts:43-45` reactiveaza randul prin `removedAt: null`. Rotirea explicita exista separat la `server/services/projectService.ts:231-241`.

**Status:** CONFIRMED anterior si sustinut static. Preconditii: cont ACTIVE, link cunoscut si neexpirat, link nerotit, cota disponibila. Impactul anterior demonstrat este acces restaurat la continut creat dupa eliminare.

**Decizie necesara pentru regresie:** codul si `server/services/projectService.test.ts:282-286` permit deliberat realaturarea. Nu exista dovada ca implementarea a incalcat accidental acest test. Trebuie stabilit daca Elimina revoca si invitatia deja detinuta sau doar apartenenta curenta. HIGH este clasificarea pastrata din registrul precedent; acceptarea modelului de link-capabilitate trebuie facuta explicit, nu mascata ca remediere tehnica.

**Validare propusa:** service + DB real in memorie, owner si membru distincti: join, remove, acces refuzat, apoi folosirea invitatiei vechi. Daca politica aprobata cere revocare persistenta, asteapta refuzul reintrarii si zero reactivari in DB. Reinvitarea deliberata printr-o invitatie noua are un test separat. Rotirea, expirarea si folosirea repetata de catre un membru deja activ trebuie testate distinct. Testele mock-uite pentru join/remove nu acopera singure tranzitia completa.

**Triaj recomandat: BLOCKING pentru clarificarea politicii si tratarea riscului.**

### DET-04 - MEDIUM - Contributii ascunse: mutatii si metadate

**Dovezi pentru problema existenta:** `server/services/validationService.ts:55-60,86-93` nu respinge `hiddenAfterRelease`; dupa release, detaliul-parinte nu mai cere apartenenta la proiect. `server/repos/commentsRepo.ts:82-87` nu exclude comentariul ascuns ales drept parinte; acesta este consumat la `server/services/commentService.ts:72`. Votul pe comentarii de la `server/services/commentService.ts:185-194` nu verifica ascunderea comentariului insusi.

**Status:** mutatiile vote/reply sunt CONFIRMED anterior; lipsurile de control raman prezente static. Nu se deduce de aici acces la corpul comentariului ascuns sau la desenul ascuns.

**Extensie CONFIRMED (static), fara numar separat:** `server/repos/commentsRepo.ts:117` returneaza `replyToAuthorName`, iar join-urile de la `:133-134` nu verifica ascunderea comentariului referit. `server/repos/detailsRepo.ts:440-445` ascunde comentariile celorlalti, pastrand comentariile autorului detaliului.

Scenariu normal: Ana este autorul detaliului si scrie radacina; Bogdan raspunde; Ana raspunde reply-ului lui Bogdan. Dupa release, comentariul lui Bogdan este ascuns, dar reply-ul Anei ramane cu numele lui Bogdan si `replyToCommentId`. `app/(app)/details/[id]/comments-section.tsx:206-207` foloseste numele in afisare. Impactul sustinut de cod este expunerea numelui/participarii la discutia privata, nu a corpului ascuns. Nu s-a executat scenariul in acest review.

**Golul de test:** `server/repos/commentsRepo.reply.test.ts:35-53,79-86` contine deja forma Ana/Bogdan/Ana, dar numai pe thread normal si asteapta numele Bogdan. `e2e/sec-2026-08-11.spec.ts:141-193` verifica ascunderea corpurilor/flagurilor, fara aceasta combinatie de metadate si fara mutatii ulterioare pe ID-uri ascunse.

**Validare propusa:** acelasi thread intr-un proiect, release real si citire din repository: corpul lui Bogdan absent, iar reply-ul ramas nu expune numele sau identificatorul comentariului ascuns. Separat: approve/disapprove/comment pe schita ascunsa si reply/vot pe comentariu ascuns sunt refuzate, cu zero schimbari DB. Include controale pozitive pe tinte vizibile. Regula pentru aceste teste se preia din `db/schema.ts:375-378,552-554`.

**Triaj recomandat: BLOCKING in lotul de corectare a regulii de release.**

### DET-05 - MEDIUM - Sesiune veche la citiri prin Server Actions

**Dovezi:** `app/(app)/notifications/actions.ts:14-19` foloseste numai `auth()`, iar `lib/auth.ts:105-109` reflecta statusul JWT vechi. Serviciul de notificari filtreaza apartenenta la proiect, nu statusul ACTIVE al contului.

**Status:** CONFIRMED anterior la frontiera functiei exportate; transportul HTTP este REQUIRES STAGING. Un JWT emis inainte de suspendare si apartenenta inca activa au permis anterior citirea unui titlu privat inserat dupa suspendare. Nu s-a demonstrat acces complet la document.

**Extensie statica, fara numar separat:** `app/(app)/canvases/canvas-list-actions.ts:30-34` foloseste tot numai `auth()` si returneaza ID-urile/numele planselor proprii. Nu este acces la plansele altui cont. Disponibilitatea acestei citiri dupa schimbarea statusului trebuie acoperita de aceeasi matrice de teste; nu a fost reprodusa acum.

**Validare propusa:** identitate JWT ACTIVE si DB in starile ACTIVE / SUSPENDED / DELETED / rand absent. Apeleaza frontierele reale cu DB de test si verifica refuzul si absenta payload-urilor private. Pentru notificari, creeaza mesajul sintetic dupa suspendare. Include teste permanente pentru `requireActiveUserId` si `requireActiveApiUserId`; testele care le mock-uiesc nu probeaza verificarile lor. Pentru picker, verifica absenta listei dupa suspendare. Nu generaliza la autosalvari private deliberate fara o regula de produs: exceptia este documentata la `app/(app)/sketches/[id]/edit/sketch-actions.ts:38-44`.

**Triaj recomandat: BLOCKING pentru citirile care incalca regula suspendarii.**

### DET-06 - MEDIUM - Cote neatomice

**Dovezi:** `server/services/projectService.ts:79-84,194-198` separa numararea de scriere. `server/services/sketchService.ts:208-215` separa plafonul adnotarilor de publicare. Testele permanente `projectService.test.ts:152-155,290-305` verifica limite secventiale cu numaratoare mock-uite.

**Status:** CONFIRMED anterior pentru proiecte, membri si adnotari cu doua operatii controlate. Nu se afirma indisponibilitate, consum nelimitat ori ocolirea izolarii intre conturi.

**Validare propusa:** teste deterministe cu doua entitati distincte, aproape de limita, bariera la citirea numaratorului si verificarea totalului DB dupa finalizare. Asteptat: totalul nu depaseste limita aprobata. Se citeste plafonul curent din cod/configuratia sintetica, fara a copia valoarea divergenta din CONTEXT.md. Pentru partajari, `projectService.ts:424-449` are acelasi tipar; un test separat poate verifica limita, dar extinderea nu este considerata reprodusa in aceasta etapa.

**Triaj recomandat: BACKLOG cu termen**, in lipsa unui impact mai mare demonstrat; ramane necesar pentru respectarea cotelor.

## Integritate la esec: observatii separate, deja prezente in Faza 2

Acestea nu sunt descoperiri noi si nu maresc automat registrul celor sase vulnerabilitati.

- **MEDIUM, defect de integritate la avarie:** `server/services/validationService.ts:161-184` scrie tranzitia DISAPPROVE inaintea justificarii. O eroare la insertul comentariului poate lasa o pozitie fara justificare; retry-ul poate intoarce ALREADY_DISAPPROVED. Faza 2 a demonstrat cazul cu eroare sintetica, fara intrare de client care sa produca fiabil avaria. `server/services/validationService.test.ts:69-88` nu verifica rollback-ul. Test propus: esec controlat al scrierii justificarii, apoi citire DB si retry; invarianta asteptata este nicio pozitie noua fara justificare. Regula: `CONTEXT.md`, sectiunea Validarea pe roluri, si `server/services/validationService.ts:132`. Recomandare BACKLOG cu termen pentru integritate, fara pretentie de atac confirmat.
- **MEDIUM, corectitudine limitata la propriul profil:** `server/services/onboardingService.ts:44-52,82-88` modifica profilul inainte de verificarea rolului existent. Faza 2 a observat ALREADY_HAS_ROLE dupa schimbarea profilului; rolul nu s-a escaladat. Test propus: profil si rol preexistente, onboarding respins, verificarea starii persistate si a efectelor de storage. Nu impune rollback global la toate erorile fara a stabili contractul; pentru reject-ul de business, propunerea este sa nu existe efecte ascunse. Recomandare BACKLOG.

## Plan concret de regresie suplimentara

Testele de mai sus acopera direct constatarile. Urmatoarele completeaza controalele care functioneaza in cod sau cazurile de esec inca neacoperite permanent. Sunt propuneri, nu fisiere implementate sau executii promise implicit.

| Prioritate | Frontiera si probe permanente existente | Test propus si rezultat asteptat |
|---|---|---|
| P1 | Auth.js magic link; `app/auth-actions.test.ts:49` mock-uieste signIn | Adapter si Auth.js reale cu DB in memorie: expirare, reutilizare, email nepotrivit, suspendare intre emitere si callback. Refuz, fara sesiune noua. Control pozitiv pentru token valid. |
| P1 | Pending/full admin; `server/repos/adminsRepo.pending-totp.test.ts:21-45` testeaza dovada, sesiunea, expirarea si consumul secvential | Promovare fara dovada sau cu dovada din alta sesiune refuzata; la doua consumari, una singura reuseste. Test permanent separat pentru TOTP/cod de rezerva cu un singur consum acceptat. |
| P1 | Sesiuni admin; `lib/admin-auth.ts:95-107` | Dupa logout, randul sesiunii nu mai autorizeaza; dupa scoaterea din allowlist, sesiunea nu mai autorizeaza. Teste cu repository real, nu doar requireAdmin mock-uit. Nu presupune revocarea tuturor sesiunilor la un singur logout. |
| P1 | Release; `detailService.release.test.ts:12-20,45-50` mock-uieste repo, E2E existent acopera succesul | Eroare controlata intr-un pas al batch-ului local: nu ramane detaliu public cu contributiile altora vizibile. Verifica toate tabelele afectate. Echivalenta cu Neon se verifica separat, fara a o presupune din PGlite. |
| P1 | Refuzuri cross-user; `e2e/security.spec.ts:19-209` are verificari service/DB pentru comentarii, schite, planse si ciorne | Muta in regresii locale permanente matricea actor/resursa pentru fiecare operatie relevanta: owner, outsider, membru alt proiect, membru eliminat. Refuzul trebuie sa lase documentul, indexul si relatiile DB neschimbate. Pastreaza control pozitiv. |
| P2 | Planse; `plansaService.test.ts:36-144` verifica accesul la proiect si filtrarea la reload | Schita ascunsa la release: add refuzat si imagine/titlu absente la reload. Completeaza ownership la rename/delete/duplicate/save document/save thumbnail cu DB real; nu considera proiectul Playwright security drept proba HTTP. |
| P2 | Stergere cont; `accountService.test.ts:55-78` verifica succesul si ordinea cu mock-uri | Erori la transfer/anonimizare/curatare auth: verifica statusul si accesul efectiv ramas, datele persistate si reluarea. Nu presupune rollback global pentru pasii secventiali din `accountService.ts:39-50`. Un cont DELETED nu trebuie reactivat prin setUserStatus. |
| P2 | Oferte; `materialOfferService.test.ts:65-155` acopera rol, publicitate si namespace | Citire de catre owner vs alt user/furnizor, cu repository real; clientul nu poate schimba supplierId/offerId prin filesJson. Eroare la inlocuirea fisierelor nu trebuie sa stearga blob-uri inca referite sau sa raporteze o salvare completa falsa. Verifica DB si apelurile de cleanup separat. |
| P2 | Imagine editata; observatia Fazei 2, `app/(app)/details/[id]/edit/actions.ts:97,193-196` | URL nou propriu cu imageChanged fals: valida continutul conform regulii de procesare server, independent de flag. Regresie la action cu transport sintetic. Nu eticheta cazul XSS/RCE fara dovezi suplimentare. |
| P2 | Autosalvare vs publish; `sketchService.ts:132-147`, `sketchesRepo.ts:136,161` | Save inceput ca DRAFT si finalizat dupa publish: verifica daca o salvare stale poate schimba continutul publicat. INCONCLUSIVE pana la test; nu este finding nou. |

La implementarea ulterioara a testelor, regula de business/autorizare se citeaza verbatim in comentariu deasupra fiecarui scenariu, din sursa indicata, conform `AGENTS.md`. Se verifica documentatia/sursa versiunii de framework inainte de asertiuni despre status HTTP, redirect sau streaming. Nu se deduce un cod HTTP din simplul apel al unui service.

Testele locale propuse folosesc date sintetice, DB in memorie si transport extern blocat. E2E-urile viitoare sunt pentru Preview aprobat, rulate de Liviu conform regulilor proiectului, nu localhost sau productie. Niciun astfel de E2E nu a fost lansat acum.

## Ce este deja acoperit si nu trebuie raportat drept lipsa

- `server/repos/project-visibility.test.ts:93-124` verifica feed, autori, profil, statistici si heatmap cu SQL real.
- Acelasi fisier acopera deja salvatele/ofertele unui membru eliminat la `:187-193`, teaserul public la `:244-249` si ascunderea titlului in notificari dupa eliminare la `:305-312`. Lista veche de limite din `.claude/rules/backend.md` este incompleta fata de testele actuale.
- `plansaService.ts:160-184,275-295` respinge/filtreaza resurse private inaccesibile si schite ascunse. Acesta este un control prezent; lipsa testului pentru o combinatie nu inseamna lipsa controlului.
- `sketchService.ts:194-198` reverifica apartenenta la publicare; publicarea din `sketchesRepo.ts:161` este conditionata de autor si DRAFT.
- `materialOfferService.ts:50-60,84-85,151-155` verifica rolul, tinta publica, namespace-ul fisierului si cititorul ofertelor. `app/(app)/details/[id]/material-offer-actions.ts:47-51` selecteaza explicit campurile filesJson.
- `lib/require-active-user.ts:19-44`, `lib/require-active-api-user.ts:15-39` si `proxy.ts:181-206` reverifica statusul din DB. DET-05 priveste caile care nu trec prin aceste verificari.
- `lib/admin-auth.ts:95-101,159-173` separa sesiunea valida/full de pending si reverifica allowlist-ul; `adminTotpRepo.ts:43-106` contine controale atomice pentru activare/consum.

Aceste observatii sunt confirmari statice ale structurii controalelor, nu certificari ale tuturor variantelor de executie.

## De ce probele temporare nu sunt inca regresii CI

`vitest.config.ts:12` include numai `{server,lib,app,components,scripts}/**/*.test.ts`. Cele cinci suite `.tmp-detalia-phase2-2026-25-10/*.cjs` nu intra in acest glob. `.github/workflows/ci.yml:84-86` lanseaza npm test, nu suitele temporare; E2E-ul este exclus explicit la `:6`.

Unele cazuri temporare asteapta succesul comportamentului defect: `core.cjs:43,47-48`, `boundaries.cjs:6`, `races.cjs:6-10`. Sunt dovezi de caracterizare, nu teste care ar respinge regresia dupa fix. Nu trebuie copiate mecanic cu aceleasi asteptari. Controlul corect este invarianta dorita, inclusiv starea DB dupa esec, plus control pozitiv si preconditii independente de implementare.

## Matrice de acoperire a review-ului actual

| Invarianta | Ce s-a verificat static acum | Limita ramasa |
|---|---|---|
| Identitate si sesiune | Config/callback-uri, logout, endpoint session, testele existente | Fara executie noua; cookie/browser si transport HTTP nevalidate |
| Cont ACTIVE | Proxy, guarduri API/actions, exceptii si citiri lazy | DET-05; matrice permanenta incompleta |
| Apartenenta si revocare | Gate owner/membru, join/remove/rotire, liste si teste | Politica DET-01; intercalari si transport real |
| Resurse strict private | Ownership planse, oferte si namespace Blob | DET-03; confidentialitate efectiva storage nevalidata |
| Release | Batch de ascundere, selectie tinte, reply metadata | DET-04; failure/negative tests lipsa |
| Integritate/cote | Numarare-scriere, justificare, onboarding si stergere cont | DET-06; erori partiale/concurenta necesita teste locale propuse |
| Admin | Allowlist, pending/full, dovada MFA, revocare si teste | Regresii permanente pentru lant complet; browser/recovery nevalidate |

Raportare pe cele 13 categorii ale skill-ului security-audit, proportional cu scopul aprobat:

| Categoria | Acoperire actuala |
|---|---|
| 1. Secrets/config | Nu s-au citit secrete; nu s-a repetat scanarea configuratiei/istoricului |
| 2. Authentication | Analiza statica actuala; DET-02 si goluri de regresie |
| 3. Authorization | Analiza statica actuala pentru frontierele descrise |
| 4. Input/injection | Namespace/normalizare pe caile urmarite; nu s-a reluat auditul general SQLi/XSS/SSRF |
| 5. API/access control | Porti API si Server Actions; transportul real ramane nevalidat |
| 6. Business logic | Release, apartenenta, cote, justificare, esec partial |
| 7. Data protection/privacy | Continut privat, metadate reply, status cont; fara inspectie cloud |
| 8. Logging/monitoring | Fara revalidarea telemetriei sau alertelor; limitele anterioare raman |
| 9. Abuse/rate limits | Cote selectate; fara load, DoS ori audit nou al infrastructurii |
| 10. Dependencies | Fara verificare CVE curenta; sursa instalata folosita numai pentru lantul sesiunii |
| 11. Infrastructure | Citire glob Vitest si integrare CI; fara acces GitHub/Vercel/Neon |
| 12. File/storage | Upload public, proxy, ownership, cleanup si atasamente; fara descarcari reale |
| 13. Security testing | Comparatie sursa/teste/dovezi istorice si plan de regresie; zero rulari noi |

S-a facut si trasare statica de la sink-uri: reactivare/eliminare de membership, rotire invitatie, transfer ownership, revocare sesiune si stergere Blob. Pentru URL-urile de fisiere s-au comparat portile de namespace de la producatori cu apelurile de cleanup; nu s-a demonstrat o noua stergere cross-user. Acest pas nu certifica absenta oricarei intercalari sau a oricarui traseu neexaminat.

## Verdict si pasul urmator

**SECURITY AUDIT - review static focalizat: BLOCKED pentru aprobarea de securitate**, pe baza celor HIGH deja deschise. Verdictul nu afirma o compromitere in productie si nu reprezinta o certificare completa a deploymentului.

Recomandarea este triajul constatarilor si al politicii de reintrare, apoi un lot separat, aprobat, de remedieri cu teste permanente. In aceasta etapa nu s-au implementat remedieri, teste sau refactorizari. Nu s-a rulat build/type-check deoarece nu s-a schimbat cod executabil.
