import Link from "next/link";
import { prisma } from "@/lib/db";
import { param, type SearchParams } from "@/lib/search-params";
import { OperationForm } from "@/modules/settings/components/forms";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Notice } from "@/components/ui/page-header";

export const metadata = { title: "Operações" };
const TYPE = { KIOSK: "Quiosque", ONLINE: "Online", CENTRAL: "Central" } as const;

export default async function OperationsPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const items = await prisma.operation.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], include: { _count: { select: { entries: true } } } });
  const editing = items.find((i) => i.id === param(sp, "editar"));
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
      <div className="space-y-4">
        {param(sp, "salvo") ? <Notice tone="positive">Operação salva.</Notice> : null}
        <Notice>Os nomes “Quiosque 1” a “Quiosque 5” são provisórios. Renomeie com o nome e endereço reais de cada quiosque.</Notice>
        <Card>
          <CardHeader title="Operações" description="Cada quiosque, o online e o central têm resultado próprio." />
          <ul className="divide-y divide-line">
            {items.map((o) => (
              <li key={o.id} className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
                <div className="min-w-0">
                  <p className="font-medium">{o.name} {!o.active ? <Badge>Inativa</Badge> : null}</p>
                  <p className="truncate text-xs text-muted">{TYPE[o.type]}{o.address ? ` · ${o.address}` : ""} · {o._count.entries} lançamento(s)</p>
                </div>
                <Link href={`?editar=${o.id}`} className="text-sm text-navy-800 hover:underline">Editar</Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>
      <Card className="self-start">
        <CardHeader title={editing ? `Editar ${editing.name}` : "Nova operação"} />
        <CardBody><OperationForm item={editing} /></CardBody>
      </Card>
    </div>
  );
}
