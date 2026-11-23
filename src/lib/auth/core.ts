/**
 * Regras de autenticação independentes do Next.js (testáveis com banco real).
 * A camada `session.ts` cuida de cookies; este arquivo cuida do banco.
 */
import type { AdminUser, PrismaClient } from "@prisma/client";
import { audit } from "../audit";
import { getDummyHash, hashPassword, validatePasswordStrength, verifyPassword } from "./password";
import { generateRecoveryCode, generateSessionToken, normalizeRecoveryCode, sha256 } from "./tokens";

export const SESSION_ABSOLUTE_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias
export const SESSION_IDLE_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias sem uso
const SESSION_TOUCH_MS = 5 * 60 * 1000; // atualiza "último acesso" no máximo a cada 5 min

export const MAX_FAILED_LOGINS = 5;
export const LOCK_MS = 15 * 60 * 1000;
export const IP_WINDOW_MS = 15 * 60 * 1000;
export const IP_MAX_FAILURES = 20;
export const RECOVERY_CODE_COUNT = 10;

export interface RequestMeta {
  ip: string | null;
  userAgent: string | null;
}

export type LoginResult =
  | { ok: true; token: string; expiresAt: Date }
  | { ok: false; reason: "invalid" | "locked" | "rate_limited" };

const GENERIC_FAIL = { ok: false, reason: "invalid" } as const;

async function ipIsRateLimited(db: PrismaClient, ip: string | null, now: Date): Promise<boolean> {
  if (!ip) return false;
  const failures = await db.loginAttempt.count({
    where: { ip, success: false, createdAt: { gt: new Date(now.getTime() - IP_WINDOW_MS) } },
  });
  return failures >= IP_MAX_FAILURES;
}

export async function createSession(
  db: PrismaClient,
  userId: string,
  meta: RequestMeta,
  now: Date = new Date(),
): Promise<{ token: string; expiresAt: Date }> {
  const token = generateSessionToken();
  const expiresAt = new Date(now.getTime() + SESSION_ABSOLUTE_MS);
  await db.session.create({
    data: {
      tokenHash: sha256(token),
      userId,
      ip: meta.ip,
      userAgent: meta.userAgent?.slice(0, 300) ?? null,
      createdAt: now,
      lastSeenAt: now,
      expiresAt,
    },
  });
  return { token, expiresAt };
}

/** Login com e-mail e senha, com bloqueio por tentativas e limite por IP. */
export async function loginWithPassword(
  db: PrismaClient,
  email: string,
  password: string,
  meta: RequestMeta,
  now: Date = new Date(),
): Promise<LoginResult> {
  if (await ipIsRateLimited(db, meta.ip, now)) {
    await audit({ action: "auth.login.rate_limited", summary: "Login bloqueado por excesso de tentativas no IP", ip: meta.ip }, db);
    return { ok: false, reason: "rate_limited" };
  }

  const user = await db.adminUser.findUnique({ where: { email: email.trim().toLowerCase() } });

  if (!user) {
    await verifyPassword(await getDummyHash(), password); // tempo semelhante ao caso real
    await db.loginAttempt.create({ data: { ip: meta.ip ?? "desconhecido", success: false, createdAt: now } });
    await audit({ action: "auth.login.failed", summary: "Tentativa de login com e-mail desconhecido", ip: meta.ip }, db);
    return GENERIC_FAIL;
  }

  if (user.lockedUntil && user.lockedUntil > now) {
    await audit({ action: "auth.login.locked", summary: "Tentativa de login com conta temporariamente bloqueada", ip: meta.ip }, db);
    return { ok: false, reason: "locked" };
  }

  const valid = await verifyPassword(user.passwordHash, password);
  await db.loginAttempt.create({ data: { ip: meta.ip ?? "desconhecido", success: valid, createdAt: now } });

  if (!valid) {
    const failed = user.failedLoginCount + 1;
    const lock = failed >= MAX_FAILED_LOGINS;
    await db.adminUser.update({
      where: { id: user.id },
      data: {
        failedLoginCount: lock ? 0 : failed,
        lockedUntil: lock ? new Date(now.getTime() + LOCK_MS) : user.lockedUntil,
      },
    });
    await audit({
      action: lock ? "auth.login.lockout" : "auth.login.failed",
      summary: lock ? "Conta bloqueada por 15 minutos após tentativas inválidas" : "Senha incorreta",
      ip: meta.ip,
    }, db);
    return lock ? { ok: false, reason: "locked" } : GENERIC_FAIL;
  }

  await db.adminUser.update({
    where: { id: user.id },
    data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: now },
  });
  const session = await createSession(db, user.id, meta, now);
  await audit({ action: "auth.login", summary: "Login realizado", ip: meta.ip, metadata: { userAgent: meta.userAgent } }, db);
  return { ok: true, ...session };
}

export interface ValidSession {
  sessionId: string;
  user: Pick<AdminUser, "id" | "name" | "email">;
}

