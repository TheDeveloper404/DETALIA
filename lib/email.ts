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

// `accent` opțional = suprascrie culoarea de brand (teracotă) doar pt acest email — folosit de
// emailul de admin, ca să se diferențieze vizual instant de emailurile normale (buton + badge).
// `badge` opțional = etichetă mică lângă wordmark (ex. „PANOU ADMIN").
export function emailLayout(
  contentHtml: string,
  options?: { accent?: string; badge?: string },
): string {
  const accent = options?.accent ?? BRAND.accent;
  return `<!doctype html>
<html lang="ro"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"></head>
<body style="margin:0;padding:0;background:${BRAND.bg};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.bg};">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;font-family:Arial,Helvetica,sans-serif;">
        <tr><td style="padding:0 4px 18px;">
          <span style="display:inline-block;width:9px;height:9px;background:${accent};transform:rotate(45deg);vertical-align:middle;"></span>
          <span style="font-weight:800;letter-spacing:.2em;font-size:16px;color:${BRAND.text};vertical-align:middle;margin-left:9px;">DETALIA</span>
          ${
            options?.badge
              ? `<span style="display:inline-block;vertical-align:middle;margin-left:10px;padding:3px 9px;border-radius:20px;background:${accent};color:#ffffff;font-size:10.5px;font-weight:700;letter-spacing:.08em;">${options.badge}</span>`
              : ""
          }
        </td></tr>
        <tr><td style="background:${BRAND.card};border:1px solid ${BRAND.border};border-top:3px solid ${accent};border-radius:14px;padding:30px 28px;">
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
    ${emailButton(url, "Conectează-te")}
    <p style="margin:22px 0 0;font-size:12.5px;line-height:1.5;color:${BRAND.muted};">
      Dacă butonul nu merge, copiază acest link în browser:<br>
      <a href="${esc(url)}" style="color:${BRAND.accent};word-break:break-all;">${esc(url)}</a>
    </p>
  `);
}

export function magicLinkEmailText(url: string, ttlMinutes: number): string {
  return `Autentificare în DETALIA\n\nDeschide linkul pentru a te conecta (valabil ${ttlMinutes} de minute, o singură utilizare):\n${url}\n\nDacă nu ai cerut acest email, ignoră-l.`;
}

// Escape HTML — valorile controlate de user (titlu, nume) NU intră brut în email (anti-XSS).
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Subiect = text simplu: fără HTML, dar curățăm newline-urile (anti header-injection).
export function plainSubject(s: string): string {
  return s.replace(/[\r\n]+/g, " ").trim();
}

function emailButton(url: string, label: string, accent: string = BRAND.accent): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0"><tr>
      <td style="border-radius:10px;background:${accent};">
        <a href="${esc(url)}" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;">
          ${esc(label)}
        </a>
      </td>
    </tr></table>`;
}

// Culoare distinctă pt emailul de acces admin — albastru-ardezie, NU teracota de brand normal.
// Scop dublu: (1) admin recunoaște instant „ăsta e emailul special de admin", (2) semnal anti-phishing —
// un email fals care copiază stilul normal de brand nu va avea accentul ăsta.
const ADMIN_ACCENT = "#33465e";

// Email-ul de acces admin (magic link, aceeași mecanică Auth.js, dar vizual distinct de login-ul normal).
export function adminLoginEmailHtml(url: string, ttlMinutes: number): string {
  return emailLayout(
    `
    <h1 style="margin:0 0 12px;font-size:22px;line-height:1.25;color:${BRAND.text};">Acces panou de administrare</h1>
    <p style="margin:0 0 22px;font-size:15px;line-height:1.55;color:${BRAND.muted};">
      Apasă butonul de mai jos ca să intri în panoul de admin. Linkul e valabil ${ttlMinutes} de minute și
      poate fi folosit o singură dată.
    </p>
    ${emailButton(url, "Intră în panoul de admin", ADMIN_ACCENT)}
    <p style="margin:22px 0 0;font-size:12.5px;line-height:1.5;color:${BRAND.muted};">
      Dacă butonul nu merge, copiază acest link în browser:<br>
      <a href="${esc(url)}" style="color:${ADMIN_ACCENT};word-break:break-all;">${esc(url)}</a>
    </p>
    <p style="margin:18px 0 0;font-size:12.5px;line-height:1.5;color:${BRAND.muted};">
      Nu ai cerut tu acces admin? Ignoră acest email — contul tău normal nu e afectat.
    </p>
  `,
    { accent: ADMIN_ACCENT, badge: "PANOU ADMIN" },
  );
}

export function adminLoginEmailText(url: string, ttlMinutes: number): string {
  return `Acces panou de administrare DETALIA\n\nDeschide linkul pentru a intra în panoul de admin (valabil ${ttlMinutes} de minute, o singură utilizare):\n${url}\n\nNu ai cerut tu acces admin? Ignoră acest email.`;
}

// Notificare: cineva a publicat o schiță peste detaliul destinatarului.
export function sketchProposedEmailHtml(who: string, detailTitle: string, url: string): string {
  return emailLayout(`
    <h1 style="margin:0 0 12px;font-size:22px;line-height:1.25;color:${BRAND.text};">Schiță nouă pe detaliul tău</h1>
    <p style="margin:0 0 22px;font-size:15px;line-height:1.55;color:${BRAND.muted};">
      ${esc(who)} a publicat o schiță peste detaliul tău <strong style="color:${BRAND.text};">${esc(detailTitle)}</strong>.
    </p>
    ${emailButton(url, "Vezi schița în teanc")}
  `);
}

export function sketchProposedEmailText(who: string, detailTitle: string, url: string): string {
  return `Schiță nouă pe detaliul tău\n\n${who} a publicat o schiță peste detaliul tău „${detailTitle}".\n\nVezi schița în teanc:\n${url}`;
}

// Notificare: autorul detaliului-mamă a șters schița destinatarului (moderare post-publicare).
export function sketchDeletedEmailHtml(detailTitle: string, url: string): string {
  return emailLayout(`
    <h1 style="margin:0 0 12px;font-size:22px;line-height:1.25;color:${BRAND.text};">Schița ta a fost eliminată</h1>
    <p style="margin:0 0 22px;font-size:15px;line-height:1.55;color:${BRAND.muted};">
      Schița ta de la detaliul <strong style="color:${BRAND.text};">${esc(detailTitle)}</strong> a fost eliminată
      de autorul detaliului.
    </p>
    ${emailButton(url, "Vezi detaliul")}
  `);
}

export function sketchDeletedEmailText(detailTitle: string, url: string): string {
  return `Schița ta a fost eliminată\n\nSchița ta de la detaliul „${detailTitle}" a fost eliminată de autorul detaliului.\n\nVezi detaliul:\n${url}`;
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
