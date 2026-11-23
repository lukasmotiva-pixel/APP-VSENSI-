import Link from "next/link";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/db";
import { formatDateBR, resolvePeriod, todayISO, toISO } from "@/lib/dates";
import { formatMoney, percent } from "@/lib/money";
import { param, type SearchParams } from "@/lib/search-params";
import { getIncomeStatement, getMonthlyComparison, getTotalsByCategory } from "@/modules/finance/queries";
import { Card, CardHeader } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/page-header";
import { PeriodFilter } from "@/components/ui/filters";
import { HBar } from "@/components/charts";
import { formatMonthShort } from "@/lib/dates";

export const metadata = { title: "Compras e produção" };

export default async function ProductionPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const today = todayISO();
  const period = resolvePeriod({ p: param(sp, "p"), de: param(sp, "de"), ate: param(sp, "ate") });
  const [st, byCategory, bySupplier, openBills, months, rawMaterial] = await Promise.all([
    getIncomeStatement(prisma, period),
    getTotalsByCategory(prisma, period, "EXPENSE"),
    prisma.$queryRaw<{ id: string | null; name: string | null; total: bigint }[]>`
      SELECT s.id, s.name, SUM(e.amount)::bigint AS total
      FROM entries e JOIN categories c ON c.id = e.category_id LEFT JOIN suppliers s ON s.id = e.supplier_id
      WHERE e.canceled_at IS NULL AND c."group" = 'PRODUCTION_COST' AND e.competence_date BETWEEN ${period.from}::date AND ${period.to}::date
      GROUP BY s.id, s.name ORDER BY total DESC`,
    prisma.installment.findMany({
      where: { status: "PENDING", entry: { canceledAt: null, type: "EXPENSE", category: { group: "PRODUCTION_COST" } } },
      include: { entry: { include: { supplier: true } } },
      orderBy: { dueDate: "asc" },
      take: 50,
    }),
    getMonthlyComparison(prisma, today, 6),
    prisma.category.findFirst({ where: { group: "PRODUCTION_COST", active: true }, orderBy: { sortOrder: "asc" } }),
  ]);
  const prodCats = byCategory.filter((c) => c.group === "PRODUCTION_COST");
  const max = Math.max(0, ...bySupplier.map((s) => Number(s.total)));

  return (
    <>
      <PageHeader
        title="Compras e produção"
        description={`Matérias-primas, embalagens e custos de fabricação · ${period.label}`}
        actions={
          <>
            <PeriodFilter />
            <LinkButton href={`/financeiro/novo?tipo=saida${rawMaterial ? `&categoria=${rawMaterial.id}` : ""}`}><Plus className="size-4" /> Nova compra</LinkButton>
          </>
        }
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card className="p-4"><p className="text-xs text-muted">Custo de produção</p><p className="num text-lg font-semibold">{formatMoney(st.productionCost)}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted">Faturamento</p><p className="num text-lg font-semibold">{formatMoney(st.grossRevenue)}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted">Custo / faturamento</p><p className="num text-lg font-semibold">{percent(st.productionCost, st.grossRevenue)?.toLocaleString("pt-BR") ?? "—"}%</p></Card>
        <Card className="p-4"><p className="text-xs text-muted">Boletos de compras em aberto</p><p className="num text-lg font-semibold">{formatMoney(openBills.reduce((a, i) => a + i.amount, 0))}</p></Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Por fornecedor" />
          {bySupplier.length === 0 ? <EmptyState title="Nenhuma compra no período" /> : (
            <ul className="divide-y divide-line">
              {bySupplier.map((s) => (
                <li key={s.id ?? "none"} className="space-y-1.5 px-4 py-3 sm:px-5">
                  <div className="flex justify-between text-sm"><span className="font-medium">{s.name ?? "Sem fornecedor informado"}</span><span className="num">{formatMoney(Number(s.total))}</span></div>
                  <HBar value={Number(s.total)} max={max} />
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <CardHeader title="Por categoria de custo" />
          {prodCats.length === 0 ? <EmptyState title="Nenhum custo no período" /> : (
            <ul className="divide-y divide-line">
              {prodCats.map((c) => (
                <li key={c.id} className="flex justify-between px-4 py-3 text-sm sm:px-5">
                  <Link href={`/financeiro?categoria=${c.id}&p=custom&de=${period.from}&ate=${period.to}`} className="hover:underline">{c.name} <span className="text-xs text-muted">({c.count})</span></Link>
                  <span className="num font-medium">{formatMoney(c.total)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader title="Boletos e parcelas de compras a pagar" action={<Link href="/financeiro/a-pagar" className="text-sm text-navy-800 hover:underline">Contas a pagar</Link>} />
        {openBills.length === 0 ? <EmptyState title="Nada pendente" /> : (
          <ul className="divide-y divide-line">
            {openBills.map((i) => (
              <li key={i.id}>
                <Link href={`/financeiro/${i.entryId}`} className="flex justify-between gap-3 px-4 py-3 hover:bg-canvas/60 sm:px-5">
                  <span className="min-w-0 text-sm"><span className="block truncate font-medium">{i.entry.description}</span><span className={`text-xs ${toISO(i.dueDate) < today ? "text-negative" : "text-muted"}`}>Vence {formatDateBR(i.dueDate)}{i.entry.supplier ? ` · ${i.entry.supplier.name}` : ""}</span></span>
                  <span className="num shrink-0 font-medium">{formatMoney(i.amount)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="mt-4">
        <CardHeader title="Custo de produção × faturamento (6 meses)" />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-sm">
            <thead><tr className="border-b border-line text-left text-xs text-muted"><th className="px-4 py-2 font-medium sm:px-5">Mês</th><th className="px-4 py-2 text-right font-medium">Faturamento</th><th className="px-4 py-2 text-right font-medium">Custo produção</th><th className="px-4 py-2 text-right font-medium sm:px-5">%</th></tr></thead>
            <tbody className="divide-y divide-line">
              {[...months].reverse().map((m) => (
                <tr key={m.month}>
                  <td className="px-4 py-2 sm:px-5">{formatMonthShort(m.month)}</td>
                  <td className="num px-4 py-2 text-right">{formatMoney(m.statement.grossRevenue)}</td>
                  <td className="num px-4 py-2 text-right">{formatMoney(m.statement.productionCost)}</td>
                  <td className="num px-4 py-2 text-right sm:px-5">{percent(m.statement.productionCost, m.statement.grossRevenue)?.toLocaleString("pt-BR") ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <p className="mt-3 text-xs text-muted">Compras são lançadas como saídas nas categorias de “Custos de produção”, com fornecedor e boletos (use “Parcelado” para vários vencimentos). Controle de estoque por quantidade fica para uma etapa futura.</p>
    </>
  );
}
