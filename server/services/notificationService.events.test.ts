import { beforeEach, expect, it, vi } from "vitest";
vi.mock("@/server/repos/notificationsRepo", () => ({ upsertApprovalNotification: vi.fn() }));
vi.mock("@/server/repos/notificationEmailsRepo", () => ({ cleanupEmailDeliveries: vi.fn() }));
vi.mock("@/server/repos/detailsRepo", () => ({ getDetailById: vi.fn() }));
vi.mock("@/server/repos/sketchesRepo", () => ({ getSketchById: vi.fn() }));
vi.mock("@/server/services/projectService", () => ({ canAccessProjectDetail: vi.fn() }));
import { upsertApprovalNotification } from "@/server/repos/notificationsRepo";
import { getDetailById } from "@/server/repos/detailsRepo";
import { getSketchById } from "@/server/repos/sketchesRepo";
import { canAccessProjectDetail } from "@/server/services/projectService";
import { notifyApprovalReceived } from "./notificationService";
const input = { actorId: "actor", targetType: "DETAIL" as const, targetId: "detail" };
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getDetailById).mockResolvedValue({ id: "detail", ownerId: "owner", title: "Titlu", isAnonymized: false } as never);
  vi.mocked(canAccessProjectDetail).mockResolvedValue(true);
});
// "Aprobari grupate, doar in-app"; "actorul nu se notifica singur".
it("aprobare pe detaliu catre autorul real, fara autonotificare", async () => {
  await notifyApprovalReceived(input);
  expect(upsertApprovalNotification).toHaveBeenCalledWith(expect.objectContaining({ recipientUserId: "owner", actorId: "actor", detailId: "detail" }));
  vi.mocked(upsertApprovalNotification).mockClear(); await notifyApprovalReceived({ ...input, actorId: "owner" });
  expect(upsertApprovalNotification).not.toHaveBeenCalled();
});
// "Autorul care s-a retras de pe continut nu mai primeste notificari despre el."
it("autorul retras al detaliului sau schitei nu primeste aprobari", async () => {
  vi.mocked(getDetailById).mockResolvedValue({ id: "detail", ownerId: "owner", isAnonymized: true } as never);
  await notifyApprovalReceived(input); expect(upsertApprovalNotification).not.toHaveBeenCalled();
  vi.mocked(getSketchById).mockResolvedValue({ id: "sketch", detailId: "detail", authorId: "sketcher", status: "PUBLISHED", authorRemoved: true } as never);
  await notifyApprovalReceived({ ...input, targetType: "SKETCH", targetId: "sketch" });
  expect(upsertApprovalNotification).not.toHaveBeenCalled();
});
// "Accesul se verifica si pentru destinatar."
it("aprobarile schitei merg doar autorului cu acces actual", async () => {
  vi.mocked(getDetailById).mockResolvedValue({ id: "detail", projectId: "project", ownerId: "owner", title: "T" } as never);
  vi.mocked(getSketchById).mockResolvedValue({ id: "sketch", detailId: "detail", authorId: "sketcher", status: "PUBLISHED" } as never);
  vi.mocked(canAccessProjectDetail).mockResolvedValue(false);
  await notifyApprovalReceived({ ...input, targetType: "SKETCH", targetId: "sketch" });
  expect(canAccessProjectDetail).toHaveBeenCalledWith({ projectId: "project", userId: "sketcher" });
  expect(upsertApprovalNotification).not.toHaveBeenCalled();
});
