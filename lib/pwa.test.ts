import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { expect, it, vi } from "vitest";
import manifest from "@/app/manifest";
// **PWA:** aplicatie instalabila pe telefon, cu acces online; fara continut privat salvat offline, push sau sincronizare in fundal.
it("workerul activeaza controlul fara interceptare fetch, Cache Storage sau push", async () => {
  const events = new Map<string, (event: { waitUntil: (p: Promise<unknown>) => void }) => void>();
  const pending: Promise<unknown>[] = [];
  const claim = vi.fn().mockResolvedValue(undefined),
    skipWaiting = vi.fn().mockResolvedValue(undefined);
  runInNewContext(readFileSync("public/sw.js", "utf8"), {
    self: {
      addEventListener: (name: string, fn: never) => events.set(name, fn),
      clients: { claim },
      skipWaiting,
    },
  });
  const event = {
    waitUntil: (p: Promise<unknown>) => {
      pending.push(p);
    },
  };
  events.get("install")!(event);
  events.get("activate")!(event);
  await Promise.all(pending);
  expect(claim).toHaveBeenCalledOnce();
  expect(skipWaiting).toHaveBeenCalledOnce();
  expect([...events.keys()].sort()).toEqual(["activate", "install"]);
});
// **PWA:** aplicatie instalabila pe telefon, cu acces online; fara continut privat salvat offline, push sau sincronizare in fundal.
it("manifestul are identitate, scope si PNG-urile la dimensiunile declarate", () => {
  const m = manifest();
  expect(m.display).toBe("standalone");
  expect(m.scope).toBe("/");
  expect(m.start_url).toBe("/");
  for (const size of [192, 512]) {
    expect(m.icons).toContainEqual({
      src: "/pwa-" + size + ".png",
      sizes: size + "x" + size,
      type: "image/png",
    });
    const bytes = readFileSync("public/pwa-" + size + ".png");
    expect(bytes.readUInt32BE(16)).toBe(size);
    expect(bytes.readUInt32BE(20)).toBe(size);
  }
});
