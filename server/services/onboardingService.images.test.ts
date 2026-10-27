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

const input = { userId: "user", firstName: "First", lastName: "Last", roleMain: "EXECUTANT", subRole: " Electrician ", secondaryRole: null, headline: null, location: null, company: null, website: null, avatarUrl: "https://store.test/staged-avatar.png", coverUrl: null, coverPosition: 50 };
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
