import { describe, expect, it } from "vitest";

import {
  BACKUP_CODE_COUNT,
  TOTP_PERIOD_SECONDS,
  buildTotp,
  generateBackupCode,
  generateBackupCodes,
  generateTotpSecretBase32,
  hashBackupCode,
  isValidBackupCodeFormat,
  isValidTotpCodeFormat,
  normalizeBackupCode,
  normalizeTotpCode,
  totpEnrollmentUri,
  verifyTotpCode,
} from "@/server/domain/adminTotp";

const SECRET = generateTotpSecretBase32();
const T0 = 1_800_000_000_000; // moment fix, ca testele să nu depindă de ceasul real
const STEP_MS = TOTP_PERIOD_SECONDS * 1000;

function codeAt(timestamp: number, secret = SECRET): string {
  return buildTotp("admin", secret).generate({ timestamp });
}
function counterAt(timestamp: number): number {
  return buildTotp("admin", SECRET).counter({ timestamp });
}

describe("secret + URI de înrolare", () => {
  it("generează secrete base32 de 160 de biți, distincte", () => {
    const a = generateTotpSecretBase32();
    const b = generateTotpSecretBase32();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Z2-7]{32}$/); // 20 octeți → 32 caractere base32
  });

  it("produce un URI otpauth cu parametrii aliniați la ce implementează authenticatoarele", () => {
    const uri = totpEnrollmentUri("admin@detalia.ro", SECRET);
    expect(uri.startsWith("otpauth://totp/")).toBe(true);
    expect(uri).toContain(`secret=${SECRET}`);
    expect(uri).toContain("algorithm=SHA1");
    expect(uri).toContain("digits=6");
    expect(uri).toContain("period=30");
    expect(uri).toContain("issuer=DETALIA%20Admin");
    expect(uri).toContain("admin%40detalia.ro"); // emailul = eticheta contului
  });
});

describe("verifyTotpCode", () => {
  it("acceptă codul curent și întoarce contorul lui", () => {
    const res = verifyTotpCode({
      secretBase32: SECRET,
      code: codeAt(T0),
      lastCounter: null,
      timestamp: T0,
    });
    expect(res).toEqual({ ok: true, counter: counterAt(T0) });
  });

  it("tolerează derivă de ceas de ±1 pas, dar nu ±2", () => {
    for (const offset of [-STEP_MS, STEP_MS]) {
      expect(
        verifyTotpCode({
          secretBase32: SECRET,
          code: codeAt(T0 + offset),
          lastCounter: null,
          timestamp: T0,
        }).ok,
      ).toBe(true);
    }
    for (const offset of [-2 * STEP_MS, 2 * STEP_MS]) {
      expect(
        verifyTotpCode({
          secretBase32: SECRET,
          code: codeAt(T0 + offset),
          lastCounter: null,
          timestamp: T0,
        }),
      ).toEqual({ ok: false, reason: "invalid" });
    }
  });

  it("ANTI-REPLAY: același cod nu trece a doua oară în fereastra lui", () => {
    const code = codeAt(T0);
    const first = verifyTotpCode({ secretBase32: SECRET, code, lastCounter: null, timestamp: T0 });
    expect(first.ok).toBe(true);

    // A doua încercare, cu contorul deja consumat persistat — chiar în ACEEAȘI fereastră de 30s.
    const second = verifyTotpCode({
      secretBase32: SECRET,
      code,
      lastCounter: first.ok ? first.counter : null,
      timestamp: T0 + 1000,
    });
    expect(second).toEqual({ ok: false, reason: "replay" });
  });

  it("ANTI-REPLAY: arde și pasul anterior (cod expirat de timp, reluat cu delta -1)", () => {
    const consumed = counterAt(T0);
    expect(
      verifyTotpCode({
        secretBase32: SECRET,
        code: codeAt(T0),
        lastCounter: consumed,
        timestamp: T0 + STEP_MS, // codul e încă în fereastră (delta -1), dar contorul nu e mai mare
      }),
    ).toEqual({ ok: false, reason: "replay" });
  });

  it("acceptă pasul URMĂTOR după un cod consumat", () => {
    const consumed = counterAt(T0);
    const res = verifyTotpCode({
      secretBase32: SECRET,
      code: codeAt(T0 + STEP_MS),
      lastCounter: consumed,
      timestamp: T0 + STEP_MS,
    });
    expect(res).toEqual({ ok: true, counter: consumed + 1 });
  });

  it("respinge codul generat cu ALT secret", () => {
    expect(
      verifyTotpCode({
        secretBase32: SECRET,
        code: codeAt(T0, generateTotpSecretBase32()),
        lastCounter: null,
        timestamp: T0,
      }),
    ).toEqual({ ok: false, reason: "invalid" });
  });

  it("respinge formatele greșite înainte de orice calcul criptografic", () => {
    for (const bad of ["", "12345", "1234567", "abcdef", "12 34 56 78"]) {
      expect(verifyTotpCode({ secretBase32: SECRET, code: bad, lastCounter: null, timestamp: T0 })).toEqual(
        { ok: false, reason: "format" },
      );
    }
  });

  it("acceptă coduri tastate cu spații (normalizate), nu și cu cifre în plus", () => {
    const code = codeAt(T0);
    const spaced = `${code.slice(0, 3)} ${code.slice(3)}`;
    expect(normalizeTotpCode(spaced)).toBe(code);
    expect(verifyTotpCode({ secretBase32: SECRET, code: spaced, lastCounter: null, timestamp: T0 }).ok).toBe(
      true,
    );
    expect(isValidTotpCodeFormat(`${code}7`)).toBe(false);
  });
});

