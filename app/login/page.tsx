import type { Metadata } from "next";
import Link from "next/link";

import { AuthForm } from "@/components/auth-form";
import { AuthShell } from "@/components/auth-shell";
import styles from "@/components/public-pages/public-pages.module.css";

// Mesaje de eroare prietenoase (fără a expune internals). Cheia = error.type din Auth.js.
const ERROR_MESSAGES: Record<string, string> = {
  EmailSignInError: "Nu am putut trimite link-ul. Verifică adresa și încearcă din nou.",
  Verification: "Link-ul a expirat sau a fost deja folosit. Cere unul nou.",
  RateLimited: "Prea multe cereri. Așteaptă câteva minute și încearcă din nou.",
  CaptchaFailed: "Verificarea anti-robot a eșuat. Reîncarcă pagina și încearcă din nou.",
  AccessDenied: "Contul tău este suspendat. Contactează-ne dacă e o greșeală.",
  default: "Ceva n-a mers. Încearcă din nou.",
};

export const metadata: Metadata = { title: "Autentificare" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const { callbackUrl, error } = await searchParams;
  const errorMessage = error ? (ERROR_MESSAGES[error] ?? ERROR_MESSAGES.default) : null;

  return (
    <AuthShell mode="login" presentation="entry">
      <section aria-labelledby="login-title">
        <p className={styles.eyebrow}>Autentificare</p>
        <h1 id="login-title">Bine ai revenit.</h1>
        <p className={styles.authDescription}>Intră în cont și continuă de unde ai rămas.</p>
        {errorMessage && (
          <p role="alert" className={styles.authError}>
            {errorMessage}
          </p>
        )}

        <AuthForm
          callbackUrl={callbackUrl ?? "/feed?welcome=1"}
          authPath="/login"
          submitLabel="Trimite link-ul de acces"
        />

        <p className={styles.authAlternative}>
          Nu ai cont? <Link href="/signup">Creează unul</Link>
        </p>
      </section>
    </AuthShell>
  );
}
