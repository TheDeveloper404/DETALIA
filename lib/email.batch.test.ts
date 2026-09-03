import { randomBytes } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { sendEmailBatch } from "./email";

const msgs = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ to: `u${i}@test.local`, subject: "s", html: "<h>", text: "t" }));

beforeEach(() => {
  process.env.AUTH_RESEND_KEY = "re_" + randomBytes(8).toString("hex");
  process.env.EMAIL_FROM = "test@detalia.ro";
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("sendEmailBatch", () => {
  it("lot acceptat → numără tot lotul, un singur apel /emails/batch", async () => {
    const fetchMock = vi.fn((url: string) => {
      void url;
      return Promise.resolve(new Response("{}", { status: 200 }));
    });
    vi.stubGlobal("fetch", fetchMock);

    expect(await sendEmailBatch(msgs(3))).toBe(3);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain("/emails/batch");
  });

  it("lot respins (429) → fallback individual prin /emails; numără doar succesele", async () => {
    let individualCall = 0;
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).endsWith("/emails/batch")) return new Response("rate", { status: 429 });
      individualCall += 1;
      return new Response("{}", { status: individualCall === 2 ? 500 : 200 }); // al 2-lea pică
    });
    vi.stubGlobal("fetch", fetchMock);

    expect(await sendEmailBatch(msgs(3))).toBe(2); // 3 individuale, unul 500
    expect(fetchMock).toHaveBeenCalledTimes(4); // 1 batch + 3 individuale
    expect(String(fetchMock.mock.calls[1][0])).toMatch(/\/emails$/);
  });

  it("eroare de rețea pe batch → tot fallback individual", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).endsWith("/emails/batch")) throw new Error("ECONNRESET");
      return new Response("{}", { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    expect(await sendEmailBatch(msgs(2))).toBe(2);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("chei de mediu absente → 0, fără fetch", async () => {
    delete process.env.AUTH_RESEND_KEY;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    expect(await sendEmailBatch(msgs(2))).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
