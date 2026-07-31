import { ROLE_MAIN_LABELS, type RoleMain } from "@/server/domain/roles";

export type AdminUser = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  name: string | null;
  email: string;
  status: string;
  roleMain: string | null;
  subRole: string | null;
  verification: string | null;
  createdAt: Date | string;
};

export type SortKey = "name" | "role" | "createdAt";
export type SortDir = "asc" | "desc";

export function fullNameOf(u: AdminUser) {
  return [u.firstName, u.lastName].filter(Boolean).join(" ") || u.name || "";
}

export function roleLabelOf(u: AdminUser) {
  if (!u.roleMain) return "";
  const base = ROLE_MAIN_LABELS[u.roleMain as RoleMain] ?? u.roleMain;
  return u.subRole ? `${base} · ${u.subRole}` : base;
}

export function filterAndSortUsers(
  users: AdminUser[],
  query: string,
  sortKey: SortKey,
  sortDir: SortDir,
): AdminUser[] {
  const q = query.trim().toLowerCase();
  const rows = q
    ? users.filter((u) => {
        const name = fullNameOf(u).toLowerCase();
        const role = roleLabelOf(u).toLowerCase();
        return name.includes(q) || u.email.toLowerCase().includes(q) || role.includes(q);
      })
    : users;

  const sorted = [...rows].sort((a, b) => {
    let cmp = 0;
    if (sortKey === "name") {
      cmp = fullNameOf(a).localeCompare(fullNameOf(b), "ro");
    } else if (sortKey === "role") {
      cmp = roleLabelOf(a).localeCompare(roleLabelOf(b), "ro");
    } else {
      cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    }
    return sortDir === "asc" ? cmp : -cmp;
  });

  return sorted;
}
