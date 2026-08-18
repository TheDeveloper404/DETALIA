import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const captureMock = vi.fn();
vi.mock("posthog-node", () => ({
  PostHog: vi.fn().mockImplementation(function PostHog() {
    return { capture: captureMock, flush: vi.fn() };
  }),
}));

const ORIGINAL_ENV = { ...process.env };

describe("captureServerEvent", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN = "test-token";
    captureMock.mockClear();
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.resetModules();
  });

  // Gol găsit 2026-08-18: fără `environment` pe evenimentele trimise prin SDK-ul complet (Server
  // Actions), o alertă Slack pe un astfel de eveniment n-avea cum să excludă trafic non-producție altfel
  // decât hardcodând o listă de email-uri de test — vezi CLAUDE.md.
  it("injectează `environment` din VERCEL_ENV în properties, fără să-l ceară apelantul", async () => {
    process.env.VERCEL_ENV = "production";
    const { captureServerEvent } = await import("./posthog-server");

    captureServerEvent("user-1", "detail_published", { detail_id: "d-1" });

    expect(captureMock).toHaveBeenCalledWith({
      distinctId: "user-1",
      event: "detail_published",
      properties: { detail_id: "d-1", environment: "production" },
    });
  });

  it("marchează corect mediul non-producție (preview/dev), nu doar producția", async () => {
    process.env.VERCEL_ENV = "preview";
    const { captureServerEvent } = await import("./posthog-server");

    captureServerEvent("user-1", "onboarding_completed");

    expect(captureMock).toHaveBeenCalledWith({
      distinctId: "user-1",
      event: "onboarding_completed",
      properties: { environment: "preview" },
    });
  });
});
