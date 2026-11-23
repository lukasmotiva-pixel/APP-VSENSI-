import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil, Plus } from "lucide-react";
import { prisma } from "@/lib/db";
import { formatDateBR, todayISO } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { param, type SearchParams } from "@/lib/search-params";
import { INTERACTION_STATUS_LABELS } from "@/modules/crm/service";
import { CHANNEL_LABELS, ORDER_STATUS_LABELS } from "@/modules/orders/service";
import { STATUS_TONE } from "@/modules/orders/tone";
import { deleteInteractionAction, setInteractionStatusAction } from "@/modules/crm/actions";
import { InteractionForm } from "@/modules/crm/components/forms";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { ConfirmSubmit } from "@/components/ui/form-bits";
import { EmptyState, Notice } from "@/components/ui/page-header";

export const metadata = { title: "Cliente" };

export default async function CustomerPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SearchParams }) {
  const { id } = await params;
  const sp = await searchParams;
  const c = await prisma.customer.findUnique({
    where: { id },
    include: { interactions: { orderBy: [{ date: "desc" }, { createdAt: "desc" }], include: { order: true } }, orders: { orderBy: { orderDate: "desc" } } },
  });
  if (!c) notFound();
  const paidOrders = c.orders.filter((o) => o.entryId && o.status !== "CANCELED");
  const spent = paidOrders.reduce((a, o) => a + o.total, 0);
  const digits = c.phone?.replace(/\D/g, "");

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <Link href="/crm/clientes" className="text-sm text-muted hover:text-ink">← Clientes</Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{c.name}</h1>
            <p className="text-sm text-muted">{[c.phone, c.instagram ? `@${c.instagram}` : null, `Origem: ${CHANNEL_LABELS[c.channel]}`, c.city].filter(Boolean).join(" · ")}</p>
          </div>
          <div className="flex gap-2">
            {digits ? <LinkButton href={`https://wa.me/${digits.length <= 11 ? `55${digits}` : digits}`} target="_blank" rel="noopener noreferrer" variant="secondary" size="sm">WhatsApp</LinkButton> : null}
            {c.instagram ? <LinkButton href={`https://instagram.com/${c.instagram}`} target="_blank" rel="noopener noreferrer" variant="secondary" size="sm">Instagram</LinkButton> : null}
            <LinkButton href={`/crm/clientes/${c.id}/editar`} variant="secondary" size="sm"><Pencil className="size-4" /> Editar</LinkButton>
          </div>
        </div>
      </div>
      {param(sp, "salvo") ? <Notice tone="positive">Cliente salvo.</Notice> : null}
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-3"><p className="text-xs text-muted">Pedidos pagos</p><p className="num font-semibold">{paidOrders.length}</p></Card>
        <Card className="p-3"><p className="text-xs text-muted">Total comprado</p><p className="num font-semibold">{formatMoney(spent)}</p></Card>
        <Card className="p-3"><p className="text-xs text-muted">Atendimentos</p><p className="num font-semibold">{c.interactions.length}</p></Card>
      </div>
      {c.notes ? <Card><CardBody className="text-sm whitespace-pre-wrap">{c.notes}</CardBody></Card> : null}

      <Card>
        <CardHeader title="Registrar atendimento" />
        <CardBody><InteractionForm customerId={c.id} defaultChannel={c.channel} today={todayISO()} orders={c.orders.map((o) => ({ id: o.id, number: o.number }))} /></CardBody>
      </Card>

      <Card>
        <CardHeader title="Histórico de atendimento" />
        {c.interactions.length === 0 ? <EmptyState title="Nenhum atendimento registrado" /> : (
          <ul className="divide-y divide-line">
            {c.interactions.map((i) => (
              <li key={i.id} className="space-y-1 px-4 py-3 sm:px-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-muted">{formatDateBR(i.date)} · {CHANNEL_LABELS[i.channel]}{i.attendant ? ` · ${i.attendant}` : ""}{i.order ? ` · Pedido #${i.order.number}` : ""}</p>
                  <Badge tone={i.status === "CONVERTED" ? "positive" : i.status === "INTERESTED" ? "navy" : "neutral"}>{INTERACTION_STATUS_LABELS[i.status]}</Badge>
                </div>
                <p className="text-sm whitespace-pre-wrap">{i.summary}</p>
                {i.followUpDate && (i.status === "PENDING" || i.status === "INTERESTED") ? <p className="text-xs text-warning">Retornar em {formatDateBR(i.followUpDate)}</p> : null}
                <div className="flex flex-wrap gap-1 pt-1">
                  {(["PENDING", "INTERESTED", "CONVERTED", "LOST"] as const).filter((s) => s !== i.status).map((s) => (
                    <form key={s} action={setInteractionStatusAction}>
                      <input type="hidden" name="id" value={i.id} />
                      <input type="hidden" name="status" value={s} />
                      <button className="h-8 rounded-md border border-line px-2 text-xs text-muted hover:bg-canvas hover:text-ink">{INTERACTION_STATUS_LABELS[s]}</button>
                    </form>
                  ))}
                  <form action={deleteInteractionAction}>
                    <input type="hidden" name="id" value={i.id} />
                    <ConfirmSubmit variant="ghost" message="Excluir este atendimento?">Excluir</ConfirmSubmit>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader title="Pedidos" action={<LinkButton href={`/pedidos/novo?cliente=${c.id}`} size="sm"><Plus className="size-4" /> Pedido</LinkButton>} />
        {c.orders.length === 0 ? <EmptyState title="Ainda não comprou" /> : (
          <ul className="divide-y divide-line">
            {c.orders.map((o) => (
              <li key={o.id}>
                <Link href={`/pedidos/${o.id}`} className="flex justify-between gap-3 px-4 py-3 hover:bg-canvas/60 sm:px-5">
                  <span className="text-sm"><span className="num text-muted">#{o.number}</span> {formatDateBR(o.orderDate)}</span>
                  <span className="flex items-center gap-2"><Badge tone={STATUS_TONE[o.status]}>{ORDER_STATUS_LABELS[o.status]}</Badge><span className="num text-sm font-medium">{formatMoney(o.total)}</span></span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
