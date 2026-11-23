import Link from "next/link";
import { prisma } from "@/lib/db";
import { diffDaysISO, formatDateBR, formatMonthShort, resolvePeriod, todayISO } from "@/lib/dates";
import { formatMoney, percent } from "@/lib/money";
import { cn } from "@/lib/cn";
import { param, type SearchParams } from "@/lib/search-params";
import type { IncomeStatement } from "@/modules/finance/calculations";
import { GROUP_LABELS } from "@/modules/finance/calculations";
import { PAYMENT_METHOD_LABELS } from "@/modules/finance/schemas";
import {
  getCashFlowSeries, getCompleteness, getIncomeStatement, getMonthlyComparison, getSalesByPaymentMethod,
  getStatementsByOperation, getTotalsByCategory,
} from "@/modules/finance/queries";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState, PageHeader } from "@/components/ui/page-header";
import { buttonClass } from "@/components/ui/button";
import { ParamSelect, PeriodFilter } from "@/components/ui/filters";
import { CashFlowChart, HBar } from "@/components/charts";
import { PrintButton } from "@/components/ui/print-button";

export const metadata = { title: "Relatórios financeiros" };

const TABS = [
  { key: "resultado", label: "Resultado (DRE)" },
  { key: "operacoes", label: "Por operação" },
  { key: "fluxo", label: "Fluxo de caixa" },
  { key: "categorias", label: "Por categoria" },
  { key: "pagamentos", label: "Formas de pagamento" },
  { key: "mensal", label: "Comparativo mensal" },
] as const;

const money = (v: number) => formatMoney(v);

