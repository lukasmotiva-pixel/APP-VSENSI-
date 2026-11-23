"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { Category, FinancialAccount, Operation, Supplier } from "@prisma/client";
import { initialActionState } from "@/lib/action-state";
import { centsToInput } from "@/lib/money";
import { GROUP_LABELS, INCOME_GROUPS, EXPENSE_GROUPS } from "@/modules/finance/calculations";
import { saveAccountAction, saveCategoryAction, saveOperationAction, saveSupplierAction } from "../actions";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { FormMessage, SubmitButton, useActionRedirect } from "@/components/ui/form-bits";

function Footer({ cancelHref, editing }: { cancelHref: string; editing: boolean }) {
  return (
    <div className="flex items-center gap-2 sm:col-span-2">
      <SubmitButton>{editing ? "Salvar" : "Cadastrar"}</SubmitButton>
      {editing ? <Link href={cancelHref} className="text-sm text-muted hover:text-ink">Cancelar edição</Link> : null}
    </div>
  );
}

export function OperationForm({ item }: { item?: Operation }) {
  const [state, action] = useActionState(saveOperationAction, initialActionState);
  useActionRedirect(state);
  const e = state.fieldErrors ?? {};
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2" key={item?.id ?? "new"}>
      <input type="hidden" name="id" value={item?.id ?? ""} />
      <Field label="Nome" htmlFor="name" error={e.name}><Input id="name" name="name" defaultValue={item?.name} required maxLength={80} /></Field>
      <Field label="Tipo" htmlFor="type">
        <Select id="type" name="type" defaultValue={item?.type ?? "KIOSK"}>
          <option value="KIOSK">Quiosque</option>
          <option value="ONLINE">Online</option>
          <option value="CENTRAL">Central / administrativo</option>
        </Select>
      </Field>
      <Field label="Endereço / localização" htmlFor="address" className="sm:col-span-2"><Input id="address" name="address" defaultValue={item?.address ?? ""} maxLength={200} /></Field>
      <Field label="Ordem de exibição" htmlFor="sortOrder"><Input id="sortOrder" name="sortOrder" type="number" min={0} max={999} defaultValue={item?.sortOrder ?? 0} /></Field>
      <div className="flex items-end"><Checkbox name="active" label="Ativa" defaultChecked={item?.active ?? true} /></div>
      <Field label="Observações" htmlFor="notes" className="sm:col-span-2"><Textarea id="notes" name="notes" defaultValue={item?.notes ?? ""} rows={2} maxLength={1000} /></Field>
      <div className="sm:col-span-2"><FormMessage state={state} /></div>
      <Footer cancelHref="/configuracoes/operacoes" editing={!!item} />
    </form>
  );
}

export function AccountForm({ item, operations, today }: { item?: FinancialAccount; operations: Operation[]; today: string }) {
  const [state, action] = useActionState(saveAccountAction, initialActionState);
  useActionRedirect(state);
  const e = state.fieldErrors ?? {};
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2" key={item?.id ?? "new"}>
      <input type="hidden" name="id" value={item?.id ?? ""} />
      <Field label="Nome" htmlFor="name" error={e.name}><Input id="name" name="name" defaultValue={item?.name} required maxLength={80} placeholder="Ex.: Caixa Quiosque 1, Banco X, Maquininha Y" /></Field>
      <Field label="Tipo" htmlFor="type">
        <Select id="type" name="type" defaultValue={item?.type ?? "BANK"}>
          <option value="CASH">Dinheiro (caixa/cofre)</option>
          <option value="BANK">Conta bancária</option>
          <option value="PAYMENT_PROVIDER">Maquininha / carteira digital</option>
          <option value="OTHER">Outra</option>
        </Select>
      </Field>
      <Field label="Operação vinculada (opcional)" htmlFor="operationId">
        <Select id="operationId" name="operationId" defaultValue={item?.operationId ?? ""}>
          <option value="">Nenhuma (geral)</option>
          {operations.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </Select>
      </Field>
      <div className="flex items-end"><Checkbox name="active" label="Ativa" defaultChecked={item?.active ?? true} /></div>
      <Field label="Saldo inicial (R$)" htmlFor="openingBalance" error={e.openingBalance} hint="Use “-” para saldo negativo.">
        <Input id="openingBalance" name="openingBalance" inputMode="decimal" className="num" defaultValue={item ? (item.openingBalance < 0 ? "-" : "") + centsToInput(Math.abs(item.openingBalance)) : ""} placeholder="0,00" />
      </Field>
      <Field label="Data do saldo inicial" htmlFor="openingDate" error={e.openingDate} hint="Movimentações só podem ser registradas a partir desta data.">
        <Input id="openingDate" name="openingDate" type="date" required defaultValue={item ? item.openingDate.toISOString().slice(0, 10) : today} />
      </Field>
      <Field label="Observações" htmlFor="notes" className="sm:col-span-2"><Textarea id="notes" name="notes" defaultValue={item?.notes ?? ""} rows={2} maxLength={1000} /></Field>
      <div className="sm:col-span-2"><FormMessage state={state} /></div>
      <Footer cancelHref="/configuracoes/contas" editing={!!item} />
    </form>
  );
}

