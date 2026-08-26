// Repo pentru ofertele de materiale (Furnizor → autor detaliu) — singurul loc cu acces Drizzle pentru
// `material_offers`/`material_offer_files`.
import { and, desc, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import { details, materialOfferFiles, materialOffers, roles, users } from "@/db/schema";

export type MaterialOfferFileInput = { url: string; fileName: string; fileSize: number };
export type MaterialOfferFileRow = MaterialOfferFileInput & { id: string };

export async function getMaterialOfferId(detailId: string, supplierId: string): Promise<string | null> {
  const [row] = await db
    .select({ id: materialOffers.id })
    .from(materialOffers)
    .where(and(eq(materialOffers.detailId, detailId), eq(materialOffers.supplierId, supplierId)))
    .limit(1);
  return row?.id ?? null;
}

// Insert-sau-update ATOMIC pe (detailId, supplierId) — unique index din schemă face din asta chiar
// „o singură ofertă per furnizor per detaliu" (nu doar convenție de aplicație).
export async function upsertMaterialOffer(input: {
  detailId: string;
  supplierId: string;
  message: string;
}): Promise<string> {
  const [row] = await db
    .insert(materialOffers)
    .values({ detailId: input.detailId, supplierId: input.supplierId, message: input.message })
    .onConflictDoUpdate({
      target: [materialOffers.detailId, materialOffers.supplierId],
      set: { message: input.message, updatedAt: new Date() },
    })
    .returning({ id: materialOffers.id });
  return row.id;
}

// Înlocuiește TOATE fișierele ofertei cu lista nouă — clientul trimite lista completă dorită (cele
// păstrate de la editarea anterioară + cele noi), nu un diff. Întoarce URL-urile VECHI (apelantul le
// șterge din Blob dacă nu mai apar în lista nouă — orfanele plătite la nesfârșit altfel).
export async function replaceMaterialOfferFiles(
  offerId: string,
  files: MaterialOfferFileInput[],
): Promise<string[]> {
  const oldRows = await db
    .select({ url: materialOfferFiles.url })
    .from(materialOfferFiles)
    .where(eq(materialOfferFiles.offerId, offerId));

  await db.batch([
    db.delete(materialOfferFiles).where(eq(materialOfferFiles.offerId, offerId)),
    db.insert(materialOfferFiles).values(files.map((f) => ({ offerId, ...f }))),
  ]);

  return oldRows.map((r) => r.url);
}

// Ștergere completă (retragere explicită SAU cascadă la anonimizarea autorului) — întoarce URL-urile
// fișierelor, pentru curățarea din Blob.
export async function deleteMaterialOffer(offerId: string): Promise<string[]> {
  const fileRows = await db
    .select({ url: materialOfferFiles.url })
    .from(materialOfferFiles)
    .where(eq(materialOfferFiles.offerId, offerId));
  await db.delete(materialOffers).where(eq(materialOffers.id, offerId)); // cascade → material_offer_files
  return fileRows.map((r) => r.url);
}

// Toate ofertele unui detaliu (mai multe pot exista — un furnizor per ofertă) — pentru anonimizare:
// „oferta se șterge" indiferent de câți furnizori au ofertat. Întoarce URL-urile fișierelor pt Blob.
export async function deleteMaterialOffersForDetail(detailId: string): Promise<string[]> {
  const offerRows = await db
    .select({ id: materialOffers.id })
    .from(materialOffers)
    .where(eq(materialOffers.detailId, detailId));
  if (offerRows.length === 0) return [];
  const offerIds = offerRows.map((o) => o.id);

  const fileRows = await db
    .select({ url: materialOfferFiles.url })
    .from(materialOfferFiles)
    .where(inArray(materialOfferFiles.offerId, offerIds));

  await db.delete(materialOffers).where(inArray(materialOffers.id, offerIds)); // cascade → files
  return fileRows.map((r) => r.url);
}

export type MaterialOfferForDetail = {
  offerId: string;
  supplierId: string;
  supplierName: string | null;
  supplierImage: string | null;
  roleMain: string | null;
  subRole: string | null;
  verification: string | null;
  message: string;
  createdAt: Date;
  updatedAt: Date;
  files: MaterialOfferFileRow[];
};

// Lista de oferte a unui detaliu — STRICT pentru autor (verificarea de acces e responsabilitatea
// service-ului care apelează, nu a repo-ului). Două interogări (nu json_agg corelat) — evită deliberat
// capcana recidivată în acest fișier-frate (detailsRepo.ts): un subquery corelat cu coloană
// necalificată se rezolvă silențios greșit dacă tabelul din subquery are o coloană omonimă (aici,
// `material_offer_files.id`/`material_offers.id`) — mai simplu și mai sigur să agregăm în JS.
export async function listMaterialOffersForDetail(detailId: string): Promise<MaterialOfferForDetail[]> {
  const offers = await db
    .select({
      offerId: materialOffers.id,
      supplierId: materialOffers.supplierId,
      supplierName: users.name,
      supplierImage: users.image,
      roleMain: roles.roleMain,
      subRole: roles.subRole,
      verification: roles.verificationStatus,
      message: materialOffers.message,
      createdAt: materialOffers.createdAt,
      updatedAt: materialOffers.updatedAt,
    })
    .from(materialOffers)
    .leftJoin(users, eq(users.id, materialOffers.supplierId))
    .leftJoin(roles, eq(roles.userId, materialOffers.supplierId))
    .where(eq(materialOffers.detailId, detailId))
    .orderBy(desc(materialOffers.createdAt));

  if (offers.length === 0) return [];

  const offerIds = offers.map((o) => o.offerId);
  const fileRows = await db
    .select({
      id: materialOfferFiles.id,
      offerId: materialOfferFiles.offerId,
      url: materialOfferFiles.url,
      fileName: materialOfferFiles.fileName,
      fileSize: materialOfferFiles.fileSize,
    })
    .from(materialOfferFiles)
    .where(inArray(materialOfferFiles.offerId, offerIds));

  const filesByOffer = new Map<string, MaterialOfferFileRow[]>();
  for (const f of fileRows) {
    const list = filesByOffer.get(f.offerId) ?? [];
    list.push({ id: f.id, url: f.url, fileName: f.fileName, fileSize: f.fileSize });
    filesByOffer.set(f.offerId, list);
  }

  return offers.map((o) => ({ ...o, files: filesByOffer.get(o.offerId) ?? [] }));
}

export type MaterialOfferWithFiles = {
  offerId: string;
  message: string;
  createdAt: Date;
  updatedAt: Date;
  files: MaterialOfferFileRow[];
};

// Oferta proprie a UNUI furnizor pe UN detaliu — pentru pre-completarea modalului de editare.
export async function getMaterialOfferWithFiles(
  detailId: string,
  supplierId: string,
): Promise<MaterialOfferWithFiles | null> {
  const [offer] = await db
    .select({
      offerId: materialOffers.id,
      message: materialOffers.message,
      createdAt: materialOffers.createdAt,
      updatedAt: materialOffers.updatedAt,
    })
    .from(materialOffers)
    .where(and(eq(materialOffers.detailId, detailId), eq(materialOffers.supplierId, supplierId)))
    .limit(1);
  if (!offer) return null;

  const fileRows = await db
    .select({
      id: materialOfferFiles.id,
      url: materialOfferFiles.url,
      fileName: materialOfferFiles.fileName,
      fileSize: materialOfferFiles.fileSize,
    })
    .from(materialOfferFiles)
    .where(eq(materialOfferFiles.offerId, offer.offerId));

  return { ...offer, files: fileRows };
}

export type MyMaterialOfferRow = {
  offerId: string;
  detailId: string;
  detailTitle: string;
  message: string;
  createdAt: Date;
  updatedAt: Date;
  fileCount: number;
};

// Istoricul ofertelor TRIMISE de un furnizor — pentru secțiunea nouă din profilul lui (privată, doar el).
export async function listMaterialOffersBySupplier(supplierId: string): Promise<MyMaterialOfferRow[]> {
  const offers = await db
    .select({
      offerId: materialOffers.id,
      detailId: materialOffers.detailId,
      message: materialOffers.message,
      createdAt: materialOffers.createdAt,
      updatedAt: materialOffers.updatedAt,
    })
    .from(materialOffers)
    .where(eq(materialOffers.supplierId, supplierId))
    .orderBy(desc(materialOffers.createdAt));
  // detailTitle + fileCount aduse separat (nu join în query-ul de mai sus) — evită duplicarea rândurilor
  // de ofertă per fișier; N mic (istoricul unui singur furnizor), simplitate > o interogare unică.
  return listWithDetailTitleAndFileCount(offers);
}

export type ReceivedMaterialOfferRow = {
  offerId: string;
  detailId: string;
  detailTitle: string;
  supplierId: string;
  supplierName: string | null;
  supplierImage: string | null;
  message: string;
  createdAt: Date;
  updatedAt: Date;
  fileCount: number;
};

// Istoricul ofertelor PRIMITE de un user pe TOATE detaliile lui (nu doar unul) — pentru secțiunea din
// profilul lui (privată, doar el vede — gating-ul e responsabilitatea apelantului, ca la restul
// funcțiilor din acest fișier). Join pe `details.author_id`, nu pe un singur `detailId`.
export async function listMaterialOffersReceivedByAuthor(authorId: string): Promise<ReceivedMaterialOfferRow[]> {
  const offers = await db
    .select({
      offerId: materialOffers.id,
      detailId: materialOffers.detailId,
      detailTitle: details.title,
      supplierId: materialOffers.supplierId,
      supplierName: users.name,
      supplierImage: users.image,
      message: materialOffers.message,
      createdAt: materialOffers.createdAt,
      updatedAt: materialOffers.updatedAt,
    })
    .from(materialOffers)
    .innerJoin(details, eq(details.id, materialOffers.detailId))
    .leftJoin(users, eq(users.id, materialOffers.supplierId))
    .where(eq(details.authorId, authorId))
    .orderBy(desc(materialOffers.createdAt));

  if (offers.length === 0) return [];
  const offerIds = offers.map((o) => o.offerId);
  const fileRows = await db
    .select({ offerId: materialOfferFiles.offerId })
    .from(materialOfferFiles)
    .where(inArray(materialOfferFiles.offerId, offerIds));
  const fileCountByOffer = new Map<string, number>();
  for (const f of fileRows) fileCountByOffer.set(f.offerId, (fileCountByOffer.get(f.offerId) ?? 0) + 1);

  return offers.map((o) => ({ ...o, fileCount: fileCountByOffer.get(o.offerId) ?? 0 }));
}

async function listWithDetailTitleAndFileCount(
  offers: { offerId: string; detailId: string; message: string; createdAt: Date; updatedAt: Date }[],
): Promise<MyMaterialOfferRow[]> {
  if (offers.length === 0) return [];
  const detailIds = [...new Set(offers.map((o) => o.detailId))];
  const offerIds = offers.map((o) => o.offerId);

  const [detailRows, fileRows] = await Promise.all([
    db.select({ id: details.id, title: details.title }).from(details).where(inArray(details.id, detailIds)),
    db
      .select({ offerId: materialOfferFiles.offerId })
      .from(materialOfferFiles)
      .where(inArray(materialOfferFiles.offerId, offerIds)),
  ]);
  const titleById = new Map(detailRows.map((d) => [d.id, d.title]));
  const fileCountByOffer = new Map<string, number>();
  for (const f of fileRows) fileCountByOffer.set(f.offerId, (fileCountByOffer.get(f.offerId) ?? 0) + 1);

  return offers.map((o) => ({
    ...o,
    detailTitle: titleById.get(o.detailId) ?? "Detaliu șters",
    fileCount: fileCountByOffer.get(o.offerId) ?? 0,
  }));
}
