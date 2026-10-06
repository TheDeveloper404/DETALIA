import type { Metadata } from "next";
import Link from "next/link";

import { AuthForm } from "@/components/auth-form";
import { AuthShell } from "@/components/auth-shell";
import styles from "@/components/public-pages/public-pages.module.css";

// Acces PUBLIC — înregistrare deschisă, fără invitație. Magic link creează contul automat;
// după autentificare, userul trece prin onboarding (rol, subrol, poză) înainte de feed.
const ERROR_MESSAGES: Record<string, string> = {
  EmailSignInError: "Nu am putut trimite link-ul. Verifică adresa și încearcă din nou.",
  Verification: "Link-ul a expirat sau a fost deja folosit. Cere unul nou.",
  RateLimited: "Prea multe cereri. Așteaptă câteva minute și încearcă din nou.",
  CaptchaFailed: "Verificarea anti-robot a eșuat. Reîncarcă pagina și încearcă din nou.",
  AccessDenied: "Contul tău este suspendat. Contactează-ne dacă e o greșeală.",
  default: "Ceva n-a mers. Încearcă din nou.",
};

// `generateMetadata` (nu `export const metadata` static) — titlul link-preview-ului (Telegram/WhatsApp
// etc.) trebuie să difere pe `?ref=` (link de referral, trimis de un user unui prieten) față de link-ul
// simplu de înregistrare; un export static n-are acces la searchParams (cerut 2026-08-26).
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}): Promise<Metadata> {
  const { ref } = await searchParams;
  if (ref) {
    return { title: { absolute: "Te invit în DETALIA" } };
  }
  return { title: "Înregistrare" };
}

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const { callbackUrl, error } = await searchParams;
  const errorMessage = error ? (ERROR_MESSAGES[error] ?? ERROR_MESSAGES.default) : null;

  return (
    <AuthShell mode="signup" presentation="entry" showDrawing={false}>
      <section aria-labelledby="signup-title">
        <p className={styles.eyebrow}>Creează cont</p>
        <h1 id="signup-title">Adu perspectiva ta în detaliu.</h1>
        <p className={styles.authDescription}>
          Confirmi emailul, apoi îți completezi profilul profesional. Contul este gratuit.
        </p>
        {errorMessage && (
          <p role="alert" className={styles.authError}>
            {errorMessage}
          </p>
        )}

        <AuthForm
          callbackUrl={callbackUrl ?? "/onboarding"}
          authPath="/signup"
          submitLabel="Creează cont gratuit"
        />

        <p className={styles.authAlternative}>
          Ai deja cont? <Link href="/login">Autentifică-te</Link>
        </p>
      </section>
    </AuthShell>
  );
}
