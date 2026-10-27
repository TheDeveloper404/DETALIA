import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildSupportPayload, escapeSlack, submitSupportRequest } from "./supportService";

const SESSION = "01938a2b-4c5d-7e6f-8a9b-0c1d2e3f4a5b";
const base = { userId: "11111111-2222-3333-4444-555555555555", message: "Nu pot publica detaliul.", flow: "detail_publish", page: "/details/new" };

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("SLACK_SUPPORT_WEBHOOK_URL", "https://hooks.example.test/support");
  vi.stubEnv("POSTHOG_ENV_ID", "224228");
  fetchMock.mockReset();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("escapeSlack", () => {
  // Regula (plan aprobat): textul userului nu poate produce linkuri sau pinguri în canal.
  it("neutralizează mențiunile și linkurile mrkdwn", () => {
    expect(escapeSlack("<!channel> vezi <https://rau.example|aici> & gata")).toBe(
      "&lt;!channel&gt; vezi &lt;https://rau.example|aici&gt; &amp; gata",
    );
  });
});

describe("buildSupportPayload", () => {
  it("construiește linkul de replay pe server doar dintr-un session id UUID", () => {
    const ok = JSON.stringify(buildSupportPayload({ ...base, flow: "detail_publish", sessionId: SESSION }));
    expect(ok).toContain(`https://eu.posthog.com/project/224228/replay/${SESSION}`);

    const injected = JSON.stringify(
      buildSupportPayload({ ...base, flow: "detail_publish", sessionId: "https://rau.example/x" }),
    );
    expect(injected).not.toContain("replay");
    expect(injected).not.toContain("rau.example");
  });

  it("escapează mesajul, pagina și eroarea", () => {
    const payload = JSON.stringify(
      buildSupportPayload({ ...base, flow: "detail_publish", message: "<!here> ajutor", errorMessage: "<@U1>" }),
    );
    expect(payload).not.toContain("<!here>");
    expect(payload).not.toContain("<@U1>");
    expect(payload).toContain("&lt;!here&gt;");
  });
});

describe("submitSupportRequest", () => {
  it("trimite la webhook și întoarce ok", async () => {
    fetchMock.mockResolvedValueOnce(new Response("ok", { status: 200 }));
    expect(await submitSupportRequest(base)).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith("https://hooks.example.test/support", expect.objectContaining({ method: "POST" }));
  });

  it.each([
    ["mesaj prea scurt", { message: "scurt" }],
    ["mesaj prea lung", { message: "x".repeat(1001) }],
    ["flux necunoscut", { flow: "orice" }],
    ["pagină fără slash", { page: "https://rau.example" }],
    ["încercări negative", { failures: -1 }],
  ])("respinge input invalid: %s", async (_label, patch) => {
    expect(await submitSupportRequest({ ...base, ...patch })).toEqual({ ok: false, error: "VALIDATION" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("plafonează încercările la 20 în loc să respingă cererea", async () => {
    fetchMock.mockResolvedValueOnce(new Response("ok", { status: 200 }));
    expect(await submitSupportRequest({ ...base, failures: 35 })).toEqual({ ok: true });
    expect(String(fetchMock.mock.calls[0][1].body)).toContain("20 la rând");
  });

  it("taie eroarea lungă la 200 de caractere în loc să respingă cererea", async () => {
    fetchMock.mockResolvedValueOnce(new Response("ok", { status: 200 }));
    expect(await submitSupportRequest({ ...base, errorMessage: "e".repeat(300) })).toEqual({ ok: true });
    const body = String(fetchMock.mock.calls[0][1].body);
    expect(body).toContain("e".repeat(200));
    expect(body).not.toContain("e".repeat(201));
  });

  it("NOT_CONFIGURED fără webhook, fără niciun request", async () => {
    vi.stubEnv("SLACK_SUPPORT_WEBHOOK_URL", "");
    expect(await submitSupportRequest(base)).toEqual({ ok: false, error: "NOT_CONFIGURED" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("SEND_FAILED când Slack respinge sau rețeaua cade", async () => {
    fetchMock.mockResolvedValueOnce(new Response("no", { status: 500 }));
    expect(await submitSupportRequest(base)).toEqual({ ok: false, error: "SEND_FAILED" });
    fetchMock.mockRejectedValueOnce(new Error("network"));
    expect(await submitSupportRequest(base)).toEqual({ ok: false, error: "SEND_FAILED" });
  });

  it("nu loghează mesajul userului la eșec", async () => {
    fetchMock.mockRejectedValueOnce(new Error("network"));
    await submitSupportRequest({ ...base, message: "date private ale userului" });
    const logged = JSON.stringify(vi.mocked(console.error).mock.calls);
    expect(logged).not.toContain("date private");
  });
});
