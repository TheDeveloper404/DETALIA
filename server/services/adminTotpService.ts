// Orchestrarea celui de-al doilea factor de admin (SEC-P02). Straturile de sub el rămân pure:
// `server/domain/adminTotp.ts` (reguli), `server/repos/adminTotpRepo.ts` (SQL), `lib/admin-totp-crypto.ts`
// (chei). Aici stă DOAR decizia: ce se întâmplă, în ce ordine, cu ce audit.
//
// Serviciul NU citește cookies și NU redirectează — primește emailul deja stabilit de apelant (server
// action, dintr-o sesiune intermediară validată). Așa rămâne testabil fără infrastructură Next.
import { encode } from "uqr";

import { adminTotpKey, decryptTotpSecret, encryptTotpSecret } from "@/lib/admin-totp-crypto";
import { audit } from "@/lib/audit";
import { hashAuditId } from "@/lib/rate-limit";
import {
  BACKUP_CODE_COUNT,
  generateBackupCodes,
  generateTotpSecretBase32,
  hashBackupCode,
  isValidBackupCodeFormat,
  totpEnrollmentUri,
  verifyTotpCode,
} from "@/server/domain/adminTotp";
import {
  consumeBackupCode,
  consumeTotpCounter,
  deleteAdminTotp,
  enableAdminTotp,
  getAdminTotp,
  startAdminTotpEnrollment,
} from "@/server/repos/adminTotpRepo";

export type AdminTotpStatus = {
  /** Al doilea factor e activ pentru acest email. */
  enabled: boolean;
  /** `ADMIN_TOTP_ENCRYPTION_KEY` e configurată. Fals ⇒ nici înrolare, nici verificare (fail-closed). */
  keyConfigured: boolean;
  backupCodesRemaining: number;
};

export async function getAdminTotpStatus(email: string): Promise<AdminTotpStatus> {
  const row = await getAdminTotp(email);
  return {
    enabled: row?.enabled ?? false,
    keyConfigured: adminTotpKey() !== null,
    backupCodesRemaining: row?.backupCodesHash.length ?? 0,
  };
}

export type EnrollmentStart =
  | { ok: true; secretBase32: string; uri: string; qr: QrMatrix }
  | { ok: false; reason: "no_key" | "already_enabled" };

// Matricea brută a codului QR (true = modul negru). O întoarcem ca DATE, nu ca SVG gata făcut: pagina
// o randează cu JSX, deci nu există nicio bucată de HTML injectată cu `dangerouslySetInnerHTML`.
// Tip serializabil — trece curat granița Server Component → Client Component.
export type QrMatrix = { size: number; modules: boolean[][] };

// Pornește (sau REIA) înrolarea.
//
// Reluarea contează: pagina de înrolare se poate reîncărca, iar un secret nou la fiecare randare ar
// invalida QR-ul deja scanat — adminul ar introduce coduri corecte pentru secretul vechi și ar fi
// respins la nesfârșit, fără nicio indicație de ce. Deci: secret existent neactivat ⇒ îl refolosim.
export async function beginAdminTotpEnrollment(email: string): Promise<EnrollmentStart> {
  const key = adminTotpKey();
  if (!key) {
    audit("admin_totp_unavailable", { stage: "enrollment", emailHash: hashAuditId(email) }, "error");
    return { ok: false, reason: "no_key" };
  }

  const existing = await getAdminTotp(email);
  if (existing?.enabled) return { ok: false, reason: "already_enabled" };

  let secretBase32: string;
  if (existing) {
    // Secret nedecriptabil (cheie rotită fără migrare, rând alterat): pornim de la zero în loc să
    // blocăm adminul într-o înrolare imposibil de dus la capăt. Nu e o pierdere — nu era încă activ.
    secretBase32 = decryptTotpSecret(existing.secretEncrypted, key) ?? generateTotpSecretBase32();
  } else {
    secretBase32 = generateTotpSecretBase32();
  }

  // false = între citire și scriere altcineva a activat un TOTP pe acest email. Nu suprascriem.
  const stored = await startAdminTotpEnrollment(email, encryptTotpSecret(secretBase32, key));
  if (!stored) return { ok: false, reason: "already_enabled" };

  const uri = totpEnrollmentUri(email, secretBase32);
  const qr = encode(uri, { border: 1 });
  return { ok: true, secretBase32, uri, qr: { size: qr.size, modules: qr.data } };
}

export type EnrollmentConfirm =
  | { ok: true; backupCodes: string[] }
  | { ok: false; reason: "no_key" | "not_started" | "already_enabled" | "corrupt_secret" | "bad_code" };

