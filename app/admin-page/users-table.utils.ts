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
  county: string | null;
  referredByUserId: string | null;
  lastSeenAt: Date | string | null;
};

export type SortKey = "name" | "role" | "county" | "createdAt" | "lastSeenAt";
export type SortDir = "asc" | "desc";

// Valori goale = fara filtru. „NONE” la rol/judet = camp necompletat. Sunt stringuri ca sa stea in URL.
export type UserFilters = {
  query: string;
  role: string;
  subRole: string;
  county: string;
  verification: string;
  status: string;
  joinedDays: string;
  activity: "" | "inactive" | "active";
  day: string;
};

export const EMPTY_FILTERS: UserFilters = {
  query: "",
  role: "",
  subRole: "",
  county: "",
  verification: "",
  status: "",
  joinedDays: "",
  activity: "",
  day: "",
};

export const INACTIVE_DAYS = 30;
export const CHART_DAYS = 60;
const DAY_MS = 24 * 60 * 60 * 1000;

// Ziua calendaristica in Romania (YYYY-MM-DD), aceeasi pe server si in browser.
const dayFormat = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Bucharest" });
export function dayKey(d: Date | string) {
  return dayFormat.format(new Date(d));
}

export const STATUS_LABELS: Record<string, string> = { ACTIVE: "Activ", SUSPENDED: "Suspendat", DELETED: "Șters" };
export const VERIFICATION_LABELS: Record<string, string> = {
  DECLARED: "Declarat",
  PENDING: "În verificare",
  VERIFIED: "Verificat",
  REJECTED: "Respins",
};

export function fmtDay(d: Date | string) {
  return dayKey(d).split("-").reverse().join(".");
}

// „azi”, „ieri”, „acum N zile” dupa zilele calendaristice din Romania; fara valoare = „fără date”.
export function lastSeenLabel(d: Date | string | null, now: Date) {
  if (!d) return "fără date";
  const days = Math.round((Date.parse(dayKey(now)) - Date.parse(dayKey(d))) / DAY_MS);
  if (days <= 0) return "azi";
  if (days === 1) return "ieri";
  return `acum ${days} zile`;
}

// Fara `lastSeenAt` = „fără date” (inainte de colectare sau fara vizita inca): nici activ, nici inactiv.
export function isInactive(u: AdminUser, now: Date) {
  return !!u.lastSeenAt && now.getTime() - new Date(u.lastSeenAt).getTime() > INACTIVE_DAYS * DAY_MS;
}

export function isActive(u: AdminUser, now: Date) {
  return !!u.lastSeenAt && !isInactive(u, now);
}

export function fullNameOf(u: AdminUser) {
  return [u.firstName, u.lastName].filter(Boolean).join(" ") || u.name || "";
}

export function roleLabelOf(u: AdminUser) {
  if (!u.roleMain) return "";
  const base = ROLE_MAIN_LABELS[u.roleMain as RoleMain] ?? u.roleMain;
  return u.subRole ? `${base} · ${u.subRole}` : base;
}

export function matchesFilters(u: AdminUser, f: UserFilters, now: Date) {
  const q = f.query.trim().toLowerCase();
  if (q) {
    const name = fullNameOf(u).toLowerCase();
    const role = roleLabelOf(u).toLowerCase();
    if (!name.includes(q) && !u.email.toLowerCase().includes(q) && !role.includes(q)) return false;
  }
  if (f.role && (f.role === "NONE" ? u.roleMain !== null : u.roleMain !== f.role)) return false;
  if (f.subRole && u.subRole !== f.subRole) return false;
  if (f.county && (f.county === "NONE" ? u.county !== null : u.county !== f.county)) return false;
  if (f.verification && u.verification !== f.verification) return false;
  if (f.status && u.status !== f.status) return false;
  if (f.joinedDays && now.getTime() - new Date(u.createdAt).getTime() > Number(f.joinedDays) * DAY_MS) return false;
  if (f.activity === "inactive" && !isInactive(u, now)) return false;
  if (f.activity === "active" && !isActive(u, now)) return false;
  if (f.day && dayKey(u.createdAt) !== f.day) return false;
  return true;
}

