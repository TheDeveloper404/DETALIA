// Service „Link de referral" — cod scurt per user, atribuire O SINGURĂ DATĂ la un cont nou, notificare
// + istoric pentru referrer. Vezi server/domain/referral.ts pt formatul codului.

import { generateReferralCode, isValidReferralCodeFormat } from "@/server/domain/referral";
import {
  getNotificationActor,
  getReferralCode,
  getUserIdByReferralCode,
  listAllReferrals,
  setReferralCodeIfAbsent,
  setReferredByIfAbsent,
} from "@/server/repos/usersRepo";
import { notifyReferralJoined } from "@/server/services/notificationService";

const MAX_CODE_GENERATION_ATTEMPTS = 5;

// Codul e generat LENEȘ — la prima cerere a linkului (buton pe profil), nu la creare cont (26 useri
// deja existenți n-ar avea unul altfel). Retry pe conflict de unicitate (coliziune, foarte improbabilă
// la 8 caractere dintr-un alfabet de 33, dar posibilă) — fiecare tentativă generează un cod NOU, nu
// reîncearcă orbește același.
export async function getOrCreateReferralCode(userId: string): Promise<string> {
  const existing = await getReferralCode(userId);
  if (existing) return existing;

  for (let attempt = 0; attempt < MAX_CODE_GENERATION_ATTEMPTS; attempt++) {
    const code = generateReferralCode();
    const wrote = await setReferralCodeIfAbsent(userId, code);
    if (wrote) return code;
    // `wrote === false` înseamnă FIE coliziune de cod (altcineva îl are deja) FIE userul ăsta a primit
    // deja un cod între timp (cerere concurentă, ex. dublu-click) — verificăm care, ca să nu insistăm
    // degeaba dacă răspunsul corect există deja.
    const nowExisting = await getReferralCode(userId);
    if (nowExisting) return nowExisting;
  }
  throw new Error("REFERRAL_CODE_GENERATION_FAILED");
}

type ApplyReferralResult =
  | { ok: true; applied: boolean }
  | { ok: false; error: "INVALID_CODE" | "SELF_REFERRAL" };

// Apelat DIN onboarding (singurul punct cu acces la cookie-ul de intenție pus la vizita /signup?ref=).
// `applied: false` (dar ok: true) = codul era valid dar userul avea deja un referrer (cerere dublă,
// idempotent) — nu e o eroare de arătat userului.
export async function applyReferral(input: {
  newUserId: string;
  referralCode: string;
}): Promise<ApplyReferralResult> {
  const code = input.referralCode.trim().toUpperCase();
  if (!isValidReferralCodeFormat(code)) return { ok: false, error: "INVALID_CODE" };

  const referrerId = await getUserIdByReferralCode(code);
  if (!referrerId) return { ok: false, error: "INVALID_CODE" };
  // Cod invalid vs auto-referral — ACELAȘI cod de eroare (INVALID_CODE) la auto-referral: nu are sens
  // să dezvălui userului DE CE a picat, oricum n-ar fi trebuit să ajungă cu propriul cod (n-a copiat
  // linkul altcuiva).
  if (referrerId === input.newUserId) return { ok: false, error: "INVALID_CODE" };

  const applied = await setReferredByIfAbsent(input.newUserId, referrerId);
  if (applied) {
    try {
      const actor = await getNotificationActor(input.newUserId);
      await notifyReferralJoined({ recipientUserId: referrerId, joinedUserName: actor?.name ?? null });
    } catch (err) {
      console.error("[referralService] notifyReferralJoined eșuată (non-fatal)", {
        newUserId: input.newUserId,
        err,
      });
    }
  }
  return { ok: true, applied };
}

export async function getAllReferralsForAdmin() {
  return listAllReferrals();
}
