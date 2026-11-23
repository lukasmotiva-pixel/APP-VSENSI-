"use client";

import { useActionState, useState } from "react";
import type { Employee, Operation } from "@prisma/client";
import { generatePayrollAction, saveEmployeeAction } from "../actions";
import { initialActionState } from "@/lib/action-state";
import { centsToInput } from "@/lib/money";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { FormMessage, SubmitButton, useActionRedirect } from "@/components/ui/form-bits";
import { MoneyInput } from "@/components/ui/money-input";

export function EmployeeForm({ item, operations }: { item?: Employee; operations: Operation[] }) {
  const [state, action] = useActionState(saveEmployeeAction, initialActionState);
  useActionRedirect(state);
  const [salary, setSalary] = useState(item ? centsToInput(item.salary) : "");
  const e = state.fieldErrors ?? {};
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="id" value={item?.id ?? ""} />
      <Field label="Nome" htmlFor="name" error={e.name}><Input id="name" name="name" defaultValue={item?.name} required maxLength={120} /></Field>
      <Field label="Cargo / função" htmlFor="role"><Input id="role" name="role" defaultValue={item?.role ?? ""} maxLength={80} /></Field>
      <Field label="Local de trabalho" htmlFor="operationId" hint="Define em qual operação o salário entra no resultado.">
        <Select id="operationId" name="operationId" defaultValue={item?.operationId ?? ""}>
          <option value="">Central / administrativo</option>
          {operations.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </Select>
      </Field>
      <Field label="Salário fixo mensal" htmlFor="salary" error={e.salary}><MoneyInput id="salary" name="salary" value={salary} onChange={setSalary} required /></Field>
      <Field label="Dia de pagamento" htmlFor="paymentDay" error={e.paymentDay}><Input id="paymentDay" name="paymentDay" type="number" min={1} max={31} inputMode="numeric" defaultValue={item?.paymentDay ?? 5} required /></Field>
      <Field label="Data de admissão (opcional)" htmlFor="hireDate"><Input id="hireDate" name="hireDate" type="date" defaultValue={item?.hireDate ? item.hireDate.toISOString().slice(0, 10) : ""} /></Field>
      <Field label="Observações" htmlFor="notes" className="sm:col-span-2"><Textarea id="notes" name="notes" defaultValue={item?.notes ?? ""} rows={2} maxLength={2000} /></Field>
      <div className="sm:col-span-2"><Checkbox name="active" label="Ativo" defaultChecked={item?.active ?? true} /></div>
      <div className="sm:col-span-2">{!state.ok ? <FormMessage state={state} /> : null}</div>
      <div className="sm:col-span-2"><SubmitButton>{item ? "Salvar" : "Cadastrar funcionário"}</SubmitButton></div>
    </form>
  );
}

export function PayrollForm({ month }: { month: string }) {
  const [state, action] = useActionState(generatePayrollAction, initialActionState);
  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Mês trabalhado (competência)" htmlFor="month"><Input id="month" name="month" type="month" defaultValue={month} required /></Field>
        <div className="flex items-end"><Checkbox name="nextMonth" label="Pagamento no mês seguinte" defaultChecked /></div>
      </div>
      <p className="text-xs text-muted">Cria uma conta a pagar para cada funcionário ativo que ainda não tem o salário desse mês. O vencimento é o dia de pagamento de cada um.</p>
      <FormMessage state={state} />
      <SubmitButton variant="secondary" pendingLabel="Gerando…">Gerar salários do mês</SubmitButton>
    </form>
  );
}
