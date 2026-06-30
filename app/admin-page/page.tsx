import { redirect } from "next/navigation";

import { getAdminSession } from "@/lib/admin-auth";
import { ROLE_MAIN_LABELS, type RoleMain } from "@/server/domain/roles";
import { listUsersForAdmin } from "@/server/repos/usersRepo";
import { getMaintenanceState } from "@/server/services/settingsService";

import { adminLogoutAction } from "./actions";
import { MaintenanceForm } from "./maintenance-form";

// Panou de admin (MVP) — autentificare SEPARATĂ de useri. Fără sesiune de admin → login.
// Conține: lista userilor (nume/email/rol/dată) + toggle-ul de mentenanță.
export const dynamic = "force-dynamic";

function fmtDate(d: Date | string) {
  return new Date(d).toLocaleString("ro-RO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function AdminPage() {
  const admin = await getAdminSession();
  if (!admin) {
    redirect("/admin-page/login");
  }

  const [users, maintenance] = await Promise.all([
    listUsersForAdmin(),
    getMaintenanceState(),
  ]);

  return (
    <main className="mx-auto w-full max-w-[var(--container-max)] px-6 py-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Administrare</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Autentificat ca <span className="font-medium text-foreground">{admin.email}</span>.
          </p>
        </div>
        <form action={adminLogoutAction}>
          <button
            type="submit"
            className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-secondary"
          >
            Ieși
          </button>
        </form>
      </div>

      {/* ─── Mentenanță ─── */}
      <section className="mt-8 rounded-xl border border-border bg-card p-5">
        <h2 className="text-base font-semibold">Mentenanță platformă</h2>
        <p className="mt-0.5 mb-4 text-[13px] text-muted-foreground">
          Cât e activă: landing → „site în lucru&rdquo; pentru anonimi · banner în feed pentru userii logați.
        </p>
        <MaintenanceForm
          defaults={{
            enabled: maintenance.enabled,
            date: maintenance.date,
            message: maintenance.message,
          }}
        />
      </section>

      {/* ─── Useri ─── */}
      <section className="mt-8">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-base font-semibold">Useri înregistrați</h2>
          <span className="font-mono text-[13px] text-muted-foreground">{users.length} total</span>
        </div>

        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-secondary/50 text-[12px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">Nume</th>
                <th className="px-4 py-2.5 font-medium">Email</th>
                <th className="px-4 py-2.5 font-medium">Rol</th>
                <th className="px-4 py-2.5 font-medium">Creat</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                    Niciun user încă.
                  </td>
                </tr>
              ) : (
                users.map((u) => {
                  const fullName =
                    [u.firstName, u.lastName].filter(Boolean).join(" ") || u.name || "—";
                  const roleLabel = u.roleMain
                    ? `${ROLE_MAIN_LABELS[u.roleMain as RoleMain] ?? u.roleMain}${u.subRole ? ` · ${u.subRole}` : ""}`
                    : "—";
                  return (
                    <tr key={u.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-2.5">
                        {fullName}
                        {u.verification === "VERIFIED" && (
                          <span className="ml-1 text-yellow-500" title="Rol verificat">
                            ★
                          </span>
                        )}
                        {u.status !== "ACTIVE" && (
                          <span className="ml-2 rounded bg-secondary px-1.5 py-0.5 text-[11px] text-muted-foreground">
                            {u.status}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-[13px]">{u.email}</td>
                      <td className="px-4 py-2.5">{roleLabel}</td>
                      <td className="px-4 py-2.5 font-mono text-[13px] text-muted-foreground">
                        {fmtDate(u.createdAt)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
