import { Auth } from "@auth/core";
import { decode, encode } from "@auth/core/jwt";
import type { NextAuthConfig, User } from "next-auth";
import type { JWT } from "next-auth/jwt";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  config: undefined as NextAuthConfig | undefined,
  sessions: new Map<string, { userId: string; expires: Date }>(),
  headers: new Headers(),
  consume: vi.fn(),
  frameworkSignOut: vi.fn(),
  revoke: vi.fn(),
}));

vi.mock("next-auth", () => ({ default: (config: NextAuthConfig) => {
  state.config = config;
  return { handlers: {}, auth: vi.fn(), signIn: vi.fn(), signOut: state.frameworkSignOut };
} }));
vi.mock("@auth/drizzle-adapter", () => ({ DrizzleAdapter: () => ({ useVerificationToken: state.consume }) }));
vi.mock("@/db", () => ({ db: {} }));
vi.mock("next/headers", () => ({ headers: async () => state.headers, cookies: vi.fn() }));
vi.mock("@/lib/email", () => ({ magicLinkEmailHtml: vi.fn(), magicLinkEmailText: vi.fn(), sendEmail: vi.fn() }));
vi.mock("@/server/repos/sessionsRepo", () => ({
  insertUserSession: async (sid: string, userId: string, expires: Date) => { state.sessions.set(sid, { userId, expires }); },
  hasValidUserSession: async (sid: string, userId: string) => {
    const session = state.sessions.get(sid);
    return !!session && session.userId === userId && session.expires.valueOf() > Date.now();
  },
  revokeUserSession: state.revoke,
}));

const { signOut, revokeCurrentSession } = await import("./auth");
const { SESSION_MAX_AGE_SECONDS } = await import("./session-config");
const USER: User = { id: "user-a", email: "test-user@example.test" };
const SECRET = "auth-unit-test-secret-not-for-any-real-environment";
const COOKIE = "__Secure-authjs.session-token";
type JwtArgs = Parameters<NonNullable<NonNullable<NextAuthConfig["callbacks"]>["jwt"]>>[0];
const jwt = (token: JWT, user?: User) => state.config!.callbacks!.jwt!({ token, user, account: null } as JwtArgs);

