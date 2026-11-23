"use client";

import { useActionState, useState } from "react";
import type { FinancialAccount, Operation } from "@prisma/client";
import { saveClosingAction } from "../actions";
import { initialActionState } from "@/lib/action-state";
import { centsToInput, formatMoney, parseMoneyToCents } from "@/lib/money";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { FormMessage, SubmitButton, useActionRedirect } from "@/components/ui/form-bits";
import { MoneyInput } from "@/components/ui/money-input";

export interface ClosingDefaults {
  id?: string;
  operationId: string;
  date: string;
  cash: number;
  pix: number;
  debit: number;
  credit: number;
  other: number;
  debitFee: number;
  creditFee: number;
  creditReceiveDate: string | null;
  cashAccountId: string | null;
  pixAccountId: string | null;
  cardAccountId: string | null;
  notes: string | null;
}

const toInput = (v: number) => (v ? centsToInput(v) : "");

export function ClosingForm({ kiosks, accounts, today, initial }: { kiosks: Operation[]; accounts: FinancialAccount[]; today: string; initial: ClosingDefaults }) {
  const [state, action] = useActionState(saveClosingAction, initialActionState);
  useActionRedirect(state);
  const [v, setV] = useState({
    cash: toInput(initial.cash),
    pix: toInput(initial.pix),
    debit: toInput(initial.debit),
    credit: toInput(initial.credit),
    other: toInput(initial.other),
    debitFee: toInput(initial.debitFee),
    creditFee: toInput(initial.creditFee),
  });
  const set = (k: keyof typeof v) => (val: string) => setV({ ...v, [k]: val });
  const c = (s: string) => parseMoneyToCents(s) ?? 0;
  const total = c(v.cash) + c(v.pix) + c(v.debit) + c(v.credit) + c(v.other);
  const fees = c(v.debitFee) + c(v.creditFee);
  const fe = state.fieldErrors ?? {};
  const accountSelect = (name: string, label: string, value: string | null) => (
    <Field label={label} htmlFor={name}>
      <Select id={name} name={name} defaultValue={value ?? ""}>
        <option value="">Não informada</option>
        {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
      </Select>
    </Field>
  );

  return (
    <form action={action} className="space-y-4">
      {initial.id ? <input type="hidden" name="id" value={initial.id} /> : null}
      <Card>
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label="Quiosque" htmlFor="operationId" error={fe.operationId}>
            <Select id="operationId" name="operationId" defaultValue={initial.operationId} required>
              <option value="" disabled>Selecione…</option>
              {kiosks.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
            </Select>
          </Field>
          <Field label="Data das vendas" htmlFor="date" error={fe.date}>
            <Input id="date" name="date" type="date" defaultValue={initial.date} max={today} required />
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Vendas do dia por forma de pagamento" action={<span className="num text-lg font-semibold">{formatMoney(total)}</span>} />
        <CardBody className="grid grid-cols-2 gap-4">
          <Field label="Dinheiro" htmlFor="cash" error={fe.cash}><MoneyInput id="cash" name="cash" value={v.cash} onChange={set("cash")} /></Field>
          <Field label="Pix" htmlFor="pix"><MoneyInput id="pix" name="pix" value={v.pix} onChange={set("pix")} /></Field>
          <Field label="Cartão de débito" htmlFor="debit"><MoneyInput id="debit" name="debit" value={v.debit} onChange={set("debit")} /></Field>
          <Field label="Taxa do débito" htmlFor="debitFee" error={fe.debitFee}><MoneyInput id="debitFee" name="debitFee" value={v.debitFee} onChange={set("debitFee")} /></Field>
          <Field label="Cartão de crédito" htmlFor="credit"><MoneyInput id="credit" name="credit" value={v.credit} onChange={set("credit")} /></Field>
          <Field label="Taxa do crédito" htmlFor="creditFee" error={fe.creditFee}><MoneyInput id="creditFee" name="creditFee" value={v.creditFee} onChange={set("creditFee")} /></Field>
          <Field label="Outros" htmlFor="other"><MoneyInput id="other" name="other" value={v.other} onChange={set("other")} /></Field>
          <Field label="Crédito cai em" htmlFor="creditReceiveDate" error={fe.creditReceiveDate} hint="Se for data futura, fica em Contas a receber.">
            <Input id="creditReceiveDate" name="creditReceiveDate" type="date" defaultValue={initial.creditReceiveDate ?? ""} />
          </Field>
          <p className="col-span-2 text-sm text-muted">
            Taxas informadas: <span className="num">{formatMoney(fees)}</span> · Líquido estimado: <span className="num font-medium text-ink">{formatMoney(total - fees)}</span>
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Onde o dinheiro entrou" description="Usado para os saldos das contas. O sistema lembra a última escolha de cada quiosque." />
        <CardBody className="grid gap-4 sm:grid-cols-3">
          {accountSelect("cashAccountId", "Dinheiro → conta", initial.cashAccountId)}
          {accountSelect("pixAccountId", "Pix → conta", initial.pixAccountId)}
          {accountSelect("cardAccountId", "Cartões → conta", initial.cardAccountId)}
          <Field label="Observações" htmlFor="notes" className="sm:col-span-3">
            <Textarea id="notes" name="notes" defaultValue={initial.notes ?? ""} rows={2} maxLength={1000} />
          </Field>
        </CardBody>
      </Card>

      {!state.ok ? <FormMessage state={state} /> : null}
      <div className="sticky bottom-20 z-10 lg:bottom-4">
        <SubmitButton size="lg" className="w-full shadow-lg shadow-black/10 sm:w-auto">{initial.id ? "Salvar fechamento" : "Registrar fechamento"}</SubmitButton>
      </div>
    </form>
  );
}
