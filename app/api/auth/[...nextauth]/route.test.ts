import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// AUD-05 — POST direct pe /api/auth/signin/* trimitea magic link ocolind rate limit-ul și Turnstile
// din `signInWithEmailAction`. Restul rutelor Auth.js (signout, callback etc.) trebuie să meargă neatinse.

const { authPost } = vi.hoisted(() => ({ authPost: vi.fn(async () => new Response(null, { status: 302 })) }));

vi.mock("@/lib/auth", () => ({ handlers: { GET: vi.fn(), POST: authPost } }));

import { POST } from "./route";

const post = (path: string) => POST(new NextRequest(`https://detalia.ro${path}`, { method: "POST" }));

describe("POST /api/auth/[...nextauth]", () => {
  beforeEach(() => authPost.mockClear());

  it.each(["/api/auth/signin/resend", "/api/auth/signin", "/api/auth//signin/resend", "/api/auth/signin/resend/"])(
    "%s → 403, fără a ajunge la Auth.js (fără email trimis)",
    async (path) => {
      const res = await post(path);
      expect(res.status).toBe(403);
      expect(authPost).not.toHaveBeenCalled();
    },
  );

  it.each(["/api/auth/signout", "/api/auth/callback/resend"])("%s → trece la Auth.js", async (path) => {
    await post(path);
    expect(authPost).toHaveBeenCalledTimes(1);
  });
});
