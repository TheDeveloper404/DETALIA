# Teste E2E (Playwright)

E2E rulează pe un mediu **deja pornit** (preview Vercel sau dev local) — configul **nu** pornește un server
(`webServer` lipsește intenționat). Mediul-țintă se dă prin `E2E_BASE_URL`.

## Rulare rapidă (fluxuri publice, fără secrete)

1. (o singură dată) instalează browserele Playwright:
   ```
   npx playwright install chromium
   ```
2. Setează URL-ul mediului-țintă (URL-ul de preview al PR-ului sau `http://localhost:3000`) într-un
   fișier `.env.e2e` (negitat) la rădăcina repo-ului:
   ```
   E2E_BASE_URL=https://<preview-url>.vercel.app
   ```
3. Rulează:
   ```
   npm run e2e          # headless
   npm run e2e:ui       # mod UI (debug vizual)
   ```

## Proiecte
- **`public`** — fluxuri fără auth. Nu cere DB. Rulează oricând doar cu `E2E_BASE_URL`.
- **`setup`** (`auth.setup.ts`) — seedează în DB user+rol+sesiune+detaliu și salvează `storageState`. Cere `DATABASE_URL`.
- **`authed`** (`authed.spec.ts`) — depinde de `setup`, pornește cu sesiunea seedată.

## Fluxuri AUTHED — pas suplimentar
Auth-ul e passwordless (magic link) → nu putem „tasta parola". Autentificăm seedând direct o **sesiune Auth.js**
(strategie `database`): `auth.setup.ts` inserează user ACTIVE + rol + rând în `sessions` (+ cookie
`authjs.session-token` / `__Secure-...` pe https) pe ramura Neon a mediului-țintă și salvează `storageState`.
**ZERO cod de bypass în producție** — e exact modelul de sesiune al Auth.js, doar pre-populat.

Pune și `DATABASE_URL`-ul mediului-țintă în `.env.e2e` (ramura Neon `preview/dev` sau cea locală):
```
E2E_BASE_URL=https://<preview-url>.vercel.app
DATABASE_URL=postgresql://...                 # ramura Neon a ACELUIAȘI mediu ca E2E_BASE_URL
VERCEL_AUTOMATION_BYPASS_SECRET=...           # vezi mai jos — preview-urile cer login Vercel altfel
```

**Deployment Protection:** preview-urile Vercel sunt în spatele unui zid de login SSO → fără bypass, Playwright
primește pagina de login Vercel, nu aplicația. Activează o dată: Vercel → proiect → Settings → Deployment Protection
→ **Protection Bypass for Automation** → Add Secret → pune-l în `VERCEL_AUTOMATION_BYPASS_SECRET`. Configul trimite
automat headerul `x-vercel-protection-bypass` pe fiecare request.
Seed-ul creează userul `e2e-tester@detalia.test` + un detaliu de test în acea bază (mutație pe preview, non-prod).

## Ce acoperă acum
- `public.spec.ts` — landing + CTA, formular login/signup, `/verify-request`, deny-by-default, 404.
  Nu trimite signup-ul (ar declanșa email real + rate limit).
- `authed.spec.ts` — feed authed, profil propriu, **validarea pe roluri** (Aprob 1 click + Dezaprob cu
  justificare obligatorie → comentariu), comentariu pe detaliu.

## Următor (opțional)
Schița send/accept/reject — necesită desen pe canvas (flaky în E2E); de adăugat când stabilizăm un helper de stroke-uri.