// Confirmă înrolarea: adminul demonstrează un cod valid, abia apoi TOTP-ul devine al doilea factor.
// Codurile de rezervă se întorc o SINGURĂ dată — în DB rămân doar hash-urile.
export async function confirmAdminTotpEnrollment(
  email: string,
  code: string,
): Promise<EnrollmentConfirm> {
  const key = adminTotpKey();
  if (!key) return { ok: false, reason: "no_key" };

  const row = await getAdminTotp(email);
  if (!row) return { ok: false, reason: "not_started" };
  if (row.enabled) return { ok: false, reason: "already_enabled" };

  const secretBase32 = decryptTotpSecret(row.secretEncrypted, key);
  if (!secretBase32) return { ok: false, reason: "corrupt_secret" };

  const verification = verifyTotpCode({ secretBase32, code, lastCounter: row.lastCounter });
  if (!verification.ok) {
    audit(
      "admin_totp_failed",
      { stage: "enrollment", reason: verification.reason, emailHash: hashAuditId(email) },
      "warning",
    );
    return { ok: false, reason: "bad_code" };
  }

  const backupCodes = generateBackupCodes(BACKUP_CODE_COUNT);
  const activated = await enableAdminTotp(email, backupCodes.map(hashBackupCode), verification.counter);
  // false = un dublu-submit a activat deja. Nu regenerăm codurile de rezervă peste cele deja afișate.
  if (!activated) return { ok: false, reason: "already_enabled" };

  audit("admin_totp_enabled", { emailHash: hashAuditId(email) }, "warning");
  return { ok: true, backupCodes };
}

export type SecondFactorResult =
  | { ok: true; usedBackupCode: boolean; backupCodesRemaining: number }
  | { ok: false; reason: "no_key" | "not_enabled" | "corrupt_secret" | "bad_code" };

// Verifică al doilea factor la login. Acceptă fie un cod TOTP, fie un cod de rezervă — le distingem
// după FORMAT, nu încercându-le pe rând: un cod de rezervă nu are 6 cifre, iar o încercare pe ambele
// căi ar consuma tăcut un cod de rezervă pentru un TOTP tastat greșit.
export async function verifyAdminSecondFactor(email: string, code: string): Promise<SecondFactorResult> {
  const key = adminTotpKey();
  if (!key) {
    audit("admin_totp_unavailable", { stage: "login", emailHash: hashAuditId(email) }, "error");
    return { ok: false, reason: "no_key" };
  }

  const row = await getAdminTotp(email);
  if (!row?.enabled) return { ok: false, reason: "not_enabled" };

  if (isValidBackupCodeFormat(code)) {
    const consumed = await consumeBackupCode(email, hashBackupCode(code));
    if (!consumed) {
      audit(
        "admin_totp_failed",
        { stage: "login", reason: "backup_invalid", emailHash: hashAuditId(email) },
        "warning",
      );
      return { ok: false, reason: "bad_code" };
    }
    const remaining = (await getAdminTotp(email))?.backupCodesHash.length ?? 0;
    audit("admin_totp_backup_used", { remaining, emailHash: hashAuditId(email) }, "warning");
    return { ok: true, usedBackupCode: true, backupCodesRemaining: remaining };
  }

  const secretBase32 = decryptTotpSecret(row.secretEncrypted, key);
  if (!secretBase32) {
    audit(
      "admin_totp_unavailable",
      { stage: "login", reason: "corrupt_secret", emailHash: hashAuditId(email) },
      "error",
    );
    return { ok: false, reason: "corrupt_secret" };
  }

  const verification = verifyTotpCode({ secretBase32, code, lastCounter: row.lastCounter });
  // Chiar dacă verificarea de mai sus trece, DB-ul e arbitrul final pe anti-replay (vezi
  // `consumeTotpCounter`) — două cereri simultane cu ACELAȘI cod nu pot trece amândouă.
  if (!verification.ok || !(await consumeTotpCounter(email, verification.counter))) {
    audit(
      "admin_totp_failed",
      {
        stage: "login",
        reason: verification.ok ? "replay_race" : verification.reason,
        emailHash: hashAuditId(email),
      },
      "warning",
    );
    return { ok: false, reason: "bad_code" };
  }

  return { ok: true, usedBackupCode: false, backupCodesRemaining: row.backupCodesHash.length };
}

// Resetează al doilea factor (dispozitiv pierdut / rotire). Apelabil DOAR dintr-o sesiune de admin
// COMPLETĂ — la următorul login adminul reintră pe fluxul de înrolare.
export async function resetAdminTotp(email: string): Promise<void> {
  await deleteAdminTotp(email);
  audit("admin_totp_reset", { emailHash: hashAuditId(email) }, "warning");
}
