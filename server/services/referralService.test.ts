import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/repos/usersRepo", () => ({
  getNotificationActor: vi.fn(),
  getReferralCode: vi.fn(),
  getUserIdByReferralCode: vi.fn(),
  listAllReferrals: vi.fn(),
  setReferralCodeIfAbsent: vi.fn(),
  setReferredByIfAbsent: vi.fn(),
}));
vi.mock("@/server/services/notificationService", () => ({ notifyReferralJoined: vi.fn() }));

import {
  getReferralCode,
  getUserIdByReferralCode,
  setReferralCodeIfAbsent,
  setReferredByIfAbsent,
  getNotificationActor,
} from "@/server/repos/usersRepo";
import { notifyReferralJoined } from "@/server/services/notificationService";

import { applyReferral, getOrCreateReferralCode } from "./referralService";

const REFERRER_ID = "11111111-1111-4111-8111-111111111111";
const NEW_USER_ID = "22222222-2222-4222-8222-222222222222";
const VALID_CODE = "23456789";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getNotificationActor).mockResolvedValue({ name: "Ion Nou" } as never);
});

describe("getOrCreateReferralCode", () => {
  it("cod deja existent → întors direct, fără generare/scriere", async () => {
    vi.mocked(getReferralCode).mockResolvedValue("EXISTING1");
    const code = await getOrCreateReferralCode(REFERRER_ID);
    expect(code).toBe("EXISTING1");
    expect(setReferralCodeIfAbsent).not.toHaveBeenCalled();
  });

  it("fără cod → generează unul nou și-l scrie", async () => {
    vi.mocked(getReferralCode).mockResolvedValue(null);
    vi.mocked(setReferralCodeIfAbsent).mockResolvedValue(true);
    const code = await getOrCreateReferralCode(REFERRER_ID);
    expect(code).toHaveLength(8);
    expect(setReferralCodeIfAbsent).toHaveBeenCalledTimes(1);
  });

  it("coliziune (write respins) → reîncearcă cu un cod nou, până reușește", async () => {
    vi.mocked(getReferralCode).mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    vi.mocked(setReferralCodeIfAbsent).mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const code = await getOrCreateReferralCode(REFERRER_ID);
    expect(code).toHaveLength(8);
    expect(setReferralCodeIfAbsent).toHaveBeenCalledTimes(2);
  });

  it("scriere eșuată pt că userul a primit deja cod concurent → întoarce codul existent, nu insistă", async () => {
    vi.mocked(getReferralCode).mockResolvedValueOnce(null).mockResolvedValueOnce("RACE0001");
    vi.mocked(setReferralCodeIfAbsent).mockResolvedValueOnce(false);
    const code = await getOrCreateReferralCode(REFERRER_ID);
    expect(code).toBe("RACE0001");
  });
});

describe("applyReferral — validare + gating", () => {
  it("cod cu format invalid → INVALID_CODE, fără lookup", async () => {
    const res = await applyReferral({ newUserId: NEW_USER_ID, referralCode: "xx" });
    expect(res).toEqual({ ok: false, error: "INVALID_CODE" });
    expect(getUserIdByReferralCode).not.toHaveBeenCalled();
  });

  it("cod cu format valid dar inexistent → INVALID_CODE", async () => {
    vi.mocked(getUserIdByReferralCode).mockResolvedValue(null);
    const res = await applyReferral({ newUserId: NEW_USER_ID, referralCode: VALID_CODE });
    expect(res).toEqual({ ok: false, error: "INVALID_CODE" });
    expect(setReferredByIfAbsent).not.toHaveBeenCalled();
  });

  it("auto-referral (userul își folosește propriul cod) → INVALID_CODE, fără scriere", async () => {
    vi.mocked(getUserIdByReferralCode).mockResolvedValue(NEW_USER_ID);
    const res = await applyReferral({ newUserId: NEW_USER_ID, referralCode: VALID_CODE });
    expect(res).toEqual({ ok: false, error: "INVALID_CODE" });
    expect(setReferredByIfAbsent).not.toHaveBeenCalled();
  });

  it("cod valid, referrer diferit → setat + notificare trimisă", async () => {
    vi.mocked(getUserIdByReferralCode).mockResolvedValue(REFERRER_ID);
    vi.mocked(setReferredByIfAbsent).mockResolvedValue(true);
    const res = await applyReferral({ newUserId: NEW_USER_ID, referralCode: VALID_CODE });
    expect(res).toEqual({ ok: true, applied: true });
    expect(setReferredByIfAbsent).toHaveBeenCalledWith(NEW_USER_ID, REFERRER_ID);
    expect(notifyReferralJoined).toHaveBeenCalledWith({
      recipientUserId: REFERRER_ID,
      joinedUserName: "Ion Nou",
    });
  });

  it("cod valid dar userul avea deja un referrer (idempotent) → applied: false, FĂRĂ notificare", async () => {
    vi.mocked(getUserIdByReferralCode).mockResolvedValue(REFERRER_ID);
    vi.mocked(setReferredByIfAbsent).mockResolvedValue(false);
    const res = await applyReferral({ newUserId: NEW_USER_ID, referralCode: VALID_CODE });
    expect(res).toEqual({ ok: true, applied: false });
    expect(notifyReferralJoined).not.toHaveBeenCalled();
  });

  it("cod cu litere mici / spații → normalizat (trim+uppercase) înainte de lookup", async () => {
    vi.mocked(getUserIdByReferralCode).mockResolvedValue(REFERRER_ID);
    vi.mocked(setReferredByIfAbsent).mockResolvedValue(true);
    await applyReferral({ newUserId: NEW_USER_ID, referralCode: `  ${VALID_CODE.toLowerCase()}  ` });
    expect(getUserIdByReferralCode).toHaveBeenCalledWith(VALID_CODE);
  });

  it("notificarea eșuează → tot ok: true (deja scris, notificarea e auxiliară)", async () => {
    vi.mocked(getUserIdByReferralCode).mockResolvedValue(REFERRER_ID);
    vi.mocked(setReferredByIfAbsent).mockResolvedValue(true);
    vi.mocked(notifyReferralJoined).mockRejectedValue(new Error("email picat"));
    const res = await applyReferral({ newUserId: NEW_USER_ID, referralCode: VALID_CODE });
    expect(res).toEqual({ ok: true, applied: true });
  });
});
