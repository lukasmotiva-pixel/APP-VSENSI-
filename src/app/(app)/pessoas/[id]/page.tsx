import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { formatDateBR, formatMonthShort } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { param, type SearchParams } from "@/lib/search-params";
import { EmployeeForm } from "@/modules/people/components/forms";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState, Notice } from "@/components/ui/page-header";

export const metadata = { title: "Funcionário" };

export default async function EmployeePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SearchParams }) {
  const { id } = await params;
  const sp = await searchParams;
  const [e, operations] = await Promise.all([
    prisma.employee.findUnique({ where: { id }, include: { payments: { orderBy: { month: "desc" }, include: { entry: { include: { installments: true } } } } } }),
    prisma.operation.findMany({ where: { active: true, type: { not: "CENTRAL" } }, orderBy: { sortOrder: "asc" } }),
  ]);
  if (!e) notFound();
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link href="/pessoas" className="text-sm text-muted hover:text-ink">← Pessoas</Link>
      <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{e.name}</h1>
      {param(sp, "salvo") ? <Notice tone="positive">Funcionário salvo.</Notice> : null}
      <Card>
        <CardHeader title="Histórico de pagamentos" />
        {e.payments.length === 0 ? <EmptyState title="Nenhum salário gerado ainda" /> : (
          <ul className="divide-y divide-line">
            {e.payments.map((p) => {
              const inst = p.entry?.installments[0];
              return (
                <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm sm:px-5">
                  <span>{formatMonthShort(p.month)} {inst ? <span className="text-xs text-muted">· vence {formatDateBR(inst.dueDate)}</span> : null}</span>
                  <span className="flex items-center gap-2">
                    <span className="num font-medium">{formatMoney(p.amount)}</span>
                    {inst?.status === "SETTLED" ? <Badge tone="positive">Pago {formatDateBR(inst.settledAt)}</Badge> : <Badge tone="warning">Pendente</Badge>}
                    {p.entryId ? <Link href={`/financeiro/${p.entryId}`} className="text-navy-800 hover:underline">ver</Link> : null}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
      <Card>
        <CardHeader title="Dados do funcionário" />
        <CardBody><EmployeeForm item={e} operations={operations} /></CardBody>
      </Card>
    </div>
  );
}