export function filterAndSortUsers(
  users: AdminUser[],
  filters: UserFilters,
  sortKey: SortKey,
  sortDir: SortDir,
  now: Date,
): AdminUser[] {
  const rows = users.filter((u) => matchesFilters(u, filters, now));
  const time = (d: Date | string | null) => (d ? new Date(d).getTime() : 0);

  const sorted = [...rows].sort((a, b) => {
    let cmp = 0;
    if (sortKey === "name") {
      cmp = fullNameOf(a).localeCompare(fullNameOf(b), "ro");
    } else if (sortKey === "role") {
      cmp = roleLabelOf(a).localeCompare(roleLabelOf(b), "ro");
    } else if (sortKey === "county") {
      cmp = (a.county ?? "").localeCompare(b.county ?? "", "ro");
    } else if (sortKey === "lastSeenAt") {
      cmp = time(a.lastSeenAt) - time(b.lastSeenAt);
    } else {
      cmp = time(a.createdAt) - time(b.createdAt);
    }
    return sortDir === "asc" ? cmp : -cmp;
  });

  return sorted;
}

// Cifrele de sus se calculeaza pe toti userii, independent de filtre.
export function computeUserKpis(users: AdminUser[], now: Date) {
  const joinedWithin = (u: AdminUser, days: number) => now.getTime() - new Date(u.createdAt).getTime() <= days * DAY_MS;
  return {
    total: users.length,
    new7: users.filter((u) => joinedWithin(u, 7)).length,
    new30: users.filter((u) => joinedWithin(u, 30)).length,
    noRole: users.filter((u) => u.roleMain === null).length,
    inactive: users.filter((u) => isInactive(u, now)).length,
    suspended: users.filter((u) => u.status === "SUSPENDED").length,
  };
}

// Inscrieri pe zi pentru ultimele CHART_DAYS zile, inclusiv azi, cu zilele fara inscrieri pe 0.
export function signupsByDay(users: AdminUser[], now: Date, days = CHART_DAYS) {
  const counts = new Map<string, number>();
  for (const u of users) {
    const k = dayKey(u.createdAt);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  // Zilele se numara pe calendar (Date.UTC), nu scazand 24h, ca schimbarea orei sa nu sara sau dubleze o zi.
  const [y, m, d] = dayKey(now).split("-").map(Number);
  const keys = Array.from({ length: days }, (_, i) => new Date(Date.UTC(y, m - 1, d - (days - 1 - i))).toISOString().slice(0, 10));
  return keys.map((day) => ({ day, count: counts.get(day) ?? 0 }));
}

export function countByRole(users: AdminUser[]) {
  const counts = new Map<string, number>();
  for (const u of users) counts.set(u.roleMain ?? "NONE", (counts.get(u.roleMain ?? "NONE") ?? 0) + 1);
  return counts;
}

// Primele `limit` judete dupa numar de useri; „NONE” (necompletat) separat, la final.
export function topCounties(users: AdminUser[], limit = 6) {
  const counts = new Map<string, number>();
  for (const u of users) counts.set(u.county ?? "NONE", (counts.get(u.county ?? "NONE") ?? 0) + 1);
  const none = counts.get("NONE") ?? 0;
  counts.delete("NONE");
  const top = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ro"))
    .slice(0, limit)
    .map(([county, count]) => ({ county, count }));
  return none > 0 ? [...top, { county: "NONE", count: none }] : top;
}

// Numele parametrilor din link (`/admin-page?rol=NONE&judet=Cluj`), ca un filtru sa poata fi trimis.
// Cautarea text NU intra in link: poate contine emailuri, iar URL-ul ajunge in PostHog si in istoric.
const PARAM_NAMES: Record<Exclude<keyof UserFilters, "query">, string> = {
  role: "rol",
  subRole: "subrol",
  county: "judet",
  verification: "verificare",
  status: "status",
  joinedDays: "inscris",
  activity: "activitate",
  day: "zi",
};

export function filtersFromParams(params: URLSearchParams): UserFilters {
  const f = { ...EMPTY_FILTERS };
  for (const key of Object.keys(PARAM_NAMES) as (keyof typeof PARAM_NAMES)[]) {
    const value = params.get(PARAM_NAMES[key]) ?? "";
    if (key === "activity") f.activity = value === "inactive" || value === "active" ? value : "";
    // O zi invalida ar arunca la formatare; o ignoram.
    else if (key === "day") f.day = /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) ? value : "";
    else f[key] = value;
  }
  return f;
}

export function filtersToParams(f: UserFilters): URLSearchParams {
  const params = new URLSearchParams();
  for (const key of Object.keys(PARAM_NAMES) as (keyof typeof PARAM_NAMES)[]) {
    if (f[key]) params.set(PARAM_NAMES[key], f[key]);
  }
  return params;
}
