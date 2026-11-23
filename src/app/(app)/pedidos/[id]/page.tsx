import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";
import { prisma } from "@/lib/db";
import { formatDateBR, todayISO } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { param, type SearchParams } from "@/lib/search-params";
import { PAYMENT_METHOD_LABELS } from "@/modules/finance/schemas";
import { CHANNEL_LABELS, DELIVERY_LABELS, ORDER_STATUS_LABELS } from "@/modules/orders/service";
import { DeleteOrderForm, StatusControls } from "@/modules/orders/components/status-controls";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Notice } from "@/components/ui/page-header";
import { STATUS_TONE } from "@/modules/orders/tone";

export const metadata = { title: "Pedido" };

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 text-sm break-words">{children}</dd>
    </div>
  );
}

export default async function OrderPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SearchParams }) {
  const { id } = await params;
  const sp = await searchParams;
  const o = await prisma.order.findUnique({
    where: { id },
    include: { customer: true, operation: true, account: true, items: true, entry: true, history: { orderBy: { createdAt: "desc" } } },
  });
  if (!o) notFound();
  const paid = Boolean(o.entry && !o.entry.canceledAt);
  const phoneDigits = o.customer.phone?.replace(/\D/g, "");

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <Link href="/pedidos" className="text-sm text-muted hover:text-ink">← Pedidos</Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Pedido #{o.number}</h1>
            <p className="num mt-1 text-2xl font-semibold">{formatMoney(o.total)}</p>
          </div>
          <Badge tone={STATUS_TONE[o.status]}>{ORDER_STATUS_LABELS[o.status]}</Badge>
        </div>
      </div>
      {param(sp, "salvo") ? <Notice tone="positive">Pedido salvo.</Notice> : null}

      <Card>
        <CardHeader title="Andamento" />
        <CardBody><StatusControls orderId={o.id} status={o.status} paid={paid} today={todayISO()} /></CardBody>
      </Card>

      <Card>
        <CardHeader title="Cliente" action={<Link href={`/crm/clientes/${o.customer.id}`} className="text-sm text-navy-800 hover:underline">Ver cliente</Link>} />
        <CardBody>
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Info label="Nome">{o.customer.name}</Info>
            <Info label="Telefone">
              {o.customer.phone ? (
                <>{o.customer.phone}{phoneDigits ? <a className="ml-2 text-navy-800 underline" href={`https://wa.me/${phoneDigits.length <= 11 ? `55${phoneDigits}` : phoneDigits}`} target="_blank" rel="noopener noreferrer">WhatsApp</a> : null}</>
              ) : "—"}
            </Info>
            <Info label="Canal">{CHANNEL_LABELS[o.channel]}</Info>
            <Info label="Data do pedido">{formatDateBR(o.orderDate)}</Info>
            <Info label="Operação">{o.operation.name}</Info>
            <Info label="Atendido por">{o.attendant ?? "—"}</Info>
          </dl>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Itens" />
        <ul className="divide-y divide-line">
          {o.items.map((i) => (
            <li key={i.id} className="flex justify-between gap-3 px-4 py-2.5 text-sm sm:px-5">
              <span>{i.quantity} × {i.description} <span className="num text-muted">({formatMoney(i.unitPrice)})</span></span>
              <span className="num font-medium">{formatMoney(i.quantity * i.unitPrice)}</span>
            </li>
          ))}
        </ul>
        <dl className="num space-y-1 border-t border-line px-4 py-3 text-sm sm:px-5">
          <div className="flex justify-between"><dt className="text-muted">Subtotal</dt><dd>{formatMoney(o.subtotal)}</dd></div>
          {o.discount ? <div className="flex justify-between"><dt className="text-muted">Desconto</dt><dd>− {formatMoney(o.discount)}</dd></div> : null}
          {o.shippingFee ? <div className="flex justify-between"><dt className="text-muted">Frete</dt><dd>{formatMoney(o.shippingFee)}</dd></div> : null}
          <div className="flex justify-between font-semibold"><dt>Total</dt><dd>{formatMoney(o.total)}</dd></div>
        </dl>
      </Card>

      <Card>
        <CardHeader title="Pagamento e entrega" />
        <CardBody>
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Info label="Forma de pagamento">{o.paymentMethod ? PAYMENT_METHOD_LABELS[o.paymentMethod] : "—"}</Info>
            <Info label="Conta">{o.account?.name ?? "—"}</Info>
            <Info label="Pagamento">{o.paidAt ? `Recebido em ${formatDateBR(o.paidAt)}` : "Não confirmado"}</Info>
            <Info label="Entrega">{o.deliveryMethod ? DELIVERY_LABELS[o.deliveryMethod] : "A definir"}</Info>
            {o.trackingCode ? <Info label="Rastreamento">{o.trackingCode}</Info> : null}
            {o.deliveryPerson ? <Info label="Entregador">{o.deliveryPerson}</Info> : null}
            {o.excursionInfo ? <Info label="Excursão">{o.excursionInfo}</Info> : null}
            {o.expectedDelivery ? <Info label="Previsão">{formatDateBR(o.expectedDelivery)}</Info> : null}
          </dl>
          {o.address ? <p className="mt-4 rounded-lg bg-canvas px-3 py-2 text-sm whitespace-pre-wrap">{o.address}</p> : null}
          {o.notes ? <p className="mt-2 rounded-lg bg-canvas px-3 py-2 text-sm whitespace-pre-wrap">{o.notes}</p> : null}
          {o.entry ? <p className="mt-3 text-sm"><Link href={`/financeiro/${o.entry.id}`} className="text-navy-800 underline">Ver lançamento financeiro</Link>{o.entry.canceledAt ? " (cancelado)" : ""}</p> : null}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Histórico" />
        <ul className="divide-y divide-line">
          {o.history.map((h) => (
            <li key={h.id} className="px-4 py-2.5 text-sm sm:px-5">
              <p>{ORDER_STATUS_LABELS[h.status]}{h.note ? ` — ${h.note}` : ""}</p>
              <p className="text-xs text-muted">{h.createdAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</p>
            </li>
          ))}
        </ul>
      </Card>

      <div className="flex flex-wrap gap-2">
        <LinkButton href={`/pedidos/${o.id}/editar`} variant="secondary" size="sm"><Pencil className="size-4" /> Editar</LinkButton>
        {!paid ? <DeleteOrderForm orderId={o.id} /> : null}
      </div>
    </div>
  );
}
