import { afterEach, describe, expect, it, vi } from "vitest";

// SEC-001 (2026-08-09, security-engineer review PR #215): regresie pentru bug-ul unde delogarea reală
// depindea EXCLUSIV de un `useEffect` client pe /logout — dacă tab-ul se închidea sau POST-ul eșua,
// cookie-ul de sesiune supraviețuia pe un cont deja anonimizat/deconectat. Fix: signOutAction și
// deleteAccountAction șterg cookie-ul SERVER-SIDE, înainte de orice redirect. Testul verifică exact
// asta — nu doar că funcțiile nu crapă, ci ORDINEA reală a apelurilor.

const REDIRECT_PREFIX = "REDIRECT:";

const { signOut, clearSessionCookie, auth, deleteAccount, posthogCapture, posthogFlush } = vi.hoisted(
  () => ({
    signOut: vi.fn(async () => undefined),
    clearSessionCookie: vi.fn(async () => undefined),
    auth: vi.fn(async () => ({ user: { id: "user-1" } })),
    deleteAccount: vi.fn(async () => undefined),
    posthogCapture: vi.fn(),
    posthogFlush: vi.fn(async () => undefined),
  }),
);

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`${REDIRECT_PREFIX}${url}`);
  }),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/lib/auth", () => ({ auth, signOut, clearSessionCookie }));

vi.mock("@/lib/posthog-server", () => ({
  getPostHogClient: () => ({ capture: posthogCapture, flush: posthogFlush }),
  captureServerEvent: posthogCapture,
  flushPostHogEvents: posthogFlush,
}));

vi.mock("@/lib/rate-limit", () => ({
  checkLimit: vi.fn(async () => ({ ok: true })),
  limiters: { mutation: "mutation" },
}));

vi.mock("@/lib/require-active-user", () => ({
  requireActiveUserId: vi.fn(async () => "user-1"),
}));

vi.mock("@/server/services/accountService", () => ({ deleteAccount }));

vi.mock("@/server/services/profileService", () => ({
  removeAvatar: vi.fn(),
  removeCover: vi.fn(),
  setAvatar: vi.fn(),
  setCover: vi.fn(),
  setCoverPosition: vi.fn(),
  updateProfileDetails: vi.fn(),
}));

import { deleteAccountAction, signOutAction } from "./actions";

async function runExpectingRedirect(fn: () => Promise<void>): Promise<string> {
  try {
    await fn();
    throw new Error("nu a redirecționat");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.startsWith(REDIRECT_PREFIX)) return message.slice(REDIRECT_PREFIX.length);
    throw err;
  }
}

describe("signOutAction / deleteAccountAction — SEC-001", () => {
  afterEach(() => {
    vi.resetAllMocks();
    signOut.mockResolvedValue(undefined);
    clearSessionCookie.mockResolvedValue(undefined);
    auth.mockResolvedValue({ user: { id: "user-1" } });
    deleteAccount.mockResolvedValue(undefined);
    posthogFlush.mockResolvedValue(undefined);
  });

  it("signOutAction: șterge cookie-ul server-side ÎNAINTE de redirect, nu doar la client", async () => {
    const calls: string[] = [];
    signOut.mockImplementation(async () => {
      calls.push("signOut");
    });
    clearSessionCookie.mockImplementation(async () => {
      calls.push("clearSessionCookie");
    });

    const url = await runExpectingRedirect(signOutAction);

    expect(calls).toEqual(["signOut", "clearSessionCookie"]);
    expect(signOut).toHaveBeenCalledWith({ redirect: false });
    expect(url).toBe("/logout");
  });

  it("deleteAccountAction: cookie-ul e șters server-side DUPĂ anonimizarea contului, ÎNAINTE de redirect", async () => {
    const calls: string[] = [];
    deleteAccount.mockImplementation(async () => {
      calls.push("deleteAccount");
    });
    signOut.mockImplementation(async () => {
      calls.push("signOut");
    });
    clearSessionCookie.mockImplementation(async () => {
      calls.push("clearSessionCookie");
    });

    const url = await runExpectingRedirect(deleteAccountAction);

    expect(calls).toEqual(["deleteAccount", "signOut", "clearSessionCookie"]);
    expect(url).toBe("/logout");
  });

  it("deleteAccountAction: clearSessionCookie() rulează chiar dacă signOut() (Auth.js) eșuează", async () => {
    signOut.mockRejectedValueOnce(new Error("Auth.js signout endpoint indisponibil"));

    // Eroarea lui signOut() propagă mai departe (nu o înghițim silențios), dar cookie-ul de sesiune
    // tot trebuie șters — contul e deja anonimizat în DB la acest punct, nu poate rămâne o sesiune
    // validă pe el doar pentru că un pas secundar a eșuat.
    await expect(deleteAccountAction()).rejects.toThrow("Auth.js signout endpoint indisponibil");

    expect(deleteAccount).toHaveBeenCalledWith("user-1");
    expect(clearSessionCookie).toHaveBeenCalledTimes(1);
  });
});
