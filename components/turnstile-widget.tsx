"use client";

import Script from "next/script";
import { useEffect, useRef } from "react";

// Widget Cloudflare Turnstile reutilizabil. Injectează `cf-turnstile-response` în formularul-părinte
// (verificat server-side cu `verifyTurnstile`). Randare EXPLICITĂ: scriptul e injectat o singură dată
// în <head>; la a doua navigare client-side nu mai scanează DOM-ul după `.cf-turnstile`, deci randăm
// manual la fiecare montare (altfel widget-ul nu apare și submit-ul pică cu CaptchaFailed până la refresh).
// Fără site key (dev fără chei) → nu randăm nimic, iar verificarea server-side e no-op → fluxul merge.

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: Record<string, unknown>) => string;
      remove: (widgetId: string) => void;
    };
  }
}

export function TurnstileWidget({ siteKey, className }: { siteKey: string; className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    function renderWidget() {
      if (cancelled || !containerRef.current || !window.turnstile) return;
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        theme: "light",
      });
    }

    if (window.turnstile) {
      renderWidget();
      return () => {
        cancelled = true;
        if (widgetIdRef.current && window.turnstile) window.turnstile.remove(widgetIdRef.current);
      };
    }

    // Prima montare din sesiune: scriptul poate fi încă în curs de încărcare.
    const interval = setInterval(() => {
      if (window.turnstile) {
        clearInterval(interval);
        renderWidget();
      }
    }, 100);
    return () => {
      cancelled = true;
      clearInterval(interval);
      if (widgetIdRef.current && window.turnstile) window.turnstile.remove(widgetIdRef.current);
    };
  }, [siteKey]);

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
      />
      <div ref={containerRef} className={className} />
    </>
  );
}
