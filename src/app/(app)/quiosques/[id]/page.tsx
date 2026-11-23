import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/db";
import { dateOnly, diffDaysISO, formatDateBR, formatDayShort, resolvePeriod, todayISO } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/cn";
import { param, type SearchParams } from "@/lib/search-params";
import { getDailyRevenue, getIncomeStatement, getSalesByPaymentMethod, getTotalsByCategory } from "@/modules/finance/queries";
import { PAYMENT_METHOD_LABELS } from "@/modules/finance/schemas";
import { closingTotal } from "@/modules/kiosks/service";
import { deleteClosingAction } from "@/modules/kiosks/actions";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/button";
import { ConfirmSubmit } from "@/components/ui/form-bits";
import { EmptyState, Notice, PageHeader } from "@/components/ui/page-header";
import { PeriodFilter } from "@/components/ui/filters";
import { RevenueBarChart } from "@/components/charts";

export const metadata = { title: "Quiosque" };

export default async function KioskPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SearchParams }) {
  const { id } = await params;
  const sp = await searchParams;
  const op = await prisma.operation.findUnique({ where: { id } });
  if (!op || op.type !== "KIOSK") notFound();
  const today = todayISO();
  const period = resolvePeriod({ p: param(sp, "p"), de: param(sp, "de"), ate: param(sp, "ate") });
  const f = { from: period.from, to: period.to, operationId: id };
  const [st, daily, methods, expenses, closings] = await Promise.all([
    getIncomeStatement(prisma, f),
    getDailyRevenue(prisma, f),
    getSalesByPaymentMethod(prisma, f),
    getTotalsByCategory(prisma, f, "EXPENSE"),
    prisma.kioskClosing.findMany({ where: { operationId: id, date: { gte: dateOnly(period.from), lte: dateOnly(period.to) } }, orderBy: { date: "desc" } }),
  ]);
  const closedDays = new Set(closings.map((c) => c.date.toISOString().slice(0, 10)));
  const lastDay = period.to < today ? period.to : today;
  const missing = period.from > today ? [] : daily.filter((d) => d.day <= lastDay && !closedDays.has(d.day)).map((d) => d.day);

  return (
    <>
      <Link href="/quiosques" className="text-sm text-muted hover:text-ink">← Quiosques</Link>
      <PageHeader
        title={op.name}
        description={`${op.address ? `${op.address} · ` : ""}${period.label}`}
        actions={
          <>
            <PeriodFilter />
            <LinkButton href={`/financeiro/novo?tipo=saida&operacao=${id}`} variant="secondary">Despesa</LinkButton>
            <LinkButton href={`/quiosques/fechamento?quiosque=${id}`}><Plus className="size-4" /> Fechamento</LinkButton>
          </>
        }
      />
      {param(sp, "salvo") ? <div className="mb-4"><Notice tone="positive">Fechamento salvo e lançado no financeiro.</Notice></div> : null}
      {missing.length > 0 && diffDaysISO(lastDay, period.from) < 62 ? (
        <div className="mb-4">
          <Notice tone="warning" title={`${missing.length} dia(s) sem fechamento de caixa`}>
            {missing.slice(-10).map(formatDayShort).join(", ")}{missing.length > 10 ? "…" : ""}. Se o quiosque abriu nesses dias, registre o fechamento.
          </Notice>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Faturamento", st.grossRevenue],
          ["Taxas", st.fees],
          ["Despesas e custos", st.totalExpenses + st.productionCost + st.deductions],
          ["Resultado", st.result],
        ].map(([l, v]) => (
          <Card key={l as string} className="p-4">
            <p className="text-xs text-muted">{l}</p>
            <p className={cn("num mt-1 text-lg font-semibold", (v as number) < 0 && "text-negative")}>{formatMoney(v as number)}</p>
          </Card>
        ))}
      </div>

      <Card className="mt-3">
        <CardHeader title="Vendas por dia" />
        <CardBody>{st.grossRevenue > 0 ? <RevenueBarChart data={daily.map((d) => ({ label: formatDayShort(d.day), revenue: d.revenue }))} /> : <p className="py-8 text-center text-sm text-muted">Sem vendas no período.</p>}</CardBody>
      </Card>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader title="Formas de recebimento" />
          {methods.length === 0 ? <EmptyState title="Sem vendas" /> : (
            <ul className="divide-y divide-line">
              {methods.map((m) => (
                <li key={m.method ?? "x"} className="flex justify-between px-4 py-2.5 text-sm sm:px-5">
                  <span>{m.method ? PAYMENT_METHOD_LABELS[m.method as keyof typeof PAYMENT_METHOD_LABELS] : "Não informada"}</span>
                  <span className="num font-medium">{formatMoney(m.total)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <CardHeader title="Despesas do quiosque" action={<Link href={`/financeiro?tipo=saida&operacao=${id}&p=custom&de=${period.from}&ate=${period.to}`} className="text-sm text-navy-800 hover:underline">Ver lançamentos</Link>} />
          {expenses.length === 0 ? <EmptyState title="Nenhuma despesa no período" /> : (
            <ul className="divide-y divide-line">
              {expenses.map((e) => (
                <li key={e.id} className="flex justify-between px-4 py-2.5 text-sm sm:px-5">
                  <span>{e.name}</span>
                  <span className="num font-medium">{formatMoney(e.total)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="mt-3">
        <CardHeader title="Fechamentos de caixa" />
        {closings.length === 0 ? <EmptyState title="Nenhum fechamento no período" /> : (
          <ul className="divide-y divide-line">
            {closings.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-5">
                <div className="min-w-0">
                  <p className="font-medium">{formatDateBR(c.date)} · <span className="num">{formatMoney(closingTotal(c))}</span></p>
                  <p className="num text-xs text-muted">
                    Dinheiro {formatMoney(c.cash)} · Pix {formatMoney(c.pix)} · Débito {formatMoney(c.debit)} · Crédito {formatMoney(c.credit)}{c.other ? ` · Outros ${formatMoney(c.other)}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  {c.entryId ? <Link href={`/financeiro/${c.entryId}`} className="px-2 text-sm text-navy-800 hover:underline">Lançamento</Link> : null}
                  <Link href={`/quiosques/fechamento?editar=${c.id}`} className="px-2 text-sm text-navy-800 hover:underline">Editar</Link>
                  <form action={deleteClosingAction}>
                    <input type="hidden" name="id" value={c.id} />
                    <ConfirmSubmit variant="ghost" message="Excluir este fechamento? A entrada correspondente no financeiro também será excluída.">Excluir</ConfirmSubmit>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
