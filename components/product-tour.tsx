"use client";

import "driver.js/dist/driver.css";

import { driver, type Config } from "driver.js";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

// Pașii turului, separați ca date pure (testabile fără a monta driver.js) — vezi product-tour.test.ts.
// Fiecare `data-tour` trebuie să existe EXACT o dată în DOM-ul paginii /feed (header + sidebar + FAB);
// dacă markup-ul țintă e redenumit/șters, testul de mai jos o prinde înainte de deploy, nu la runtime.
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
    element: '[data-tour="projects"]',
    popover: {
      title: "Proiecte",
      description:
        "Spații de colaborare restrânsă, vizibile doar membrilor invitați — utile când lucrezi pe un caz concret, nu pentru comunitate.",
      side: "bottom",
      align: "end",
    },
  },
  {
    element: '[data-tour="menu"]',
    popover: {
      title: "Meniul tău",
      description:
        "Planșele, ciornele nefinalizate și detaliile salvate — tot ce ai în lucru, la un click distanță.",
      side: "bottom",
      align: "end",
    },
  },
];

// Tur ghidat, o singură dată, la aterizarea din onboarding (`/feed?tour=1` — vezi `onboarding/actions.ts`).
// NU la fiecare login (spre deosebire de `?welcome=1`, care e pe orice magic link) — semnalul de „user
// chiar nou" e finalizarea onboarding-ului, nu simpla autentificare.
// Țintele (`data-tour="..."`) trăiesc în componentele reale ale feed-ului/header-ului — dacă una dispare
// din UI, pasul respectiv e sărit automat (driver.js ignoră silențios un element inexistent).
export function ProductTour({ active }: { active: boolean }) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!active) return;

    // Curăță ?tour=1 din URL imediat (fără reload) — refresh/înapoi nu mai repornesc turul.
    router.replace(pathname, { scroll: false });

    const tour = driver({
      showProgress: true,
      animate: true,
      overlayColor: "#211d18",
      overlayOpacity: 0.6,
      stagePadding: 6,
      stageRadius: 10,
      popoverClass: "detalia-tour-popover",
      progressText: "{{current}} din {{total}}",
      nextBtnText: "Următorul",
      prevBtnText: "Înapoi",
      doneBtnText: "Am înțeles",
      steps: TOUR_STEPS,
    });

    tour.drive();
    return () => tour.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pornește o singură dată, la primul mount cu `active`.
  }, [active]);

  return null;
}
