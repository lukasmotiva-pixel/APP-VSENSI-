import { ZodError } from "zod";
import { DomainError } from "./errors";

/** Estado retornado pelas Server Actions para os formulários. */
export interface ActionState {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
  /** Dados opcionais (ex.: códigos de recuperação gerados). */
  data?: unknown;
}

export const initialActionState: ActionState = { ok: false };

/** Converte erros conhecidos em mensagens amigáveis; erros inesperados viram mensagem genérica. */
export function toActionError(err: unknown): ActionState {
  if (err instanceof ZodError) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of err.issues) {
      const key = issue.path.join(".") || "_";
      fieldErrors[key] ??= issue.message;
    }
    const first = err.issues[0]?.message;
    return { ok: false, message: first ?? "Verifique os campos destacados.", fieldErrors };
  }
  if (err instanceof DomainError) {
    return { ok: false, message: err.message, fieldErrors: err.field ? { [err.field]: err.message } : undefined };
  }
  // Redirecionamentos do Next.js precisam continuar propagando.
  if (err && typeof err === "object" && "digest" in err && String((err as { digest: unknown }).digest).startsWith("NEXT_")) {
    throw err;
  }
  console.error(err);
  return { ok: false, message: "Não foi possível concluir a operação. Tente novamente." };
}
