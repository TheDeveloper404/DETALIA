# DETALIA — Copy emailuri (Resend)

> Textele emailurilor efectiv trimise (magic link + notificări schiță), sincronizate cu implementarea din
> `lib/email.ts` (template-uri) + `server/services/notificationService.ts` (trimitere). Parte de **brand**
> (awareness/recall), nu doar funcțional. Trimitere via **Resend**, de pe domeniul deținut (`send.detalia.ro`).
>
> **Emailurile de notificare (§2, §3) sunt OPRITE** (flag `NOTIFICATION_EMAILS_ENABLED`, default off) — cota
> Resend free rămâne rezervată magic link-ului (§1), care rămâne activ necondiționat. Notificarea in-app e
> singura cale curentă pentru schiță propusă/ștearsă. Template-urile există în cod și rămân documentate mai
> jos pentru repornire rapidă (`NOTIFICATION_EMAILS_ENABLED=true`), fără să fie trimise efectiv acum.

---

## Reguli (din securitate)

- **PII (email, tokenuri, dovezi) NU se loghează** — doar metadate (tip email, timestamp, status livrare).
- **Linkul cu token e one-time, cu expirare** (magic link scurt; TTL din env `MAGIC_LINK_TTL_MINUTES`).
- Expeditor: `EMAIL_FROM` (verificat SPF/DKIM în Resend) → ajunge în inbox, nu spam.
- Fiecare email: subiect clar + un singur CTA principal + footer cu identitate brand (`emailLayout()`).
  Fără atașamente, fără tracking agresiv.
- Emailul e **secundar** — notificarea in-app rămâne sursa principală. Trimiterea e best-effort: dacă
  lipsesc credențialele Resend sau serviciul e down, fluxul aplicației nu se blochează.

---

## 1. Magic link (login) — `magicLinkEmailHtml` / `magicLinkEmailText`

- **Subiect:** `Conectează-te în DETALIA`
- **Titlu:** Autentificare în DETALIA
- **Corp:** „Apasă butonul de mai jos ca să te conectezi. Linkul e valabil `{ttlMinutes}` de minute și poate
  fi folosit o singură dată."
- **CTA:** „Conectează-te" → link click-through (`/verify?u=...`, anti-prefetch — vezi `app/verify/page.tsx`).
- **Footer:** „Dacă nu ai cerut acest email, poți să-l ignori."

---

## 2. Notificare: schiță propusă (către autorul detaliului-mamă) — `sketchProposedEmailHtml` / `Text` — OPRITĂ

> Trimisă la **publicare** (`sketchService.publish`) — schița intră **direct** în teanc, fără flux de
> acceptare/respingere (eliminat 2026-06-30, vezi CHANGELOG). Emailul e informativ, nu o cerere de decizie.

- **Subiect:** `{author_name} a schițat peste „{detail_title}"`
- **Titlu:** Schiță nouă pe detaliul tău
- **Corp:** „`{author_name}` a publicat o schiță peste detaliul tău **`{detail_title}`**."
- **CTA:** „Vezi schița în teanc" → `{AUTH_URL}/details/{detailId}`

---

## 3. Notificare: schiță ștearsă (către autorul schiței) — `sketchDeletedEmailHtml` / `Text` — OPRITĂ

> Trimisă când autorul detaliului-mamă șterge o schiță (moderare post-publicare, `deleteSketch`).

- **Subiect:** `Schița ta la „{detail_title}" a fost eliminată`
- **Titlu:** Schița ta a fost eliminată
- **Corp:** „Schița ta de la detaliul **`{detail_title}`** a fost eliminată de autorul detaliului."
- **CTA:** „Vezi detaliul" → `{AUTH_URL}/details/{detailId}`

---

## Note de implementare

- Template-urile (HTML + text) trăiesc în **`lib/email.ts`** — un singur fișier, shell brand comun
  `emailLayout()` (wordmark, card, footer), fără librărie externă (React Email etc.).
- Trimiterea trece prin `server/services/notificationService.ts` → `notify()`, care scrie **întotdeauna**
  notificarea in-app; emailul de notificare (§2, §3) e trimis **doar** dacă `NOTIFICATION_EMAILS_ENABLED=true`
  (default: false — oprit din 2026-07-03) ȘI userul are contact ȘI credențialele Resend sunt setate. Magic
  link-ul (§1) e neafectat de acest flag.
- Escaping HTML (titlu/nume de user, anti-XSS) se face în `lib/email.ts`, în interiorul fiecărui template —
  apelantul (`notificationService`) pasează valori brute.
- Tonul: profesional, scurt, fără marketing agresiv — respectul pentru timpul unui specialist.
- **Nu există** (încă) notificări de „schiță acceptată"/„schiță respinsă" — modelul vechi de accept/reject a
  fost eliminat odată cu publicarea directă (2026-06-30). Dacă apare vreodată un flux nou care le-ar readuce,
  actualizează acest document odată cu codul.
