import Link from "next/link";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/db";
import { diffDaysISO, resolvePeriod, todayISO } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/cn";
import { param, type SearchParams } from "@/lib/search-params";
import { getStatementsByOperation } from "@/modules/finance/queries";
import { Card, CardHeader } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/page-header";
import { PeriodFilter } from "@/components/ui/filters";
import { HBar } from "@/components/charts";

export const metadata = { title: "Quiosques" };

export default async function KiosksPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const today = todayISO();
  const period = resolvePeriod({ p: param(sp, "p"), de: param(sp, "de"), ate: param(sp, "ate") });
  const lastDay = period.to < today ? period.to : today;
  const days = period.from > today ? 0 : diffDaysISO(lastDay, period.from) + 1;
  const [rows, counts] = await Promise.all([
    getStatementsByOperation(prisma, period),
    prisma.kioskClosing.groupBy({ by: ["operationId"], where: { date: { gte: new Date(`${period.from}T00:00:00Z`), lte: new Date(`${period.to}T00:00:00Z`) } }, _count: true }),
  ]);
  const kiosks = rows.filter((r) => r.operation.type === "KIOSK");
  const max = Math.max(0, ...kiosks.map((k) => k.statement.grossRevenue));
  const best = [...kiosks].filter((k) => k.hasData).sort((a, b) => b.statement.result - a.statement.result)[0];

  return (
    <>
      <PageHeader
        title="Quiosques"
        description={`${period.label}${best ? ` · Melhor resultado: ${best.operation.name}` : ""}`}
        actions={
          <>
            <PeriodFilter />
            <LinkButton href="/quiosques/fechamento"><Plus className="size-4" /> Fechamento de caixa</LinkButton>
          </>
        }
      />
      {kiosks.length === 0 ? (
        <Card><EmptyState title="Nenhum quiosque ativo" description="Cadastre os quiosques em Configurações → Operações." /></Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {kiosks.map((k) => {
            const closings = counts.find((c) => c.operationId === k.operation.id)?._count ?? 0;
            return (
              <Link key={k.operation.id} href={`/quiosques/${k.operation.id}?p=${period.key}${period.key === "custom" ? `&de=${period.from}&ate=${period.to}` : ""}`}>
                <Card className="h-full p-4 transition-colors hover:border-line-strong">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{k.operation.name}</p>
                      {k.operation.address ? <p className="truncate text-xs text-muted">{k.operation.address}</p> : null}
                    </div>
                    <span className={cn("text-xs", closings < days ? "text-warning" : "text-muted")}>{closings}/{days} fechamentos</span>
                  </div>
                  <p className="num mt-3 text-xl font-semibold">{formatMoney(k.statement.grossRevenue)}</p>
                  <p className="text-xs text-muted">faturamento</p>
                  <div className="mt-2"><HBar value={k.statement.grossRevenue} max={max} /></div>
                  <dl className="num mt-3 grid grid-cols-2 gap-2 text-sm">
                    <div><dt className="text-xs text-muted">Despesas e custos</dt><dd>{formatMoney(k.statement.totalExpenses + k.statement.productionCost + k.statement.fees + k.statement.deductions)}</dd></div>
                    <div><dt className="text-xs text-muted">Resultado</dt><dd className={cn("font-semibold", k.statement.result < 0 && "text-negative")}>{formatMoney(k.statement.result)}</dd></div>
                    <div><dt className="text-xs text-muted">Média por dia</dt><dd>{formatMoney(days ? Math.round(k.statement.grossRevenue / days) : 0)}</dd></div>
                  </dl>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
      <Card className="mt-4">
        <CardHeader title="Como funciona" />
        <p className="px-4 py-3 text-sm text-muted sm:px-5">
          No fim do dia, registre o <strong className="text-ink">fechamento de caixa</strong> de cada quiosque com o total por forma de pagamento.
          O sistema cria automaticamente a entrada no financeiro (uma por dia, sem duplicar) e já direciona cada valor para a conta certa.
          Despesas do quiosque (aluguel, manutenção…) são lançadas como saídas com a operação do quiosque.
        </p>
      </Card>
    </>
  );
}
