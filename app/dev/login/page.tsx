// 🔴 DEV-LOGIN — pagină de bypass pentru verificare vizuală pe localhost. DE ȘTERS înainte de prod.
// Gated dur: notFound() în producție. Loghează ca UN singur user real (primul din DB).
import { notFound } from "next/navigation";

import { db } from "@/db";

import { devLoginAction } from "./actions";

export default async function DevLoginPage() {
  if (process.env.NODE_ENV === "production") notFound();

  // Un singur user: primul din DB (cel mai vechi). Suficient pentru verificare vizuală.
  const user = await db.query.users.findFirst({
    columns: { id: true, name: true, email: true },
    orderBy: (u, { asc }) => asc(u.createdAt),
  });

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-5 px-6 text-center">
      <div className="rounded-lg border border-dashed border-destructive/40 bg-destructive/5 px-4 py-2 font-mono text-xs uppercase tracking-wide text-destructive">
        Dev-login · doar localhost · de șters înainte de prod
      </div>

      {user ? (
        <form action={devLoginAction} className="flex flex-col items-center gap-3">
          <input type="hidden" name="userId" value={user.id} />
          <p className="text-sm text-muted-foreground">
            Intri ca <strong className="text-foreground">{user.name ?? user.email}</strong>
          </p>
          <button
            type="submit"
            className="rounded-lg border border-[#95492e] bg-primary px-5 py-2.5 font-semibold text-primary-foreground transition-colors hover:bg-[#974a2e]"
          >
            Intră în aplicație
          </button>
        </form>
      ) : (
        <p className="text-sm text-muted-foreground">
          Niciun user în DB. Rulează <code className="font-mono">npm run db:seed</code> întâi.
        </p>
      )}
    </main>
  );
}
