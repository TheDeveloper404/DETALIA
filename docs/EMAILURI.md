# DETALIA — Copy emailuri (Resend)

> Textele emailurilor trimise de la început (magic link + notificări schiță). Parte de **brand**
> (Edi le vrea pentru awareness/recall), nu doar funcțional. Trimitere via **Resend**, de pe domeniul deținut.
> Status: draft de copy — se rafinează cu Edi pe ton. Variabilele `{{...}}` se completează la trimitere.

---

## Reguli (din securitate)

- **PII (email, tokenuri, dovezi) NU se loghează** — doar metadate (tip email, timestamp, status livrare).
- **Linkul cu token e one-time, cu expirare** (magic link scurt; TTL din env).
- Expeditor: `EMAIL_FROM` (verificat SPF/DKIM în Resend) → ajunge în inbox, nu spam.
- Fiecare email: subiect clar + un singur CTA principal + footer cu identitate. Fără atașamente, fără tracking agresiv.

---

## 1. Magic link (login)

- **Subiect:** `Linkul tău de acces în DETALIA`
- **Preheader:** `Apasă pentru a intra. Linkul expiră în {{ttl_minutes}} minute.`

```
Salut{{#name}} {{name}}{{/name}},

Apasă butonul de mai jos ca să intri în DETALIA. Din motive de siguranță,
linkul funcționează o singură dată și expiră în {{ttl_minutes}} minute.

[ Intră în DETALIA ]  → {{magic_link_url}}

Dacă nu ai cerut tu acest link, poți ignora liniștit acest email.

— Echipa DETALIA
```

---

## 2. Notificare: schiță propusă (către autorul detaliului-mamă)

- **Subiect:** `{{author_name}} a propus o modificare pe detaliul tău`
- **Preheader:** `O nouă schiță așteaptă să fie acceptată în teancul tău.`

```
Salut {{owner_name}},

{{author_name}} ({{author_role}}) a propus o schiță peste detaliul tău
„{{detail_title}}".

Vizualizeaz-o și decide dacă o accepți în teanc (devine publică) sau o respingi.

[ Vezi schița ]  → {{sketch_url}}

— DETALIA
```

---

## 3. Notificare: schiță acceptată (către autorul schiței)

- **Subiect:** `Schița ta a fost acceptată`

```
Salut {{author_name}},

{{owner_name}} a acceptat schița ta pe detaliul „{{detail_title}}".
E acum publică, în teancul detaliului — oricine o poate vedea și dezbate.

[ Vezi schița ]  → {{sketch_url}}

— DETALIA
```

---

## 4. Notificare: schiță respinsă (către autorul schiței)

- **Subiect:** `Actualizare la schița ta`

```
Salut {{author_name}},

{{owner_name}} nu a acceptat de această dată schița ta pe detaliul
„{{detail_title}}".{{#reason}} Motiv: {{reason}}.{{/reason}}

Poți relua oricând cu o variantă nouă.

— DETALIA
```

---

## Note de implementare

- Template-urile trăiesc în `lib/email/` (sau `emails/` cu React Email, decizie la implementare).
- Conținutul dinamic vine din `NotificationService` → un singur loc care trimite și in-app, și email.
- Tonul: profesional, scurt, fără marketing agresiv — respectul pentru timpul unui specialist.
