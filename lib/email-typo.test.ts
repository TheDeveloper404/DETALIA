import { describe, expect, it } from "vitest";

import { suggestEmailFix } from "./email-typo";

describe("suggestEmailFix", () => {
  it.each([
    ["ion@gmail.con", "ion@gmail.com"],
    ["ion@gmial.com", "ion@gmail.com"],
    ["ion@gmail.co", "ion@gmail.com"],
    ["ion@gmail", "ion@gmail.com"],
    ["ion@yaho.com", "ion@yahoo.com"],
    ["ion@yahoo.rp", null],
    ["ion@yaho.ro", "ion@yahoo.ro"],
    ["ion@hotmial.com", "ion@hotmail.com"],
    ["ion@outlok.com", "ion@outlook.com"],
    ["ion@icloud.cmo", "ion@icloud.com"],
    ["ion@firma.con", "ion@firma.com"],
    ["Ion@Gmail.Con", "Ion@gmail.com"],
    ["ion@ymail.con", "ion@ymail.com"],
    ["ion@mail.con", "ion@mail.com"],
    ["ion@hotmal.fr", null],
    ["ion@yaho.fr", null],
    ["ion@cloud.ro", null],
  ])("%s → %s", (input, expected) => {
    expect(suggestEmailFix(input)).toBe(expected);
  });

  it.each([
    "ion@gmail.com",
    "ion@yahoo.ro",
    "ion@yahoo.fr",
    "ion@live.ro",
    "ion@mail.com",
    "ion@email.com",
    "ion@email.ro",
    "ion@firma.ro",
    "ion@detalia.ro",
    "ion@aimarchitecture.ro",
    "fara-arond",
    "",
  ])("%s → null (adresă plauzibilă sau incompletă)", (input) => {
    expect(suggestEmailFix(input)).toBeNull();
  });
});
