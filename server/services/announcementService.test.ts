import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/repos/usersRepo", () => ({
  getLastSeenAnnouncement: vi.fn(),
  updateLastSeenAnnouncement: vi.fn(),
}));
vi.mock("@/server/domain/announcements", () => ({
  CURRENT_ANNOUNCEMENT_VERSION: "v2",
  ANNOUNCEMENT_ITEMS: [{ title: "X", body: "Y" }],
}));

import { getLastSeenAnnouncement, updateLastSeenAnnouncement } from "@/server/repos/usersRepo";

import { getUnseenAnnouncement, markAnnouncementSeen } from "./announcementService";

const USER_ID = "22222222-2222-4222-8222-222222222222";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getUnseenAnnouncement", () => {
  it("user nou (never seen, null) → întoarce conținutul curent", async () => {
    vi.mocked(getLastSeenAnnouncement).mockResolvedValue(null);
    const items = await getUnseenAnnouncement(USER_ID);
    expect(items).toEqual([{ title: "X", body: "Y" }]);
  });

  it("user a văzut o versiune veche → întoarce conținutul curent", async () => {
    vi.mocked(getLastSeenAnnouncement).mockResolvedValue("v1");
    const items = await getUnseenAnnouncement(USER_ID);
    expect(items).toEqual([{ title: "X", body: "Y" }]);
  });

  it("user a văzut deja versiunea curentă → null (nimic de arătat)", async () => {
    vi.mocked(getLastSeenAnnouncement).mockResolvedValue("v2");
    const items = await getUnseenAnnouncement(USER_ID);
    expect(items).toBeNull();
  });
});

describe("markAnnouncementSeen", () => {
  it("scrie versiunea curentă pentru userul dat", async () => {
    await markAnnouncementSeen(USER_ID);
    expect(updateLastSeenAnnouncement).toHaveBeenCalledWith(USER_ID, "v2");
  });
});
