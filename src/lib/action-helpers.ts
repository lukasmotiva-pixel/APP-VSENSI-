import "server-only";
import { revalidatePath } from "next/cache";
import { getRequestMeta, requireAdmin } from "@/lib/auth/session";
import { toActionError, type ActionState } from "@/lib/action-state";
import { DomainError } from "@/lib/errors";
import { parseMoneyToCents } from "@/lib/money";

/** Valida a sessão e retorna os metadados da requisição para auditoria. */
export async function guard() {
  await requireAdmin();
  return { ip: (await getRequestMeta()).ip };
}

/** Executa uma ação de formulário com tratamento de erros padronizado. */
export async function runAction(
  fn: (meta: { ip: string | null }) => Promise<Partial<ActionState> | void>,
  success: Partial<ActionState> = { message: "Salvo." },
): Promise<ActionState> {
  try {
    const meta = await guard();
    const extra = (await fn(meta)) ?? {};
    revalidatePath("/", "layout");
    return { ok: true, ...success, ...extra };
  } catch (e) {
    return toActionError(e);
  }
}

export const fstr = (f: FormData, k: string) => String(f.get(k) ?? "");

/** Valor em reais do formulário -> centavos (vazio = 0). */
export function fmoney(f: FormData, k: string, label: string): number {
  const s = fstr(f, k).trim();
  if (!s) return 0;
  const v = parseMoneyToCents(s);
  if (v === null) throw new DomainError(`${label}: valor inválido.`, k);
  return v;
}
