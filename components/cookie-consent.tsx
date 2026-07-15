"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

// Notă informativă despre cookie-uri (NU consent cu opțiuni) — actualizat 2026-07-15 odată cu migrarea
// PostHog: mesajul anterior spunea „fără tracking", fals de când PostHog pune cookie de analytics.
// ATENȚIE juridic: modelul „doar informare, fără opt-in" era valabil CÂND nu exista tracking (sub
// GDPR/ePrivacy cookie-urile strict necesare nu cer consimțământ). Cu PostHog activ, cookie-ul de
// analytics NU mai e strict necesar → în strictețe GDPR ar putea necesita opt-in real (Accept/Refuz),
// nu doar notificare. Schimbarea de text de mai jos e minimă (adevăr, nu ascunde), dar mecanismul de
// consimțământ propriu-zis NU a fost revizuit — de discutat cu Liviu/jurist dacă modelul curent rămâne
// suficient. Apare o singură dată, la 10s după prima vizită pe landing, colț jos-stânga. Alegerea
// userului (dismis) persistă în localStorage.
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
      className="fixed bottom-5 left-4 right-4 z-50 mx-auto max-w-sm rounded-xl border border-border bg-card p-4 shadow-lg sm:left-5 sm:right-auto sm:mx-0"
    >
      <p className="text-sm leading-relaxed text-muted-foreground">
        Folosim cookie-ul strict necesar pentru autentificare și un cookie de analiză (PostHog) ca să
        înțelegem cum e folosită platforma — fără marketing, fără publicitate.
      </p>
      <div className="mt-3 flex justify-end">
        <Button size="sm" onClick={dismiss}>
          Am înțeles
        </Button>
      </div>
    </div>
  );
}
