import Link from "next/link";
import { MessageSquarePlus, UserPlus } from "lucide-react";
import { prisma } from "@/lib/db";
import { formatDateBR, resolvePeriod, todayISO, toISO } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/cn";
import { param, type SearchParams } from "@/lib/search-params";
import { getCrmMetrics, listOpenInteractions } from "@/modules/crm/queries";
import { INTERACTION_STATUS_LABELS } from "@/modules/crm/service";
import { CHANNEL_LABELS } from "@/modules/orders/service";
import { setInteractionStatusAction } from "@/modules/crm/actions";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { EmptyState, Notice, PageHeader } from "@/components/ui/page-header";
import { PeriodFilter } from "@/components/ui/filters";

export const metadata = { title: "Atendimento (CRM)" };

function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="num mt-1 text-lg font-semibold">{value}</p>
      {sub ? <p className="text-xs text-muted">{sub}</p> : null}
    </Card>
  );
}

export default async function CrmPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const today = todayISO();
  const period = resolvePeriod({ p: param(sp, "p"), de: param(sp, "de"), ate: param(sp, "ate") });
  const [m, open] = await Promise.all([getCrmMetrics(prisma, period), listOpenInteractions(prisma)]);
  return (
    <>
      <PageHeader
        title="Atendimento"
        description={`Clientes, conversas e conversão · ${period.label}`}
        actions={
          <>
            <PeriodFilter />
            <LinkButton href="/crm/clientes" variant="secondary">Clientes</LinkButton>
            <LinkButton href="/crm/respostas" variant="secondary">Respostas rápidas</LinkButton>
            <LinkButton href="/crm/clientes/novo"><UserPlus className="size-4" /> Cliente</LinkButton>
          </>
        }
      />
      <Notice title="Registro manual">
        Por enquanto os atendimentos são registrados à mão. A integração automática com WhatsApp e Instagram será ativada quando as contas oficiais da Meta estiverem configuradas.
      </Notice>
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Atendimentos" value={m.interactions} sub={`${m.open} em aberto`} />
        <Stat label="Geraram venda" value={m.converted} sub={m.conversionPct !== null ? `Conversão ${m.conversionPct.toLocaleString("pt-BR")}%` : "Sem atendimentos"} />
        <Stat label="Clientes novos" value={m.newCustomers} />
        <Stat label="Clientes recorrentes" value={m.recurringCustomers} sub="2+ pedidos pagos (total)" />
        <Stat label="Vendas WhatsApp" value={formatMoney(m.sales.whatsapp.total)} sub={`${m.sales.whatsapp.count} pedido(s) pagos`} />
        <Stat label="Vendas Instagram" value={formatMoney(m.sales.instagram.total)} sub={`${m.sales.instagram.count} pedido(s) pagos`} />
        <Stat label="Outros canais" value={formatMoney(m.sales.other.total)} sub={`${m.sales.other.count} pedido(s) pagos`} />
        <Stat label="Não compraram" value={m.lost} />
      </div>

      <Card className="mt-4">
        <CardHeader title="Atendimentos em aberto" description="Pendentes e oportunidades — retornos vencidos primeiro." />
        {open.length === 0 ? (
          <EmptyState title="Nenhum atendimento em aberto" description="Registre atendimentos na página de cada cliente." action={<LinkButton href="/crm/clientes" variant="secondary"><MessageSquarePlus className="size-4" /> Ver clientes</LinkButton>} />
        ) : (
          <ul className="divide-y divide-line">
            {open.map((i) => {
              const late = i.followUpDate && toISO(i.followUpDate) <= today;
              return (
                <li key={i.id} className="px-4 py-3 sm:px-5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <Link href={`/crm/clientes/${i.customerId}`} className="min-w-0 hover:underline">
                      <p className="font-medium">{i.customer.name} <Badge tone={i.status === "INTERESTED" ? "navy" : "neutral"}>{INTERACTION_STATUS_LABELS[i.status]}</Badge></p>
                      <p className="line-clamp-2 text-sm text-muted">{i.summary}</p>
                      <p className={cn("text-xs", late ? "font-medium text-negative" : "text-subtle")}>
                        {formatDateBR(i.date)} · {CHANNEL_LABELS[i.channel]}{i.followUpDate ? ` · retornar ${formatDateBR(i.followUpDate)}` : ""}
                      </p>
                    </Link>
                    <div className="flex gap-1">
                      {(["CONVERTED", "LOST"] as const).map((s) => (
                        <form key={s} action={setInteractionStatusAction}>
                          <input type="hidden" name="id" value={i.id} />
                          <input type="hidden" name="status" value={s} />
                          <button className="h-8 rounded-md border border-line-strong px-2 text-xs hover:bg-canvas">{s === "CONVERTED" ? "Comprou" : "Não comprou"}</button>
                        </form>
                      ))}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}
