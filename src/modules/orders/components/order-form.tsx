"use client";

import { useActionState, useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import type { FinancialAccount, Operation, Product } from "@prisma/client";
import { saveOrderAction } from "../actions";
import { initialActionState } from "@/lib/action-state";
import { centsToInput, formatMoney, parseMoneyToCents } from "@/lib/money";
import { PAYMENT_METHOD_LABELS, PAYMENT_METHODS } from "@/modules/finance/schemas";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { FormMessage, useActionRedirect } from "@/components/ui/form-bits";
import { MoneyInput } from "@/components/ui/money-input";

type Channel = "WHATSAPP" | "INSTAGRAM" | "KIOSK" | "OTHER";
type Delivery = "" | "CORREIOS" | "CAR" | "EXCURSION" | "PICKUP";

export interface OrderInitial {
  id: string;
  customerId: string;
  operationId: string;
  channel: Channel;
  orderDate: string;
  items: { productId: string | null; description: string; quantity: number; unitPrice: number }[];
  discount: number;
  shippingFee: number;
  paymentMethod: string | null;
  accountId: string | null;
  attendant: string | null;
  deliveryMethod: Delivery | null;
  address: string | null;
  trackingCode: string | null;
  deliveryPerson: string | null;
  excursionInfo: string | null;
  expectedDelivery: string | null;
  notes: string | null;
}

interface Props {
  today: string;
  customers: { id: string; name: string; phone: string | null }[];
  products: Product[];
  operations: Operation[];
  accounts: FinancialAccount[];
  initial?: OrderInitial;
  presetCustomerId?: string;
}

interface Row { productId: string; description: string; quantity: string; unitPrice: string }

export function OrderForm({ today, customers, products, operations, accounts, initial, presetCustomerId }: Props) {
  const [state, action, pending] = useActionState(saveOrderAction, initialActionState);
  useActionRedirect(state);
  const busy = pending || Boolean(state.ok && state.redirectTo);
  const online = operations.find((o) => o.type === "ONLINE");

  const [customerMode, setCustomerMode] = useState<"existing" | "new">(initial || presetCustomerId || customers.length > 0 ? "existing" : "new");
  const [customerId, setCustomerId] = useState(initial?.customerId ?? presetCustomerId ?? "");
  const [customerSearch, setCustomerSearch] = useState("");
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [channel, setChannel] = useState<Channel>(initial?.channel ?? "WHATSAPP");
  const [operationId, setOperationId] = useState(initial?.operationId ?? online?.id ?? "");
  const [orderDate, setOrderDate] = useState(initial?.orderDate ?? today);
  const [rows, setRows] = useState<Row[]>(
    initial?.items.map((i) => ({ productId: i.productId ?? "", description: i.description, quantity: String(i.quantity), unitPrice: centsToInput(i.unitPrice) })) ?? [
      { productId: "", description: "", quantity: "1", unitPrice: "" },
    ],
  );
  const [discount, setDiscount] = useState(initial?.discount ? centsToInput(initial.discount) : "");
  const [shippingFee, setShippingFee] = useState(initial?.shippingFee ? centsToInput(initial.shippingFee) : "");
  const [paymentMethod, setPaymentMethod] = useState(initial?.paymentMethod ?? "");
  const [accountId, setAccountId] = useState(initial?.accountId ?? "");
  const [attendant, setAttendant] = useState(initial?.attendant ?? "");
  const [deliveryMethod, setDeliveryMethod] = useState<Delivery>(initial?.deliveryMethod ?? "");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [trackingCode, setTrackingCode] = useState(initial?.trackingCode ?? "");
  const [deliveryPerson, setDeliveryPerson] = useState(initial?.deliveryPerson ?? "");
  const [excursionInfo, setExcursionInfo] = useState(initial?.excursionInfo ?? "");
  const [expectedDelivery, setExpectedDelivery] = useState(initial?.expectedDelivery ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [clientError, setClientError] = useState<string | null>(null);

  const filteredCustomers = useMemo(() => {
    const q = customerSearch.trim().toLowerCase();
    const list = q ? customers.filter((c) => c.name.toLowerCase().includes(q) || (c.phone ?? "").includes(q)) : customers;
    return list.slice(0, 200);
  }, [customers, customerSearch]);

  const parsedRows = rows.map((r) => ({ productId: r.productId || null, description: r.description.trim(), quantity: Number(r.quantity), unitPrice: parseMoneyToCents(r.unitPrice) }));
  const subtotal = parsedRows.reduce((a, r) => a + (Number.isInteger(r.quantity) && r.unitPrice !== null ? r.quantity * r.unitPrice : 0), 0);
  const d = parseMoneyToCents(discount) ?? 0;
  const s = parseMoneyToCents(shippingFee) ?? 0;
  const total = subtotal - d + s;

  function build(): { payload?: unknown; error?: string } {
    if (customerMode === "existing" && !customerId) return { error: "Escolha o cliente." };
    if (customerMode === "new" && newName.trim().length < 2) return { error: "Informe o nome do novo cliente." };
    for (const [i, r] of parsedRows.entries()) {
      if (!r.description) return { error: `Item ${i + 1}: descreva o produto.` };
      if (!Number.isInteger(r.quantity) || r.quantity < 1) return { error: `Item ${i + 1}: quantidade inválida.` };
      if (r.unitPrice === null) return { error: `Item ${i + 1}: preço inválido.` };
    }
    if (d > subtotal) return { error: "O desconto é maior que o valor dos itens." };
    return {
      payload: {
        customerId: customerMode === "existing" ? customerId : null,
        newCustomer: customerMode === "new" ? { name: newName.trim(), phone: newPhone.trim() || null } : null,
        operationId, channel, orderDate,
        items: parsedRows, discount: d, shippingFee: s,
        paymentMethod: paymentMethod || null, accountId: accountId || null, attendant,
        deliveryMethod: deliveryMethod || null, address, trackingCode, deliveryPerson, excursionInfo,
        expectedDelivery: expectedDelivery || null, notes,
      },
    };
  }
  const built = build();

  return (
    <form action={action} className="space-y-4">
      {initial ? <input type="hidden" name="id" value={initial.id} /> : null}
      <input type="hidden" name="payload" value={built.payload ? JSON.stringify(built.payload) : ""} />

      <Card>
        <CardHeader title="Cliente" action={
          <button type="button" className="text-sm text-navy-800 underline-offset-4 hover:underline" onClick={() => setCustomerMode(customerMode === "new" ? "existing" : "new")}>
            {customerMode === "new" ? "Escolher cliente existente" : "+ Novo cliente"}
          </button>
        } />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          {customerMode === "existing" ? (
            <>
              <Field label="Buscar" htmlFor="customerSearch">
                <Input id="customerSearch" value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)} placeholder="Nome ou telefone" />
              </Field>
              <Field label="Cliente" htmlFor="customerId">
                <Select id="customerId" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                  <option value="">Selecione…</option>
                  {filteredCustomers.map((c) => <option key={c.id} value={c.id}>{c.name}{c.phone ? ` · ${c.phone}` : ""}</option>)}
                </Select>
              </Field>
            </>
          ) : (
            <>
              <Field label="Nome do cliente" htmlFor="newName"><Input id="newName" value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={120} /></Field>
              <Field label="Telefone / WhatsApp" htmlFor="newPhone"><Input id="newPhone" type="tel" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} maxLength={30} /></Field>
            </>
          )}
          <Field label="Canal" htmlFor="channel">
            <Select id="channel" value={channel} onChange={(e) => setChannel(e.target.value as Channel)}>
              <option value="WHATSAPP">WhatsApp</option>
              <option value="INSTAGRAM">Instagram</option>
              <option value="KIOSK">Quiosque</option>
              <option value="OTHER">Outro</option>
            </Select>
          </Field>
          <Field label="Data do pedido" htmlFor="orderDate"><Input id="orderDate" type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} /></Field>
          <Field label="Operação" htmlFor="operationId">
            <Select id="operationId" value={operationId} onChange={(e) => setOperationId(e.target.value)}>
              {operations.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </Select>
          </Field>
          <Field label="Atendido por (histórico)" htmlFor="attendant"><Input id="attendant" value={attendant} onChange={(e) => setAttendant(e.target.value)} maxLength={80} /></Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Produtos" action={<span className="num font-semibold">{formatMoney(subtotal)}</span>} />
        <ul className="divide-y divide-line">
          {rows.map((r, i) => (
            <li key={i} className="grid grid-cols-2 gap-2 px-4 py-3 sm:grid-cols-[1.4fr_1.6fr_80px_130px_auto] sm:items-end sm:px-5">
              <Field label="Produto" htmlFor={`p-${i}`} className="col-span-2 sm:col-span-1">
                <Select id={`p-${i}`} value={r.productId} onChange={(e) => {
                  const p = products.find((x) => x.id === e.target.value);
                  setRows(rows.map((x, j) => (j === i ? { ...x, productId: e.target.value, description: p ? p.name : x.description, unitPrice: p ? centsToInput(p.price) : x.unitPrice } : x)));
                }}>
                  <option value="">Avulso / digitar</option>
                  {products.filter((p) => p.active || p.id === r.productId).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </Select>
              </Field>
              <Field label="Descrição" htmlFor={`d-${i}`} className="col-span-2 sm:col-span-1">
                <Input id={`d-${i}`} value={r.description} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))} maxLength={200} />
              </Field>
              <Field label="Qtd." htmlFor={`q-${i}`}>
                <Input id={`q-${i}`} type="number" min={1} inputMode="numeric" value={r.quantity} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, quantity: e.target.value } : x)))} />
              </Field>
              <Field label="Preço un." htmlFor={`u-${i}`}>
                <MoneyInput id={`u-${i}`} value={r.unitPrice} onChange={(v) => setRows(rows.map((x, j) => (j === i ? { ...x, unitPrice: v } : x)))} />
              </Field>
              {rows.length > 1 ? (
                <Button type="button" variant="ghost" size="sm" className="col-span-2 justify-self-start sm:col-span-1 sm:mb-1" onClick={() => setRows(rows.filter((_, j) => j !== i))} aria-label={`Remover item ${i + 1}`}>
                  <Trash2 className="size-4" /> <span className="sm:hidden">Remover</span>
                </Button>
              ) : <span className="hidden sm:block" />}
            </li>
          ))}
        </ul>
        <CardBody className="border-t border-line">
          <Button type="button" variant="secondary" size="sm" onClick={() => setRows([...rows, { productId: "", description: "", quantity: "1", unitPrice: "" }])}>+ Adicionar item</Button>
          {products.length === 0 ? <p className="mt-2 text-xs text-muted">Dica: cadastre os produtos em Configurações → Produtos para preencher preço automaticamente.</p> : null}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Pagamento" action={<span className="num text-lg font-semibold">{formatMoney(total)}</span>} />
        <CardBody className="grid grid-cols-2 gap-4">
          <Field label="Desconto" htmlFor="discount"><MoneyInput id="discount" value={discount} onChange={setDiscount} /></Field>
          <Field label="Frete cobrado" htmlFor="shippingFee"><MoneyInput id="shippingFee" value={shippingFee} onChange={setShippingFee} /></Field>
          <Field label="Forma de pagamento" htmlFor="paymentMethod">
            <Select id="paymentMethod" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
              <option value="">Não informada</option>
              {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{PAYMENT_METHOD_LABELS[m]}</option>)}
            </Select>
          </Field>
          <Field label="Conta que recebe" htmlFor="accountId">
            <Select id="accountId" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              <option value="">Não informada</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </Select>
          </Field>
          <p className="col-span-2 text-xs text-muted">A venda entra no financeiro quando o pedido passa para “Pagamento confirmado”.</p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Entrega" />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label="Método de entrega" htmlFor="deliveryMethod">
            <Select id="deliveryMethod" value={deliveryMethod} onChange={(e) => setDeliveryMethod(e.target.value as Delivery)}>
              <option value="">A definir</option>
              <option value="CORREIOS">Correios</option>
              <option value="CAR">Carro (entrega própria)</option>
              <option value="EXCURSION">Excursão</option>
              <option value="PICKUP">Retirada</option>
            </Select>
          </Field>
          <Field label="Previsão de entrega" htmlFor="expectedDelivery"><Input id="expectedDelivery" type="date" value={expectedDelivery} onChange={(e) => setExpectedDelivery(e.target.value)} /></Field>
          {deliveryMethod === "CORREIOS" ? <Field label="Código de rastreamento" htmlFor="trackingCode"><Input id="trackingCode" value={trackingCode} onChange={(e) => setTrackingCode(e.target.value.toUpperCase())} maxLength={60} /></Field> : null}
          {deliveryMethod === "CAR" ? <Field label="Responsável pela entrega" htmlFor="deliveryPerson"><Input id="deliveryPerson" value={deliveryPerson} onChange={(e) => setDeliveryPerson(e.target.value)} maxLength={80} /></Field> : null}
          {deliveryMethod === "EXCURSION" ? <Field label="Excursão (nome, ônibus, guia, horário)" htmlFor="excursionInfo"><Input id="excursionInfo" value={excursionInfo} onChange={(e) => setExcursionInfo(e.target.value)} maxLength={200} /></Field> : null}
          {deliveryMethod !== "PICKUP" ? (
            <Field label="Endereço / informações de envio" htmlFor="address" className="sm:col-span-2"><Textarea id="address" value={address} onChange={(e) => setAddress(e.target.value)} rows={2} maxLength={500} /></Field>
          ) : null}
          <Field label="Observações" htmlFor="notes" className="sm:col-span-2"><Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={2000} /></Field>
        </CardBody>
      </Card>

      {clientError ? <p role="alert" className="rounded-lg bg-negative-soft px-3 py-2 text-sm text-negative">{clientError}</p> : null}
      {!state.ok ? <FormMessage state={state} /> : null}
      <div className="sticky bottom-20 z-10 lg:bottom-4">
        <Button type="submit" size="lg" className="w-full shadow-lg shadow-black/10 sm:w-auto" disabled={busy} onClick={(e) => {
          if (built.error) { e.preventDefault(); setClientError(built.error); } else setClientError(null);
        }}>
          {busy ? "Salvando…" : initial ? "Salvar pedido" : `Registrar pedido · ${formatMoney(total)}`}
        </Button>
      </div>
    </form>
  );
}
