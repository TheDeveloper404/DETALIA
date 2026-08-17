import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/repos/profileRepo", () => ({
  getContributionCounts: vi.fn().mockResolvedValue(new Map()),
  getProfileStats: vi.fn().mockResolvedValue({
    published: 0,
    sketches: 0,
    validationsGiven: 0,
    validationsReceived: 0,
  }),
  listAuthorActivity: vi.fn().mockResolvedValue({ vRows: [], cRows: [], dRows: [] }),
  listAuthorDetails: vi.fn().mockResolvedValue([]),
  listAuthorSketches: vi.fn().mockResolvedValue([]),
}));
vi.mock("@/server/repos/usersRepo", () => ({
  getPublicProfile: vi.fn(),
  updateSeenBadges: vi.fn(),
}));

import { getContributionCounts, getProfileStats } from "@/server/repos/profileRepo";
import { getPublicProfile, updateSeenBadges } from "@/server/repos/usersRepo";

import { getProfileView, markBadgesSeen, memberSinceOf, roleLabelOf } from "./profileService";

const PROFILE_ROW = {
  name: "Ion Popescu",
  createdAt: new Date("2026-03-15T00:00:00Z"),
  seenBadges: {} as Record<string, string>,
  image: null,
  coverImage: null,
  coverPosition: 50,
  headline: null,
  about: null,
  location: null,
  website: null,
  company: null,
  email: "ion@exemplu.ro",
  emailVisible: false,
  phone: "0722 000 000",
  phoneVisible: false,
  roleMain: "EXECUTANT" as const,
  subRole: "Constructor general",
  verificationStatus: "UNVERIFIED",
};

const USER_ID = "22222222-2222-4222-8222-222222222222";
const OTHER_ID = "33333333-3333-4333-8333-333333333333";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getPublicProfile).mockResolvedValue(PROFILE_ROW as never);
});

// Convenție platformă: doar meseria (subRole) se afișează, NU domeniul (roleMain) — decizie de produs,
// unificată 2026-07-06 (era aplicată inconsecvent: edit-profile corect, profil/feed/rail arătau domeniul).

describe("roleLabelOf", () => {
  it("cu subRole → întoarce DOAR meseria, fără domeniu", () => {
    expect(roleLabelOf("PROIECTANT", "Arhitect")).toBe("Arhitect");
  });

  it("fără subRole → fallback pe eticheta domeniului (nu ar trebui să apară în practică, subRole e obligatoriu la onboarding)", () => {
    expect(roleLabelOf("PROIECTANT", null)).toBe("Proiectare");
  });

  it("fără roleMain → Rol nedeclarat", () => {
    expect(roleLabelOf(null, null)).toBe("Rol nedeclarat");
  });
});

describe("memberSinceOf", () => {
  it("formatează lună+an în română", () => {
    expect(memberSinceOf(new Date("2026-03-15T00:00:00Z"))).toBe("martie 2026");
  });
});

describe("getProfileView — memberSince (vizibil pe orice profil, nu doar al proprietarului)", () => {
  it("expune data de creare a contului, formatată", async () => {
    const view = await getProfileView(USER_ID, OTHER_ID);
    expect(view?.memberSince).toBe("martie 2026");
  });
});

describe("getProfileView — newlyEarnedBadges (pop-up „badge nou”, 2026-08-17)", () => {
  it("vizitator (nu owner) → newlyEarnedBadges mereu gol, chiar dacă profilul are badge-uri necunoscute în snapshot", async () => {
    vi.mocked(getProfileStats).mockResolvedValue({
      published: 5, sketches: 0, validationsGiven: 0, validationsReceived: 0,
    });
    const view = await getProfileView(USER_ID, OTHER_ID);
    expect(view?.badges.length).toBeGreaterThan(0);
    expect(view?.newlyEarnedBadges).toEqual([]);
  });

  it("owner, fără snapshot văzut, cu un badge câștigat → apare în newlyEarnedBadges", async () => {
    vi.mocked(getProfileStats).mockResolvedValue({
      published: 1, sketches: 0, validationsGiven: 0, validationsReceived: 0,
    });
    const view = await getProfileView(USER_ID, USER_ID);
    expect(view?.newlyEarnedBadges).toEqual([
      { id: "contributor", label: "Contribuitor", description: "Detalii de execuție publicate", tier: "bronze" },
    ]);
  });

  it("owner, badge deja în snapshot la același tier → NU mai apare în newlyEarnedBadges", async () => {
    vi.mocked(getPublicProfile).mockResolvedValue({
      ...PROFILE_ROW,
      seenBadges: { contributor: "bronze" },
    } as never);
    vi.mocked(getProfileStats).mockResolvedValue({
      published: 1, sketches: 0, validationsGiven: 0, validationsReceived: 0,
    });
    const view = await getProfileView(USER_ID, USER_ID);
    expect(view?.newlyEarnedBadges).toEqual([]);
  });
});

describe("markBadgesSeen", () => {
  it("recalculează badge-urile server-side și salvează snapshot-ul curent", async () => {
    vi.mocked(getProfileStats).mockResolvedValue({
      published: 1, sketches: 0, validationsGiven: 5, validationsReceived: 0,
    });
    vi.mocked(getContributionCounts).mockResolvedValue(new Map([["2026-08-17", 1]]));
    await markBadgesSeen(USER_ID);
    expect(updateSeenBadges).toHaveBeenCalledWith(USER_ID, { contributor: "bronze", validator: "bronze" });
  });
});

describe("getProfileView — contact (telefon/email) strict opt-in prin bifă, INDIFERENT de viewer (2026-08-17, corectează bug-ul unde owner-ul vedea mereu telefonul chiar cu bifa scoasă)", () => {
  it("proprietarul cu flaguri FALSE NU vede telefonul/emailul pe propriul profil (bifa controlează, nu ownership-ul)", async () => {
    const view = await getProfileView(USER_ID, USER_ID);
    expect(view?.phone).toBeNull();
    expect(view?.email).toBeNull();
  });

  it("proprietarul cu flaguri TRUE vede telefonul/emailul pe propriul profil", async () => {
    vi.mocked(getPublicProfile).mockResolvedValue({
      ...PROFILE_ROW,
      phoneVisible: true,
      emailVisible: true,
    } as never);
    const view = await getProfileView(USER_ID, USER_ID);
    expect(view?.phone).toBe("0722 000 000");
    expect(view?.email).toBe("ion@exemplu.ro");
  });

  it("vizitator (nu proprietarul) + flaguri FALSE → NU vede nici telefonul, nici emailul", async () => {
    const view = await getProfileView(USER_ID, OTHER_ID);
    expect(view?.phone).toBeNull();
    expect(view?.email).toBeNull();
  });

  it("vizitator + phoneVisible true, emailVisible false → vede DOAR telefonul", async () => {
    vi.mocked(getPublicProfile).mockResolvedValue({
      ...PROFILE_ROW,
      phoneVisible: true,
    } as never);
    const view = await getProfileView(USER_ID, OTHER_ID);
    expect(view?.phone).toBe("0722 000 000");
    expect(view?.email).toBeNull();
  });

  it("vizitator + emailVisible true, phoneVisible false → vede DOAR emailul", async () => {
    vi.mocked(getPublicProfile).mockResolvedValue({
      ...PROFILE_ROW,
      emailVisible: true,
    } as never);
    const view = await getProfileView(USER_ID, OTHER_ID);
    expect(view?.email).toBe("ion@exemplu.ro");
    expect(view?.phone).toBeNull();
  });
});
