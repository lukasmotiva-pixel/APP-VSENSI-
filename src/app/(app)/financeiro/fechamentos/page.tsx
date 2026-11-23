import { prisma } from "@/lib/db";
import { endOfMonthISO, formatMonthLong, monthKey, todayISO } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/cn";
import { getCompleteness, getMonthlyComparison } from "@/modules/finance/queries";
import { reopenMonthAction } from "@/modules/finance/actions";
import { CloseMonthForm } from "@/modules/finance/components/close-month-form";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { ConfirmSubmit } from "@/components/ui/form-bits";

export const metadata = { title: "Fechamentos mensais" };

export default async function ClosingsPage() {
  const today = todayISO();
  const months = await getMonthlyComparison(prisma, today, 6);
  const closes = new Map((await prisma.periodClose.findMany()).map((c) => [c.month, c]));
  const rows = await Promise.all(
    [...months].reverse().map(async (m) => {
      const from = `${m.month}-01`;
      const completeness = await getCompleteness(prisma, { from, to: endOfMonthISO(from) });
      return { ...m, completeness, close: closes.get(m.month) };
    }),
  );
  return (
    <>
      <PageHeader
        title="Fechamentos mensais"
        description="Feche um mês quando todos os lançamentos dele estiverem registrados. Só meses fechados têm o resultado apresentado como calculado; os demais aparecem como estimativa."
      />
      <Card>
        <CardHeader title="Últimos 6 meses" />
        <ul className="divide-y divide-line">
          {rows.map((r) => (
            <li key={r.month} className="px-4 py-4 sm:px-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium capitalize">
                    {formatMonthLong(r.month)}{" "}
                    {r.closed ? <Badge tone="positive">Fechado</Badge> : r.month === monthKey(today) ? <Badge tone="navy">Em andamento</Badge> : <Badge tone="warning">Aberto</Badge>}
                  </p>
                  <p className="num mt-1 text-sm text-muted">
                    Faturamento {formatMoney(r.statement.grossRevenue)} · Resultado{" "}
                    <span className={cn("font-medium", r.statement.result < 0 ? "text-negative" : "text-ink")}>{formatMoney(r.statement.result)}</span>
                  </p>
                  {!r.closed && r.completeness.issues.length > 0 ? (
                    <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs text-muted">
                      {r.completeness.issues.map((i) => <li key={i}>{i}</li>)}
                    </ul>
                  ) : null}
                  {r.close ? <p className="mt-1 text-xs text-muted">Fechado em {r.close.closedAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</p> : null}
                </div>
                {r.closed ? (
                  <form action={reopenMonthAction}>
                    <input type="hidden" name="month" value={r.month} />
                    <ConfirmSubmit variant="secondary" message="Reabrir este mês? O resultado volta a ser estimado e os lançamentos poderão ser alterados.">Reabrir</ConfirmSubmit>
                  </form>
                ) : (
                  <CloseMonthForm month={r.month} />
                )}
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
