import Link from "next/link";
import { Plus } from "lucide-react";
import type { OrderStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { formatDateBR, todayISO } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/cn";
import { param, type SearchParams } from "@/lib/search-params";
import { CHANNEL_LABELS, DELIVERY_LABELS, needsAttention, ORDER_STATUS_LABELS, ORDER_STATUSES } from "@/modules/orders/service";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { STATUS_TONE } from "@/modules/orders/tone";
import { LinkButton } from "@/components/ui/button";
import { EmptyState, Notice, PageHeader } from "@/components/ui/page-header";
import { SearchInput } from "@/components/ui/filters";

export const metadata = { title: "Pedidos" };


export default async function OrdersPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const today = todayISO();
  const filter = param(sp, "status");
  const q = param(sp, "q");
  const status = ORDER_STATUSES.find((s) => s === filter);
  const open = filter === "abertos" || !filter;
  const where: Prisma.OrderWhereInput = {
    ...(status ? { status } : open ? { status: { notIn: ["DELIVERED", "CANCELED"] } } : {}),
    ...(q ? { OR: [{ customer: { name: { contains: q, mode: "insensitive" } } }, { customer: { phone: { contains: q } } }, ...(Number(q) ? [{ number: Number(q) }] : [])] } : {}),
  };
  const [orders, counts] = await Promise.all([
    prisma.order.findMany({ where, include: { customer: true, _count: { select: { items: true } } }, orderBy: [{ orderDate: "desc" }, { number: "desc" }], take: 200 }),
    prisma.order.groupBy({ by: ["status"], _count: true }),
  ]);
  const count = (s: OrderStatus) => counts.find((c) => c.status === s)?._count ?? 0;
  const attention = orders.map((o) => ({ o, why: needsAttention(o, today) })).filter((x) => x.why);
  const tabs = [
    { key: "abertos", label: "Em andamento", n: ORDER_STATUSES.filter((s) => s !== "DELIVERED" && s !== "CANCELED").reduce((a, s) => a + count(s), 0) },
    ...ORDER_STATUSES.map((s) => ({ key: s, label: ORDER_STATUS_LABELS[s], n: count(s) })),
    { key: "todos", label: "Todos", n: counts.reduce((a, c) => a + c._count, 0) },
  ];

  return (
    <>
      <PageHeader title="Pedidos" description="Operação online: WhatsApp, Instagram e outros canais." actions={<LinkButton href="/pedidos/novo"><Plus className="size-4" /> Novo pedido</LinkButton>} />
      {param(sp, "excluido") ? <div className="mb-3"><Notice tone="positive">Pedido excluído.</Notice></div> : null}
      <nav className="-mx-4 mb-3 overflow-x-auto px-4 sm:mx-0 sm:px-0" aria-label="Etapas">
        <ul className="flex w-max gap-1 rounded-lg border border-line-strong bg-surface p-1 text-sm">
          {tabs.map((t) => {
            const active = (filter ?? "abertos") === t.key;
            return (
              <li key={t.key}>
                <Link href={`/pedidos?status=${t.key}`} className={cn("flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5", active ? "bg-navy-900 text-white" : "text-muted hover:text-ink")}>
                  {t.label} <span className={cn("num text-xs", active ? "text-white/70" : "text-subtle")}>{t.n}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="mb-4"><SearchInput placeholder="Buscar por cliente, telefone ou nº do pedido" /></div>

      {attention.length > 0 && open ? (
        <div className="mb-4">
          <Notice tone="warning" title={`${attention.length} pedido(s) precisam de atenção`}>
            <ul className="mt-1 space-y-0.5">
              {attention.slice(0, 8).map(({ o, why }) => (
                <li key={o.id}><Link className="underline" href={`/pedidos/${o.id}`}>#{o.number} {o.customer.name}</Link> — {why}</li>
              ))}
            </ul>
          </Notice>
        </div>
      ) : null}

      <Card>
        {orders.length === 0 ? (
          <EmptyState title="Nenhum pedido aqui" action={<LinkButton href="/pedidos/novo">Registrar pedido</LinkButton>} />
        ) : (
          <ul className="divide-y divide-line">
            {orders.map((o) => (
              <li key={o.id}>
                <Link href={`/pedidos/${o.id}`} className="flex items-start justify-between gap-3 px-4 py-3 hover:bg-canvas/60 sm:px-5">
                  <div className="min-w-0">
                    <p className="truncate font-medium"><span className="num text-muted">#{o.number}</span> {o.customer.name}</p>
                    <p className="truncate text-xs text-muted">
                      {formatDateBR(o.orderDate)} · {CHANNEL_LABELS[o.channel]} · {o._count.items} item(ns){o.deliveryMethod ? ` · ${DELIVERY_LABELS[o.deliveryMethod]}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="num font-semibold">{formatMoney(o.total)}</span>
                    <Badge tone={STATUS_TONE[o.status]}>{ORDER_STATUS_LABELS[o.status]}</Badge>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
