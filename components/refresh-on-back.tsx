"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// Next.js App Router: navigarea Înapoi/Înainte din browser (popstate) ignoră INTENȚIONAT orice
// verificare de staleness a Client Router Cache-ului (bypass explicit cu -1 în sursa Next.js,
// indiferent de `staleTimes`) — pagina revine din cache oricât de veche ar fi. Fără acest refresh,
// contorul de vizualizări (incrementat pe pagina de detaliu) n-ar apărea actualizat în feed la
// întoarcere cu Back (2026-08-07, cerere Liviu: „intru pe detaliu, ies, vreau să văd că s-a contorizat").
//
// Montat în layout-ul zonei autentificate (`app/(app)/layout.tsx`), NU în `feed/page.tsx` — un
// component montat la nivel de pagină ar rata exact evenimentul care-l aduce pe ecran: la Back
// dinspre pagina de detaliu, tab-ul „feed" (și acest listener) nu există încă în DOM în momentul în
// care browserul emite `popstate`, se montează abia DUPĂ. Layout-ul persistă neîntrerupt peste toate
// navigările din zona autentificată → listener-ul e mereu activ, indiferent de pe ce pagină pleci.
//
// `setTimeout(0)`: router-ul intern Next.js are propriul listener de `popstate` (schimbă segmentul
// activ). Dacă am apela `router.refresh()` sincron, în funcție de ordinea de înregistrare a
// listener-elor, am putea reîmprospăta segmentul VECHI (cel părăsit), nu cel nou-afișat. Amânarea cu
// un tick lasă swap-ul intern al Next să se termine primul.
export function RefreshOnBack() {
  const router = useRouter();

  useEffect(() => {
    function onPopState() {
      setTimeout(() => router.refresh(), 0);
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [router]);

  return null;
}
