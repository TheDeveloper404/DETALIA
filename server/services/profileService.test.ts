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
}));

import { getPublicProfile } from "@/server/repos/usersRepo";

import { getProfileView, roleLabelOf } from "./profileService";

const PROFILE_ROW = {
  name: "Ion Popescu",
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

// Convenție platformă: doar meseria (subRole) se afișează, NU domeniul (roleMain) — decizie Edi,
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

describe("getProfileView — contact (telefon/email) opt-in, redactat pe server (2026-07-16)", () => {
  it("proprietarul vede ÎNTOTDEAUNA telefonul/emailul lui, chiar dacă nu sunt vizibile public", async () => {
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
