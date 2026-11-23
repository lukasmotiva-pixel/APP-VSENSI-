"use client";

import Link from "next/link";
import { useActionState } from "react";
import { recoverAction } from "@/modules/auth-actions";
import { initialActionState } from "@/lib/action-state";
import { Field, Input } from "@/components/ui/field";
import { FormMessage, SubmitButton } from "@/components/ui/form-bits";

export function RecoverForm() {
  const [state, action] = useActionState(recoverAction, initialActionState);
  if (state.ok)
    return (
      <div className="space-y-4">
        <FormMessage state={state} />
        <Link href="/login" className="block text-center text-sm text-navy-800 underline">Voltar para o login</Link>
      </div>
    );
  return (
    <form action={action} className="space-y-4">
      <Field label="E-mail" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="username" required />
      </Field>
      <Field label="Código de recuperação" htmlFor="code" hint="Formato XXXX-XXXX-XXXX. Cada código só pode ser usado uma vez.">
        <Input id="code" name="code" required autoComplete="one-time-code" autoCapitalize="characters" />
      </Field>
      <Field label="Nova senha" htmlFor="password" hint="Mínimo de 12 caracteres.">
        <Input id="password" name="password" type="password" autoComplete="new-password" minLength={12} required />
      </Field>
      <Field label="Confirme a nova senha" htmlFor="confirm">
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={12} required />
      </Field>
      <FormMessage state={state} />
      <SubmitButton className="w-full" size="lg" pendingLabel="Verificando…">Redefinir senha</SubmitButton>
      <p className="text-center text-sm">
        <Link href="/login" className="text-navy-800 underline-offset-4 hover:underline">Voltar para o login</Link>
      </p>
    </form>
  );
}
