import { PostHog } from "posthog-js/lib/src/posthog-core";
import { describe, expect, it } from "vitest";

import { redactInviteToken } from "@/lib/posthog-redact";

function eventWithProps(properties?: Record<string, unknown>) {
  return { event: "$pageview", properties } as unknown as Parameters<typeof redactInviteToken>[0];
}

describe("redactInviteToken", () => {
  // PII (email, tokenuri, OTP, dovezi rol) **nu se loghează** — doar metadate.
  it.each(["$referrer", "$current_url", "$initial_current_url", "customUrlProp"])(
    "mascheaza callback-ul magic link complet din %s",
    (key) => {
      const callback =
        "https://detalia.ro/api/auth/callback/resend?token=fixture-token&email=fixture%40example.test&callbackUrl=https%3A%2F%2Fdetalia.ro%2Ffeed";
      const out = redactInviteToken(
        eventWithProps({
          [key]: `/verify?u=${encodeURIComponent(callback)}&error=Verification`,
          token: "public-ingestion-key",
        }),
      )!;
      expect(out.properties[key]).toBe("/verify?u=%5Bredacted%5D&error=Verification");
      expect(out.properties.token).toBe("public-ingestion-key");
    },
  );

  it.each([
    "/api/auth/callback/resend?token=fixture&email=fixture%40example.test&callbackUrl=%2Ffeed",
    "https://detalia.ro/login?TOKEN=first&token=second&to%6ben=third&EMAIL=fixture%40example.test",
    "https://[invalid/verify?u=%E0%A4%A&token=fixture#token=fragment-secret",
  ])("mascheaza parametri directi, codificati, duplicati sau intr-un URL malformat: %s", (url) => {
    const out = redactInviteToken(eventWithProps({ $referrer: url }))!;
    const result = out.properties.$referrer as string;
    expect(result).not.toMatch(/fixture|first|second|third|fragment-secret|%E0%A4%A/);
    const query = new URLSearchParams(result.slice(result.indexOf("?") + 1));
    expect([...query.values()].every((value) => value === "[redacted]")).toBe(true);
  });

  it("mascheaza URL-urile din proprietatile de profil, inclusiv valorile initiale", () => {
    const event = eventWithProps({
      $set: { $referrer: "/verify?u=fixture-current" },
      $set_once: { $initial_current_url: "/verify?u=fixture-initial" },
    })!;
    event.$set = { $referrer: "/verify?u=fixture-top-current" };
    event.$set_once = { $initial_current_url: "/verify?u=fixture-top-initial" };
    const out = redactInviteToken(event)!;
    for (const bag of [out.$set, out.$set_once, out.properties.$set, out.properties.$set_once]) {
      expect(JSON.stringify(bag)).not.toContain("fixture-");
      expect(JSON.stringify(bag)).toContain("%5Bredacted%5D");
    }
  });

  it("pastreaza diagnosticul Verification si parametrii fara date sensibile", () => {
    const props = {
      $current_url: "https://detalia.ro/login?error=Verification",
      $referrer: "/feed?cat=abc&q=detaliu#top",
      other: 42,
    };
    expect(redactInviteToken(eventWithProps({ ...props }))!.properties).toEqual(props);
  });

  it("SDK-ul PostHog executa hook-ul fara a respinge evenimentul sau cheia de ingestie", () => {
    const sdk = new PostHog();
    sdk.config.before_send = redactInviteToken;
    const event = eventWithProps({
      token: "public-ingestion-key",
      $referrer: "/verify?u=fixture-callback",
    })!;
    event.$set_once = { $initial_referrer: "/verify?u=fixture-initial" };
    const out = (sdk as unknown as { _runBeforeSend: typeof redactInviteToken })._runBeforeSend(
      event,
    )!;
    expect(out).not.toBeNull();
    expect(out.properties.token).toBe("public-ingestion-key");
    expect(out.properties.$referrer).toBe("/verify?u=%5Bredacted%5D");
    expect(out.$set_once?.$initial_referrer).toBe("/verify?u=%5Bredacted%5D");
  });

  it("redactează token-ul din $pathname și $current_url", () => {
    const event = eventWithProps({
      $pathname: "/projects/join/abc123",
      $current_url: "https://detalia.ro/projects/join/abc123",
    });
    const out = redactInviteToken(event)!;
    expect(out.properties.$pathname).toBe("/projects/join/[redacted]");
    expect(out.properties.$current_url).toBe("https://detalia.ro/projects/join/[redacted]");
  });

  it("redactează token-ul și din alte proprietăți (ex. $referrer, $initial_current_url, custom)", () => {
    const event = eventWithProps({
      $referrer: "https://detalia.ro/projects/join/secret-token",
      $initial_current_url: "https://detalia.ro/projects/join/secret-token",
      customUrlProp: "/projects/join/secret-token?foo=bar",
    });
    const out = redactInviteToken(event)!;
    expect(out.properties.$referrer).toBe("https://detalia.ro/projects/join/[redacted]");
    expect(out.properties.$initial_current_url).toBe("https://detalia.ro/projects/join/[redacted]");
    expect(out.properties.customUrlProp).toBe("/projects/join/[redacted]?foo=bar");
  });

  it("nu atinge proprietăți fără path-ul de invitație", () => {
    const event = eventWithProps({ $pathname: "/feed", other: 42 });
    const out = redactInviteToken(event)!;
    expect(out.properties.$pathname).toBe("/feed");
    expect(out.properties.other).toBe(42);
  });

  it("nu aruncă pe event/properties absente", () => {
    expect(redactInviteToken(null)).toBeNull();
    expect(redactInviteToken(eventWithProps(undefined))).toBeTruthy();
  });
});
