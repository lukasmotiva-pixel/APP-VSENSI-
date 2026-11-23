import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatDateBR, isValidISODate, todayISO } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/cn";
import { param, type SearchParams } from "@/lib/search-params";
import { getAccountBalances } from "@/modules/finance/queries";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState, Notice, PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "Saldos das contas" };

const TYPE_LABEL = { CASH: "Dinheiro", BANK: "Banco", PAYMENT_PROVIDER: "Maquininha / carteira", OTHER: "Outra" } as const;

export default async function BalancesPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const today = todayISO();
  const asOfParam = param(sp, "em");
  const asOf = asOfParam && isValidISODate(asOfParam) ? asOfParam : today;
  const balances = await getAccountBalances(prisma, asOf);
  return (
    <>
      <PageHeader title="Saldos das contas" description={`Saldo de caixa em ${formatDateBR(asOf)}: saldo inicial + recebimentos − pagamentos ± transferências.`} />
      <form className="mb-4 flex items-end gap-2">
        <label className="text-sm">
          <span className="mb-1 block text-muted">Saldo em</span>
          <input type="date" name="em" defaultValue={asOf} max={today} className="h-10 rounded-lg border border-line-strong bg-surface px-2.5 text-[16px] sm:text-sm" />
        </label>
        <button className="h-10 rounded-lg border border-line-strong bg-surface px-3 text-sm font-medium">Ver</button>
      </form>
      {balances.unassigned.count > 0 ? (
        <div className="mb-4">
          <Notice tone="warning" title="Movimentações sem conta">
            {balances.unassigned.count} baixa(s) foram registradas sem conta ({formatMoney(balances.unassigned.total)} líquido) e não aparecem em nenhum saldo. Edite os lançamentos e informe a conta para que os saldos fiquem corretos.
          </Notice>
        </div>
      ) : null}
      <Card>
        <CardHeader title="Total em contas" action={<span className="num text-lg font-semibold">{formatMoney(balances.total)}</span>} />
        {balances.items.length === 0 ? (
          <EmptyState title="Nenhuma conta cadastrada" description="Cadastre caixas, bancos e maquininhas com o saldo inicial para acompanhar o dinheiro disponível." action={<Link href="/configuracoes/contas" className="text-sm text-navy-800 underline">Cadastrar contas</Link>} />
        ) : (
          <ul className="divide-y divide-line">
            {balances.items.map(({ account, balance, started }) => (
              <li key={account.id} className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
                <div className="min-w-0">
                  <p className="font-medium">
                    {account.name} {!account.active ? <Badge>Inativa</Badge> : null}
                  </p>
                  <p className="text-xs text-muted">
                    {TYPE_LABEL[account.type]}
                    {account.operation ? ` · ${account.operation.name}` : ""}
                    {!started ? ` · começa em ${formatDateBR(account.openingDate)}` : ""}
                  </p>
                </div>
                <span className={cn("num font-semibold", balance < 0 && "text-negative")}>{formatMoney(balance)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
