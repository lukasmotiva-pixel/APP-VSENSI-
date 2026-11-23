import Link from "next/link";
import { prisma } from "@/lib/db";
import { param, type SearchParams } from "@/lib/search-params";
import { deleteQuickReplyAction } from "@/modules/crm/actions";
import { CopyButton, QuickReplyForm } from "@/modules/crm/components/forms";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ConfirmSubmit } from "@/components/ui/form-bits";
import { EmptyState, Notice, PageHeader } from "@/components/ui/page-header";

export const metadata = { title: "Respostas rápidas" };

export default async function QuickRepliesPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const items = await prisma.quickReply.findMany({ orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { title: "asc" }] });
  const editing = items.find((i) => i.id === param(sp, "editar"));
  return (
    <>
      <Link href="/crm" className="text-sm text-muted hover:text-ink">← Atendimento</Link>
      <PageHeader title="Respostas rápidas" description="Textos prontos para perguntas frequentes. Toque em Copiar e cole no WhatsApp ou Instagram." />
      {param(sp, "salvo") ? <div className="mb-4"><Notice tone="positive">Resposta salva.</Notice></div> : null}
      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <Card>
          {items.length === 0 ? <EmptyState title="Nenhuma resposta cadastrada" description="Crie respostas para preços, formas de pagamento, prazos de entrega, endereço dos quiosques…" /> : (
            <ul className="divide-y divide-line">
              {items.map((r) => (
                <li key={r.id} className="space-y-2 px-4 py-3 sm:px-5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium">{r.title}{r.category ? <span className="ml-2 text-xs font-normal text-muted">{r.category}</span> : null}</p>
                    <CopyButton text={r.text} />
                  </div>
                  <p className="text-sm whitespace-pre-wrap text-ink/80">{r.text}</p>
                  <div className="flex gap-2 text-sm">
                    <Link href={`?editar=${r.id}`} className="text-navy-800 hover:underline">Editar</Link>
                    <form action={deleteQuickReplyAction}>
                      <input type="hidden" name="id" value={r.id} />
                      <ConfirmSubmit variant="ghost" message="Excluir esta resposta?">Excluir</ConfirmSubmit>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="self-start">
          <CardHeader title={editing ? "Editar resposta" : "Nova resposta"} />
          <CardBody><QuickReplyForm item={editing} /></CardBody>
        </Card>
      </div>
    </>
  );
}
