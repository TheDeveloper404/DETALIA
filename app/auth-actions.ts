"use server";

import { redirect } from "next/navigation";
import { AuthError } from "next-auth";

import { signIn } from "@/lib/auth";
import { checkLimit, clientIp, hashEmail, limiters } from "@/lib/rate-limit";

// Acces PUBLIC, passwordless. signIn aruncă un redirect intern (NEXT_REDIRECT) pe succes — re-aruncat.
// La eroare de auth, ne întoarcem pe pagina de proveniență (authPath) cu ?error= pentru mesaj prietenos.

// authPath vine din formular (client-controlled) → whitelist strict (evită open-redirect, ex. `//evil.com`).
function safeAuthPath(formData: FormData): "/login" | "/signup" {
  return formData.get("authPath") === "/signup" ? "/signup" : "/login";
}

export async function signInWithEmailAction(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "").trim();
  const callbackUrl = String(formData.get("callbackUrl") || "/");
  const authPath = safeAuthPath(formData);

  // SEC-01: poarta publică → rate limit pe email (hash) ȘI pe IP, înainte de a atinge Resend/DB.
  // Răspuns generic la depășire (RateLimited) — nu confirmă/infirmă existența emailului (anti-enumerare).
  const [byEmail, byIp] = await Promise.all([
    checkLimit(limiters.authPerEmail, hashEmail(email)),
    checkLimit(limiters.authPerIp, await clientIp()),
  ]);
  if (!byEmail.ok || !byIp.ok) redirect(`${authPath}?error=RateLimited`);

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
