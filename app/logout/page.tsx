"use client";

import { useEffect } from "react";
import { signOut } from "next-auth/react";

// Pas SECUNDAR de delogare (2026-08-09) — cookie-ul de sesiune e deja șters SERVER-SIDE de acțiunea
// care a adus userul aici (signOutAction/deleteAccountAction, vezi app/(app)/profile/actions.ts, SEC-001).
// `/logout` e public în PUBLIC_PATHS — `proxy.ts` RULEAZĂ pe ea (CSP, lockdown etc.), dar nu mai scrie
// niciun cookie de sesiune (getToken() e read-only), deci nu mai există conflict de Set-Cookie. Ce face
// `signOut()` de-aici: un POST separat către `/api/auth/signout` (acela e exclus din matcher-ul proxy.ts),
// care curăță și eventuale cookie-uri CSRF rămase și sincronizează alte tab-uri deschise pe același cont.
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
