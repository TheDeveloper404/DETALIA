import { beforeEach, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/require-active-user", () => ({ requireActiveUserId: vi.fn() }));
vi.mock("@/lib/notification-view", () => ({ mapNotificationRows: vi.fn(() => []) }));
vi.mock("@/server/services/notificationService", () => ({ getNotifications: vi.fn(async () => []), markNotificationRead: vi.fn(), markNotificationsRead: vi.fn() }));

import { requireActiveUserId } from "@/lib/require-active-user";
import { getNotifications } from "@/server/services/notificationService";
import { getNotificationsAction } from "./actions";

beforeEach(() => vi.clearAllMocks());

// Regula (CONTEXT.md): "Un cont suspendat nu poate citi notificari sau lista planselor prin Server Actions."
it("DET-05: actiunea refuza citirea cand poarta ACTIVE refuza sesiunea stale", async () => {
  vi.mocked(requireActiveUserId).mockRejectedValueOnce(new Error("suspended"));
  await expect(getNotificationsAction()).rejects.toThrow("suspended");
  expect(getNotifications).not.toHaveBeenCalled();
});

// Regula: "userId din sesiune, fără IDOR." (actions.ts).
it("citeste numai notificarile identitatii validate", async () => {
  vi.mocked(requireActiveUserId).mockResolvedValueOnce("active-user");
  expect(await getNotificationsAction()).toEqual({ notifications: [], count: 0 });
  expect(getNotifications).toHaveBeenCalledWith("active-user");
});
