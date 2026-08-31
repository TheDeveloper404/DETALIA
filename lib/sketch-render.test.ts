import { describe, expect, it } from "vitest";

import { resolveExportWidth } from "./sketch-render";

// BUG găsit 2026-08-18: exportul thumbnail-ului de schiță (trimis ca `imageUrl` la „Trimite în Planșă")
// se făcea mereu la REFERENCE_WIDTH (1000px), indiferent de rezoluția reală a imaginii-mamă (până la
// 4096px) — pierdere de rezoluție la fiecare refolosire. Fix: urmează `naturalWidth`, plafonat la limita
// serverului.
describe("resolveExportWidth", () => {
  it("urmează naturalWidth când e sub plafon", () => {
    expect(resolveExportWidth(1600, 1000, 4096)).toBe(1600);
  });

  it("plafonează la `cap` când imaginea-mamă e peste limita serverului", () => {
    expect(resolveExportWidth(6000, 1000, 4096)).toBe(4096);
  });

  it("naturalWidth exact la plafon → rămâne neschimbat", () => {
    expect(resolveExportWidth(4096, 1000, 4096)).toBe(4096);
  });

  it("fără imagine-mamă (foaie goală) → fallback, nu plafonul", () => {
    expect(resolveExportWidth(null, 1000, 4096)).toBe(1000);
  });

  it("naturalWidth mic (imagine mică) → nu se mărește artificial peste rezoluția reală", () => {
    expect(resolveExportWidth(400, 1000, 4096)).toBe(400);
  });
});
