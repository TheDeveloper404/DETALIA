# DETALIA — Test Cases QA

> Document de verificare funcțională. Pentru fiecare funcție: ce ar trebui să facă platforma (comportamentul
> așteptat conform specificației de business, `CLAUDE.md`), pași de test, rezultat așteptat. Inginerul QA
> completează coloanele **Status** (✅ Trece / ❌ Nu trece / ⚠️ Parțial) și **Observații**.
>
> Generat: 2026-07-13, pe baza codului real din `server/services/*`, `app/**/page.tsx`, `app/**/actions.ts`.
> Dacă un test pică → verifică dacă e regresie sau dacă specificația s-a schimbat între timp (codul e sursa
> de adevăr; acest doc poate rămâne în urmă).

---

## Cum se completează

| Coloană | Ce treci acolo |
|---|---|
| Status | ✅ Trece / ❌ Nu trece / ⚠️ Parțial (funcționează, dar cu probleme) |
| Observații | Ce ai văzut concret — pași reproducere dacă e ❌/⚠️, screenshot dacă e relevant |

---

## 1. Autentificare & Acces (`lib/auth.ts`, `/login`, `/signup`, `/verify`)

| # | Funcție | Comportament așteptat | Pași de test | Status | Observații |
|---|---|---|---|---|---|
| 1.1 | Creare cont | User nou introduce email pe `/signup` → primește magic link pe email | Introdu un email nefolosit → verifică inbox | | |
| 1.2 | Login cu magic link existent | User cu cont introduce email pe `/login` → primește magic link → click → autentificat | | | |
| 1.3 | Fără parolă | Nu există nicăieri câmp de parolă în flux (login/signup) | Verifică vizual paginile `/login`, `/signup` | | |
| 1.4 | Link expirat/folosit | Un magic link deja folosit (sau expirat) NU mai autentifică — mesaj de eroare, nu 500 | Folosește un link din email vechi/al doilea click pe același link | | |
| 1.5 | `/verify-request` | După trimiterea linkului, userul ajunge pe o pagină „verifică-ți emailul", nu pe eroare | | | |
| 1.6 | Onboarding obligatoriu la primul login | Cont nou fără rol declarat → redirect automat spre `/onboarding` înainte de a vedea feed-ul | Cont nou → încearcă să accesezi direct `/feed` | | |
| 1.7 | Onboarding — rol + subrol + poză | Formularul de onboarding cere rol principal, subrol, poză profil; salvează corect | Completează onboarding cu date valide | | |
| 1.8 | Acces public, fără invitație | Nu există niciun cod de invitație cerut la signup | | | |
| 1.9 | Logout | Butonul de logout invalidează sesiunea (cookie `authjs.session-token` șters/invalid) | Logout → verifică că refresh-ul pe o pagină protejată redirectă la login | | |
| 1.10 | Zonă protejată — deny by default | Acces la orice pagină din `(app)/*` fără sesiune → redirect la login, nu conținut vizibil | Deschide `/feed` în incognito | | |
| 1.11 | Ștergere cont (`accountService.deleteAccount`) | User își poate șterge contul din profil; datele asociate (owned) sunt curățate conform regulii de cascadă | Din profil → șterge cont → confirmă că nu te mai poți loga cu acel email | | |
| 1.12 | Mod mentenanță (`/maintenance`) | Când platforma e în mentenanță, userii sunt redirectați către pagina de mentenanță, nu spre aplicație | (Necesită activarea flagului de admin) | | |

---

## 2. Profil (`profileService`, `/profile`, `/profile/edit`, `/profile/[userId]`)

