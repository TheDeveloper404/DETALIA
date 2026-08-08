"use client";

import { useEffect } from "react";
import { signOut } from "next-auth/react";

// Delogare REALĂ (2026-08-09) — vezi comentariul din app/(app)/profile/actions.ts pentru cauza exactă.
// Rută intenționat SUB `/api/auth`-adiacentă din perspectiva proxy.ts: adăugată explicit în PUBLIC_PATHS,
// ca middleware-ul să n-o gateze pe roluri/onboarding — pagina trebuie să funcționeze indiferent de starea
// (chiar stranie) a sesiunii curente. `signOut()` de-aici (client, din `next-auth/react`) face un request
// PROPRIU către `/api/auth/signout`, care e exclus din matcher-ul proxy.ts — deci fără nimic concurent
// care să rescrie cookie-ul de sesiune în același răspuns.
export default function LogoutPage() {
  useEffect(() => {
    void signOut({ redirectTo: "/" });
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <p className="text-sm text-muted-foreground">Se deloghează…</p>
    </div>
  );
}
