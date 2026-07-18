import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createCachedSettingsReader } from "./cached-settings-reader";

// Helperul din spatele gate-ului de lockdown (proxy.ts) — contractul complet e descris în sursă:
// TTL, deduplicare concurentă, ultima valoare bună la null-după-valoare, null legitim la început.
describe("createCachedSettingsReader", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("în TTL citește din cache — fetch-ul rulează o singură dată", async () => {
    const fetchRow = vi.fn().mockResolvedValue({ lockdownEnabled: false });
    const read = createCachedSettingsReader(fetchRow, 30_000);

    await expect(read()).resolves.toEqual({ lockdownEnabled: false });
    vi.advanceTimersByTime(29_000);
    await expect(read()).resolves.toEqual({ lockdownEnabled: false });
    expect(fetchRow).toHaveBeenCalledTimes(1);
  });

  it("după expirarea TTL re-citește (vede valoarea nouă)", async () => {
    const fetchRow = vi
      .fn()
      .mockResolvedValueOnce({ lockdownEnabled: false })
      .mockResolvedValueOnce({ lockdownEnabled: true });
    const read = createCachedSettingsReader(fetchRow, 30_000);

    await expect(read()).resolves.toEqual({ lockdownEnabled: false });
    vi.advanceTimersByTime(31_000);
    await expect(read()).resolves.toEqual({ lockdownEnabled: true });
    expect(fetchRow).toHaveBeenCalledTimes(2);
  });

  it("cererile concurente la cache expirat se deduplichează într-un singur fetch", async () => {
    const fetchRow = vi.fn().mockResolvedValue({ lockdownEnabled: false });
    const read = createCachedSettingsReader(fetchRow, 30_000);

    const results = await Promise.all([read(), read(), read(), read()]);
    expect(results).toEqual(Array(4).fill({ lockdownEnabled: false }));
    expect(fetchRow).toHaveBeenCalledTimes(1);
  });

  it("null după o valoare bună = eroare tranzitorie → ține ultima valoare bună", async () => {
    const fetchRow = vi
      .fn()
      .mockResolvedValueOnce({ lockdownEnabled: true })
      .mockResolvedValueOnce(null) // blip de DB
      .mockResolvedValueOnce({ lockdownEnabled: false });
    const read = createCachedSettingsReader(fetchRow, 30_000);

    await expect(read()).resolves.toEqual({ lockdownEnabled: true });
    vi.advanceTimersByTime(31_000);
    // Blip → NU flip-uim gate-ul: rămâne ultima valoare bună.
    await expect(read()).resolves.toEqual({ lockdownEnabled: true });
    vi.advanceTimersByTime(31_000);
    // DB-ul și-a revenit → valoarea proaspătă.
    await expect(read()).resolves.toEqual({ lockdownEnabled: false });
    expect(fetchRow).toHaveBeenCalledTimes(3);
  });

  it("null fără nicio valoare anterioară e legitim (tabel gol) → null, cache-uit în TTL", async () => {
    const fetchRow = vi.fn().mockResolvedValue(null);
    const read = createCachedSettingsReader(fetchRow, 30_000);

    await expect(read()).resolves.toBeNull();
    await expect(read()).resolves.toBeNull();
    expect(fetchRow).toHaveBeenCalledTimes(1);
  });
});
