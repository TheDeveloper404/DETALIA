"use client";

import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import { RolePill } from "@/components/role-pill";
import { ROLE_MAINS, ROLE_MAIN_LABELS } from "@/server/domain/roles";

import { UserDetail } from "./user-detail";
import { UsersOverview } from "./users-overview";
import {
  EMPTY_FILTERS,
  INACTIVE_DAYS,
  STATUS_LABELS,
  VERIFICATION_LABELS,
  filterAndSortUsers,
  filtersFromParams,
  filtersToParams,
  fmtDay,
  fullNameOf,
  isInactive,
  lastSeenLabel,
  type AdminUser,
  type SortDir,
  type SortKey,
  type UserFilters,
} from "./users-table.utils";

function SortButton({
  label,
  active,
  dir,
  onClick,
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1 font-medium hover:text-foreground"
    >
      {label}
      <span className={active ? "text-foreground" : "text-muted-foreground/40"}>
        {active && dir === "desc" ? "↓" : "↑"}
      </span>
    </button>
  );
}

const selectClass =
  "rounded-lg border border-border bg-background px-2 py-1.5 text-[13px] outline-none focus:border-foreground/40 data-[on=true]:border-primary data-[on=true]:bg-primary/10";

// `now` vine de pe server, ca randarea pe server si in browser sa calculeze aceleasi cifre.
export function UsersTable({ users, now: nowIso }: { users: AdminUser[]; now: string }) {
  const now = useMemo(() => new Date(nowIso), [nowIso]);
  const searchParams = useSearchParams();
  // Cautarea text sta doar in memorie (vezi PARAM_NAMES); restul filtrelor vin din link.
  const [query, setQuery] = useState("");
  const filters = useMemo(
    () => ({ ...filtersFromParams(new URLSearchParams(searchParams.toString())), query }),
    [searchParams, query],
  );
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  // Id, nu index: lista se reordoneaza la filtrare/sortare.
  const [openId, setOpenId] = useState<string | null>(null);

  // replaceState schimba linkul fara cerere la server; useSearchParams preia valoarea noua.
  function setFilters(f: UserFilters) {
    setQuery(f.query);
    const qs = filtersToParams(f).toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  }
  const set = (patch: Partial<UserFilters>) => setFilters({ ...filters, ...patch });

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const filtered = useMemo(
    () => filterAndSortUsers(users, filters, sortKey, sortDir, now),
    [users, filters, sortKey, sortDir, now],
  );
  const byId = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);
  const subRoles = useMemo(
    () => [...new Set(users.filter((u) => !filters.role || u.roleMain === filters.role).map((u) => u.subRole).filter((s): s is string => !!s))].sort((a, b) => a.localeCompare(b, "ro")),
    [users, filters.role],
  );
  const counties = useMemo(
    () => [...new Set(users.map((u) => u.county).filter((c): c is string => !!c))].sort((a, b) => a.localeCompare(b, "ro")),
    [users],
  );
  const opened = openId ? byId.get(openId) : undefined;

  return (
    <div className="flex flex-col gap-3">
      <UsersOverview users={users} filters={filters} now={now} onFilters={setFilters} />

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          aria-label="Caută"
          value={filters.query}
          onChange={(e) => set({ query: e.target.value })}
          placeholder="Caută după nume, email sau rol…"
          className="min-w-0 flex-[1_1_220px] rounded-lg border border-border bg-background px-3 py-1.5 text-sm outline-none focus:border-foreground/40"
        />
        <select aria-label="Rol" data-on={!!filters.role} value={filters.role} onChange={(e) => set({ role: e.target.value, subRole: "" })} className={selectClass}>
          <option value="">Rol: toate</option>
          {ROLE_MAINS.map((r) => (
            <option key={r} value={r}>{ROLE_MAIN_LABELS[r]}</option>
          ))}
          <option value="NONE">Fără rol</option>
        </select>
        <select aria-label="Sub-rol" data-on={!!filters.subRole} value={filters.subRole} onChange={(e) => set({ subRole: e.target.value })} className={selectClass}>
          <option value="">Sub-rol: toate</option>
          {subRoles.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select aria-label="Județ" data-on={!!filters.county} value={filters.county} onChange={(e) => set({ county: e.target.value })} className={selectClass}>
          <option value="">Județ: toate</option>
          {counties.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
          <option value="NONE">Necompletat</option>
        </select>
        <select aria-label="Verificare" data-on={!!filters.verification} value={filters.verification} onChange={(e) => set({ verification: e.target.value })} className={selectClass}>
          <option value="">Verificare: toate</option>
          {Object.entries(VERIFICATION_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select aria-label="Status" data-on={!!filters.status} value={filters.status} onChange={(e) => set({ status: e.target.value })} className={selectClass}>
          <option value="">Status: toate</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select aria-label="Înscris" data-on={!!filters.joinedDays} value={filters.joinedDays} onChange={(e) => set({ joinedDays: e.target.value })} className={selectClass}>
          <option value="">Înscris: oricând</option>
          <option value="7">ultimele 7 zile</option>
          <option value="30">ultimele 30 de zile</option>
          <option value="90">ultimele 90 de zile</option>
        </select>
        <select aria-label="Activitate" data-on={!!filters.activity} value={filters.activity} onChange={(e) => set({ activity: e.target.value as UserFilters["activity"] })} className={selectClass}>
          <option value="">Activitate: oricare</option>
          <option value="inactive">inactivi {INACTIVE_DAYS}+ zile</option>
          <option value="active">activi în ultimele {INACTIVE_DAYS} zile</option>
        </select>
        {filters.day && (
          <span className="rounded-lg border border-primary bg-primary/10 px-2 py-1.5 text-[13px]">Înscriși pe {fmtDay(filters.day)}</span>
        )}
        <button
          type="button"
          onClick={() => setFilters(EMPTY_FILTERS)}
          className="rounded-lg border border-border px-3 py-1.5 text-[13px] font-medium hover:bg-secondary"
        >
          Resetează
        </button>
        <span className="ml-auto shrink-0 font-mono text-[13px] text-muted-foreground">
          {filtered.length} / {users.length}
        </span>
      </div>

      <div className="h-130 overflow-y-auto overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[960px] text-left text-sm">
          <thead className="sticky top-0 z-10 border-b border-border bg-secondary text-[12px] uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5">
                <SortButton label="Nume" active={sortKey === "name"} dir={sortDir} onClick={() => toggleSort("name")} />
              </th>
              <th className="px-4 py-2.5 font-medium">Email</th>
              <th className="px-4 py-2.5">
                <SortButton label="Rol" active={sortKey === "role"} dir={sortDir} onClick={() => toggleSort("role")} />
              </th>
              <th className="px-4 py-2.5">
                <SortButton label="Județ" active={sortKey === "county"} dir={sortDir} onClick={() => toggleSort("county")} />
              </th>
              <th className="px-4 py-2.5 font-medium">Verificare</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5">
                <SortButton label="Înscris" active={sortKey === "createdAt"} dir={sortDir} onClick={() => toggleSort("createdAt")} />
              </th>
              <th className="px-4 py-2.5">
                <SortButton label="Ultima activitate" active={sortKey === "lastSeenAt"} dir={sortDir} onClick={() => toggleSort("lastSeenAt")} />
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-muted-foreground">
                  {users.length === 0 ? "Niciun user încă." : "Niciun user nu se potrivește filtrelor."}
                </td>
              </tr>
            ) : (
              filtered.map((u) => {
                const referrer = u.referredByUserId ? byId.get(u.referredByUserId) : undefined;
                return (
                  <tr
                    key={u.id}
                    onClick={() => setOpenId(u.id)}
                    className="cursor-pointer border-b border-border last:border-0 hover:bg-secondary/60"
                  >
                    <td className="px-4 py-2.5">
                      <button type="button" className="text-left font-medium hover:underline">
                        {fullNameOf(u) || "—"}
                      </button>
                      {referrer && (
                        <div className="text-[12px] text-muted-foreground">adus de {fullNameOf(referrer) || referrer.email}</div>
                      )}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-[13px]">{u.email}</td>
                    <td className="px-4 py-2.5">
                      {u.roleMain ? (
                        <RolePill roleMain={u.roleMain} subRole={u.subRole} verified={u.verification === "VERIFIED"} />
                      ) : (
                        <span className="text-[12px] text-[#9a6a12]">Fără rol</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">{u.county ?? <span className="text-muted-foreground">—</span>}</td>
                    <td className="px-4 py-2.5 text-[13px]">{u.verification ? (VERIFICATION_LABELS[u.verification] ?? u.verification) : "—"}</td>
                    <td className="px-4 py-2.5 text-[13px]">{STATUS_LABELS[u.status] ?? u.status}</td>
                    <td className="px-4 py-2.5 font-mono text-[13px] text-muted-foreground">{fmtDay(u.createdAt)}</td>
                    <td className={`px-4 py-2.5 text-[13px] ${isInactive(u, now) ? "text-[#9a6a12]" : "text-muted-foreground"}`}>
                      {lastSeenLabel(u.lastSeenAt, now)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {opened && (
        <UserDetail
          user={opened}
          referrer={opened.referredByUserId ? (byId.get(opened.referredByUserId) ?? null) : null}
          now={now}
          onClose={() => setOpenId(null)}
          onOpenUser={setOpenId}
        />
      )}
    </div>
  );
}
