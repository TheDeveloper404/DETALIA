import Link from "next/link";

import { AuthForm } from "@/components/auth-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// Acces PUBLIC — înregistrare deschisă, fără invitație. Magic link / Google creează contul automat;
// după autentificare, userul trece prin onboarding (rol, subrol, poză) înainte de feed.
const ERROR_MESSAGES: Record<string, string> = {
  EmailSignInError: "Nu am putut trimite link-ul. Verifică adresa și încearcă din nou.",
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
    <main className="flex flex-1 flex-col items-center justify-center p-6 sm:p-8">
      <Card className="w-full max-w-sm gap-6 py-6">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Creează cont</CardTitle>
          <CardDescription>
            Înregistrare liberă, fără parolă. Apoi îți alegi rolul și ești gata.
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
            callbackUrl={callbackUrl ?? "/onboarding"}
            authPath="/signup"
            submitLabel="Creează cont cu email"
          />

          <p className="text-center text-sm text-muted-foreground">
            Ai deja cont?{" "}
            <Link href="/login" className="font-medium text-foreground underline underline-offset-4">
              Autentifică-te
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
