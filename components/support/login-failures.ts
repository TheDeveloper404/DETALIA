// Contorul de linkuri de conectare eșuate (Verification) din browserul curent. Userul nu e logat, deci
// nu avem server-side pe cine să numărăm — ținem momentele în localStorage, doar ultimele 24h contează.

export const LOGIN_FAILURES_KEY = "detalia:login-verification-failures";
const WINDOW_MS = 24 * 60 * 60 * 1000;
// Același eșec înregistrat de două ori la rând (StrictMode rulează efectele de două ori în dev) nu e un eșec nou.
const DEDUPE_MS = 2000;

export function recentFailures(stored: number[], now: number): number[] {
  return stored.filter((t) => Number.isFinite(t) && now - t < WINDOW_MS);
}

export function recordVerificationFailure(stored: number[], now: number): number[] {
  const recent = recentFailures(stored, now);
  const last = recent[recent.length - 1];
  if (last !== undefined && now - last < DEDUPE_MS) return recent;
  return [...recent, now];
}

export function parseStoredFailures(raw: string | null): number[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((t): t is number => typeof t === "number") : [];
  } catch {
    return [];
  }
}
