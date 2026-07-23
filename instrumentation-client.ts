import posthog from "posthog-js";

posthog.init(process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN!, {
  api_host: "/ingest",
  ui_host: "https://eu.posthog.com",
  defaults: "2026-01-30",
  capture_exceptions: true,
  debug: process.env.NODE_ENV === "development",
  // /verify și /admin-page/verify poartă token-ul de magic-link (și emailul, în callback-ul
  // Auth.js) în query string. Fără mascare, $current_url capturat la fiecare pageview ar trimite
  // PII + token one-time într-un sistem terț de analytics.
  mask_personal_data_properties: true,
  custom_personal_data_properties: ["token", "u", "email", "callbackUrl"],
});
