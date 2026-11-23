import { hash, verify } from "@node-rs/argon2";

/** Parâmetros Argon2id (OWASP: m=19 MiB, t=2, p=1 como mínimo). */
const ARGON2_OPTIONS = {
  algorithm: 2, // Argon2id
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

export const PASSWORD_MIN_LENGTH = 12;

export function validatePasswordStrength(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH)
    return `A senha deve ter pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`;
  if (password.length > 256) return "A senha é longa demais.";
  if (/^(.)\1+$/.test(password)) return "A senha não pode ser um único caractere repetido.";
  return null;
}

export function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

/** Hash usado para comparar em tempo constante quando o e-mail não existe. */
let dummyHash: Promise<string> | null = null;
export function getDummyHash(): Promise<string> {
  dummyHash ??= hashPassword("senha-ficticia-para-tempo-constante");
  return dummyHash;
}
