import Link from "next/link";
import { prisma } from "@/lib/db";
import { param, type SearchParams } from "@/lib/search-params";
import { GROUP_LABELS } from "@/modules/finance/calculations";
import { CategoryForm } from "@/modules/settings/components/forms";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Notice } from "@/components/ui/page-header";

export const metadata = { title: "Categorias" };

export default async function CategoriesPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const items = await prisma.category.findMany({ orderBy: [{ type: "asc" }, { sortOrder: "asc" }, { name: "asc" }], include: { _count: { select: { entries: true } } } });
  const editing = items.find((i) => i.id === param(sp, "editar"));
  const sections = [
    { title: "Entradas", items: items.filter((i) => i.type === "INCOME") },
    { title: "Saídas", items: items.filter((i) => i.type === "EXPENSE") },
  ];
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
      <div className="space-y-4">
        {param(sp, "salvo") ? <Notice tone="positive">Categoria salva.</Notice> : null}
        {sections.map((s) => (
          <Card key={s.title}>
            <CardHeader title={s.title} />
            <ul className="divide-y divide-line">
              {s.items.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-2.5 sm:px-5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{c.name} {!c.active ? <Badge>Inativa</Badge> : null}</p>
                    <p className="text-xs text-muted">{GROUP_LABELS[c.group]} · {c._count.entries} lançamento(s)</p>
                  </div>
                  <Link href={`?editar=${c.id}`} className="text-sm text-navy-800 hover:underline">Editar</Link>
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
      <Card className="self-start">
        <CardHeader title={editing ? `Editar ${editing.name}` : "Nova categoria"} description="Categorias com lançamentos não são excluídas; desative-as para ocultar dos formulários." />
        <CardBody><CategoryForm item={editing} /></CardBody>
      </Card>
    </div>
  );
}
