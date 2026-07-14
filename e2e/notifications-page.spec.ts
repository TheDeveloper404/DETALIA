import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";

import { db } from "../db";
import { notifications } from "../db/schema";
import { getSeed } from "./seed";

// E2E — pagina /notifications (UI): randarea unei notificări reale + marcarea automată ca citită
// la vizualizare (`MarkReadOnView`). Distinct de notifications.spec.ts, care testează service+DB direct.
//
// `describe.serial` OBLIGATORIU: ambele teste operează pe notificările ACELUIAȘI user seedat
// (testerUserId, fix între rulări) — fără serializare, sub workers paraleli, testul „empty state"
// poate rula exact când celălalt tocmai a inserat notificarea lui, văzând o listă nu chiar goală
// (bug găsit 2026-07-14: coliziune reală de date, nu flakiness aleatoriu).
test.describe.serial("Pagina /notifications", () => {
  test("notificare SKETCH_PROPOSED apare pe pagină și se marchează automat citită", async ({ page }) => {
    const { testerUserId, detailId, detailTitle } = getSeed();

    const [row] = await db
      .insert(notifications)
      .values({
        recipientUserId: testerUserId,
        type: "SKETCH_PROPOSED",
        payloadJson: { detailId, detailTitle, sketchAuthorName: "E2E Author" },
      })
      .returning({ id: notifications.id });

    try {
      await page.goto("/notifications");
      await expect(page.getByRole("heading", { name: "Notificări" })).toBeVisible();
      await expect(page.getByText(`E2E Author a schițat peste „${detailTitle}”.`)).toBeVisible();

      await expect
        .poll(async () => {
          const [r] = await db
            .select({ readAt: notifications.readAt })
            .from(notifications)
            .where(eq(notifications.id, row.id));
          return r?.readAt ?? null;
        })
        .not.toBeNull();
    } finally {
      await db.delete(notifications).where(eq(notifications.id, row.id));
    }
  });

  test("fără notificări → mesaj empty state", async ({ page }) => {
    const { testerUserId } = getSeed();
    await db.delete(notifications).where(eq(notifications.recipientUserId, testerUserId));

    await page.goto("/notifications");
    await expect(page.getByText("Nu ai nicio notificare încă.")).toBeVisible();
  });
});
