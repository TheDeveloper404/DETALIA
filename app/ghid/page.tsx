import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Ghid de utilizare",
  description: "Ce poți face pe DETALIA și cum funcționează fiecare parte a platformei.",
};

// Ghid de utilizare — explică fiecare funcție a platformei, stil „LinkedIn Help", nu un FAQ de suport.
// Linkat din feed-rail.tsx, lângă Termeni/Confidențialitate (DOAR acolo — decizie explicită, nu și în
// footer-ul landing-ului). Actualizează secțiunea relevantă când o funcție nouă ajunge live (checklist
// separat de CHANGELOG — ăla e istoric tehnic, ăsta e user-facing).
export default function GhidPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
      <h1 className="mb-2 font-heading text-3xl font-extrabold tracking-tight">Ghid de utilizare</h1>
      <p className="mb-8 text-sm text-muted-foreground">
        Ce poți face pe DETALIA și cum funcționează fiecare parte a platformei.
      </p>

      <div className="flex flex-col gap-8 text-[15px] leading-relaxed text-foreground/90">
        <section>
          <h2 className="mb-2 text-lg font-bold">Ce este DETALIA</h2>
          <p>
            O comunitate profesională din construcții, organizată în jurul <strong>detaliului de
            execuție</strong>. Gândește-te la ea ca la StackOverflow pentru construcții: un detaliu e o
            întrebare/postare, o schiță peste el e un răspuns, iar validarea pe roluri e votul comunității.
            Se adresează proiectanților, executanților, furnizorilor și beneficiarilor.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-bold">Contul și rolul tău</h2>
          <p>
            Intri cu <strong>magic link</strong> — fără parolă. Scrii emailul, primești un link de
            autentificare valabil <strong>15 minute</strong> și utilizabil <strong>o singură dată</strong>;
            odată folosit (sau expirat), nu mai funcționează — ceri altul, e gratis și instant. La prima
            intrare îți declari <strong>rolul</strong> profesional (proiectant, executant, furnizor sau
            beneficiar) și un subrol (ex. arhitect, inginer structurist). Rolul apare permanent lângă numele
            tău, oriunde contribui — e felul în care comunitatea îți evaluează perspectiva.
          </p>
          <p className="mt-2">
            Rolul e <strong>funcțional imediat, neverificat</strong>. Din profil poți porni oricând o{" "}
            <strong>verificare de rol</strong> (opțională) — odată aprobată manual, primești un badge care
            arată că rolul tău a fost confirmat, nu doar declarat.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-bold">Publică un detaliu</h2>
          <p>
            Din butonul „Adaugă” încarci o imagine 2D a unui detaliu de execuție, îi dai un titlu, îl
            încadrezi într-o categorie și, opțional, adaugi resurse (PDF, CAD, link) sau parametri tehnici
            (zonă climatică, seismică). Publicat, apare direct în feed — moderarea e{" "}
            <strong>post-publicare</strong>, nu o coadă de aprobare.
          </p>
          <p className="mt-2">
            Poți adăuga o <strong>adnotare</strong> — notele/săgețile tale peste propria imagine, ca să
            explici ceva anume. E diferită de o schiță: nu e o contribuție primită de la altcineva, e
            explicația ta pe propriul detaliu.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-bold">Schițează peste un detaliu</h2>
          <p>
            Butonul „Schițează” continuă dezbaterea cu un desen propriu peste imaginea altcuiva — o
            &bdquo;schiță&rdquo;, cu tine ca autor. Fiecare schiță publicată intră în <strong>teancul</strong>{" "}
            detaliului, ca un tab separat, navigabil de oricine. Poți construi peste o schiță existentă (sau
            peste o adnotare) — platforma îngheață exact ce vedeai pe ecran ca fundal al foii tale noi.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-bold">Validează — Aprob / Dezaprob</h2>
          <p>
            Pe orice detaliu sau schiță poți lua o poziție: <strong>Aprob</strong> (un click) sau{" "}
            <strong>Dezaprob</strong> — care cere obligatoriu o justificare, fie scrisă, fie printr-o schiță
            proprie care arată cum ai face altfel. Nu există dezaprobare „mută”. Numele și rolul tău apar
            lângă poziție — nu există scor numeric, greutatea unei păreri o judecă cititorul, uitându-se la
            cine o spune.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-bold">Dezbate — comentarii și @mențiuni</h2>
          <p>
            Sub fiecare detaliu e un singur fir de discuție, care acoperă și schițele de pe el. Poți{" "}
            <strong>@menționa</strong> o schiță anume ca să sari direct la tabul ei — util când discuți mai
            multe variante în paralel.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-bold">Proiecte — colaborare privată</h2>
          <p>
            Dacă lucrezi pe un caz concret cu o echipă restrânsă (nu pentru toată comunitatea), poți crea un{" "}
            <strong>proiect</strong> — un spațiu privat, vizibil doar membrilor invitați prin link. Detaliile
            publicate într-un proiect nu apar în feed-ul public decât dacă autorul alege explicit să le
            „scoată în comunitate”.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-bold">Planșe — compunere vizuală</h2>
          <p>
            O <strong>planșă</strong> e un canvas propriu, unde poți aduna mai multe detalii/schițe unele
            lângă altele și desena liber peste ansamblu — util pentru a compara variante sau a schița o idee
            care combină mai multe surse. Planșa poate fi exportată ca imagine și refolosită, inclusiv ca
            bază pentru un detaliu nou.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-bold">Furnizor de materiale</h2>
          <p>
            Dacă declari rolul <strong>Furnizor</strong>, pe orice detaliu al altcuiva vezi butonul „Pot să
            ofertez materiale” — un semnal simplu, vizibil autorului și comunității, că poți contribui cu
            materialele necesare pentru acel detaliu.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-bold">Profilul tău</h2>
          <p>
            Profilul public arată detaliile, schițele și activitatea ta — reputația ta profesională se
            construiește din ce ai contribuit, nu dintr-un scor. Pe măsură ce contribui, poți primi{" "}
            <strong>badge-uri</strong> care marchează praguri de activitate.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-bold">Salvate și notificări</h2>
          <p>
            Poți <strong>salva</strong> orice detaliu ca să-l regăsești rapid mai târziu. Primești o{" "}
            <strong>notificare</strong> (în platformă) când cineva schițează peste unul dintre detaliile
            tale, îl ofertă ca furnizor, sau îți șterge o schiță — nimic nu se întâmplă pe conturile tale în
            tăcere.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-bold">Ștergerea unui detaliu</h2>
          <p>
            Din meniul detaliului tău poți cere ștergerea. Ce se întâmplă depinde dacă alții au interacționat
            deja cu el:
          </p>
          <ul className="mt-2 list-disc space-y-1.5 pl-5">
            <li>
              <strong>Fără nicio interacțiune</strong> (niciun comentariu, poziție sau schiță de la
              altcineva) — se șterge <strong>complet</strong>, imagine inclusă.
            </li>
            <li>
              <strong>Cu interacțiuni</strong> — detaliul rămâne (dezbaterea altora nu poate dispărea odată
              cu el), dar tu te <strong>retragi</strong> din el: numele și poza ta dispar din afișare
              (apari ca „Autor șters”), rolul tău rămâne înghețat la momentul retragerii. E ireversibil.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-bold">Ștergerea contului</h2>
          <p>
            Din profil poți cere ștergerea contului. Ce se întâmplă:
          </p>
          <ul className="mt-2 list-disc space-y-1.5 pl-5">
            <li>Numele, poza, emailul și orice altă informație personală se șterg definitiv din cont.</li>
            <li>Ești deconectat imediat — contul nu mai poate fi folosit pentru autentificare.</li>
            <li>
              Detaliile, schițele și comentariile pe care le-ai contribuit <strong>rămân</strong> vizibile
              (dezbaterile altora depind de ele) — dar atribuite generic unui „Utilizator șters”, nu ție.
            </li>
            <li>Un proiect al tău trece unui alt membru activ, sau se șterge dacă n-are alți membri.</li>
          </ul>
          <p className="mt-2">Este ireversibil.</p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-bold">Ai nevoie de ajutor?</h2>
          <p>
            Scrie-ne oricând la{" "}
            <a href="mailto:support@detalia.ro" className="font-semibold text-primary hover:underline">
              support@detalia.ro
            </a>{" "}
            — pentru probleme tehnice, întrebări despre cum funcționează ceva, sau cereri legate de rol/cont.
          </p>
        </section>
      </div>
    </main>
  );
}
