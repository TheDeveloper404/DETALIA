# Decizii care depind de Edi

> Lucruri pe care NOI nu le putem hotărî singuri — le decide Edi. Codul merge înainte fără ele,
> dar de la un punct ne blochează lansarea. Bifează pe măsură ce le primim.

---

## Avem nevoie de ele curând (blochează lansarea)

1. [x] **Lista de categorii** — răspuns primit + **implementat** 2026-07-02 (multi-categorie tip tag,
   29 categorii pe 3 secțiuni). Sursa: `lista_categorii.md` (poate fi ștearsă, conținutul a trecut în
   `server/domain/detail.ts` + `db/seed.ts`; vezi CHANGELOG 2026-07-02).

2. [x] **Lista de meserii (subroluri)** — răspuns primit + **implementat** 2026-07-02 (`server/domain/roles.ts`).
   Sursa: `lista_meserii.md` (poate fi ștearsă; vezi CHANGELOG 2026-07-02).

3. [x] **Cine pune conținutul de start** — decis: câțiva oameni reali cu meserii diferite (nu un singur cont).
   *Decis, NEEXECUTAT — execuția (conturi + conținut seed) e pas separat, vezi `docs/PLAN-SEED.md`.*

4. [x] **Primii oameni aduși la lansare** — decis: listă echilibrată pe meserii, nu doar proiectanți.
   *Decis, NEEXECUTAT — outreach, nu cod.*

5. [x] **Acceptă păreri reale de start** — decis: da, 2–3 detalii, semnate cu meseria reală, niciodată inventate.
   *Decis, NEEXECUTAT — se face odată cu seed-ul de conținut.*

6. [x] **Când zicem că „a mers"** — exemplul propus e OK: „în 2 săptămâni, măcar un detaliu pe care 2 meserii se contrazic".

---

## Mai târziu (nu blochează acum)

7. [x] **Zonele climatice / seismice** — răspuns primit + **implementat** 2026-07-02: zonă climatică (Zona
   I–IV), seismic a_g + Tc separate, încărcare zăpadă, încărcare vânt — liste fixe. Sursa: `lista_categorii.md`.

8. [ ] **Câte resurse în plus** — Edi a răspuns „3 — vor fi doar poze" (`decizi-luate-edi.md`). **NEALINIAT
   cu codul**: `server/domain/detail.ts` permite azi IMAGE/LINK/PDF/TEXT, nu doar imagini. De discutat cu
   Liviu dacă restrângem la IMAGE sau păstrăm variantele curente.

9. [ ] **Verificarea automată a meseriei** — Edi a răspuns: fază 1 = chestionar online (inclusiv date
   oficiale gen nr. TNA la arhitecți) → rol verificat manual (Edi). Automatizare (OAR/CUI) rămâne ulterioară.
   Neimplementat — verificarea manuală „pull, nu push" existentă rămâne valabilă ca fază 1 provizorie.

10. [ ] **Cine deține conținutul postat** — Edi a răspuns: conținutul e deținut de autori, nu de platformă.
    Rămâne de scris în Termeni și Condiții (document neexistent încă).

11. [ ] **Pe ce firmă / persoană e platforma** — Edi a răspuns: se va face un SRL la un moment dat. Fără
    acțiune de cod acum; blochează doar Termenii/GDPR finali.

12. [x] **Plan Vercel** — confirmat de Edi: pornim gratis, trecem pe plătit (~20$/lună) când devine comercial.
