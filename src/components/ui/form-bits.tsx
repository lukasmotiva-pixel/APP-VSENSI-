"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { Button, type ButtonVariant } from "./button";
import type { ActionState } from "@/lib/action-state";

export function SubmitButton({
  children,
  pendingLabel = "Salvando…",
  variant = "primary",
  className,
  size,
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  variant?: ButtonVariant;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} disabled={pending} className={className} size={size} aria-busy={pending}>
      {pending ? pendingLabel : children}
    </Button>
  );
}

export function FormMessage({ state }: { state: ActionState }) {
  if (!state.message) return null;
  return (
    <p
      role={state.ok ? "status" : "alert"}
      className={`rounded-lg px-3 py-2 text-sm ${state.ok ? "bg-positive-soft text-positive" : "bg-negative-soft text-negative"}`}
    >
      {state.message}
    </p>
  );
}

/** Botão que pede confirmação antes de enviar o formulário. */
export function ConfirmSubmit({
  children,
  message,
  variant = "danger",
  size = "sm",
  pendingLabel = "Aguarde…",
}: {
  children: React.ReactNode;
  message: string;
  variant?: ButtonVariant;
  size?: "sm" | "md" | "lg";
  pendingLabel?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant={variant}
      size={size}
      disabled={pending}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {pending ? pendingLabel : children}
    </Button>
  );
}

/** Navega para `state.redirectTo` quando a ação termina com sucesso. */
export function useActionRedirect(state: ActionState) {
  const router = useRouter();
  useEffect(() => {
    if (state.ok && state.redirectTo) router.push(state.redirectTo);
  }, [state, router]);
}
