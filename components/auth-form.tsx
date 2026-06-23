"use client";

import { signInWithEmailAction } from "@/app/auth-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Formular de autentificare passwordless reutilizabil: magic link pe email (Resend).
// Folosit de /login și /signup (același flux; doar copy-ul diferă).
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
    <form action={signInWithEmailAction} className="flex flex-col gap-3">
      <input type="hidden" name="callbackUrl" value={callbackUrl} />
      <input type="hidden" name="authPath" value={authPath} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="nume@exemplu.ro"
          className="h-10"
        />
      </div>
      <Button type="submit" className="h-10 w-full">
        {submitLabel}
      </Button>
    </form>
  );
}
