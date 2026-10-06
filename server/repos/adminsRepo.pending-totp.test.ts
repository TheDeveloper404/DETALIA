import { describe, expect, it, vi } from "vitest";

// AUD-02 — pe Postgres real (PGlite): promovarea de după înrolarea TOTP consumă sesiunea intermediară
// DOAR dacă poartă dovada înrolării, în același DELETE atomic.
vi.mock("@/db", async () => {
  const { createTestDb } = await import("@/db/test-db");
  const schema = await import("@/db/schema");
  const { db } = await createTestDb();
  return { db, schema };
});

const {
  insertAdminPendingSession,
  markAdminPendingTotpVerified,
  consumeTotpVerifiedAdminPendingSession,
  getValidAdminPendingSession,
} = await import("./adminsRepo");

const inOneHour = () => new Date(Date.now() + 60 * 60 * 1000);

describe("sesiune intermediară admin — dovada înrolării TOTP", () => {
  it("fără dovadă → NU se consumă, sesiunea rămâne", async () => {
    await insertAdminPendingSession("hash-fara-dovada", "admin@test.local", inOneHour());
    expect(await consumeTotpVerifiedAdminPendingSession("hash-fara-dovada")).toBeNull();
    expect(await getValidAdminPendingSession("hash-fara-dovada")).not.toBeNull();
  });

  it("cu dovadă → se consumă o singură dată", async () => {
    await insertAdminPendingSession("hash-cu-dovada", "admin@test.local", inOneHour());
    expect(await markAdminPendingTotpVerified("hash-cu-dovada")).toBe(true);
    expect(await consumeTotpVerifiedAdminPendingSession("hash-cu-dovada")).toBe("admin@test.local");
    expect(await consumeTotpVerifiedAdminPendingSession("hash-cu-dovada")).toBeNull();
  });

  it("dovada e legată de sesiune — marcarea alteia nu o deblochează pe a ta", async () => {
    await insertAdminPendingSession("hash-admin", "admin@test.local", inOneHour());
    await insertAdminPendingSession("hash-atacator", "admin@test.local", inOneHour());
    await markAdminPendingTotpVerified("hash-admin");
    expect(await consumeTotpVerifiedAdminPendingSession("hash-atacator")).toBeNull();
  });

  it("sesiune expirată → nici marcare, nici consum", async () => {
    await insertAdminPendingSession("hash-expirat", "admin@test.local", new Date(Date.now() - 1000));
    expect(await markAdminPendingTotpVerified("hash-expirat")).toBe(false);
    expect(await consumeTotpVerifiedAdminPendingSession("hash-expirat")).toBeNull();
  });
});
