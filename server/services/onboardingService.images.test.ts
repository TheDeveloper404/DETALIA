import { beforeEach, expect, it, vi } from "vitest";

vi.mock("@/server/repos/usersRepo", () => ({ completeOnboardingProfileAndRole: vi.fn() }));
vi.mock("@/server/repos/rolesRepo", () => ({ getRoleByUserId: vi.fn() }));
vi.mock("@/lib/blob-url", () => ({ isUsersBlobUrl: vi.fn(() => true) }));
vi.mock("@/lib/image-processing", () => ({ reprocessBlobImage: vi.fn() }));
vi.mock("@/lib/storage", () => ({ deleteBlobs: vi.fn() }));

import { reprocessBlobImage } from "@/lib/image-processing";
import { deleteBlobs } from "@/lib/storage";
import { getRoleByUserId } from "@/server/repos/rolesRepo";
import { completeOnboardingProfileAndRole } from "@/server/repos/usersRepo";
import { completeOnboarding } from "./onboardingService";

const input = { userId: "user", firstName: "First", lastName: "Last", roleMain: "EXECUTANT", subRole: " Electrician ", secondaryRole: null, headline: null, location: null, county: null, company: null, website: null, avatarUrl: "https://store.test/staged-avatar.png", coverUrl: null, coverPosition: 50 };
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getRoleByUserId).mockResolvedValue(null as never);
  vi.mocked(reprocessBlobImage).mockResolvedValue({ ok: true, url: "https://store.test/new-avatar.webp" });
  vi.mocked(completeOnboardingProfileAndRole).mockResolvedValue(true);
});

// Regula aprobata: onboarding respins nu lasa profilul modificat; validarea precede procesarea imaginilor.
it("rolul invalid nu proceseaza imagini si nu incearca scrierea profilului", async () => {
  expect(await completeOnboarding({ ...input, roleMain: "INVALID" })).toEqual({ ok: false, error: "INVALID_ROLE" });
  expect(reprocessBlobImage).not.toHaveBeenCalled();
  expect(completeOnboardingProfileAndRole).not.toHaveBeenCalled();
});

it("succesul trimite numai imaginea reprocesata si rolul normalizat la commit", async () => {
  expect(await completeOnboarding(input)).toEqual({ ok: true });
  expect(completeOnboardingProfileAndRole).toHaveBeenCalledWith("user", expect.objectContaining({ image: "https://store.test/new-avatar.webp", subRole: "Electrician" }));
  expect(deleteBlobs).not.toHaveBeenCalled();
});

it("conflictul explicit de rol curata numai imaginea noua nefolosita", async () => {
  vi.mocked(completeOnboardingProfileAndRole).mockResolvedValue(false);
  expect(await completeOnboarding(input)).toEqual({ ok: false, error: "ALREADY_HAS_ROLE" });
  expect(deleteBlobs).toHaveBeenCalledWith(["https://store.test/new-avatar.webp", null]);
});

it("la un rezultat DB incert nu sterge o imagine care poate fi deja salvata", async () => {
  vi.mocked(completeOnboardingProfileAndRole).mockRejectedValue(new Error("connection lost after commit"));
  await expect(completeOnboarding(input)).rejects.toThrow("connection lost after commit");
  expect(deleteBlobs).not.toHaveBeenCalled();
});

it("procesarea partial esuata nu scrie profilul si curata numai imaginea procesata", async () => {
  vi.mocked(reprocessBlobImage).mockResolvedValueOnce({ ok: true, url: "https://store.test/new-avatar.webp" }).mockResolvedValueOnce({ ok: false });
  expect(await completeOnboarding({ ...input, coverUrl: "https://store.test/staged-cover.png" })).toEqual({ ok: false, error: "INVALID_TYPE" });
  expect(completeOnboardingProfileAndRole).not.toHaveBeenCalled();
  expect(deleteBlobs).toHaveBeenCalledWith(["https://store.test/new-avatar.webp"]);
});

// **Cautare avansata** (meniul „Filtre", 2026-10-28): „Oameni urmăriți", „Categorii urmărite", „Așteaptă ajutor", rolul autorului si judetul se combina cu cautarea si categoria; rezultatele si paginarea folosesc aceleasi conditii. Rolul urmeaza ceea ce se afiseaza, inclusiv snapshot-ul autorului retras. Judetul vine din profilul autorului (camp optional „Județ”, la onboarding si in editarea profilului), nu de pe detaliu: cu un judet ales apar doar detaliile autorilor care l-au setat, fara detaliile anonimizate. La stergerea contului judetul se goleste, ca restul profilului.
it("judetul ales la onboarding ajunge in profil; unul din afara listei e respins fara nicio scriere", async () => {
  expect(await completeOnboarding({ ...input, county: "Cluj" })).toEqual({ ok: true });
  expect(completeOnboardingProfileAndRole).toHaveBeenCalledWith("user", expect.objectContaining({ county: "Cluj" }));
  vi.mocked(completeOnboardingProfileAndRole).mockClear();
  vi.mocked(reprocessBlobImage).mockClear();
  expect(await completeOnboarding({ ...input, county: "Atlantida" })).toEqual({ ok: false, error: "INVALID_COUNTY" });
  expect(completeOnboardingProfileAndRole).not.toHaveBeenCalled();
  expect(reprocessBlobImage).not.toHaveBeenCalled();
});
