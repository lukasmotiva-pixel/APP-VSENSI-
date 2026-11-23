"use client";

import { useActionState } from "react";
import { changePasswordAction, regenerateRecoveryCodesAction } from "@/modules/auth-actions";
import { initialActionState } from "@/lib/action-state";
import { Field, Input } from "@/components/ui/field";
import { FormMessage, SubmitButton } from "@/components/ui/form-bits";

export function ChangePasswordForm() {
  const [state, action] = useActionState(changePasswordAction, initialActionState);
  return (
    <form action={action} className="space-y-4">
      <Field label="Senha atual" htmlFor="current"><Input id="current" name="current" type="password" autoComplete="current-password" required /></Field>
      <Field label="Nova senha" htmlFor="password" hint="Mínimo de 12 caracteres. Uma frase longa é mais segura e fácil de lembrar.">
        <Input id="password" name="password" type="password" autoComplete="new-password" minLength={12} required />
      </Field>
      <Field label="Confirme a nova senha" htmlFor="confirm"><Input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={12} required /></Field>
      <FormMessage state={state} />
      <SubmitButton>Alterar senha</SubmitButton>
    </form>
  );
}

export function RecoveryCodesForm({ remaining }: { remaining: number }) {
  const [state, action] = useActionState(regenerateRecoveryCodesAction, initialActionState);
  const codes = state.ok && Array.isArray(state.data) ? (state.data as string[]) : null;
  if (codes)
    return (
      <div className="space-y-3">
        <FormMessage state={state} />
        <p className="text-sm font-medium">Guarde estes códigos em local seguro (fora do celular, de preferência impressos). Eles não serão exibidos novamente.</p>
        <ul className="num grid grid-cols-2 gap-2 rounded-lg bg-canvas p-3 font-mono text-sm">
          {codes.map((c) => <li key={c}>{c}</li>)}
        </ul>
      </div>
    );
  return (
    <form action={action} className="space-y-4">
      <p className="text-sm text-muted">
        {remaining > 0 ? `Você tem ${remaining} código(s) de recuperação não utilizado(s).` : "Nenhum código de recuperação ativo. Gere agora para não perder o acesso se esquecer a senha."}
        {" "}Gerar novos códigos invalida os anteriores.
      </p>
      <Field label="Confirme sua senha" htmlFor="rc-password"><Input id="rc-password" name="password" type="password" autoComplete="current-password" required /></Field>
      <FormMessage state={state} />
      <SubmitButton variant="secondary" pendingLabel="Gerando…">Gerar códigos de recuperação</SubmitButton>
    </form>
  );
}
