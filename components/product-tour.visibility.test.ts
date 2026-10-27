import { afterEach, beforeEach, expect, it, vi } from "vitest";

const { effects, driver, drive, destroy, replace, markSeen } = vi.hoisted(() => ({
  effects: [] as (() => void | (() => void))[],
  driver: vi.fn(), drive: vi.fn(), destroy: vi.fn(), replace: vi.fn(), markSeen: vi.fn(),
}));
vi.mock("react", async (original) => ({
  ...await original<typeof import("react")>(),
  useState: (initial: unknown) => [initial, vi.fn()],
  useEffect: (effect: () => void | (() => void)) => { effects.push(effect); },
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }), usePathname: () => "/feed" }));
vi.mock("driver.js", () => ({ driver }));
vi.mock("@/app/(app)/profile/actions", () => ({ confirmDetailTourSeenAction: markSeen }));

import { DetailProductTour } from "./detail-product-tour";
import { ProductTour } from "./product-tour";

beforeEach(() => { effects.length = 0; vi.clearAllMocks(); driver.mockReturnValue({ drive, destroy }); });
afterEach(() => vi.unstubAllGlobals());

// Regula aprobata: "trebuie sa ramana doar pe web si poate pe tableta (pe telefon trebuie eliminat)".
it.each([375, 767, 768, 1024])("tururile feed/detaliu pornesc numai de la latimea md, %s px", (width) => {
  vi.stubGlobal("window", { matchMedia: (query: string) => ({ matches: width >= Number(query.match(/\d+/)?.[0]) }) });
  ProductTour({ active: true, hasFeedItems: true });
  DetailProductTour({ seen: false });
  const cleanups = effects.map((effect) => effect());
  expect(drive).toHaveBeenCalledTimes(width >= 768 ? 2 : 0);
  expect(markSeen).toHaveBeenCalledTimes(width >= 768 ? 1 : 0);
  expect(replace).toHaveBeenCalledWith("/feed", { scroll: false });
  cleanups.forEach((cleanup) => cleanup?.());
  expect(destroy).toHaveBeenCalledTimes(width >= 768 ? 2 : 0);
});
