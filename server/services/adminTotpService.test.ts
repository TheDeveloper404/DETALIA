import { randomBytes } from "node:crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

// Test de INTEGRARE pe SQL real (PGlite), nu pe repo mock-uit. Motivul e specific acestei feature:
// garanțiile care contează aici — anti-replay, one-time pe codurile de rezervă, refuzul de a suprascrie
// un TOTP deja activ — sunt exprimate ca CONDIȚII ÎN WHERE, nu ca `if`-uri în TypeScript. Un repo
// mock-uit ar întoarce mereu ce i-am spus noi și ar trece verde chiar dacă instrucțiunea SQL e greșită,
// adică exact bug-ul pe care testul îl caută.
vi.mock("@/db", async () => {
  const { createTestDb } = await import("@/db/test-db");
  const schema = await import("@/db/schema");
  const { db } = await createTestDb();
  return { db, schema };
});

const { db } = await import("@/db");
const { adminTotp } = await import("@/db/schema");

const { buildTotp, hashBackupCode, isValidBackupCodeFormat } = await import(
  "@/server/domain/adminTotp"
);
const { getAdminTotp } = await import("@/server/repos/adminTotpRepo");
const {
  beginAdminTotpEnrollment,
  confirmAdminTotpEnrollment,
  getAdminTotpStatus,
  resetAdminTotp,
  verifyAdminSecondFactor,
} = await import("@/server/services/adminTotpService");

const EMAIL = "admin@detalia.ro";
const KEY_HEX = randomBytes(32).toString("hex");

function currentCode(secretBase32: string, offsetMs = 0): string {
  return buildTotp("admin", secretBase32).generate({ timestamp: Date.now() + offsetMs });
}

// Codul pasului URMĂTOR (+30s). Confirmarea înrolării consumă codul curent, deci un login imediat după
// înrolare trebuie să folosească pasul următor — altfel e, pe bună dreptate, un replay. Rămâne în
// fereastra de toleranță (window=1), spre deosebire de +60s, care ar fi respins ca invalid.
function nextStepCode(secretBase32: string): string {
  return currentCode(secretBase32, 30_000);
}

// Duce un email prin tot fluxul de înrolare și întoarce ce ar avea adminul în mână după el.
async function enroll(email = EMAIL) {
  const start = await beginAdminTotpEnrollment(email);
  if (!start.ok) throw new Error(`înrolarea nu a pornit: ${start.reason}`);
  const confirmed = await confirmAdminTotpEnrollment(email, currentCode(start.secretBase32));
  if (!confirmed.ok) throw new Error(`înrolarea nu s-a confirmat: ${confirmed.reason}`);
  return { secretBase32: start.secretBase32, backupCodes: confirmed.backupCodes };
}

beforeEach(async () => {
  await db.delete(adminTotp);
  process.env.ADMIN_TOTP_ENCRYPTION_KEY = KEY_HEX;
});

describe("fail-closed fără cheia de criptare", () => {
  it("nu înrolează și nu verifică dacă ADMIN_TOTP_ENCRYPTION_KEY lipsește", async () => {
    await enroll();
    delete process.env.ADMIN_TOTP_ENCRYPTION_KEY;

    expect(await beginAdminTotpEnrollment(EMAIL)).toEqual({ ok: false, reason: "no_key" });
    expect(await verifyAdminSecondFactor(EMAIL, "123456")).toEqual({ ok: false, reason: "no_key" });
    expect((await getAdminTotpStatus(EMAIL)).keyConfigured).toBe(false);
  });
});

