import Link from "next/link";

import { AuthForm } from "@/components/auth-form";
import { AuthShell } from "@/components/auth-shell";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// Acces PUBLIC — înregistrare deschisă, fără invitație. Magic link creează contul automat;
// după autentificare, userul trece prin onboarding (rol, subrol, poză) înainte de feed.
const ERROR_MESSAGES: Record<string, string> = {
  EmailSignInError: "Nu am putut trimite link-ul. Verifică adresa și încearcă din nou.",
  Verification: "Link-ul a expirat sau a fost deja folosit. Cere unul nou.",
  RateLimited: "Prea multe cereri. Așteaptă câteva minute și încearcă din nou.",
  CaptchaFailed: "Verificarea anti-robot a eșuat. Reîncarcă pagina și încearcă din nou.",
  AccessDenied: "Contul tău este suspendat. Contactează-ne dacă e o greșeală.",
  AccountExists: "Există deja un cont cu acest email. Autentifică-te.",
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
    <AuthShell mode="signup">
      <Card className="w-full gap-6 [--card-spacing:--spacing(8)] shadow-[0_22px_56px_-34px_rgba(33,29,24,0.35)]">
        <CardHeader>
          <CardTitle className="text-[27px] leading-tight tracking-tight">Creează cont</CardTitle>
          <CardDescription className="text-[15px]">
            Intră printre primii profesioniști. Cont gratuit, fără parolă — primești un link de acces
            pe email.
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
    </AuthShell>
  );
}
