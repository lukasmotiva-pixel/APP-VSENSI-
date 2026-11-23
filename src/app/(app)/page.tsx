import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, Plus } from "lucide-react";
import { prisma } from "@/lib/db";
import { formatDayShort, formatMonthShort, resolvePeriod, todayISO, diffDaysISO } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/cn";
import { param, type SearchParams } from "@/lib/search-params";
import {
  getAccountBalances, getCashSummary, getCompleteness, getDailyRevenue, getIncomeStatement, getOpenTotals, getStatementsByOperation,
} from "@/modules/finance/queries";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Notice, PageHeader } from "@/components/ui/page-header";
import { PeriodFilter } from "@/components/ui/filters";
import { HBar, RevenueBarChart } from "@/components/charts";

export const metadata = { title: "Início" };

function Kpi({ label, value, sub, tone, badge }: { label: string; value: number; sub?: React.ReactNode; tone?: "negative" | "positive"; badge?: React.ReactNode }) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-muted">{label}</p>
        {badge}
      </div>
      <p className={cn("num mt-1.5 text-lg font-semibold tracking-tight sm:text-xl", tone === "negative" && "text-negative")}>{formatMoney(value)}</p>
      {sub ? <p className="mt-0.5 text-xs text-muted">{sub}</p> : null}
    </Card>
  );
}

