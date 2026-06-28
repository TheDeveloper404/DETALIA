// Email transacțional via Resend REST. Best-effort: dacă lipsesc AUTH_RESEND_KEY / EMAIL_FROM,
// devine no-op (întoarce false) — nu blocăm fluxul (notificarea in-app rămâne sursa principală).
// Securitate: NU logăm conținutul/destinatarul (PII). Doar metadate, dacă e nevoie.

// ── Template brand DETALIA (email-safe: inline CSS, fără fonturi externe) ─────────────────────────
// Shell reutilizabil: header cu wordmark, card, conținut, footer. Folosit de magic link + notificări.
const BRAND = {
  bg: "#faf8f4",
  card: "#ffffff",
  border: "#e3ddd2",
  text: "#211d18",
  muted: "#5d564c",
  accent: "#a9573a",
};

export function emailLayout(contentHtml: string): string {
  return `<!doctype html>
<html lang="ro"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"></head>
<body style="margin:0;padding:0;background:${BRAND.bg};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.bg};">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;font-family:Arial,Helvetica,sans-serif;">
        <tr><td style="padding:0 4px 18px;">
          <span style="display:inline-block;width:9px;height:9px;background:${BRAND.accent};transform:rotate(45deg);vertical-align:middle;"></span>
          <span style="font-weight:800;letter-spacing:.2em;font-size:16px;color:${BRAND.text};vertical-align:middle;margin-left:9px;">DETALIA</span>
        </td></tr>
        <tr><td style="background:${BRAND.card};border:1px solid ${BRAND.border};border-radius:14px;padding:30px 28px;">
          ${contentHtml}
        </td></tr>
        <tr><td style="padding:18px 4px 0;font-size:12px;line-height:1.5;color:${BRAND.muted};">
          DETALIA — comunitatea detaliilor de execuție.<br>
          Dacă nu ai cerut acest email, poți să-l ignori.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

// Email-ul de magic link (autentificare passwordless). `ttlMinutes` din env (Auth.js).
export function magicLinkEmailHtml(url: string, ttlMinutes: number): string {
  return emailLayout(`
    <h1 style="margin:0 0 12px;font-size:22px;line-height:1.25;color:${BRAND.text};">Autentificare în DETALIA</h1>
    <p style="margin:0 0 22px;font-size:15px;line-height:1.55;color:${BRAND.muted};">
      Apasă butonul de mai jos ca să te conectezi. Linkul e valabil ${ttlMinutes} de minute și poate fi folosit o singură dată.
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0"><tr>
      <td style="border-radius:10px;background:${BRAND.accent};">
        <a href="${url}" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;">
          Conectează-te
        </a>
      </td>
    </tr></table>
    <p style="margin:22px 0 0;font-size:12.5px;line-height:1.5;color:${BRAND.muted};">
      Dacă butonul nu merge, copiază acest link în browser:<br>
      <a href="${url}" style="color:${BRAND.accent};word-break:break-all;">${url}</a>
    </p>
  `);
}

export function magicLinkEmailText(url: string, ttlMinutes: number): string {
  return `Autentificare în DETALIA\n\nDeschide linkul pentru a te conecta (valabil ${ttlMinutes} de minute, o singură utilizare):\n${url}\n\nDacă nu ai cerut acest email, ignoră-l.`;
}

export async function sendEmail(input: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<boolean> {
  const key = process.env.AUTH_RESEND_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from) {
    // Misconfigurare (chei de mediu lipsă) → vizibil în loguri, nu tăcut. Fără PII.
    console.warn("Resend: chei de mediu absente — mesajul NU se trimite.");
    return false;
  }

  // Mesajul e secundar (notificarea in-app rămâne) → NU aruncăm, dar LOGĂM eșecurile (fără PII: niciun
  // destinatar/subiect în loguri) ca să fie observabile (Resend down, cheie greșită, domeniu neverificat etc.).
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: input.to,
        subject: input.subject,
        html: input.html,
        ...(input.text ? { text: input.text } : {}),
      }),
    });
    if (!res.ok) console.error("Resend: trimitere respinsă, status", res.status);
    return res.ok;
  } catch (err) {
    console.error("Resend: eroare de rețea la trimitere:", err instanceof Error ? err.message : String(err));
    return false;
  }
}
