import { beforeEach, describe, expect, it, vi } from "vitest";

// Logica de asamblare a digestului: cine primește (are activitate „la tine") vs. cine e omis, și că
// trimiterea în lot se apelează o singură dată cu exact mesajele construite. Repo-ul + emailul sunt
// mock-uite — garanția „detaliile de proiect nu apar în secțiunea globală" e testată pe SQL real în
// server/repos/digestRepo.test.ts.
const repo = vi.hoisted(() => ({
  listDigestRecipients: vi.fn(),
  countCommentsOnOwnDetails: vi.fn(),
  countSketchesOnOwnDetails: vi.fn(),
  countValidationsOnOwnDetails: vi.fn(),
  listNewCommunityDetails: vi.fn(),
}));
const email = vi.hoisted(() => ({
  sendEmailBatch: vi.fn(),
  weeklyDigestEmailHtml: vi.fn(() => "<html>"),
  weeklyDigestEmailText: vi.fn(() => "text"),
  plainSubject: vi.fn((s: string) => s),
}));

vi.mock("@/server/repos/digestRepo", () => repo);
vi.mock("@/lib/email", () => email);
vi.mock("@/lib/signed-token", () => ({ createSignedToken: vi.fn(() => "tok") }));

import { buildWeeklyDigests, sendWeeklyDigests } from "./digestService";

const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

beforeEach(() => {
  vi.clearAllMocks();
  repo.listDigestRecipients.mockResolvedValue([
    { id: A, email: "a@test.local", name: "Ana" },
    { id: B, email: "b@test.local", name: "Bogdan" },
  ]);
  repo.countCommentsOnOwnDetails.mockResolvedValue(new Map([[A, 3]]));
  repo.countSketchesOnOwnDetails.mockResolvedValue(new Map());
  repo.countValidationsOnOwnDetails.mockResolvedValue(new Map([[A, 1]]));
  repo.listNewCommunityDetails.mockResolvedValue([
    { id: "d1", title: "Terasă", authorName: "X" },
  ]);
  email.sendEmailBatch.mockResolvedValue(1);
});

describe("buildWeeklyDigests", () => {
  it("include doar userul cu activitate pe detaliile lui; omite userul fără activitate", async () => {
    const digests = await buildWeeklyDigests(new Date("2026-09-07T09:00:00Z"));
    expect(digests.map((d) => d.userId)).toEqual([A]);
    expect(digests[0].data.mine).toEqual({ comments: 3, sketches: 0, validations: 1 });
  });

  it("secțiunea globală conține detaliile publice noi, cu URL absolut", async () => {
    const [d] = await buildWeeklyDigests();
    expect(d.data.community).toHaveLength(1);
    expect(d.data.community[0].url).toContain("/details/d1");
  });

  it("fereastra e de 7 zile înainte de `now`", async () => {
    const now = new Date("2026-09-07T09:00:00Z");
    await buildWeeklyDigests(now);
    const since = repo.countCommentsOnOwnDetails.mock.calls[0][0] as Date;
    expect(now.getTime() - since.getTime()).toBe(7 * 86_400_000);
  });
});

describe("sendWeeklyDigests", () => {
  it("trimite un lot cu exact digesturile construite", async () => {
    const res = await sendWeeklyDigests(new Date("2026-09-07T09:00:00Z"));
    expect(email.sendEmailBatch).toHaveBeenCalledTimes(1);
    expect(email.sendEmailBatch.mock.calls[0][0]).toHaveLength(1);
    expect(email.sendEmailBatch.mock.calls[0][0][0].to).toBe("a@test.local");
    expect(res).toEqual({ built: 1, sent: 1 });
  });

  it("nimeni de notificat → nu apelează trimiterea", async () => {
    repo.countCommentsOnOwnDetails.mockResolvedValue(new Map());
    repo.countValidationsOnOwnDetails.mockResolvedValue(new Map());
    const res = await sendWeeklyDigests();
    expect(email.sendEmailBatch).not.toHaveBeenCalled();
    expect(res).toEqual({ built: 0, sent: 0 });
  });
});
