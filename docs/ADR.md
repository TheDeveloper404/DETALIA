# DETALIA — Decizii de arhitectură (ADR — formă scurtă)

> Registru compact al deciziilor structurante și **de ce** au fost luate (context → decizie → consecințe).
> Forma e deliberat **ușoară** (nu ceremonie enterprise): la scara unui MVP de validare, `CHANGELOG.md` ține
> jurnalul cronologic, iar acest fișier fixează deciziile *durabile* într-un singur loc, ușor de revizitat.
> O decizie marcată **ÎN HOLD** rămâne reversibilă până la confirmare.

---

## ADR-001 — Single-app Next.js, nu monorepo cu backend separat
**Context:** fază de validare, buget ~$0, un dev, viteză până la MVP.
**Decizie:** o singură aplicație Next.js (App Router) pe Vercel; business izolat în `server/`.
**Consecințe:** cost și ops minime; extragerea unui API separat (Fastify) rămâne posibilă **fără rescriere**
fiindcă logica e deja izolată. Re-evaluăm doar dacă apar consumatori externi (mobil nativ, integrări). _(ARHITECTURA §2)_

## ADR-002 — Auth = magic link (passwordless), via Auth.js v5
**Context:** acces controlat, suprafață de atac minimă, fără management de parole.
**Decizie:** Auth.js Email provider (magic link), tokenuri scurte one-time.
**Consecințe:** endpoint-urile de parolă/reset/MFA din standardele moștenite **NU se aplică**; sesiuni/tokenuri
gestionate de framework. Se mulează natural pe invite-only. _(CLAUDE.md „Divergență Backend.md")_

## ADR-003 — Schițare asincronă „GitHub-style", NU co-desenare real-time
**Context:** co-desenarea real-time (CRDT/websockets) = cea mai scumpă și riscantă piesă.
**Decizie:** fiecare foaie = o schiță cu **un singur autor**, peste detaliul-mamă (overlay); colaborare prin
teanc (fork→PR), nu pe aceeași pânză. Confirmat de Edi.
**Consecințe:** elimină luna de complexitate real-time; schițarea rămâne feature **obligatoriu** în MVP. _(ARHITECTURA §7)_

## ADR-004 — Stroke-uri stocate VECTORIAL (jsonb, normalizat 0..1), nu PNG
**Context:** schițele trebuie redabile, scalabile pe orice ecran, dezbătute per foaie.
**Decizie:** `strokes_json` (jsonb) cu coordonate normalizate 0..1; thumbnail PNG randat **o singură dată** la publicare.
**Consecințe:** mic în DB, scalabil, viitor-proof; fără re-randare la fiecare hover. _(ARHITECTURA §7.3, SCHEMA)_

## ADR-005 — Validare/Comentariu POLIMORFICE (Detail SAU Sketch)
**Context:** vrem dezbatere și pe detaliu, și pe fiecare schiță, fără mecanisme duplicate.
**Decizie:** `target_type` + `target_id` pe `validations`/`comments`; constrângere unică `(user, target_type, target_id)`.
**Consecințe:** „o poziție/user, reversibilă" garantată de DB; dezbaterea per schiță iese gratis. Compromis:
fără FK forțat pe `target_id` → integritate în service + indici compuși. _(SCHEMA, ARHITECTURA §4)_

## ADR-006 — FĂRĂ ponderare numerică / scoring în MVP
**Context:** cererea clientului — greutatea o judecă cititorul după rol, nu un algoritm.
**Decizie:** construim doar **afișarea transparentă a rolului** lângă fiecare poziție; zero scor/reputație.
**Consecințe:** simplifică enorm inima aplicației; scoring = backlog, decizie de produs separată. _(ARHITECTURA §6)_

## ADR-007 — „Două porți": acces (invitație) vs. credibilitate (verificare rol)
**Context:** confuzie frecventă între cine intră și cât „cântărește" odată intrat.
**Decizie:** le tratăm ca mecanisme **independente**. Verificarea = „pull, nu push" (opțională, fără blocare,
nudge blând, badge la verificat). Rol auto-declarat la signup.
**Consecințe:** frecare minimă la intrare + cerere organică de verificare din credibilitate. _(ARHITECTURA §3)_

## ADR-008 — Poarta de acces (beta închis pe invitație) — **ÎN HOLD**
**Context:** plan actual = invite-only; de reconfirmat cu Edi (invite-only vs. înregistrare publică la lansare).
**Decizie (provizorie):** rămâne invite-only în plan, marcat reversibil până la confirmare.
**Consecințe:** nu finalizăm signup gating până nu confirmă Edi; codul de acces se izolează ca să fie ușor de schimbat. _(ARHITECTURA §3, §9)_

## ADR-009 — Upload de detalii = seed-only în v1
**Context:** controlul calității dezbaterii din ziua 1 + suprafață de atac redusă.
**Decizie:** doar conturi admin/seed creează detalii în v1; deschiderea pentru useri = Val 2. Confirmat de Edi.
**Consecințe:** lansare cu conținut curat (vezi `PLAN-SEED.md`); mai puține fluxuri de securizat la lansare. _(ARHITECTURA §9, §12)_

## ADR-010 — Stack de date: Neon Postgres + Drizzle
**Context:** avem nevoie de relații (roluri, validări, schițe); cold start mic pe serverless; free tier real.
**Decizie:** Neon (serverless Postgres) + Drizzle (ORM tip-safe, fără engine binar).
**Consecințe:** $0 la validare, scale-to-zero; pgvector disponibil pentru search semantic ulterior (upgrade, nu rescriere). _(ARHITECTURA §2, §8)_

---

> Deciziile noi sau schimbările se consemnează aici (formă scurtă) + în `CHANGELOG.md` (cronologic, cu dată).
