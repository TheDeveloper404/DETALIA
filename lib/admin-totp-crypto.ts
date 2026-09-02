// Criptarea secretelor TOTP de admin (SEC-P02) — AES-256-GCM, cheie DEDICATĂ `ADMIN_TOTP_ENCRYPTION_KEY`.
//
// DE CE criptat și nu în clar: secretul TOTP e echivalentul funcțional al unei parole permanente — cine
// îl are generează coduri valide la infinit, fără să atingă aplicația. Un dump al bazei (backup scurs,
// SQL injection de citire, acces la consola Neon) l-ar da direct. Criptat cu o cheie care trăiește DOAR
// în env, dump-ul singur nu mai e suficient.
//
// DE CE cheie separată de `AUTH_SECRET`: `AUTH_SECRET` se rotește trimestrial (vezi CLAUDE.md
// §„Mentenanță recurentă"), iar rotirea lui ar face NEDECRIPTABILE toate secretele TOTP — adminii ar
// rămâne blocați afară la o operațiune de rutină. Cheile cu cicluri de viață diferite stau separat.
//
// GCM (nu CBC): autentifică ciphertext-ul — o valoare modificată în DB pică la `decrypt`, nu produce
// tăcut un secret greșit din care s-ar genera coduri care nu se potrivesc niciodată.
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const KEY_BYTES = 32; // AES-256
const IV_BYTES = 12; // recomandarea NIST pentru GCM
const AUTH_TAG_BYTES = 16;

// Parsează o cheie hex de 32 de octeți. Întoarce null pentru ORICE input invalid (lipsă, lungime greșită,
// caractere non-hex) — callerul decide ce face, dar nu poate ajunge din greșeală la o cheie „aproape bună".
export function parseTotpKey(raw: string | null | undefined): Buffer | null {
  if (!raw) return null;
  const value = raw.trim();
  if (!/^[0-9a-fA-F]+$/.test(value)) return null;
  const key = Buffer.from(value, "hex");
  return key.length === KEY_BYTES ? key : null;
}

// Cheia din env sau null. FAIL-CLOSED la apelanți: fără cheie NU se verifică și NU se înrolează niciun
// TOTP — adminul nu intră. Preferăm o zonă de admin blocată de o configurare greșită unei zone de admin
// deschise cu un singur factor. Generare: `openssl rand -hex 32`.
export function adminTotpKey(): Buffer | null {
  return parseTotpKey(process.env.ADMIN_TOTP_ENCRYPTION_KEY);
}

// `iv:authTag:ciphertext`, toate hex. IV nou la FIECARE criptare — reutilizarea unui IV în GCM sparge
// confidențialitatea și permite forjarea authTag-ului.
export function encryptTotpSecret(plaintext: string, key: Buffer): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return [iv.toString("hex"), cipher.getAuthTag().toString("hex"), ciphertext.toString("hex")].join(":");
}

// Întoarce null pentru orice payload invalid sau nemodificat-neautentic (cheie greșită, ciphertext sau
// authTag alterat, format stricat). NU aruncă: apelantul e o cale de autentificare, iar o excepție
// necontrolată acolo ar deveni un 500 în loc de un refuz curat.
export function decryptTotpSecret(payload: string, key: Buffer): string | null {
  const parts = payload.split(":");
  if (parts.length !== 3) return null;
  const [ivHex, tagHex, dataHex] = parts;
  if (!/^[0-9a-f]+$/i.test(ivHex) || !/^[0-9a-f]+$/i.test(tagHex) || !/^[0-9a-f]+$/i.test(dataHex)) {
    return null;
  }
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(tagHex, "hex");
  if (iv.length !== IV_BYTES || authTag.length !== AUTH_TAG_BYTES) return null;

  try {
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(Buffer.from(dataHex, "hex")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
