"use client";

import { signInWithEmailAction } from "@/app/auth-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Formular de autentificare passwordless reutilizabil: magic link pe email (Resend).
// Folosit de /login și /signup (același flux; doar copy-ul diferă). Stil din designul „Detalia Auth".
export function AuthForm({
  callbackUrl,
  authPath,
  submitLabel,
}: {
  callbackUrl: string;
  authPath: string;
  submitLabel: string;
}) {
  return (
    <form action={signInWithEmailAction} className="flex flex-col">
      <input type="hidden" name="callbackUrl" value={callbackUrl} />
      <input type="hidden" name="authPath" value={authPath} />

      <label
        htmlFor="email"
        className="mb-2 block font-mono text-[11.5px] uppercase tracking-[0.08em] text-muted-foreground"
      >
        Email
      </label>
      <Input
        id="email"
        name="email"
        type="email"
        required
        autoComplete="email"
        placeholder="nume@firma.ro"
        className="h-12 bg-background text-base"
      />

      <Button type="submit" className="mt-[18px] h-12 w-full text-base">
        {submitLabel}
      </Button>

      <div className="mt-[18px] flex items-center gap-2.5 font-mono text-xs leading-snug text-muted-foreground">
        <span aria-hidden className="inline-block size-[5px] flex-none rotate-45 bg-primary" />
        Fără parolă · primești un link de acces pe email
      </div>
    </form>
  );
}
