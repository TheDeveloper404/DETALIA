import { describe, expect, it } from "vitest";

import { filterAndSortUsers, fullNameOf, roleLabelOf, type AdminUser } from "./users-table.utils";

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
    const result = filterAndSortUsers(users, "ana", "name", "asc");
    expect(result.map((u) => u.id)).toEqual(["2"]);
  });

  it("filters by email substring", () => {
    const result = filterAndSortUsers(users, "cristian@", "name", "asc");
    expect(result.map((u) => u.id)).toEqual(["3"]);
  });

  it("sorts by name ascending", () => {
    const result = filterAndSortUsers(users, "", "name", "asc");
    expect(result.map((u) => u.id)).toEqual(["2", "1", "3"]);
  });

  it("sorts by createdAt descending (default)", () => {
    const result = filterAndSortUsers(users, "", "createdAt", "desc");
    expect(result.map((u) => u.id)).toEqual(["1", "3", "2"]);
  });

  it("returns empty array when no match", () => {
    const result = filterAndSortUsers(users, "nu-exista", "name", "asc");
    expect(result).toEqual([]);
  });
});
