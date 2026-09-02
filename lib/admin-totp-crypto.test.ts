import { randomBytes } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  adminTotpKey,
  decryptTotpSecret,
  encryptTotpSecret,
  parseTotpKey,
} from "@/lib/admin-totp-crypto";

const KEY = randomBytes(32);
// Fixture generat local, nu un secret real — vezi de ce e nevoie de unul deloc mai jos.
const SECRET = randomBytes(20).toString("hex");

describe("parseTotpKey", () => {
  it("acceptă exact 32 de octeți în hex", () => {
    const hex = KEY.toString("hex");
    expect(parseTotpKey(hex)?.equals(KEY)).toBe(true);
    expect(parseTotpKey(` ${hex} `)?.equals(KEY)).toBe(true);
  });

  it("respinge orice altceva — fără cheie 'aproape bună'", () => {
    expect(parseTotpKey(undefined)).toBeNull();
    expect(parseTotpKey("")).toBeNull();
    expect(parseTotpKey(randomBytes(31).toString("hex"))).toBeNull(); // prea scurtă
    expect(parseTotpKey(randomBytes(33).toString("hex"))).toBeNull(); // prea lungă
    expect(parseTotpKey("nu-e-hex-".repeat(8))).toBeNull();
    expect(parseTotpKey("z".repeat(64))).toBeNull();
  });
});

describe("adminTotpKey", () => {
  it("întoarce null când env-ul lipsește sau e invalid — fail-closed la apelant", () => {
    const prev = process.env.ADMIN_TOTP_ENCRYPTION_KEY;
    try {
      delete process.env.ADMIN_TOTP_ENCRYPTION_KEY;
      expect(adminTotpKey()).toBeNull();
      process.env.ADMIN_TOTP_ENCRYPTION_KEY = "prea-scurt";
      expect(adminTotpKey()).toBeNull();
      process.env.ADMIN_TOTP_ENCRYPTION_KEY = KEY.toString("hex");
      expect(adminTotpKey()?.equals(KEY)).toBe(true);
    } finally {
      if (prev === undefined) delete process.env.ADMIN_TOTP_ENCRYPTION_KEY;
      else process.env.ADMIN_TOTP_ENCRYPTION_KEY = prev;
    }
  });
});

describe("encrypt/decrypt", () => {
  it("face round-trip", () => {
    expect(decryptTotpSecret(encryptTotpSecret(SECRET, KEY), KEY)).toBe(SECRET);
  });

  it("folosește un IV nou la fiecare criptare (două ciphertext-uri diferite pt același secret)", () => {
    const a = encryptTotpSecret(SECRET, KEY);
    const b = encryptTotpSecret(SECRET, KEY);
    expect(a).not.toBe(b);
    expect(a.split(":")[0]).not.toBe(b.split(":")[0]);
    expect(decryptTotpSecret(a, KEY)).toBe(SECRET);
    expect(decryptTotpSecret(b, KEY)).toBe(SECRET);
  });

  it("respinge o cheie greșită", () => {
    expect(decryptTotpSecret(encryptTotpSecret(SECRET, KEY), randomBytes(32))).toBeNull();
  });

  it("respinge ciphertext alterat (GCM autentifică — nu întoarce tăcut un secret greșit)", () => {
    const [iv, tag, data] = encryptTotpSecret(SECRET, KEY).split(":");
    const flipped = (data[0] === "a" ? "b" : "a") + data.slice(1);
    expect(decryptTotpSecret([iv, tag, flipped].join(":"), KEY)).toBeNull();
  });

  it("respinge authTag alterat", () => {
    const [iv, tag, data] = encryptTotpSecret(SECRET, KEY).split(":");
    const flipped = (tag[0] === "a" ? "b" : "a") + tag.slice(1);
    expect(decryptTotpSecret([iv, flipped, data].join(":"), KEY)).toBeNull();
  });

  it("respinge formate stricate fără să arunce", () => {
    for (const bad of ["", ":", "a:b", "a:b:c:d", "zz:zz:zz", "aa:bb:cc"]) {
      expect(() => decryptTotpSecret(bad, KEY)).not.toThrow();
      expect(decryptTotpSecret(bad, KEY)).toBeNull();
    }
  });
});