export default async function ReportsPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const tab = TABS.find((t) => t.key === param(sp, "aba"))?.key ?? "resultado";
  const period = resolvePeriod({ p: param(sp, "p"), de: param(sp, "de"), ate: param(sp, "ate") });
  const operationId = param(sp, "operacao") ?? null;
  const operations = await prisma.operation.findMany({ orderBy: { sortOrder: "asc" } });
  const f = { from: period.from, to: period.to, operationId };

  const tabHref = (key: string) => {
    const qs = new URLSearchParams(Object.entries(sp).flatMap(([k, v]) => (typeof v === "string" ? [[k, v]] : [])));
    qs.set("aba", key);
    return `/financeiro/relatorios?${qs.toString()}`;
  };

  return (
    <>
      <PageHeader
        title="Relatórios financeiros"
        description={`${period.label}${operationId ? ` · ${operations.find((o) => o.id === operationId)?.name ?? ""}` : " · Consolidado"}`}
        actions={
          <>
            <PrintButton />
            <a href={`/api/exportar/lancamentos?p=${period.key}&de=${period.from}&ate=${period.to}${operationId ? `&operacao=${operationId}` : ""}`} className={buttonClass("secondary")}>Excel (lançamentos)</a>
          </>
        }
      />
      <nav className="-mx-4 mb-4 overflow-x-auto px-4 sm:mx-0 sm:px-0" aria-label="Relatórios">
        <ul className="flex w-max gap-1 rounded-lg border border-line-strong bg-surface p-1 text-sm">
          {TABS.map((t) => (
            <li key={t.key}>
              <Link href={tabHref(t.key)} className={cn("block rounded-md px-3 py-1.5 whitespace-nowrap", tab === t.key ? "bg-navy-900 text-white" : "text-muted hover:text-ink")}>
                {t.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <div className="mb-4 flex flex-wrap gap-2">
        {tab !== "mensal" ? <PeriodFilter /> : null}
        {tab !== "operacoes" ? <ParamSelect name="operacao" label="Operação" allLabel="Consolidado (todas)" options={operations.map((o) => ({ value: o.id, label: o.name }))} /> : null}
      </div>

      {tab === "resultado" ? <ResultTab f={f} /> : null}
      {tab === "operacoes" ? <OperationsTab from={period.from} to={period.to} /> : null}
      {tab === "fluxo" ? <CashFlowTab f={f} /> : null}
      {tab === "categorias" ? <CategoriesTab f={f} /> : null}
      {tab === "pagamentos" ? <PaymentsTab f={f} /> : null}
      {tab === "mensal" ? <MonthlyTab operationId={operationId} /> : null}
    </>
  );
}

type F = { from: string; to: string; operationId: string | null };

function Line({ label, value, strong, sub, negative, indent }: { label: string; value: number; strong?: boolean; sub?: string; negative?: boolean; indent?: boolean }) {
  return (
    <tr className={cn(strong && "bg-canvas/70 font-semibold")}>
      <td className={cn("px-4 py-2.5 sm:px-5", indent && "pl-8 text-muted sm:pl-9")}>
        {label}
        {sub ? <span className="block text-xs font-normal text-muted">{sub}</span> : null}
      </td>
      <td className={cn("num px-4 py-2.5 text-right whitespace-nowrap sm:px-5", (negative || value < 0) && strong && value < 0 && "text-negative")}>
        {negative && value ? `− ${money(value)}` : money(value)}
      </td>
    </tr>
  );
}

function StatementTable({ s }: { s: IncomeStatement }) {
  return (
    <table className="w-full text-sm">
      <tbody className="divide-y divide-line">
        <Line label="Faturamento (receita bruta de vendas)" value={s.grossRevenue} strong />
        <Line label="Estornos e devoluções" value={s.deductions} negative indent />
        <Line label="Taxas financeiras (cartão, tarifas)" value={s.fees} negative indent />
        <Line label="Receita líquida" value={s.netRevenue} strong />
        <Line label="Custos de produção" value={s.productionCost} negative indent />
        <Line label="Margem bruta" value={s.grossProfit} strong sub={s.netRevenue ? `${percent(s.grossProfit, s.netRevenue)?.toLocaleString("pt-BR")}% da receita líquida` : undefined} />
        <Line label="Pessoal" value={s.payroll} negative indent />
        <Line label="Despesas operacionais" value={s.operating} negative indent />
        <Line label="Despesas administrativas" value={s.administrative} negative indent />
        <Line label="Impostos" value={s.taxes} negative indent />
        <Line label="Outras despesas" value={s.otherExpenses} negative indent />
        <Line label="Resultado operacional" value={s.operatingResult} strong />
        <Line label="Outras receitas" value={s.otherIncome} indent />
        <Line label="Resultado do período" value={s.result} strong sub={s.marginPct !== null ? `Margem líquida ${s.marginPct.toLocaleString("pt-BR")}%` : undefined} />
      </tbody>
    </table>
  );
}

async function ResultTab({ f }: { f: F }) {
  const [s, c] = await Promise.all([getIncomeStatement(prisma, f), getCompleteness(prisma, f)]);
  return (
    <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
      <Card>
        <CardHeader title="Demonstrativo de resultado" description="Regime de competência" action={<Badge tone={c.status === "CALCULATED" ? "positive" : "warning"}>{c.status === "CALCULATED" ? "Calculado" : "Estimado"}</Badge>} />
        <StatementTable s={s} />
      </Card>
      <div className="space-y-4">
        {c.issues.length > 0 ? (
          <Card>
            <CardHeader title="Pendências de contabilização" description="Enquanto existirem, o resultado é uma estimativa." />
            <CardBody>
              <ul className="list-disc space-y-1 pl-4 text-sm">{c.issues.map((i) => <li key={i}>{i}</li>)}</ul>
            </CardBody>
          </Card>
        ) : null}
        <Card>
          <CardHeader title="Fora do resultado" description="Saem do caixa, mas não são despesa" />
          <table className="w-full text-sm">
            <tbody className="divide-y divide-line">
              <Line label="Retiradas do proprietário" value={s.ownerWithdrawals} />
              <Line label="Investimentos e equipamentos" value={s.investments} />
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}

async function OperationsTab({ from, to }: { from: string; to: string }) {
  const rows = await getStatementsByOperation(prisma, { from, to });
  const total = rows.reduce(
    (a, r) => ({ revenue: a.revenue + r.statement.grossRevenue, cost: a.cost + r.statement.productionCost, exp: a.exp + r.statement.totalExpenses + r.statement.deductions + r.statement.fees, result: a.result + r.statement.result }),
    { revenue: 0, cost: 0, exp: 0, result: 0 },
  );
  const ranked = rows.filter((r) => r.operation.type !== "CENTRAL" && r.hasData).sort((a, b) => b.statement.result - a.statement.result);
  return (
    <Card>
      <CardHeader title="Resultado por operação" description={ranked[0] ? `Melhor resultado no período: ${ranked[0].operation.name}` : "Comparação entre quiosques, online e central"} />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-muted">
              <th className="px-4 py-2.5 font-medium sm:px-5">Operação</th>
              <th className="px-4 py-2.5 text-right font-medium">Faturamento</th>
              <th className="px-4 py-2.5 text-right font-medium">Custos produção</th>
              <th className="px-4 py-2.5 text-right font-medium">Despesas, taxas e deduções</th>
              <th className="px-4 py-2.5 text-right font-medium sm:px-5">Resultado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r.operation.id}>
                <td className="px-4 py-2.5 font-medium sm:px-5">
                  <Link href={`/financeiro/relatorios?aba=resultado&operacao=${r.operation.id}&p=custom&de=${from}&ate=${to}`} className="hover:underline">{r.operation.name}</Link>
                </td>
                <td className="num px-4 py-2.5 text-right">{money(r.statement.grossRevenue)}</td>
                <td className="num px-4 py-2.5 text-right">{money(r.statement.productionCost)}</td>
                <td className="num px-4 py-2.5 text-right">{money(r.statement.totalExpenses + r.statement.deductions + r.statement.fees)}</td>
                <td className={cn("num px-4 py-2.5 text-right font-semibold sm:px-5", r.statement.result < 0 && "text-negative")}>{money(r.statement.result)}</td>
              </tr>
            ))}
            <tr className="bg-canvas/70 font-semibold">
              <td className="px-4 py-2.5 sm:px-5">Consolidado</td>
              <td className="num px-4 py-2.5 text-right">{money(total.revenue)}</td>
              <td className="num px-4 py-2.5 text-right">{money(total.cost)}</td>
              <td className="num px-4 py-2.5 text-right">{money(total.exp)}</td>
              <td className={cn("num px-4 py-2.5 text-right sm:px-5", total.result < 0 && "text-negative")}>{money(total.result)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="border-t border-line px-4 py-3 text-xs text-muted sm:px-5">
        Despesas da operação “Central / administrativo” não são rateadas: o resultado de cada quiosque não inclui essa parcela. Inclui outras receitas.
      </p>
    </Card>
  );
}

async function CashFlowTab({ f }: { f: F }) {
  const granularity = diffDaysISO(f.to, f.from) > 62 ? "month" : "day";
  const series = await getCashFlowSeries(prisma, f, granularity);
  const totals = series.reduce((a, s) => ({ in: a.in + s.inflow, out: a.out + s.outflow }), { in: 0, out: 0 });
  const label = (k: string) => (granularity === "day" ? formatDateBR(k).slice(0, 5) : formatMonthShort(k));
  const rows = series.filter((s) => s.inflow || s.outflow);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Entradas (líquidas)" value={totals.in} />
        <Stat label="Saídas" value={totals.out} />
        <Stat label="Saldo do período" value={totals.in - totals.out} />
      </div>
      <Card>
        <CardHeader title="Entradas e saídas de caixa" description="Pela data efetiva de recebimento/pagamento. Transferências internas não entram." />
        <CardBody>
          <CashFlowChart data={series.map((s) => ({ label: label(s.key), inflow: s.inflow, outflow: s.outflow }))} />
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Tabela" />
        {rows.length === 0 ? (
          <EmptyState title="Sem movimentação no período" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-muted">
                  <th className="px-4 py-2.5 font-medium sm:px-5">{granularity === "day" ? "Dia" : "Mês"}</th>
                  <th className="px-4 py-2.5 text-right font-medium">Entradas</th>
                  <th className="px-4 py-2.5 text-right font-medium">Saídas</th>
                  <th className="px-4 py-2.5 text-right font-medium">Saldo</th>
                  <th className="px-4 py-2.5 text-right font-medium sm:px-5">Acumulado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {series.filter((s) => s.inflow || s.outflow).map((s) => (
                  <tr key={s.key}>
                    <td className="px-4 py-2 sm:px-5">{granularity === "day" ? formatDateBR(s.key) : formatMonthShort(s.key)}</td>
                    <td className="num px-4 py-2 text-right">{money(s.inflow)}</td>
                    <td className="num px-4 py-2 text-right">{money(s.outflow)}</td>
                    <td className={cn("num px-4 py-2 text-right", s.net < 0 && "text-negative")}>{money(s.net)}</td>
                    <td className={cn("num px-4 py-2 text-right sm:px-5", s.accumulated < 0 && "text-negative")}>{money(s.accumulated)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

async function CategoriesTab({ f }: { f: F }) {
  const [expenses, incomes] = await Promise.all([getTotalsByCategory(prisma, f, "EXPENSE"), getTotalsByCategory(prisma, f, "INCOME")]);
  const block = (title: string, items: typeof expenses) => {
    const total = items.reduce((a, i) => a + i.total, 0);
    const max = Math.max(0, ...items.map((i) => i.total));
    return (
      <Card>
        <CardHeader title={title} action={<span className="num font-semibold">{money(total)}</span>} />
        {items.length === 0 ? (
          <EmptyState title="Nada no período" />
        ) : (
          <ul className="divide-y divide-line">
            {items.map((i) => (
              <li key={i.id} className="space-y-1.5 px-4 py-3 sm:px-5">
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="min-w-0">
                    <Link href={`/financeiro?categoria=${i.id}&p=custom&de=${f.from}&ate=${f.to}`} className="font-medium hover:underline">{i.name}</Link>
                    <span className="block text-xs text-muted">{GROUP_LABELS[i.group]} · {i.count} lançamento(s)</span>
                  </span>
                  <span className="num shrink-0 text-right">
                    {money(i.total)} <span className="text-xs text-muted">{percent(i.total, total)?.toLocaleString("pt-BR")}%</span>
                  </span>
                </div>
                <HBar value={i.total} max={max} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    );
  };
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {block("Saídas por categoria", expenses)}
      {block("Entradas por categoria", incomes)}
    </div>
  );
}

async function PaymentsTab({ f }: { f: F }) {
  const rows = await getSalesByPaymentMethod(prisma, f);
  const total = rows.reduce((a, r) => a + r.total, 0);
  const max = Math.max(0, ...rows.map((r) => r.total));
  return (
    <Card>
      <CardHeader title="Vendas por forma de pagamento" description="Faturamento (competência) pela forma informada em cada parcela" action={<span className="num font-semibold">{money(total)}</span>} />
      {rows.length === 0 ? (
        <EmptyState title="Nenhuma venda no período" />
      ) : (
        <ul className="divide-y divide-line">
          {rows.map((r) => (
            <li key={r.method ?? "none"} className="space-y-1.5 px-4 py-3 sm:px-5">
              <div className="flex justify-between gap-3 text-sm">
                <span className="font-medium">{r.method ? PAYMENT_METHOD_LABELS[r.method as keyof typeof PAYMENT_METHOD_LABELS] : "Não informada"}</span>
                <span className="num">
                  {money(r.total)} <span className="text-xs text-muted">{percent(r.total, total)?.toLocaleString("pt-BR")}%</span>
                </span>
              </div>
              <HBar value={r.total} max={max} />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

async function MonthlyTab({ operationId }: { operationId: string | null }) {
  const months = await getMonthlyComparison(prisma, todayISO(), 12, operationId);
  return (
    <Card>
      <CardHeader title="Comparativo dos últimos 12 meses" description="Competência. Meses não fechados são estimativas." />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-muted">
              <th className="px-4 py-2.5 font-medium sm:px-5">Mês</th>
              <th className="px-4 py-2.5 text-right font-medium">Faturamento</th>
              <th className="px-4 py-2.5 text-right font-medium">Receita líquida</th>
              <th className="px-4 py-2.5 text-right font-medium">Custos produção</th>
              <th className="px-4 py-2.5 text-right font-medium">Despesas</th>
              <th className="px-4 py-2.5 text-right font-medium">Resultado</th>
              <th className="px-4 py-2.5 text-right font-medium sm:px-5">Situação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {[...months].reverse().map((m) => (
              <tr key={m.month}>
                <td className="px-4 py-2.5 font-medium sm:px-5">{formatMonthShort(m.month)}</td>
                <td className="num px-4 py-2.5 text-right">{money(m.statement.grossRevenue)}</td>
                <td className="num px-4 py-2.5 text-right">{money(m.statement.netRevenue)}</td>
                <td className="num px-4 py-2.5 text-right">{money(m.statement.productionCost)}</td>
                <td className="num px-4 py-2.5 text-right">{money(m.statement.totalExpenses)}</td>
                <td className={cn("num px-4 py-2.5 text-right font-semibold", m.statement.result < 0 && "text-negative")}>{money(m.statement.result)}</td>
                <td className="px-4 py-2.5 text-right sm:px-5">{m.closed ? <Badge tone="positive">Fechado</Badge> : <Badge tone="warning">Estimado</Badge>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2">
      <p className="text-xs text-muted">{label}</p>
      <p className={cn("num text-sm font-semibold sm:text-base", value < 0 && "text-negative")}>{money(value)}</p>
    </div>
  );
}
