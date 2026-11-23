"use client";

import { useActionState, useState } from "react";
import type { FinancialAccount } from "@prisma/client";
import { createTransferAction } from "../actions";
import { initialActionState } from "@/lib/action-state";
import { Field, Input, Select } from "@/components/ui/field";
import { FormMessage, SubmitButton } from "@/components/ui/form-bits";
import { MoneyInput } from "@/components/ui/money-input";

export function TransferForm({ accounts, today }: { accounts: FinancialAccount[]; today: string }) {
  const [state, action] = useActionState(createTransferAction, initialActionState);
  const [amount, setAmount] = useState("");
  return (
    <form
      action={async (fd) => {
        await action(fd);
        setAmount("");
      }}
      className="grid gap-4 sm:grid-cols-2"
    >
      <Field label="De (origem)" htmlFor="fromAccountId" error={state.fieldErrors?.fromAccountId}>
        <Select id="fromAccountId" name="fromAccountId" required defaultValue="">
          <option value="" disabled>Selecione…</option>
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </Select>
      </Field>
      <Field label="Para (destino)" htmlFor="toAccountId" error={state.fieldErrors?.toAccountId}>
        <Select id="toAccountId" name="toAccountId" required defaultValue="">
          <option value="" disabled>Selecione…</option>
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </Select>
      </Field>
      <Field label="Valor" htmlFor="amount" error={state.fieldErrors?.amount}>
        <MoneyInput id="amount" name="amount" value={amount} onChange={setAmount} required />
      </Field>
      <Field label="Data" htmlFor="date" error={state.fieldErrors?.date}>
        <Input id="date" name="date" type="date" defaultValue={today} max={today} required />
      </Field>
      <Field label="Descrição" htmlFor="description" className="sm:col-span-2" error={state.fieldErrors?.description}>
        <Input id="description" name="description" required maxLength={200} placeholder="Ex.: Depósito do caixa do quiosque no banco" />
      </Field>
      <div className="space-y-2 sm:col-span-2">
        <FormMessage state={state} />
        <SubmitButton>Registrar transferência</SubmitButton>
      </div>
    </form>
  );
}
