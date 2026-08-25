import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const captureMock = vi.fn();
const flushMock = vi.fn();
vi.mock("posthog-node", () => ({
  PostHog: vi.fn().mockImplementation(function PostHog() {
    return { capture: captureMock, flush: flushMock };
  }),
}));

const ORIGINAL_ENV = { ...process.env };

describe("captureServerEvent", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN = "test-token";
    captureMock.mockClear();
    flushMock.mockReset();
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

// Regresie 2026-08-25: flush() n-are un timeout strâns implicit — pe un serverless function care apoi
// face redirect() către user, un răspuns lent/agățat de la PostHog bloca acțiunea întreagă (schița
// rămânea "Se publică…" minute în șir, deși scrierea în DB deja reușise). flushPostHogEvents() trebuie
// să nu depășească niciodată plafonul, indiferent cum se comportă flush()-ul real.
describe("flushPostHogEvents", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN = "test-token";
    flushMock.mockReset();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    process.env = { ...ORIGINAL_ENV };
    vi.resetModules();
  });

  it("se rezolvă imediat dacă flush() real răspunde rapid", async () => {
    flushMock.mockResolvedValue(undefined);
    const { flushPostHogEvents } = await import("./posthog-server");

    let resolved = false;
    const p = flushPostHogEvents().then(() => {
      resolved = true;
    });
    await vi.advanceTimersByTimeAsync(0);
    await p;

    expect(resolved).toBe(true);
  });

  it("nu depășește plafonul de 2s dacă flush() real rămâne agățat", async () => {
    flushMock.mockImplementation(() => new Promise(() => {})); // never resolves
    const { flushPostHogEvents } = await import("./posthog-server");

    let resolved = false;
    const p = flushPostHogEvents().then(() => {
      resolved = true;
    });

    await vi.advanceTimersByTimeAsync(1999);
    expect(resolved).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    await p;
    expect(resolved).toBe(true);
  });

  it("nu aruncă mai departe dacă flush() real respinge promisiunea", async () => {
    flushMock.mockRejectedValue(new Error("network down"));
    const { flushPostHogEvents } = await import("./posthog-server");

    await expect(flushPostHogEvents()).resolves.toBeUndefined();
  });
});