export function CategoryForm({ item }: { item?: Category }) {
  const [state, action] = useActionState(saveCategoryAction, initialActionState);
  useActionRedirect(state);
  const e = state.fieldErrors ?? {};
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2" key={item?.id ?? "new"}>
      <input type="hidden" name="id" value={item?.id ?? ""} />
      <Field label="Nome" htmlFor="name" error={e.name}><Input id="name" name="name" defaultValue={item?.name} required maxLength={80} /></Field>
      <Field label="Tipo" htmlFor="type" error={e.type}>
        <Select id="type" name="type" defaultValue={item?.type ?? "EXPENSE"}>
          <option value="INCOME">Entrada</option>
          <option value="EXPENSE">Saída</option>
        </Select>
      </Field>
      <Field label="Grupo no resultado (DRE)" htmlFor="group" error={e.group} hint="Define onde a categoria entra no cálculo do resultado." className="sm:col-span-2">
        <Select id="group" name="group" defaultValue={item?.group ?? "OPERATING_EXPENSE"}>
          <optgroup label="Entradas">{INCOME_GROUPS.map((g) => <option key={g} value={g}>{GROUP_LABELS[g]}</option>)}</optgroup>
          <optgroup label="Saídas">{EXPENSE_GROUPS.map((g) => <option key={g} value={g}>{GROUP_LABELS[g]}</option>)}</optgroup>
        </Select>
      </Field>
      <Field label="Ordem" htmlFor="sortOrder"><Input id="sortOrder" name="sortOrder" type="number" min={0} max={999} defaultValue={item?.sortOrder ?? 0} /></Field>
      <div className="flex items-end"><Checkbox name="active" label="Ativa" defaultChecked={item?.active ?? true} /></div>
      <div className="sm:col-span-2"><FormMessage state={state} /></div>
      <Footer cancelHref="/configuracoes/categorias" editing={!!item} />
    </form>
  );
}

export function SupplierForm({ item }: { item?: Supplier }) {
  const [state, action] = useActionState(saveSupplierAction, initialActionState);
  useActionRedirect(state);
  const e = state.fieldErrors ?? {};
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2" key={item?.id ?? "new"}>
      <input type="hidden" name="id" value={item?.id ?? ""} />
      <Field label="Nome" htmlFor="name" error={e.name}><Input id="name" name="name" defaultValue={item?.name} required maxLength={80} /></Field>
      <Field label="CNPJ/CPF" htmlFor="document"><Input id="document" name="document" defaultValue={item?.document ?? ""} maxLength={30} /></Field>
      <Field label="Telefone" htmlFor="phone"><Input id="phone" name="phone" type="tel" defaultValue={item?.phone ?? ""} maxLength={30} /></Field>
      <Field label="E-mail" htmlFor="email" error={e.email}><Input id="email" name="email" type="email" defaultValue={item?.email ?? ""} maxLength={120} /></Field>
      <Field label="Observações" htmlFor="notes" className="sm:col-span-2"><Textarea id="notes" name="notes" defaultValue={item?.notes ?? ""} rows={2} maxLength={1000} /></Field>
      <div className="sm:col-span-2"><Checkbox name="active" label="Ativo" defaultChecked={item?.active ?? true} /></div>
      <div className="sm:col-span-2"><FormMessage state={state} /></div>
      <Footer cancelHref="/configuracoes/fornecedores" editing={!!item} />
    </form>
  );
}