| # | Funcție | Comportament așteptat | Pași de test | Status | Observații |
|---|---|---|---|---|---|
| 2.1 | Vizualizare profil propriu | `/profile` arată nume, rol+subrol, avatar, cover, detalii/schițe publicate | | | |
| 2.2 | Vizualizare profil altui user | `/profile/[userId]` arată profilul public al altcuiva (fără opțiuni de editare) | Deschide profilul altui user | | |
| 2.3 | Rol afișat permanent lângă nume | Peste tot unde apare numele userului (comentarii, validări, detalii) apare și rolul | Verifică pe un comentariu/validare | | |
| 2.4 | Editare detalii profil | `/profile/edit` — nume, bio etc. se salvează corect | Editează și salvează | | |
| 2.5 | Setare/schimbare avatar | Upload imagine nouă → devine avatarul curent | | | |
| 2.6 | Ștergere avatar | Revine la avatar implicit/gol | | | |
| 2.7 | Setare/schimbare cover | Upload imagine cover → se afișează | | | |
| 2.8 | Ștergere cover | Revine la stare fără cover | | | |
| 2.9 | Poziționare cover (`setCoverPosition`) | Poți regla poziția verticală a imaginii de cover și se salvează | Trage/ajustează cover și reîncarcă pagina | | |
| 2.10 | Declarare rol la signup (`declareRole`) | Rolul ales la onboarding devine activ imediat, fără aprobare | | | |
| 2.11 | Schimbare rol ulterior (`updateRole`) | Userul poate schimba rolul principal/subrolul după onboarding | | | |
| 2.12 | Un singur rol principal | Nu poți avea două roluri principale simultan; doar rol adițional opțional (Administrativ/Educație) | | | |
| 2.13 | Cerere verificare rol (`requestRoleVerification`) | Flux separat, opțional — userul depune date pentru verificare | Inițiază verificarea rolului din profil | | |
| 2.14 | Rol neverificat = funcțional 100% | Fără verificare, userul poate publica detalii/schițe/valida normal | | | |
| 2.15 | Nudge verificare | Există un mesaj vizibil dar neblocant care încurajează verificarea rolului | | | |
| 2.16 | Badge rol verificat | După aprobare (manuală, admin), apare steluța/badge-ul lângă rol | (Necesită aprobare admin în prealabil) | | |

---

## 3. Feed & Descoperire (`detailService.getFeed`, `/feed`)

| # | Funcție | Comportament așteptat | Pași de test | Status | Observații |
|---|---|---|---|---|---|
| 3.1 | Feed finit | Feed-ul arată un număr limitat de detalii (~20), NU scroll infinit | Derulează feed-ul până la capăt | | |
| 3.2 | Sortare după interacțiuni | Detaliile cu mai multă activitate (validări/comentarii) apar mai sus | | | |
| 3.3 | Filtrare | Poți filtra feed-ul (categorie etc.) și rezultatele se schimbă corect | | | |
| 3.4 | Autori activi (`getActiveAuthors`) | Secțiune cu autori recent activi, afișată corect | | | |
| 3.5 | Detalii similare (`getRelatedDetails`) | Pe pagina unui detaliu apar sugestii din aceeași categorie | | | |

---

## 4. Detalii (`detailService`, `/details/new`, `/details/[id]`, `/details/[id]/edit`)

| # | Funcție | Comportament așteptat | Pași de test | Status | Observații |
|---|---|---|---|---|---|
| 4.1 | Creare detaliu (draft) | Orice user cu rol declarat poate începe un detaliu nou (`createDetailDraft`) | | | |
| 4.2 | Salvare draft | Draftul se salvează fără a fi public (`saveDetailDraft`) | Salvează, ieși din pagină, revino — datele sunt acolo | | |
| 4.3 | Publicare detaliu (`publishDetailDraft`) | Detaliul devine vizibil public în feed/căutare | | | |
| 4.4 | Câmpuri obligatorii la publicare | Titlu, autor+rol, categorie, 1 imagine — publicarea eșuează dacă lipsesc | Încearcă publicare fără imagine/categorie | | |
| 4.5 | Zonă climatică/seismică (opțional) | Se poate atașa opțional, se afișează corect pe pagina detaliului | | | |
| 4.6 | Resurse suplimentare | Poți atașa resurse IMAGE/LINK/PDF/TEXT la un detaliu | | | |
| 4.7 | Editare detaliu publicat (`updateDetail`) | Doar autorul poate edita; alt user NU poate accesa editarea (IDOR check) | Încearcă editarea unui detaliu al altui user din URL direct | | |
| 4.8 | Ștergere draft (`deleteDetailDraft`) | Autorul își poate șterge un draft nepublicat | | | |
| 4.9 | Ștergere detaliu publicat (`deleteDetail`) | Autorul poate șterge; cascadă corectă (schițe/validări/comentarii asociate) | Șterge un detaliu cu schițe și validări pe el | | |
| 4.10 | Vizualizare drafturi proprii (`getMyDetailDrafts`) | Lista de drafturi neterminate apare doar pentru autorul lor | | | |
| 4.11 | Salvare detaliu (bookmark) (`toggleSavedDetail`) | Poți salva/desalva un detaliu; apare în `/saved` | Salvează un detaliu → verifică `/saved` → desalvează | | |
| 4.12 | Pagina „Salvate" (`/saved`) | Arată exact detaliile salvate de userul curent | | | |
| 4.13 | Moderare post-publicare | Nu există coadă de aprobare — detaliul e vizibil imediat la publicare | | | |

---

## 5. Schițe / Teanc (`sketchService`, `/sketches/[id]/edit`, `/sketches/drafts`)

