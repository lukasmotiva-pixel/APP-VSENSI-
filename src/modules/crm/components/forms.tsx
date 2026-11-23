"use client";

import { useActionState, useState } from "react";
import { Check, Copy } from "lucide-react";
import type { Customer, Product, QuickReply } from "@prisma/client";
import { deleteCustomerAction, saveCustomerAction, saveInteractionAction, saveProductAction, saveQuickReplyAction } from "../actions";
import { initialActionState } from "@/lib/action-state";
import { centsToInput } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { ConfirmSubmit, FormMessage, SubmitButton, useActionRedirect } from "@/components/ui/form-bits";
import { MoneyInput } from "@/components/ui/money-input";

const CHANNELS = [
  ["WHATSAPP", "WhatsApp"],
  ["INSTAGRAM", "Instagram"],
  ["KIOSK", "Quiosque"],
  ["OTHER", "Outro"],
] as const;

function ChannelSelect({ defaultValue }: { defaultValue?: string }) {
  return (
    <Select id="channel" name="channel" defaultValue={defaultValue ?? "WHATSAPP"}>
      {CHANNELS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </Select>
  );
}

export function CustomerForm({ item }: { item?: Customer }) {
  const [state, action] = useActionState(saveCustomerAction, initialActionState);
  useActionRedirect(state);
  const e = state.fieldErrors ?? {};
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="id" value={item?.id ?? ""} />
      <Field label="Nome" htmlFor="name" error={e.name}><Input id="name" name="name" defaultValue={item?.name} required maxLength={120} /></Field>
      <Field label="Telefone / WhatsApp" htmlFor="phone"><Input id="phone" name="phone" type="tel" defaultValue={item?.phone ?? ""} maxLength={30} /></Field>
      <Field label="Instagram" htmlFor="instagram"><Input id="instagram" name="instagram" defaultValue={item?.instagram ?? ""} maxLength={60} placeholder="@usuario" /></Field>
      <Field label="Canal de origem" htmlFor="channel"><ChannelSelect defaultValue={item?.channel} /></Field>
      <Field label="Cidade" htmlFor="city"><Input id="city" name="city" defaultValue={item?.city ?? ""} maxLength={80} /></Field>
      <Field label="Endereço" htmlFor="address"><Input id="address" name="address" defaultValue={item?.address ?? ""} maxLength={500} /></Field>
      <Field label="Observações" htmlFor="notes" className="sm:col-span-2"><Textarea id="notes" name="notes" defaultValue={item?.notes ?? ""} rows={3} maxLength={2000} /></Field>
      <div className="sm:col-span-2">{!state.ok ? <FormMessage state={state} /> : null}</div>
      <div className="sm:col-span-2"><SubmitButton>{item ? "Salvar" : "Cadastrar cliente"}</SubmitButton></div>
    </form>
  );
}

export function DeleteCustomerForm({ id }: { id: string }) {
  const [state, action] = useActionState(deleteCustomerAction, initialActionState);
  useActionRedirect(state);
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <ConfirmSubmit message="Excluir este cliente e seus atendimentos?">Excluir cliente</ConfirmSubmit>
      {!state.ok ? <FormMessage state={state} /> : null}
    </form>
  );
}

