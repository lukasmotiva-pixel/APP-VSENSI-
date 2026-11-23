"use client";

import Link from "next/link";
import { useActionState } from "react";
import { loginAction } from "@/modules/auth-actions";
import { initialActionState } from "@/lib/action-state";
import { Field, Input } from "@/components/ui/field";
import { FormMessage, SubmitButton } from "@/components/ui/form-bits";

export function LoginForm({ next }: { next: string }) {
  const [state, action] = useActionState(loginAction, initialActionState);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <Field label="E-mail" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="username" required autoFocus inputMode="email" />
      </Field>
      <Field label="Senha" htmlFor="password">
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </Field>
      <FormMessage state={state} />
      <SubmitButton className="w-full" size="lg" pendingLabel="Entrando…">Entrar</SubmitButton>
      <p className="text-center text-sm">
        <Link href="/recuperar" className="text-navy-800 underline-offset-4 hover:underline">Esqueci minha senha</Link>
      </p>
    </form>
  );
}
