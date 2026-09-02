import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getAdminSession } from "@/lib/admin-auth";
import { listUsersForAdmin } from "@/server/repos/usersRepo";
import { getPlatformState } from "@/server/services/settingsService";
import { getAdminTotpStatus } from "@/server/services/adminTotpService";
import { getAllReferralsForAdmin } from "@/server/services/referralService";

import { adminLogoutAction, resetOwnAdminTotpAction } from "./actions";
import { AdminReferralsTable } from "./admin-referrals-table";
import { MaintenanceForm } from "./maintenance-form";
import { UsersTable } from "./users-table";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };

// Panou de admin — autentificare SEPARATĂ de useri. Fără sesiune de admin → login.
// Conține: lista userilor (nume/email/rol/dată) + toggle-ul de mentenanță.
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const admin = await getAdminSession();
  if (!admin) {
    redirect("/admin-page/login");
  }

  const [users, platform, referrals, totp] = await Promise.all([
    listUsersForAdmin(),
    getPlatformState(),
    getAllReferralsForAdmin(),
    getAdminTotpStatus(admin.email),
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
      <section className="mt-8">
        <h2 className="text-base font-semibold">Mentenanță platformă</h2>
        <p className="mt-0.5 mb-4 text-[13px] text-muted-foreground">
          Două controale independente: anunț în avans (banner) și lockdown total (închide platforma).
        </p>
        <MaintenanceForm
          defaults={{ announcement: platform.announcement, lockdown: platform.lockdown }}
        />
      </section>

      {/* ─── Al doilea factor (SEC-P02) ─── */}
      <section className="mt-8">
        <h2 className="text-base font-semibold">Al doilea factor</h2>
        <p className="mt-0.5 mb-3 text-[13px] text-muted-foreground">
          {totp.backupCodesRemaining > 0
            ? `Coduri de rezervă rămase: ${totp.backupCodesRemaining} din 10.`
            : "Nu mai ai coduri de rezervă. Resetează al doilea factor ca să primești un set nou."}{" "}
          Resetarea te deconectează și cere reînrolarea la următorul login.
        </p>
        <form action={resetOwnAdminTotpAction}>
          <button
            type="submit"
            className="rounded-lg border border-destructive/40 px-3 py-1.5 text-sm font-medium text-destructive hover:bg-destructive/10"
          >
            Resetează al doilea factor
          </button>
        </form>
      </section>

      {/* ─── Useri ─── */}
      <section className="mt-8">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-base font-semibold">Useri înregistrați</h2>
        </div>

        <UsersTable users={users} />
      </section>

      {/* ─── Referrals ─── */}
      <section className="mt-8">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-base font-semibold">Conversii prin link de referral</h2>
        </div>
        <AdminReferralsTable rows={referrals} />
      </section>
    </main>
  );
}
