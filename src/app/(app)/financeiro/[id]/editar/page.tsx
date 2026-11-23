import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { todayISO, toISO } from "@/lib/dates";
import { getFormOptions } from "@/modules/finance/queries";
import { EntryForm } from "@/modules/finance/components/entry-form";
import { PageHeader } from "@/components/ui/page-header";

export const metadata = { title: "Editar lançamento" };

export default async function EditEntryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const entry = await prisma.entry.findUnique({ where: { id }, include: { installments: { orderBy: { number: "asc" } } } });
  if (!entry) notFound();
  if (entry.canceledAt || entry.source !== "MANUAL") redirect(`/financeiro/${id}`);
  const options = await getFormOptions(prisma, [entry.categoryId, entry.operationId, entry.supplierId ?? "", ...entry.installments.map((i) => i.accountId ?? "")].filter(Boolean));
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Editar lançamento" description="As parcelas serão substituídas pelas informadas abaixo." />
      <EntryForm
        today={todayISO()}
        defaultType={entry.type}
        {...options}
        initial={{
          id: entry.id,
          type: entry.type,
          description: entry.description,
          competenceDate: toISO(entry.competenceDate),
          categoryId: entry.categoryId,
          operationId: entry.operationId,
          supplierId: entry.supplierId,
          refundOfId: entry.refundOfId,
          notes: entry.notes,
          installments: entry.installments.map((i) => ({
            dueDate: toISO(i.dueDate),
            amount: i.amount,
            feeAmount: i.feeAmount,
            paymentMethod: i.paymentMethod,
            accountId: i.accountId,
            status: i.status,
            settledAt: i.settledAt ? toISO(i.settledAt) : null,
          })),
        }}
      />
    </div>
  );
}
