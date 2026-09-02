"use server";

import { redirect } from "next/navigation";

import {
  getAdminPendingSession,
  promoteAdminPendingSession,
  registerFailedTotpAttempt,
} from "@/lib/admin-auth";
import { audit } from "@/lib/audit";
import { checkLimit, clientIp, hashAuditId, limiters } from "@/lib/rate-limit";
import {
  confirmAdminTotpEnrollment,
  verifyAdminSecondFactor,
} from "@/server/services/adminTotpService";

export type TotpState = {
  error: string | null;
  /** Codurile de rezervă, întoarse O SINGURĂ dată, imediat după înrolare. */
  backupCodes: string[] | null;
};

export const INITIAL_TOTP_STATE: TotpState = { error: null, backupCodes: null };

// Mesaj UNIC pentru orice cod respins — greșit, expirat, reluat sau cod de rezervă deja consumat.
// Un mesaj diferențiat ar spune atacatorului dacă a nimerit formatul sau fereastra de timp.
const GENERIC = "Cod invalid. Încearcă din nou cu codul curent din aplicație.";

// Poartă comună celor două acțiuni: sesiune intermediară validă + cotă. Sesiunea intermediară e
// RE-VERIFICATĂ aici, nu doar în `proxy.ts` — o server action e un endpoint POST propriu, apelabil
// direct, care nu trece prin randarea paginii.
async function guard(): Promise<
  { ok: true; email: string; ip: string } | { ok: false; state: TotpState }
> {
  const pending = await getAdminPendingSession();
  // Fără sesiune intermediară nu există nimic de verificat — înapoi la primul factor.
  if (!pending) redirect("/admin-page/login?error=expired");

  const ip = await clientIp();
  const [byUser, byIp] = await Promise.all([
    checkLimit(limiters.adminTotpPerUser, hashAuditId(pending.email)),
    checkLimit(limiters.adminTotpPerIp, ip),
  ]);
  if (!byUser.ok || !byIp.ok) {
    return {
      ok: false,
      state: { error: "Prea multe încercări. Așteaptă câteva minute.", backupCodes: null },
    };
  }
  return { ok: true, email: pending.email, ip };
}

// Consumă o încercare greșită. Peste prag sesiunea intermediară moare și adminul o ia de la magic link.
async function penalize(email: string): Promise<TotpState> {
  const remaining = await registerFailedTotpAttempt();
  if (remaining <= 0) {
    audit("admin_totp_locked", { emailHash: hashAuditId(email) }, "warning");
    redirect("/admin-page/login?error=locked");
  }
  return { error: `${GENERIC} (${remaining} încercări rămase)`, backupCodes: null };
}

// ── Înrolare: adminul demonstrează un cod din authenticator, TOTP-ul devine al doilea factor. ──
// NU promovează sesiunea: după înrolare arătăm codurile de rezervă, iar intrarea în panou se face
// explicit, din butonul de confirmare (`finishAdminTotpEnrollmentAction`).
export async function confirmEnrollmentAction(
  _prev: TotpState,
  formData: FormData,
): Promise<TotpState> {
  const gate = await guard();
  if (!gate.ok) return gate.state;

  const code = String(formData.get("code") ?? "");
  const result = await confirmAdminTotpEnrollment(gate.email, code);

  if (!result.ok) {
    if (result.reason === "bad_code") return penalize(gate.email);
    if (result.reason === "no_key") {
      return { error: "Al doilea factor nu e configurat pe server. Contactează administratorul.", backupCodes: null };
    }
    // `already_enabled` / `not_started` / `corrupt_secret`: starea din DB nu mai corespunde ecranului
    // afișat. Reîncărcarea paginii recalculează fluxul corect (înrolare vs verificare).
    return { error: "Starea înrolării s-a schimbat. Reîncarcă pagina.", backupCodes: null };
  }

  return { error: null, backupCodes: result.backupCodes };
}

// Adminul a notat codurile de rezervă → promovăm sesiunea intermediară în una completă.
export async function finishAdminTotpEnrollmentAction(): Promise<void> {
  const pending = await getAdminPendingSession();
  if (!pending) redirect("/admin-page/login?error=expired");

  const email = await promoteAdminPendingSession();
  if (!email) redirect("/admin-page/login?error=expired");
  audit("admin_login_success", { stage: "totp_enrolled", emailHash: hashAuditId(email) }, "info");
  redirect("/admin-page");
}

// ── Login: al doilea factor pentru un TOTP deja activ (cod din aplicație SAU cod de rezervă). ──
export async function verifySecondFactorAction(
  _prev: TotpState,
  formData: FormData,
): Promise<TotpState> {
  const gate = await guard();
  if (!gate.ok) return gate.state;

  const code = String(formData.get("code") ?? "");
  const result = await verifyAdminSecondFactor(gate.email, code);

  if (!result.ok) {
    if (result.reason === "bad_code") return penalize(gate.email);
    if (result.reason === "not_enabled") {
      // TOTP-ul a fost resetat între timp → ecranul corect e cel de înrolare.
      return { error: "Al doilea factor a fost resetat. Reîncarcă pagina.", backupCodes: null };
    }
    return { error: "Al doilea factor nu e disponibil pe server. Contactează administratorul.", backupCodes: null };
  }

  const email = await promoteAdminPendingSession();
  // Codul a fost consumat (contor ars / cod de rezervă șters), dar sesiunea intermediară a expirat
  // între timp. Nu creăm sesiune fără pending valid — adminul reia de la magic link.
  if (!email) redirect("/admin-page/login?error=expired");

  audit(
    "admin_login_success",
    { stage: "totp_verified", backupCode: result.usedBackupCode, emailHash: hashAuditId(email) },
    "info",
  );
  redirect("/admin-page");
}
