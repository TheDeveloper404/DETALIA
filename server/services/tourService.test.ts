import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/repos/usersRepo", () => ({
  getSeenDetailTour: vi.fn(),
  markDetailTourSeen: vi.fn(),
}));

import { getSeenDetailTour, markDetailTourSeen as markDetailTourSeenRepo } from "@/server/repos/usersRepo";

import { hasSeenDetailTour, markDetailTourSeen } from "./tourService";

const USER_ID = "22222222-2222-4222-8222-222222222222";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("hasSeenDetailTour", () => {
  it("deleagă direct la repo, fără logică proprie", async () => {
    vi.mocked(getSeenDetailTour).mockResolvedValue(true);
    await expect(hasSeenDetailTour(USER_ID)).resolves.toBe(true);
    expect(getSeenDetailTour).toHaveBeenCalledWith(USER_ID);
  });

  it("user nou (never seen) → false", async () => {
    vi.mocked(getSeenDetailTour).mockResolvedValue(false);
    await expect(hasSeenDetailTour(USER_ID)).resolves.toBe(false);
  });
});

describe("markDetailTourSeen", () => {
  it("scrie flagul pentru userul dat", async () => {
    await markDetailTourSeen(USER_ID);
    expect(markDetailTourSeenRepo).toHaveBeenCalledWith(USER_ID);
  });
});
