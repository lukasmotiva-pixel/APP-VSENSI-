import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatDateBR, resolvePeriod, todayISO } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { param, type SearchParams } from "@/lib/search-params";
import { listTransfers } from "@/modules/finance/queries";
import { deleteTransferAction } from "@/modules/finance/actions";
import { TransferForm } from "@/modules/finance/components/transfer-form";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/page-header";
import { PeriodFilter } from "@/components/ui/filters";
import { ConfirmSubmit } from "@/components/ui/form-bits";

export const metadata = { title: "Transferências" };

export default async function TransfersPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const period = resolvePeriod({ p: param(sp, "p"), de: param(sp, "de"), ate: param(sp, "ate") });
  const [accounts, transfers] = await Promise.all([
    prisma.financialAccount.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    listTransfers(prisma, period),
  ]);
  return (
    <>
      <PageHeader title="Transferências entre contas" description="Movimentações internas (ex.: caixa → banco). Não são receita nem despesa: só mudam onde o dinheiro está." />
      <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <Card>
          <CardHeader title="Nova transferência" />
          <CardBody>
            {accounts.length < 2 ? (
              <EmptyState title="Cadastre ao menos duas contas" description="Caixas dos quiosques, bancos e maquininhas são cadastrados em Configurações → Contas." action={<Link className="text-sm text-navy-800 underline" href="/configuracoes/contas">Ir para contas</Link>} />
            ) : (
              <TransferForm accounts={accounts} today={todayISO()} />
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Histórico" action={<PeriodFilter />} />
          {transfers.length === 0 ? (
            <EmptyState title="Nenhuma transferência no período" />
          ) : (
            <ul className="divide-y divide-line">
              {transfers.map((t) => (
                <li key={t.id} className="flex items-start justify-between gap-3 px-4 py-3 sm:px-5">
                  <div className="min-w-0">
                    <p className="font-medium">{t.description}</p>
                    <p className="text-xs text-muted">
                      {formatDateBR(t.date)} · {t.fromAccount.name} → {t.toAccount.name}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="num font-medium">{formatMoney(t.amount)}</span>
                    <form action={deleteTransferAction}>
                      <input type="hidden" name="transferId" value={t.id} />
                      <ConfirmSubmit variant="ghost" message="Excluir esta transferência?">Excluir</ConfirmSubmit>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
