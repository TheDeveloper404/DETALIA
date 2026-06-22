import Link from "next/link";

import { AuthForm } from "@/components/auth-form";

// Acces PUBLIC — înregistrare deschisă, fără invitație. Magic link / Google creează contul automat;
// după autentificare, userul trece prin onboarding (rol, subrol, poză) înainte de feed.
const ERROR_MESSAGES: Record<string, string> = {
  EmailSignInError: "Nu am putut trimite link-ul. Verifică adresa și încearcă din nou.",
  OAuthSignInError: "Nu am putut porni autentificarea cu Google. Încearcă din nou.",
  OAuthAccountNotLinked: "Acest email e deja folosit cu altă metodă. Intră cum ai făcut prima dată.",
  Verification: "Link-ul a expirat sau a fost deja folosit. Cere unul nou.",
  default: "Ceva n-a mers. Încearcă din nou.",
};

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const { callbackUrl, error } = await searchParams;
  const errorMessage = error ? (ERROR_MESSAGES[error] ?? ERROR_MESSAGES.default) : null;

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
      <div className="w-full max-w-sm flex flex-col gap-6">
        <header className="text-center flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Creează cont</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Înregistrare liberă, fără parolă. Apoi îți alegi rolul și ești gata.
          </p>
        </header>

        {errorMessage && (
          <p
            role="alert"
            className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
          >
            {errorMessage}
          </p>
        )}

        <AuthForm
          callbackUrl={callbackUrl ?? "/onboarding"}
          authPath="/signup"
          submitLabel="Creează cont cu email"
        />

        <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">
          Ai deja cont?{" "}
          <Link href="/login" className="font-medium text-zinc-900 underline dark:text-zinc-100">
            Autentifică-te
          </Link>
        </p>
      </div>
    </main>
  );
}