| # | Funcție | Comportament așteptat | Pași de test | Status | Observații |
|---|---|---|---|---|---|
| 5.1 | Pornire schiță nouă (`createDraft`) | Orice user (nu doar autorul detaliului-mamă) poate schița peste un detaliu publicat | | | |
| 5.2 | Fill slab pe detaliul-mamă în mod schiță | La intrare în editor, imaginea-mamă se vede cu intensitate redusă | Deschide editorul de schiță | | |
| 5.3 | Unelte desen | Culori, 3 grosimi de creion, radieră, undo/redo funcționează | Testează fiecare unealtă | | |
| 5.4 | Salvare progresivă (`saveStrokes`) | Desenul se salvează pe parcurs (nu se pierde la refresh) | Desenează, dă refresh, verifică că strokes-urile rămân | | |
| 5.5 | Publicare schiță (`publish`) | Schița trece DIRECT în teanc — publică, vizibilă tuturor, fără coadă de acceptare | | | |
| 5.6 | Notificare autor detaliu-mamă | La publicare schiță → autorul detaliului primește notificare in-app | Publică o schiță pe detaliul altcuiva → verifică notificările acelui user | | |
| 5.7 | Un singur autor per schiță | Nu există co-desenare — schița e a unui singur user | | | |
| 5.8 | Dezaprobare via schiță (`recordSketchDisapproval`) | Alegând „Fă o schiță" ca formă de dezaprobare, poziția DISAPPROVE + comentariul apar DOAR la publicarea schiței, nu la simplul click | Alege „dezaprob prin schiță", abandonează fără publicare → verifică că NU apare nicio dezaprobare | | |
| 5.9 | Teanc (`getTeanc`) | Toate schițele PUBLISHED ale unui detaliu apar navigabile prin taburi | Deschide un detaliu cu mai multe schițe | | |
| 5.10 | Thumbnail la publicare | La publicare se generează un PNG thumbnail (hover/slideshow în listă) | | | |
| 5.11 | Ștergere schiță de autorul ei (`deleteSketch`) | Autorul schiței își poate șterge propria schiță, cu cascadă (validări+comentarii+blob) | | | |
| 5.12 | Ștergere schiță de autorul detaliului-mamă | Autorul detaliului-mamă poate șterge orice schiță de pe detaliul lui | Ca autor de detaliu, șterge o schiță a altcuiva | | |
| 5.13 | Notificare la ștergere de autorul-mamă | `SKETCH_DELETED` ajunge la autorul schiței șterse | | | |
| 5.14 | Un alt user NU poate șterge schița altcuiva | Doar cei doi roluri de mai sus au voie (ownership pe server) | Încearcă ștergere din alt cont, prin request direct | | |
| 5.15 | Drafturi de schiță proprii (`getMyDrafts`, `/sketches/drafts`) | Lista arată doar drafturile neterminate ale userului curent | | | |
| 5.16 | Ștergere draft de schiță (`deleteDraft`) | Poți renunța la o schiță nepublicată | | | |
| 5.17 | Vizualizare schiță publicată de alt user (`getPublicSketch`) | Oricine poate vedea o schiță publicată + comentarii + validări pe ea | | | |

---

## 6. Validare (Aprob / Dezaprob) (`validationService`)

| # | Funcție | Comportament așteptat | Pași de test | Status | Observații |
|---|---|---|---|---|---|
| 6.1 | Aprob = 1 click (`approve`) | Fără text obligatoriu, poziția se înregistrează imediat | | | |
| 6.2 | Dezaprob necesită justificare (`disapprove`) | Server respinge dezaprobarea fără text de justificare | Trimite dezaprobare fără text (manipulând requestul, nu doar UI) | | |
| 6.3 | Justificarea devine comentariu | Textul de dezaprobare apare automat ca și comentariu legat (`originValidationId`) | | | |
| 6.4 | Numele + rolul afișate lângă poziție | Fiecare aprobare/dezaprobare arată clar cine + ce rol a votat | | | |
| 6.5 | O singură poziție per user per țintă | Al doilea vot al aceluiași user pe aceeași țintă înlocuiește, nu adaugă alt rând | Votează de 2 ori pe același detaliu din același cont | | |
| 6.6 | Poziție reversibilă (`retract`) | Userul își poate retrage votul | | | |
| 6.7 | Nu poți valida propriul conținut (`CANNOT_VALIDATE_OWN`) | Autorul nu vede butoane Aprob/Dezaprob pe propriul detaliu/schiță | Deschide propriul detaliu | | |
| 6.8 | Validare pe Detaliu ȘI pe Schiță (polimorfic) | Sistemul de validare funcționează identic pe ambele tipuri de țintă | Votează pe o schiță, nu doar pe detaliu | | |
| 6.9 | Fără scor/reputație numerică | Nicăieri în UI nu apare un scor agregat sau reputație numerică vizibilă | Verifică vizual pagina de detaliu/schiță | | |
| 6.10 | Vizualizare pozițiilor mele (`getMyPositions`) | Userul poate vedea unde a votat el | | | |

