import { describe, expect, it } from "vitest";

import { isUuid } from "./ids";

describe("isUuid — SEC-11: id malformat nu trebuie să ajungă la DB", () => {
  it("acceptă UUID-uri valide (inclusiv v4 gen_random_uuid)", () => {
    expect(isUuid("3f2504e0-4f89-41d3-9a0c-0305e82c3301")).toBe(true);
    expect(isUuid("00000000-0000-0000-0000-000000000000")).toBe(true);
    expect(isUuid("3F2504E0-4F89-41D3-9A0C-0305E82C3301")).toBe(true); // case-insensitive
  });

  it("respinge formatele greșite", () => {
    expect(isUuid("not-a-uuid")).toBe(false);
    expect(isUuid("123")).toBe(false);
    expect(isUuid("")).toBe(false);
    expect(isUuid("3f2504e0-4f89-41d3-9a0c-0305e82c3301x")).toBe(false); // caracter în plus
    expect(isUuid("3f2504e04f8941d39a0c0305e82c3301")).toBe(false); // fără cratime
    expect(isUuid("'; DROP TABLE details; --")).toBe(false); // tentativă de injection
  });

  it("respinge non-string", () => {
    expect(isUuid(null)).toBe(false);
    expect(isUuid(undefined)).toBe(false);
    expect(isUuid(123)).toBe(false);
    expect(isUuid({})).toBe(false);
  });
});