/** Valida o token do cookie: existe, não expirou e não está ocioso. */
export async function validateSessionToken(
  db: PrismaClient,
  token: string,
  now: Date = new Date(),
): Promise<ValidSession | null> {
  if (!token || token.length > 200) return null;
  const session = await db.session.findUnique({
    where: { tokenHash: sha256(token) },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
  if (!session) return null;
  const idleExpired = now.getTime() - session.lastSeenAt.getTime() > SESSION_IDLE_MS;
  if (session.expiresAt <= now || idleExpired) {
    await db.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }
  if (now.getTime() - session.lastSeenAt.getTime() > SESSION_TOUCH_MS) {
    await db.session.update({ where: { id: session.id }, data: { lastSeenAt: now } }).catch(() => undefined);
  }
  return { sessionId: session.id, user: session.user };
}

export async function revokeSessionByToken(db: PrismaClient, token: string): Promise<void> {
  await db.session.deleteMany({ where: { tokenHash: sha256(token) } });
}

/** Troca a senha (exige a senha atual) e encerra as demais sessões. */
export async function changePassword(
  db: PrismaClient,
  userId: string,
  currentPassword: string,
  newPassword: string,
  keepSessionId: string | null,
  meta: RequestMeta,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await db.adminUser.findUniqueOrThrow({ where: { id: userId } });
  if (!(await verifyPassword(user.passwordHash, currentPassword)))
    return { ok: false, error: "A senha atual está incorreta." };
  const weak = validatePasswordStrength(newPassword);
  if (weak) return { ok: false, error: weak };
  if (currentPassword === newPassword) return { ok: false, error: "A nova senha deve ser diferente da atual." };

  const passwordHash = await hashPassword(newPassword);
  await db.$transaction(async (tx) => {
    await tx.adminUser.update({ where: { id: userId }, data: { passwordHash, passwordChangedAt: new Date() } });
    await tx.session.deleteMany({ where: { userId, ...(keepSessionId ? { id: { not: keepSessionId } } : {}) } });
    await audit({ action: "auth.password.change", summary: "Senha alterada; outras sessões encerradas", ip: meta.ip }, tx);
  });
  return { ok: true };
}

/** Gera novos códigos de recuperação (invalida os anteriores). Retorna os códigos em texto UMA única vez. */
export async function regenerateRecoveryCodes(db: PrismaClient, userId: string, meta: RequestMeta): Promise<string[]> {
  const codes = Array.from({ length: RECOVERY_CODE_COUNT }, generateRecoveryCode);
  const hashes = await Promise.all(codes.map((c) => hashPassword(c)));
  await db.$transaction(async (tx) => {
    await tx.recoveryCode.deleteMany({ where: { userId } });
    await tx.recoveryCode.createMany({ data: hashes.map((codeHash) => ({ userId, codeHash })) });
    await audit({ action: "auth.recovery.regenerate", summary: "Novos códigos de recuperação gerados", ip: meta.ip }, tx);
  });
  return codes;
}

/**
 * Redefine a senha usando um código de recuperação de uso único.
 * Encerra todas as sessões. Sujeito ao mesmo limite por IP do login.
 */
export async function resetPasswordWithRecoveryCode(
  db: PrismaClient,
  email: string,
  code: string,
  newPassword: string,
  meta: RequestMeta,
  now: Date = new Date(),
): Promise<{ ok: true } | { ok: false; error: string }> {
  const generic = { ok: false as const, error: "E-mail ou código de recuperação inválido." };
  if (await ipIsRateLimited(db, meta.ip, now))
    return { ok: false, error: "Muitas tentativas. Aguarde alguns minutos." };

  const weak = validatePasswordStrength(newPassword);
  if (weak) return { ok: false, error: weak };

  const user = await db.adminUser.findUnique({
    where: { email: email.trim().toLowerCase() },
    include: { recoveryCodes: { where: { usedAt: null } } },
  });
  const normalized = normalizeRecoveryCode(code);
  let matchId: string | null = null;
  if (user) {
    for (const rc of user.recoveryCodes) {
      if (await verifyPassword(rc.codeHash, normalized)) {
        matchId = rc.id;
        break;
      }
    }
  } else {
    await verifyPassword(await getDummyHash(), normalized);
  }

  if (!user || !matchId) {
    await db.loginAttempt.create({ data: { ip: meta.ip ?? "desconhecido", success: false, createdAt: now } });
    await audit({ action: "auth.recovery.failed", summary: "Tentativa de recuperação com código inválido", ip: meta.ip }, db);
    return generic;
  }

  const passwordHash = await hashPassword(newPassword);
  const codeId = matchId;
  await db.$transaction(async (tx) => {
    // Marca o código como usado de forma condicional, para impedir uso concorrente.
    const used = await tx.recoveryCode.updateMany({ where: { id: codeId, usedAt: null }, data: { usedAt: now } });
    if (used.count !== 1) throw new Error("Código já utilizado");
    await tx.adminUser.update({
      where: { id: user.id },
      data: { passwordHash, passwordChangedAt: now, failedLoginCount: 0, lockedUntil: null },
    });
    await tx.session.deleteMany({ where: { userId: user.id } });
    await audit({ action: "auth.recovery.used", summary: "Senha redefinida com código de recuperação; todas as sessões encerradas", ip: meta.ip }, tx);
  });
  return { ok: true };
}
