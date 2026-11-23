import { createHash, randomBytes } from "node:crypto";

/** Token de sessão: 32 bytes aleatórios (256 bits) em base64url. */
export function generateSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

/** O banco guarda apenas o SHA-256 do token — um vazamento do banco não expõe sessões válidas. */
export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

const RECOVERY_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sem 0/O/1/I

/** Código de recuperação legível: XXXX-XXXX-XXXX (60 bits de entropia). */
export function generateRecoveryCode(): string {
  const bytes = randomBytes(12);
  let out = "";
  for (let i = 0; i < 12; i++) {
    out += RECOVERY_ALPHABET[bytes[i]! % RECOVERY_ALPHABET.length];
    if (i === 3 || i === 7) out += "-";
  }
  return out;
}

export function normalizeRecoveryCode(code: string): string {
  const raw = code.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return raw.length === 12 ? `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8)}` : raw;
}
