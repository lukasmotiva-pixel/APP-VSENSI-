import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { param, type SearchParams } from "@/lib/search-params";
import { ProductForm } from "@/modules/crm/components/forms";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState, Notice } from "@/components/ui/page-header";

export const metadata = { title: "Produtos" };

export default async function ProductsPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const items = await prisma.product.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }], include: { _count: { select: { orderItems: true } } } });
  const editing = items.find((i) => i.id === param(sp, "editar"));
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-4">
        {param(sp, "salvo") ? <Notice tone="positive">Produto salvo.</Notice> : null}
        <Card>
          <CardHeader title="Catálogo de produtos" description="Usado para preencher os pedidos rapidamente." />
          {items.length === 0 ? <EmptyState title="Nenhum produto cadastrado" /> : (
            <ul className="divide-y divide-line">
              {items.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
                  <div className="min-w-0">
                    <p className="font-medium">{p.name} {!p.active ? <Badge>Inativo</Badge> : null}</p>
                    <p className="text-xs text-muted"><span className="num">{formatMoney(p.price)}</span> · {p._count.orderItems} venda(s) em pedidos</p>
                  </div>
                  <Link href={`?editar=${p.id}`} className="text-sm text-navy-800 hover:underline">Editar</Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      <Card className="self-start">
        <CardHeader title={editing ? `Editar ${editing.name}` : "Novo produto"} />
        <CardBody><ProductForm item={editing} /></CardBody>
      </Card>
    </div>
  );
}
