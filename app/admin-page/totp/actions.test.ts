import { beforeEach, describe, expect, it, vi } from "vitest";

// AUD-02 — `finishAdminTotpEnrollmentAction` e un POST apelabil direct: cine are doar primul factor
// (magic link) NU trebuie să obțină sesiune completă. Dovada vine numai din înrolarea confirmată cu cod.

const { getAdminPendingSession, markPendingTotpVerified, promoteAdminPendingSession, confirmAdminTotpEnrollment } =
  vi.hoisted(() => ({
    getAdminPendingSession: vi.fn(),
    markPendingTotpVerified: vi.fn(),
    promoteAdminPendingSession: vi.fn(),
    confirmAdminTotpEnrollment: vi.fn(),
  }));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
vi.mock("@/lib/admin-auth", () => ({
  getAdminPendingSession,
  markPendingTotpVerified,
  promoteAdminPendingSession,
  registerFailedTotpAttempt: vi.fn(async () => 3),
}));
vi.mock("@/lib/audit", () => ({ audit: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({
  checkLimit: vi.fn(async () => ({ ok: true })),
  clientIp: vi.fn(async () => "1.2.3.4"),
  hashAuditId: (v: string) => `hash(${v})`,
  limiters: { adminTotpPerUser: "u", adminTotpPerIp: "i" },
}));
vi.mock("@/server/services/adminTotpService", () => ({
  confirmAdminTotpEnrollment,
  verifyAdminSecondFactor: vi.fn(),
}));

import { confirmEnrollmentAction, finishAdminTotpEnrollmentAction } from "./actions";

const INITIAL = { error: null, backupCodes: null };

function codeForm(code: string): FormData {
  const f = new FormData();
  f.set("code", code);
  return f;
}

beforeEach(() => {
  vi.clearAllMocks();
  getAdminPendingSession.mockResolvedValue({ email: "admin@test.local", attempts: 0 });
});

describe("finishAdminTotpEnrollmentAction", () => {
  it("promovează DOAR cu dovada înrolării (requireTotpVerified)", async () => {
    promoteAdminPendingSession.mockResolvedValue("admin@test.local");
    await expect(finishAdminTotpEnrollmentAction()).rejects.toThrow("REDIRECT:/admin-page");
    expect(promoteAdminPendingSession).toHaveBeenCalledWith({ requireTotpVerified: true });
  });

  it("apel direct fără dovadă (promote refuză) → înapoi la login, nu în panou", async () => {
    promoteAdminPendingSession.mockResolvedValue(null);
    await expect(finishAdminTotpEnrollmentAction()).rejects.toThrow("REDIRECT:/admin-page/login?error=expired");
  });

  it("fără sesiune intermediară → login, fără încercare de promovare", async () => {
    getAdminPendingSession.mockResolvedValue(null);
    await expect(finishAdminTotpEnrollmentAction()).rejects.toThrow("REDIRECT:/admin-page/login?error=expired");
    expect(promoteAdminPendingSession).not.toHaveBeenCalled();
  });
});

describe("confirmEnrollmentAction", () => {
  it("cod valid → marchează sesiunea și întoarce codurile de rezervă", async () => {
    confirmAdminTotpEnrollment.mockResolvedValue({ ok: true, backupCodes: ["a", "b"] });
    const res = await confirmEnrollmentAction(INITIAL, codeForm("123456"));
    expect(markPendingTotpVerified).toHaveBeenCalledTimes(1);
    expect(res).toEqual({ error: null, backupCodes: ["a", "b"] });
  });

  it("cod greșit → NU marchează", async () => {
    confirmAdminTotpEnrollment.mockResolvedValue({ ok: false, reason: "bad_code" });
    await confirmEnrollmentAction(INITIAL, codeForm("000000"));
    expect(markPendingTotpVerified).not.toHaveBeenCalled();
  });

  it("TOTP deja activ (atacatorul apelează înrolarea direct) → NU marchează", async () => {
    confirmAdminTotpEnrollment.mockResolvedValue({ ok: false, reason: "already_enabled" });
    await confirmEnrollmentAction(INITIAL, codeForm("123456"));
    expect(markPendingTotpVerified).not.toHaveBeenCalled();
  });
});
