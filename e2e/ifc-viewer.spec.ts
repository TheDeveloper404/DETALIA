import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";

import { db } from "../db";
import { detailResources, details } from "../db/schema";
import { deleteBlobs } from "../lib/storage";
import { pickLeafCategories } from "./category-helpers";
import { stripBypassHeadersForBlobUploads } from "./strip-bypass-headers";

// E2E — viewer 3D pentru resursele CAD `.ifc` (2026-10-24). Acoperă ce testele unitare (`isIfcUrl`,
// CSP) NU pot: WASM-ul web-ifc și worker-ul fragments chiar se încarcă din /ifc/ sub CSP-ul real al
// preview-ului, modelul se parsează și ajunge în scenă (`data-status="ready"`, nu „error").

const TINY_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

// IFC4 minim cu geometrie reală: un IfcBuildingElementProxy (paralelipiped 2×1×3 m) într-un IfcSite.
// Verificat cu web-ifc în Node: schema IFC4, 1 mesh.
const TINY_IFC = [
  "ISO-10303-21;",
  "HEADER;",
  "FILE_DESCRIPTION(('ViewDefinition [ReferenceView]'),'2;1');",
  "FILE_NAME('e2e.ifc','2026-10-24T00:00:00',(''),(''),'','','');",
  "FILE_SCHEMA(('IFC4'));",
  "ENDSEC;",
  "DATA;",
  "#10=IFCCARTESIANPOINT((0.,0.,0.));",
  "#11=IFCDIRECTION((0.,0.,1.));",
  "#12=IFCDIRECTION((1.,0.,0.));",
  "#13=IFCAXIS2PLACEMENT3D(#10,#11,#12);",
  "#14=IFCGEOMETRICREPRESENTATIONCONTEXT($,'Model',3,1.E-05,#13,$);",
  "#15=IFCSIUNIT(*,.LENGTHUNIT.,$,.METRE.);",
  "#16=IFCUNITASSIGNMENT((#15));",
  "#20=IFCPROJECT('0YvctVUKr0kugbFTf53O9L',$,'E2E',$,$,$,$,(#14),#16);",
  "#21=IFCLOCALPLACEMENT($,#13);",
  "#22=IFCSITE('1YvctVUKr0kugbFTf53O9L',$,'Site',$,$,#21,$,$,.ELEMENT.,$,$,$,$,$);",
  "#23=IFCRELAGGREGATES('2YvctVUKr0kugbFTf53O9L',$,$,$,#20,(#22));",
  "#30=IFCCARTESIANPOINT((0.,0.));",
  "#31=IFCAXIS2PLACEMENT2D(#30,$);",
  "#32=IFCRECTANGLEPROFILEDEF(.AREA.,$,#31,2.,1.);",
  "#33=IFCEXTRUDEDAREASOLID(#32,#13,#11,3.);",
  "#34=IFCSHAPEREPRESENTATION(#14,'Body','SweptSolid',(#33));",
  "#35=IFCPRODUCTDEFINITIONSHAPE($,$,(#34));",
  "#36=IFCLOCALPLACEMENT(#21,#13);",
  "#37=IFCBUILDINGELEMENTPROXY('3YvctVUKr0kugbFTf53O9L',$,'Bloc',$,$,#36,#35,$,$);",
  "#38=IFCRELCONTAINEDINSPATIALSTRUCTURE('4YvctVUKr0kugbFTf53O9L',$,$,$,(#37),#22);",
  "ENDSEC;",
  "END-ISO-10303-21;",
].join("\n");

function makeFile(name: string, content: Buffer | string): string {
  const dir = mkdtempSync(path.join(tmpdir(), "detalia-ifc-"));
  const file = path.join(dir, name);
  writeFileSync(file, content);
  return file;
}

test("Resursă CAD .ifc: butonul „3D” deschide viewer-ul, modelul se încarcă, Escape închide", async ({
  page,
}) => {
  const [category] = await pickLeafCategories(1);
  const title = `E2E IFC 3D ${Date.now()}`;
  let detailId: string | null = null;
  const blobUrls: string[] = [];

  try {
    await stripBypassHeadersForBlobUploads(page);
    await page.goto("/details/new");
    await page.locator("#title").fill(title);
    await page.getByRole("button", { name: "Alege categoriile…" }).click();
    await page.getByRole("button", { name: category.name, exact: true }).click();
    await page.keyboard.press("Escape");

    await page.locator("#image").setInputFiles(makeFile("detaliu.png", Buffer.from(TINY_PNG_BASE64, "base64")));
    await expect(page.getByRole("button", { name: "Înlocuiește" })).toBeVisible({ timeout: 15_000 });

    await page.getByRole("button", { name: "Adaugă resursă" }).click();
    const resourcesList = page.getByTestId("resources-list");
    await resourcesList.getByLabel("Tip resursă 1").selectOption("CAD");
    await resourcesList.locator('input[type="file"]').setInputFiles(makeFile("model.ifc", TINY_IFC));
    await expect(resourcesList.getByText("Încărcat")).toBeVisible({ timeout: 15_000 });

    // Al doilea plan CAD: link .ifc EXTERN, lipit de mână — rămâne doar download, fără „3D" (viewer-ul
    // descarcă și parsează în browser doar fișiere din store-ul nostru).
    await page.getByRole("button", { name: "Adaugă resursă" }).click();
    await resourcesList.getByLabel("Tip resursă 2").selectOption("CAD");
    await resourcesList.locator('input[type="text"]').fill("https://example.com/extern.ifc");

    await page.getByRole("button", { name: "Publică detaliul" }).click();
    await expect(page).toHaveURL(/\/details\/[0-9a-f-]+$/, { timeout: 15_000 });
    detailId = page.url().split("/details/")[1] ?? null;
    expect(detailId).toBeTruthy();

    if (detailId) {
      const [row] = await db.select({ imageUrl: details.imageUrl }).from(details).where(eq(details.id, detailId));
      if (row?.imageUrl) blobUrls.push(row.imageUrl);
      const resources = await db
        .select({ url: detailResources.url })
        .from(detailResources)
        .where(eq(detailResources.detailId, detailId));
      for (const r of resources) if (r.url) blobUrls.push(r.url);
    }

    // Doar fișierul urcat la noi are „3D"; link-ul extern nu.
    const trigger = page.getByRole("button", { name: `Vezi modelul 3D: ${title}` });
    await expect(trigger).toHaveCount(1);
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: `Model 3D: ${title}` });
    await expect(dialog).toBeVisible();
    // Focusul de tastatură intră în dialog și Tab nu iese din el.
    const close = dialog.getByRole("button", { name: "Închide" });
    await expect(close).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(close).toBeFocused();

    // „ready" = WASM + worker încărcate sub CSP, IFC parsat, camera încadrată pe model.
    const viewer = dialog.getByTestId("ifc-viewer");
    await expect(viewer).toHaveAttribute("data-status", "ready", { timeout: 30_000 });
    await expect(viewer.locator("canvas")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
  } finally {
    if (detailId) await db.delete(details).where(eq(details.id, detailId));
    if (blobUrls.length > 0) await deleteBlobs(blobUrls);
  }
});
