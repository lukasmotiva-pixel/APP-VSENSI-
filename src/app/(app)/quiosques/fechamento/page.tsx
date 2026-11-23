import { prisma } from "@/lib/db";
import { todayISO, toISO } from "@/lib/dates";
import { param, type SearchParams } from "@/lib/search-params";
import { ClosingForm, type ClosingDefaults } from "@/modules/kiosks/components/closing-form";
import { EmptyState, PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";

export const metadata = { title: "Fechamento de caixa" };

export default async function ClosingPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const today = todayISO();
  const [kiosks, accounts] = await Promise.all([
    prisma.operation.findMany({ where: { type: "KIOSK", active: true }, orderBy: { sortOrder: "asc" } }),
    prisma.financialAccount.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);
  const editing = param(sp, "editar") ? await prisma.kioskClosing.findUnique({ where: { id: param(sp, "editar")! } }) : null;
  const operationId = editing?.operationId ?? param(sp, "quiosque") ?? kiosks[0]?.id ?? "";
  // Sugere as contas usadas no último fechamento deste quiosque.
  const last = editing ? null : await prisma.kioskClosing.findFirst({ where: { operationId }, orderBy: { date: "desc" } });
  const initial: ClosingDefaults = editing
    ? {
        id: editing.id, operationId: editing.operationId, date: toISO(editing.date), cash: editing.cash, pix: editing.pix, debit: editing.debit,
        credit: editing.credit, other: editing.other, debitFee: editing.debitFee, creditFee: editing.creditFee,
        creditReceiveDate: editing.creditReceiveDate ? toISO(editing.creditReceiveDate) : null, cashAccountId: editing.cashAccountId,
        pixAccountId: editing.pixAccountId, cardAccountId: editing.cardAccountId, notes: editing.notes,
      }
    : {
        operationId, date: today, cash: 0, pix: 0, debit: 0, credit: 0, other: 0, debitFee: 0, creditFee: 0, creditReceiveDate: null,
        cashAccountId: last?.cashAccountId ?? null, pixAccountId: last?.pixAccountId ?? null, cardAccountId: last?.cardAccountId ?? null, notes: null,
      };
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={editing ? "Editar fechamento de caixa" : "Fechamento de caixa"} description="Total vendido no dia por forma de pagamento. Gera a entrada no financeiro automaticamente." />
      {kiosks.length === 0 ? <Card><EmptyState title="Nenhum quiosque ativo" /></Card> : <ClosingForm kiosks={kiosks} accounts={accounts} today={today} initial={initial} />}
    </div>
  );
}