export default async function DashboardPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const today = todayISO();
  const period = resolvePeriod({ p: param(sp, "p"), de: param(sp, "de"), ate: param(sp, "ate") });
  const range = { from: period.from, to: period.to };

  const [todayStatement, statement, cash, open, completeness, byOperation, daily, balances, accountCount] = await Promise.all([
    getIncomeStatement(prisma, { from: today, to: today }),
    getIncomeStatement(prisma, range),
    getCashSummary(prisma, range),
    getOpenTotals(prisma, today),
    getCompleteness(prisma, range),
    getStatementsByOperation(prisma, range),
    getDailyRevenue(prisma, range),
    getAccountBalances(prisma, today),
    prisma.financialAccount.count(),
  ]);

  const estimated = completeness.status === "ESTIMATED";
  const days = diffDaysISO(period.to, period.from) + 1;
  // Até ~2 meses: barras por dia; acima disso, agrupa por mês.
  const chartData =
    days <= 62
      ? daily.map((d) => ({ label: formatDayShort(d.day), revenue: d.revenue }))
      : Object.entries(
          daily.reduce<Record<string, number>>((acc, d) => {
            acc[d.day.slice(0, 7)] = (acc[d.day.slice(0, 7)] ?? 0) + d.revenue;
            return acc;
          }, {}),
        ).map(([m, revenue]) => ({ label: formatMonthShort(m), revenue }));
  const ops = byOperation.filter((r) => r.operation.type !== "CENTRAL");
  const central = byOperation.find((r) => r.operation.type === "CENTRAL");
  const maxRevenue = Math.max(0, ...ops.map((o) => o.statement.grossRevenue));

  return (
    <>
      <PageHeader
        title="Visão geral"
        description={period.label}
        actions={
          <>
            <PeriodFilter />
            <span className="hidden lg:block">
              <LinkButton href="/financeiro/novo">
                <Plus className="size-4" /> Lançamento
              </LinkButton>
            </span>
          </>
        }
      />

      {accountCount === 0 ? (
        <div className="mb-4">
          <Notice tone="warning" title="Primeiro passo: cadastre as contas">
            Cadastre caixas dos quiosques, contas bancárias e maquininhas com o saldo inicial em{" "}
            <Link href="/configuracoes/contas" className="underline">Configurações → Contas</Link>, e renomeie as operações em{" "}
            <Link href="/configuracoes/operacoes" className="underline">Configurações → Operações</Link>.
          </Notice>
        </div>
      ) : null}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Indicadores">
        <Kpi label="Faturamento hoje" value={todayStatement.grossRevenue} sub="Vendas lançadas hoje" />
        <Kpi label="Faturamento no período" value={statement.grossRevenue} sub={`Receita líquida ${formatMoney(statement.netRevenue)}`} />
        <Kpi label="Entradas de caixa" value={cash.received} sub={cash.receivedFees ? `Líquido de ${formatMoney(cash.receivedFees)} em taxas` : "Recebimentos efetivados"} />
        <Kpi label="Saídas de caixa" value={cash.paid} sub="Pagamentos efetivados" />
      </section>

      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader
            title="Resultado do período"
            description="Faturamento − deduções − taxas − custos − despesas"
            action={<Badge tone={estimated ? "warning" : "positive"}>{estimated ? "Estimado" : "Calculado"}</Badge>}
          />
          <CardBody>
            <p className={cn("num text-2xl font-semibold tracking-tight", statement.result < 0 && "text-negative")}>{formatMoney(statement.result)}</p>
            <p className="mt-0.5 text-sm text-muted">{statement.marginPct !== null ? `Margem de ${statement.marginPct.toLocaleString("pt-BR")}% sobre o faturamento` : "Sem faturamento no período"}</p>
            <dl className="num mt-4 space-y-1.5 text-sm">
              <Row label="Custos de produção" value={statement.productionCost} />
              <Row label="Pessoal" value={statement.payroll} />
              <Row label="Demais despesas" value={statement.operating + statement.administrative + statement.taxes + statement.otherExpenses} />
              <Row label="Taxas e deduções" value={statement.fees + statement.deductions} />
            </dl>
            {estimated && completeness.issues.length > 0 ? (
              <details className="mt-4 rounded-lg bg-warning-soft px-3 py-2 text-sm">
                <summary className="cursor-pointer font-medium text-warning">Por que é uma estimativa ({completeness.issues.length})</summary>
                <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-ink/80">
                  {completeness.issues.map((i) => <li key={i}>{i}</li>)}
                </ul>
                <Link href="/financeiro/fechamentos" className="mt-2 inline-block text-xs font-medium text-navy-800 underline">Ver fechamentos</Link>
              </details>
            ) : null}
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Faturamento" description={days <= 62 ? "Vendas por dia (competência)" : "Vendas por mês (competência)"} />
          <CardBody>
            {statement.grossRevenue > 0 ? <RevenueBarChart data={chartData} /> : <p className="py-12 text-center text-sm text-muted">Nenhuma venda lançada no período.</p>}
          </CardBody>
        </Card>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        <Card>
          <CardHeader title="Contas a pagar" action={<Link href="/financeiro/a-pagar" className="text-sm text-navy-800 hover:underline">Ver</Link>} />
          <CardBody className="space-y-2">
            <OpenLine icon={<ArrowUpRight className="size-4" />} label="Em aberto" value={open.payable.pending} />
            <OpenLine label="Vencido" value={open.payable.overdue} tone={open.payable.overdue > 0 ? "negative" : undefined} sub={open.payable.overdueCount ? `${open.payable.overdueCount} parcela(s)` : undefined} />
            <OpenLine label="Próximos 7 dias" value={open.payable.next7} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Contas a receber" action={<Link href="/financeiro/a-receber" className="text-sm text-navy-800 hover:underline">Ver</Link>} />
          <CardBody className="space-y-2">
            <OpenLine icon={<ArrowDownLeft className="size-4" />} label="Em aberto" value={open.receivable.pending} />
            <OpenLine label="Vencido" value={open.receivable.overdue} tone={open.receivable.overdue > 0 ? "negative" : undefined} />
            <OpenLine label="Próximos 7 dias" value={open.receivable.next7} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Saldo em contas" action={<Link href="/financeiro/saldos" className="text-sm text-navy-800 hover:underline">Ver</Link>} />
          <CardBody>
            <p className={cn("num text-2xl font-semibold tracking-tight", balances.total < 0 && "text-negative")}>{formatMoney(balances.total)}</p>
            <p className="mt-0.5 text-sm text-muted">Hoje, somando {balances.items.filter((i) => i.account.active).length} conta(s) ativa(s)</p>
            {balances.unassigned.count > 0 ? <p className="mt-2 text-xs text-warning">{balances.unassigned.count} baixa(s) sem conta não entram no saldo.</p> : null}
          </CardBody>
        </Card>
      </div>

      <Card className="mt-3">
        <CardHeader title="Desempenho por operação" description="Faturamento e resultado de cada quiosque e do online no período" action={<Link href="/financeiro/relatorios?aba=operacoes" className="text-sm text-navy-800 hover:underline">Detalhes</Link>} />
        <div className="hidden grid-cols-[180px_1fr_130px_130px] gap-x-4 border-b border-line px-5 py-2 text-xs text-muted sm:grid">
          <span>Operação</span>
          <span />
          <span className="text-right">Faturamento</span>
          <span className="text-right">Resultado</span>
        </div>
        <ul className="divide-y divide-line">
          {ops.map((r) => (
            <li key={r.operation.id} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1.5 px-4 py-3 sm:grid-cols-[180px_1fr_130px_130px] sm:px-5">
              <p className="truncate text-sm font-medium">{r.operation.name}</p>
              <p className="num text-right text-sm font-semibold sm:order-3">{formatMoney(r.statement.grossRevenue)}</p>
              <div className="col-span-2 sm:order-2 sm:col-span-1"><HBar value={r.statement.grossRevenue} max={maxRevenue} /></div>
              <p className={cn("num col-span-2 text-xs text-muted sm:order-4 sm:col-span-1 sm:text-right sm:text-sm", r.statement.result < 0 && "text-negative")}>
                <span className="sm:hidden">Resultado </span>{formatMoney(r.statement.result)}
              </p>
            </li>
          ))}
        </ul>
        {central ? (
          <p className="border-t border-line px-4 py-3 text-xs text-muted sm:px-5">
            Despesas centrais/administrativas no período: <span className="num font-medium text-ink">{formatMoney(central.statement.totalExpenses + central.statement.productionCost)}</span> (não rateadas entre as operações).
          </p>
        ) : null}
      </Card>
    </>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-muted">{label}</dt>
      <dd>{value ? `− ${formatMoney(value)}` : formatMoney(0)}</dd>
    </div>
  );
}

function OpenLine({ label, value, tone, sub, icon }: { label: string; value: number; tone?: "negative"; sub?: string; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <span className="flex items-center gap-1.5 text-muted">{icon}{label}{sub ? <span className="text-xs">· {sub}</span> : null}</span>
      <span className={cn("num font-semibold", tone === "negative" && "text-negative")}>{formatMoney(value)}</span>
    </div>
  );
}
