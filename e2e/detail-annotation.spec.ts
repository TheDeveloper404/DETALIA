import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { expect, test, type Page } from "@playwright/test";
import { and, eq } from "drizzle-orm";

import { db } from "../db";
import { details, sketches } from "../db/schema";
import { deleteBlobs } from "../lib/storage";
import { pickLeafCategories } from "./category-helpers";
import { stripBypassHeadersForBlobUploads } from "./strip-bypass-headers";

// E2E — ADNOTAREA autorului peste PROPRIA imagine (2026-07-31, vezi CHANGELOG).
// Acoperă exact ce `tsc`/`vitest` NU pot prinde: desenul real peste previzualizare, salvarea prin
// câmpul ascuns la submit, randarea pe pagina detaliului și toggle-ul de afișare.
//
// De ce upload REAL de imagine (nu mock): adnotarea se desenează peste previzualizarea locală (blob:),
// iar SketchCanvas își ia raportul din imaginea încărcată — cu o imagine falsă, canvasul n-ar căpăta
// dimensiuni și desenul n-ar produce niciun stroke.

// PNG 8x8 roșu, valid — mai mare decât 1x1 ca previzualizarea să aibă o suprafață reală de desenat.
// Generat cu sharp și trecut prin EXACT pipeline-ul serverului (`cleanImageBuffer`) înainte de a fi
// pus aici. `sharp().metadata()` citește doar antetul, deci un PNG cu IDAT corupt „pare" valid și
// crapă abia la re-encodarea de pe server, cu un `INVALID_TYPE` opac în UI — verifică re-encodarea,
// nu metadata, dacă schimbi imaginea asta.
const SMALL_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEUlEQVQI12O4Y6OBFTEMLQkAb5lQAcZEZ3sAAAAASUVORK5CYII=";

function makeImage(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "detalia-annot-"));
  const file = path.join(dir, "detaliu.png");
  writeFileSync(file, Buffer.from(SMALL_PNG_BASE64, "base64"));
  return file;
}

// Un traseu simplu în interiorul canvasului (tool-ul „pen" e selectat implicit).
// `expectCounter`: contorul „N trasee" există DOAR în editorul de adnotare din formular; pagina de
// editare a schiței (`/sketches/:id/edit`) n-are așa ceva → acolo se cere explicit `false`.
async function drawStroke(page: Page, { expectCounter = true } = {}): Promise<void> {
  const canvas = page.locator("canvas").first();
  await expect(canvas).toBeVisible();
  // Canvasul de adnotare stă JOS în formular: `boundingBox()` întoarce coordonate față de viewport,
  // iar fără scroll centrul lui cade SUB cele 720px de înălțime → `page.mouse` ar „desena" în afara
  // ecranului, cu zero stroke-uri și fără nicio eroare. (Nu e cazul în sketch.spec.ts, unde canvasul
  // e prima secțiune a paginii.) Scroll ÎNTÂI, citește caseta DUPĂ.
  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();
  if (!box) throw new Error("canvas de adnotare fără bounding box");
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x - 30, y - 30);
  await page.mouse.down();
  await page.mouse.move(x, y, { steps: 5 });
  await page.mouse.move(x + 30, y + 30, { steps: 5 });
  await page.mouse.up();
  // Contorul din bara editorului = singura confirmare că traseul a fost ÎNREGISTRAT, nu doar că
  // mouse-ul s-a mișcat. Fără ea, un desen ratat iese la iveală abia 30 de linii mai jos, ca un mesaj
  // derutant despre eticheta butonului „Adnotează".
  if (expectCounter) await expect(page.getByText(/\d+ trase[eu]/)).toBeVisible();
}

// Curățare per test (NU stare la nivel de modul): `fullyParallel: true` în playwright.config.ts →
// testele din același fișier pot rula în workeri diferiți. try/finally, ca în detail-upload.spec.ts.
async function cleanup(detailId: string | null, imageUrl: string | null): Promise<void> {
  if (detailId) {
    await db.delete(sketches).where(eq(sketches.detailId, detailId));
    await db.delete(details).where(eq(details.id, detailId));
  }
  if (imageUrl) await deleteBlobs([imageUrl]);
}

