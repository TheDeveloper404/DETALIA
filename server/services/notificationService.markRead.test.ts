import { beforeEach, describe, expect, it, vi } from "vitest";

// SEC-006 (audit securitate 2026-08-10): markNotificationRead era singura cale din fișier fără gardă
// isUuid (SEC-11) — un id malformat cădea direct în cast Postgres, 500 nedeclanșat intenționat.
const { markOneRead } = vi.hoisted(() => ({ markOneRead: vi.fn() }));

vi.mock("@/server/repos/notificationsRepo", () => ({
  markOneRead,
  markAllRead: vi.fn(),
  listByRecipient: vi.fn(),
  insertNotification: vi.fn(),
  deleteReadNotificationsOlderThan: vi.fn(),
}));
vi.mock("@/server/repos/usersRepo", () => ({ getUserContact: vi.fn() }));
vi.mock("@/lib/email", () => ({
  plainSubject: vi.fn(),
  sendEmail: vi.fn(),
  sketchDeletedEmailHtml: vi.fn(),
  sketchDeletedEmailText: vi.fn(),
  sketchProposedEmailHtml: vi.fn(),
  sketchProposedEmailText: vi.fn(),
}));

import { markNotificationRead } from "./notificationService";

const USER_ID = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("markNotificationRead — gardă isUuid (SEC-006)", () => {
  it("id malformat → nu ajunge la query, fără eroare", async () => {
    await markNotificationRead(USER_ID, "not-a-uuid");
    expect(markOneRead).not.toHaveBeenCalled();
  });

  it("id valid → delegă la repo", async () => {
    const id = "22222222-2222-4222-8222-222222222222";
    await markNotificationRead(USER_ID, id);
    expect(markOneRead).toHaveBeenCalledWith(USER_ID, id);
  });
});
