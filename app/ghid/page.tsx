import type { Metadata } from "next";
import { FolderLock, LayoutPanelLeft, PenLine, ThumbsUp, Upload, UserRound } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import landing from "@/components/public-pages/landing-experience.module.css";
import { PublicFooter, PublicHeader } from "@/components/public-pages/public-chrome";
import shared from "@/components/public-pages/public-pages.module.css";

import styles from "./ghid.module.css";

export const metadata: Metadata = {
  title: "Ghid de utilizare",
  description: "Ce poți face pe DETALIA și cum funcționează fiecare parte a platformei.",
};

// Ghid de utilizare — PUBLIC (accesibil și înainte de autentificare, vezi PUBLIC_PATHS din proxy.ts),
// în layout de documentație: secțiuni în stânga, conținut, cuprins în dreapta. Linkat din landing
// (header + footer) și din feed-rail.tsx. Actualizează secțiunea relevantă când o funcție nouă ajunge
// live (checklist separat de CHANGELOG — ăla e istoric tehnic, ăsta e user-facing).

type Section = { id: string; title: string; body: ReactNode };

const SECTIONS: Section[] = [
  {
    id: "ce-este",
    title: "Ce este DETALIA",
    body: (
      <p>
        O comunitate profesională din construcții, organizată în jurul{" "}
        <strong>detaliului de execuție</strong>. Gândește-te la ea ca la StackOverflow pentru
        construcții: un detaliu e o întrebare/postare, o schiță peste el e un răspuns, iar validarea
        pe roluri e votul comunității. Se adresează proiectanților, executanților, furnizorilor și
        beneficiarilor.
      </p>
    ),
  },
  {
    id: "cont",
    title: "Contul și rolul tău",
    body: (
      <>
        <p>
          Intri cu <strong>magic link</strong> — fără parolă. Scrii emailul, primești un link de
          autentificare valabil <strong>15 minute</strong> și utilizabil{" "}
          <strong>o singură dată</strong>; odată folosit (sau expirat), nu mai funcționează — ceri
          altul, e gratis și instant. La prima intrare îți declari <strong>rolul</strong>{" "}
          profesional (proiectant, executant, furnizor sau beneficiar) și un subrol (ex. arhitect,
          inginer structurist). Rolul apare permanent lângă numele tău, oriunde contribui — e felul
          în care comunitatea îți evaluează perspectiva.
        </p>
        <p>
          Rolul e <strong>funcțional imediat, neverificat</strong>. Din profil poți porni oricând o{" "}
          <strong>verificare de rol</strong> (opțională) — odată aprobată manual, primești un badge
          care arată că rolul tău a fost confirmat, nu doar declarat.
        </p>
      </>
    ),
  },
  {
    id: "publica",
    title: "Publică un detaliu",
    body: (
      <>
        <p>
          Din butonul „Adaugă” încarci o imagine 2D a unui detaliu de execuție, îi dai un titlu, îl
          încadrezi într-o categorie și, opțional, adaugi resurse (PDF, CAD, link) sau parametri
          tehnici (zonă climatică, seismică). Publicat, apare direct în feed — moderarea e{" "}
          <strong>post-publicare</strong>, nu o coadă de aprobare.
        </p>
        <p>
          Poți adăuga o <strong>adnotare</strong> — notele/săgețile tale peste propria imagine, ca
          să explici ceva anume. E diferită de o schiță: nu e o contribuție primită de la altcineva,
          e explicația ta pe propriul detaliu.
        </p>
      </>
    ),
  },
  {
    id: "schiteaza",
    title: "Schițează peste un detaliu",
    body: (
      <p>
        Butonul „Schițează” continuă dezbaterea cu un desen propriu peste imaginea altcuiva — o
        &bdquo;schiță&rdquo;, cu tine ca autor. Fiecare schiță publicată intră în{" "}
        <strong>teancul</strong> detaliului, ca un tab separat, navigabil de oricine. Poți construi
        peste o schiță existentă (sau peste o adnotare) — platforma îngheață exact ce vedeai pe
        ecran ca fundal al foii tale noi.
      </p>
    ),
  },
  {
    id: "valideaza",
    title: "Validează — Aprob / Dezaprob",
    body: (
      <p>
        Pe orice detaliu sau schiță poți lua o poziție: <strong>Aprob</strong> (un click) sau{" "}
        <strong>Dezaprob</strong> — care cere obligatoriu o justificare, fie scrisă, fie printr-o
        schiță proprie care arată cum ai face altfel. Nu există dezaprobare „mută”. Numele și rolul
        tău apar lângă poziție — nu există scor numeric, greutatea unei păreri o judecă cititorul,
        uitându-se la cine o spune.
      </p>
    ),
  },
  {
    id: "dezbate",
    title: "Dezbate — comentarii și @mențiuni",
    body: (
      <p>
        Sub fiecare detaliu e un singur fir de discuție, care acoperă și schițele de pe el. Poți{" "}
        <strong>@menționa</strong> o schiță anume ca să sari direct la tabul ei — util când discuți
        mai multe variante în paralel.
      </p>
    ),
  },
  {
    id: "proiecte",
    title: "Proiecte — colaborare privată",
    body: (
      <p>
        Dacă lucrezi pe un caz concret cu o echipă restrânsă (nu pentru toată comunitatea), poți
        crea un <strong>proiect</strong> — un spațiu privat, vizibil doar membrilor invitați prin
        link. Detaliile publicate într-un proiect nu apar în feed-ul public decât dacă autorul alege
        explicit să le „scoată în comunitate”.
      </p>
    ),
  },
  {
    id: "planse",
    title: "Planșe — compunere vizuală",
    body: (
      <p>
        O <strong>planșă</strong> e un canvas propriu, unde poți aduna mai multe detalii/schițe
        unele lângă altele și desena liber peste ansamblu — util pentru a compara variante sau a
        schița o idee care combină mai multe surse. Planșa poate fi exportată ca imagine și
        refolosită, inclusiv ca bază pentru un detaliu nou.
      </p>
    ),
  },
  {
    id: "furnizor",
    title: "Furnizor de materiale",
    body: (
      <p>
        Dacă declari rolul <strong>Furnizor</strong>, pe orice detaliu al altcuiva vezi butonul „Pot
        să ofertez materiale” — un semnal simplu, vizibil autorului și comunității, că poți
        contribui cu materialele necesare pentru acel detaliu.
      </p>
    ),
  },
  {
    id: "profil",
    title: "Profilul tău",
    body: (
      <p>
        Profilul public arată detaliile, schițele și activitatea ta — reputația ta profesională se
        construiește din ce ai contribuit, nu dintr-un scor. Pe măsură ce contribui, poți primi{" "}
        <strong>badge-uri</strong> care marchează praguri de activitate.
      </p>
    ),
  },
  {
    id: "salvate-notificari",
    title: "Salvate și notificări",
    body: (
      <p>
        Poți <strong>salva</strong> orice detaliu ca să-l regăsești rapid mai târziu. Primești o{" "}
        <strong>notificare</strong> (în platformă) când cineva schițează peste unul dintre detaliile
        tale, îl ofertă ca furnizor, sau îți șterge o schiță — nimic nu se întâmplă pe conturile
        tale în tăcere.
      </p>
    ),
  },
  {
    id: "stergere-detaliu",
    title: "Ștergerea unui detaliu",
    body: (
      <>
        <p>
          Din meniul detaliului tău poți cere ștergerea. Ce se întâmplă depinde dacă alții au
          interacționat deja cu el:
        </p>
        <ul>
          <li>
            <strong>Fără nicio interacțiune</strong> (niciun comentariu, poziție sau schiță de la
            altcineva) — se șterge <strong>complet</strong>, imagine inclusă.
          </li>
          <li>
            <strong>Cu interacțiuni</strong> — detaliul rămâne (dezbaterea altora nu poate dispărea
            odată cu el), dar tu te <strong>retragi</strong> din el: numele și poza ta dispar din
            afișare (apari ca „Autor șters”), rolul tău rămâne înghețat la momentul retragerii. E
            ireversibil.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "stergere-cont",
    title: "Ștergerea contului",
    body: (
      <>
        <p>Din profil poți cere ștergerea contului. Ce se întâmplă:</p>
        <ul>
          <li>
            Numele, poza, emailul și orice altă informație personală se șterg definitiv din cont.
          </li>
          <li>Ești deconectat imediat — contul nu mai poate fi folosit pentru autentificare.</li>
          <li>
            Detaliile, schițele și comentariile pe care le-ai contribuit <strong>rămân</strong>{" "}
            vizibile (dezbaterile altora depind de ele) — dar atribuite generic unui „Utilizator
            șters”, nu ție.
          </li>
          <li>
            Un proiect al tău trece unui alt membru activ, sau se șterge dacă n-are alți membri.
          </li>
        </ul>
        <p>Este ireversibil.</p>
      </>
    ),
  },
  {
    id: "ajutor",
    title: "Ai nevoie de ajutor?",
    body: (
      <p>
        Scrie-ne oricând la <a href="mailto:support@detalia.ro">support@detalia.ro</a> — pentru
        probleme tehnice, întrebări despre cum funcționează ceva, sau cereri legate de rol/cont.
      </p>
    ),
  },
];

const GROUPS: { title: string; ids: string[] }[] = [
  { title: "Începe aici", ids: ["ce-este", "cont"] },
  { title: "Lucrul cu detaliile", ids: ["publica", "schiteaza", "valideaza", "dezbate"] },
  { title: "Colaborare", ids: ["proiecte", "planse", "furnizor"] },
  {
    title: "Contul tău",
    ids: ["profil", "salvate-notificari", "stergere-detaliu", "stergere-cont"],
  },
  { title: "Suport", ids: ["ajutor"] },
];

const START_CARDS: { id: string; title: string; text: string; Icon: LucideIcon }[] = [
  {
    id: "cont",
    title: "Contul și rolul",
    text: "Magic link, rol profesional, verificare.",
    Icon: UserRound,
  },
  {
    id: "publica",
    title: "Publică un detaliu",
    text: "Imagine, categorie, resurse, adnotare.",
    Icon: Upload,
  },
  {
    id: "schiteaza",
    title: "Schițează",
    text: "Desenul tău peste detaliul altcuiva.",
    Icon: PenLine,
  },
  { id: "valideaza", title: "Validează", text: "Aprob sau Dezaprob, cu argument.", Icon: ThumbsUp },
  {
    id: "proiecte",
    title: "Proiecte",
    text: "Spațiu privat pentru o echipă restrânsă.",
    Icon: FolderLock,
  },
  {
    id: "planse",
    title: "Planșe",
    text: "Compune și compară mai multe detalii.",
    Icon: LayoutPanelLeft,
  },
];

const titleOf = (id: string) => SECTIONS.find((s) => s.id === id)?.title ?? id;

function SectionNav() {
  return (
    <>
      {GROUPS.map((group) => (
        <div key={group.title} className={styles.navGroup}>
          <p className={styles.navGroupTitle}>{group.title}</p>
          <ul>
            {group.ids.map((id) => (
              <li key={id}>
                <a href={`#${id}`}>{titleOf(id)}</a>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </>
  );
}

export default function GhidPage() {
  return (
    <div className={`${shared.publicPage} ${landing.landing}`}>
      <a className={shared.skipLink} href="#continut">
        Sari la conținut
      </a>
      <PublicHeader />
      <div className={styles.docs}>
        <nav className={styles.sidebar} aria-label="Secțiunile ghidului">
          <SectionNav />
        </nav>

        <main id="continut" className={styles.content}>
          <p className={styles.eyebrow}>GHID DE UTILIZARE</p>
          <h1>Cum funcționează DETALIA</h1>
          <p className={styles.lead}>
            Ce poți face pe DETALIA și cum funcționează fiecare parte a platformei.
          </p>

          <details className={styles.mobileNav}>
            <summary>Secțiuni</summary>
            <nav aria-label="Secțiunile ghidului (mobil)">
              <SectionNav />
            </nav>
          </details>

          <ul className={styles.cards} aria-label="Începe de aici">
            {START_CARDS.map(({ id, title, text, Icon }) => (
              <li key={id}>
                <a href={`#${id}`} className={styles.card}>
                  <Icon size={20} aria-hidden="true" />
                  <span className={styles.cardTitle}>{title}</span>
                  <span className={styles.cardText}>{text}</span>
                </a>
              </li>
            ))}
          </ul>

          {SECTIONS.map((section) => (
            <section key={section.id} id={section.id} className={styles.section}>
              <h2>{section.title}</h2>
              {section.body}
            </section>
          ))}
        </main>

        <aside className={styles.toc} aria-label="Pe pagină">
          <p className={styles.navGroupTitle}>Pe pagină</p>
          <ul>
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`}>{s.title}</a>
              </li>
            ))}
          </ul>
        </aside>
      </div>
      <PublicFooter />
    </div>
  );
}
