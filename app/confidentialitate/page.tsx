import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Confidențialitate — DETALIA",
  description: "Notă de confidențialitate (GDPR) DETALIA — ce date colectăm, de ce, și drepturile tale.",
};

// Notă de confidențialitate (GDPR) — conținut sincronizat cu registrul din docs/CONFIDENTIALITATE-GDPR.md.
// La orice schimbare a datelor colectate/procesatorilor, actualizează AMBELE (doc intern + pagina publică).
export default function ConfidentialitatePage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
      <p className="mb-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Document de lucru — publicat pentru transparență, în curs de revizuire juridică. Nu constituie
        consultanță juridică finală.
      </p>

      <h1 className="mb-2 font-heading text-3xl font-extrabold tracking-tight">Notă de confidențialitate</h1>
      <p className="mb-8 text-sm text-muted-foreground">Ultima actualizare: 2026-07-07</p>

      <div className="flex flex-col gap-8 text-[15px] leading-relaxed text-foreground/90">
        <section>
          <h2 className="mb-2 text-lg font-bold">1. Cine suntem</h2>
          <p>
            DETALIA este operat de o echipă în curs de înregistrare ca persoană juridică (SRL) — datele de
            identificare ale firmei (denumire, CUI, sediu social) se completează aici imediat ce înregistrarea
            e finalizată. Pentru orice întrebare legată de datele tale, ne poți scrie la{" "}
            <a href="mailto:support@detalia.ro" className="font-semibold text-primary hover:underline">
              support@detalia.ro
            </a>
            .
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-bold">2. Ce date colectăm și de ce</h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="py-2 pr-4 font-semibold">Dată</th>
                  <th className="py-2 pr-4 font-semibold">Scop</th>
                  <th className="py-2 pr-4 font-semibold">Temei</th>
                  <th className="py-2 font-semibold">Reținere</th>
                </tr>
              </thead>
              <tbody className="text-muted-foreground">
                <tr className="border-b border-border/60">
                  <td className="py-2 pr-4">Email</td>
                  <td className="py-2 pr-4">autentificare (link de conectare), notificări</td>
                  <td className="py-2 pr-4">execuția serviciului</td>
                  <td className="py-2">cât e contul activ</td>
                </tr>
                <tr className="border-b border-border/60">
                  <td className="py-2 pr-4">Nume + rol declarat</td>
                  <td className="py-2 pr-4">afișare transparentă lângă contribuțiile tale</td>
                  <td className="py-2 pr-4">execuția serviciului</td>
                  <td className="py-2">cât e contul activ</td>
                </tr>
                <tr className="border-b border-border/60">
                  <td className="py-2 pr-4">Dovezi verificare rol</td>
                  <td className="py-2 pr-4">verificarea rolului (badge) — feature în prezent indisponibil</td>
                  <td className="py-2 pr-4">consimțământ (îl trimiți tu, opțional)</td>
                  <td className="py-2">până la verificare + termen rezonabil</td>
                </tr>
                <tr className="border-b border-border/60">
                  <td className="py-2 pr-4">Conținut (detalii, schițe, comentarii, validări)</td>
                  <td className="py-2 pr-4">funcționarea comunității</td>
                  <td className="py-2 pr-4">execuția serviciului</td>
                  <td className="py-2">cât e contul activ</td>
                </tr>
                <tr className="border-b border-border/60">
                  <td className="py-2 pr-4">Token de conectare (magic link)</td>
                  <td className="py-2 pr-4">autentificare</td>
                  <td className="py-2 pr-4">execuția serviciului</td>
                  <td className="py-2">o singură folosire, expiră rapid</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">Date tehnice (loguri, erori)</td>
                  <td className="py-2 pr-4">securitate, depanare</td>
                  <td className="py-2 pr-4">interes legitim</td>
                  <td className="py-2">termen scurt; fără date personale sensibile în loguri</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-bold">3. Cu cine partajăm datele</h2>
          <p>
            Nu vindem și nu partajăm datele tale cu terți în scop de marketing. Folosim un număr limitat de
            furnizori tehnici (procesatori de date), strict pentru a face platforma să funcționeze — găzduire,
            bază de date, trimitere de emailuri de conectare și stocare de imagini.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-bold">4. Drepturile tale</h2>
          <p className="mb-2">Ai dreptul la acces, rectificare, ștergere, portabilitate și retragerea consimțământului (pentru dovezile de verificare).</p>
          <p>
            <strong className="text-foreground">Ștergerea contului</strong> se face direct din platformă
            (Profil → Editează → &bdquo;Șterge contul&rdquo;), cu confirmare în 2 pași. Datele personale
            identificabile (email, nume, poze, dovezi de rol) sunt anonimizate; conținutul contribuit rămâne,
            atribuit generic &bdquo;Utilizator șters&rdquo;, ca să nu distrugă discuțiile altor useri. Pentru
            celelalte drepturi
            (acces, portabilitate), scrie-ne la{" "}
            <a href="mailto:support@detalia.ro" className="font-semibold text-primary hover:underline">
              support@detalia.ro
            </a>
            .
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-bold">5. Securitate</h2>
          <p>
            Conectarea se face fără parolă (link unic, valabil o singură dată, cu expirare scurtă). Nu logăm
            date personale sensibile (email, tokenuri, dovezi de rol) în sistemele noastre de monitorizare
            tehnică — doar metadate. Datele sunt criptate în tranzit.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-bold">6. Cookie-uri</h2>
          <p>
            Folosim un singur cookie, strict necesar pentru menținerea sesiunii tale de conectare. Nu folosim
            cookie-uri de tracking sau marketing.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-bold">7. Modificări</h2>
          <p>
            Putem actualiza această notă pe măsură ce platforma evoluează. Data ultimei actualizări e afișată
            la începutul paginii.
          </p>
        </section>
      </div>
    </main>
  );
}
