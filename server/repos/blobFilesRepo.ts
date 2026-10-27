import { eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import {
  canvases,
  details,
  detailResources,
  materialOfferFiles,
  materialOffers,
  projectCanvasShares,
  sketches,
} from "@/db/schema";
import type { BlobFileKind } from "@/lib/blob-read-url";

const parentColumns = {
  ownerId: details.authorId,
  projectId: details.projectId,
  detailStatus: details.status,
};

// Folosit numai la reutilizarea unui URL privat primit de la client, nu la citirile pe ID.
export async function getBlobFileReferences(urls: string[]) {
  const [images, resources, thumbs, boards, shares, offers] = await Promise.all([
    db
      .select({ id: details.id, url: details.imageUrl })
      .from(details)
      .where(inArray(details.imageUrl, urls)),
    db
      .select({ id: detailResources.id, url: detailResources.url })
      .from(detailResources)
      .where(inArray(detailResources.url, urls)),
    db
      .select({ id: sketches.id, url: sketches.thumbnailUrl })
      .from(sketches)
      .where(inArray(sketches.thumbnailUrl, urls)),
    db
      .select({ id: canvases.id, url: canvases.thumbnailUrl })
      .from(canvases)
      .where(inArray(canvases.thumbnailUrl, urls)),
    db
      .select({ id: projectCanvasShares.id, url: projectCanvasShares.imageUrl })
      .from(projectCanvasShares)
      .where(inArray(projectCanvasShares.imageUrl, urls)),
    db
      .select({ id: materialOfferFiles.id, url: materialOfferFiles.url })
      .from(materialOfferFiles)
      .where(inArray(materialOfferFiles.url, urls)),
  ]);
  return [
    ...images.map((row) => ({ ...row, kind: "detail" as const })),
    ...resources.map((row) => ({ ...row, kind: "resource" as const })),
    ...thumbs.map((row) => ({ ...row, kind: "sketch" as const })),
    ...boards.map((row) => ({ ...row, kind: "canvas" as const })),
    ...shares.map((row) => ({ ...row, kind: "canvas-share" as const })),
    ...offers.map((row) => ({ ...row, kind: "offer" as const })),
  ];
}

export type BlobFileRow = {
  url: string | null;
  ownerId?: string;
  projectId?: string | null;
  detailStatus?: string;
  sketchStatus?: string;
  sketchAuthorId?: string;
  hidden?: boolean;
  supplierId?: string;
  fileName?: string;
};

export async function getBlobFile(kind: BlobFileKind, id: string): Promise<BlobFileRow | null> {
  switch (kind) {
    case "detail": {
      const [row] = await db
        .select({ url: details.imageUrl, ...parentColumns })
        .from(details)
        .where(eq(details.id, id));
      return row ?? null;
    }
    case "resource": {
      const [row] = await db
        .select({ url: detailResources.url, ...parentColumns })
        .from(detailResources)
        .innerJoin(details, eq(details.id, detailResources.detailId))
        .where(eq(detailResources.id, id));
      return row ?? null;
    }
    case "sketch": {
      const [row] = await db
        .select({
          url: sketches.thumbnailUrl,
          ...parentColumns,
          sketchStatus: sketches.status,
          sketchAuthorId: sketches.authorId,
          hidden: sketches.hiddenAfterRelease,
        })
        .from(sketches)
        .innerJoin(details, eq(details.id, sketches.detailId))
        .where(eq(sketches.id, id));
      return row ?? null;
    }
    case "canvas": {
      const [row] = await db
        .select({ url: canvases.thumbnailUrl, ownerId: canvases.ownerId })
        .from(canvases)
        .where(eq(canvases.id, id));
      return row ?? null;
    }
    case "canvas-share": {
      const [row] = await db
        .select({ url: projectCanvasShares.imageUrl, projectId: projectCanvasShares.projectId })
        .from(projectCanvasShares)
        .where(eq(projectCanvasShares.id, id));
      return row ?? null;
    }
    case "offer": {
      const [row] = await db
        .select({
          url: materialOfferFiles.url,
          ownerId: details.authorId,
          supplierId: materialOffers.supplierId,
          fileName: materialOfferFiles.fileName,
        })
        .from(materialOfferFiles)
        .innerJoin(materialOffers, eq(materialOffers.id, materialOfferFiles.offerId))
        .innerJoin(details, eq(details.id, materialOffers.detailId))
        .where(eq(materialOfferFiles.id, id));
      return row ?? null;
    }
  }
}
