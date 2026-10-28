import type { CaptureResult } from "posthog-js";

// Invitatiile contin tokenul in path, unde mascarea query-ului nu ajunge.
export const INVITE_JOIN_PATH = /\/projects\/join\/[^/?#]+/;

// Mascam URL-urile din evenimente si profil, inclusiv intregul callback codificat in u.
export function redactInviteToken(event: CaptureResult | null): CaptureResult | null {
  if (!event) return event;
  for (const props of [
    event.properties,
    event.$set,
    event.$set_once,
    event.properties?.$set,
    event.properties?.$set_once,
  ]) {
    if (!props || typeof props !== "object") continue;
    for (const key of Object.keys(props)) {
      if (typeof props[key] !== "string") continue;
      const value = props[key].replace(INVITE_JOIN_PATH, "/projects/join/[redacted]");
      props[key] = value;
      if (!/^(https?:\/\/|\/)/i.test(value)) continue;
      const queryStart = value.indexOf("?");
      if (queryStart === -1) continue;
      const hashStart = value.indexOf("#", queryStart);
      const params = new URLSearchParams(
        value.slice(queryStart + 1, hashStart === -1 ? undefined : hashStart),
      );
      let redacted = false;
      for (const param of [...params.keys()]) {
        if (/^(token|u|email|callbackUrl)$/i.test(param)) {
          params.set(param, "[redacted]");
          redacted = true;
        }
      }
      // Pe URL-urile sensibile nu pastram nici fragmentul. Restul URL-urilor raman identice.
      if (redacted) props[key] = value.slice(0, queryStart + 1) + params.toString();
    }
  }
  return event;
}
