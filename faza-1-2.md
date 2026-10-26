# DETALIA - Audit static de securitate

Data: 2026-10-25
Scop: sursele locale din D:\production_mode\DETALIA, configuratiile locale si dependentele instalate.
Clasificare: CRITICAL, datorita suprafetei auditate; aceasta clasificare nu inseamna ca s-a descoperit o vulnerabilitate CRITICAL.

## Rezultat

3 HIGH, 1 MEDIUM. Niciun CRITICAL demonstrat. Recomandare: BLOCKED pentru aprobarea de securitate, pana la remedierea sau triajul explicit al problemelor HIGH. Nu este o afirmatie despre existenta unui incident de productie.

Nu s-au modificat sursele aplicatiei. Nu s-au accesat productia, stagingul, Neon, Blob, Resend, Upstash, PostHog, GitHub sau registre externe. Nu s-au citit fisiere .env, cookie-uri ori tokenuri reale. Testele au folosit date sintetice, DB in memorie si acces la retea blocat. Raportul este un artefact separat, in directorul temporar.

Dovezile sunt impartite in: (1) comportament reprodus local, (2) defect confirmat static, (3) risc plauzibil neconfirmat, (4) hardening. Testele locale nu reprezinta exploatare HTTP pe un deployment.

## A. Model de amenintari si suprafata de atac

### Arhitectura observata

Browser -> Next.js App Router / proxy.ts -> Route Handlers si Server Actions -> server/services -> server/repos -> Drizzle / Neon PostgreSQL.

Browser -> /api/blob/upload -> token limitat de upload -> Vercel Blob. Unele imagini trec ulterior prin sharp si sunt reincarcate in Blob. Datele din DB contin URL-urile fisierelor.

Autentificare utilizatori: Auth.js v5, provider Resend, token magic link in DB, sesiune JWT in cookie. Autentificare admin: implementare separata, allowlist email, magic link, sesiune intermediara, TOTP/cod de rezerva, sesiune opaca revocabila in DB.

Integrari: Resend pentru email, Upstash pentru rate limit, PostHog pentru telemetrie, Vercel pentru executie si Blob, GitHub Actions pentru verificari si backup. Au fost analizate punctele de integrare din cod, fara contactarea serviciilor.

Inventar mecanic: 8 fisiere route.ts, 22 fisiere de Server Actions cu 68 functii async exportate, 20 fisiere de servicii, 20 fisiere de repository si 28 tabele declarate prin pgTable. Numarul functiilor exportate nu dovedeste separat ca fiecare export este inclus intr-un manifest de build.

### Entry points HTTP

| Ruta | Metode | Autorizare observata |
|---|---|---|
| /api/auth/[...nextauth] | GET, POST | Auth.js; POST signin blocat explicit, GET session ramane disponibil |
| /api/blob/upload | POST | Sesiune, status ACTIVE din DB, namespace user, rate limit la token |
| /api/project-image/detail/[id] | GET | Sesiune ACTIVE si acces la proiect |
| /api/project-image/canvas-share/[id] | GET | Sesiune ACTIVE si acces la proiect |
| /api/cron/weekly-digest | GET | CRON_SECRET comparat constant-time |
| /api/cron/cleanup-notifications | GET | CRON_SECRET comparat constant-time |
| /api/digest/unsubscribe | GET, POST | Token HMAC cu scop si expirare; GET confirma, POST modifica |
| /admin-page/verify/confirm | GET | Consum atomic al magic link-ului admin; creeaza doar sesiune intermediara |

