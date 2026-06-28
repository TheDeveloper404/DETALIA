# DETALIA — Confidențialitate & GDPR (notă de lucru + schelet ToS)

> ⚠️ **Risc real, nu birocrație — acum mai urgent.** DETALIA colectează **emailuri**, **dovezi de verificare rol
> (nr. OAR / CUI)** și **conținut încărcat de useri** (detalii + schițe, imagini ce pot conține PII) = date cu
> caracter personal, în RO/UE. **Decizia de acces e PUBLIC** (înregistrare deschisă, upload deschis userilor — Edi,
> iunie 2026), deci NU mai există faza „beta închis cu cunoscuți" în care riscul era mic: **nota de confidențialitate
> + ToS trebuie publicate ÎNAINTE de lansarea publică**, nu „mai târziu". Acest document e **nota de lucru** +
> scheletul textelor — **nu** consultanță juridică. Înainte de public: revizuire de jurist.

---

## 1. Ce date colectăm și de ce (registrul de prelucrări — minim)

| Dată | Scop | Temei (GDPR) | Reținere |
|---|---|---|---|
| Email | autentificare (magic link), notificări | execuția serviciului / interes legitim | cât e contul activ |
| Nume + rol declarat | afișare transparentă lângă contribuții (inima produsului) | execuția serviciului | cât e contul activ |
| Dovezi verificare (nr. OAR / CUI) | verificarea rolului → badge | consimțământ (userul vine singur) | până la verificare + termen rezonabil |
| Conținut (validări, comentarii, schițe) | funcționarea comunității | execuția serviciului | cât e contul activ |
| Token invitație / magic link | acces / login | execuția serviciului | one-time, expiră (TTL din env) |
| Metadate tehnice (loguri) | securitate, debugging | interes legitim | scurt; **fără PII în loguri** |

**Principii deja aplicate în arhitectură:**
- **Minimizare:** cerem doar ce e necesar. Dovezile de rol vin **doar dacă userul alege** să se verifice („pull").
- **PII NU se loghează** (hook `block-pii-log` blochează email/tokenuri/dovezi în loguri — vezi `ARHITECTURA.md §11`).
- **Securitate:** passwordless (fără parole de scurs), tokenuri one-time cu expirare, secrete în env.

---

## 2. Drepturile persoanei (de implementat înainte de public)

Acces · rectificare · ștergere („dreptul de a fi uitat") · portabilitate · retragerea consimțământului
(pentru dovezile de verificare).

**Ștergerea contului — IMPLEMENTAT (self-service, 2026-06-28).** `/profile/edit` → „Șterge contul" (confirmare în
2 pași). Politică = **anonimizare (tombstone)**, nu hard-delete:
- **Șterse din DB:** email (→ placeholder non-PII `deleted-<id>@deleted.invalid`), nume real (firstName/lastName,
  `name` → eticheta „Utilizator șters"), poze (avatar + cover, inclusiv blob-urile), website, headline, about,
  locație, emailVerified, **dovezile de rol** (`verificationEvidence`). Sesiuni + conturi OAuth șterse (logout).
- **Păstrate:** detaliile, schițele, comentariile, validările — atribuite „Utilizator șters" (altfel s-ar distruge
  teancul și dezbaterile altor useri). Rolul declarat (main/sub, non-PII) rămâne ca context al conținutului.
- **Status `DELETED`** → re-login imposibil (blocat de SEC-04). Cod: `server/services/accountService.ts`.

Restul drepturilor (acces/portabilitate) rămân manuale (cerere → admin) în MVP.

---

## 3. Schelet — Notă de confidențialitate (de completat + revizuit juridic)

```
1. Cine suntem (operator de date) + contact
2. Ce date colectăm (vezi tabelul de mai sus)
3. De ce le colectăm (scopuri + temei legal)
4. Cât le păstrăm
5. Cu cine le partajăm (procesatori: Vercel, Neon, Resend — sub-procesatori GDPR-compliant)
6. Drepturile tale + cum le exerciți
7. Securitate (cum protejăm datele)
8. Cookies (sesiune Auth.js — strict necesare)
9. Modificări ale notei + dată
```

## 4. Schelet — Termeni și condiții (de completat + revizuit juridic)

```
1. Ce este serviciul + cui se adresează
2. Reguli de conduită în comunitate (conținut, respect, rol declarat onest)
3. Proprietatea asupra conținutului (detalii seed vs. contribuții useri)
4. Verificarea rolului (ce înseamnă badge-ul, că NU garantăm noi competența)
5. Limitarea răspunderii (detaliile sunt opinii profesionale, nu avize)
6. Suspendare/închidere cont
7. Lege aplicabilă (RO) + modificări
```

---

## 5. Procesatori (sub-procesatori) folosiți

| Procesator | Ce procesează | Note |
|---|---|---|
| Vercel | hosting, loguri | DPA disponibil |
| Neon | baza de date (PII la rest) | regiune UE recomandată |
| Resend | trimitere email (adrese) | DPA disponibil |
| Vercel Blob | imagini/thumbnail-uri | fără PII direct |

> Ce ține de Edi aici (entitatea operator, regiunea DB) → **`docs/DECIZII-EDI.md`**.

---

## 6. Status & următorii pași

- [x] Principii aplicate în arhitectură (minimizare, fără PII în loguri, tokenuri one-time).
- [ ] **Înainte de Val 2 / public:** publicare Notă confidențialitate + ToS (revizuite de jurist).
- [x] Flux automat de ștergere cont + date (anonimizare, 2026-06-28 — vezi §2).
- [ ] Confirmare regiune UE pentru Neon + entitatea operator → vezi `docs/DECIZII-EDI.md`.
