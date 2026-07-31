"use client";

import { useMemo, useState } from "react";

import { UserStatusButton } from "./user-status-button";
import {
  filterAndSortUsers,
  fullNameOf,
  roleLabelOf,
  type AdminUser,
  type SortDir,
  type SortKey,
} from "./users-table.utils";

function fmtDate(d: Date | string) {
  return new Date(d).toLocaleString("ro-RO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

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

export function UsersTable({ users }: { users: AdminUser[] }) {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const filtered = useMemo(
    () => filterAndSortUsers(users, query, sortKey, sortDir),
    [users, query, sortKey, sortDir],
  );

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Caută după nume, email sau rol…"
          className="w-full max-w-xs rounded-lg border border-border bg-background px-3 py-1.5 text-sm outline-none focus:border-foreground/40"
        />
        <span className="shrink-0 font-mono text-[13px] text-muted-foreground">
          {filtered.length} / {users.length}
        </span>
      </div>

      <div className="max-h-[520px] overflow-y-auto overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 z-10 border-b border-border bg-secondary text-[12px] uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5">
                <SortButton
                  label="Nume"
                  active={sortKey === "name"}
                  dir={sortDir}
                  onClick={() => toggleSort("name")}
                />
              </th>
              <th className="px-4 py-2.5 font-medium">Email</th>
              <th className="px-4 py-2.5">
                <SortButton
                  label="Rol"
                  active={sortKey === "role"}
                  dir={sortDir}
                  onClick={() => toggleSort("role")}
                />
              </th>
              <th className="px-4 py-2.5">
                <SortButton
                  label="Creat"
                  active={sortKey === "createdAt"}
                  dir={sortDir}
                  onClick={() => toggleSort("createdAt")}
                />
              </th>
              <th className="px-4 py-2.5 font-medium">Acțiuni</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                  {users.length === 0 ? "Niciun user încă." : "Niciun rezultat pentru căutarea curentă."}
                </td>
              </tr>
            ) : (
              filtered.map((u) => {
                const fullName = fullNameOf(u) || "—";
                const roleLabel = roleLabelOf(u) || "—";
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
                    <td className="px-4 py-2.5">
                      {u.status === "DELETED" ? (
                        <span className="text-[12px] text-muted-foreground">—</span>
                      ) : (
                        <UserStatusButton
                          userId={u.id}
                          email={u.email}
                          status={u.status === "SUSPENDED" ? "SUSPENDED" : "ACTIVE"}
                        />
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
