# Emailuri de activitate

Politica de produs: `CONTEXT.md`; decizia de implementare: ADR-032.

## Activare, in ordine

1. Aplica SQL-ul din `db/migrations/0029_hard_sugar_man.sql` pe **dev**, apoi pe **prod**, inainte de deploy-ul codului care citeste noile coloane. Este aditiv; notificarile istorice raman cu `email_due_at=NULL`, fara backfill.
2. Pe Preview ruleaza `npx playwright test --project=authed e2e/activity-notifications.spec.ts`. Preview nu trimite emailuri de activitate, chiar daca flagul este pornit.
3. Production necesita `AUTH_RESEND_KEY`, `EMAIL_FROM` verificat, `AUTH_SECRET` si `CRON_SECRET`. Pune `NOTIFICATION_EMAILS_ENABLED=true` si redeploy dupa verificari. Nu este nevoie de un secret/provider nou; nu partaja cheile intre Preview si Production.
4. Vercel Cron apeleaza `/api/cron/notification-emails` la fiecare 5 minute. Endpoint-ul cere `Authorization: Bearer CRON_SECRET`; raspunsul si auditul contin doar numere agregate. Nu apela procesorul local cu baza de productie pentru teste.

`IMPORTANT`: cand primul eveniment a asteptat 30 min, mesajul include si evenimentele necitite mai recente pentru acelasi detaliu. `DAILY`: un batch per destinatar/cutoff 07:00 UTC; restul ramane pentru ziua urmatoare. Preferinta de activitate si bifa digestului saptamanal sunt independente.

## Trimitere si retry

Notificarea este randul de coada; scadenta se scrie atomic cu ea. Claim-ul creeaza batch-uri si leaga notificarile intr-un singur CTE, cu mutex per destinatar si `SKIP LOCKED`. Se proceseaza maximum 50 de batch-uri pe rulare, in grupuri de 5 cu pauza de o secunda; restul ramane in coada. Limita publica Resend este comuna echipei, inclusiv login-ului: [documentatia Resend](https://resend.com/docs/api-reference/rate-limit).

Fiecare claim are lease de 2 minute si token de fencing. Snapshotul expeditor/destinatar/subiect/HTML/text se persista inainte de Resend. Retry-ul foloseste acelasi payload si `notification-delivery/<id>`; accesul, citirea, contul activ, tinta si preferinta se reverifica chiar inainte de trimitere. O schimbare dupa snapshot anuleaza batch-ul inghetat, fara generarea automata a altui mesaj pentru acel rezultat incert.

Un timeout sau raspuns respins lasa batch-ul pentru retry dupa 5 minute. Timpul curent se verifica chiar inaintea cererii, cu marja de 10 secunde pentru timeout; aproape de limita de 24h de la prima incercare devine `FAILED`, fara retry automat, deoarece [idempotenta Resend expira dupa 24h](https://resend.com/docs/dashboard/emails/idempotency-keys). `FAILED` necesita verificare manuala in Resend; nu reseta statusul sau cheia pentru a forta retrimiterea unui rezultat incert. Un mesaj deja acceptat de provider nu poate fi retras daca utilizatorul citeste ori pierde accesul dupa cerere.

Terminalele sterg snapshotul si scadenta asociata, pastrand notificarea in-app. Cronul de retentie elimina batch-urile terminale vechi, fara a atinge batch-urile in asteptare. Grupurile de aprobari sunt exceptate de la stergerea notificarilor citite: pastreaza istoricul actorilor, ca aceeasi aprobare sa nu reapara ca noua dupa 15 zile (decizie Liviu, 2026-10-30). Functia are `maxDuration=300`, conform [configurarii Vercel](https://vercel.com/docs/functions/configuring-functions/duration).

## Oprire si rollback

`NOTIFICATION_EMAILS_ENABLED=false` opreste procesorul; notificarile in-app continua. SQL-ul aditiv poate ramane instalat la rollback. Inainte de revenirea la o versiune veche care nu cunoaste `APPROVAL_RECEIVED`, fa backup si elimina doar notificarile de acel tip; vechea interfata nu stie sa le randeze. Nu sterge coloanele/tabelul cat timp ruleaza codul nou si nu reseta batch-uri cu rezultat incert.

Verificare agregata, fara destinatari sau continut:

```sql
SELECT status, count(*) FROM notification_email_deliveries GROUP BY status;
SELECT count(*) FROM notifications WHERE email_due_at IS NOT NULL AND email_delivery_id IS NULL AND read_at IS NULL;
```

## Verificari

Unit/integrare: coada atomica, grupare/concurenta, cutoff zilnic, lease/fencing, snapshot/retry, acces revocat, citire, ciorne/foi ascunse, cont suspendat/sters, preferinte, dezabonare HMAC, aprobari fara dubluri. E2E-ul pregatit foloseste conturi izolate, fara a trimite emailuri reale. Suplimentar: verificare manuala a unui email real in Production dupa activare si aprobarea auditului; SQL-ul nu a fost executat live de agent.