describe("coduri de rezervă", () => {
  it("generează 10 coduri distincte în format XXXXX-XXXXX", () => {
    const codes = generateBackupCodes();
    expect(codes).toHaveLength(BACKUP_CODE_COUNT);
    expect(new Set(codes).size).toBe(BACKUP_CODE_COUNT);
    for (const c of codes) {
      expect(c).toMatch(/^[0-9A-HJKMNP-TV-Z]{5}-[0-9A-HJKMNP-TV-Z]{5}$/);
      expect(isValidBackupCodeFormat(c)).toBe(true);
    }
  });

  it("nu conține caractere ambigue la citit de pe hârtie (I, L, O, U)", () => {
    const joined = generateBackupCodes(50).join("");
    for (const ambiguous of ["I", "L", "O", "U"]) expect(joined).not.toContain(ambiguous);
  });

  it("normalizează transcrierea umană: litere mici, spații, cratimă lipsă, I/L→1, O→0", () => {
    const code = generateBackupCode();
    const plain = code.replace("-", "");
    for (const variant of [code.toLowerCase(), plain, ` ${code} `, code.replace("-", " ")]) {
      expect(normalizeBackupCode(variant)).toBe(plain);
      expect(hashBackupCode(variant)).toBe(hashBackupCode(code));
    }
    expect(normalizeBackupCode("ilo12-34567")).toBe("1101234567"); // I→1, L→1, O→0, cratima ignorată
  });

  it("respinge lungimi greșite", () => {
    expect(isValidBackupCodeFormat("")).toBe(false);
    expect(isValidBackupCodeFormat("ABCDE-ABCD")).toBe(false);
    expect(isValidBackupCodeFormat("ABCDE-ABCDEF")).toBe(false);
  });

  it("hash-uiește stabil și diferit per cod", () => {
    const a = generateBackupCode();
    const b = generateBackupCode();
    expect(hashBackupCode(a)).toBe(hashBackupCode(a));
    expect(hashBackupCode(a)).not.toBe(hashBackupCode(b));
    expect(hashBackupCode(a)).toMatch(/^[0-9a-f]{64}$/);
  });
});
