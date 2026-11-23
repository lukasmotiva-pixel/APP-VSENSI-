"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import type { ActionState } from "@/lib/action-state";
import {
  changePassword,
  loginWithPassword,
  regenerateRecoveryCodes,
  resetPasswordWithRecoveryCode,
  revokeSessionByToken,
} from "@/lib/auth/core";
import { clearSessionCookie, getRequestMeta, requireAdmin, SESSION_COOKIE, setSessionCookie } from "@/lib/auth/session";

/** Aceita apenas caminhos internos, evitando redirecionamento para sites externos. */
function safeNext(value: FormDataEntryValue | null): string {
  const s = typeof value === "string" ? value : "";
  return s.startsWith("/") && !s.startsWith("//") && !s.startsWith("/\\") ? s : "/";
}

export async function loginAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const email = String(form.get("email") ?? "").slice(0, 200);
  const password = String(form.get("password") ?? "").slice(0, 256);
  if (!email || !password) return { ok: false, message: "Informe e-mail e senha." };
  const meta = await getRequestMeta();
  const result = await loginWithPassword(prisma, email, password, meta);
  if (!result.ok) {
    const message = {
      invalid: "E-mail ou senha incorretos.",
      locked: "Acesso bloqueado temporariamente por excesso de tentativas. Tente novamente em 15 minutos.",
      rate_limited: "Muitas tentativas a partir desta rede. Aguarde alguns minutos.",
    }[result.reason];
    return { ok: false, message };
  }
  await setSessionCookie(result.token, result.expiresAt);
  redirect(safeNext(form.get("next")));
}

export async function logoutAction(): Promise<void> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (token) {
    await revokeSessionByToken(prisma, token);
    await audit({ action: "auth.logout", summary: "Logout", ip: (await getRequestMeta()).ip });
  }
  await clearSessionCookie();
  redirect("/login");
}

export async function recoverAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const email = String(form.get("email") ?? "").slice(0, 200);
  const code = String(form.get("code") ?? "").slice(0, 40);
  const password = String(form.get("password") ?? "").slice(0, 256);
  const confirm = String(form.get("confirm") ?? "");
  if (password !== confirm) return { ok: false, message: "As senhas não conferem." };
  const result = await resetPasswordWithRecoveryCode(prisma, email, code, password, await getRequestMeta());
  if (!result.ok) return { ok: false, message: result.error };
  return { ok: true, message: "Senha redefinida. Entre com a nova senha. Este código de recuperação não vale mais." };
}

export async function changePasswordAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const session = await requireAdmin();
  const current = String(form.get("current") ?? "");
  const next = String(form.get("password") ?? "");
  if (next !== String(form.get("confirm") ?? "")) return { ok: false, message: "As senhas não conferem." };
  const res = await changePassword(prisma, session.user.id, current, next, session.sessionId, await getRequestMeta());
  if (!res.ok) return { ok: false, message: res.error };
  revalidatePath("/configuracoes/seguranca");
  return { ok: true, message: "Senha alterada. As outras sessões foram encerradas." };
}

export async function regenerateRecoveryCodesAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const session = await requireAdmin();
  const user = await prisma.adminUser.findUniqueOrThrow({ where: { id: session.user.id } });
  const { verifyPassword } = await import("@/lib/auth/password");
  if (!(await verifyPassword(user.passwordHash, String(form.get("password") ?? ""))))
    return { ok: false, message: "Senha incorreta." };
  const codes = await regenerateRecoveryCodes(prisma, session.user.id, await getRequestMeta());
  revalidatePath("/configuracoes/seguranca");
  return { ok: true, message: "Novos códigos gerados. Os anteriores deixaram de valer.", data: codes };
}

export async function revokeSessionAction(form: FormData): Promise<void> {
  const session = await requireAdmin();
  const id = z.string().min(1).parse(form.get("sessionId"));
  if (id === session.sessionId) return;
  await prisma.session.deleteMany({ where: { id, userId: session.user.id } });
  await audit({ action: "auth.session.revoke", summary: "Sessão encerrada manualmente", ip: (await getRequestMeta()).ip });
  revalidatePath("/configuracoes/seguranca");
}

export async function revokeOtherSessionsAction(): Promise<void> {
  const session = await requireAdmin();
  const res = await prisma.session.deleteMany({ where: { userId: session.user.id, id: { not: session.sessionId } } });
  await audit({ action: "auth.session.revoke_all", summary: `${res.count} outra(s) sessão(ões) encerrada(s)`, ip: (await getRequestMeta()).ip });
  revalidatePath("/configuracoes/seguranca");
}
