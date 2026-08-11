import posthog from "posthog-js";

// SEC-002 (audit 2026-08-11): tokenul de invitație de proiect stă în PATH (`/projects/join/<token>`),
// nu în query string — `custom_personal_data_properties` de mai jos maschează DOAR query params, deci
// nu-l acoperă. Confirmat cu query direct în PostHog: tokenuri VII reale, din trafic de producție, deja
// capturate necriptat înainte de acest fix. `before_send` rescrie $pathname/$current_url ÎNAINTE de
// trimitere, pentru orice eveniment (pageview sau altul) care poartă acest path.
const INVITE_JOIN_PATH = /\/projects\/join\/[^/?#]+/;

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
  before_send: (event) => {
    if (!event) return event;
    const props = event.properties;
    if (typeof props?.$pathname === "string" && INVITE_JOIN_PATH.test(props.$pathname)) {
      props.$pathname = props.$pathname.replace(INVITE_JOIN_PATH, "/projects/join/[redacted]");
    }
    if (typeof props?.$current_url === "string" && INVITE_JOIN_PATH.test(props.$current_url)) {
      props.$current_url = props.$current_url.replace(INVITE_JOIN_PATH, "/projects/join/[redacted]");
    }
    return event;
  },
});
