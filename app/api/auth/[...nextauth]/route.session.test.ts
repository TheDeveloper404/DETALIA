import { encode } from "@auth/core/jwt";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  secret: "unit-test-secret-for-auth-session-revocation-only",
  revoked: new Set<string>(),
  failRevoke: false,
  revoke: vi.fn(),
}));

vi.mock("@/lib/auth", async () => {
  const { Auth } = await import("@auth/core");
  const { getToken } = await import("@auth/core/jwt");
  state.revoke.mockImplementation(async (headers: Headers) => {
    if (state.failRevoke) throw new Error("DB unavailable");
    const token = await getToken({ req: { headers }, secret: state.secret, secureCookie: true });
    if (token?.sid) state.revoked.add(token.sid);
  });
  return {
    handlers: {
      GET: (req: Request) => Auth(req, {
        secret: state.secret, trustHost: true, providers: [], basePath: "/api/auth",
      }),
      POST: (req: Request) => Auth(req, {
        secret: state.secret, trustHost: true, providers: [], basePath: "/api/auth",
        logger: { error: vi.fn() },
      }),
    },
    revokeCurrentSession: state.revoke,
  };
});

import { GET, POST } from "./route";

const BASE = "https://detalia.ro/api/auth";
const COOKIE_NAME = "__Secure-authjs.session-token";

async function signoutRequest(csrf: "valid" | "wrong" | "missing") {
  const csrfResponse = await GET(new NextRequest(`${BASE}/csrf`));
  const { csrfToken } = await csrfResponse.json();
  const csrfCookies = csrfResponse.headers.getSetCookie().map((value) => value.split(";")[0]);
  const jwt = await encode({ secret: state.secret, salt: COOKIE_NAME, token: { sub: "user", sid: "current-device" } });
  const form = new URLSearchParams({ callbackUrl: "https://detalia.ro/" });
  if (csrf !== "missing") form.set("csrfToken", csrf === "valid" ? csrfToken : "wrong-token");
  return new NextRequest(`${BASE}/signout`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      cookie: [...csrfCookies, `${COOKIE_NAME}=${jwt}`].join("; "),
    },
    body: form.toString(),
  });
}

describe("signout route with real Auth.js CSRF validation", () => {
  beforeEach(() => {
    state.revoked.clear();
    state.failRevoke = false;
    state.revoke.mockClear();
  });

  // Regula: "Un POST respins nu trebuie sa revoce sesiunea victimei (logout CSRF)."
  it.each(["missing", "wrong"] as const)("does not revoke with %s CSRF", async (csrf) => {
    await POST(await signoutRequest(csrf));
    expect(state.revoke).not.toHaveBeenCalled();
    expect(state.revoked.has("current-device")).toBe(false);
  });

  // Regula: "Stergerea unui sid afecteaza numai acea sesiune, inclusiv copiile cookie-ului ei; celelalte dispozitive raman conectate."
  it.each([false, true])("revokes after validated signout, client JSON response=%s", async (clientJson) => {
    const request = await signoutRequest("valid");
    if (clientJson) request.headers.set("X-Auth-Return-Redirect", "1");
    const response = await POST(request);
    expect(state.revoke).toHaveBeenCalledTimes(1);
    expect(state.revoked.has("current-device")).toBe(true);
    expect(state.revoked.has("other-device")).toBe(false);
    expect(response.headers.getSetCookie().some((value) => value.startsWith(`${COOKIE_NAME}=;`))).toBe(true);
  });

  // Regula: "Revocarea esuata = logout-ul nu este raportat ca revocare reusita."
  it("withholds Auth.js successful response if durable revocation fails", async () => {
    state.failRevoke = true;
    const response = await POST(await signoutRequest("valid"));
    expect(response.status).toBe(500);
    expect(response.headers.getSetCookie()).toEqual([]);
    expect(state.revoked.has("current-device")).toBe(false);
    expect(await response.json()).toEqual({ error: { code: "INTERNAL_ERROR", message: "Deconectarea nu a putut fi finalizata." } });
  });
});
