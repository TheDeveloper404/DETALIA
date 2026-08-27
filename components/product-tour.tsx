"use client";

import "driver.js/dist/driver.css";

import { driver, type Config } from "driver.js";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

// Pașii turului, separați ca date pure (testabile fără a monta driver.js) — vezi product-tour.test.ts.
// Fiecare `data-tour` trebuie să existe cel mult o dată în DOM-ul paginii /feed (header + sidebar + FAB
// + primul card din feed); dacă markup-ul țintă e redenumit/șters, testul de mai jos o prinde înainte
// de deploy, nu la runtime. `my-content` (sidebar `hidden lg:flex`) și `feed-first-card` (feed gol) pot
// lipsi legitim — de aceea `getTourSteps` îi filtrează în loc să conteze pe skip-ul silențios.
export const TOUR_STEPS: NonNullable<Config["steps"]> = [
  {
    element: '[data-tour="categories"]',
    popover: {
      title: "Categorii",
      description:
        "Detaliile sunt organizate pe meserii și specialități — filtrează feed-ul după ce te interesează.",
      side: "right",
      align: "start",
    },
  },
  {
    element: '[data-tour="profile"]',
    popover: {
      title: "Profilul tău",
      description:
        "Aici îți construiești reputația: detaliile publicate, schițele și activitatea ta sunt vizibile comunității.",
      side: "right",
      align: "start",
    },
  },
  {
    element: '[data-tour="my-content"]',
    popover: {
      title: "Conținutul tău",
      description:
        "Proiectele, planșele, detaliile salvate și ciornele tale — toate la un loc, aici în sidebar.",
      side: "right",
      align: "start",
    },
  },
  {
    element: '[data-tour="feed-first-card"]',
    popover: {
      title: "Un detaliu în feed",
      description:
        "Pe fiecare detaliu poți trimite o schiță proprie peste imagine, îți poți da avizul pe rol sau, dacă furnizezi materiale, poți anunța că poți oferta.",
      side: "top",
      align: "start",
    },
  },
  {
    element: '[data-tour="add"]',
    popover: {
      title: "Adaugă",
      description:
        "Publică un detaliu de execuție sau începe un proiect de colaborare restrânsă — punctul de plecare pentru orice contribuție.",
      side: "left",
      align: "end",
    },
  },
  {
    element: '[data-tour="menu"]',
    popover: {
      title: "Meniul tău",
      description: "Profilul tău și deconectarea, la un click distanță.",
      side: "bottom",
      align: "end",
    },
  },
];

// Doi pași țintesc elemente care NU sunt mereu în DOM la /feed:
//  - `my-content` e în sidebar (`feed-sidebar.tsx`), ascuns sub breakpoint-ul `lg` (`hidden lg:flex`);
//  - `feed-first-card` există doar când feed-ul are cel puțin un detaliu.
// Filtrate EXPLICIT (nu lăsate pe skip-ul silențios al driver.js) ca numărătoarea de progres
// („X din N") să rămână corectă pentru pașii chiar afișați — aceeași lecție ca la vechiul pas
// „Proiecte" (Greptile, 2026-08-26).
export function getTourSteps(opts: {
  isDesktop: boolean;
  hasFeedItems: boolean;
}): NonNullable<Config["steps"]> {
  return TOUR_STEPS.filter((step) => {
    if (!opts.isDesktop && step.element === '[data-tour="my-content"]') return false;
    if (!opts.hasFeedItems && step.element === '[data-tour="feed-first-card"]') return false;
    return true;
  });
}

// Tur ghidat, o singură dată, la aterizarea din onboarding (`/feed?tour=1` — vezi `onboarding/actions.ts`).
// NU la fiecare login (spre deosebire de `?welcome=1`, care e pe orice magic link) — semnalul de „user
// chiar nou" e finalizarea onboarding-ului, nu simpla autentificare.
// Țintele (`data-tour="..."`) trăiesc în componentele reale ale feed-ului/header-ului — dacă una dispare
// din UI, pasul respectiv e sărit automat (driver.js ignoră silențios un element inexistent).
export function ProductTour({
  active,
  hasFeedItems = true,
}: {
  active: boolean;
  hasFeedItems?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [feedItemsAtMount] = useState(hasFeedItems);
  // Snapshot la PRIMUL render, ignoră schimbările ulterioare ale prop-ului `active` — BUG găsit
  // 2026-08-17: `router.replace()` de mai jos strips `?tour=1` → Next.js re-randează Server Component-ul
  // părinte (FeedPage) cu `searchParams.tour` absent → noul `active=false` ajunge ca prop aici. Cu
  // `active` live în deps-ul efectului, React rula cleanup-ul efectului anterior (`tour.destroy()`)
  // la exact acel re-render — turul se închidea instant, la o secundă de la primul pas. Snapshot-ul
  // rupe bucla: efectul depinde DOAR de valoarea de la mount, nu de re-render-urile provocate chiar de el.
  const [shouldRun] = useState(active);

  useEffect(() => {
    if (!shouldRun) return;

    // Curăță ?tour=1 din URL imediat (fără reload) — refresh/înapoi nu mai repornesc turul.
    router.replace(pathname, { scroll: false });

    const steps = getTourSteps({
      isDesktop: window.matchMedia("(min-width: 1024px)").matches,
      hasFeedItems: feedItemsAtMount,
    });

    const tour = driver({
      showProgress: true,
      animate: true,
      // `smoothScroll`/`duration` mai mare — implicit driver.js sare instant între ținte aflate în
      // zone diferite ale paginii (`smoothScroll` default `false`); feedback 2026-08-26: „sare prea
      // dintr-o dată" (verificat în docs driver.js, nu presupus).
      smoothScroll: true,
      duration: 500,
      // Blochează scroll-ul manual al paginii cât turul e activ (2026-08-26, cerut) — opțiune nativă
      // driver.js, nu hand-rolled pe body; scroll-ul PROGRAMATIC dintre pași (smoothScroll) tot merge.
      allowScroll: false,
      overlayColor: "#211d18",
      overlayOpacity: 0.6,
      stagePadding: 6,
      stageRadius: 10,
      popoverClass: "detalia-tour-popover",
      progressText: "{{current}} din {{total}}",
      nextBtnText: "Următorul",
      prevBtnText: "Înapoi",
      doneBtnText: "Am înțeles",
      steps,
    });

    tour.drive();
    return () => tour.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pornește o singură dată, la primul mount; `shouldRun` e un snapshot, nu se schimbă.
  }, [shouldRun]);

  return null;
}