---

## 7. Comentarii (`commentService`)

| # | Funcție | Comportament așteptat | Pași de test | Status | Observații |
|---|---|---|---|---|---|
| 7.1 | Adăugare comentariu (`addComment`) | Comentariu nou apare imediat, cu nume+rol autor | | | |
| 7.2 | Editare comentariu propriu (`editComment`) | Doar autorul comentariului îl poate edita | Încearcă editare pe comentariul altcuiva prin request direct | | |
| 7.3 | Ștergere comentariu propriu (`deleteComment`) | Doar autorul (sau autorul detaliului/schiței?) poate șterge — verifică regula exactă din cod | | | |
| 7.4 | Like pe comentariu (`toggleCommentLike`) | Poți da/retrage like pe un comentariu | Dă like, dă din nou → toggle | | |
| 7.5 | Listare comentarii (`getComments`) | Comentariile pe un Detaliu/Schiță apar în ordine logică, cu poziția userului curent marcată dacă a comentat | | | |

---

## 8. Notificări (`notificationService`, `/notifications`)

| # | Funcție | Comportament așteptat | Pași de test | Status | Observații |
|---|---|---|---|---|---|
| 8.1 | Listă notificări (`getNotifications`) | `/notifications` arată notificările userului curent, cele mai recente primele | | | |
| 8.2 | Contor necitite (`getUnreadCount`) | Un indicator (badge) arată câte notificări necitite există | | | |
| 8.3 | Marcare toate ca citite (`markNotificationsRead`) | Un buton „marchează tot citit" golește contorul | | | |
| 8.4 | Marcare individuală citită (`markNotificationRead`) | Click pe o notificare o marchează citită fără a afecta restul | | | |
| 8.5 | Doar in-app, fără email | Nicio notificare de acest tip NU ajunge pe email (email oprit pentru notificări, doar magic link folosește Resend) | Verifică inboxul după un eveniment (schiță nouă etc.) — să NU apară email | | |
| 8.6 | Curățare automată (`cleanupOldNotifications`, cron) | Notificările vechi peste `retentionDays` sunt șterse automat prin cron-ul programat | Verifică log-ul cron-ului `cleanup-notifications` | | |

---

## 9. Planșă / Canvas (`plansaService`, `/canvases`, `/canvases/[id]/edit`)

| # | Funcție | Comportament așteptat | Pași de test | Status | Observații |
|---|---|---|---|---|---|
| 9.1 | Creare planșă (`createCanvas`) | User autentificat poate crea o planșă privată nouă | | | |
| 9.2 | Strict privată | O planșă a altui user NU e accesibilă prin URL direct (IDOR) — trebuie NOT_FOUND, nu 403 care confirmă existența | Ia un ID de planșă al altui cont, accesează-l din alt cont autentificat | | |
| 9.3 | Listare planșe proprii (`listMyCanvases`) | `/canvases` arată doar planșele deținute de userul curent | | | |
| 9.4 | Redenumire planșă (`renameCanvas`) | Numele se schimbă și persistă | | | |
| 9.5 | Duplicare planșă (`duplicateCanvas`) | Se creează o copie independentă, cu propriul id | | | |
| 9.6 | Ștergere planșă (`deleteCanvas`) | Planșa și blob-urile asociate (thumbnail) dispar | | | |
| 9.7 | Adăugare detaliu pe planșă (`addDetailToCanvas`) | Doar detalii PUBLISHED pot fi adăugate | Încearcă să adaugi un draft (ar trebui să nu fie posibil) | | |
| 9.8 | Eliminare detaliu de pe planșă (`removeDetailFromCanvas`) | Elementul dispare din document fără să afecteze alte elemente | | | |
| 9.9 | Salvare document (autosave) (`saveCanvasDocument`) | Modificările (poziții, strokes) se salvează automat, validate structural | Mută elemente, refresh, verifică persistența | | |
| 9.10 | Reconciliere detaliu devenit invizibil | Dacă un detaliu adăugat anterior nu mai e PUBLISHED, la redeschidere apare ca placeholder, nu crash | (Scenariu greu de reprodus manual — necesită ștergerea/schimbarea statusului detaliului de un alt cont) | | |
| 9.11 | Limită număr elemente/nume (`MAX_ITEMS_PER_CANVAS`, `MAX_NAME_LENGTH`) | Server respinge peste limită, cu eroare clară, nu 500 | Încearcă să adaugi peste limita de elemente / un nume foarte lung | | |
| 9.12 | Thumbnail planșă (`saveCanvasThumbnail`) | Planșa are un thumbnail vizibil în lista `/canvases` | | | |

