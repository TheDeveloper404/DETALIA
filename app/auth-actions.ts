"use server";

import { redirect } from "next/navigation";
import { AuthError } from "next-auth";

import { signIn } from "@/lib/auth";
import { checkLimit, clientIp, hashEmail, limiters } from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/turnstile";
import { userExistsByEmail } from "@/server/repos/usersRepo";

// Acces PUBLIC, passwordless. signIn aruncă un redirect intern (NEXT_REDIRECT) pe succes — re-aruncat.
// La eroare de auth, ne întoarcem pe pagina de proveniență (authPath) cu ?error= pentru mesaj prietenos.

// authPath vine din formular (client-controlled) → whitelist strict (evită open-redirect, ex. `//evil.com`).
function safeAuthPath(formData: FormData): "/login" | "/signup" {
  return formData.get("authPath") === "/signup" ? "/signup" : "/login";
}

// SEC-002: callbackUrl vine tot din formular (client-controlled) — un `//evil.com` sau `/\evil.com` e
// redirect protocol-relative către un domeniu extern. Acceptăm DOAR path-uri relative care încep cu
// exact un singur `/`, nu cu `//` sau `/\` (browserele tratează ambele ca schema-relative).
function safeCallbackUrl(raw: string): string {
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return "/";
  return raw;
}

export async function signInWithEmailAction(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "").trim();
  const callbackUrl = safeCallbackUrl(String(formData.get("callbackUrl") || "/"));
  const authPath = safeAuthPath(formData);

  const ip = await clientIp();

  // SEC-01: poarta publică → rate limit pe email (hash) ȘI pe IP, înainte de a atinge Resend/DB.
  // Răspuns generic la depășire (RateLimited) — nu confirmă/infirmă existența emailului (anti-enumerare).
  const [byEmail, byIp] = await Promise.all([
    checkLimit(limiters.authPerEmail, hashEmail(email)),
    checkLimit(limiters.authPerIp, ip),
  ]);
  if (!byEmail.ok || !byIp.ok) redirect(`${authPath}?error=RateLimited`);

  // Anti-bot: validăm tokenul Turnstile la Cloudflare înainte de a trimite emailul. No-op fără chei
  // (dev). La token invalid → mesaj prietenos, fără a atinge Resend.
  const captcha = String(formData.get("cf-turnstile-response") ?? "") || null;
  if (!(await verifyTurnstile(captcha, ip))) redirect(`${authPath}?error=CaptchaFailed`);

  // Login/signup sunt fluxuri distincte (decizie Liviu 2026-07-03): pe /login un email fără cont
  // arată explicit "nu există cont", pe /signup un email cu cont existent arată "există deja" —
  // nu mai trimitem magic link în ambele cazuri gen "verifică email"-ul indiferent de existența contului.
  const accountExists = await userExistsByEmail(email);
  if (authPath === "/login" && !accountExists) redirect(`${authPath}?error=NoAccount`);
  if (authPath === "/signup" && accountExists) redirect(`${authPath}?error=AccountExists`);

  // redirect:false → primim URL-ul de redirect în loc ca Auth.js să sară singur pe `pages.error`
  // (care e /login). Astfel eroarea de pe /signup RĂMÂNE pe /signup (citim ?error din URL-ul întors).
  let destination: string | undefined;
  try {
    destination = (await signIn("resend", {
      email,
      redirectTo: callbackUrl,
      redirect: false,
    })) as string | undefined;
  } catch (err) {
    if (err instanceof AuthError) redirect(`${authPath}?error=${encodeURIComponent(err.type)}`);
    throw err;
  }

  // Aceste redirect-uri sunt în afara try → NEXT_REDIRECT nu e înghițit de catch.
  const errorType = destination
    ? new URL(destination, "http://detalia.local").searchParams.get("error")
    : null;
  if (errorType) redirect(`${authPath}?error=${encodeURIComponent(errorType)}`);
  redirect(destination ?? callbackUrl);
}
