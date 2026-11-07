import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  activeUser: vi.fn(), limit: vi.fn(), deleteDraft: vi.fn(), deleteDetailDraft: vi.fn(), revalidate: vi.fn(),
}));
vi.mock("@/lib/require-active-user", () => ({ requireActiveUserId: mocks.activeUser }));
vi.mock("@/lib/rate-limit", () => ({ checkLimit: mocks.limit, limiters: { mutation: {} } }));
vi.mock("@/server/services/sketchService", () => ({ deleteDraft: mocks.deleteDraft }));
vi.mock("@/server/services/detailService", () => ({ deleteDetailDraft: mocks.deleteDetailDraft }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));

import { deleteDetailDraftAction, deleteDraftAction } from "./actions";

const USER = "11111111-1111-4111-8111-111111111111";
const form = (key: string) => {
  const data = new FormData();
  data.set(key, "33333333-3333-4333-8333-333333333333");
  return data;
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.activeUser.mockResolvedValue(USER);
  mocks.limit.mockResolvedValue({ ok: true });
});

// Incident 2026-11-06: peste limita de 40/min stergerea era ignorata fara mesaj, iar userul apasa repetat.
describe.each([
  ["schita", deleteDraftAction, "sketchId", mocks.deleteDraft],
  ["detaliu", deleteDetailDraftAction, "detailId", mocks.deleteDetailDraft],
] as const)("stergere ciorna de %s", (_name, action, key, service) => {
  it("peste limita intoarce un mesaj si nu sterge nimic", async () => {
    mocks.limit.mockResolvedValue({ ok: false });
    const res = await action(form(key));
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/Așteaptă/);
    expect(service).not.toHaveBeenCalled();
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });

  it("sub limita sterge si intoarce ok", async () => {
    const res = await action(form(key));
    expect(res).toEqual({ ok: true });
    expect(service).toHaveBeenCalledOnce();
  });
});
