import { beforeEach, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ checkLimit: vi.fn(), limiters: { support: {} } }));
vi.mock("@/server/services/supportService", () => ({ submitSupportRequest: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers({ "user-agent": "Test UA" })) }));

import { auth } from "@/lib/auth";
import { checkLimit } from "@/lib/rate-limit";
import { submitSupportRequest } from "@/server/services/supportService";

import { submitSupportRequestAction } from "./support-actions";

const input = { message: "Nu pot publica detaliul.", flow: "detail_publish", page: "/details/new" };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(checkLimit).mockResolvedValue({ ok: true });
  vi.mocked(submitSupportRequest).mockResolvedValue({ ok: true });
});

// Regula (plan aprobat): „fara sesiune = UNAUTHORIZED (UI arata emailul)" — fără redirect din dialog.
it("fără sesiune întoarce mesajul cu emailul și nu trimite nimic", async () => {
  vi.mocked(auth).mockResolvedValueOnce(null as never);
  const res = await submitSupportRequestAction(input);
  expect(res.ok).toBe(false);
  expect(res.error).toContain("support@detalia.ro");
  expect(submitSupportRequest).not.toHaveBeenCalled();
});

// Regula (plan aprobat): „checkLimit(limiters.support, userId)" — cota oprește spam-ul în canal.
it("peste cotă nu trimite nimic", async () => {
  vi.mocked(auth).mockResolvedValueOnce({ user: { id: "u1" } } as never);
  vi.mocked(checkLimit).mockResolvedValueOnce({ ok: false, retryAfterSec: 60 });
  const res = await submitSupportRequestAction(input);
  expect(res.ok).toBe(false);
  expect(submitSupportRequest).not.toHaveBeenCalled();
});

// Regula: userId din sesiune, niciodată din input (fără IDOR).
it("trimite cu userId din sesiune și user-agent din headers", async () => {
  vi.mocked(auth).mockResolvedValueOnce({ user: { id: "u1" } } as never);
  const res = await submitSupportRequestAction({ ...input, userId: "altcineva" } as typeof input);
  expect(res).toEqual({ ok: true });
  expect(submitSupportRequest).toHaveBeenCalledWith(
    expect.objectContaining({ userId: "u1", userAgent: "Test UA", flow: "detail_publish" }),
  );
});

it("traduce eroarea serviciului într-un mesaj pentru user", async () => {
  vi.mocked(auth).mockResolvedValueOnce({ user: { id: "u1" } } as never);
  vi.mocked(submitSupportRequest).mockResolvedValueOnce({ ok: false, error: "VALIDATION" });
  const res = await submitSupportRequestAction(input);
  expect(res).toEqual({ ok: false, error: "Scrie măcar câteva cuvinte despre problemă (minim 10 caractere)." });
});
