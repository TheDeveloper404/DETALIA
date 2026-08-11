import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_TTL = process.env.PROJECT_INVITE_TTL_DAYS;
const DAY_MS = 24 * 60 * 60 * 1000;

describe("isInviteTokenExpired", () => {
  beforeEach(() => {
    // Constanta TTL se citește din env O SINGURĂ DATĂ, la load-ul modulului — resetăm cache-ul de
    // module ca fiecare test să re-evalueze cu propria valoare de PROJECT_INVITE_TTL_DAYS.
    vi.resetModules();
    delete process.env.PROJECT_INVITE_TTL_DAYS;
  });

  afterEach(() => {
    if (ORIGINAL_TTL === undefined) delete process.env.PROJECT_INVITE_TTL_DAYS;
    else process.env.PROJECT_INVITE_TTL_DAYS = ORIGINAL_TTL;
  });

  it("token creat acum 1 zi (default TTL 3 zile) → NU e expirat", async () => {
    const { isInviteTokenExpired } = await import("@/lib/invite-token");
    expect(isInviteTokenExpired(new Date(Date.now() - 1 * DAY_MS))).toBe(false);
  });

  it("token creat acum 4 zile (default TTL 3 zile) → expirat", async () => {
    const { isInviteTokenExpired } = await import("@/lib/invite-token");
    expect(isInviteTokenExpired(new Date(Date.now() - 4 * DAY_MS))).toBe(true);
  });

  it("respectă TTL custom din PROJECT_INVITE_TTL_DAYS", async () => {
    process.env.PROJECT_INVITE_TTL_DAYS = "1";
    const { isInviteTokenExpired } = await import("@/lib/invite-token");
    expect(isInviteTokenExpired(new Date(Date.now() - 2 * DAY_MS))).toBe(true);
  });

  // /code-review QODO (2026-08-11): valori invalide/absurde din env NU trebuie să expire tokenurile
  // instant sau silențios — clamp [1, 30], altfel fallback la default (3).
  it("TTL negativ din env → NU expiră instant, cade pe default (3 zile)", async () => {
    process.env.PROJECT_INVITE_TTL_DAYS = "-1";
    const { isInviteTokenExpired } = await import("@/lib/invite-token");
    expect(isInviteTokenExpired(new Date(Date.now() - 1 * DAY_MS))).toBe(false);
  });

  it("TTL peste plafon (>30) din env → clamp, cade pe default (3 zile)", async () => {
    process.env.PROJECT_INVITE_TTL_DAYS = "9999";
    const { isInviteTokenExpired } = await import("@/lib/invite-token");
    expect(isInviteTokenExpired(new Date(Date.now() - 4 * DAY_MS))).toBe(true);
  });

  it("TTL = 0 sau NaN din env → cade pe default (3 zile)", async () => {
    process.env.PROJECT_INVITE_TTL_DAYS = "0";
    const { isInviteTokenExpired: expired0 } = await import("@/lib/invite-token");
    expect(expired0(new Date(Date.now() - 1 * DAY_MS))).toBe(false);

    vi.resetModules();
    process.env.PROJECT_INVITE_TTL_DAYS = "abc";
    const { isInviteTokenExpired: expiredNaN } = await import("@/lib/invite-token");
    expect(expiredNaN(new Date(Date.now() - 1 * DAY_MS))).toBe(false);
  });
});
