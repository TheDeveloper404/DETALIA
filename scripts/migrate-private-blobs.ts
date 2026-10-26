// Rulare manuala; nu se importa in aplicatie. Vezi docs/DEPLOY.md, DET-03.
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { and, eq } from "drizzle-orm";
import { list, put } from "@vercel/blob";

import {
  canvases,
  comments,
  details,
  detailResources,
  materialOfferFiles,
  projectCanvasShares,
  sketches,
  users,
} from "../db/schema";
import { blobStoreOptions, deleteOwnBlob, isPrivateBlobUrl, readOwnBlob } from "../lib/blob-store";
import { isOwnBlobUrl } from "../lib/blob-url";

class MigrationPrecondition extends Error {}

const tables = {
  details: { table: details, id: details.id, url: details.imageUrl, field: "imageUrl" },
  resources: {
    table: detailResources,
    id: detailResources.id,
    url: detailResources.url,
    field: "url",
  },
  sketches: { table: sketches, id: sketches.id, url: sketches.thumbnailUrl, field: "thumbnailUrl" },
  canvases: { table: canvases, id: canvases.id, url: canvases.thumbnailUrl, field: "thumbnailUrl" },
  shares: {
    table: projectCanvasShares,
    id: projectCanvasShares.id,
    url: projectCanvasShares.imageUrl,
    field: "imageUrl",
  },
  offers: {
    table: materialOfferFiles,
    id: materialOfferFiles.id,
    url: materialOfferFiles.url,
    field: "url",
  },
} as const;
type Ref = { database: string; table: keyof typeof tables; id: string; source: string };
type Copy = { url: string; sha256: string; size: number };
type Manifest = {
  version: 1;
  databases: string[];
  refs: Ref[];
  sources: string[];
  copies: Record<string, Copy>;
};

const phase = process.argv[2];
const manifestPath = process.argv[3] ?? ".remember/private-blob-migration.json";
const phases = ["inventory", "copy", "apply", "verify", "purge"];
const hash = (bytes: ArrayBuffer) => createHash("sha256").update(Buffer.from(bytes)).digest("hex");

function save(manifest: Manifest) {
  mkdirSync(dirname(manifestPath), { recursive: true });
  writeFileSync(`${manifestPath}.tmp`, JSON.stringify(manifest, null, 2), { mode: 0o600 });
  renameSync(`${manifestPath}.tmp`, manifestPath);
}

async function bytes(url: string) {
  const file = await readOwnBlob(url);
  if (!file) throw new MigrationPrecondition("Fisier lipsa; operatia este oprita.");
  return { bytes: await new Response(file.body).arrayBuffer(), contentType: file.contentType };
}

