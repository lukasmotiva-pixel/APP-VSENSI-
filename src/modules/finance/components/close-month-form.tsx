"use client";

import { useActionState } from "react";
import { closeMonthAction } from "../actions";
import { initialActionState } from "@/lib/action-state";
import { FormMessage, SubmitButton } from "@/components/ui/form-bits";

export function CloseMonthForm({ month }: { month: string }) {
  const [state, action] = useActionState(closeMonthAction, initialActionState);
  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <input type="hidden" name="month" value={month} />
      <SubmitButton size="sm" pendingLabel="Fechando…">Fechar mês</SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}
