"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

// Notă informativă despre cookie-uri (NU consent cu opțiuni) — DETALIA folosește DOAR cookie-ul de
// sesiune Auth.js, strict necesar (nu tracking/marketing) → sub GDPR/ePrivacy nu cere opt-in, doar
// informare. Apare o singură dată, la 10s după prima vizită pe landing, colț jos-stânga (NU în footer,
// ca să nu se piardă în conținut). Alegerea userului (dismis) persistă în localStorage.
const DISMISSED_KEY = "detalia-cookie-notice-dismissed";
const SHOW_DELAY_MS = 10_000;

export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(DISMISSED_KEY) === "1") return;
    const timer = setTimeout(() => setVisible(true), SHOW_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, "1");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      role="status"
      className="fixed bottom-5 left-5 z-50 max-w-sm rounded-xl border border-[#e3ddd2] bg-white p-4 shadow-lg"
    >
      <p className="text-sm leading-relaxed text-[#5d564c]">
        Folosim doar cookie-ul strict necesar pentru autentificare — fără tracking, fără marketing.
      </p>
      <div className="mt-3 flex justify-end">
        <Button size="sm" onClick={dismiss}>
          Am înțeles
        </Button>
      </div>
    </div>
  );
}
