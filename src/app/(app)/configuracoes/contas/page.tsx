import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatDateBR, todayISO } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { param, type SearchParams } from "@/lib/search-params";
import { AccountForm } from "@/modules/settings/components/forms";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState, Notice } from "@/components/ui/page-header";

export const metadata = { title: "Contas financeiras" };
const TYPE = { CASH: "Dinheiro", BANK: "Banco", PAYMENT_PROVIDER: "Maquininha/carteira", OTHER: "Outra" } as const;

export default async function AccountsPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const [items, operations] = await Promise.all([
    prisma.financialAccount.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }], include: { operation: true } }),
    prisma.operation.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
  ]);
  const editing = items.find((i) => i.id === param(sp, "editar"));
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
      <div className="space-y-4">
        {param(sp, "salvo") ? <Notice tone="positive">Conta salva.</Notice> : null}
        <Card>
          <CardHeader title="Contas" description="Onde o dinheiro fica: caixas, bancos, maquininhas." />
          {items.length === 0 ? (
            <EmptyState title="Nenhuma conta cadastrada" description="Cadastre ao lado, com o saldo real na data de início do uso do sistema." />
          ) : (
            <ul className="divide-y divide-line">
              {items.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
                  <div className="min-w-0">
                    <p className="font-medium">{a.name} {!a.active ? <Badge>Inativa</Badge> : null}</p>
                    <p className="truncate text-xs text-muted">
                      {TYPE[a.type]}{a.operation ? ` · ${a.operation.name}` : ""} · saldo inicial <span className="num">{formatMoney(a.openingBalance)}</span> em {formatDateBR(a.openingDate)}
                    </p>
                  </div>
                  <Link href={`?editar=${a.id}`} className="text-sm text-navy-800 hover:underline">Editar</Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      <Card className="self-start">
        <CardHeader title={editing ? `Editar ${editing.name}` : "Nova conta"} />
        <CardBody><AccountForm item={editing} operations={operations} today={todayISO()} /></CardBody>
      </Card>
    </div>
  );
}
