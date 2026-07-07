import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Termeni și condiții — DETALIA",
  description: "Termenii și condițiile de utilizare a platformei DETALIA.",
};

export default function TermeniPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
      <p className="mb-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Document de lucru — publicat pentru transparență, în curs de revizuire juridică. Nu constituie
        consultanță juridică finală.
      </p>

      <h1 className="mb-2 font-heading text-3xl font-extrabold tracking-tight">Termeni și condiții</h1>
      <p className="mb-8 text-sm text-muted-foreground">Ultima actualizare: 2026-07-07</p>

      <div className="flex flex-col gap-8 text-[15px] leading-relaxed text-foreground/90">
        <section>
          <h2 className="mb-2 text-lg font-bold">1. Ce este DETALIA</h2>
          <p>
            DETALIA este o comunitate profesională din domeniul construcțiilor, organizată în jurul
            detaliului de execuție. Platforma se adresează profesioniștilor din construcții — proiectanți,
            executanți, furnizori și beneficiari — care publică, dezbat și îmbunătățesc detalii de execuție
            prin validare pe roluri și schițe.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-bold">2. Reguli de conduită</h2>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Declari rolul tău profesional cu bună-credință — rolul afișat lângă contribuțiile tale e
              parte din cum comunitatea evaluează credibilitatea unei păreri.</li>
            <li>Conținutul pe care îl publici (detalii, schițe, comentarii) trebuie să fie al tău sau să ai
              dreptul să-l publici.</li>
            <li>Dezbaterea se poartă cu argumente tehnice, respectuos — dezaprobarea unui detaliu cere
              întotdeauna o justificare, nu doar un vot.</li>
            <li>Nu publici conținut ilegal, înșelător sau care încalcă drepturile altcuiva.</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-bold">3. Proprietatea asupra conținutului</h2>
          <p>
            Păstrezi drepturile asupra conținutului pe care îl publici. Prin publicare, îi permiți platformei
            să-l afișeze celorlalți useri, ca parte firească a funcționării comunității (feed, teanc de
            schițe, profil public). Dacă îți ștergi contul, conținutul contribuit rămâne vizibil, atribuit
            generic unui &bdquo;Utilizator șters&rdquo;, ca să nu distrugă dezbaterile în care au fost implicați
            alți useri.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-bold">4. Verificarea rolului</h2>
          <p>
            Rolul tău e declarat de tine la înregistrare. Platforma oferă (când e disponibilă) o verificare
            opțională a rolului, marcată printr-un semn distinctiv lângă nume. Verificarea confirmă doar că
            am validat dovezile trimise de tine — <strong>nu este un aviz profesional</strong> și nu
            garantează competența tehnică a persoanei sau corectitudinea conținutului publicat.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-bold">5. Limitarea răspunderii</h2>
          <p>
            Detaliile publicate pe platformă reprezintă opinii profesionale ale userilor, nu avize tehnice
            oficiale. DETALIA nu validează și nu garantează corectitudinea, siguranța sau conformitatea
            tehnică a niciunui detaliu publicat. Orice decizie de execuție bazată pe conținutul platformei
            rămâne responsabilitatea exclusivă a celui care o ia.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-bold">6. Suspendare și închidere de cont</h2>
          <p>
            Ne rezervăm dreptul de a suspenda sau închide un cont care încalcă acești termeni (conținut
            ilegal, comportament abuziv, rol declarat cu rea-credință). Îți poți șterge oricând contul din
            platformă (Profil → Editează → &bdquo;Șterge contul&rdquo;).
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-bold">7. Legea aplicabilă</h2>
          <p>
            Acești termeni sunt guvernați de legea română. Îi putem actualiza pe măsură ce platforma
            evoluează — data ultimei actualizări e afișată la începutul paginii.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-bold">Contact</h2>
          <p>
            Pentru orice întrebare legată de acești termeni, scrie-ne la{" "}
            <a href="mailto:support@detalia.ro" className="font-semibold text-primary hover:underline">
              support@detalia.ro
            </a>
            .
          </p>
        </section>
      </div>
    </main>
  );
}
