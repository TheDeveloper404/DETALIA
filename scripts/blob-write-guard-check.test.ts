import { describe, expect, it } from "vitest";

import { findViolations } from "./blob-write-guard-check.lib.mjs";

describe("findViolations — gardă write-path Blob fără verificare de ownership (SEC-N01)", () => {
  it("prinde exact tiparul bug-ului istoric: sink apelat fără nicio gardă în corpul funcției", async () => {
    const source = `
      export async function createDetail(input: { authorId: string; resources: unknown[] }) {
        const detail = await insertDetailWithRelations({ resources: input.resources });
        return { ok: true, detailId: detail.id };
      }
    `;
    const violations = findViolations(source);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({
      functionName: "createDetail",
      sink: "insertDetailWithRelations",
    });
  });

  it("nu flagează când funcția conține hasForeignBlobResource înainte de sink (fix-ul real aplicat)", () => {
    const source = `
      export async function createDetail(input: { authorId: string; resources: unknown[] }) {
        if (hasForeignBlobResource(value.resources, input.authorId)) return { ok: false };
        const detail = await insertDetailWithRelations({ resources: value.resources });
        return { ok: true, detailId: detail.id };
      }
    `;
    expect(findViolations(source)).toHaveLength(0);
  });

  it("nu flagează un guard prin isUsersBlobUrl direct (pattern profileService.setAvatar)", () => {
    const source = `
      export async function setAvatar(userId: string, url: string) {
        if (!isUsersBlobUrl(url, userId)) return { ok: false };
        await updateUserImage(userId, url);
        return { ok: true };
      }
    `;
    expect(findViolations(source)).toHaveLength(0);
  });

  it("nu flagează un guard prin reprocessBlobImage (pattern commentService.addComment)", () => {
    const source = `
      export async function addComment(input: { userId: string; imageUrl?: string | null }) {
        let imageUrl: string | null = null;
        if (input.imageUrl) {
          const processed = await reprocessBlobImage(input.imageUrl, "comments", input.userId);
          imageUrl = processed.ok ? processed.url : null;
        }
        await insertComment({ imageUrl });
        return { ok: true };
      }
    `;
    expect(findViolations(source)).toHaveLength(0);
  });

  it("SEC-N02: prinde replaceMaterialOfferFiles fără gardă (recidiva din feature-ul de oferte)", () => {
    const source = `
      export async function sendOrUpdateMaterialOffer(input: { userId: string; files: unknown[] }) {
        const offerId = await upsertMaterialOffer({ supplierId: input.userId });
        const orphaned = await replaceMaterialOfferFiles(offerId, input.files);
        await deleteBlobs(orphaned);
        return { ok: true };
      }
    `;
    const violations = findViolations(source);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({ functionName: "sendOrUpdateMaterialOffer", sink: "replaceMaterialOfferFiles" });
  });

  it("SEC-N02: NU flagează când isUsersBlobUrl e prezent înainte de replaceMaterialOfferFiles (fix-ul aplicat)", () => {
    const source = `
      export async function sendOrUpdateMaterialOffer(input: { userId: string; files: { url: string }[] }) {
        if (input.files.some((f) => !isUsersBlobUrl(f.url, input.userId))) return { ok: false };
        const offerId = await upsertMaterialOffer({ supplierId: input.userId });
        await replaceMaterialOfferFiles(offerId, input.files);
        return { ok: true };
      }
    `;
    expect(findViolations(source)).toHaveLength(0);
  });

  it("ignoră funcții care nu ating niciun sink cunoscut", () => {
    const source = `
      export async function getDetail(id: string) {
        return getDetailById(id);
      }
    `;
    expect(findViolations(source)).toHaveLength(0);
  });

  it("prinde mai multe funcții independent, în același fișier", () => {
    const source = `
      export async function updateDetail(input: { userId: string }) {
        await updateDetailRow("id", {});
      }
      export async function publishDetailDraft(input: { authorId: string }) {
        await updateDetailRow("id", {});
      }
    `;
    const violations = findViolations(source);
    expect(violations).toHaveLength(2);
    expect(violations.map((v) => v.functionName)).toEqual(["updateDetail", "publishDetailDraft"]);
  });
});
