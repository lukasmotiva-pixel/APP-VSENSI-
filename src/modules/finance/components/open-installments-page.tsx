import Link from "next/link";
import { prisma } from "@/lib/db";
import { addDaysISO, formatDateBR, resolvePeriod, todayISO, toISO } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/cn";
import { param } from "@/lib/search-params";
import { getOpenTotals, listOpenInstallments, listSettledInstallments } from "../queries";
import { PAYMENT_METHOD_LABELS } from "../schemas";
import { SettleForm } from "./entry-actions";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/page-header";
import { ParamSelect, PeriodFilter } from "@/components/ui/filters";

type Item = Awaited<ReturnType<typeof listOpenInstallments>>[number];

/** Tela compartilhada de contas a pagar (EXPENSE) e a receber (INCOME). */
export async function OpenInstallmentsPage({ type, sp }: { type: "INCOME" | "EXPENSE"; sp: Record<string, string | string[] | undefined> }) {
  const today = todayISO();
  const isIncome = type === "INCOME";
  const base = isIncome ? "/financeiro/a-receber" : "/financeiro/a-pagar";
  const view = param(sp, "ver") === "quitadas" ? "settled" : "open";
  const operationId = param(sp, "operacao") ?? null;
  const [operations, accounts] = await Promise.all([
    prisma.operation.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.financialAccount.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);

  const title = isIncome ? "Contas a receber" : "Contas a pagar";
  const tabs = (
    <div className="mb-4 inline-flex rounded-lg border border-line-strong bg-surface p-1 text-sm">
      {[
        { key: "open", label: "Em aberto", href: base },
        { key: "settled", label: isIncome ? "Recebidas" : "Pagas", href: `${base}?ver=quitadas` },
      ].map((t) => (
        <Link key={t.key} href={t.href} className={cn("rounded-md px-3 py-1.5", view === t.key ? "bg-navy-900 text-white" : "text-muted hover:text-ink")}>
          {t.label}
        </Link>
      ))}
    </div>
  );

  const opFilter = <ParamSelect name="operacao" label="Operação" allLabel="Todas as operações" options={operations.map((o) => ({ value: o.id, label: o.name }))} />;

  if (view === "settled") {
    const period = resolvePeriod({ p: param(sp, "p"), de: param(sp, "de"), ate: param(sp, "ate") });
    const items = await listSettledInstallments(prisma, type, { from: period.from, to: period.to, operationId });
    const total = items.reduce((a, i) => a + i.amount - i.feeAmount, 0);
    return (
      <>
        <PageHeader title={title} description={`${isIncome ? "Recebimentos" : "Pagamentos"} efetivados · ${period.label}`} />
        {tabs}
        <div className="mb-4 flex flex-wrap gap-2">
          <PeriodFilter />
          {opFilter}
        </div>
        <Card>
          <CardHeader title={`Total ${isIncome ? "recebido (líquido)" : "pago"}`} action={<span className="num font-semibold">{formatMoney(total)}</span>} />
          {items.length === 0 ? (
            <EmptyState title="Nada no período" />
          ) : (
            <ul className="divide-y divide-line">
              {items.map((i) => (
                <li key={i.id}>
                  <Link href={`/financeiro/${i.entryId}`} className="flex items-start justify-between gap-3 px-4 py-3 hover:bg-canvas/60 sm:px-5">
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {i.entry.description}
                      </p>
                      <p className="text-xs text-muted">
                        {formatDateBR(i.settledAt)} · {i.entry.operation.name}
                        {i.paymentMethod ? ` · ${PAYMENT_METHOD_LABELS[i.paymentMethod]}` : ""}
                        {i.account ? ` · ${i.account.name}` : ""}
                      </p>
                    </div>
                    <span className="num shrink-0 font-medium">{formatMoney(i.amount - i.feeAmount)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </>
    );
  }

  const [items, totals] = await Promise.all([listOpenInstallments(prisma, type, operationId), getOpenTotals(prisma, today, operationId)]);
  const t = isIncome ? totals.receivable : totals.payable;
  const in7 = addDaysISO(today, 7);
  const groups: { key: string; title: string; tone?: "negative"; items: Item[] }[] = [
    { key: "overdue", title: "Vencidas", tone: "negative", items: items.filter((i) => toISO(i.dueDate) < today) },
    { key: "today", title: "Vencem hoje", items: items.filter((i) => toISO(i.dueDate) === today) },
    { key: "week", title: "Próximos 7 dias", items: items.filter((i) => toISO(i.dueDate) > today && toISO(i.dueDate) <= in7) },
    { key: "later", title: "Depois", items: items.filter((i) => toISO(i.dueDate) > in7) },
  ];

  return (
    <>
      <PageHeader title={title} description={isIncome ? "Valores a receber: parcelas de cartão, vendas a prazo e outros." : "Boletos, fornecedores, salários e demais despesas pendentes."} />
      {tabs}
      <div className="mb-4 grid grid-cols-3 gap-2">
        <Stat label="Em aberto" value={t.pending} />
        <Stat label="Vencido" value={t.overdue} tone={t.overdue > 0 ? "negative" : undefined} />
        <Stat label="Próx. 7 dias" value={t.next7} />
      </div>
      <div className="mb-4">{opFilter}</div>

      {items.length === 0 ? (
        <Card>
          <EmptyState title={isIncome ? "Nada a receber" : "Nenhuma conta a pagar"} description="Lançamentos pendentes aparecem aqui automaticamente." />
        </Card>
      ) : (
        <div className="space-y-4">
          {groups
            .filter((g) => g.items.length > 0)
            .map((g) => (
              <Card key={g.key}>
                <CardHeader
                  title={<span className={g.tone === "negative" ? "text-negative" : undefined}>{g.title}</span>}
                  action={<span className="num text-sm font-semibold">{formatMoney(g.items.reduce((a, i) => a + i.amount, 0))}</span>}
                />
                <ul className="divide-y divide-line">
                  {g.items.map((i) => (
                    <li key={i.id} className="px-4 py-3 sm:px-5">
                      <div className="flex items-start justify-between gap-3">
                        <Link href={`/financeiro/${i.entryId}`} className="min-w-0 hover:underline">
                          <p className="truncate font-medium">{i.entry.description}</p>
                          <p className="text-xs text-muted">
                            Vence {formatDateBR(i.dueDate)} · {i.entry.operation.name}
                            {i.entry.supplier ? ` · ${i.entry.supplier.name}` : ""}
                          </p>
                        </Link>
                        <span className="num shrink-0 font-semibold">{formatMoney(i.amount)}</span>
                      </div>
                      <div className="mt-2">
                        <SettleForm installmentId={i.id} type={type} today={today} accounts={accounts} defaults={{ accountId: i.accountId, paymentMethod: i.paymentMethod, feeAmount: i.feeAmount }} />
                      </div>
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
        </div>
      )}
    </>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "negative" }) {
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2">
      <p className="text-xs text-muted">{label}</p>
      <p className={cn("num text-sm font-semibold sm:text-base", tone === "negative" && "text-negative")}>{formatMoney(value)}</p>
    </div>
  );
}
