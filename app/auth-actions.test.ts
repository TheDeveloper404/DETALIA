import { afterEach, describe, expect, it, vi } from "vitest";

// signInWithEmailAction e poarta publică de auth (SEC-01: rate-limit + Turnstile ÎNAINTE de Resend/DB) —
// netestat până acum. Mockuim toate dependințele externe (rate-limit, turnstile, signIn, usersRepo) și
// `redirect` (aruncă un marker, ca în Next.js real — NEXT_REDIRECT oprește execuția).

// vi.mock e hoistat DEASUPRA oricărei declarații din fișier (inclusiv `const`/`class`) → orice referință
// folosită într-o factory trebuie declarată prin vi.hoisted(), altfel pică pe TDZ ("Cannot access before
// initialization"). De-asta `redirect` aruncă un Error simplu (mesaj prefixat), nu o clasă instanceof.
const REDIRECT_PREFIX = "REDIRECT:";

const { checkLimit, verifyTurnstile, userExistsByEmail, signIn } = vi.hoisted(() => ({
  checkLimit: vi.fn(),
  verifyTurnstile: vi.fn(),
  userExistsByEmail: vi.fn(),
  signIn: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

vi.mock("@/lib/rate-limit", () => ({
  checkLimit,
  clientIp: vi.fn(async () => "1.2.3.4"),
  hashEmail: (e: string) => `hash(${e})`,
  limiters: { authPerEmail: "authPerEmail", authPerIp: "authPerIp" },
}));

vi.mock("@/lib/turnstile", () => ({ verifyTurnstile }));

vi.mock("@/server/repos/usersRepo", () => ({ userExistsByEmail }));

vi.mock("@/lib/auth", () => ({ signIn }));

import { signInWithEmailAction } from "./auth-actions";

function formData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

async function runExpectingRedirect(fd: FormData): Promise<string> {
  try {
    await signInWithEmailAction(fd);
    throw new Error("nu a redirecționat");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.startsWith(REDIRECT_PREFIX)) return message.slice(REDIRECT_PREFIX.length);
    throw err;
  }
}

describe("signInWithEmailAction", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("SEC-01: cotă depășită pe email → RateLimited, ÎNAINTE de Turnstile/signIn", async () => {
    checkLimit.mockResolvedValueOnce({ ok: false }).mockResolvedValueOnce({ ok: true });

    const url = await runExpectingRedirect(formData({ email: "a@x.ro", authPath: "/login" }));

    expect(url).toBe("/login?error=RateLimited");
    expect(verifyTurnstile).not.toHaveBeenCalled();
    expect(signIn).not.toHaveBeenCalled();
  });

  it("Turnstile respins → CaptchaFailed, ÎNAINTE de userExistsByEmail/signIn", async () => {
    checkLimit.mockResolvedValue({ ok: true });
    verifyTurnstile.mockResolvedValueOnce(false);

    const url = await runExpectingRedirect(
      formData({ email: "a@x.ro", authPath: "/signup", "cf-turnstile-response": "bad-token" }),
    );

    expect(url).toBe("/signup?error=CaptchaFailed");
    expect(userExistsByEmail).not.toHaveBeenCalled();
    expect(signIn).not.toHaveBeenCalled();
  });

  it("anti-enumerare: /login cu email fără cont → NoAccount (nu trimite magic link)", async () => {
    checkLimit.mockResolvedValue({ ok: true });
    verifyTurnstile.mockResolvedValue(true);
    userExistsByEmail.mockResolvedValueOnce(false);

    const url = await runExpectingRedirect(formData({ email: "nimeni@x.ro", authPath: "/login" }));

    expect(url).toBe("/login?error=NoAccount");
    expect(signIn).not.toHaveBeenCalled();
  });

  it("anti-enumerare: /signup cu email cu cont existent → AccountExists (nu trimite magic link)", async () => {
    checkLimit.mockResolvedValue({ ok: true });
    verifyTurnstile.mockResolvedValue(true);
    userExistsByEmail.mockResolvedValueOnce(true);

    const url = await runExpectingRedirect(formData({ email: "exista@x.ro", authPath: "/signup" }));

    expect(url).toBe("/signup?error=AccountExists");
    expect(signIn).not.toHaveBeenCalled();
  });

  it("happy path: totul trece → signIn apelat, redirect la callbackUrl", async () => {
    checkLimit.mockResolvedValue({ ok: true });
    verifyTurnstile.mockResolvedValue(true);
    userExistsByEmail.mockResolvedValueOnce(true); // /login, cont existent → OK
    signIn.mockResolvedValueOnce(undefined);

    const url = await runExpectingRedirect(
      formData({ email: "user@x.ro", authPath: "/login", callbackUrl: "/feed" }),
    );

    expect(signIn).toHaveBeenCalledWith(
      "resend",
      expect.objectContaining({ email: "user@x.ro", redirectTo: "/feed" }),
    );
    expect(url).toBe("/feed");
  });
});
