"use client";

// Tur ghidat pe pagina de detaliu (driver.js) — analog cu `ProductTour` (feed), dar declanșat diferit:
// feed-ul are un singur punct de intrare (`?tour=1`, din finalul onboarding-ului), pagina de detaliu se
// deschide din zeci de locuri diferite (feed, profil, @mention, link direct) → nu există un query param
// unic de agățat. De-aia flag persistat (`users.seenDetailTour`), nu URL: turul rulează o singură dată,
// la PRIMA pagină de detaliu pe care userul o deschide vreodată, indiferent de unde a intrat.
import "driver.js/dist/driver.css";

import { driver } from "driver.js";
import { useEffect, useState } from "react";

import { confirmDetailTourSeenAction } from "@/app/(app)/profile/actions";
import { DETAIL_TOUR_STEPS } from "@/lib/detail-tour-steps";

// `seen`: valoarea persistată (`hasSeenDetailTour`, citită pe server) — turul rulează DOAR dacă e `false`.
export function DetailProductTour({ seen }: { seen: boolean }) {
  // Snapshot la PRIMUL render — același motiv ca la `ProductTour`: nu vrem ca un re-render ulterior
  // (ex. navigare între tab-uri de schiță, care nu remontează pagina) să repornească turul.
  const [shouldRun] = useState(!seen);

  useEffect(() => {
    if (!shouldRun) return;
    // Fire-and-forget: e o simplă bifă „văzut", nu blochează turul dacă rețeaua e lentă.
    void confirmDetailTourSeenAction();

    const tour = driver({
      showProgress: true,
      animate: true,
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
      steps: DETAIL_TOUR_STEPS,
    });

    tour.drive();
    return () => tour.destroy();
  }, [shouldRun]);

  return null;
}
