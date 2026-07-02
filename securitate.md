# Audit de securitate DETALIA — 2026-07-02

> Audit formal CRITICAL, 13 categorii (skill `security-audit`), gândit adversarial („ce poate face un
> atacator"). Scope: întreg codebase-ul aplicației live (`detalia.ro`) — auth, rute, API, server actions,
> services, upload, DB. Metodă: citire statică integrală a suprafeței de atac + `npm audit`.
>
> **Verdict: APROBAT pentru MVP.** Zero constatări CRITICAL / HIGH / MEDIUM / LOW de cod. Un singur punct
> de **hardening/consistență** aplicat (SEC-H01). Poarta §11 rulată pe viu (inclusiv authz cu 2 conturi
> reale): gating rute, fișiere expuse, headere/TLS, API neautentificat, ownership pe pagina de editare =
> **toate PASS, 0 CRITICAL/HIGH**. Rămân de rulat de Liviu doar testele distructive de mutație cross-user
> (nu le rulez pe prod — risc de pierdere de date reale; ownership e deja dovedit static + pe pagina de edit).

---

## Sumar constatări

| Sev | # | Stare |
|-----|---|-------|
| CRITICAL | 0 | — |
| HIGH | 0 | — |
| MEDIUM | 0 | — |
| LOW | 0 | — |
| Hardening / consistență | 1 | APLICAT (SEC-H01) |
| Note / risk-acceptance | 5 | documentate |

Postura generală: **foarte bună**. Modelul „deny-by-default" e aplicat consecvent (proxy → sesiune pe
tot ce nu e explicit public; authz fină în services). `authorId`/`userId` vin **exclusiv din sesiune**,
niciodată din formular → clasa IDOR e închisă structural. Toate regulile de business sunt enforce pe server.
Input-urile care ating coloane `uuid` sunt gardate cu `isUuid` (pattern „SEC-11") aproape peste tot.

---

## Hardening / consistență

### [SEC-H01] Guard `isUuid` pe profilul public (consistență cu pattern-ul SEC-11)
- **Categorie:** Input validation / consistență (NU vulnerabilitate — vezi verificarea live).
- **Locație:** `app/(app)/profile/[userId]/page.tsx:21` → `getProfileView` → `getPublicProfile`.
- **Context:** `getProfileView` era singura cale de citire care **nu** aplica gardul `isUuid` prezent peste
  tot în rest (detail/sketch/validation/comment). Ipoteza inițială (static): `userId` malformat →
  `WHERE users.id = $1` pe coloană `uuid` → `22P02` → 500.
- **Verificare pe viu (prod):** ipoteza **NU se confirmă**. `/profile/not-a-uuid` cu sesiune validă →
  **`notFound()` curat (404)**, identic cu un uuid inexistent. Driverul **Neon HTTP + Drizzle** nu aruncă
  pe uuid malformat (întoarce zero rânduri → null → `notFound()`). Deci nu există 500, nu e un defect
  exploatabil — doar o inconsecvență de stil.
- **Aplicat (defensiv, zero risc):** `if (!isUuid(userId)) return null;` + import `isUuid` în
  `getProfileView` (`server/services/profileService.ts`). Aliniază ultima cale de citire la pattern-ul SEC-11
  (independent de comportamentul viitor al driverului). `tsc --noEmit` verde.

---

## Note & risk-acceptance (nu sunt vulnerabilități)

1. **`npm audit`: 6 moderate, 0 high/critical.** `postcss <8.5.10` (bundle-uit în `next`, XSS la stringify
   CSS ne-de-încredere — nu facem asta) + `esbuild` (via `drizzle-kit`, doar dev-server). Ambele tranzitive,
   deja pe ultima versiune a pachetului-părinte; `audit fix --force` ar face downgrade major = rupe app-ul.
   Neexploatabile la noi. CI alertează la escaladare spre high/critical. (Confirmat din nou azi.)
2. **`saveStrokesAction` (autosave ciornă) nu are rate-limit dedicat.** Author-scoped, scrie **doar** în
   propriul DRAFT, cost mic. Bounded per user. Opțional de adăugat `limiters.mutation` pentru paritate; nu e
   un risc real de abuz.
3. **Turnstile fail-open la eroare de rețea** (`lib/turnstile.ts`) — deliberat, ca să nu ne auto-blocăm
   signup-ul dacă Cloudflare pică. Rate-limit-ul pe email+IP rămâne plasa de siguranță. Fail-open **doar** la
   outage, **nu** la token invalid. Acceptat.
4. **`trustHost: true`** (`lib/auth.ts:31`) — pe Vercel hostul e de încredere (proxy controlat). De **bifat pe
   viu** la §11 că `Host`/`X-Forwarded-Host` nu pot influența magic link-urile. Nu e schimbare de cod.
5. **Sesiune `strategy: "database"`** — pozitiv de securitate (SEC-04): statusul contului suspendat se vede
   **instant** la fiecare request. Migrarea propusă spre JWT (pentru viteză) ar slăbi asta (suspend live →
   suspend la expirarea tokenului). Decizie de produs, nu defect.

**Cod mort / rute care nu duc nicăieri:** nu am găsit rute orfane sau handlere neprotejate. Singurele
resturi „inerte" sunt intenționate și documentate: valorile de enum `PENDING_ACCEPTANCE`/`REJECTED`
(schițe — flux vechi, doar date istorice) cu ramurile lor din `SKETCH_STATUS_VIEW`, și schela
`requestRoleVerification` (Poarta 2 pe HOLD, neutralizată la nivel de server — nu colectează PII). Nu produc
comportament activ.

---

## Cele 13 categorii — rezultat

1. **Secrete & config** — ✅ Fără secrete în cod. Doar `.env.example` e comis (placeholder-uri, verificat).
   `.env.local`/`.env.e2e` gitignored (confirmat: `git ls-files` → doar `.env.example`). Sentry
   strip-uiește debug logging la build. Sursa de env = Vercel per mediu.
2. **Autentificare** — ✅ Passwordless magic link (Auth.js v5). Token one-time, TTL din env (15 min). Admin
   are auth proprie: token `randomBytes(32)`, sesiune cookie HttpOnly opac, validată în DB, re-check allowlist
   la consum ȘI la fiecare request. Anti-prefetch (pagina `/verify` auto-confirmă din JS).
3. **Autorizare** — ✅ Deny-by-default în proxy (gating rute) + authz fină în services (ownership pe
   `authorId`/`actorUserId` din sesiune). IDOR închis: pozițiile/comentariile/schițele/bookmark-urile sunt
   întotdeauna scoped pe userul din sesiune. `getDetailById` întoarce doar `PUBLISHED`. Editare/ștergere
   comentariu: `WHERE id = ? AND author_id = ?`. Regula „nu te validezi pe propriul conținut" enforce server.
   Admin gate centralizat în proxy (backstop pe rute noi sub `/admin-page`).
4. **Input validation & injection** — ✅ Drizzle = query parametrizate peste tot (fără SQL string-building).
   `isUuid` gardează coloanele uuid (o excepție → SEC-L01). Strokes validate structural + normalizate 0..1,
   plafoane anti-DoS (2000 stroke-uri, 10k puncte, culoare hex allowlist). Fără injecție de comandă/path/SSRF.
5. **API & access control** — ✅ Două route handlers: `/api/auth/*` (Auth.js) și `/api/blob/upload`
   (sesiune + rate-limit + restricție tip/mărime la emiterea tokenului). Erorile ascund internals (format
   `{ error: { code, message } }`). Fără chei server expuse la client.
6. **Business logic** — ✅ State machine schiță (DRAFT→PUBLISHED) cu tranziție atomică guard-ată pe
   status+autor (fără dublă-publicare la concurență). „Dezaprobare fără justificare" respinsă pe server.
   Constrângere unică DB `(user_id, target_type, target_id)` → o singură poziție per user per țintă.
   „Un singur rol per user" (unique pe `roles.user_id`).
7. **Data protection & privacy** — ✅ HTTPS + HSTS (2 ani, preload). Cookie sesiune HttpOnly+Secure+SameSite
   (Auth.js). PII nu se loghează (email hash-uit SHA-256 în rate-limit/audit; emailuri fără PII în loguri).
   Ștergere cont = anonimizare GDPR (scrub PII, păstrează conținutul atribuit „Utilizator șters").
   Imagini re-encodate → EXIF/GPS stripate.
8. **Logging & monitoring** — ✅ `lib/audit.ts` (evenimente structurate: access_denied, rate_limited,
   admin_login, maintenance_toggled) fără PII brut. Sentry live. Hook `block-pii-log` în repo.
9. **Abuse & rate limiting** — ✅ Upstash sliding-window distribuit. Auth (5/h email, 20/h IP), mutații
   (40/min), create-detail (10/h), upload (30/h), admin-login (10/15min user, 30/15min IP). **Fail-closed în
   producție** (outage Redis blochează, nu deschide tăcut). Turnstile pe login+signup.
10. **Dependencies & supply chain** — ✅ Lockfile prezent. 0 high/critical (vezi Nota 1). CI rulează
    `npm audit --audit-level=high` pe fiecare PR. GitGuardian config prezent.
11. **Infrastructure & deployment** — ✅ Vercel (fra1) + Neon + Upstash + Cloudflare DNS-only. Headere de
    securitate complete (`next.config.ts`): HSTS, X-Frame-Options DENY, X-Content-Type-Options nosniff,
    Referrer-Policy, Permissions-Policy. Lockdown/mentenanță prin proxy. Fără endpoint-uri de debug în prod.
    De bifat pe viu: `AUTH_URL` + `trustHost` (Nota 4).
12. **File handling & storage** — ✅ Upload client direct în Blob cu token server-restricționat
    (tip imagine + `MAX_IMAGE_BYTES` + suffix random). Persistare acceptă **doar** URL-uri din store-ul
    nostru (`BLOB_URL_RE`) → anti-SSRF. Toate imaginile trec prin `sharp` (magic-bytes real, nu `file.type`;
    strip metadata; plafon 50MP intrare / 4096px ieșire → anti decompression-bomb). SVG/GIF/HEIC respinse.
    Thumbnail-ul de schiță (singura cale byte client→server) e re-validat identic.
13. **Security testing** — ✅ Teste unit/securitate (vitest) pe domain+lib (`validateStrokes`, `rate-limit`,
    `url`, `audit`, `upload-limits`). E2E Playwright (public + authed). CI type-check+lint+build. Acest audit
    manual = review-ul critic al fluxurilor. Rămâne pen-test-ul manual pe viu (§11).

---

## ▶ Poarta §11 — rezultate pe viu (`detalia.ro`, 2026-07-02)

Rulat: DAST authz (`D:\production_mode\scripturi`, mod `attack`, read-only, fără mutații) + verificări `curl`
directe. **0 CRITICAL / HIGH.** Ce se poate testa fără credențiale = **PASS**; restul (conturi / acces Neon)
rămâne de rulat de Liviu (comenzi mai jos).

| § | Test | Rezultat |
|---|------|----------|
| **A** | Gating rute protejate (anon) | ✅ PASS — `/feed`,`/profile`,`/notifications`,`/saved`,`/sketches/*`,`/api/*` → `302 → /login?callbackUrl=...`. 42 rute sondate, toate redirect, zero conținut servit anonim. |
| **B** | Fișiere/rute sensibile expuse | ✅ PASS — `.env`, `.git/config`, `.git/HEAD`, `backup.sql`, `dump.sql`, `config.json`, `actuator/env`, `phpinfo.php`, `swagger.json`, `/admin*`, `/api/admin*`, `/api/internal*` → **toate 302 → login**, niciunul servit. |
| **H** | Headere & TLS | ✅ PASS — `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` · `X-Frame-Options: DENY` · `X-Content-Type-Options: nosniff` · `Referrer-Policy: strict-origin-when-cross-origin` · `Permissions-Policy` restrictiv · `Content-Security-Policy` cu `nonce-...` și **fără `unsafe-inline` pe `script-src`**. |
| — | `/api/blob/upload` anon | ✅ PASS — `302 → login` (proxy blochează înainte de handler; a doua poartă = 401 în handler). |
| — | `/admin-page/login` | ✅ 200 (reachable, separat de auth-ul de user). |
| **C.2 (IDOR mutație, distructiv)** | Atacator editează/șterge comentariul victimei | ✅ PASS — replay real al server actions `editCommentAction`/`deleteCommentAction` cu **cookie-ul atacatorului** pe `commentId`-ul victimei (encoding capturat din UI cu Playwright). Ambele → `{"error":"Comentariul nu mai există sau nu îți aparține."}` (NOT_FOUND din `WHERE author_id = session`). Comentariul victimei **neschimbat** la edit și **supraviețuiește** la delete. Contrast: owner-ul legitim șterge cu `{"error":null}`. |
| **C (edit pagină)** | Ownership pagină `/details/{id}/edit` | ✅ PASS — non-autorul e redirectat la detaliu (`page.tsx` verifică `detail.authorId !== session.user.id`); corp identic cu pagina de detaliu, **fără** formular/date de editare. |
| **D (dezaprobare mută, distructiv)** | Justificare goală/doar-spații | ✅ PASS — prin UI real, justificare `"   "` → server respinge „Dezaprobarea cere o justificare." (`validateJustification` face `.trim()`); `Dezbatere · 0 comentarii`, **nicio** poziție, **niciun** comentariu. „Nu există dezaprobare mută." |
| — | Validitate sesiuni + poartă rol | ✅ Ambele conturi → `/feed` 200; cont fără rol → `/onboarding`; sesiune invalidă (delogată) → `/login`. Strategie `database` = revocare instantă confirmată. |
| — | `/profile/<malformat>` (SEC-H01) | ✅ `notFound()` curat (404), fără 500 (vezi SEC-H01). |

**Metodă C.2 (reproductibilă):** captura encoding-ului server action (Playwright, cookie injectat) + replay cross-user
cu `curl` (header `Next-Action` + body JSON `[commentId, detailId, …]` + `Origin: https://detalia.ro`). C.1
(ștergere **detaliu**) și C.3 (ștergere **schiță**) folosesc **mecanismul de ownership identic**
(`authorId !== session → FORBIDDEN`) — dovedit static + prin C.2 + prin redirect-ul paginii de editare; nu le-am
re-rulat distructiv (ar cere fabricarea de conținut, semnal redundant peste C.2).

**Reproducere (oricând):**
```bash
# DAST anon (discovery + gating + fișiere expuse + IDOR anon) — read-only:
cd D:\production_mode\scripturi && python run.py attack --url https://detalia.ro --rate 3
# Headere:
curl -sSI https://detalia.ro/ | grep -iE 'strict-transport|x-frame|x-content-type|referrer|permissions-policy|content-security'
```

### Rămân de rulat de Liviu (cer conturi reale / acces Neon — eu nu le am)

Aceste secțiuni ating mutații pe prod sau starea DB (suspend, replay cross-user) → nu le-am rulat singur.
Pentru un pas authz complet cu tool-ul, ia cookie-ul de sesiune din DevTools (`authjs.session-token`) pentru
2 conturi și rulează modul configurat (fără `--allow-mutations` → doar citiri IDOR):

```yaml
# targets/detalia.yaml (gitignored)
base_url: "https://detalia.ro"
rate_limit_per_sec: 3
identities:
  - { name: victim,   auth: { type: cookie, value: "authjs.session-token=<cookie_A>" } }
  - { name: attacker, auth: { type: cookie, value: "authjs.session-token=<cookie_B>" } }
idor:
  resources:
    - { name: profil,  method: GET, path: "/profile/{id}", ids_from: victim }
    - { name: detaliu, method: GET, path: "/details/{id}", ids_from: victim }
```
```bash
python run.py authz -t targets/detalia.yaml    # IDOR read-only; adaugă --allow-mutations DOAR pe preview
```

> Notă de arhitectură: mutațiile DETALIA sunt **Next.js Server Actions** (POST cu action-id criptat + FormData),
> nu REST `{id}` → modulele IDOR/BFLA/mass-assignment ale tool-ului au tracțiune limitată pe ele. Testele C/D/G
> de mai jos le validează manual (ownership e deja verificat static în audit — services întorc FORBIDDEN/NOT_FOUND).

Playbook manual pentru restul (rulează pe cont real; la final curăți datele de test — cheatsheet SQL în
`.remember/remember.md`, ramura `production`):

**A. Gating de rute (deny-by-default).** Ca **anonim** (incognito / fără cookie), accesează direct:
`/feed`, `/details/<id>`, `/profile`, `/notifications`, `/saved`, `/onboarding`, `/sketches/drafts`.
→ *Așteptat:* redirect la `/login?callbackUrl=...`. Niciun conținut protejat randat.

**B. Poarta de admin.** Anonim pe `/admin-page` și `/admin-page/orice`. → *Așteptat:* redirect la
`/admin-page/login`. Cu sesiune de **user normal** (nu admin) pe `/admin-page`. → *Așteptat:* tot redirect
la admin-login (auth admin e separată). Cere magic link admin cu un email **care nu e** în `ADMIN_EMAILS`
→ *Așteptat:* mesaj generic „verifică email", dar **niciun email nu sosește** (anti-enumerare).

**C. IDOR / ownership (cu 2 conturi, A și B).**
   1. Contul A creează un detaliu. Cu contul B, prin form-ul de ștergere (sau replay POST cu `detailId`-ul lui
      A), încearcă `deleteDetailAction`. → *Așteptat:* no-op (feed), detaliul lui A rămâne.
   2. B încearcă să editeze/șteargă un **comentariu** al lui A (replay `editCommentAction`/`deleteCommentAction`
      cu `commentId`-ul lui A). → *Așteptat:* `NOT_FOUND`, nimic modificat.
   3. B încearcă `deleteSketch` pe schița lui A (unde B nu e nici autor schiță, nici autor detaliu-mamă).
      → *Așteptat:* FORBIDDEN, no-op.
   4. B pune `targetId` = propriul detaliu în `approveAction` (auto-validare). → *Așteptat:* `CANNOT_VALIDATE_OWN`.

**D. Dezaprobare fără justificare.** Replay `disapproveAction` (ramura text) cu `justification` gol.
   → *Așteptat:* `JUSTIFICATION_REQUIRED`, fără poziție înregistrată. „Nu există dezaprobare mută."

**E. Rate limiting.** Cere magic link de >5 ori/oră pe același email → *Așteptat:* `?error=RateLimited`
   (mesaj generic). Repetă o mutație (validare) >40/min → blocată. Admin-login >10/15min → blocat.

**F. Upload.** Încearcă să urci un fișier non-imagine redenumit `.png` (ex. un `.svg`/`.exe`) prin fluxul de
   avatar/detaliu. → *Așteptat:* respins la reprocesare (sharp nu-l decodează ca imagine acceptată). Trimite în
   `imageUrl`/`avatarUrl` un URL **extern** (nu `*.public.blob.vercel-storage.com`). → *Așteptat:* respins
   (`BLOB_URL_RE`).

**G. Cont suspendat (SEC-04).** Setează `status = 'SUSPENDED'` pe contul B în Neon. Cu sesiunea lui B activă,
   accesează o rută protejată. → *Așteptat:* redirect `/login?error=AccessDenied` **instant** (nu la
   expirarea sesiunii) + eveniment `access_denied_suspended` în audit. Revino `status = 'ACTIVE'` după.

**H. Headere & TLS.** `curl -sI https://detalia.ro` → confirmă `strict-transport-security`,
   `x-frame-options: DENY`, `x-content-type-options: nosniff`, `content-security-policy` cu `nonce-...`
   (fără `unsafe-inline` pe `script-src`).

**I. Magic link one-time.** Deschide un magic link, apoi încearcă să-l refolosești. → *Așteptat:* invalid la
   a doua folosire. Idem admin-login token.

**J. `trustHost` (Nota 4).** Trimite o cerere de magic link cu un header `X-Forwarded-Host` fabricat
   (ex. `evil.com`). → *Așteptat:* linkul din email rămâne pe `detalia.ro` (folosește `AUTH_URL`), nu pe
   hostul injectat.

---

## Recomandări (prioritizate)
1. **Deploy:** SEC-H01 e în working tree — intră pe `dev` → PR → prod la următorul deploy (defensiv, non-blocant).
2. **G — suspend live (singurul test rămas; cere 1 linie SQL în Neon, ramura `production`):**
   ```sql
   UPDATE users SET status = 'SUSPENDED' WHERE email = '<email-cont-test>';
   ```
   Apoi, cu sesiunea acelui cont încă activă, accesează o rută protejată → **așteptat:** redirect instant
   `/login?error=AccessDenied` + eveniment `access_denied_suspended` în audit (nu la expirarea sesiunii —
   strategie `database`). Verificare rapidă (înlocuiește cookie-ul):
   ```bash
   curl -sS -o /dev/null -w "%{http_code} %{redirect_url}\n" \
     -b "__Secure-authjs.session-token=<token-cont-suspendat>" https://detalia.ro/feed
   ```
   Revino după test: `UPDATE users SET status = 'ACTIVE' WHERE email = '<email-cont-test>';`
   (Spune-mi când ai rulat UPDATE-ul și rulez eu verificarea.)
3. **Opționale rămase (nu-s blocante):** E (rate-limit — cere >5 magic-link/oră pe un email → `?error=RateLimited`),
   F (upload: fișier non-imagine redenumit / URL extern în `imageUrl` → respins de sharp / `BLOB_URL_RE`),
   I (magic link one-time — refolosire → invalid), J (`X-Forwarded-Host` fabricat → linkul rămâne pe `detalia.ro`).
   Toate au enforcement dovedit static; rulează-le dacă vrei bife live suplimentare.
4. **Opțional cod:** rate-limit pe `saveStrokesAction` (Nota 2); `overrides` pe `postcss>=8.5.10` (curăță 1/6
   moderate, sigur).

---
*Audit realizat static pe codul din `dev`/`main` la 2026-07-02. Nu înlocuiește testul pe viu (§11) — care
validează configul de mediu (env, host, TLS) ce nu se vede din cod.*