describe("înrolare", () => {
  it("stochează secretul CRIPTAT — un dump al tabelului nu conține secretul în clar", async () => {
    const { secretBase32 } = await enroll();
    const [row] = await db.select().from(adminTotp);
    expect(row.secretEncrypted).not.toContain(secretBase32);
    expect(row.secretEncrypted).toMatch(/^[0-9a-f]+:[0-9a-f]{32}:[0-9a-f]+$/);
  });

  it("nu e al doilea factor până la confirmare — un cod greșit lasă TOTP-ul inactiv", async () => {
    const start = await beginAdminTotpEnrollment(EMAIL);
    expect(start.ok).toBe(true);
    expect((await getAdminTotpStatus(EMAIL)).enabled).toBe(false);

    expect(await confirmAdminTotpEnrollment(EMAIL, "000000")).toEqual({
      ok: false,
      reason: "bad_code",
    });
    expect((await getAdminTotpStatus(EMAIL)).enabled).toBe(false);
  });

  it("reia aceeași înrolare la reîncărcarea paginii — QR-ul deja scanat rămâne valabil", async () => {
    const first = await beginAdminTotpEnrollment(EMAIL);
    const second = await beginAdminTotpEnrollment(EMAIL);
    expect(first.ok && second.ok && first.secretBase32 === second.secretBase32).toBe(true);
  });

  it("REFUZĂ suprascrierea unui TOTP deja activ — altfel al doilea factor s-ar reseta la fiecare login", async () => {
    const { secretBase32 } = await enroll();

    expect(await beginAdminTotpEnrollment(EMAIL)).toEqual({ ok: false, reason: "already_enabled" });

    // Secretul din DB e neatins: codul vechi funcționează în continuare.
    const row = await getAdminTotp(EMAIL);
    expect(row?.enabled).toBe(true);
    expect((await verifyAdminSecondFactor(EMAIL, nextStepCode(secretBase32))).ok).toBe(true);
  });

  it("un al doilea submit de confirmare nu regenerează codurile de rezervă deja afișate", async () => {
    const { secretBase32, backupCodes } = await enroll();
    const again = await confirmAdminTotpEnrollment(EMAIL, nextStepCode(secretBase32));
    expect(again).toEqual({ ok: false, reason: "already_enabled" });

    // Setul afișat prima dată e cel care a rămas în DB.
    const row = await getAdminTotp(EMAIL);
    expect(row?.backupCodesHash).toEqual(backupCodes.map(hashBackupCode));
  });

  it("emite 10 coduri de rezervă, stocate DOAR ca hash", async () => {
    const { backupCodes } = await enroll();
    const row = await getAdminTotp(EMAIL);
    expect(backupCodes).toHaveLength(10);
    expect(row?.backupCodesHash).toHaveLength(10);
    for (const code of backupCodes) {
      expect(row?.backupCodesHash).not.toContain(code);
      expect(row?.backupCodesHash).toContain(hashBackupCode(code));
    }
  });
});

describe("verificare la login", () => {
  it("acceptă un cod valid, nefolosit", async () => {
    const { secretBase32 } = await enroll();
    expect(await verifyAdminSecondFactor(EMAIL, nextStepCode(secretBase32))).toEqual({
      ok: true,
      usedBackupCode: false,
      backupCodesRemaining: 10,
    });
  });

  it("codul consumat la ÎNROLARE nu mai poate fi refolosit la login", async () => {
    const { secretBase32 } = await enroll();
    expect(await verifyAdminSecondFactor(EMAIL, currentCode(secretBase32))).toEqual({
      ok: false,
      reason: "bad_code",
    });
  });

  it("ANTI-REPLAY: același cod, de două ori, în aceeași fereastră de 30s → respins", async () => {
    const { secretBase32 } = await enroll();
    const code = nextStepCode(secretBase32);

    expect((await verifyAdminSecondFactor(EMAIL, code)).ok).toBe(true);
    expect(await verifyAdminSecondFactor(EMAIL, code)).toEqual({ ok: false, reason: "bad_code" });
  });

  it("ANTI-REPLAY e enforce-uit în DB, nu doar în TypeScript (contorul rămâne ars după verificare)", async () => {
    const { secretBase32 } = await enroll();
    await verifyAdminSecondFactor(EMAIL, nextStepCode(secretBase32));

    const burned = (await getAdminTotp(EMAIL))?.lastCounter;
    expect(burned).not.toBeNull();

    // Rejucăm exact scenariul de cursă: rescriem `last_counter` la valoarea DE DINAINTE (ca și cum a
    // doua cerere concurentă ar fi citit starea veche) și verificăm că UPDATE-ul cu condiție refuză.
    const { consumeTotpCounter } = await import("@/server/repos/adminTotpRepo");
    expect(await consumeTotpCounter(EMAIL, burned!)).toBe(false);
    expect(await consumeTotpCounter(EMAIL, burned! - 1)).toBe(false);
    expect(await consumeTotpCounter(EMAIL, burned! + 1)).toBe(true);
  });

  it("respinge codul generat cu alt secret", async () => {
    await enroll();
    const other = await beginAdminTotpEnrollment("altcineva@detalia.ro");
    if (!other.ok) throw new Error("setup");
    expect(await verifyAdminSecondFactor(EMAIL, currentCode(other.secretBase32))).toEqual({
      ok: false,
      reason: "bad_code",
    });
  });

  it("refuză orice cod pentru un email fără TOTP activ", async () => {
    expect(await verifyAdminSecondFactor("necunoscut@detalia.ro", "123456")).toEqual({
      ok: false,
      reason: "not_enabled",
    });
  });
});

