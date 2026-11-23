import { prisma } from "@/lib/db";
import { todayISO } from "@/lib/dates";
import { param, type SearchParams } from "@/lib/search-params";
import { getFormOptions } from "@/modules/finance/queries";
import { EntryForm } from "@/modules/finance/components/entry-form";
import { PageHeader } from "@/components/ui/page-header";

export const metadata = { title: "Novo lançamento" };

export default async function NewEntryPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const options = await getFormOptions(prisma);
  const type = param(sp, "tipo") === "saida" ? "EXPENSE" : "INCOME";
  const refundId = param(sp, "estorno");
  const original = refundId ? await prisma.entry.findUnique({ where: { id: refundId } }) : null;
  const refund = original && original.type === "INCOME" && !original.canceledAt
    ? { id: original.id, description: original.description, amount: original.amount, operationId: original.operationId }
    : undefined;
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={refund ? "Registrar estorno" : "Novo lançamento"}
        description={refund ? "Saída vinculada à venda original. Reduz a receita líquida sem apagar a venda." : "Registre uma entrada ou saída. Use “Parcelado” para cartão em várias vezes ou boletos."}
      />
      <EntryForm
        today={todayISO()}
        defaultType={type}
        refund={refund}
        preset={{ operationId: param(sp, "operacao"), categoryId: param(sp, "categoria"), supplierId: param(sp, "fornecedor") }}
        {...options}
      />
    </div>
  );
}
