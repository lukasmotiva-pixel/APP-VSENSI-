import { Badge } from "@/components/ui/badge";
import type { EntryState, InstallmentState } from "../calculations";

export function EntryStatusBadge({ state, type }: { state: EntryState; type: "INCOME" | "EXPENSE" }) {
  const done = type === "INCOME" ? "Recebido" : "Pago";
  const map = {
    SETTLED: <Badge tone="positive">{done}</Badge>,
    PARTIAL: <Badge tone="navy">Parcial</Badge>,
    PENDING: <Badge tone="neutral">{type === "INCOME" ? "A receber" : "A pagar"}</Badge>,
    OVERDUE: <Badge tone="negative">Vencido</Badge>,
    CANCELED: <Badge tone="neutral" className="line-through">Cancelado</Badge>,
  } as const;
  return map[state];
}

export function InstallmentStatusBadge({ state, type }: { state: InstallmentState; type: "INCOME" | "EXPENSE" }) {
  if (state === "SETTLED") return <Badge tone="positive">{type === "INCOME" ? "Recebida" : "Paga"}</Badge>;
  if (state === "OVERDUE") return <Badge tone="negative">Vencida</Badge>;
  return <Badge tone="neutral">Pendente</Badge>;
}