describe("coduri de rezervă", () => {
  it("un cod de rezervă intră o SINGURĂ dată", async () => {
    const { backupCodes } = await enroll();
    const code = backupCodes[0];

    expect(await verifyAdminSecondFactor(EMAIL, code)).toEqual({
      ok: true,
      usedBackupCode: true,
      backupCodesRemaining: 9,
    });
    expect(await verifyAdminSecondFactor(EMAIL, code)).toEqual({ ok: false, reason: "bad_code" });
  });

  it("consumă doar codul folosit, nu întregul set", async () => {
    const { backupCodes } = await enroll();
    await verifyAdminSecondFactor(EMAIL, backupCodes[0]);

    const row = await getAdminTotp(EMAIL);
    expect(row?.backupCodesHash).not.toContain(hashBackupCode(backupCodes[0]));
    for (const rest of backupCodes.slice(1)) {
      expect(row?.backupCodesHash).toContain(hashBackupCode(rest));
    }
  });

  it("acceptă codul transcris cu litere mici și fără cratimă", async () => {
    const { backupCodes } = await enroll();
    const typed = backupCodes[0].toLowerCase().replace("-", "");
    expect((await verifyAdminSecondFactor(EMAIL, typed)).ok).toBe(true);
  });

  it("un TOTP tastat greșit NU consumă un cod de rezervă", async () => {
    const { backupCodes } = await enroll();
    expect(isValidBackupCodeFormat("000000")).toBe(false); // 6 cifre nu e format de cod de rezervă

    await verifyAdminSecondFactor(EMAIL, "000000");
    const row = await getAdminTotp(EMAIL);
    expect(row?.backupCodesHash).toHaveLength(backupCodes.length);
  });

  it("un cod de rezervă inventat, cu format corect, e respins", async () => {
    await enroll();
    expect(await verifyAdminSecondFactor(EMAIL, "ABCDE-FGHJK")).toEqual({
      ok: false,
      reason: "bad_code",
    });
  });
});

describe("reset", () => {
  it("șterge complet al doilea factor și permite o înrolare nouă, cu secret diferit", async () => {
    const { secretBase32 } = await enroll();
    await resetAdminTotp(EMAIL);

    expect(await getAdminTotp(EMAIL)).toBeNull();
    expect((await getAdminTotpStatus(EMAIL)).enabled).toBe(false);

    const restart = await beginAdminTotpEnrollment(EMAIL);
    expect(restart.ok && restart.secretBase32 !== secretBase32).toBe(true);
  });

  it("codurile de rezervă vechi nu mai funcționează după reset", async () => {
    const { backupCodes } = await enroll();
    await resetAdminTotp(EMAIL);
    await beginAdminTotpEnrollment(EMAIL);

    expect(await verifyAdminSecondFactor(EMAIL, backupCodes[0])).toEqual({
      ok: false,
      reason: "not_enabled",
    });
  });
});
