import Link from "next/link";
import { Paperclip, Plus } from "lucide-react";
import { prisma } from "@/lib/db";
import { formatDateBR, resolvePeriod, todayISO, toISO } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { param, type SearchParams } from "@/lib/search-params";
import { cn } from "@/lib/cn";
import { entryState } from "@/modules/finance/calculations";
import { listEntries } from "@/modules/finance/queries";
import { EntryStatusBadge } from "@/modules/finance/components/status";
import { Card } from "@/components/ui/card";
import { buttonClass, LinkButton } from "@/components/ui/button";
import { EmptyState, Notice, PageHeader } from "@/components/ui/page-header";
import { ParamSelect, PeriodFilter, SearchInput } from "@/components/ui/filters";

export const metadata = { title: "Lançamentos" };

const STATUS = ["pending", "overdue", "settled", "canceled"] as const;

export default async function EntriesPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const today = todayISO();
  const period = resolvePeriod({ p: param(sp, "p"), de: param(sp, "de"), ate: param(sp, "ate") });
  const tipo = param(sp, "tipo");
  const status = param(sp, "status");
  const page = Number(param(sp, "pagina") ?? 1) || 1;
  const [operations, categories] = await Promise.all([
    prisma.operation.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.category.findMany({ orderBy: [{ type: "asc" }, { sortOrder: "asc" }] }),
  ]);
  const result = await listEntries(
    prisma,
    {
      from: period.from,
      to: period.to,
      type: tipo === "entrada" ? "INCOME" : tipo === "saida" ? "EXPENSE" : null,
      operationId: param(sp, "operacao") ?? null,
      categoryId: param(sp, "categoria") ?? null,
      status: STATUS.find((s) => s === status) ?? null,
      q: param(sp, "q") ?? null,
      page,
    },
    today,
  );

  const pageLink = (p: number) => {
    const qs = new URLSearchParams(Object.entries(sp).flatMap(([k, v]) => (typeof v === "string" ? [[k, v]] : [])));
    qs.set("pagina", String(p));
    return `/financeiro?${qs.toString()}`;
  };

  return (
    <>
      <PageHeader
        title="Lançamentos"
        description={`Entradas e saídas por data de competência · ${period.label}`}
        actions={
          <>
          <span className="flex gap-2">
            <a
              href={`/api/exportar/lancamentos?${new URLSearchParams(Object.entries(sp).flatMap(([k, v]) => (typeof v === "string" ? [[k, v]] : []))).toString()}`}
              className={buttonClass("secondary")}
            >
              Excel
            </a>
          </span>
          <span className="hidden gap-2 sm:flex">
            <LinkButton href="/financeiro/novo?tipo=entrada" variant="secondary">
              <Plus className="size-4" /> Entrada
            </LinkButton>
            <LinkButton href="/financeiro/novo?tipo=saida">
              <Plus className="size-4" /> Saída
            </LinkButton>
          </span>
          </>
        }
      />
      {param(sp, "excluido") ? <div className="mb-4"><Notice tone="positive">Lançamento excluído.</Notice></div> : null}

      <div className="mb-4 flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          <PeriodFilter />
          <ParamSelect name="tipo" label="Tipo" allLabel="Entradas e saídas" options={[{ value: "entrada", label: "Entradas" }, { value: "saida", label: "Saídas" }]} />
          <ParamSelect name="status" label="Situação" allLabel="Todas as situações" options={[{ value: "pending", label: "Em aberto" }, { value: "overdue", label: "Vencidos" }, { value: "settled", label: "Quitados" }, { value: "canceled", label: "Cancelados" }]} />
          <ParamSelect name="operacao" label="Operação" allLabel="Todas as operações" options={operations.map((o) => ({ value: o.id, label: o.name }))} />
          <ParamSelect name="categoria" label="Categoria" allLabel="Todas as categorias" options={categories.map((c) => ({ value: c.id, label: `${c.type === "INCOME" ? "↓" : "↑"} ${c.name}` }))} />
        </div>
        <SearchInput placeholder="Buscar na descrição ou observações" />
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2 sm:max-w-md">
        <div className="rounded-lg border border-line bg-surface px-3 py-2">
          <p className="text-xs text-muted">Entradas</p>
          <p className="num font-semibold text-positive">{formatMoney(result.sumIncome)}</p>
        </div>
        <div className="rounded-lg border border-line bg-surface px-3 py-2">
          <p className="text-xs text-muted">Saídas</p>
          <p className="num font-semibold text-ink">{formatMoney(result.sumExpense)}</p>
        </div>
      </div>

      <Card>
        {result.items.length === 0 ? (
          <EmptyState
            title="Nenhum lançamento encontrado"
            description="Ajuste os filtros ou registre uma nova entrada ou saída."
            action={<LinkButton href="/financeiro/novo">Novo lançamento</LinkButton>}
          />
        ) : (
          <>
            {/* Tabela no computador */}
            <table className="hidden w-full text-sm md:table">
              <thead>
                <tr className="border-b border-line text-left text-xs text-muted">
                  <th className="px-4 py-2.5 font-medium">Data</th>
                  <th className="px-4 py-2.5 font-medium">Descrição</th>
                  <th className="px-4 py-2.5 font-medium">Categoria</th>
                  <th className="px-4 py-2.5 font-medium">Operação</th>
                  <th className="px-4 py-2.5 font-medium">Situação</th>
                  <th className="px-4 py-2.5 text-right font-medium">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {result.items.map((e) => {
                  const st = entryState({ canceledAt: e.canceledAt, installments: e.installments.map((i) => ({ status: i.status, dueDate: toISO(i.dueDate) })) }, today);
                  return (
                    <tr key={e.id} className="hover:bg-canvas/60">
                      <td className="num px-4 py-3 whitespace-nowrap text-muted">{formatDateBR(e.competenceDate)}</td>
                      <td className="px-4 py-3">
                        <Link href={`/financeiro/${e.id}`} className="font-medium text-ink hover:underline">
                          {e.description}
                        </Link>
                        <span className="ml-1.5 inline-flex items-center gap-1 text-xs text-muted">
                          {e.installments.length > 1 ? `${e.installments.length} parcelas` : null}
                          {e._count.attachments ? <Paperclip className="size-3" aria-label="Com anexo" /> : null}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted">{e.category.name}</td>
                      <td className="px-4 py-3 text-muted">{e.operation.name}</td>
                      <td className="px-4 py-3"><EntryStatusBadge state={st} type={e.type} /></td>
                      <td className={cn("num px-4 py-3 text-right font-medium whitespace-nowrap", e.type === "INCOME" ? "text-positive" : "text-ink", e.canceledAt && "line-through opacity-50")}>
                        {e.type === "INCOME" ? "+" : "−"} {formatMoney(e.amount)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {/* Lista no celular */}
            <ul className="divide-y divide-line md:hidden">
              {result.items.map((e) => {
                const st = entryState({ canceledAt: e.canceledAt, installments: e.installments.map((i) => ({ status: i.status, dueDate: toISO(i.dueDate) })) }, today);
                return (
                  <li key={e.id}>
                    <Link href={`/financeiro/${e.id}`} className="flex items-start justify-between gap-3 px-4 py-3 active:bg-canvas">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{e.description}</p>
                        <p className="mt-0.5 truncate text-xs text-muted">
                          {formatDateBR(e.competenceDate)} · {e.operation.name} · {e.category.name}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span className={cn("num font-semibold", e.type === "INCOME" ? "text-positive" : "text-ink", e.canceledAt && "line-through opacity-50")}>
                          {e.type === "INCOME" ? "+" : "−"} {formatMoney(e.amount)}
                        </span>
                        <EntryStatusBadge state={st} type={e.type} />
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </Card>

      {result.pages > 1 ? (
        <nav className="mt-4 flex items-center justify-between text-sm" aria-label="Paginação">
          {result.page > 1 ? <LinkButton variant="secondary" size="sm" href={pageLink(result.page - 1)}>Anterior</LinkButton> : <span />}
          <span className="text-muted">
            Página {result.page} de {result.pages} · {result.total} lançamentos
          </span>
          {result.page < result.pages ? <LinkButton variant="secondary" size="sm" href={pageLink(result.page + 1)}>Próxima</LinkButton> : <span />}
        </nav>
      ) : null}
    </>
  );
}
