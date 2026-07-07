// Sentry — runtime browser. Fără session replay (evităm captarea de imagini/date de profil ale userilor
// din construcții — nu e o decizie luată, o omitem prudent; se poate activa ulterior explicit).
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  sendDefaultPii: false,
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
  // VERCEL_ENV nu ajunge implicit în bundle-ul de client (nu e NEXT_PUBLIC_) → fără asta, Sentry taguia
  // evenimentele de aici cu environment implicit ("production"), invizibile sub un filtru "vercel-preview"
  // (vezi next.config.ts pt mapping-ul NEXT_PUBLIC_VERCEL_ENV).
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? "development",
  // Logs structurate via `Sentry.logger.*` (intenționat, PII-free). Fără forwarding automat de console.*.
  enableLogs: true,
});

// Cerut de Sentry pentru instrumentarea navigărilor client-side (App Router).
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

// SEC-14 (variantă client) — React tratează un mismatch de hidratare ca „recuperat": NU aruncă o excepție
// reală, doar loghează prin `console.error` intern (Next.js `reportGlobalError`) — nu trece prin
// window.onerror, nu trece prin error boundary → Sentry nu-l vede din integrările implicite.
// NU folosim `captureConsoleIntegration` (ar forward-a ORICE console.error, risc de PII din loguri
// oarecare — decizia „fără PII" de mai sus). În loc, filtrăm STRICT pe tiparul de mesaj al Next.js
// pentru mismatch de hidratare (verificat împotriva `isHydrationWarning` din codul Next.js) — orice
// alt console.error rămâne neatins, neforward-at.
const HYDRATION_WARNING_RE = /hydra(ted|tion)|did not match|server rendered html/i;
const originalConsoleError = console.error;
console.error = (...args: unknown[]) => {
  const first = args[0];
  if (typeof first === "string" && HYDRATION_WARNING_RE.test(first)) {
    Sentry.captureMessage(`Hydration mismatch: ${first}`, {
      level: "warning",
      extra: { args: args.slice(1).map(String) },
    });
  }
  originalConsoleError(...args);
};
