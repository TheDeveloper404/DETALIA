import { describe, expect, it } from "vitest";

import { mapNotificationRows, type NotificationRow } from "./notification-view";

function row(overrides: Partial<NotificationRow> = {}): NotificationRow {
  return {
    id: "n1",
    type: "SKETCH_PROPOSED",
    payloadJson: {},
    createdAt: new Date("2026-08-26T10:00:00Z"),
    readAt: null,
    ...overrides,
  };
}

describe("mapNotificationRows", () => {
  it("readAt null → unread true; readAt setat → unread false", () => {
    const [unread] = mapNotificationRows([row({ readAt: null })]);
    const [read] = mapNotificationRows([row({ id: "n2", readAt: new Date("2026-08-26T10:05:00Z") })]);
    expect(unread.unread).toBe(true);
    expect(read.unread).toBe(false);
  });

  it("extrage numele actorului din primul câmp de payload disponibil (sketch → supplier → referral)", () => {
    const [bySketch] = mapNotificationRows([row({ payloadJson: { sketchAuthorName: "Ana" } })]);
    const [bySupplier] = mapNotificationRows([row({ payloadJson: { supplierName: "Ion" } })]);
    const [byReferral] = mapNotificationRows([row({ payloadJson: { joinedUserName: "Maria" } })]);
    expect(bySketch.actorName).toBe("Ana");
    expect(bySupplier.actorName).toBe("Ion");
    expect(byReferral.actorName).toBe("Maria");
  });

  it("fără detailId în payload → href null (nu construiește un link invalid)", () => {
    const [n] = mapNotificationRows([row({ payloadJson: {} })]);
    expect(n.href).toBeNull();
  });

  it("cu detailId + sketchId → href include query param ?sketch=", () => {
    const [n] = mapNotificationRows([row({ payloadJson: { detailId: "d1", sketchId: "s1" } })]);
    expect(n.href).toBe("/details/d1?sketch=s1");
  });

  it("detailTitle absent din payload → titlu placeholder, nu undefined", () => {
    const [n] = mapNotificationRows([row({ payloadJson: {} })]);
    expect(n.detailTitle).toBe("un detaliu");
  });
});
