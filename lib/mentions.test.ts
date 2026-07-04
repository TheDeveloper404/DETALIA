import { describe, expect, it } from "vitest";

import {
  buildMentionToken,
  mentionsToDisplay,
  parseMentions,
  replaceLabelsWithTokens,
} from "./mentions";

const SID = "11111111-2222-4333-8444-555555555555";
const SID2 = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

describe("replaceLabelsWithTokens", () => {
  it("înlocuiește eticheta cu tokenul ei", () => {
    const labels = new Map([["Ana", SID]]);
    expect(replaceLabelsWithTokens("Salut @Ana !", labels)).toBe(
      `Salut ${buildMentionToken("Ana", SID)} !`,
    );
  });

  it("NU se potrivește pe prefix de cuvânt (@Ana în @Anatol) — anti-corupere corp", () => {
    const labels = new Map([["Ana", SID]]);
    const out = replaceLabelsWithTokens("@Ana zice, dar @Anatol nu e de acord", labels);
    expect(out).toBe(`${buildMentionToken("Ana", SID)} zice, dar @Anatol nu e de acord`);
    expect(out).not.toContain("](sid:" + SID + ")tol");
  });

  it("etichetele lungi au prioritate (Nume — schița 2 înaintea lui Nume)", () => {
    const labels = new Map([
      ["Ana", SID],
      ["Ana — schița 2", SID2],
    ]);
    const out = replaceLabelsWithTokens("@Ana — schița 2 și @Ana", labels);
    expect(out).toBe(`${buildMentionToken("Ana — schița 2", SID2)} și ${buildMentionToken("Ana", SID)}`);
  });

  it("nu re-lovește tokenii deja formați", () => {
    const labels = new Map([["Ana", SID]]);
    const once = replaceLabelsWithTokens("@Ana", labels);
    expect(replaceLabelsWithTokens(once, labels)).toBe(once);
  });

  it("etichete cu caractere speciale regex nu aruncă și se potrivesc literal", () => {
    const labels = new Map([["A+B C.D", SID]]);
    expect(replaceLabelsWithTokens("@A+B C.D ok", labels)).toBe(
      `${buildMentionToken("A+B C.D", SID)} ok`,
    );
  });
});

describe("mentionsToDisplay", () => {
  it("tokenii devin @Etichetă + maparea etichetă→sid", () => {
    const body = `Vezi ${buildMentionToken("Ana", SID)} și ${buildMentionToken("Dan", SID2)}.`;
    const { display, labels } = mentionsToDisplay(body);
    expect(display).toBe("Vezi @Ana și @Dan.");
    expect(labels.get("Ana")).toBe(SID);
    expect(labels.get("Dan")).toBe(SID2);
  });

  it("round-trip display→tokeni reconstruiește corpul original", () => {
    const body = `Start ${buildMentionToken("Ana — schița 2", SID)} mijloc ${buildMentionToken("Ana", SID2)} final`;
    const { display, labels } = mentionsToDisplay(body);
    expect(replaceLabelsWithTokens(display, labels)).toBe(body);
  });

  it("text fără tokeni rămâne neschimbat, fără etichete", () => {
    const { display, labels } = mentionsToDisplay("text simplu cu @cratimă");
    expect(display).toBe("text simplu cu @cratimă");
    expect(labels.size).toBe(0);
  });
});

describe("parseMentions (sanity pe format)", () => {
  it("sparge corect text + mențiune", () => {
    const body = `a ${buildMentionToken("Ana", SID)} b`;
    expect(parseMentions(body)).toEqual([
      { type: "text", value: "a " },
      { type: "mention", name: "Ana", sketchId: SID },
      { type: "text", value: " b" },
    ]);
  });
});
