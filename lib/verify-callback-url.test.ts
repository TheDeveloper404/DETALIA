import { describe, expect, it } from "vitest";

import { validateCallbackUrl } from "./verify-callback-url";

const PREVIEW_HOST = "detalia-abc123-livius-projects-1af30dca.vercel.app";

describe("validateCallbackUrl — SEC-06: originea de încredere vine din host-ul requestului, aliniat cu magic-link-url.ts", () => {
  it("callback Auth.js valid, pe un host din allowlist (preview) → acceptat", () => {
    const raw = `https://${PREVIEW_HOST}/api/auth/callback/resend?token=abc`;
    expect(validateCallbackUrl(raw, PREVIEW_HOST)).toBe(raw);
  });

  it("callback Auth.js valid, pe producție → acceptat", () => {
    const raw = "https://detalia.ro/api/auth/callback/resend?token=abc";
    expect(validateCallbackUrl(raw, "detalia.ro")).toBe(raw);
  });

  it("SEC-06 (regresie): host-ul requestului diferă de originea din `u` (ex. AUTH_URL fallback pe Preview) → respins, nu doar acceptat orbește pe AUTH_URL", () => {
    // `u` vine cu originea preview-ului real, dar dacă host-ul requestului curent (necunoscut/lipsă din
    // allowlist) cade pe fallback AUTH_URL — cele două nu mai coincid, exact scenariul care rupea /verify.
    const raw = `https://${PREVIEW_HOST}/api/auth/callback/resend?token=abc`;
    expect(validateCallbackUrl(raw, null)).toBeNull();
  });

  it("URL pe altă origine (phishing/open-redirect) → respins", () => {
    const raw = "https://evil.com/api/auth/callback/resend?token=abc";
    expect(validateCallbackUrl(raw, PREVIEW_HOST)).toBeNull();
  });

  it("origine corectă dar path greșit (nu callback Auth.js) → respins", () => {
    const raw = `https://${PREVIEW_HOST}/feed`;
    expect(validateCallbackUrl(raw, PREVIEW_HOST)).toBeNull();
  });

  it("lipsă / URL invalid → respins", () => {
    expect(validateCallbackUrl(undefined, PREVIEW_HOST)).toBeNull();
    expect(validateCallbackUrl("not a url", PREVIEW_HOST)).toBeNull();
  });
});
