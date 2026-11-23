"use client";

import { useActionState, useEffect, useState } from "react";
import type { OrderStatus } from "@prisma/client";
import { changeOrderStatusAction, deleteOrderAction } from "../actions";
import { initialActionState } from "@/lib/action-state";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { ConfirmSubmit, FormMessage, SubmitButton, useActionRedirect } from "@/components/ui/form-bits";

const LABELS: Record<OrderStatus, string> = {
  RECEIVED: "Pedido recebido",
  AWAITING_PAYMENT: "Aguardando pagamento",
  PAYMENT_CONFIRMED: "Pagamento confirmado",
  IN_PREPARATION: "Em preparação",
  READY_TO_SHIP: "Pronto para envio",
  SHIPPED: "Enviado / saiu para entrega",
  DELIVERED: "Entregue",
  CANCELED: "Cancelado",
};
const FLOW: OrderStatus[] = ["RECEIVED", "AWAITING_PAYMENT", "PAYMENT_CONFIRMED", "IN_PREPARATION", "READY_TO_SHIP", "SHIPPED", "DELIVERED"];
const PAID: OrderStatus[] = ["PAYMENT_CONFIRMED", "IN_PREPARATION", "READY_TO_SHIP", "SHIPPED", "DELIVERED"];

export function StatusControls({ orderId, status, paid, today }: { orderId: string; status: OrderStatus; paid: boolean; today: string }) {
  const [state, action] = useActionState(changeOrderStatusAction, initialActionState);
  const [target, setTarget] = useState<OrderStatus | null>(null);
  // Após uma mudança bem-sucedida, fecha o formulário e volta a mostrar o próximo passo.
  useEffect(() => {
    if (state.ok) setTarget(null);
  }, [state]);
  const idx = FLOW.indexOf(status);
  const next = status === "CANCELED" ? null : FLOW[idx + 1] ?? null;
  const needsDate = target !== null && PAID.includes(target) && !paid;

  return (
    <div className="space-y-3">
      <ol className="grid grid-cols-7 gap-1" aria-label="Etapas do pedido">
        {FLOW.map((s, i) => (
          <li key={s} className="flex flex-col items-center gap-1 text-center">
            <span className={`h-1.5 w-full rounded-full ${status !== "CANCELED" && i <= idx ? "bg-navy-800" : "bg-line"}`} />
            <span className={`hidden text-[10px] leading-tight sm:block ${s === status ? "font-semibold text-ink" : "text-muted"}`}>{LABELS[s]}</span>
          </li>
        ))}
      </ol>
      <p className="text-sm">Etapa atual: <strong>{LABELS[status]}</strong></p>

      {target ? (
        <form action={action} className="space-y-3 rounded-lg border border-line bg-canvas/60 p-3">
          <input type="hidden" name="orderId" value={orderId} />
          <input type="hidden" name="status" value={target} />
          <p className="text-sm">Mudar para <strong>{LABELS[target]}</strong></p>
          {needsDate ? (
            <Field label="Data em que o pagamento foi recebido" htmlFor="paidAt" hint="A venda entra no financeiro nesta data.">
              <Input id="paidAt" name="paidAt" type="date" defaultValue={today} max={today} required />
            </Field>
          ) : null}
          <Field label="Observação (opcional)" htmlFor="note"><Input id="note" name="note" maxLength={500} /></Field>
          <div className="flex gap-2">
            <SubmitButton size="sm">Confirmar</SubmitButton>
            <Button type="button" size="sm" variant="ghost" onClick={() => setTarget(null)}>Voltar</Button>
          </div>
          <FormMessage state={state} />
        </form>
      ) : (
        <div className="flex flex-wrap gap-2">
          {next ? <Button size="sm" onClick={() => setTarget(next)}>Avançar: {LABELS[next]}</Button> : null}
          <select
            aria-label="Mudar para outra etapa"
            className="h-9 rounded-lg border border-line-strong bg-surface px-2 text-sm"
            value=""
            onChange={(e) => e.target.value && setTarget(e.target.value as OrderStatus)}
          >
            <option value="">Outra etapa…</option>
            {[...FLOW, "CANCELED" as OrderStatus].filter((s) => s !== status && s !== next).map((s) => <option key={s} value={s}>{LABELS[s]}</option>)}
          </select>
          {state.ok && state.message ? <FormMessage state={state} /> : null}
        </div>
      )}
    </div>
  );
}

export function DeleteOrderForm({ orderId }: { orderId: string }) {
  const [state, action] = useActionState(deleteOrderAction, initialActionState);
  useActionRedirect(state);
  return (
    <form action={action}>
      <input type="hidden" name="id" value={orderId} />
      <ConfirmSubmit message="Excluir este pedido definitivamente?">Excluir pedido</ConfirmSubmit>
      {!state.ok ? <FormMessage state={state} /> : null}
    </form>
  );
}
