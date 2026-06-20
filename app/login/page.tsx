import { redirect } from "next/navigation";
import { AuthError } from "next-auth";

import { signIn } from "@/lib/auth";

// Mesaje de eroare prietenoase (fără a expune internals). Cheia = error.type din Auth.js.
const ERROR_MESSAGES: Record<string, string> = {
  EmailSignInError: "Nu am putut trimite link-ul. Verifică adresa și încearcă din nou.",
  Verification: "Link-ul a expirat sau a fost deja folosit. Cere unul nou.",
  default: "Ceva n-a mers. Încearcă din nou.",
};

export default async function LoginPage({
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
          <h1 className="text-2xl font-semibold tracking-tight">Autentificare</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Îți trimitem un link de acces pe email. Fără parolă.
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

        <form
          action={async (formData) => {
            "use server";
            const email = String(formData.get("email") ?? "").trim();
            try {
              await signIn("resend", {
                email,
                redirectTo: callbackUrl ?? "/",
              });
            } catch (err) {
              // signIn aruncă un redirect intern (NEXT_REDIRECT) pe succes — trebuie re-aruncat.
              if (err instanceof AuthError) {
                redirect(`/login?error=${err.type}`);
              }
              throw err;
            }
          }}
          className="flex flex-col gap-3"
        >
          <label htmlFor="email" className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Email</span>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="nume@exemplu.ro"
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
          <button
            type="submit"
            className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            Trimite link-ul de acces
          </button>
        </form>

        <p className="text-center text-xs text-zinc-400 dark:text-zinc-500">
          Acces pe bază de invitație · beta închis
        </p>
      </div>
    </main>
  );
}