export async function runBlobMigration() {
  if (!phase || phase === "--help") {
    console.log(
      "Faze: inventory (simulare, fara modificari externe), copy, apply, verify, purge. Vezi docs/DEPLOY.md.",
    );
    return;
  }
  if (!phases.includes(phase)) throw new MigrationPrecondition("Faza necunoscuta.");
  const urls = JSON.parse(process.env.BLOB_MIGRATION_DATABASE_URLS ?? "{}") as Record<
    string,
    string
  >;
  if (
    !urls.production ||
    !urls.preview ||
    Object.values(urls).some((url) => typeof url !== "string" || !url.startsWith("postgres"))
  ) {
    throw new MigrationPrecondition(
      "Configureaza BLOB_MIGRATION_DATABASE_URLS cu production, preview si TOATE celelalte baze care folosesc store-ul comun.",
    );
  }
  const databases = Object.keys(urls).sort();
  const connections = Object.fromEntries(
    databases.map((name) => [name, drizzle(neon(urls[name]), { casing: "snake_case" })]),
  );
  blobStoreOptions("private"); // Fail-closed inainte de orice mutatie.

  async function inventory() {
    const refs: Ref[] = [];
    for (const database of databases) {
      for (const [name, spec] of Object.entries(tables)) {
        const rows = await connections[database]
          .select({ id: spec.id, url: spec.url })
          .from(spec.table);
        for (const row of rows) {
          if (row.url && isOwnBlobUrl(row.url) && !isPrivateBlobUrl(row.url)) {
            refs.push({
              database,
              table: name as keyof typeof tables,
              id: row.id,
              source: row.url,
            });
          }
        }
      }
    }
    return refs;
  }

  async function publicContentInventory() {
    const sources = new Set<string>();
    let cursor: string | undefined;
    let unclassified = 0;
    do {
      const page = await list({ ...blobStoreOptions("public"), cursor });
      for (const blob of page.blobs) {
        // Include si copii vechi/orfane, nu doar fisierele inca referite in DB.
        const folder = blob.pathname.startsWith("u/")
          ? blob.pathname.split("/")[2]
          : blob.pathname.split("/")[0];
        if (
          ["details", "resources", "sketches", "canvases", "project-shares", "materials"].includes(
            folder,
          )
        )
          sources.add(blob.url);
        else if (!["avatars", "covers", "comments"].includes(folder)) unclassified++;
      }
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
    return { sources, unclassified };
  }

  if (phase === "inventory") {
    const refs = await inventory();
    const { sources, unclassified } = await publicContentInventory();
    refs.forEach((ref) => sources.add(ref.source));
    // Nu suprascriem un manifest folosit deja: copiile verificate permit reluarea dupa intrerupere.
    try {
      readFileSync(manifestPath);
      throw new MigrationPrecondition(
        "Manifest existent; foloseste un fisier nou pentru inventar.",
      );
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
    }
    save({ version: 1, databases, refs, sources: [...sources], copies: {} });
    console.log(
      `Inventar: ${refs.length} referinte, ${sources.size} fisiere, ${unclassified} cai neclasificate (de verificat manual inainte de purge). Fara scrieri externe.`,
    );
    return;
  }

  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as Manifest;
  if (manifest.version !== 1 || JSON.stringify(manifest.databases) !== JSON.stringify(databases)) {
    throw new MigrationPrecondition("Lista bazelor difera de inventar; operatia este oprita.");
  }
  if (phase === "copy") {
    for (const source of manifest.sources) {
      if (!isOwnBlobUrl(source) || isPrivateBlobUrl(source))
        throw new MigrationPrecondition("Sursa invalida in manifest.");
      const original = await bytes(source);
      const sha256 = hash(original.bytes);
      const pathname = new URL(source).pathname.slice(1);
      const options = blobStoreOptions("private");
      const privateUrl = `https://${options.storeId?.replace(/^store_/, "").toLowerCase()}.private.blob.vercel-storage.com/${pathname}`;
      const existing = await readOwnBlob(privateUrl);
      let target = privateUrl;
      if (existing) {
        if (hash(await new Response(existing.body).arrayBuffer()) !== sha256)
          throw new MigrationPrecondition("Coliziune la destinatie; fara suprascriere.");
      } else {
        const uploaded = await put(pathname, Buffer.from(original.bytes), {
          access: "private",
          ...options,
          contentType: original.contentType,
          addRandomSuffix: false,
        });
        target = uploaded.url;
      }
      const copied = await bytes(target);
      if (hash(copied.bytes) !== sha256)
        throw new MigrationPrecondition(
          "Verificarea copiei a esuat; sursa publica ramane intacta.",
        );
      manifest.copies[source] = { url: target, sha256, size: copied.bytes.byteLength };
      save(manifest);
    }
    console.log(
      `Copii verificate: ${Object.keys(manifest.copies).length}. Sursele publice sunt intacte.`,
    );
    return;
  }

  for (const source of manifest.sources) {
    const copy = manifest.copies[source];
    if (!copy || !isPrivateBlobUrl(copy.url) || !isOwnBlobUrl(copy.url))
      throw new MigrationPrecondition("Copie verificata lipsa.");
    const file = await bytes(copy.url);
    if (hash(file.bytes) !== copy.sha256 || file.bytes.byteLength !== copy.size)
      throw new MigrationPrecondition("Copie modificata/lipsa; operatia este oprita.");
  }

  if (phase === "apply") {
    for (const ref of manifest.refs) {
      const spec = tables[ref.table];
      const destination = manifest.copies[ref.source]?.url;
      if (!spec || !destination || !connections[ref.database])
        throw new MigrationPrecondition("Referinta invalida.");
      const [current] = await connections[ref.database]
        .select({ url: spec.url })
        .from(spec.table)
        .where(eq(spec.id, ref.id));
      if (!current || current.url === destination) continue; // Stergere concurenta / reluare idempotenta.
      if (current.url !== ref.source)
        throw new MigrationPrecondition(
          "Referinta schimbata dupa inventar; refa inventarul separat.",
        );
      const changed = await connections[ref.database]
        .update(spec.table)
        .set({ [spec.field]: destination })
        .where(and(eq(spec.id, ref.id), eq(spec.url, ref.source)))
        .returning({ id: spec.id });
      if (changed.length !== 1)
        throw new MigrationPrecondition("Referinta schimbata concurent; operatia este oprita.");
    }
    console.log("Referinte actualizate. Sursele publice sunt intacte; urmeaza verify.");
    return;
  }

  if ((await inventory()).length)
    throw new MigrationPrecondition(
      "Mai exista referinte publice in cel putin o baza; purge interzis.",
    );
  if (!process.argv.includes("--cutover-confirmed")) {
    throw new MigrationPrecondition(
      "Verify/purge necesita --cutover-confirmed: toate scrierile vechi oprite, inclusiv tokenurile deja emise si upload-urile in curs, toate bazele declarate si backup privat verificat.",
    );
  }
  // Snapshot-ul initial nu poate acoperi upload-uri aparute intre inventory si oprirea scrierilor.
  // Sub freeze, relistam TOATE paginile si nu acceptam un verdict final pe un inventar incomplet.
  const finalInventory = await publicContentInventory();
  const knownSources = new Set(manifest.sources);
  if ([...finalInventory.sources].some((source) => !knownSources.has(source))) {
    throw new MigrationPrecondition(
      "Store-ul contine fisiere de continut neinventariate. Pastreaza oprirea scrierilor si reia inventory/copy/apply cu un manifest nou; fara stergeri.",
    );
  }
  // Copiile folosite si de continut in afara scopului nu se sterg automat.
  for (const database of databases) {
    const [profiles, commentRows] = await Promise.all([
      connections[database].select({ image: users.image, cover: users.coverImage }).from(users),
      connections[database].select({ image: comments.imageUrl }).from(comments),
    ]);
    const sources = new Set(manifest.sources);
    if (
      profiles.some(
        (row) => (row.image && sources.has(row.image)) || (row.cover && sources.has(row.cover)),
      ) ||
      commentRows.some((row) => row.image && sources.has(row.image))
    ) {
      throw new MigrationPrecondition(
        "O sursa este folosita si de profil/comentarii; necesita analiza manuala, fara stergeri.",
      );
    }
  }
  if (phase === "verify") {
    console.log("Verificare OK: copii intacte, zero referinte publice in bazele declarate.");
    return;
  }
  for (const source of manifest.sources) await deleteOwnBlob(source);
  console.log(
    "Sursele publice au fost retrase. Verifica anonim vechile URL-uri si propagarea stergerii/cache-urilor inainte de inchiderea DET-03.",
  );
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("/migrate-private-blobs.ts"))
  void runBlobMigration().catch((error: unknown) => {
    // SDK/driver errors pot include URL-uri/tokenuri: nu le tiparim. Manifestul permite reluarea.
    console.error(
      error instanceof MigrationPrecondition
        ? error.message
        : "Migrare oprita la accesul DB/Blob. Verifica configurarea si preconditiile din docs/DEPLOY.md; niciun secret nu este afisat.",
    );
    process.exitCode = 1;
  });
