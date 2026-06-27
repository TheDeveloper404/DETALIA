# DETALIA — Copy emailuri (Resend)

> Textele emailurilor trimise de la început (magic link + invitație + notificări schiță). Parte de **brand**
> (Edi le vrea pentru awareness/recall), nu doar funcțional. Trimitere via **Resend**, de pe domeniul deținut.
> Status: draft de copy — se rafinează cu Edi pe ton. Variabilele `{{...}}` se completează la trimitere.

---

## Reguli (din securitate)

- **PII (email, tokenuri, dovezi) NU se loghează** — doar metadate (tip email, timestamp, status livrare).
- **Linkurile cu token sunt one-time, cu expirare** (magic link scurt; invitație cu TTL din env).
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

## 2. Invitație în beta închis

> ⚠️ Acces = **PUBLIC** (Edi, iunie 2026) → invitația e **DORMANTĂ** (necablată în signup). Copy-ul rămâne doar pentru un eventual reuse.

- **Subiect:** `Ai fost invitat în DETALIA`
- **Preheader:** `Comunitatea profesională din construcții, organizată pe detaliul de execuție.`

```
Salut,

Ai fost invitat să intri în DETALIA — comunitatea unde detaliile de execuție
sunt aprobate, contestate cu argument și îmbunătățite prin schiță, de către
profesioniștii care le proiectează, le execută sau le trăiesc.

Invitația ta este personală și expiră în {{ttl_hours}} ore.

[ Acceptă invitația ]  → {{invite_url}}

La prima intrare îți vei declara rolul (proiectant, executant, furnizor sau
beneficiar). Accesul e imediat.

— Echipa DETALIA
```

---

## 3. Notificare: schiță propusă (către autorul detaliului-mamă)

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

## 4. Notificare: schiță acceptată (către autorul schiței)

- **Subiect:** `Schița ta a fost acceptată`

```
Salut {{author_name}},

{{owner_name}} a acceptat schița ta pe detaliul „{{detail_title}}".
E acum publică, în teancul detaliului — oricine o poate vedea și dezbate.

[ Vezi schița ]  → {{sketch_url}}

— DETALIA
```

---

## 5. Notificare: schiță respinsă (către autorul schiței)

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