test.describe("Adnotarea autorului la publicarea detaliului", () => {
  test("Încarcă imagine → Adnotează → desenează → Gata → publică: adnotarea se salvează și se vede", async ({
    page,
  }) => {
    const [category] = await pickLeafCategories(1);
    const title = `E2E adnotare ${Date.now()}`;
    const imagePath = makeImage();
    let detailId: string | null = null;
    let imageUrl: string | null = null;

    try {
      await stripBypassHeadersForBlobUploads(page);
      await page.goto("/details/new");
      await page.locator("#title").fill(title);

      await page.getByRole("button", { name: "Alege categoriile…" }).click();
      await page.getByRole("button", { name: category.name, exact: true }).click();
      await page.keyboard.press("Escape");

      await page.locator("#image").setInputFiles(imagePath);
      await expect(page.getByRole("button", { name: "Înlocuiește" })).toBeVisible({ timeout: 15_000 });

      // Pasul e OPȚIONAL, deci userul trebuie să înțeleagă DE CE l-ar face — textul explicativ e parte
      // din cerință (2026-07-31: „trebuie specificat clar de ce"), nu decor.
      await expect(page.getByText(/Vrei să explici ceva anume din imagine/)).toBeVisible();

      await page.getByTestId("annotate-open").click();
      await drawStroke(page);
      await page.getByTestId("annotate-save").click();

      // Confirmarea vizuală că adnotarea a fost reținută (editorul s-a închis, marcajul a apărut).
      await expect(page.getByTestId("annotate-open")).toHaveText(/Editează adnotarea/);
      await expect(page.getByText("adnotare adăugată")).toBeVisible();

      await page.getByRole("button", { name: "Publică detaliul" }).click();
      await expect(page).toHaveURL(/\/details\/[0-9a-f-]+$/, { timeout: 20_000 });
      detailId = page.url().split("/details/")[1] ?? null;
      expect(detailId).toBeTruthy();

      const [row] = await db
        .select({ imageUrl: details.imageUrl })
        .from(details)
        .where(eq(details.id, detailId!));
      imageUrl = row?.imageUrl ?? null;

      // Adnotarea există în DB ca schiță PUBLISHED a AUTORULUI însuși (predicatul `isSelfAnnotation`).
      const annotations = await db
        .select({ id: sketches.id, authorId: sketches.authorId, strokesJson: sketches.strokesJson })
        .from(sketches)
        .where(and(eq(sketches.detailId, detailId!), eq(sketches.status, "PUBLISHED")));
      expect(annotations).toHaveLength(1);
      expect((annotations[0]?.strokesJson as unknown[] | null)?.length).toBeGreaterThan(0);

      // Pe pagina detaliului apare butonul de adnotare — și NU un tab de schiță cu autorul lângă
      // el însuși (regresia pe care feature-ul o repară).
      const toggle = page.getByTestId("annotation-toggle-1");
      await expect(toggle).toBeVisible();
      // DESCHISĂ implicit (2026-08-11, decizie Liviu: e „startul dezbaterii").
      await expect(toggle).toHaveAttribute("aria-pressed", "true");
      await expect(page.getByTestId(`sketch-tab-${annotations[0]!.id}`)).toHaveCount(0);

      // Comută efectiv (comportament interactiv — exact ce testele unitare nu acoperă).
      await toggle.click();
      await expect(toggle).toHaveAttribute("aria-pressed", "false");
      await toggle.click();
      await expect(toggle).toHaveAttribute("aria-pressed", "true");
    } finally {
      await cleanup(detailId, imageUrl);
    }
  });

  test("Publicare FĂRĂ adnotare (pas opțional) → detaliu normal, fără toggle", async ({ page }) => {
    const [category] = await pickLeafCategories(1);
    const title = `E2E fără adnotare ${Date.now()}`;
    const imagePath = makeImage();
    let detailId: string | null = null;
    let imageUrl: string | null = null;

    try {
      await stripBypassHeadersForBlobUploads(page);
      await page.goto("/details/new");
      await page.locator("#title").fill(title);
      await page.getByRole("button", { name: "Alege categoriile…" }).click();
      await page.getByRole("button", { name: category.name, exact: true }).click();
      await page.keyboard.press("Escape");
      await page.locator("#image").setInputFiles(imagePath);
      await expect(page.getByRole("button", { name: "Înlocuiește" })).toBeVisible({ timeout: 15_000 });

      await page.getByRole("button", { name: "Publică detaliul" }).click();
      await expect(page).toHaveURL(/\/details\/[0-9a-f-]+$/, { timeout: 20_000 });
      detailId = page.url().split("/details/")[1] ?? null;

      const [row] = await db
        .select({ imageUrl: details.imageUrl })
        .from(details)
        .where(eq(details.id, detailId!));
      imageUrl = row?.imageUrl ?? null;

      await expect(page.getByTestId("annotation-toggle-1")).toHaveCount(0);
      const annotations = await db
        .select({ id: sketches.id })
        .from(sketches)
        .where(eq(sketches.detailId, detailId!));
      expect(annotations).toHaveLength(0);
    } finally {
      await cleanup(detailId, imageUrl);
    }
  });

  test("Înlocuirea imaginii după adnotare o aruncă (stroke-urile nu se mai potrivesc peste noua imagine)", async ({
    page,
  }) => {
    await stripBypassHeadersForBlobUploads(page);
    await page.goto("/details/new");
    await page.locator("#title").fill(`E2E adnotare aruncată ${Date.now()}`);

    await page.locator("#image").setInputFiles(makeImage());
    await expect(page.getByRole("button", { name: "Înlocuiește" })).toBeVisible({ timeout: 15_000 });

    await page.getByTestId("annotate-open").click();
    await drawStroke(page);
    await page.getByTestId("annotate-save").click();
    await expect(page.getByText("adnotare adăugată")).toBeVisible();

    // Imagine NOUĂ → adnotarea trebuie să dispară, nu să rămână peste alt desen.
    await page.locator("#image").setInputFiles(makeImage());
    await expect(page.getByTestId("annotate-open")).toHaveText(/^Adnotează$/);
    await expect(page.getByText("adnotare adăugată")).toHaveCount(0);
  });

  // Redefinire 2026-08-11 (bug real reparat): MAX_ANNOTATIONS_PER_DETAIL a scăzut la 1.
  // „Schițează" e IDENTIC pentru toată lumea, INCLUSIV autorul pe propriul detaliu — un
  // desen ulterior al lui NU mai e o „a doua adnotare", e o schiță NORMALĂ (intră în teanc, ca oricine).
  // Butonul „Adnotează din nou" nu mai există; adnotarea rămâne UNA singură, editabilă doar din
  // Editare detaliu (vezi testul de mai jos).
  test("Desenul ULTERIOR al autorului pe propriul detaliu e o schiță NORMALĂ, nu o a doua adnotare", async ({
    page,
  }) => {
    const [category] = await pickLeafCategories(1);
    const title = `E2E autor re-schițează ${Date.now()}`;
    let detailId: string | null = null;
    let imageUrl: string | null = null;

    try {
      await stripBypassHeadersForBlobUploads(page);
      await page.goto("/details/new");
      await page.locator("#title").fill(title);
      await page.getByRole("button", { name: "Alege categoriile…" }).click();
      await page.getByRole("button", { name: category.name, exact: true }).click();
      await page.keyboard.press("Escape");
      await page.locator("#image").setInputFiles(makeImage());
      await expect(page.getByRole("button", { name: "Înlocuiește" })).toBeVisible({ timeout: 15_000 });

      await page.getByTestId("annotate-open").click();
      await drawStroke(page);
      await page.getByTestId("annotate-save").click();
      await page.getByRole("button", { name: "Publică detaliul" }).click();
      await expect(page).toHaveURL(/\/details\/[0-9a-f-]+$/, { timeout: 20_000 });
      detailId = page.url().split("/details/")[1] ?? null;

      const [row] = await db
        .select({ imageUrl: details.imageUrl })
        .from(details)
        .where(eq(details.id, detailId!));
      imageUrl = row?.imageUrl ?? null;

      const [annotation] = await db
        .select({ id: sketches.id })
        .from(sketches)
        .where(and(eq(sketches.detailId, detailId!), eq(sketches.status, "PUBLISHED")));
      expect(annotation).toBeTruthy();

      // Butonul e uniform — NU mai există „Adnotează din nou" (2026-08-11).
      await expect(page.getByRole("button", { name: "Adnotează din nou" })).toHaveCount(0);
      await page.getByRole("button", { name: "Schițează" }).click();
      await expect(page).toHaveURL(/\/sketches\/[0-9a-f-]+\/edit/, { timeout: 20_000 });

      const secondSketchId = page.url().match(/\/sketches\/([0-9a-f-]+)\/edit/)?.[1];
      expect(secondSketchId).toBeTruthy();

      await drawStroke(page, { expectCounter: false });
      await page.getByRole("button", { name: /Publică schița/ }).click();
      await expect(page).toHaveURL(new RegExp(`/details/${detailId}$`), { timeout: 20_000 });

      // Rândul nou e o schiță NORMALĂ (isAnnotation=false), adnotarea originală rămâne neatinsă.
      const [second] = await db
        .select({ isAnnotation: sketches.isAnnotation })
        .from(sketches)
        .where(eq(sketches.id, secondSketchId!));
      expect(second?.isAnnotation).toBe(false);
      const [stillAnnotation] = await db
        .select({ isAnnotation: sketches.isAnnotation })
        .from(sketches)
        .where(eq(sketches.id, annotation!.id));
      expect(stillAnnotation?.isAnnotation).toBe(true);

      // Intră în teanc ca tab normal — nu ca al doilea buton de adnotare.
      await expect(page.getByTestId(`sketch-tab-${secondSketchId}`)).toBeVisible();
      await expect(page.getByTestId("annotation-toggle-1")).toBeVisible();
      await expect(page.getByTestId("annotation-toggle-1")).toHaveText(/adnotarea autorului/);
    } finally {
      await cleanup(detailId, imageUrl);
    }
  });

  // 2026-08-11, decizie de produs: adnotarea se editează la fel ca nume/descriere/date tehnice.
  // Editarea înlocuiește desenul PE LOC — nu creează un rând nou.
  test("Adnotarea se editează din Editare detaliu, PE LOC (același rând, desen nou)", async ({ page }) => {
    const [category] = await pickLeafCategories(1);
    const title = `E2E editare adnotare ${Date.now()}`;
    let detailId: string | null = null;
    let imageUrl: string | null = null;

    try {
      await stripBypassHeadersForBlobUploads(page);
      await page.goto("/details/new");
      await page.locator("#title").fill(title);
      await page.getByRole("button", { name: "Alege categoriile…" }).click();
      await page.getByRole("button", { name: category.name, exact: true }).click();
      await page.keyboard.press("Escape");
      await page.locator("#image").setInputFiles(makeImage());
      await expect(page.getByRole("button", { name: "Înlocuiește" })).toBeVisible({ timeout: 15_000 });

      await page.getByTestId("annotate-open").click();
      await drawStroke(page);
      await page.getByTestId("annotate-save").click();
      await page.getByRole("button", { name: "Publică detaliul" }).click();
      await expect(page).toHaveURL(/\/details\/[0-9a-f-]+$/, { timeout: 20_000 });
      detailId = page.url().split("/details/")[1] ?? null;

      const [row] = await db
        .select({ imageUrl: details.imageUrl })
        .from(details)
        .where(eq(details.id, detailId!));
      imageUrl = row?.imageUrl ?? null;

      const [before] = await db
        .select({ id: sketches.id, strokesJson: sketches.strokesJson })
        .from(sketches)
        .where(and(eq(sketches.detailId, detailId!), eq(sketches.status, "PUBLISHED")));
      expect(before).toBeTruthy();
      const strokesBefore = (before?.strokesJson as unknown[] | null)?.length ?? 0;

      await page.goto(`/details/${detailId}/edit`);
      // Pornește din adnotarea EXISTENTĂ — butonul spune „Editează", nu „Adnotează".
      await expect(page.getByTestId("annotate-open")).toHaveText(/Editează adnotarea/);
      await page.getByTestId("annotate-open").click();
      await drawStroke(page);
      await page.getByTestId("annotate-save").click();
      await page.getByRole("button", { name: "Salvează modificările" }).click();
      await expect(page).toHaveURL(new RegExp(`/details/${detailId}$`), { timeout: 20_000 });

      // ACELAȘI rând (id neschimbat), strokes ÎNLOCUITE (mai multe decât înainte — al doilea traseu
      // se adaugă peste primul în ACELAȘI editor, nu creează o adnotare nouă).
      const after = await db
        .select({ id: sketches.id, strokesJson: sketches.strokesJson })
        .from(sketches)
        .where(and(eq(sketches.detailId, detailId!), eq(sketches.status, "PUBLISHED")));
      expect(after).toHaveLength(1);
      expect(after[0]?.id).toBe(before!.id);
      expect((after[0]?.strokesJson as unknown[] | null)?.length ?? 0).toBeGreaterThan(strokesBefore);
    } finally {
      await cleanup(detailId, imageUrl);
    }
  });

  // Bug real găsit 2026-08-16 (rând orfan în producție: adnotare rămasă `PUBLISHED`, `authorRemoved=true`,
  // vizual neschimbată — cineva apăsase „Șterge" fără niciun efect). Acoperă exact ce tsc/vitest nu pot
  // prinde: butonul de ștergere e mereu vizibil (nu se dezactivează la o adnotare NEBLOCATĂ), confirmarea
  // chiar duce la dispariția ei din DOM.
  test("Ștergere pe adnotare NEfolosită ca fundal → dispare complet", async ({ page }) => {
    const [category] = await pickLeafCategories(1);
    const title = `E2E ștergere adnotare ${Date.now()}`;
    let detailId: string | null = null;
    let imageUrl: string | null = null;

    try {
      await stripBypassHeadersForBlobUploads(page);
      await page.goto("/details/new");
      await page.locator("#title").fill(title);
      await page.getByRole("button", { name: "Alege categoriile…" }).click();
      await page.getByRole("button", { name: category.name, exact: true }).click();
      await page.keyboard.press("Escape");
      await page.locator("#image").setInputFiles(makeImage());
      await expect(page.getByRole("button", { name: "Înlocuiește" })).toBeVisible({ timeout: 15_000 });

      await page.getByTestId("annotate-open").click();
      await drawStroke(page);
      await page.getByTestId("annotate-save").click();
      await page.getByRole("button", { name: "Publică detaliul" }).click();
      await expect(page).toHaveURL(/\/details\/[0-9a-f-]+$/, { timeout: 20_000 });
      detailId = page.url().split("/details/")[1] ?? null;

      const [row] = await db
        .select({ imageUrl: details.imageUrl })
        .from(details)
        .where(eq(details.id, detailId!));
      imageUrl = row?.imageUrl ?? null;

      const [annotation] = await db
        .select({ id: sketches.id })
        .from(sketches)
        .where(and(eq(sketches.detailId, detailId!), eq(sketches.status, "PUBLISHED")));
      expect(annotation).toBeTruthy();

      // Adnotarea pornește deschisă implicit → butonul „șterge" e vizibil fără niciun click în plus.
      await expect(page.getByTestId("annotation-delete")).toBeVisible();
      await page.getByTestId("annotation-delete").click();

      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      await expect(dialog).toContainText("Ștergi adnotarea?");
      await dialog.getByRole("button", { name: "Șterge" }).click();

      // Fără eroare afișată, iar toggle-ul de adnotare dispare din pagină — dovada vizuală a ștergerii
      // reale (nu doar un „succes" care nu schimbă nimic, exact bug-ul reparat aici).
      await expect(page.getByTestId("annotation-toggle-1")).toHaveCount(0);
      await expect(page.getByText("Adnotarea nu mai poate fi ștearsă")).toHaveCount(0);

      const stillThere = await db
        .select({ id: sketches.id })
        .from(sketches)
        .where(eq(sketches.id, annotation!.id));
      expect(stillThere).toHaveLength(0);
    } finally {
      await cleanup(detailId, imageUrl);
    }
  });

  // Reproduce exact bug-ul din producție: odată ce adnotarea a fost folosită ca fundal pentru schița
  // altcuiva (aici, chiar a autorului — regula de blocare nu ține cont de cine a construit peste ea),
  // ștergerea trebuie REFUZATĂ EXPLICIT (banner), nu „reușită" fără niciun efect vizibil.
  test("Adnotare FOLOSITĂ ca fundal → ștergerea e refuzată explicit, adnotarea rămâne neatinsă", async ({
    page,
  }) => {
    const [category] = await pickLeafCategories(1);
    const title = `E2E adnotare blocată ${Date.now()}`;
    let detailId: string | null = null;
    let imageUrl: string | null = null;

    try {
      await stripBypassHeadersForBlobUploads(page);
      await page.goto("/details/new");
      await page.locator("#title").fill(title);
      await page.getByRole("button", { name: "Alege categoriile…" }).click();
      await page.getByRole("button", { name: category.name, exact: true }).click();
      await page.keyboard.press("Escape");
      await page.locator("#image").setInputFiles(makeImage());
      await expect(page.getByRole("button", { name: "Înlocuiește" })).toBeVisible({ timeout: 15_000 });

      await page.getByTestId("annotate-open").click();
      await drawStroke(page);
      await page.getByTestId("annotate-save").click();
      await page.getByRole("button", { name: "Publică detaliul" }).click();
      await expect(page).toHaveURL(/\/details\/[0-9a-f-]+$/, { timeout: 20_000 });
      detailId = page.url().split("/details/")[1] ?? null;

      const [row] = await db
        .select({ imageUrl: details.imageUrl })
        .from(details)
        .where(eq(details.id, detailId!));
      imageUrl = row?.imageUrl ?? null;

      const [annotation] = await db
        .select({ id: sketches.id })
        .from(sketches)
        .where(and(eq(sketches.detailId, detailId!), eq(sketches.status, "PUBLISHED")));
      expect(annotation).toBeTruthy();

      // Adnotarea deschisă implicit → „Schițează" prinde `openAnnotationId` ca fundal
      // (detail-workspace.tsx: `capturedStack = isBase ? (openAnnotationId ? [openAnnotationId] : [])`).
      await page.getByRole("button", { name: "Schițează" }).click();
      await expect(page).toHaveURL(/\/sketches\/[0-9a-f-]+\/edit/, { timeout: 20_000 });
      const sketchId = page.url().match(/\/sketches\/([0-9a-f-]+)\/edit/)?.[1];
      expect(sketchId).toBeTruthy();

      await drawStroke(page, { expectCounter: false });
      await page.getByRole("button", { name: /Publică schița/ }).click();
      await expect(page).toHaveURL(new RegExp(`/details/${detailId}$`), { timeout: 20_000 });

      // Precondiția bug-ului, confirmată în DB (nu presupusă): adnotarea e acum BLOCATĂ.
      const [locked] = await db
        .select({ lockedAt: sketches.lockedAt })
        .from(sketches)
        .where(eq(sketches.id, annotation!.id));
      expect(locked?.lockedAt).not.toBeNull();

      await page.getByTestId("annotation-delete").click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      await dialog.getByRole("button", { name: "Șterge" }).click();

      // Banner explicit — NU tăcere. Redirect cu `?sketch-delete=annotation-locked`.
      await expect(page).toHaveURL(new RegExp(`/details/${detailId}\\?sketch-delete=annotation-locked`));
      await expect(page.getByText("Adnotarea nu mai poate fi ștearsă")).toBeVisible();

      // Adnotarea rămâne EXACT cum era: toggle-ul tot acolo, rândul intact în DB, `authorRemoved`
      // neatins (nu doar „nu s-a șters" — nici măcar retragerea de identitate nu se aplică, pt că n-ar
      // avea niciun efect vizibil pe o adnotare).
      await expect(page.getByTestId("annotation-toggle-1")).toBeVisible();
      const [stillThere] = await db
        .select({ status: sketches.status, isAnnotation: sketches.isAnnotation, authorRemoved: sketches.authorRemoved })
        .from(sketches)
        .where(eq(sketches.id, annotation!.id));
      expect(stillThere?.status).toBe("PUBLISHED");
      expect(stillThere?.isAnnotation).toBe(true);
      expect(stillThere?.authorRemoved).toBe(false);
    } finally {
      await cleanup(detailId, imageUrl);
    }
  });
});
