import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { reportServerEvent } from "@/lib/posthog-report";

const ORIGINAL_ENV = { ...process.env };

describe("reportServerEvent", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN = "test-token";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.unstubAllGlobals();
  });

  it("NU trimite către PostHog în afara producției (dev/preview)", () => {
    process.env.VERCEL_ENV = "preview";
    reportServerEvent("test_event");
    expect(fetch).not.toHaveBeenCalled();

    delete process.env.VERCEL_ENV;
    reportServerEvent("test_event");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("trimite către PostHog în producție", () => {
    process.env.VERCEL_ENV = "production";
    reportServerEvent("test_event", { foo: "bar" });
    expect(fetch).toHaveBeenCalledTimes(1);
    const [, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body.event).toBe("test_event");
    expect(body.properties.foo).toBe("bar");
  });
});
