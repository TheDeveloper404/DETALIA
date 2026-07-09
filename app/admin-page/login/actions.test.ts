import { afterEach, describe, expect, it, vi } from "vitest";

// requestAdminLinkAction = poarta privilegiată de admin. Ordinea de apărare: rate-limit → Turnstile →
// isAdminEmail → sendEmail. Mockuim toate dependințele externe și verificăm că anti-bot-ul blochează
// ÎNAINTE de a atinge Resend, cu răspuns GENERIC (fără a scurge dacă emailul e admin).

const { checkLimit, verifyTurnstile, isAdminEmail, sendEmail, createAdminLoginUrl } = vi.hoisted(() => ({
  checkLimit: vi.fn(),
  verifyTurnstile: vi.fn(),
  isAdminEmail: vi.fn(),
  sendEmail: vi.fn(),
  createAdminLoginUrl: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  checkLimit,
  clientIp: vi.fn(async () => "1.2.3.4"),
  hashAuditId: (v: string) => `hash(${v})`,
  limiters: { adminLoginPerUser: "adminLoginPerUser", adminLoginPerIp: "adminLoginPerIp" },
}));

vi.mock("@/lib/turnstile", () => ({ verifyTurnstile }));

vi.mock("@/lib/admin-auth", () => ({
  isAdminEmail,
  createAdminLoginUrl,
  adminLinkTtlMinutes: () => 10,
}));

vi.mock("@/lib/email", () => ({
  sendEmail,
  adminLoginEmailHtml: () => "<html></html>",
  adminLoginEmailText: () => "text",
}));

vi.mock("@/lib/audit", () => ({ audit: vi.fn() }));

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers({ host: "detalia.ro" })),
}));

import { requestAdminLinkAction, type AdminLoginState } from "./actions";

const INITIAL: AdminLoginState = { sent: false, error: null };

function formData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

describe("requestAdminLinkAction", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("cotă depășită → mesaj generic, ÎNAINTE de Turnstile/sendEmail", async () => {
    checkLimit.mockResolvedValueOnce({ ok: false }).mockResolvedValueOnce({ ok: true });

    const state = await requestAdminLinkAction(INITIAL, formData({ email: "liviu@detalia.ro" }));

    expect(state.sent).toBe(false);
    expect(verifyTurnstile).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("Turnstile respins → eroare generică, ÎNAINTE de isAdminEmail/sendEmail (fără enumerare)", async () => {
    checkLimit.mockResolvedValue({ ok: true });
    verifyTurnstile.mockResolvedValueOnce(false);

    const state = await requestAdminLinkAction(
      INITIAL,
      formData({ email: "liviu@detalia.ro", "cf-turnstile-response": "bad-token" }),
    );

    expect(state.sent).toBe(false);
    expect(state.error).toBeTruthy();
    expect(isAdminEmail).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("captcha ok + email admin → trimite linkul, răspuns generic sent", async () => {
    checkLimit.mockResolvedValue({ ok: true });
    verifyTurnstile.mockResolvedValueOnce(true);
    isAdminEmail.mockReturnValueOnce(true);
    createAdminLoginUrl.mockResolvedValueOnce("https://detalia.ro/admin-page/verify?token=x");

    const state = await requestAdminLinkAction(
      INITIAL,
      formData({ email: "liviu@detalia.ro", "cf-turnstile-response": "good-token" }),
    );

    expect(state.sent).toBe(true);
    expect(sendEmail).toHaveBeenCalledOnce();
  });

  it("captcha ok + email NON-admin → răspuns identic (sent), FĂRĂ email trimis (anti-enumerare)", async () => {
    checkLimit.mockResolvedValue({ ok: true });
    verifyTurnstile.mockResolvedValueOnce(true);
    isAdminEmail.mockReturnValueOnce(false);

    const state = await requestAdminLinkAction(
      INITIAL,
      formData({ email: "strain@example.com", "cf-turnstile-response": "good-token" }),
    );

    expect(state.sent).toBe(true);
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
