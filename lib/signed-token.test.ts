import { randomBytes } from "node:crypto";

import { beforeAll, describe, expect, it } from "vitest";

import { createSignedToken, verifySignedToken } from "./signed-token";

const UUID = "11111111-1111-4111-8111-111111111111";
const P = "digest-unsubscribe";

beforeAll(() => {
  // Cheie de test generată local, nu un secret real — `signed-token` derivă din `AUTH_SECRET`.
  process.env.AUTH_SECRET = randomBytes(24).toString("hex");
});

describe("signed-token", () => {
  it("round-trip: verifică valoarea semnată cu același scop", () => {
    const token = createSignedToken(P, UUID);
    expect(verifySignedToken(P, token)).toBe(UUID);
  });

  it("token modificat (semnătură) → null", () => {
    const token = createSignedToken(P, UUID);
    const broken = token.slice(0, -2) + (token.endsWith("aa") ? "bb" : "aa");
    expect(verifySignedToken(P, broken)).toBeNull();
  });

  it("issuedAt modificat → null (nu mai corespunde semnăturii)", () => {
    const [value, , sig] = createSignedToken(P, UUID).split(".");
    expect(verifySignedToken(P, `${value}.${Date.now() - 1000}.${sig}`)).toBeNull();
  });

  it("scop diferit → null (domain separation)", () => {
    const token = createSignedToken(P, UUID);
    expect(verifySignedToken("alt-scop", token)).toBeNull();
  });

  it("token malformat (nr. greșit de segmente) → null", () => {
    expect(verifySignedToken(P, "fara-puncte")).toBeNull();
    expect(verifySignedToken(P, "a.b")).toBeNull();
    expect(verifySignedToken(P, "")).toBeNull();
  });

  it("token mai vechi decât maxAgeMs → null", () => {
    const token = createSignedToken(P, UUID);
    expect(verifySignedToken(P, token, 60_000)).toBe(UUID); // proaspăt, sub prag
    expect(verifySignedToken(P, token, -1)).toBeNull(); // orice vârstă > prag
  });
});
