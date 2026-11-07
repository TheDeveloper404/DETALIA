"use client";

import { ROLE_MAINS, ROLE_MAIN_LABELS } from "@/server/domain/roles";

import {
  CHART_DAYS,
  EMPTY_FILTERS,
  INACTIVE_DAYS,
  computeUserKpis,
  matchesFilters,
  countByRole,
  signupsByDay,
  topCounties,
  type AdminUser,
  type UserFilters,
} from "./users-table.utils";

// Cifre, inscrieri pe zi si defalcari. Fiecare element seteaza un filtru pe tabelul de dedesubt.
// Graficul si defalcarile urmeaza celelalte filtre active, nu si pe al lor (altfel ar arata o singura bara).
export function UsersOverview({
  users,
  filters,
  now,
  onFilters,
}: {
  users: AdminUser[];
  filters: UserFilters;
  now: Date;
  onFilters: (f: UserFilters) => void;
}) {
  const kpis = computeUserKpis(users, now);
  const match = (u: AdminUser, f: UserFilters) => matchesFilters(u, f, now);
  const days = signupsByDay(users.filter((u) => match(u, { ...filters, day: "" })), now);
  const byRole = countByRole(users.filter((u) => match(u, { ...filters, role: "", subRole: "" })));
  const counties = topCounties(users.filter((u) => match(u, { ...filters, county: "" })));
  const maxDay = Math.max(1, ...days.map((d) => d.count));
  const maxRole = Math.max(1, ...byRole.values());
  const maxCounty = Math.max(1, ...counties.map((c) => c.count));

  const tiles: { label: string; value: number; set: Partial<UserFilters>; warn?: boolean }[] = [
    { label: "Total useri", value: kpis.total, set: {} },
    { label: "Noi, ultimele 7 zile", value: kpis.new7, set: { joinedDays: "7" } },
    { label: "Noi, ultimele 30 de zile", value: kpis.new30, set: { joinedDays: "30" } },
    { label: "Onboarding neterminat", value: kpis.noRole, set: { role: "NONE" }, warn: true },
    { label: `Inactivi ${INACTIVE_DAYS}+ zile`, value: kpis.inactive, set: { activity: "inactive" } },
    { label: "Suspendați", value: kpis.suspended, set: { status: "SUSPENDED" } },
  ];
  const isOnly = (set: Partial<UserFilters>) =>
    (Object.keys(EMPTY_FILTERS) as (keyof UserFilters)[]).every((k) => filters[k] === (set[k] ?? ""));

  const roleRows = [...ROLE_MAINS, "NONE"].map((r) => ({
    value: r,
    label: r === "NONE" ? "Fără rol (onboarding neterminat)" : ROLE_MAIN_LABELS[r as keyof typeof ROLE_MAIN_LABELS],
    count: byRole.get(r) ?? 0,
  }));

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
        {tiles.map((t) => (
          <button
            key={t.label}
            type="button"
            aria-pressed={isOnly(t.set)}
            onClick={() => onFilters({ ...EMPTY_FILTERS, ...t.set })}
            className="flex flex-col gap-0.5 rounded-xl border border-border bg-card px-3.5 py-3 text-left hover:border-primary aria-pressed:border-primary aria-pressed:ring-1 aria-pressed:ring-primary"
          >
            <span className={`font-mono text-2xl font-bold tabular-nums ${t.warn ? "text-[#9a6a12]" : ""}`}>{t.value}</span>
            <span className="text-[12.5px] text-muted-foreground">{t.label}</span>
          </button>
        ))}
      </div>

      <div className="grid gap-2.5 lg:grid-cols-[2fr_1fr_1fr]">
        <div className="flex min-w-0 flex-col gap-2 rounded-xl border border-border bg-card p-3.5">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Înscrieri pe zi</h3>
            <span className="font-mono text-[11px] text-muted-foreground">max {maxDay}</span>
          </div>
          <div className="flex h-36 items-end gap-px border-b border-border">
            {days.map((d) => (
              <button
                key={d.day}
                type="button"
                title={`${d.day.split("-").reverse().join(".")}: ${d.count} înscrieri`}
                aria-label={`${d.day.split("-").reverse().join(".")}: ${d.count} înscrieri`}
                aria-pressed={filters.day === d.day}
                onClick={() => onFilters({ ...filters, day: filters.day === d.day ? "" : d.day })}
                className="flex h-full min-w-0 flex-1 items-end rounded-t-sm hover:bg-secondary aria-pressed:bg-secondary"
              >
                <span
                  className={`block w-full rounded-t-sm ${filters.day === d.day ? "bg-destructive" : "bg-primary/85"}`}
                  style={{ height: `${(d.count / maxDay) * 100}%` }}
                />
              </button>
            ))}
          </div>
          <div className="flex justify-between font-mono text-[10.5px] text-muted-foreground">
            <span>{days[0]?.day.slice(5).split("-").reverse().join(".")}</span>
            <span>ultimele {CHART_DAYS} de zile · click pe o zi filtrează tabelul</span>
            <span>azi</span>
          </div>
        </div>

        <BarList
          title="Pe rol"
          rows={roleRows}
          max={maxRole}
          active={filters.role}
          onPick={(v) => onFilters({ ...filters, role: filters.role === v ? "" : v, subRole: "" })}
        />
        <BarList
          title="Top județe"
          rows={counties.map((c) => ({ value: c.county, label: c.county === "NONE" ? "Județ necompletat" : c.county, count: c.count }))}
          max={maxCounty}
          active={filters.county}
          onPick={(v) => onFilters({ ...filters, county: filters.county === v ? "" : v })}
        />
      </div>
    </div>
  );
}

function BarList({
  title,
  rows,
  max,
  active,
  onPick,
}: {
  title: string;
  rows: { value: string; label: string; count: number }[];
  max: number;
  active: string;
  onPick: (value: string) => void;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5 rounded-xl border border-border bg-card p-3.5">
      <h3 className="mb-1 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      {rows.map((r) => (
        <button
          key={r.value}
          type="button"
          aria-pressed={active === r.value}
          onClick={() => onPick(r.value)}
          className="-mx-1.5 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-0.5 rounded-md px-1.5 py-1 text-left hover:bg-secondary aria-pressed:bg-secondary"
        >
          <span className="truncate text-[13px]">{r.label}</span>
          <span className="font-mono text-[12px] tabular-nums text-muted-foreground">{r.count}</span>
          <span className="col-span-2 h-1.5 overflow-hidden rounded-full bg-secondary">
            <span
              className={`block h-full rounded-full ${r.value === "NONE" ? "bg-[#9a6a12]" : "bg-primary"}`}
              style={{ width: `${(r.count / max) * 100}%` }}
            />
          </span>
        </button>
      ))}
    </div>
  );
}
