import { beforeEach, describe, expect, it, vi } from "vitest";

// SEC-011 (audit securitate 2026-08-11): notificarea deja livrată păstra titlul detaliului în payload
// — un membru eliminat dintr-un proiect continua să vadă titlul unui detaliu privat în clopoțel. Scop
// îngust: doar scrub-ul la citire (getNotifications), nu restul serviciului (notify*/mark*).

vi.mock("@/server/repos/notificationsRepo", () => ({ listByRecipient: vi.fn() }));
vi.mock("@/server/repos/detailsRepo", () => ({ listProjectIdForDetails: vi.fn() }));
vi.mock("@/server/services/projectService", () => ({ getProjectAccess: vi.fn() }));
vi.mock("@/server/repos/usersRepo", () => ({ getUserContact: vi.fn() }));
vi.mock("@/lib/email", () => ({
  plainSubject: vi.fn(),
  sendEmail: vi.fn(),
  sketchDeletedEmailHtml: vi.fn(),
  sketchDeletedEmailText: vi.fn(),
  sketchProposedEmailHtml: vi.fn(),
  sketchProposedEmailText: vi.fn(),
}));

import { listProjectIdForDetails } from "@/server/repos/detailsRepo";
import { listByRecipient } from "@/server/repos/notificationsRepo";
import { getProjectAccess } from "@/server/services/projectService";

import { getNotifications } from "./notificationService";

const USER_ID = "u-1";
const DETAIL_ID = "d-1";
const PROJECT_ID = "p-1";

function notifRow(overrides: Partial<{ id: string; payloadJson: Record<string, unknown> }> = {}) {
  return { id: "n-1", payloadJson: { detailId: DETAIL_ID, detailTitle: "Titlu real" }, ...overrides };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getNotifications — scrub titlu la pierderea accesului (SEC-011)", () => {
  it("notificare fără detailId în payload → neatinsă", async () => {
    const row = { id: "n-2", payloadJson: { supplierName: "X" } };
    vi.mocked(listByRecipient).mockResolvedValueOnce([row] as never);
    const res = await getNotifications(USER_ID);
    expect(res).toEqual([row]);
    expect(listProjectIdForDetails).not.toHaveBeenCalled();
  });

  it("detaliu fără proiect (public) → titlul rămâne neatins", async () => {
    vi.mocked(listByRecipient).mockResolvedValueOnce([notifRow()] as never);
    vi.mocked(listProjectIdForDetails).mockResolvedValueOnce(new Map([[DETAIL_ID, null]]));
    const res = await getNotifications(USER_ID);
    expect(res[0]!.payloadJson).toEqual({ detailId: DETAIL_ID, detailTitle: "Titlu real" });
    expect(getProjectAccess).not.toHaveBeenCalled();
  });

  it("detaliu de proiect, recipient ÎNCĂ are acces → titlul rămâne neatins", async () => {
    vi.mocked(listByRecipient).mockResolvedValueOnce([notifRow()] as never);
    vi.mocked(listProjectIdForDetails).mockResolvedValueOnce(new Map([[DETAIL_ID, PROJECT_ID]]));
    vi.mocked(getProjectAccess).mockResolvedValueOnce({ hasAccess: true, isOwner: false, isActiveMember: true });
    const res = await getNotifications(USER_ID);
    expect(res[0]!.payloadJson).toEqual({ detailId: DETAIL_ID, detailTitle: "Titlu real" });
  });

  it("detaliu de proiect, recipient a PIERDUT accesul → titlul e scrubuit", async () => {
    vi.mocked(listByRecipient).mockResolvedValueOnce([notifRow()] as never);
    vi.mocked(listProjectIdForDetails).mockResolvedValueOnce(new Map([[DETAIL_ID, PROJECT_ID]]));
    vi.mocked(getProjectAccess).mockResolvedValueOnce({ hasAccess: false, isOwner: false, isActiveMember: false });
    const res = await getNotifications(USER_ID);
    expect(res[0]!.payloadJson).toEqual({
      detailId: DETAIL_ID,
      detailTitle: "un detaliu la care nu mai ai acces",
    });
  });
});
