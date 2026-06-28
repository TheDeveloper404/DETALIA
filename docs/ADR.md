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

## ADR-007 — „Două porți": acces vs. credibilitate (verificare rol)
**Context:** confuzie frecventă între cine intră și cât „cântărește" odată intrat.
**Decizie:** le tratăm ca mecanisme **independente**. Verificarea = „pull, nu push" (opțională, fără blocare,
nudge blând, badge la verificat). Rol auto-declarat la signup.
**Consecințe:** frecare minimă la intrare + cerere organică de verificare din credibilitate. _(ARHITECTURA §3)_

## ADR-008 — Poarta de acces = PUBLIC (înregistrare deschisă)
**Context:** confirmat de Edi (iunie 2026) — minimizăm frecarea la primul contact; lansare = acces public deschis.
**Decizie:** înregistrare liberă, fără invitație. Flux: landing → creare cont → magic link → onboarding (rol+subrol) → feed.
**Consecințe:** logica de invitații a fost **eliminată complet** (2026-06-28, vezi CHANGELOG) — niciun cod dormant. Dacă se vrea vreodată acces restricționat, se construiește un mecanism nou. _(CLAUDE.md „Decizii confirmate de Edi")_

## ADR-009 — Upload de detalii DESCHIS userilor cu rol declarat
**Context:** confirmat de Edi (iunie 2026) — orice user autentificat cu rol declarat poate publica detalii (nu doar admin/seed).
**Decizie:** upload deschis + **moderare post-publicare** (publici direct, ștergem abuzurile ulterior); fără cozi de aprobare în MVP. Seed inițial rămâne prin conturi reale.
**Consecințe:** calitatea o dă validarea/dezbaterea pe roluri, nu un gatekeeper la intrare; mai multe fluxuri de securizat (validare input upload). _(CLAUDE.md „Decizii confirmate de Edi")_

## ADR-010 — Stack de date: Neon Postgres + Drizzle
**Context:** avem nevoie de relații (roluri, validări, schițe); cold start mic pe serverless; free tier real.
**Decizie:** Neon (serverless Postgres) + Drizzle (ORM tip-safe, fără engine binar).
**Consecințe:** $0 la validare, scale-to-zero; pgvector disponibil pentru search semantic ulterior (upgrade, nu rescriere). _(ARHITECTURA §2, §8)_

---

> Deciziile noi sau schimbările se consemnează aici (formă scurtă) + în `CHANGELOG.md` (cronologic, cu dată).
