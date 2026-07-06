import { expect, test } from "@playwright/test";
import { and, eq } from "drizzle-orm";

import { db } from "../db";
import { notifications, sketches } from "../db/schema";
import { markNotificationRead } from "../server/services/notificationService";
import { createDraft, deleteSketch, publish } from "../server/services/sketchService";
import { getSeed } from "./seed";

// Notificări — netestat până acum la nivel de INTEGRARE (sketchService.test.ts mockuiește
// notifySketchProposed/Deleted, deci nu verifică rândul REAL scris în `notifications` sau
// scoping-ul anti-IDOR al markNotificationRead). Apeluri directe service+DB (fără browser), ca
// integration.spec.ts/security.spec.ts.

test("publish schiță → notificare reală SKETCH_PROPOSED către autorul detaliului-mamă", async () => {
  const { detailId, testerUserId, authorUserId } = getSeed();

  const draft = await createDraft({ detailId, authorId: testerUserId });
  expect(draft.ok).toBe(true);
  if (!draft.ok) return;
  const sketchId = draft.value.sketchId;

  try {
    const res = await publish({
      sketchId,
      authorId: testerUserId,
      strokes: [{ points: [[0, 0], [0.1, 0.1]], color: "#000000", size: 2 }],
    });
    expect(res.ok).toBe(true);

    const rows = await db
      .select()
      .from(notifications)
      .where(and(eq(notifications.recipientUserId, authorUserId), eq(notifications.type, "SKETCH_PROPOSED")));

    const match = rows.find((r) => (r.payloadJson as { sketchId?: string })?.sketchId === sketchId);
    expect(match).toBeTruthy();
    expect(match?.readAt).toBeNull();

    if (match) await db.delete(notifications).where(eq(notifications.id, match.id));
  } finally {
    await db.delete(sketches).where(eq(sketches.id, sketchId));
  }
});

test("autorul detaliului șterge schița altcuiva → notificare reală SKETCH_DELETED către autorul schiței", async () => {
  const { detailId, testerUserId, authorUserId } = getSeed();

  // Schiță publicată de tester, peste detaliul autorat de author — author o șterge (moderare).
  const [sketch] = await db
    .insert(sketches)
    .values({ detailId, authorId: testerUserId, status: "PUBLISHED", strokesJson: [] })
    .returning({ id: sketches.id });

  const del = await deleteSketch({ sketchId: sketch.id, actorUserId: authorUserId });
  expect(del.ok).toBe(true);

  const rows = await db
    .select()
    .from(notifications)
    .where(and(eq(notifications.recipientUserId, testerUserId), eq(notifications.type, "SKETCH_DELETED")));

  const match = rows.find((r) => (r.payloadJson as { detailId?: string })?.detailId === detailId);
  expect(match).toBeTruthy();

  if (match) await db.delete(notifications).where(eq(notifications.id, match.id));
});

test("markNotificationRead: un user NU poate marca citită notificarea altui user (scoped pe recipient)", async () => {
  const { testerUserId, authorUserId } = getSeed();

  const [victimNotification] = await db
    .insert(notifications)
    .values({ recipientUserId: authorUserId, type: "SKETCH_PROPOSED", payloadJson: {} })
    .returning({ id: notifications.id });

  try {
    // "attacker" (testerUserId) încearcă să marcheze citită notificarea lui authorUserId.
    await markNotificationRead(testerUserId, victimNotification.id);

    const [row] = await db
      .select({ readAt: notifications.readAt })
      .from(notifications)
      .where(eq(notifications.id, victimNotification.id));
    expect(row?.readAt).toBeNull(); // neatinsă

    // Owner-ul real tot o poate marca citită — nu e o gaură generală, doar authz pe non-owner.
    await markNotificationRead(authorUserId, victimNotification.id);
    const [ownerRow] = await db
      .select({ readAt: notifications.readAt })
      .from(notifications)
      .where(eq(notifications.id, victimNotification.id));
    expect(ownerRow?.readAt).not.toBeNull();
  } finally {
    await db.delete(notifications).where(eq(notifications.id, victimNotification.id));
  }
});
