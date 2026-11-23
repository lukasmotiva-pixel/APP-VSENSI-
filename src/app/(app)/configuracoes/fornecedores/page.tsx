import Link from "next/link";
import { prisma } from "@/lib/db";
import { param, type SearchParams } from "@/lib/search-params";
import { SupplierForm } from "@/modules/settings/components/forms";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState, Notice } from "@/components/ui/page-header";

export const metadata = { title: "Fornecedores" };

export default async function SuppliersPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const items = await prisma.supplier.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }], include: { _count: { select: { entries: true } } } });
  const editing = items.find((i) => i.id === param(sp, "editar"));
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
      <div className="space-y-4">
        {param(sp, "salvo") ? <Notice tone="positive">Fornecedor salvo.</Notice> : null}
        <Card>
          <CardHeader title="Fornecedores" />
          {items.length === 0 ? (
            <EmptyState title="Nenhum fornecedor cadastrado" />
          ) : (
            <ul className="divide-y divide-line">
              {items.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
                  <div className="min-w-0">
                    <p className="font-medium">{s.name} {!s.active ? <Badge>Inativo</Badge> : null}</p>
                    <p className="truncate text-xs text-muted">{[s.document, s.phone, s.email].filter(Boolean).join(" · ") || "Sem contato"} · {s._count.entries} lançamento(s)</p>
                  </div>
                  <Link href={`?editar=${s.id}`} className="text-sm text-navy-800 hover:underline">Editar</Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      <Card className="self-start">
        <CardHeader title={editing ? `Editar ${editing.name}` : "Novo fornecedor"} />
        <CardBody><SupplierForm item={editing} /></CardBody>
      </Card>
    </div>
  );
}