Pagini sensibile: /feed, /details/*, /sketches/*, /canvases/*, /projects/*, /profile/*, /saved, /notifications si /admin-page/*. Pagini publice sensibile: /login, /signup, /verify, /s/[id], /projects/join/[token], /logout. /ingest/* este un proxy catre destinatii PostHog fixe.

Server Actions: login, onboarding, profil/stergere cont/logout, notificari, proiecte/invitatii/eliminare/publicare, creare/editare/stergere detalii si ciorne, schite/adnotari, comentarii/voturi, salvare detalii, oferte furnizor/materiale, planse si administrare/TOTP.

### Active, actori si frontiere

Active: sesiuni si identitate; configuratia MFA; continut de proiect; ciorne si planse private; atasamente de oferte; date de contact; integritatea voturilor, apartenentei si publicarii; cote si costuri ale serviciilor; backup-ul DB.

Actori analizati: anonim, utilizator autentic cu input modificat, membru din alt proiect, membru eliminat, furnizor, autor, owner, utilizator suspendat, detinator al unei copii de sesiune si operator CI. Rolul profesional auto-declarat si validarea propriului continut sunt decizii de produs, nu vulnerabilitati in sine.

Frontiere principale:
- Inputul browserului vs identitatea si verificarile serverului.
- JWT valid criptografic vs cont ACTIVE si sesiune nerevocata.
- Apartenenta la proiect vs acces direct la fisierul Blob.
- Continut privat vs continut eliberat in comunitate, inclusiv contributiile altor membri.
- Sesiune intermediara admin vs sesiune completa dupa TOTP.
- Acces la repository/CI vs acces la secrete si backup de productie.

STRIDE: spoofing prin replay de sesiune; tampering prin reactivarea apartenentei si mutatii pe continut ascuns; disclosure prin Blob public; repudiere prin acoperirea audit-log; consum de resurse prin upload/email/cereri; elevation prin trecerea frontierelor de proiect/admin. Nu toate aceste amenintari s-au materializat in findings.

## B. Findings

### DET-01 - HIGH - Eliminarea din proiect poate fi anulata cu invitatia veche

Stare: CONFIRMAT PRIN REPRODUCERE LOCALA. Recomandare de triaj: BLOCKING.

Locatii exacte:
- server/services/projectService.ts:184 - joinProjectByToken accepta invitatia valida.
- server/services/projectService.ts:198 - aplica upsertActiveMembership fara a distinge un membru eliminat.
- server/services/projectService.ts:222 - removeMember elimina apartenenta fara a invalida invitatia.
- server/repos/projectMembersRepo.ts:45 - conflictul pe apartenenta reseteaza removedAt la null.
- app/projects/join/[token]/actions.ts:25 - traseul expus prin Server Action.
- lib/invite-token.ts:23 - TTL implicit al invitatiei este 3 zile; poate fi configurat intre 1 si 30.

Cauza: revocarea apartenentei nu invalideaza capacitatea de realaturare oferita de linkul deja detinut. Sesiunea utilizatorului poate fi perfect legitima; problema este accesul la proiect.

Preconditii: cont ACTIVE, linkul folosit anterior este cunoscut, linkul nu a expirat si owner-ul nu l-a regenerat; limita de membri permite reintrarea.

Impact: fostul membru recastiga acces la continutul curent si viitor al proiectului si la actiunile permise membrilor. Nu este doar pastrarea unei copii citite anterior.

Reproducere sigura: in PGlite, cu serviciul si repository-urile reale, creeaza owner si membru sintetici; join cu linkul; removeMember; verifica acces false; join cu acelasi link; verifica acces true. Aceasta secventa a fost executata si a reusit.

Remediere propusa: eliminarea trebuie sa invalideze autorizatia veche de reintrare. Varianta minima este rotirea atomica a invitatiei la eliminare; daca produsul permite reinvitarea selectiva, este necesara distinctia dintre invitatia veche si una emisa ulterior. Comportamentul de realaturare este mentionat in testele existente, deci schimbarea necesita o regula explicita; efectul de securitate demonstrat ramane accesul restaurat dupa Elimina.

### DET-02 - HIGH - Copia unei sesiuni supravietuieste logout-ului si poate fi reinnoita

Stare: CONFIRMAT PRIN REPRODUCERE LOCALA cu Auth.js instalat si callback-urile aplicatiei. Recomandare de triaj: BLOCKING.

Locatii exacte:
- lib/auth.ts:50 - strategie JWT cu maxAge de 7 zile.
- lib/auth.ts:94 - callback-ul JWT nu pastreaza/verifica o expirare absoluta de la login si nu verifica revocarea.
- app/api/auth/[...nextauth]/route.ts:7 - GET este delegat direct catre Auth.js, inclusiv session.
- app/(app)/profile/actions.ts:185 - logout face signOut si sterge cookie-ul local.
- lib/auth.ts:122 - clearSessionCookie sterge cookie-urile browserului, fara revocarea copiei JWT.
- Dependenta instalata: node_modules/@auth/core/lib/actions/session.js:46 reincodifica JWT; node_modules/@auth/core/jwt.js:58 stabileste exp = acum + maxAge.
- Dependenta instalata: node_modules/@auth/core/lib/actions/signout.js:15, pentru JWT, nu sterge o sesiune server-side.

Cauza: logout invalideaza cookie-ul din browser, nu tokenul copiat. Endpoint-ul public session emite un cookie nou cu expirare culisanta. Eliminarea rotirii din proxy nu elimina rotirea din GET /api/auth/session.

Preconditii: atacatorul detine deja copia unui cookie valid, obtinuta inainte de logout. Auditul NU a demonstrat o metoda de furt al cookie-ului. Contul trebuie sa ramana ACTIVE pentru accesul la rutele care reverifica statusul.

Impact: accesul din copia sesiunii continua dupa logout. Reinnoirea repetata elimina limita absoluta de 7 zile declarata in cod; poate continua cat timp contul si cheia raman acceptate. Nu reprezinta ocolirea verificarii ACTIVE de pe rutele protejate.

Reproducere sigura: JWT generat cu secret aleator sintetic; logout prin functia reala Auth.js; confirmare ca JWT original ramane valid; simuleaza ziua 6 si executa Auth GET session in proces; cookie-ul nou expira in ziua 13; simuleaza ziua 8 si confirma sesiunea. Fara HTTP de retea si fara afisarea tokenurilor. Providerul si adapterul nu au fost exercitate in aceasta reproducere; traseul testat a fost cel de sesiune JWT.

Remediere propusa: revocare server-side pentru sesiunea delogata si expirare absoluta independenta de reinnoirea cookie-ului. Alegerea dintre sesiuni DB, registru de sesiuni JWT sau alt mecanism trebuie facuta intr-un design separat. O verificare a datei absolute rezolva durata, dar nu rezolva singura replay-ul dupa logout.

### DET-03 - HIGH - URL-urile Blob publice ocolesc autorizarea continutului privat

Stare: CONFIRMAT STATIC; nu s-au descarcat fisiere reale. Finding cunoscut anterior drept AUD-04 / SEC-P01, reconfirmat in implementare, nu descoperire noua. Recomandare de triaj: BLOCKING.

Locatii exacte:
- lib/blob-upload.ts:68 si :88 - upload cu access public.
- lib/image-processing.ts:113 si :139 - imaginile procesate sunt reincarcate cu access public.
- app/(app)/details/[id]/page.tsx:322 - URL-ul brut al imaginii ajunge in componenta client.
- app/(app)/details/[id]/page.tsx:306 - resursele sunt linkuite direct.
- lib/project-image-proxy.ts:26 - proxy-ul descarca URL-ul public; autorizarea proxy-ului nu protejeaza URL-ul direct.
- server/services/projectService.ts:437 - partajarea unei planse foloseste acelasi mecanism de upload public.

Cauza: accesul privat exista la nivel de ruta/DB, dar obiectul din storage este public. URL-ul este o capabilitate care nu este revocata odata cu apartenenta.

Preconditii: detinerea URL-ului unui fisier privat, de exemplu prin acces anterior legitim la proiect, atasament sau plansa. Nu s-a demonstrat enumerarea URL-urilor.

Impact: cine pastreaza URL-ul poate accesa obiectul fara autorizarea aplicatiei dupa revocare, pana la stergerea obiectului. Suprafata cu aceeasi configuratie include imagini, PDF/CAD, derivate si atasamente de oferte; accesul anonim efectiv trebuie confirmat controlat pe staging pentru fiecare clasa.

Reproducere sigura propusa pentru staging: fisier sintetic marcat vizibil; obtine URL ca membru; elimina membrul; compara accesul prin aplicatie cu accesul direct anonim la acel URL. Fara documente reale si fara enumerare.

Remediere propusa: storage privat pentru continut privat, citire autorizata pe server, politica explicita pentru derivate si migrarea obiectelor existente. Ascunderea URL-ului in UI sau folosirea unui UUID nu rezolva autorizarea. Nu se presupune ca un store public poate deveni privat prin schimbarea unui singur argument; arhitectura si SDK-ul trebuie verificate inaintea implementarii.

### DET-04 - MEDIUM - Continutul ascuns dupa release ramane tinta pentru mutatii

Stare: CONFIRMAT PRIN REPRODUCERE LOCALA. Recomandare de triaj: BLOCKING in urmatorul lot de remedieri, impact limitat fata de cele HIGH.

Locatii exacte:
- server/services/validationService.ts:55 si :86 - existenta/autorizarea unei schite nu respinge hiddenAfterRelease.
- server/services/validationService.ts:119 - approve foloseste acest control.
- server/repos/commentsRepo.ts:74 - getThreadCommentForTarget nu exclude comentariile ascunse.
- server/services/commentService.ts:72 - comentariul ascuns poate fi ales drept parinte.
- server/repos/validationsRepo.ts:19 si server/repos/commentsRepo.ts:54 - noile inregistrari nu mostenesc ascunderea tintei/parintelui.

Cauza: filtrarea citirilor publice nu este aplicata consecvent la selectarea tintelor pentru mutatii.

Preconditii: detaliul a fost eliberat in comunitate; contributia altui membru a fost ascunsa; atacatorul cunoaste ID-ul schitei sau comentariului ascuns. ID-ul nu a fost obtinut prin enumerare in acest audit.

Impact demonstrat: un utilizator din afara proiectului poate vota o schita ascunsa si poate crea un reply public legat de un comentariu ascuns. Nu s-a demonstrat citirea corpului comentariului ascuns sau a desenului ascuns prin acest defect. Noile voturi pot intra in unele afisari/statistici care trateaza parintele ca public.

Reproducere sigura: DB PGlite cu un detaliu public, o schita PUBLISHED ascunsa, un comentariu ascuns si un actor diferit; approve pe schita intoarce ok; addComment cu parentCommentId ascuns intoarce ok si produce un reply returnat de citirea publica din repository. Afisarea acelui reply in UI nu a fost testata. Au fost executate ambele cazuri pe serviciile si repository-urile reale.

Remediere propusa: respingerea tintelor/parintilor ascunsi la autorizarea mutatiei; aplicarea aceleiasi reguli la approve/disapprove, reply, edit/delete si voturile pe comentarii, conform politicii de produs.

## Observatii separate: riscuri plauzibile si hardening

Acestea NU sunt incluse in cele patru vulnerabilitati confirmate:

- Imaginea este reprocesata la editare conditionat de imageChanged controlat de client: app/(app)/details/[id]/edit/actions.ts:97 si :193. Se poate sari verificarea continutului unei imagini noi din propriul namespace. Nu s-a demonstrat XSS sau executie de cod; MIME permis si continut valid sunt lucruri diferite. Recomandare: decizia de revalidare sa derive din date de server.
- PDF/CAD/materiale: app/api/blob/upload/route.ts:82, :89, :102 verifica MIME/extensie/marime, fara validare documentara a continutului. Nu s-a demonstrat exploatarea unui parser ori a unui cititor. SVG este exclus din allowlist-ul imaginilor si nu este acceptat de procesarea sharp folosita aici.
- server/repos/digestRepo.ts:24, :47, :67 include activitate ascunsa/privata in agregate fara reverificarea apartenentei. Testul local a confirmat includerea comentariilor ascunse. Impactul evident este un contor, nu corpul continutului; LOW, BACKLOG.
- app/admin-page/actions.ts:79 permite resetarea propriului TOTP din sesiunea completa fara un cod proaspat; lib/admin-auth.ts:104 revoca doar sesiunea curenta la logout. Intarire pentru furt de sesiune si revocare pe toate dispozitivele; nu s-a demonstrat ocolirea TOTP la login.
- .github/workflows/db-backup.yml:36 si :42 salveaza dump-ul de productie ca artifact, 30 zile. Riscul depinde de cine poate descarca artifactele repository-ului; permisiunile reale nu au fost accesate. Evaluarea accesului la backup ramane necesara.
- .github/workflows/zap-full-auth.yml:17, :24, :67 permite URL furnizat manual, excluderi goale si injecteaza cookie-ul de test. Configuratia nu impune singura granita stagingului; viitoarea rulare necesita URL, conturi, date si operatii aprobate explicit.
- lib/turnstile.ts:23 si :43 permite continuarea fara secret sau la eroare de retea. Rate limit-ul ramane separat. Nu este o dovada ca productia este configurata gresit.
- Nicio lista de CVE curenta nu a fost consultata, conform interdictiei de acces extern. Nu se emite verdict de tip zero vulnerabilitati in dependente.

## C. Matrice de acoperire

Verificat local inseamna sursa plus probele specificate; partial inseamna analiza statica si/sau mocks, fara fluxul live. Nu inseamna conformitate certificata OWASP/ASVS.

| Categoria | Acoperire | Dovezi si limite |
|---|---|---|
| 1. Secrete/config | Partial | Env prin referinte, gitignore, configuratie log/CI; fara .env, scanare completa de istoric sau secrete externe |
| 2. Autentificare | Verificat partial, PoC JWT local | Auth.js, magic links, callback URL, sesiuni, logout, suspendare, admin; inbox si cookie-uri reale netestate |
| 3. Autorizare | Verificat local pe cazuri selectate | Proiecte, ownership, planse, detalii, oferte; DET-01 si DET-04; fara acces HTTP adversarial pe deployment |
| 4. Input/injectii | Partial | SQL parametrizat, URL-uri, JSON, JSX, sinks; nu s-a demonstrat SQLi/XSS/SSRF/RCE/deserializare nesigura |
| 5. API/CSRF | Partial | Cele 8 rute, Server Actions, controale locale si sursa Next instalata; origini/headere pe Vercel netestate |
| 6. Business logic | Verificat local pe cazuri selectate | Apartenenta, release, voturi, ciorne, oferte, referral; concurenta distribuita completa netestata |
| 7. Protectia datelor | Partial | Filtrare proiect, mascare contact, criptare TOTP, cookies; DET-03, storage/backup live neverificate |
| 8. Log/monitorizare | Partial | Audit si redactionare PostHog din cod; alertele si payload-urile reale nu au fost accesate |
| 9. Abuz/resurse | Partial | Limite upload/body/strokes/pagini, rate-limit fail-closed productie, CAPTCHA fail-open; fara load/DoS/fuzzing |
| 10. Dependente | Partial | Lockfile: 0 surse non-npm, 0 pachete resolved fara integrity; fara verificare CVE curenta |
| 11. CI/deployment | Partial | Workflows citite, actiuni pin-uite, audit gate; fara branch protections, secrete sau rezultate GitHub reale |
| 12. Fisiere/storage | Partial | Namespace, ownership, sharp, delete sinks si URL-uri; fara upload/download extern; DET-03 |
| 13. Testare securitate | Verificat local selectiv | 299 teste trecute + PoC-uri izolate + 3 guarduri; E2E, CodeQL, Semgrep si ZAP nu au fost executate |

Mapare OWASP/ASVS: DET-01 si DET-04 sunt access control / BOLA si business flow; DET-02 este authentication/session management; DET-03 este object authorization si data protection. Au fost examinate si suprafetele de injection, SSRF, configuration, cryptography, supply chain, integrity, logging, resource consumption si consum de servicii externe. Nu au fost atribuite numere de controale dintr-o editie ASVS neverificata si nu se declara conformitate completa.

### Ce acopera si ce nu acopera instrumentele existente

- Unit/integration: serviciile au multe mock-uri; project-visibility.test.ts verifica repository-uri pe PGlite. Testele existente confirma refuzul imediat dupa eliminare, dar nu secventa eliminare -> link vechi -> acces nou. Un test de proiect chiar descrie realaturarea ca acceptata.
- E2E security: unele teste apeleaza service/repo direct pe DB, conform configuratiei; nu sunt teste HTTP ale tuturor Server Actions. Verificarile release observa ascunderea, dar nu probeaza mutatiile ulterioare pe ID-uri ascunse.
- Testele admin au skip-uri conditionate de ADMIN_EMAILS si configurarea TOTP. Existenta fisierelor nu dovedeste ca au rulat toate cazurile.
- CodeQL foloseste security-and-quality pentru JS/TS. Semgrep ruleaza reguli generale si filtreaza severity ERROR. Aceste configuratii nu demonstreaza acoperirea regulilor de apartenenta, a revocarii JWT sau a accesului efectiv la Blob.
- ZAP baseline si full-auth sunt workflow_dispatch. Full-auth foloseste un cookie furnizat; nu verifica singur matricea de roluri, starea MFA, valabilitatea autentificarii sau toate operatiile Server Actions.
- Guardul de vizibilitate verifica doar 3 fisiere de repository, cu 14 exceptii baseline. Guardul Blob verifica 20 servicii, cu 4 exceptii. Guardul subquery verifica 27 fisiere, cu 6 exceptii. Sunt euristici de regresie, nu analizoare complete de flux de date.

## D. Probe locale executate

1. Vitest: 17 fisiere, 299 teste, toate trecute. Selectia: projectService, adminTotpService, sketchService, detailService.release, validationService, commentService, materialOfferService, project-visibility, adminsRepo.pending-totp, blob-url, image-processing, rate-limit, turnstile, verify-callback-url, magic-link-url, ruta Auth.js si auth-actions.
2. PoC cu PGlite in memorie, schema migrata local si servicii/repository-uri reale:
   - membru eliminat reintra cu invitatia neschimbata: REPRODUS;
   - actor extern voteaza schita hiddenAfterRelease: REPRODUS;
   - actor extern raspunde unui comentariu ascuns: REPRODUS;
   - agregatul digest include comentarii ascunse: REPRODUS.
3. PoC Auth.js in proces, cu cheia si JWT sintetice si ceas simulat:
   - JWT original valid dupa logout: REPRODUS;
   - GET session la ziua 6 emite expirare in ziua 13: REPRODUS;
   - cookie-ul nou este acceptat in ziua 8 fara login: REPRODUS.
4. check:blob-writes, check:visibility, check:subqueries: toate au trecut, in limitele de mai sus.

Executia Vitest a primit un mediu fara credentialele aplicatiei si un preload care blocheaza fetch/socket-urile de iesire. Probele noi au rulat din stdin, fara fisiere de test noi in repository. Nu exista inca teste permanente de regresie pentru findings-urile noi.

Nu s-au rulat build, lint sau type-check: nu s-a schimbat cod. Nu s-au rulat E2E, scanere active sau audit npm online. Nu s-au executat teste distructive pe date reale ori teste de volum. Aceste limitari raman explicite.

## E. Roadmap de remediere propus

Triajul final apartine lui Liviu. Nicio remediere nu este aprobata sau aplicata prin acest raport.

1. DET-01: inchiderea realaturarii prin invitatia veche dupa eliminare; test de tranzitie complet, inclusiv regenerare si doua cereri concurente.
2. DET-02: design pentru revocarea sesiunii si expirare absoluta; teste cu doua dispozitive, logout, reinnoire si suspendare/reactivare. Nu se considera suficienta doar stergerea cookie-ului local.
3. DET-03: proiect separat pentru storage privat, inventar complet al derivatelor, migrare a obiectelor existente si strategie de rollback. Include explicit fisierele ofertelor si plansele in decizia de scop.
4. DET-04: unificarea regulii de acces pentru tinte ascunse pe toate mutatiile relevante, fara a schimba necerut regulile de produs.
5. Dupa remedieri: o singura re-verificare a fix-urilor si apoi Faza 2 pe staging, numai dupa aprobarea URL-ului si limitelor. Verificarea CVE, CI, accesului la backup si configuratiei mediului necesita o autorizatie ulterioara pentru accesul extern relevant.

## F. Suita de regresie propusa

| Test | Rezultat asteptat dupa fix | Nivel |
|---|---|---|
| join -> remove -> join cu invitatia veche | Accesul nu se reactiveaza | Service + DB, apoi staging |
| Invitatia noua, reinvitare deliberata | Comportament conform regulii aprobate | Service + DB |
| Copie sesiune pe al doilea dispozitiv -> logout | Copia sesiunii delogate este respinsa | Auth integration + staging |
| GET session aproape de ziua 7 | Expirarea absoluta nu este prelungita | Auth integration cu ceas controlat |
| JWT expirat/suspendat/deleted | Citirile si mutatiile protejate sunt respinse | Integration + staging |
| GET session concurent cu logout | Raspunsul intarziat nu restaureaza acces valid | Staging, volum minim |
| Fiecare clasa de fisier privat, URL direct anonim | Continutul nu este servit | Storage integration + staging |
| Membru eliminat, URL retinut anterior | Fara acces nou la fisier | Staging |
| Release cu contributii ascunse | Vote/reply/edit pe tinta ascunsa sunt refuzate conform politicii | Service + DB |
| Raspuns legat de comentariu ascuns | Nu produce reply public neautorizat ori scurgere de metadate | Service + DB |
| TOTP/cod rezerva/pending consumate concurent | Un singur consum/promovare | DB integration |
| Fiecare API si Server Action sensibil | Sesiune, status, rol, ownership, apartenenta si input malformat verificate | Inventar + staging |
| URL nou cu imageChanged=0 | Decizia de revalidare nu depinde de flag-ul clientului | Action/service |
| Digest pentru utilizator fara acces la proiect | Fara activitate neautorizata in agregate, daca aceasta este regula aprobata | DB integration |

Noile teste de business/authz trebuie sa citeze regula exacta aprobata; scenariile HTTP si de framework se verifica pe implementarea/documentatia versiunii folosite inaintea asertiunilor. E2E-urile viitoare se ruleaza separat pe staging/Preview aprobat, nu pe localhost sau productie.

## Verdict

SECURITY AUDIT - surse locale si probe izolate, Faza 1.
Findings: Critical 0 / High 3 / Medium 1.
Verdict: BLOCKED - recomandare de remediere a celor HIGH inaintea aprobarii de securitate.
Acesta este un verdict asupra dovezilor locale, nu o certificare a deploymentului si nu o dovada de compromitere.


---

# Faza 2 - Verificare adversariala locala

Data: 2026-10-25. Sectiune adaugata dupa citirea integrala a Fazei 1 si a matricei de acoperire. Faza 1 de mai sus ramane pastrata ca istoric, inclusiv recomandarile ei. Aceasta faza nu implementeaza si nu propune un nou lot de remedieri.

## Rezultat executat

- 952 de teste existente, din 102 fisiere: toate trecute, fara teste pending.
- 193 de cazuri adversariale noi, in 5 suite: executate, fara erori finale de harness.
- Clasificarea rezultatelor brute: 175 controale care au respins cazul testat sau au pastrat invarianta; 6 reproduceri/extinderi ale constatarilor Fazei 1; 12 observatii de comportament cu impact limitat. Aceste numere sunt cazuri de test, NU numere de vulnerabilitati distincte.
- Constatarile suplimentare consolidate: DET-05 si DET-06, ambele MEDIUM. Niciun HIGH sau CRITICAL nou confirmat.
- Totalul registrului principal: Critical 0 / High 3 / Medium 3. Observatiile limitate si scenariile neconcludente sunt separate mai jos.

La inceput, doua asertiuni din harness presupuneau un obiect gol pentru sesiunea invalida; implementarea Auth.js instalata intoarce null. Asertiunile au fost corectate dupa citirea erorii reale. O incarcare directa a next-auth din Node a necesitat un stub exclusiv pentru clasa AuthError in inventarul anonim; testele reale Auth.js sunt intr-o suita separata cu adapterul real. Rezultatele finale citate sunt ultimele rulari reusite; fisierele de rezultate ale incercarilor anterioare raman ca istoric.

## Izolare si limite tehnice

Testele noi sunt in `.tmp-detalia-phase2-2026-25-10/`, creat separat, fara suprascrierea fisierelor preexistente ale aplicatiei. `runtime.cjs` elimina variabilele de mediu ale aplicatiei, genereaza secrete sintetice, blocheaza socket-urile de iesire si permite fetch doar pentru obiecte sintetice in memorie sau raspunsuri de test explicite. Nicio suita noua nu a incercat conectarea la retea: contoarele finale deniedNetwork sunt 0.

DB: PGlite in memorie, cu migratiile locale reale. Serviciile, repository-urile, schema, majoritatea helperelor, Auth.js, adapterul Drizzle, sharp si generarea tokenurilor SDK Blob sunt reale. `db.batch` din Neon este reprezentat printr-o tranzactie PGlite, cu query-urile reale; nu se pretinde echivalenta completa cu izolarea distribuita Neon. Operatiile de stergere au atins exclusiv fixture-uri efemere in memorie.

Frontiere simulate: sesiunea utilizatorului pentru apelurile directe de Server Actions, cookie jar, next/headers, redirect/revalidate, telemetria si transportul Blob. Modul de storage public a fost observat din argumentele SDK, fara acces la un store real. Autentificarea are o suita separata care foloseste Auth.js real, callback-urile aplicatiei si adapterul real peste DB in memorie. Livrarea emailului este capturata in memorie.

Sursa Next.js instalata a fost consultata inaintea probei CSRF; handler-ul real a fost exercitat in proces cu un manifest sintetic. Nu s-a pornit un server HTTP si nu s-a folosit un browser. Protectia efectiv oferita de Vercel/headere/cookie-uri si randarea UI nu devin automat verificate prin aceste probe.

Fiecare suita verifica hash-urile surselor incarcate inainte/dupa executie. Nu s-a modificat cod de productie, nu s-au citit .env sau credentiale reale, nu s-au contactat servicii externe, nu s-au rulat scanari active, fuzzing de volum ori DoS. Testele de concurenta au exact doua sau trei cereri sintetice, cu programarea ordinii controlata.

## Constatarile suplimentare

### DET-05 - MEDIUM - Suspendarea nu este reverificata la citirea notificarilor prin Server Action

Stare: CONFIRMAT LOCAL la frontiera functiei exportate; livrarea prin protocolul HTTP Next/Vercel nu a fost testata.

Locatii exacte:
- `app/(app)/notifications/actions.ts:14` - getNotificationsAction.
- `app/(app)/notifications/actions.ts:15` - citeste doar auth(), care poate reflecta JWT-ul ACTIVE vechi.
- `app/(app)/notifications/actions.ts:17` - citeste si returneaza notificarile fara verificarea statusului din DB.
- `server/services/notificationService.ts:79` si `:96` - filtrarea titlurilor verifica apartenenta la proiect, nu statusul ACTIVE al contului.
- `server/services/projectService.ts:111` - accesul la proiect se bazeaza pe owner/membru.

Cauza: prima poarta din proxy blocheaza navigarea contului suspendat, dar functia de citire nu are propria verificare de status proaspat. Apartenenta unui cont suspendat poate ramane activa. Un JWT tehnic valid este suficient la frontiera actiunii.

Preconditii: cont suspendat cu JWT anterior inca valid; apartenenta la proiect pastrata; cunoasterea actiunii din clientul incarcat anterior. Pentru exploatarea prin deployment trebuie confirmat transportul same-origin al Server Action de pe o ruta care nu este oprita de proxy.

Impact demonstrat: dupa setarea SUSPENDED in DB, un apel cu sesiunea veche primeste o notificare inserata ulterior, continand un titlu privat. Nu s-a demonstrat citirea corpului documentului sau acces complet la proiect. Severitatea ramane MEDIUM, fiind o scurgere limitata de metadate.

Reproducere: `boundaries.cjs`, cazul `suspended account can fetch fresh private notification title via action`. Fixture-ul creeaza owner, membru, proiect si detaliu privat; suspenda membrul; insereaza o notificare sintetica dupa suspendare; invoca getNotificationsAction cu identitatea JWT veche si verifica titlul returnat. `routes-files.cjs` confirma separat ca proxy-ul real respinge acelasi tip de identitate suspendata pe /feed.

Comportament asociat, impact mai mic: `saveStrokesAction` permite autosalvarea unei ciorne proprii dupa suspendare, iar `saveStrokes` permite scrierea propriei ciorne private dupa eliminarea din proiect. Dovezi: `app/(app)/sketches/[id]/edit/sketch-actions.ts:44`, `server/services/sketchService.ts:125`, `:147`; cazurile dedicate din `core.cjs`. Nu permite editarea ciornei altcuiva si nu returneaza continutul detaliului privat. Acest comportament este explicit pastrat in comentariul actiunii, deci nu este prezentat ca o escaladare noua asupra altui cont.

### DET-06 - MEDIUM - Cotele verificate prin count urmat de scriere pot fi depasite concurent

Stare: CONFIRMAT LOCAL, cu programare determinista a doua cereri reale.

Locatii exacte:
- `server/services/projectService.ts:79` si `:84` - numara proiectele, apoi insereaza separat.
- `server/services/projectService.ts:194` si `:198` - numara membrii, apoi reactiveaza/insereaza apartenenta separat.
- `server/services/sketchService.ts:106`, `:208`, `:215` - numara adnotarile, apoi publica separat.
- `server/domain/sketch.ts:30` - plafonul curent in cod este o adnotare. Nu s-a presupus valoarea diferita din documentatia de business.

Cauza: verificarile de cota si modificarile se pot intercala. Unicitatea pe aceeasi entitate nu impiedica doua entitati distincte sa treaca simultan verificarea.

Preconditii: utilizator autorizat pentru operatiile respective, la o pozitie sub plafon; doua cereri care observa aceeasi valoare inaintea scrierilor. Nu necesita falsificarea identitatii si nu s-a ocolit rate-limit-ul global.

Impact demonstrat: depasirea cotelor si a regulii de adnotare. Nu s-a demonstrat consum de resurse nelimitat, indisponibilitate sau ocolirea unei frontiere intre proiecte. Nu este HIGH si nu este un rezultat de load testing.

Reproduceri in `races.cjs`:
1. Cota de proiecte setata sintetic la 2; exista 1 proiect; doua createProject concurente reusesc; total 3.
2. Cota de membri setata sintetic la 2; exista 1 membru; doi utilizatori distincti se alatura concurent; total 3.
3. Plafonul real de o adnotare, cu zero adnotari existente; doua createAnnotation concurente reusesc; doua adnotari PUBLISHED in DB.

Bariera de test asteapta ambele citiri reale inainte de a permite continuarea; nu fabrica numere, permisiuni sau rezultate SQL. Nu se afirma ca orice pereche de request-uri in productie va avea aceasta intercalare.

## Observatii confirmate, fara impact suplimentar exploatabil demonstrat

Aceste observatii NU sunt adaugate automat la numarul vulnerabilitatilor:

1. **Validare de continut ocolita la editarea imaginii.** `app/(app)/details/[id]/edit/actions.ts:97`, `:193`, `:194`. Un URL nou din namespace-ul propriu, cu octeti care nu sunt imagine, este persistat atunci cand imageChanged=0; nu are loc re-encodare sharp. Proba `imageChanged zero persists unprocessed new image URL`, routes-files.cjs. Este un bypass confirmat de validare; nu s-a demonstrat XSS, executie de cod sau acces cross-user. Ramane diferentiat de o vulnerabilitate de executie de fisiere.
2. **Onboarding repetat modifica profilul inainte sa raporteze ALREADY_HAS_ROLE.** `server/services/onboardingService.ts:44`, `:82`. Proba core.cjs arata schimbarea firstName in DB, desi raspunsul este de eroare; rolul nu se schimba. Impactul demonstrat este asupra propriului profil, nu o escaladare de rol.
3. **Dezaprobarea si justificarea nu sunt atomice la o eroare de scriere.** `server/services/validationService.ts:161`, `:175`. Injectarea unei singure erori sintetice in insertComment lasa pozitia DISAPPROVE fara justificare in DB. Nu s-a gasit o intrare de client care sa provoace acea eroare in mod fiabil; este un defect de integritate la avarie, nu un atac confirmat. Races.cjs pastreaza proba.
4. **JSON invalid pe upload arunca inainte de try/catch.** `app/api/blob/upload/route.ts:47`. Handlerul in proces respinge cu SyntaxError; raspunsul final livrat de Next/Vercel nu a fost verificat. Nu s-a demonstrat scurgere de internals sau DoS.
5. **Turnstile fail-open la eroare de transport.** `lib/turnstile.ts:43`. Raspunsul success:false este respins; exceptia de transport permite continuarea. Nu s-a demonstrat ca un client poate produce selectiv aceasta eroare pe infrastructura reala. Rate-limit-ul productiei a fost confirmat separat fail-closed in scenariile locale.
6. **Session endpoint reflecta status JWT vechi.** /api/auth/session returneaza ACTIVE pentru JWT-ul emis anterior suspendarii. Controalele de ruta/API care citesc status proaspat au respins accesul. Acest rezultat sustine DET-05 si nu se numara separat ca bypass complet al suspendarii.

## Constatarile Fazei 1: pastrate si reverificate

| ID | Stare dupa Faza 2 | Dovezi suplimentare / limite |
|---|---|---|
| DET-01 HIGH | Reconfirmat | Invitatie veche -> apartenenta restaurata; apoi acces la un detaliu creat DUPA eliminare, nu doar continut memorat anterior. Rotirea invitatiei respinge tokenul vechi. |
| DET-02 HIGH | Reconfirmat | Auth.js real, callback-uri si adapter reale; reinnoirea la ziua 6 muta expirarea absoluta. Nu s-a gasit o metoda noua de furt de cookie. Revocarea sesiunii admin opace functioneaza, fiind un mecanism diferit. |
| DET-03 HIGH | Confirmare statica plus argumente SDK | Sharp real reincarca cu access public. Tokenurile de upload sunt semnate de SDK-ul real folosind cheia sintetica. Descarcarea anonima din Blob real ramane neverificata conform restrictiilor. |
| DET-04 MEDIUM | Reconfirmat | Vote/reply pe ID-uri ascunse sunt acceptate. Copierea unei schite ascunse intr-o plansa este respinsa. Returnarea unui reply in repository nu dovedeste ca arborele de comentarii il afiseaza in UI. |

## Suspiciuni respinse pentru cazurile testate

RULED_OUT in rezultatele brute inseamna respins in cazul concret exercitat, nu inexistenta oricarei variante posibile.

- **BOLA/IDOR direct:** utilizatorul diferit nu poate citi un detaliu de proiect, edita/sterge detaliul sau ciorna altuia, salva/publica/modera schita altuia, crea adnotare pe detaliul altuia, citi/redenumi/sterge/duplica plansa altuia, modifica documentul plansei, redenumi/sterge proiectul altuia, elimina membri, roti invitatia sau elibera continutul altuia. Cazurile sunt in core.cjs.
- **Oferte:** rolul nepotrivit si tinta privata sunt respinse; cititorul diferit nu primeste ofertele owner-ului; URL-ul Blob al altui user este respins. Campurile offerId/supplierId/detailId injectate in obiectele filesJson sunt eliminate de Server Action inaintea persistarii. Nu s-a confirmat mass assignment pe acest traseu.
- **Magic link:** tokenul nu este stocat in clar; schimbarea emailului, expirarea, dubla consumare si suspendarea dintre cerere si callback nu au produs sesiune. Adresele multiple/quoted si forma fullwidth ambigua din cazurile selectate sunt respinse de parserul instalat.
- **JWT:** token fals, cheie gresita si token expirat nu autentifica; payload-ul clientului de update nu modifica identitatea in callback. POST session fara CSRF nu emite o sesiune noua. Redirecturile externe selectate nu devin destinatia login-ului reusit.
- **Admin:** sesiunea intermediara nu este sesiune completa; finishEnrollment fara dovada nu promoveaza; cinci erori sterg pending; tokenurile expirate/neallowlisted sunt refuzate; acelasi TOTP/cod de rezerva are un singur castigator chiar la trei verificari concurente; secretul activ nu poate fi suprascris prin beginEnrollment; logout revoca tokenul opac copiat; allowlist-ul este reverificat; un cont DELETED nu poate fi reactivat prin operatia obisnuita de suspendare.
- **Rute:** ambele rute de imagine refuza anonim, cont suspendat si outsider; apartenenta revocata este reverificata; succesul are private,no-store. Ambele cronuri refuza credentiale absente/gresite. Dezabonarea cere semnatura corecta si scopul corect, GET nu modifica preferinta, POST valid o modifica.
- **Upload:** tokenul nu este emis pentru anonim/suspendat sau namespace strain; tokenul semnat limiteaza MIME, marimea, sufixul si nu permite suprascriere prin campuri client injectate; extensiile CAD/materiale nepermise sunt refuzate; evenimentul cu semnatura falsa nu trece; quota denial raspunde 429.
- **SSRF / fisiere:** host extern, loopback, adresa de metadata si variantele de user-path traversal selectate sunt refuzate inainte de fetch. Reprocesarea URL-ului altui utilizator nu sterge obiectul. Sharp respinge octeti neimagine si SVG declarat PNG; accepta rasterul sintetic valid. Nu s-a confirmat SSRF sau executie SVG pe traseul verificat.
- **SQL/JSON/HTML:** payload-ul SQL ramane termen de cautare si nu returneaza continut privat; campurile de prototype/ownership suplimentare nu supravietuiesc normalizarii documentului canvas; javascript/data/file URL sunt respinse ca resurse; template-ul de email exercitat encodeaza textul HTML. Nu s-a confirmat SQLi, prototype pollution sau XSS pe aceste trasee. Browser XSS pe intreaga interfata ramane separat.
- **Business:** aprobarile duplicate au o singura pozitie; dezaprobarile duplicate au o singura justificare cand DB nu esueaza; publicarea repetata a aceleiasi schite are o singura tranzitie; un reply nu poate folosi parinte din alt detaliu; auto-referral si replay de referral sunt respinse/idempotente; insertul relational invalid ruleaza inapoi batch-ul local; release ascunde contributiile celorlalti in aceeasi tranzactie locala.
- **Confidentialitate:** profilul altuia nu returneaza email/telefon ascuns, referralCode privat ori oferte private; un user nu poate marca citita notificarea altuia.
- **Frontiera Server Actions:** toate cele 64 exporturi care cer identitate au fost apelate anonim in proces si au refuzat/returnat neutru. Celelalte 4 exporturi sunt cele doua intrari publice de login si cele doua logout-uri. Inventarul ramane 68 exporturi in 22 fisiere. Aceasta verificare nu este acoperire completa a tuturor combinatiilor actor/parametru pentru fiecare export.
- **CSRF Next:** handler-ul real instalat a refuzat Origin strain inainte de executia actiunii. Header-ele adaugate de infrastructura si comportamentul browserului nu au fost presupuse din acest test.

## Matrice de acoperire actualizata

| Suprafata | Evaluare locala Faza 2 | Ce ramane neacoperit |
|---|---|---|
| Auth.js / magic links | Auth real + adapter DB real, tokenuri sintetice, expirare, replay, email schimbat, suspendare | Inbox real, prefetch/scannere email, delivery, domenii deployment |
| JWT / logout / renewal | DET-02 pastrat; JWT fals/expirat respins; reinnoire reala; status stale separat | Cookie browser, raspunsuri concurente logout/session pe HTTP, toate dispozitivele reale |
| Suspendare / stergere | Guards reali, proxy real, API si actiuni directe; DET-05 | Transportul efectiv al actiunii de pe ruta publica si back-button/bfcache |
| IDOR / BOLA | Fixture-uri multi-user, servicii si repo reale; controale negative enumerate | Matrice completa HTTP pe fiecare pagina/metoda si rol |
| Server Actions | 64 intrari anonime + parametri falsificati selectati + CSRF Next real in proces | Serializare RSC, manifest de build real, forwarding/routing si origin/host la Vercel |
| Cele 8 rute HTTP | Handlere in proces, autentificare/autorizare/signaturi/token policies; admin confirm acoperit prin consumul real al tokenului | Delivery HTTP, CDN, cache, middleware integration pe deployment |
| Admin / TOTP | Enrollment, proof, expirare, allowlist, consum unic, concurenta, logout opac, suspendare | Browser/cookies, procedura operationala de recovery, revocare pe alte sesiuni dupa reset |
| Fisiere / upload | SDK Blob real pentru semnare, sharp real pentru continut raster, namespace, ownership, delete sinks sintetice | Blob cloud, token replay la storage, revocarea tokenului deja emis, PDF/CAD/Office in cititoare, malware |
| SQLi / input | Query-uri reale pe PGlite, URL schemes/hostnames, normalizare JSON, encoding email | Toate parserele de browser si toate campurile/randarile UI, diferente infrastructura |
| XSS | Excludere SVG la procesare, scheme periculoase respinse, email escaping exercitat | DOM/client interactions, PDF/CAD rendering si browser end-to-end |
| SSRF | Cazurile de host/path selectate respinse inainte de fetch | DNS/redirecturi si comportamentul unui serviciu Blob real; fara conectare de test |
| Business / referrals / voturi | Actori multipli, idempotenta, rollback batch local, release, DET-04 | Reguli de produs nespecificate; nu exista o garantie noua anti-Sybil/reputatie |
| Concurenta | 2-3 operatii controlate: token, TOTP, backup, publicare, vot, referral, cote; DET-06 | Izolare Neon/serverless, toate intercalarile, concurenta intre instante |
| Rate limit / resurse | Fail-closed productie la lipsa Redis si eroare; denial pe actiuni/upload; cote si dimensiuni | Redis real, spoofing headere prin edge, capacitate/SLA; fara load/DoS |
| Log / telemetrie | Auditul local capturat; testele existente de redactionare au rulat offline | Payload-uri/alerte reale, acces PostHog/Vercel si retentie |
| Dependente / CI / backup | Testele existente si configuratia locala; nicio cerere externa | CVE curente, rezultate SAST/DAST live, branch protections, permisiuni artifact backup |

Toate cele 10 arii cerute au fost parcurse cu probe locale proportionale si limite explicite. Nu se declara epuizarea tuturor payload-urilor, tuturor intercalarilor ori tuturor combinatiilor actor/obiect. Suprafetele dependente de browser, cloud sau configuratia deploymentului nu pot fi inchise printr-un test in proces.

## Reproduceri si dovezi pastrate

Director: `.tmp-detalia-phase2-2026-25-10/`.

| Fisier | Cazuri finale | Rol |
|---|---:|---|
| runtime.cjs | infrastructura | izolarea env/retelei, DB in memorie, loader surse reale, verificare hash-uri |
| core.cjs | 58 | ownership, business, servicii/repo, action inputs, DET-01/DET-04 |
| auth.cjs | 28 | Auth.js + adapter real, JWT, magic links, TOTP/admin |
| routes-files.cjs | 34 | handlere, proxy, SDK Blob, sharp, SSRF, limits |
| races.cjs | 6 | intercalari controlate si tranzactii, DET-06 |
| boundaries.cjs | 67 | frontierele anonime ale actiunilor, notificari suspendate, CSRF Next, HTML email |
| summary.json | 193 total | selectia ultimelor rezultate per suita |
| results-*.json | per rulare | caz, rezultat, dovezi sintetice; fisiere cu timestamp, fara suprascriere |

Raportul brut al celor 952 teste existente: `.tmp-phase2-existing-unit-results-2026-25-10.json`.

Rerulare locala, fara credentiale reale:

```powershell
node .tmp-detalia-phase2-2026-25-10/core.cjs
node .tmp-detalia-phase2-2026-25-10/auth.cjs
node .tmp-detalia-phase2-2026-25-10/routes-files.cjs
node .tmp-detalia-phase2-2026-25-10/races.cjs
node .tmp-detalia-phase2-2026-25-10/boundaries.cjs
```

Atentie de interpretare: aceste suite sunt teste de caracterizare ale starii actuale. Unele asertiuni confirma explicit comportamentul vulnerabil. Un exit code 0 inseamna ca observatiile s-au reprodus, NU ca aplicatia este sigura. Rezultatele CONFIRMED_LIMITED sunt consolidate si calibrate in text, nu transformate automat in findings HIGH.

## Gaps pentru o eventuala verificare staging

Nu este ceruta acum nicio credentiala si nu este autorizata prin acest raport o rulare externa.

1. Transportul real pentru DET-05: sesiune de test suspendata, actiune de notificari de pe o ruta permisa de proxy; verificare stricta a payload-ului returnat.
2. DET-02: doua browsere de test, copie controlata a sesiunii, logout si GET session concurent, expirare absoluta si suspendare/reactivare. Fara conturi reale.
3. DET-03: obiecte sintetice din fiecare clasa, acces direct anonim, membru si membru revocat; token upload deja emis si cache/CDN; fara documente reale.
4. Matrice API/Server Actions prin protocolul real: anonim, ACTIVE, suspendat, DELETED, owner, membru, revocat, outsider, furnizor, pending/full admin; metode si parametri selectati.
5. Browser: XSS/DOM, redirectionari, cookie-uri, logout/back-button, private content caching, fluxuri TOTP/recovery. Fara presupuneri bazate doar pe tsc sau pe testele de servicii.
6. PDF/CAD/Office si upload replay la serviciul real; fara exploituri de parser distructive si fara fisiere provenite de la utilizatori reali.
7. Intercalari in Neon/serverless, maxim cateva cereri controlate; niciun load test sau DoS.
8. Configuratie live: increderea in x-forwarded-* pentru rate limit/origini, securitatea backup artifact, permisiuni CI, telemetrie si CVE curente. Acestea necesita autorizarea separata a accesului extern relevant.

## Evaluare de risc actualizata, fara remedieri

- **HIGH pastrate:** revenirea dupa eliminare prin invitatia veche, replay/reinnoire JWT dupa logout si storage public pentru continut privat.
- **MEDIUM:** mutatii pe contributii ascunse, notificari private accesibile prin actiune dupa suspendare la frontiera locala si cote concurente neatomice.
- **Lant confirmat:** DET-01 ofera acces la continut privat creat dupa revocare. Combinarea cu un URL public din DET-03 este sustinuta de cod/configuratia storage, dar descarcarea din cloud nu a fost exercitata.
- **Lant neconfirmat:** furt de cookie -> DET-02 -> actiuni persistente. Replay-ul si reinnoirea sunt demonstrate; furtul initial nu a fost demonstrat. Nu se raporteaza account takeover fara aceasta preconditie.
- **Nu s-au confirmat:** escaladare de user la admin, ocolire TOTP prin cod repetat, IDOR direct pe obiectele testate, SQLi, SSRF ori XSS exploatabil pe traseele exercitate.

SECURITY AUDIT - Faza 2 locala: Critical 0 / High 3 / Medium 3 in registrul consolidat.
Verdict de securitate: BLOCKED din cauza constatarilor HIGH ramase deschise. Nicio remediere aplicata. Acest verdict nu afirma ca exista o compromitere in productie si nu certifica suprafetele live neverificate.
