import type { AdminReferralRow } from "@/server/repos/usersRepo";

function fmtDate(d: Date | string) {
  return new Date(d).toLocaleString("ro-RO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Bucharest",
  });
}

// STRICT conversii reușite (cont chiar creat prin link) — fără funnel de click-uri neconvertite,
// decizie de produs 2026-08-25 (nu există alt tip de rând de arătat aici, vezi referralService).
export function AdminReferralsTable({ rows }: { rows: AdminReferralRow[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">Nicio conversie prin link de referral încă.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-border bg-secondary/50 text-xs text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">A invitat</th>
            <th className="px-3 py-2 font-medium">S-a înscris</th>
            <th className="px-3 py-2 font-medium">Data</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={`${r.referrerUserId}-${r.referredUserId}`} className="border-b border-border last:border-0">
              <td className="px-3 py-2">
                <a href={`/profile/${r.referrerUserId}`} className="font-medium hover:underline">
                  {r.referrerName ?? r.referrerEmail}
                </a>
              </td>
              <td className="px-3 py-2">
                <a href={`/profile/${r.referredUserId}`} className="font-medium hover:underline">
                  {r.referredName ?? r.referredEmail}
                </a>
              </td>
              <td className="px-3 py-2 text-muted-foreground">{fmtDate(r.joinedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
