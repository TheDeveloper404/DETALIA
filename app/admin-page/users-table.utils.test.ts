import { describe, expect, it } from "vitest";

import {
  EMPTY_FILTERS,
  computeUserKpis,
  dayKey,
  filterAndSortUsers,
  filtersFromParams,
  filtersToParams,
  fullNameOf,
  lastSeenLabel,
  roleLabelOf,
  signupsByDay,
  topCounties,
  type AdminUser,
  type UserFilters,
} from "./users-table.utils";

const NOW = new Date("2026-11-07T10:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000);
const only = (patch: Partial<UserFilters>): UserFilters => ({ ...EMPTY_FILTERS, ...patch });

function makeUser(overrides: Partial<AdminUser>): AdminUser {
  return {
    id: "id",
    firstName: null,
    lastName: null,
    name: null,
    email: "user@example.com",
    status: "ACTIVE",
    roleMain: null,
    subRole: null,
    verification: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    county: null,
    referredByUserId: null,
    lastSeenAt: null,
    ...overrides,
  };
}

describe("fullNameOf", () => {
  it("joins first + last name when both present", () => {
    expect(fullNameOf(makeUser({ firstName: "Ana", lastName: "Pop" }))).toBe("Ana Pop");
  });

  it("falls back to name when first/last are missing", () => {
    expect(fullNameOf(makeUser({ name: "anapop" }))).toBe("anapop");
  });

  it("returns empty string when nothing is set", () => {
    expect(fullNameOf(makeUser({}))).toBe("");
  });
});

describe("roleLabelOf", () => {
  it("returns empty string when no role", () => {
    expect(roleLabelOf(makeUser({ roleMain: null }))).toBe("");
  });

  it("includes subRole when present", () => {
    const label = roleLabelOf(makeUser({ roleMain: "ARCHITECT", subRole: "Structural" }));
    expect(label).toContain("Structural");
  });
});

describe("filterAndSortUsers", () => {
  const users: AdminUser[] = [
    makeUser({
      id: "1",
      firstName: "Bogdan",
      lastName: "Ionescu",
      email: "bogdan@example.com",
      roleMain: "ARCHITECT",
      createdAt: new Date("2026-01-03T00:00:00Z"),
    }),
    makeUser({
      id: "2",
      firstName: "Ana",
      lastName: "Vasile",
      email: "ana@example.com",
      roleMain: "ENGINEER",
      createdAt: new Date("2026-01-01T00:00:00Z"),
    }),
    makeUser({
      id: "3",
      firstName: "Cristian",
      lastName: "Marin",
      email: "cristian@example.com",
      roleMain: null,
      createdAt: new Date("2026-01-02T00:00:00Z"),
    }),
  ];

  it("filters by name (case-insensitive)", () => {
    const result = filterAndSortUsers(users, only({ query: "ana" }), "name", "asc", NOW);
    expect(result.map((u) => u.id)).toEqual(["2"]);
  });

  it("filters by email substring", () => {
    const result = filterAndSortUsers(users, only({ query: "cristian@" }), "name", "asc", NOW);
    expect(result.map((u) => u.id)).toEqual(["3"]);
  });

  it("sorts by name ascending", () => {
    const result = filterAndSortUsers(users, only({ query: "" }), "name", "asc", NOW);
    expect(result.map((u) => u.id)).toEqual(["2", "1", "3"]);
  });

  it("sorts by createdAt descending (default)", () => {
    const result = filterAndSortUsers(users, only({ query: "" }), "createdAt", "desc", NOW);
    expect(result.map((u) => u.id)).toEqual(["1", "3", "2"]);
  });

  it("returns empty array when no match", () => {
    const result = filterAndSortUsers(users, only({ query: "nu-exista" }), "name", "asc", NOW);
    expect(result).toEqual([]);
  });
});

describe("filtre", () => {
  const users: AdminUser[] = [
    makeUser({ id: "a", roleMain: "PROIECTANT", subRole: "Arhitect", county: "Cluj", verification: "VERIFIED", createdAt: daysAgo(3), lastSeenAt: daysAgo(1) }),
    makeUser({ id: "b", roleMain: "EXECUTANT", subRole: "Electrician", county: "Timiș", verification: "DECLARED", createdAt: daysAgo(20), lastSeenAt: daysAgo(40) }),
    makeUser({ id: "c", roleMain: null, county: null, status: "SUSPENDED", createdAt: daysAgo(100) }),
  ];
  const ids = (f: UserFilters) => filterAndSortUsers(users, f, "name", "asc", NOW).map((u) => u.id).sort();

  // Regula: „Onboarding neterminat” = fara rol, aceeasi regula ca gate.hasRole din proxy.
  it("rol, inclusiv „fara rol”", () => {
    expect(ids(only({ role: "PROIECTANT" }))).toEqual(["a"]);
    expect(ids(only({ role: "NONE" }))).toEqual(["c"]);
  });

  it("sub-rol, judet (inclusiv necompletat), verificare, status", () => {
    expect(ids(only({ subRole: "Electrician" }))).toEqual(["b"]);
    expect(ids(only({ county: "Cluj" }))).toEqual(["a"]);
    expect(ids(only({ county: "NONE" }))).toEqual(["c"]);
    expect(ids(only({ verification: "VERIFIED" }))).toEqual(["a"]);
    expect(ids(only({ status: "SUSPENDED" }))).toEqual(["c"]);
  });

  it("inscris in ultimele N zile si ziua din grafic", () => {
    expect(ids(only({ joinedDays: "7" }))).toEqual(["a"]);
    expect(ids(only({ joinedDays: "30" }))).toEqual(["a", "b"]);
    expect(ids(only({ day: dayKey(daysAgo(20)) }))).toEqual(["b"]);
  });

  // Regula (Liviu 2026-11-07): inactiv = nicio vizita logata de 30 de zile (3a); fara date = „fara date”,
  // separat, nu intra la inactivi.
  it("activ / inactiv la pragul de 30 de zile; fara date nu e nici activ, nici inactiv", () => {
    expect(ids(only({ activity: "inactive" }))).toEqual(["b"]);
    expect(ids(only({ activity: "active" }))).toEqual(["a"]);
  });

  it("filtrele se combina", () => {
    expect(ids(only({ joinedDays: "30", activity: "inactive" }))).toEqual(["b"]);
  });

  it("sorteaza dupa judet si dupa ultima activitate", () => {
    expect(filterAndSortUsers(users, EMPTY_FILTERS, "county", "asc", NOW).map((u) => u.id)).toEqual(["c", "a", "b"]);
    expect(filterAndSortUsers(users, EMPTY_FILTERS, "lastSeenAt", "desc", NOW).map((u) => u.id)).toEqual(["a", "b", "c"]);
  });

  it("filtrele trec prin link si inapoi, valorile necunoscute la activitate sunt ignorate", () => {
    const f = only({ role: "NONE", county: "Cluj", activity: "inactive", day: "2026-10-23" });
    expect(filtersToParams(f).toString()).toBe("rol=NONE&judet=Cluj&activitate=inactive&zi=2026-10-23");
    expect(filtersFromParams(filtersToParams(f))).toEqual(f);
    expect(filtersFromParams(new URLSearchParams("activitate=oricum")).activity).toBe("");
  });

  // Regula: cautarea poate contine emailuri; URL-ul ajunge in PostHog (pageview) si in istoric.
  it("cautarea text nu intra in link si nici nu e citita din link", () => {
    expect(filtersToParams(only({ query: "ana@example.com", role: "NONE" })).toString()).toBe("rol=NONE");
    expect(filtersFromParams(new URLSearchParams("q=ana@example.com")).query).toBe("");
  });

  it("o zi invalida din link e ignorata, nu ajunge la formatare", () => {
    expect(filtersFromParams(new URLSearchParams("zi=abc")).day).toBe("");
    expect(filtersFromParams(new URLSearchParams("zi=2026-13-45")).day).toBe("");
    expect(filtersFromParams(new URLSearchParams("zi=2026-10-23")).day).toBe("2026-10-23");
  });
});

describe("statistici", () => {
  const users: AdminUser[] = [
    makeUser({ id: "a", roleMain: "PROIECTANT", county: "Cluj", createdAt: daysAgo(3), lastSeenAt: daysAgo(1) }),
    makeUser({ id: "b", roleMain: "EXECUTANT", county: "Cluj", createdAt: daysAgo(20), lastSeenAt: daysAgo(40) }),
    makeUser({ id: "c", roleMain: null, county: null, status: "SUSPENDED", createdAt: daysAgo(100) }),
  ];

  it("cifrele de sus", () => {
    expect(computeUserKpis(users, NOW)).toEqual({ total: 3, new7: 1, new30: 2, noRole: 1, inactive: 1, suspended: 1 });
  });

  it("inscrieri pe zi: 60 de zile consecutive, ultima = azi, zilele goale pe 0", () => {
    const days = signupsByDay(users, NOW);
    expect(days).toHaveLength(60);
    expect(days.at(-1)).toEqual({ day: "2026-11-07", count: 0 });
    expect(new Set(days.map((d) => d.day)).size).toBe(60);
    expect(days.find((d) => d.day === dayKey(daysAgo(3)))?.count).toBe(1);
    expect(days.reduce((s, d) => s + d.count, 0)).toBe(2);
  });

  // Ziua se numara in ora Romaniei: 23:30 UTC pe 22.10 e deja 23.10 la Bucuresti (UTC+3).
  it("inscrierea dupa miezul noptii in Romania cade pe ziua urmatoare", () => {
    const late = makeUser({ createdAt: new Date("2026-10-22T21:30:00Z") });
    expect(dayKey(late.createdAt)).toBe("2026-10-23");
  });

  it("inscrieri pe zi peste trecerea la ora de iarna (25.10.2026) nu sar si nu dubleaza zile", () => {
    const days = signupsByDay([], new Date("2026-10-26T22:30:00Z"), 5).map((d) => d.day);
    expect(days).toEqual(["2026-10-23", "2026-10-24", "2026-10-25", "2026-10-26", "2026-10-27"]);
  });

  // 23:30 la Bucuresti pe 26.10, cu fereastra de 60 de zile peste schimbarea orei: ziua cea mai veche nu lipseste.
  it("60 de zile complete si in ultima ora a zilei, peste schimbarea orei", () => {
    const days = signupsByDay([], new Date("2026-10-26T21:30:00Z"));
    expect(days).toHaveLength(60);
    expect(days[0].day).toBe("2026-08-28");
    expect(days.at(-1)!.day).toBe("2026-10-26");
  });

  it("top judete, cu „necompletat” la final", () => {
    expect(topCounties(users)).toEqual([
      { county: "Cluj", count: 2 },
      { county: "NONE", count: 1 },
    ]);
  });

  it("ultima activitate: azi, ieri, acum N zile, fara date", () => {
    expect(lastSeenLabel(NOW, NOW)).toBe("azi");
    expect(lastSeenLabel(daysAgo(1), NOW)).toBe("ieri");
    expect(lastSeenLabel(daysAgo(12), NOW)).toBe("acum 12 zile");
    expect(lastSeenLabel(null, NOW)).toBe("fără date");
  });
});