export function InteractionForm({ customerId, defaultChannel, today, orders }: { customerId: string; defaultChannel: string; today: string; orders: { id: string; number: number }[] }) {
  const [state, action] = useActionState(saveInteractionAction, initialActionState);
  const [key, setKey] = useState(0);
  return (
    <form
      key={key}
      action={async (fd) => {
        await action(fd);
        setKey((k) => k + 1);
      }}
      className="grid gap-4 sm:grid-cols-2"
    >
      <input type="hidden" name="customerId" value={customerId} />
      <Field label="O que foi conversado" htmlFor="summary" className="sm:col-span-2" error={state.fieldErrors?.summary}>
        <Textarea id="summary" name="summary" required rows={3} maxLength={2000} placeholder="Ex.: Perguntou preço do kit X, enviei catálogo." />
      </Field>
      <Field label="Canal" htmlFor="channel"><ChannelSelect defaultValue={defaultChannel} /></Field>
      <Field label="Data" htmlFor="date"><Input id="date" name="date" type="date" defaultValue={today} required /></Field>
      <Field label="Situação" htmlFor="status">
        <Select id="status" name="status" defaultValue="PENDING">
          <option value="PENDING">Pendente (aguardando retorno)</option>
          <option value="INTERESTED">Interessado (oportunidade)</option>
          <option value="CONVERTED">Comprou</option>
          <option value="LOST">Não comprou</option>
        </Select>
      </Field>
      <Field label="Retornar em (opcional)" htmlFor="followUpDate"><Input id="followUpDate" name="followUpDate" type="date" /></Field>
      <Field label="Atendido por" htmlFor="attendant"><Input id="attendant" name="attendant" maxLength={80} /></Field>
      {orders.length > 0 ? (
        <Field label="Pedido relacionado" htmlFor="orderId">
          <Select id="orderId" name="orderId" defaultValue="">
            <option value="">Nenhum</option>
            {orders.map((o) => <option key={o.id} value={o.id}>#{o.number}</option>)}
          </Select>
        </Field>
      ) : null}
      <div className="sm:col-span-2"><FormMessage state={state} /></div>
      <div className="sm:col-span-2"><SubmitButton>Registrar atendimento</SubmitButton></div>
    </form>
  );
}

export function QuickReplyForm({ item }: { item?: QuickReply }) {
  const [state, action] = useActionState(saveQuickReplyAction, initialActionState);
  useActionRedirect(state);
  return (
    <form action={action} className="grid gap-4" key={item?.id ?? "new"}>
      <input type="hidden" name="id" value={item?.id ?? ""} />
      <Field label="Título" htmlFor="title" error={state.fieldErrors?.title}><Input id="title" name="title" defaultValue={item?.title} required maxLength={80} placeholder="Ex.: Formas de pagamento" /></Field>
      <Field label="Categoria (opcional)" htmlFor="category"><Input id="category" name="category" defaultValue={item?.category ?? ""} maxLength={60} placeholder="Ex.: Pagamento, Entrega" /></Field>
      <Field label="Texto da resposta" htmlFor="text" error={state.fieldErrors?.text}><Textarea id="text" name="text" defaultValue={item?.text} required rows={6} maxLength={4000} /></Field>
      <Field label="Ordem" htmlFor="sortOrder"><Input id="sortOrder" name="sortOrder" type="number" min={0} max={999} defaultValue={item?.sortOrder ?? 0} /></Field>
      {!state.ok ? <FormMessage state={state} /> : null}
      <SubmitButton>{item ? "Salvar" : "Adicionar resposta"}</SubmitButton>
    </form>
  );
}

export function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <Button
      type="button"
      size="sm"
      variant="secondary"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          window.prompt("Copie o texto:", text);
        }
      }}
    >
      {done ? <Check className="size-4" /> : <Copy className="size-4" />} {done ? "Copiado" : "Copiar"}
    </Button>
  );
}

export function ProductForm({ item }: { item?: Product }) {
  const [state, action] = useActionState(saveProductAction, initialActionState);
  useActionRedirect(state);
  const [price, setPrice] = useState(item ? centsToInput(item.price) : "");
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2" key={item?.id ?? "new"}>
      <input type="hidden" name="id" value={item?.id ?? ""} />
      <Field label="Nome do produto" htmlFor="name" error={state.fieldErrors?.name}><Input id="name" name="name" defaultValue={item?.name} required maxLength={120} /></Field>
      <Field label="Preço de venda" htmlFor="price"><MoneyInput id="price" name="price" value={price} onChange={setPrice} required /></Field>
      <Field label="Observações" htmlFor="notes" className="sm:col-span-2"><Textarea id="notes" name="notes" defaultValue={item?.notes ?? ""} rows={2} maxLength={1000} /></Field>
      <div className="sm:col-span-2"><Checkbox name="active" label="Ativo" defaultChecked={item?.active ?? true} /></div>
      <div className="sm:col-span-2">{!state.ok ? <FormMessage state={state} /> : null}</div>
      <div className="sm:col-span-2"><SubmitButton>{item ? "Salvar" : "Cadastrar produto"}</SubmitButton></div>
    </form>
  );
}
