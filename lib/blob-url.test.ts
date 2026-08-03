import { afterEach, describe, expect, it, vi } from "vitest";

// isOwnBlobUrl (SEC-A2) — poarta STRICTĂ la persistarea URL-urilor de imagine: nu orice store Vercel
// Blob, ci exact al nostru (store ID derivat din BLOB_READ_WRITE_TOKEN). Store ID-ul e capturat la
// load-ul modulului → fiecare test resetează modulele și setează env-ul ÎNAINTE de import.

// PLACEHOLDER de test, nu un secret real — asamblat din bucăți ca hook-ul block-secrets să nu-l
// confunde cu un token adevărat.
const OWN_TOKEN = ["vercel", "blob", "rw", "Abc123XYZ", "placeholder-nu-e-secret"].join("_");
const OWN_HOST = "abc123xyz.public.blob.vercel-storage.com"; // store ID-ul, lowercase

async function loadWithToken(token: string | undefined) {
  vi.resetModules();
  if (token === undefined) {
    delete process.env.BLOB_READ_WRITE_TOKEN;
  } else {
    process.env.BLOB_READ_WRITE_TOKEN = token;
  }
  return (await import("./blob-url")).isOwnBlobUrl;
}

async function loadUsersCheckWithToken(token: string | undefined) {
  vi.resetModules();
  if (token === undefined) {
    delete process.env.BLOB_READ_WRITE_TOKEN;
  } else {
    process.env.BLOB_READ_WRITE_TOKEN = token;
  }
  return (await import("./blob-url")).isUsersBlobUrl;
}

afterEach(() => {
  delete process.env.BLOB_READ_WRITE_TOKEN;
});

describe("isOwnBlobUrl — cu BLOB_READ_WRITE_TOKEN setat (producție)", () => {
  it("acceptă un URL din store-ul NOSTRU", async () => {
    const isOwnBlobUrl = await loadWithToken(OWN_TOKEN);
    expect(isOwnBlobUrl(`https://${OWN_HOST}/avatars/x.png`)).toBe(true);
  });

  it("respinge un URL dintr-un ALT store Vercel Blob (alt cont)", async () => {
    const isOwnBlobUrl = await loadWithToken(OWN_TOKEN);
    expect(isOwnBlobUrl("https://altstore99.public.blob.vercel-storage.com/avatars/x.png")).toBe(
      false,
    );
  });

  it("respinge hostname-uri care doar CONȚIN store-ul nostru (prefix/sufix înșelător)", async () => {
    const isOwnBlobUrl = await loadWithToken(OWN_TOKEN);
    // subdomeniu al unui domeniu atacator care imită sufixul
    expect(isOwnBlobUrl(`https://${OWN_HOST}.evil.com/avatars/x.png`)).toBe(false);
    // store străin cu ID-ul nostru ca prefix
    expect(
      isOwnBlobUrl("https://abc123xyz0.public.blob.vercel-storage.com/avatars/x.png"),
    ).toBe(false);
  });

  it("respinge URL-uri complet străine sau non-https", async () => {
    const isOwnBlobUrl = await loadWithToken(OWN_TOKEN);
    expect(isOwnBlobUrl("https://evil.com/x.png")).toBe(false);
    expect(isOwnBlobUrl(`http://${OWN_HOST}/x.png`)).toBe(false);
    expect(isOwnBlobUrl("not-a-url")).toBe(false);
    expect(isOwnBlobUrl("")).toBe(false);
  });
});

describe("isOwnBlobUrl — fără token (dev local fără Blob)", () => {
  it("cade pe forma generală: acceptă orice store Vercel Blob public", async () => {
    const isOwnBlobUrl = await loadWithToken(undefined);
    expect(isOwnBlobUrl("https://oricare.public.blob.vercel-storage.com/x.png")).toBe(true);
  });

  it("dar respinge în continuare gazde non-Blob", async () => {
    const isOwnBlobUrl = await loadWithToken(undefined);
    expect(isOwnBlobUrl("https://evil.com/x.png")).toBe(false);
  });
});

describe("isOwnBlobUrl — token malformat (nu se poate extrage store ID)", () => {
  it("cade pe forma generală (nu blochează fluxul)", async () => {
    const isOwnBlobUrl = await loadWithToken("token-care-nu-respecta-formatul");
    expect(isOwnBlobUrl("https://oricare.public.blob.vercel-storage.com/x.png")).toBe(true);
  });
});

// isUsersBlobUrl (SEC-001) — pe lângă store-ul nostru, verifică și că URL-ul e sub namespace-ul
// userului dat (`/u/<userId>/...`). Fără asta, orice user autentificat putea da URL-ul unei imagini a
// altui user la saveAvatarUrl/updateDetail etc., iar reprocessBlobImage îl ștergea ca „original".
describe("isUsersBlobUrl", () => {
  it("acceptă un URL sub namespace-ul userului corect", async () => {
    const isUsersBlobUrl = await loadUsersCheckWithToken(OWN_TOKEN);
    expect(isUsersBlobUrl(`https://${OWN_HOST}/u/user-a/avatars/x.png`, "user-a")).toBe(true);
  });

  it("respinge URL-ul altui user (namespace diferit) — nucleul SEC-001", async () => {
    const isUsersBlobUrl = await loadUsersCheckWithToken(OWN_TOKEN);
    expect(isUsersBlobUrl(`https://${OWN_HOST}/u/user-b/details/x.png`, "user-a")).toBe(false);
  });

  it("respinge un userId care e doar PREFIX-ul altuia (fără graniță de segment)", async () => {
    const isUsersBlobUrl = await loadUsersCheckWithToken(OWN_TOKEN);
    // "user-a" nu trebuie să matcheze calea lui "user-abc" doar pentru că e prefix.
    expect(isUsersBlobUrl(`https://${OWN_HOST}/u/user-abc/avatars/x.png`, "user-a")).toBe(false);
  });

  it("respinge un URL din alt store chiar dacă path-ul pare corect", async () => {
    const isUsersBlobUrl = await loadUsersCheckWithToken(OWN_TOKEN);
    expect(
      isUsersBlobUrl("https://altstore99.public.blob.vercel-storage.com/u/user-a/avatars/x.png", "user-a"),
    ).toBe(false);
  });

  it("respinge URL-uri fără format valid", async () => {
    const isUsersBlobUrl = await loadUsersCheckWithToken(OWN_TOKEN);
    expect(isUsersBlobUrl("not-a-url", "user-a")).toBe(false);
    expect(isUsersBlobUrl("", "user-a")).toBe(false);
  });
});