describe("Auth.js configured session registry", () => {
  beforeEach(() => {
    state.sessions.clear();
    state.headers = new Headers();
    state.frameworkSignOut.mockReset();
    state.revoke.mockReset().mockImplementation(async (sid: string) => { state.sessions.delete(sid); });
    state.consume.mockReset();
    vi.stubEnv("AUTH_SECRET", SECRET);
  });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

  // Regula: "Data din DB se stabileste o singura data si nu se prelungeste."
  it("keeps the same absolute expiry through real Auth.js session refresh and rejects the refreshed cookie after expiry", async () => {
    const token = await jwt({ sub: USER.id }, USER);
    expect(token?.sid).toBeTruthy();
    const registered = state.sessions.get(token!.sid!)!;
    expect(registered.expires.valueOf() - Date.now()).toBeLessThanOrEqual(SESSION_MAX_AGE_SECONDS * 1000);
    const originalExpiry = registered.expires.valueOf();
    const encrypted = await encode({ token: token!, secret: SECRET, salt: COOKIE, maxAge: SESSION_MAX_AGE_SECONDS });
    const config = { ...state.config!, providers: [], adapter: undefined, secret: SECRET, trustHost: true, basePath: "/api/auth" };
    const refreshed = await Auth(new Request("https://detalia.ro/api/auth/session", { headers: { cookie: `${COOKIE}=${encrypted}` } }), config);
    expect((await refreshed.json()).user.id).toBe(USER.id);
    const refreshedCookie = refreshed.headers.getSetCookie().find((value) => value.startsWith(`${COOKIE}=`))!.split(";")[0].slice(COOKIE.length + 1);
    const refreshedToken = await decode({ token: refreshedCookie, secret: SECRET, salt: COOKIE });
    expect(refreshedToken?.sid).toBe(token!.sid);
    expect(registered.expires.valueOf()).toBe(originalExpiry);
    registered.expires = new Date(Date.now() - 1);
    const expired = await Auth(new Request("https://detalia.ro/api/auth/session", { headers: { cookie: `${COOKIE}=${refreshedCookie}` } }), config);
    expect(await expired.json()).toBeNull();
  });

  // Regula: "Stergerea unui sid afecteaza numai acea sesiune, inclusiv copiile cookie-ului ei; celelalte dispozitive raman conectate."
  it("rejects the copied cookie after action logout and preserves a second device", async () => {
    const first = await jwt({ sub: USER.id }, USER);
    const second = await jwt({ sub: USER.id }, USER);
    const cookie = await encode({ token: first!, secret: SECRET, salt: COOKIE });
    state.headers.set("cookie", `${COOKIE}=${cookie}`);
    await signOut({ redirect: false });
    expect(await jwt(first!)).toBeNull();
    expect(await jwt(second!)).toMatchObject({ sid: second!.sid });
    expect(state.frameworkSignOut).toHaveBeenCalledOnce();
  });

  // Regula: "Sesiune fara sid, inexistenta sau expirata = neautentificat."
  it("rejects legacy, revoked, and mismatched-user sessions", async () => {
    expect(await jwt({ id: USER.id })).toBeNull();
    expect(await jwt({ id: USER.id, sid: "missing" })).toBeNull();
    const token = await jwt({ sub: USER.id }, USER);
    expect(await jwt({ ...token, id: "different-user" })).toBeNull();
  });

  // Regula: "Callback-ul JWT verifica existenta/expirarea registrului; regulile ACTIVE raman in portile dedicate."
  it("does not remove the deliberate suspended-account identity exception", async () => {
    const token = await jwt({ sub: USER.id }, { ...USER, status: "SUSPENDED" } as User);
    expect(await jwt(token!)).toMatchObject({ id: USER.id, status: "SUSPENDED" });
  });

  // Regula: "Revocarea esuata = logout-ul nu este raportat ca revocare reusita."
  it("does not call framework logout after a failed durable revocation", async () => {
    const token = await jwt({ sub: USER.id }, USER);
    state.headers.set("cookie", `${COOKIE}=${await encode({ token: token!, secret: SECRET, salt: COOKIE })}`);
    state.revoke.mockRejectedValueOnce(new Error("DB unavailable"));
    await expect(signOut({ redirect: false })).rejects.toThrow("DB unavailable");
    expect(state.frameworkSignOut).not.toHaveBeenCalled();
  });

  // Regula: "Aplicatia nu foloseste deloc autentificare Bearer — doar cookie HttpOnly."
  it("does not revoke a session supplied only as Authorization Bearer", async () => {
    const token = await jwt({ sub: USER.id }, USER);
    await revokeCurrentSession(new Headers({ authorization: `Bearer ${await encode({ token: token!, secret: SECRET, salt: COOKIE })}` }));
    expect(state.revoke).not.toHaveBeenCalled();
  });

  // Regula: "Fara email, token sau URL in logurile de diagnostic."
  it.each([false, true])("logs only tokenFound/tokenExpired metadata, found=%s", async (found) => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    state.consume.mockResolvedValueOnce(found ? { identifier: USER.email, token: "private-token", expires: new Date(Date.now() - 1) } : null);
    const adapter = state.config!.adapter as { useVerificationToken: (input: { identifier: string; token: string }) => Promise<unknown> };
    await adapter.useVerificationToken({ identifier: USER.email!, token: "private-token" });
    expect(warn).toHaveBeenCalledExactlyOnceWith("[magic-link] verification", { tokenFound: found, tokenExpired: found });
  });

  // Regula: "Pastreaza consumul atomic one-time al tokenului si nu logheaza emailul sau tokenul."
  it("returns the consumed valid token unchanged and propagates adapter errors", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const consumed = { identifier: USER.email, token: "private-token", expires: new Date(Date.now() + 60_000) };
    state.consume.mockResolvedValueOnce(consumed).mockRejectedValueOnce(new Error("adapter unavailable"));
    const adapter = state.config!.adapter as { useVerificationToken: (input: { identifier: string; token: string }) => Promise<unknown> };
    const input = { identifier: USER.email!, token: "private-token" };
    expect(await adapter.useVerificationToken(input)).toBe(consumed);
    await expect(adapter.useVerificationToken(input)).rejects.toThrow("adapter unavailable");
    expect(state.consume).toHaveBeenCalledTimes(2);
    expect(warn).not.toHaveBeenCalled();
  });
});
