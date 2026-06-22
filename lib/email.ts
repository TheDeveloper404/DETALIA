// Email transacțional via Resend REST. Best-effort: dacă lipsesc AUTH_RESEND_KEY / EMAIL_FROM,
// devine no-op (întoarce false) — nu blocăm fluxul (notificarea in-app rămâne sursa principală).
// Securitate: NU logăm conținutul/destinatarul (PII). Doar metadate, dacă e nevoie.

export async function sendEmail(input: {
  to: string;
  subject: string;
  html: string;
}): Promise<boolean> {
  const key = process.env.AUTH_RESEND_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from) return false;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to: input.to, subject: input.subject, html: input.html }),
    });
    return res.ok;
  } catch {
    // Înghițim eroarea intenționat — emailul e secundar față de notificarea in-app.
    return false;
  }
}
