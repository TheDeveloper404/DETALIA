import Link from "next/link";

import { AuthForm } from "@/components/auth-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// Mesaje de eroare prietenoase (fără a expune internals). Cheia = error.type din Auth.js.
const ERROR_MESSAGES: Record<string, string> = {
  EmailSignInError: "Nu am putut trimite link-ul. Verifică adresa și încearcă din nou.",
  OAuthSignInError: "Nu am putut porni autentificarea cu Google. Încearcă din nou.",
  OAuthAccountNotLinked: "Acest email e deja folosit cu altă metodă. Intră cum ai făcut prima dată.",
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
    <main className="flex flex-1 flex-col items-center justify-center p-6 sm:p-8">
      <Card className="w-full max-w-sm gap-6 py-6">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Autentificare</CardTitle>
          <CardDescription>
            Intră cu Google sau cu un link de acces pe email. Fără parolă.
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-5">
          {errorMessage && (
            <p
              role="alert"
              className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {errorMessage}
            </p>
          )}

          <AuthForm
            callbackUrl={callbackUrl ?? "/"}
            authPath="/login"
            submitLabel="Trimite link-ul de acces"
          />

          <p className="text-center text-sm text-muted-foreground">
            Nu ai cont?{" "}
            <Link href="/signup" className="font-medium text-foreground underline underline-offset-4">
              Creează unul
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
