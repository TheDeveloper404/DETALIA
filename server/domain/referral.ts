// Link de referral — cod scurt, NU UUID-ul userului (înșirabil/predictibil dacă altcineva îți vede
// profilul și încearcă id-uri vecine). Generat lenes (prima cerere a linkului), nu la creare cont.

const REFERRAL_CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // fără 0/O/1/I — ambiguu la citit cu voce tare
export const REFERRAL_CODE_LENGTH = 8;

// crypto.randomInt ar fi mai „corect" statistic, dar Math.random e suficient aici — codul nu e un
// secret de securitate (doar non-ghicibil secvențial), colizuinea se rezolvă oricum prin retry pe
// unique constraint (vezi referralService.getOrCreateReferralCode).
export function generateReferralCode(): string {
  let code = "";
  for (let i = 0; i < REFERRAL_CODE_LENGTH; i++) {
    code += REFERRAL_CODE_ALPHABET[Math.floor(Math.random() * REFERRAL_CODE_ALPHABET.length)];
  }
  return code;
}

export function isValidReferralCodeFormat(value: string): boolean {
  if (value.length !== REFERRAL_CODE_LENGTH) return false;
  return [...value].every((c) => REFERRAL_CODE_ALPHABET.includes(c));
}
