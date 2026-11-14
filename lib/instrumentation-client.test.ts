import { afterEach, describe, expect, it, vi } from "vitest";

const initMock = vi.fn();
vi.mock("posthog-js", () => ({ default: { init: initMock } }));

function stubBrowser(hostname: string) {
  vi.stubGlobal("location", { hostname });
  vi.stubGlobal("document", { cookie: "" });
  vi.stubGlobal("localStorage", { removeItem: vi.fn() });
}

describe("instrumentation-client", () => {
  afterEach(() => {
    initMock.mockClear();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("porneste PostHog pe detalia.ro", async () => {
    stubBrowser("detalia.ro");
    await import("@/instrumentation-client");
    expect(initMock).toHaveBeenCalledTimes(1);
  });

  it("nu porneste PostHog pe un preview Vercel", async () => {
    stubBrowser("detalia-abc123-team.vercel.app");
    await import("@/instrumentation-client");
    expect(initMock).not.toHaveBeenCalled();
  });
});
