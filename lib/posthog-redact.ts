import type { CaptureResult } from "posthog-js";

// SEC-002 (audit 2026-08-11): tokenul de invitație de proiect stă în PATH (`/projects/join/<token>`),
// nu în query string — `custom_personal_data_properties` din `instrumentation-client.ts` maschează DOAR
// query params, deci nu-l acoperă. Confirmat cu query direct în PostHog: tokenuri VII reale, din trafic
// de producție, deja capturate necriptat înainte de acest fix.
export const INVITE_JOIN_PATH = /\/projects\/join\/[^/?#]+/;

// Găsit la /code-review (2026-08-11): fix-ul inițial redacta DOAR $pathname/$current_url, dar PostHog
// poate purta același path și în $referrer, $initial_current_url sau proprietăți custom (orice event
// poate avea un URL cu tokenul în el) — scanăm generic toate proprietățile string, pentru orice
// eveniment (pageview sau altul) care poartă acest path.
export function redactInviteToken(event: CaptureResult | null): CaptureResult | null {
  if (!event) return event;
  const props = event.properties;
  if (!props) return event;
  for (const key of Object.keys(props)) {
    const value = props[key];
    if (typeof value === "string" && INVITE_JOIN_PATH.test(value)) {
      props[key] = value.replace(INVITE_JOIN_PATH, "/projects/join/[redacted]");
    }
  }
  return event;
}
