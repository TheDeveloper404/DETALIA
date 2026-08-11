import { describe, expect, it } from "vitest";

import { redactInviteToken } from "@/lib/posthog-redact";

function eventWithProps(properties?: Record<string, unknown>) {
  return { event: "$pageview", properties } as unknown as Parameters<typeof redactInviteToken>[0];
}

describe("redactInviteToken", () => {
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
