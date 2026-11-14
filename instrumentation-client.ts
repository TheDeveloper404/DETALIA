import posthog from "posthog-js";

import { redactInviteToken } from "@/lib/posthog-redact";

// Doar productia: preview-urile *.vercel.app si testele E2E nu trimit in proiectul PostHog de productie.
if (location.hostname === "detalia.ro") {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN!, {
    api_host: "/ingest",
    ui_host: "https://eu.posthog.com",
    defaults: "2026-01-30",
    // Fara cookie si fara stocare in browser: starea PostHog traieste doar cat e deschisa pagina.
    persistence: "memory",
    capture_exceptions: true,
    debug: process.env.NODE_ENV === "development",
    // /verify și /admin-page/verify poartă token-ul de magic-link (și emailul, în callback-ul
    // Auth.js) în query string. Fără mascare, $current_url capturat la fiecare pageview ar trimite
    // PII + token one-time într-un sistem terț de analytics.
    mask_personal_data_properties: true,
    custom_personal_data_properties: ["token", "u", "email", "callbackUrl"],
    before_send: redactInviteToken,
  });
}

// Sterge ce a lasat in browser configurarea veche (cookie + localStorage `ph_*`), ca nota de
// confidentialitate „fara cookie-uri” sa fie adevarata si pentru vizitatorii de dinainte.
const hostParts = location.hostname.split(".");
for (const name of document.cookie.split("; ").map((c) => c.split("=")[0]).filter((n) => n.startsWith("ph_"))) {
  document.cookie = `${name}=; max-age=0; path=/`;
  for (let i = 0; i < hostParts.length - 1; i++) {
    document.cookie = `${name}=; max-age=0; path=/; domain=.${hostParts.slice(i).join(".")}`;
  }
}
for (const key of Object.keys(localStorage).filter((k) => k.startsWith("ph_"))) localStorage.removeItem(key);