---

## 10. Admin (`app/admin-page/*`)

| # | Funcție | Comportament așteptat | Pași de test | Status | Observații |
|---|---|---|---|---|---|
| 10.1 | Login admin separat (`/admin-page/login`) | Cont normal NU are acces la zona admin fără credențiale admin dedicate | Încearcă `/admin-page` cu un cont obișnuit | | |
| 10.2 | Setare stare platformă (`setPlatformAction`) | Admin poate activa/dezactiva mentenanța sau alte flaguri de platformă | | | |
| 10.3 | Logout admin (`adminLogoutAction`) | Sesiunea de admin se închide corect, separat de sesiunea de user normal | | | |
| 10.4 | Verificare manuală rol (`/admin-page/verify`) | Admin vede cererile de verificare rol și le poate aproba/respinge | | | |

---

## 11. Upload fișiere (`app/api/blob/upload`, Vercel Blob)

| # | Funcție | Comportament așteptat | Pași de test | Status | Observații |
|---|---|---|---|---|---|
| 11.1 | Upload imagine validă | Fișier imagine (jpg/png) se încarcă și returnează URL utilizabil | Upload avatar/cover/imagine detaliu | | |
| 11.2 | Respingere tip fișier invalid | Un fișier non-imagine (ex. `.exe`) e respins de server, nu doar de UI | Încearcă upload direct cu un fișier de alt tip (Postman/devtools) | | |
| 11.3 | Limită dimensiune | Fișier peste limita acceptată e respins cu eroare clară | | | |
| 11.4 | Upload necesită sesiune | Endpoint-ul de upload nu poate fi apelat fără autentificare | Apelează endpoint-ul fără cookie de sesiune | | |

---

## 12. Pagini publice / legale

| # | Funcție | Comportament așteptat | Pași de test | Status | Observații |
|---|---|---|---|---|---|
| 12.1 | Landing (`/`) | Pagina de start prezintă platforma + CTA „creare cont" | | | |
| 12.2 | `/termeni` | Pagina de Termeni și Condiții se încarcă și e lizibilă | | | |
| 12.3 | `/confidentialitate` | Pagina de Confidențialitate/GDPR se încarcă și e lizibilă | | | |

---

## 13. Cazuri adversariale generale (de rulat transversal, nu doar pe o pagină)

| # | Scenariu | Comportament așteptat | Status | Observații |
|---|---|---|---|---|
| 13.1 | Sesiune expirată în timpul unei acțiuni (ex. publicare schiță) | Server respinge cu eroare de auth, nu salvează parțial, nu 500 | | |
| 13.2 | Două tab-uri, acțiuni concurente pe aceeași resursă (ex. editare simultană a aceleiași planșe) | Nu apare corupere de date; ultima salvare validă câștigă sau apare conflict clar | | |
| 13.3 | Back-button după logout | Nu se văd date private din cache-ul browserului | | | |
| 13.4 | Manipulare ID din URL către resursă a altui user (detaliu draft, planșă, schiță draft) | Server răspunde NOT_FOUND/FORBIDDEN, niciodată datele altui user | | |
| 13.5 | Trimitere payload malformat direct către server actions (bypass UI) | Validare server-side respinge input-ul, fără stack-trace expus | | |
| 13.6 | Mobil/tabletă — layout | Fără elemente tăiate/suprapuse pe ecrane mici, pe paginile principale | | |

---

## Sumar rezultate (completează la final)

| Modul | Total teste | ✅ Trece | ❌ Nu trece | ⚠️ Parțial |
|---|---|---|---|---|
| 1. Autentificare & Acces | 12 | | | |
| 2. Profil | 16 | | | |
| 3. Feed & Descoperire | 5 | | | |
| 4. Detalii | 13 | | | |
| 5. Schițe / Teanc | 17 | | | |
| 6. Validare | 10 | | | |
| 7. Comentarii | 5 | | | |
| 8. Notificări | 6 | | | |
| 9. Planșă / Canvas | 12 | | | |
| 10. Admin | 4 | | | |
| 11. Upload fișiere | 4 | | | |
| 12. Pagini publice | 3 | | | |
| 13. Adversarial | 6 | | | |
| **TOTAL** | **113** | | | |
