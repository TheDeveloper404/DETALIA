import { afterEach, describe, expect, it, vi } from "vitest";

import { audit } from "./audit";

afterEach(() => vi.restoreAllMocks());

describe("audit — SEC-14: eveniment structurat fără PII brut", () => {
  it("emite o linie JSON cu event + fields + marker audit + severity", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    audit("rate_limited", { limiter: "mutation", idHash: "abc123" }, "warning");

    expect(spy).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(spy.mock.calls[0][0] as string);
    expect(payload).toMatchObject({
      audit: true,
      severity: "warning",
      event: "rate_limited",
      limiter: "mutation",
      idHash: "abc123",
    });
    expect(typeof payload.ts).toBe("string");
  });

  it("severity implicit = info", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    audit("access_denied_suspended", { userId: "u-1" });
    const payload = JSON.parse(spy.mock.calls[0][0] as string);
    expect(payload.severity).toBe("info");
  });

  it("nu aruncă dacă serializarea eșuează (best-effort)", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const circular: Record<string, unknown> = {};
    circular.self = circular; // JSON.stringify aruncă pe referință circulară
    expect(() => audit("rate_limited", circular)).not.toThrow();
    spy.mockRestore();
  });
});
