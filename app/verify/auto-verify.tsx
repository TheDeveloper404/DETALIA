"use client";

import { useEffect } from "react";

// Redirect real, executat din JS la montare → doar un browser adevărat ajunge la callback-ul Auth.js.
// Scanerele de mail fac GET pe pagina asta dar nu rulează JS, deci NU consumă tokenul one-time.
// `replace` (nu `assign`) → pagina de verify nu rămâne în history (înapoi nu revine aici).
export function AutoVerify({ target }: { target: string }) {
  useEffect(() => {
    window.location.replace(target);
  }, [target]);
  return null;
}
