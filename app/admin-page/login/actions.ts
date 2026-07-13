"use server";

import { createAdminLoginUrl, adminLinkTtlMinutes, isAdminEmail } from "@/lib/admin-auth";
import { audit } from "@/lib/audit";
import { adminLoginEmailHtml, adminLoginEmailText, sendEmail } from "@/lib/email";
import { checkLimit, clientIp, hashAuditId, limiters } from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/turnstile";

export type AdminLoginState = { sent: boolean; error: string | null };

// Cere magic link de admin. Enforce pe SERVER. Anti-enumerare: răspuns IDENTIC indiferent dacă emailul
// e sau nu admin (linkul se trimite DOAR dacă e în allowlist). Rate-limit pe email + IP.
export async function requestAdminLinkAction(
  _prev: AdminLoginState,
  formData: FormData,
): Promise<AdminLoginState> {
  const email = ((formData.get("email") as string | null) ?? "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return { sent: false, error: "Introdu un email valid." };
  }

  const ip = await clientIp();
  const [byUser, byIp] = await Promise.all([
    checkLimit(limiters.adminLoginPerUser, email),
    checkLimit(limiters.adminLoginPerIp, ip),
  ]);
  if (!byUser.ok || !byIp.ok) {
    return { sent: false, error: "Prea multe încercări. Așteaptă câteva minute." };
  }

  // Anti-bot: validăm tokenul Turnstile la Cloudflare ÎNAINTE de ramura isAdminEmail — răspuns generic,
  // fără a scurge dacă emailul e admin. No-op fără chei (dev). La eșec: mesaj generic, fără a atinge Resend.
  const captcha = String(formData.get("cf-turnstile-response") ?? "") || null;
  if (!(await verifyTurnstile(captcha, ip))) {
    return { sent: false, error: "Verificarea anti-bot a eșuat. Reîncarcă pagina și încearcă din nou." };
  }

  if (isAdminEmail(email)) {
    // SEC-004: NU folosim Host header ca fallback (client/edge-controlled pe preview → un admin ar putea
    // autentifica pe deploy-ul greșit). Singurul fallback sigur e localhost, la fel ca în lib/auth.ts.
    const origin = process.env.AUTH_URL ?? "http://localhost:3000";
    const url = await createAdminLoginUrl(email, origin);
    const ttl = adminLinkTtlMinutes();
    await sendEmail({
      to: email,
      subject: "Acces administrare DETALIA",
      html: adminLoginEmailHtml(url, ttl),
      text: adminLoginEmailText(url, ttl),
    });
    audit("admin_login_success", { stage: "link_sent", emailHash: hashAuditId(email) }, "info");
  } else {
    // Email care nu e admin a cerut acces — semnal, dar răspuns identic (fără enumerare).
    audit("admin_login_failed", { ipHash: hashAuditId(ip), emailHash: hashAuditId(email) }, "warning");
  }

  // Mesaj GENERIC mereu — nu dezvăluim dacă emailul e admin.
  return { sent: true, error: null };
}
