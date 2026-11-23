"use client";

import { useActionState, useState } from "react";
import type { FinancialAccount } from "@prisma/client";
import { cancelEntryAction, deleteEntryAction, settleInstallmentAction, uploadAttachmentAction } from "../actions";
import { PAYMENT_METHOD_LABELS, PAYMENT_METHODS } from "../schemas";
import { initialActionState } from "@/lib/action-state";
import { centsToInput } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { ConfirmSubmit, FormMessage, SubmitButton, useActionRedirect } from "@/components/ui/form-bits";
import { MoneyInput } from "@/components/ui/money-input";

export function SettleForm({
  installmentId,
  type,
  today,
  accounts,
  defaults,
}: {
  installmentId: string;
  type: "INCOME" | "EXPENSE";
  today: string;
  accounts: FinancialAccount[];
  defaults: { accountId: string | null; paymentMethod: string | null; feeAmount: number };
}) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(settleInstallmentAction, initialActionState);
  const [fee, setFee] = useState(defaults.feeAmount ? centsToInput(defaults.feeAmount) : "");
  if (!open)
    return (
      <Button size="sm" onClick={() => setOpen(true)}>
        {type === "INCOME" ? "Registrar recebimento" : "Registrar pagamento"}
      </Button>
    );
  return (
    <form action={action} className="mt-3 grid gap-3 rounded-lg border border-line bg-canvas/60 p-3 sm:grid-cols-2">
      <input type="hidden" name="installmentId" value={installmentId} />
      <Field label={type === "INCOME" ? "Data do recebimento" : "Data do pagamento"} htmlFor={`d-${installmentId}`}>
        <Input id={`d-${installmentId}`} name="settledAt" type="date" defaultValue={today} max={today} required />
      </Field>
      <Field label="Conta" htmlFor={`a-${installmentId}`}>
        <Select id={`a-${installmentId}`} name="accountId" defaultValue={defaults.accountId ?? ""}>
          <option value="">Não informada</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </Select>
      </Field>
      <Field label="Forma de pagamento" htmlFor={`m-${installmentId}`}>
        <Select id={`m-${installmentId}`} name="paymentMethod" defaultValue={defaults.paymentMethod ?? ""}>
          <option value="">Não informada</option>
          {PAYMENT_METHODS.map((m) => (
            <option key={m} value={m}>{PAYMENT_METHOD_LABELS[m]}</option>
          ))}
        </Select>
      </Field>
      {type === "INCOME" ? (
        <Field label="Taxa descontada" htmlFor={`f-${installmentId}`}>
          <MoneyInput id={`f-${installmentId}`} name="feeAmount" value={fee} onChange={setFee} />
        </Field>
      ) : null}
      <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
        <SubmitButton size="sm">Confirmar baixa</SubmitButton>
        <Button size="sm" variant="ghost" type="button" onClick={() => setOpen(false)}>Fechar</Button>
        <div className="w-full"><FormMessage state={state} /></div>
      </div>
    </form>
  );
}

export function CancelEntryForm({ entryId }: { entryId: string }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(cancelEntryAction, initialActionState);
  if (!open)
    return (
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        Cancelar lançamento
      </Button>
    );
  return (
    <form action={action} className="w-full space-y-2 rounded-lg border border-line p-3">
      <input type="hidden" name="entryId" value={entryId} />
      <Field label="Motivo do cancelamento" htmlFor="reason" hint="O lançamento deixa de contar nos totais, mas permanece no histórico.">
        <Textarea id="reason" name="reason" required minLength={3} maxLength={500} rows={2} />
      </Field>
      <FormMessage state={state} />
      <div className="flex gap-2">
        <SubmitButton size="sm" variant="danger">Confirmar cancelamento</SubmitButton>
        <Button size="sm" variant="ghost" type="button" onClick={() => setOpen(false)}>Voltar</Button>
      </div>
    </form>
  );
}

export function DeleteEntryForm({ entryId }: { entryId: string }) {
  const [state, action] = useActionState(deleteEntryAction, initialActionState);
  useActionRedirect(state);
  return (
    <form action={action}>
      <input type="hidden" name="entryId" value={entryId} />
      <ConfirmSubmit message="Excluir definitivamente este lançamento e seus anexos? Esta ação não pode ser desfeita (um resumo fica na auditoria). Para manter o histórico, prefira cancelar.">
        Excluir
      </ConfirmSubmit>
      <FormMessage state={state} />
    </form>
  );
}

export function UploadAttachmentForm({ entryId }: { entryId: string }) {
  const [state, action] = useActionState(uploadAttachmentAction, initialActionState);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="entryId" value={entryId} />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          name="file"
          type="file"
          required
          accept="application/pdf,image/jpeg,image/png,image/webp"
          aria-label="Arquivo do comprovante"
          className="block w-full text-sm text-muted file:mr-3 file:h-10 file:rounded-lg file:border file:border-line-strong file:bg-surface file:px-3 file:text-sm file:font-medium file:text-ink"
        />
        <SubmitButton size="sm" variant="secondary" pendingLabel="Enviando…">Enviar</SubmitButton>
      </div>
      <p className="text-xs text-muted">PDF, JPG, PNG ou WEBP, até 10 MB. No celular você pode fotografar o comprovante.</p>
      <FormMessage state={state} />
    </form>
  );
}
