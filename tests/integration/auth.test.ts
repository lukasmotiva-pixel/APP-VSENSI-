import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  changePassword, IP_MAX_FAILURES, loginWithPassword, MAX_FAILED_LOGINS, regenerateRecoveryCodes,
  resetPasswordWithRecoveryCode, SESSION_IDLE_MS, validateSessionToken,
} from "@/lib/auth/core";
import { hashPassword } from "@/lib/auth/password";
import { db, resetDb } from "./helpers";

const m = { ip: "10.0.0.1", userAgent: "vitest" };
const PASSWORD = "senha-forte-do-val-2026";

async function createAdmin() {
  return db.adminUser.create({ data: { name: "Val", email: "val@example.com", passwordHash: await hashPassword(PASSWORD) } });
}

beforeEach(resetDb);
afterAll(() => db.$disconnect());

describe("acesso exclusivo", () => {
  it("o banco não aceita um segundo usuário", async () => {
    await createAdmin();
    await expect(db.adminUser.create({ data: { name: "Outro", email: "outro@example.com", passwordHash: "x" } })).rejects.toThrow();
    await expect(db.$executeRaw`INSERT INTO admin_users (id, singleton, name, email, password_hash, updated_at) VALUES ('x', false, 'n', 'n@x.com', 'h', now())`).rejects.toThrow();
  });

  it("login correto cria sessão; token é validado e o banco guarda só o hash", async () => {
    await createAdmin();
    const r = await loginWithPassword(db, "VAL@example.com ", PASSWORD, m);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const s = await validateSessionToken(db, r.token);
    expect(s?.user.email).toBe("val@example.com");
    const row = await db.session.findFirstOrThrow();
    expect(row.tokenHash).not.toBe(r.token);
    expect(await validateSessionToken(db, "token-invalido")).toBeNull();
  });

  it("senha errada e e-mail inexistente retornam o mesmo erro genérico", async () => {
    await createAdmin();
    expect(await loginWithPassword(db, "val@example.com", "errada-errada", m)).toEqual({ ok: false, reason: "invalid" });
    expect(await loginWithPassword(db, "ninguem@example.com", "errada-errada", m)).toEqual({ ok: false, reason: "invalid" });
  });

  it("bloqueia a conta após tentativas inválidas, mesmo com a senha correta", async () => {
    await createAdmin();
    for (let i = 0; i < MAX_FAILED_LOGINS - 1; i++) await loginWithPassword(db, "val@example.com", "errada-errada", { ...m, ip: `10.0.1.${i}` });
    expect(await loginWithPassword(db, "val@example.com", "errada-errada", m)).toEqual({ ok: false, reason: "locked" });
    expect(await loginWithPassword(db, "val@example.com", PASSWORD, m)).toEqual({ ok: false, reason: "locked" });
    // após 15 minutos, volta a funcionar
    const later = new Date(Date.now() + 16 * 60 * 1000);
    expect((await loginWithPassword(db, "val@example.com", PASSWORD, m, later)).ok).toBe(true);
  });

  it("limita tentativas por IP", async () => {
    await createAdmin();
    await db.loginAttempt.createMany({ data: Array.from({ length: IP_MAX_FAILURES }, () => ({ ip: "6.6.6.6", success: false })) });
    expect(await loginWithPassword(db, "val@example.com", PASSWORD, { ...m, ip: "6.6.6.6" })).toEqual({ ok: false, reason: "rate_limited" });
  });

  it("sessão expira por inatividade", async () => {
    await createAdmin();
    const r = await loginWithPassword(db, "val@example.com", PASSWORD, m);
    if (!r.ok) throw new Error("login falhou");
    const future = new Date(Date.now() + SESSION_IDLE_MS + 60_000);
    expect(await validateSessionToken(db, r.token, future)).toBeNull();
    expect(await db.session.count()).toBe(0);
  });

  it("troca de senha exige a atual e encerra outras sessões", async () => {
    const u = await createAdmin();
    const a = await loginWithPassword(db, "val@example.com", PASSWORD, m);
    const b = await loginWithPassword(db, "val@example.com", PASSWORD, m);
    if (!a.ok || !b.ok) throw new Error("login falhou");
    const sa = await validateSessionToken(db, a.token);
    expect(await changePassword(db, u.id, "errada-errada", "nova-senha-muito-boa", sa!.sessionId, m)).toMatchObject({ ok: false });
    expect(await changePassword(db, u.id, PASSWORD, "curta", sa!.sessionId, m)).toMatchObject({ ok: false });
    expect(await changePassword(db, u.id, PASSWORD, "nova-senha-muito-boa", sa!.sessionId, m)).toEqual({ ok: true });
    expect(await validateSessionToken(db, a.token)).not.toBeNull();
    expect(await validateSessionToken(db, b.token)).toBeNull();
    expect((await loginWithPassword(db, "val@example.com", "nova-senha-muito-boa", m)).ok).toBe(true);
  });

  it("código de recuperação redefine a senha uma única vez", async () => {
    const u = await createAdmin();
    const codes = await regenerateRecoveryCodes(db, u.id, m);
    expect(codes).toHaveLength(10);
    const code = codes[0]!;
    expect(await resetPasswordWithRecoveryCode(db, "val@example.com", "AAAA-BBBB-CCCC", "outra-senha-forte-1", m)).toMatchObject({ ok: false });
    expect(await resetPasswordWithRecoveryCode(db, "val@example.com", code.toLowerCase(), "outra-senha-forte-1", m)).toEqual({ ok: true });
    expect(await resetPasswordWithRecoveryCode(db, "val@example.com", code, "outra-senha-forte-2", m)).toMatchObject({ ok: false });
    expect((await loginWithPassword(db, "val@example.com", "outra-senha-forte-1", m)).ok).toBe(true);
  });
});
