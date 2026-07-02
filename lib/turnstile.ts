// Verificare Cloudflare Turnstile (anti-bot pe formularele de auth). Tokenul vine din widget-ul
// client (`cf-turnstile-response`) și se validează server-side la Cloudflare înainte de a atinge
// Resend/DB. Perechea: `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (client) + `TURNSTILE_SECRET_KEY` (server).
//
// No-op fără secret configurat (dev local fără chei) → semnătura rămâne aceeași, fluxul de auth merge.
const SECRET = process.env.TURNSTILE_SECRET_KEY;
const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export async function verifyTurnstile(
  token: string | null,
  ip?: string | null,
): Promise<boolean> {
  // Fără secret (dev/local) → dezactivat, ca Sentry cu DSN gol. În prod secretul e în env → activ.
  if (!SECRET) return true;
  // Widget nerenderat / token lipsă în prod = suspect → respins.
  if (!token) return false;

  const body = new URLSearchParams();
  body.set("secret", SECRET);
  body.set("response", token);
  if (ip) body.set("remoteip", ip);

  try {
    const res = await fetch(SITEVERIFY_URL, { method: "POST", body });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    // Cloudflare indisponibil (outage/rețea) → NU blocăm signup-ul (self-DoS). Rate-limit-ul din
    // auth-actions rămâne plasa de siguranță. Fail-open DOAR la eroare de rețea, nu la token invalid.
    return true;
  }
}
