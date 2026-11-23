import Link from "next/link";
import { UserPlus } from "lucide-react";
import { prisma } from "@/lib/db";
import { formatDateBR, formatMonthLong, monthKey, todayISO, toISO } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { param, type SearchParams } from "@/lib/search-params";
import { installmentState } from "@/modules/finance/calculations";
import { InstallmentStatusBadge } from "@/modules/finance/components/status";
import { SettleForm } from "@/modules/finance/components/entry-actions";
import { PayrollForm } from "@/modules/people/components/forms";
import { deleteSalaryPaymentAction } from "@/modules/people/actions";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { ConfirmSubmit } from "@/components/ui/form-bits";
import { EmptyState, PageHeader } from "@/components/ui/page-header";

export const metadata = { title: "Pessoas" };

export default async function PeoplePage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const today = todayISO();
  const month = /^\d{4}-\d{2}$/.test(param(sp, "mes") ?? "") ? param(sp, "mes")! : monthKey(today);
  const [employees, payments, accounts] = await Promise.all([
    prisma.employee.findMany({ include: { operation: true }, orderBy: [{ active: "desc" }, { name: "asc" }] }),
    prisma.salaryPayment.findMany({ where: { month }, include: { employee: true, entry: { include: { installments: true } } }, orderBy: { employee: { name: "asc" } } }),
    prisma.financialAccount.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);
  const active = employees.filter((e) => e.active);
  const monthlyPayroll = active.reduce((a, e) => a + e.salary, 0);
  const paid = payments.filter((p) => p.entry?.installments.every((i) => i.status === "SETTLED")).reduce((a, p) => a + p.amount, 0);

  return (
    <>
      <PageHeader title="Pessoas" description="Funcionários, salários e pagamentos. Acesso exclusivo do administrador." actions={<LinkButton href="/pessoas/novo"><UserPlus className="size-4" /> Funcionário</LinkButton>} />
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4"><p className="text-xs text-muted">Funcionários ativos</p><p className="num text-lg font-semibold">{active.length}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted">Folha mensal fixa</p><p className="num text-lg font-semibold">{formatMoney(monthlyPayroll)}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted">Pago ({formatMonthLong(month).split(" ")[0]})</p><p className="num text-lg font-semibold">{formatMoney(paid)}</p></Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <Card>
          <CardHeader title={`Salários de ${formatMonthLong(month)}`} action={
            <form className="flex gap-1">
              <input type="month" name="mes" defaultValue={month} aria-label="Mês" className="h-9 rounded-lg border border-line-strong bg-surface px-2 text-sm" />
              <button className="h-9 rounded-lg border border-line-strong px-2 text-sm">Ver</button>
            </form>
          } />
          {payments.length === 0 ? <EmptyState title="Salários deste mês ainda não gerados" description="Use “Gerar salários do mês” ao lado." /> : (
            <ul className="divide-y divide-line">
              {payments.map((p) => {
                const inst = p.entry?.installments[0];
                const st = inst ? installmentState({ status: inst.status, dueDate: toISO(inst.dueDate) }, today) : "PENDING";
                return (
                  <li key={p.id} className="px-4 py-3 sm:px-5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">{p.employee.name}</p>
                        <p className="text-xs text-muted">{inst ? `Vence ${formatDateBR(inst.dueDate)}` : ""}{inst?.settledAt ? ` · pago em ${formatDateBR(inst.settledAt)}` : ""}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="num font-semibold">{formatMoney(p.amount)}</span>
                        <InstallmentStatusBadge state={st} type="EXPENSE" />
                      </div>
                    </div>
                    {inst && inst.status === "PENDING" ? (
                      <div className="mt-2 flex flex-wrap items-start gap-2">
                        <SettleForm installmentId={inst.id} type="EXPENSE" today={today} accounts={accounts} defaults={{ accountId: inst.accountId, paymentMethod: inst.paymentMethod, feeAmount: 0 }} />
                        <form action={deleteSalaryPaymentAction}>
                          <input type="hidden" name="id" value={p.id} />
                          <ConfirmSubmit variant="ghost" message="Excluir este salário gerado? (Ex.: para gerar de novo com valor atualizado)">Excluir</ConfirmSubmit>
                        </form>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
        <Card className="self-start">
          <CardHeader title="Gerar salários do mês" />
          <CardBody><PayrollForm month={month} /></CardBody>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader title="Funcionários" />
        {employees.length === 0 ? <EmptyState title="Nenhum funcionário cadastrado" action={<LinkButton href="/pessoas/novo">Cadastrar</LinkButton>} /> : (
          <ul className="divide-y divide-line">
            {employees.map((e) => (
              <li key={e.id}>
                <Link href={`/pessoas/${e.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-canvas/60 sm:px-5">
                  <div className="min-w-0">
                    <p className="font-medium">{e.name} {!e.active ? <Badge>Inativo</Badge> : null}</p>
                    <p className="truncate text-xs text-muted">{[e.role, e.operation?.name ?? "Central", `paga dia ${e.paymentDay}`].filter(Boolean).join(" · ")}</p>
                  </div>
                  <span className="num shrink-0 font-medium">{formatMoney(e.salary)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <p className="mt-3 text-xs text-muted">Vales, bônus, comissões e encargos são lançados como saídas no financeiro, nas categorias do grupo Pessoal.</p>
    </>
  );
}
