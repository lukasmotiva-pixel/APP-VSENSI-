import Link from "next/link";
import { UserPlus } from "lucide-react";
import { prisma } from "@/lib/db";
import { param, type SearchParams } from "@/lib/search-params";
import { CHANNEL_LABELS } from "@/modules/orders/service";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/page-header";
import { ParamSelect, SearchInput } from "@/components/ui/filters";

export const metadata = { title: "Clientes" };

export default async function CustomersPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const q = param(sp, "q");
  const tipo = param(sp, "tipo");
  const customers = await prisma.customer.findMany({
    where: {
      ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { phone: { contains: q } }, { instagram: { contains: q, mode: "insensitive" } }] } : {}),
      ...(tipo === "compraram" ? { orders: { some: { entryId: { not: null }, status: { not: "CANCELED" } } } } : tipo === "nao-compraram" ? { orders: { none: { entryId: { not: null }, status: { not: "CANCELED" } } } } : {}),
    },
    include: { _count: { select: { orders: true, interactions: true } }, orders: { where: { entryId: { not: null }, status: { not: "CANCELED" } }, select: { id: true } } },
    orderBy: { updatedAt: "desc" },
    take: 300,
  });
  return (
    <>
      <Link href="/crm" className="text-sm text-muted hover:text-ink">← Atendimento</Link>
      <PageHeader title="Clientes" actions={<LinkButton href="/crm/clientes/novo"><UserPlus className="size-4" /> Novo cliente</LinkButton>} />
      <div className="mb-4 flex flex-wrap gap-2">
        <ParamSelect name="tipo" label="Tipo" allLabel="Todos" options={[{ value: "compraram", label: "Já compraram" }, { value: "nao-compraram", label: "Ainda não compraram" }]} />
        <SearchInput placeholder="Nome, telefone ou Instagram" />
      </div>
      <Card>
        {customers.length === 0 ? <EmptyState title="Nenhum cliente encontrado" /> : (
          <ul className="divide-y divide-line">
            {customers.map((c) => (
              <li key={c.id}>
                <Link href={`/crm/clientes/${c.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-canvas/60 sm:px-5">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{c.name}</p>
                    <p className="truncate text-xs text-muted">{[c.phone, c.instagram ? `@${c.instagram}` : null, CHANNEL_LABELS[c.channel], c.city].filter(Boolean).join(" · ")}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1 text-xs text-muted">
                    {c.orders.length > 0 ? <Badge tone="positive">{c.orders.length > 1 ? "Recorrente" : "Cliente"}</Badge> : <Badge>Ainda não comprou</Badge>}
                    <span>{c._count.interactions} atend. · {c._count.orders} pedido(s)</span>
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
