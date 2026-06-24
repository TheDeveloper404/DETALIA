import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";

import { db } from "@/db";
import { roles, users } from "@/db/schema";

import { devLoginAction } from "./actions";

// 🔴 DEV-LOGIN — DOAR non-producție. Listează userii și te bagă în cont fără email. DE ȘTERS înainte de prod.
export default async function DevLoginPage() {
  if (process.env.NODE_ENV === "production") notFound();

  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      roleMain: roles.roleMain,
      subRole: roles.subRole,
      verification: roles.verificationStatus,
    })
    .from(users)
    .leftJoin(roles, eq(roles.userId, users.id))
    .orderBy(users.name);

  return (
    <main className="mx-auto w-full max-w-xl flex-1 p-6 sm:p-10">
      <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <b>Dev-login</b> — bypass de autentificare, doar pe localhost. Nu există în producție.
      </div>

      <h1 className="mb-1 text-xl font-bold tracking-tight">Intră ca…</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Alege un cont seed. Te logăm direct, fără magic link.
      </p>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card px-6 py-10 text-center text-sm text-muted-foreground">
          Niciun user în DB. Rulează întâi <code className="font-mono">npm run db:seed</code>.
        </div>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {rows.map((u) => (
            <li key={u.id}>
              <form action={devLoginAction}>
                <input type="hidden" name="userId" value={u.id} />
                <button
                  type="submit"
                  className="flex w-full items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3 text-left transition-colors hover:border-primary"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-foreground">
                      {u.name ?? "(fără nume)"}
                    </span>
                    <span className="block truncate font-mono text-[11px] text-muted-foreground">
                      {u.email}
                      {u.roleMain
                        ? ` · ${u.roleMain}${u.subRole ? ` / ${u.subRole}` : ""}${u.verification === "VERIFIED" ? " ★" : ""}`
                        : " · fără rol (→ onboarding)"}
                    </span>
                  </span>
                  <span className="shrink-0 font-mono text-[12px] font-medium text-primary">
                    Intră →
                  </span>
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
