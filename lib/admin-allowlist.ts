// Allowlist de admini — modul EDGE-SAFE (fără node:crypto, fără next/headers) ca să poată fi importat
// și în proxy (middleware edge), și în lib/admin-auth.ts. CINE e admin = `ADMIN_EMAILS` (env).
// Deny-by-default: env gol → niciun admin.
export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return adminEmails().includes(email.trim().toLowerCase());
}
