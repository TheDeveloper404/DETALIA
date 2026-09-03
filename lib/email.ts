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
function emailLayout(
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
      Dacă butonul nu merge,
      <a href="${esc(url)}" style="color:${BRAND.accent};">deschide linkul de autentificare</a>.
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
      Dacă butonul nu merge,
      <a href="${esc(url)}" style="color:${ADMIN_ACCENT};">deschide linkul de acces</a>.
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


export function materialOfferSentEmailHtml(who: string, detailTitle: string, url: string): string {
  return emailLayout(`
    <h1 style="margin:0 0 12px;font-size:22px;line-height:1.25;color:${BRAND.text};">Ai primit o ofertă de materiale</h1>
    <p style="margin:0 0 22px;font-size:15px;line-height:1.55;color:${BRAND.muted};">
      ${esc(who)} a trimis o ofertă de materiale pentru detaliul tău <strong style="color:${BRAND.text};">${esc(detailTitle)}</strong>.
    </p>
    ${emailButton(url, "Vezi oferta")}
  `);
}

export function materialOfferSentEmailText(who: string, detailTitle: string, url: string): string {
  return `Ai primit o ofertă de materiale\n\n${who} a trimis o ofertă de materiale pentru detaliul tău „${detailTitle}".\n\nVezi oferta:\n${url}`;
}

export function materialOfferEditedEmailHtml(who: string, detailTitle: string, url: string): string {
  return emailLayout(`
    <h1 style="margin:0 0 12px;font-size:22px;line-height:1.25;color:${BRAND.text};">Ofertă de materiale actualizată</h1>
    <p style="margin:0 0 22px;font-size:15px;line-height:1.55;color:${BRAND.muted};">
      ${esc(who)} a actualizat oferta de materiale pentru detaliul tău <strong style="color:${BRAND.text};">${esc(detailTitle)}</strong>.
    </p>
    ${emailButton(url, "Vezi oferta")}
  `);
}

export function materialOfferEditedEmailText(who: string, detailTitle: string, url: string): string {
  return `Ofertă de materiale actualizată\n\n${who} a actualizat oferta de materiale pentru detaliul tău „${detailTitle}".\n\nVezi oferta:\n${url}`;
}

export function referralJoinedEmailHtml(who: string, profileUrl: string): string {
  return emailLayout(`
    <h1 style="margin:0 0 12px;font-size:22px;line-height:1.25;color:${BRAND.text};">Cineva s-a alăturat prin linkul tău</h1>
    <p style="margin:0 0 22px;font-size:15px;line-height:1.55;color:${BRAND.muted};">
      ${esc(who)} și-a făcut cont în DETALIA prin linkul tău de referral.
    </p>
    ${emailButton(profileUrl, "Vezi profilul tău")}
  `);
}

export function referralJoinedEmailText(who: string, profileUrl: string): string {
  return `Cineva s-a alăturat prin linkul tău\n\n${who} și-a făcut cont în DETALIA prin linkul tău de referral.\n\nVezi profilul tău:\n${profileUrl}`;
}

// ── Digest săptămânal (2026-09-03) ──────────────────────────────────────────────────────────────
export type WeeklyDigestData = {
  recipientName: string | null;
  // Activitate de la alții pe detaliile destinatarului, în ultimele 7 zile.
  mine: { comments: number; sketches: number; validations: number };
  // Detalii publice noi ale săptămânii (egal pentru toți).
  community: { title: string; url: string }[];
  unsubscribeUrl: string;
  profileUrl: string;
};

// Pluralul românesc pe intervalele uzuale: 1 → singular; 2..19 → plural simplu; ≥20 → plural cu „de".
function roCount(n: number, one: string, few: string, many: string): string {
  if (n === 1) return one;
  if (n < 20) return few.replace("%d", String(n));
  return many.replace("%d", String(n));
}

function digestMineLines(mine: WeeklyDigestData["mine"]): string[] {
  const out: string[] = [];
  if (mine.comments > 0)
    out.push(roCount(mine.comments, "un comentariu nou", "%d comentarii noi", "%d de comentarii noi"));
  if (mine.sketches > 0)
    out.push(roCount(mine.sketches, "o schiță nouă", "%d schițe noi", "%d de schițe noi"));
  if (mine.validations > 0)
    out.push(roCount(mine.validations, "o poziție nouă", "%d poziții noi", "%d de poziții noi"));
  return out;
}

export function weeklyDigestEmailHtml(data: WeeklyDigestData): string {
  const hello = data.recipientName ? `Salut, ${esc(data.recipientName)}!` : "Salut!";
  const mine = digestMineLines(data.mine);
  const mineHtml =
    mine.length > 0
      ? `<p style="margin:0 0 10px;font-size:15px;line-height:1.55;color:${BRAND.text};font-weight:700;">La tine pe detalii</p>
         <p style="margin:0 0 18px;font-size:15px;line-height:1.55;color:${BRAND.muted};">
           Ai ${mine.join(", ")} pe detaliile tale săptămâna asta.
         </p>
         ${emailButton(data.profileUrl, "Vezi activitatea")}`
      : "";
  const communityHtml =
    data.community.length > 0
      ? `<p style="margin:${mine.length > 0 ? "26px" : "0"} 0 10px;font-size:15px;line-height:1.55;color:${BRAND.text};font-weight:700;">Nou pe DETALIA</p>
         <ul style="margin:0 0 6px;padding-left:18px;font-size:15px;line-height:1.7;color:${BRAND.muted};">
           ${data.community
             .map(
               (d) =>
                 `<li><a href="${esc(d.url)}" style="color:${BRAND.accent};text-decoration:none;">${esc(d.title)}</a></li>`,
             )
             .join("")}
         </ul>`
      : "";
  return emailLayout(`
    <h1 style="margin:0 0 12px;font-size:22px;line-height:1.25;color:${BRAND.text};">Săptămâna ta pe DETALIA</h1>
    <p style="margin:0 0 22px;font-size:15px;line-height:1.55;color:${BRAND.muted};">${hello}</p>
    ${mineHtml}
    ${communityHtml}
    <p style="margin:26px 0 0;font-size:12px;line-height:1.5;color:${BRAND.muted};border-top:1px solid ${BRAND.border};padding-top:14px;">
      Primești acest rezumat săptămânal pentru că ai cont pe DETALIA.
      <a href="${esc(data.unsubscribeUrl)}" style="color:${BRAND.muted};text-decoration:underline;">Dezabonează-te</a>.
    </p>
  `);
}

export function weeklyDigestEmailText(data: WeeklyDigestData): string {
  const parts: string[] = ["Săptămâna ta pe DETALIA", ""];
  const mine = digestMineLines(data.mine);
  if (mine.length > 0) {
    parts.push(`La tine pe detalii: ai ${mine.join(", ")} pe detaliile tale săptămâna asta.`);
    parts.push(`Vezi activitatea: ${data.profileUrl}`, "");
  }
  if (data.community.length > 0) {
    parts.push("Nou pe DETALIA:");
    for (const d of data.community) parts.push(`- ${d.title}: ${d.url}`);
    parts.push("");
  }
  parts.push(`Dezabonare: ${data.unsubscribeUrl}`);
  return parts.join("\n");
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

// Trimitere în lot (Resend `/emails/batch`, max 100/apel) — folosit de digestul săptămânal ca să nu
// facă zeci de request-uri individuale. Best-effort ca `sendEmail`: nu aruncă, logează eșecurile fără
// PII, întoarce câte mesaje au fost ACCEPTATE. Dacă un lot e respins întreg (o adresă malformată, 429
// pe cotă, Resend indisponibil), NU se pierde tot lotul: se retrimite mesaj-cu-mesaj prin `sendEmail`,
// ca un singur mesaj problematic să nu blocheze restul destinatarilor săptămânii.
export async function sendEmailBatch(
  messages: { to: string; subject: string; html: string; text?: string }[],
): Promise<number> {
  const key = process.env.AUTH_RESEND_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from) {
    console.warn("Resend: chei de mediu absente — lotul NU se trimite.");
    return 0;
  }

  async function sendChunkIndividually(chunk: typeof messages): Promise<number> {
    const results = await Promise.all(chunk.map((m) => sendEmail(m)));
    return results.filter(Boolean).length;
  }

  let accepted = 0;
  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100);
    try {
      const res = await fetch("https://api.resend.com/emails/batch", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify(
          chunk.map((m) => ({
            from,
            to: m.to,
            subject: m.subject,
            html: m.html,
            ...(m.text ? { text: m.text } : {}),
          })),
        ),
      });
      if (res.ok) {
        accepted += chunk.length;
      } else {
        console.error("Resend batch: lot respins, status", res.status, "— reîncerc individual");
        accepted += await sendChunkIndividually(chunk);
      }
    } catch (err) {
      console.error(
        "Resend batch: eroare de rețea:",
        err instanceof Error ? err.message : String(err),
        "— reîncerc individual",
      );
      accepted += await sendChunkIndividually(chunk);
    }
  }
  return accepted;
}
