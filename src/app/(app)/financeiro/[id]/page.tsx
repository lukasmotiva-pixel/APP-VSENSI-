import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText, Pencil, Undo2 } from "lucide-react";
import { prisma } from "@/lib/db";
import { formatDateBR, todayISO, toISO } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/cn";
import { param, type SearchParams } from "@/lib/search-params";
import { entryState, GROUP_LABELS, installmentState } from "@/modules/finance/calculations";
import { getEntryDetail, getEntryHistory } from "@/modules/finance/queries";
import { PAYMENT_METHOD_LABELS } from "@/modules/finance/schemas";
import { deleteAttachmentAction, restoreEntryAction, unsettleInstallmentAction } from "@/modules/finance/actions";
import { EntryStatusBadge, InstallmentStatusBadge } from "@/modules/finance/components/status";
import { CancelEntryForm, DeleteEntryForm, SettleForm, UploadAttachmentForm } from "@/modules/finance/components/entry-actions";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/button";
import { ConfirmSubmit } from "@/components/ui/form-bits";
import { Notice } from "@/components/ui/page-header";

export const metadata = { title: "Lançamento" };

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 text-sm">{children}</dd>
    </div>
  );
}

export default async function EntryPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SearchParams }) {
  const { id } = await params;
  const sp = await searchParams;
  const entry = await getEntryDetail(prisma, id);
  if (!entry) notFound();
  const [history, accounts, closed] = await Promise.all([
    getEntryHistory(prisma, id),
    prisma.financialAccount.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.periodClose.findUnique({ where: { month: toISO(entry.competenceDate).slice(0, 7) } }),
  ]);
  const today = todayISO();
  const isIncome = entry.type === "INCOME";
  const st = entryState({ canceledAt: entry.canceledAt, installments: entry.installments.map((i) => ({ status: i.status, dueDate: toISO(i.dueDate) })) }, today);
  const fees = entry.installments.reduce((a, i) => a + i.feeAmount, 0);
  const settled = entry.installments.filter((i) => i.status === "SETTLED").reduce((a, i) => a + i.amount, 0);
  const canEdit = !entry.canceledAt && !closed && entry.source === "MANUAL";
  const canRefund = isIncome && !entry.canceledAt && entry.category.group === "SALES";

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <Link href="/financeiro" className="text-sm text-muted hover:text-ink">← Lançamentos</Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wider text-muted">{isIncome ? "Entrada" : "Saída"}</p>
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{entry.description}</h1>
            <p className={cn("num mt-1 text-2xl font-semibold", isIncome ? "text-positive" : "text-ink", entry.canceledAt && "line-through opacity-50")}>
              {formatMoney(entry.amount)}
            </p>
          </div>
          <EntryStatusBadge state={st} type={entry.type} />
        </div>
      </div>

      {param(sp, "salvo") ? <Notice tone="positive">Lançamento salvo.</Notice> : null}
      {entry.canceledAt ? (
        <Notice tone="warning" title="Lançamento cancelado">
          Não conta em nenhum total. Motivo: {entry.cancelReason}
        </Notice>
      ) : null}
      {closed ? <Notice>O mês deste lançamento está fechado. Para alterar, reabra o mês em Financeiro → Fechamentos.</Notice> : null}

      <Card>
        <CardBody>
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Info label="Competência">{formatDateBR(entry.competenceDate)}</Info>
            <Info label="Operação">{entry.operation.name}</Info>
            <Info label="Categoria">
              {entry.category.name}
              <span className="block text-xs text-muted">{GROUP_LABELS[entry.category.group]}</span>
            </Info>
            {entry.supplier ? <Info label="Fornecedor">{entry.supplier.name}</Info> : null}
            <Info label={isIncome ? "Recebido" : "Pago"}>
              <span className="num">{formatMoney(settled)}</span>
            </Info>
            {isIncome && fees > 0 ? (
              <Info label="Taxas">
                <span className="num">{formatMoney(fees)}</span>
              </Info>
            ) : null}
            {entry.refundOf ? (
              <Info label="Estorno da venda">
                <Link className="text-navy-800 underline" href={`/financeiro/${entry.refundOf.id}`}>{entry.refundOf.description}</Link>
              </Info>
            ) : null}
          </dl>
          {entry.notes ? <p className="mt-4 rounded-lg bg-canvas px-3 py-2 text-sm whitespace-pre-wrap">{entry.notes}</p> : null}
          {entry.refunds.length > 0 ? (
            <div className="mt-4 text-sm">
              <p className="font-medium">Estornos vinculados</p>
              <ul className="mt-1 space-y-1">
                {entry.refunds.map((r) => (
                  <li key={r.id}>
                    <Link href={`/financeiro/${r.id}`} className="text-navy-800 underline">{r.description}</Link> — <span className="num">{formatMoney(r.amount)}</span>
                    {r.canceledAt ? " (cancelado)" : ""}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={entry.installments.length > 1 ? `Parcelas (${entry.installments.length})` : isIncome ? "Recebimento" : "Pagamento"} />
        <ul className="divide-y divide-line">
          {entry.installments.map((i) => {
            const ist = installmentState({ status: i.status, dueDate: toISO(i.dueDate) }, today);
            return (
              <li key={i.id} className="px-4 py-3 sm:px-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">
                      {entry.installments.length > 1 ? `Parcela ${i.number} · ` : ""}
                      <span className="num">{formatMoney(i.amount)}</span>
                      {i.feeAmount > 0 ? <span className="num ml-1 font-normal text-muted">(taxa {formatMoney(i.feeAmount)} · líquido {formatMoney(i.amount - i.feeAmount)})</span> : null}
                    </p>
                    <p className="mt-0.5 text-xs text-muted">
                      Vencimento {formatDateBR(i.dueDate)}
                      {i.settledAt ? ` · ${isIncome ? "recebida" : "paga"} em ${formatDateBR(i.settledAt)}` : ""}
                      {i.paymentMethod ? ` · ${PAYMENT_METHOD_LABELS[i.paymentMethod]}` : ""}
                      {i.account ? ` · ${i.account.name}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <InstallmentStatusBadge state={ist} type={entry.type} />
                    {i.status === "SETTLED" && !entry.canceledAt ? (
                      <form action={unsettleInstallmentAction}>
                        <input type="hidden" name="installmentId" value={i.id} />
                        <ConfirmSubmit variant="ghost" message="Desfazer a baixa desta parcela? Ela volta a ficar pendente.">
                          <Undo2 className="size-4" /> Desfazer
                        </ConfirmSubmit>
                      </form>
                    ) : null}
                  </div>
                </div>
                {i.status === "PENDING" && !entry.canceledAt ? (
                  <div className="mt-2">
                    <SettleForm installmentId={i.id} type={entry.type} today={today} accounts={accounts} defaults={{ accountId: i.accountId, paymentMethod: i.paymentMethod, feeAmount: i.feeAmount }} />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </Card>

      <Card>
        <CardHeader title="Comprovantes e documentos" />
        <CardBody className="space-y-4">
          {entry.attachments.length > 0 ? (
            <ul className="divide-y divide-line rounded-lg border border-line">
              {entry.attachments.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-2 px-3 py-2">
                  <a href={`/api/anexos/${a.id}`} target="_blank" rel="noopener" className="flex min-w-0 items-center gap-2 text-sm text-navy-800 hover:underline">
                    <FileText className="size-4 shrink-0" />
                    <span className="truncate">{a.fileName}</span>
                    <span className="shrink-0 text-xs text-muted">{Math.ceil(a.size / 1024)} KB</span>
                  </a>
                  <form action={deleteAttachmentAction}>
                    <input type="hidden" name="attachmentId" value={a.id} />
                    <ConfirmSubmit variant="ghost" message="Remover este anexo?">Remover</ConfirmSubmit>
                  </form>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">Nenhum anexo.</p>
          )}
          <UploadAttachmentForm entryId={entry.id} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Ações" />
        <CardBody className="flex flex-wrap items-start gap-2">
          {canEdit ? (
            <LinkButton href={`/financeiro/${entry.id}/editar`} variant="secondary" size="sm">
              <Pencil className="size-4" /> Editar
            </LinkButton>
          ) : null}
          {canRefund ? (
            <LinkButton href={`/financeiro/novo?tipo=saida&estorno=${entry.id}`} variant="secondary" size="sm">
              Registrar estorno
            </LinkButton>
          ) : null}
          {entry.canceledAt ? (
            !closed ? (
              <form action={restoreEntryAction}>
                <input type="hidden" name="entryId" value={entry.id} />
                <ConfirmSubmit variant="secondary" message="Desfazer o cancelamento? O lançamento volta a contar nos totais.">Desfazer cancelamento</ConfirmSubmit>
              </form>
            ) : null
          ) : !closed ? (
            <CancelEntryForm entryId={entry.id} />
          ) : null}
          {!closed ? <DeleteEntryForm entryId={entry.id} /> : null}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Histórico" description="Registro de auditoria deste lançamento." />
        <ul className="divide-y divide-line">
          {history.map((h) => (
            <li key={h.id} className="px-4 py-2.5 text-sm sm:px-5">
              <p>{h.summary}</p>
              <p className="text-xs text-muted">{h.createdAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</p>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
