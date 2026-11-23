"use client";

import { useActionState, useMemo, useState } from "react";
import type { Category, FinancialAccount, Operation, Supplier } from "@prisma/client";
import { saveEntryAction } from "../actions";
import { GROUP_LABELS } from "../calculations";
import { PAYMENT_METHOD_LABELS, PAYMENT_METHODS } from "../schemas";
import { initialActionState } from "@/lib/action-state";
import { addDaysISO, addMonthsISO, formatDateBR } from "@/lib/dates";
import { centsToInput, formatMoney, parseMoneyToCents, splitCents, splitProportional } from "@/lib/money";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input, Select, Textarea, Checkbox } from "@/components/ui/field";
import { FormMessage, useActionRedirect } from "@/components/ui/form-bits";
import { MoneyInput } from "@/components/ui/money-input";

type EntryType = "INCOME" | "EXPENSE";
type Mode = "settled" | "pending" | "installments";

interface Row {
  dueDate: string;
  amount: string;
  fee: string;
  settled: boolean;
  settledAt: string;
}

export interface EntryFormInitial {
  id: string;
  type: EntryType;
  description: string;
  competenceDate: string;
  categoryId: string;
  operationId: string;
  supplierId: string | null;
  refundOfId: string | null;
  notes: string | null;
  installments: {
    dueDate: string;
    amount: number;
    feeAmount: number;
    paymentMethod: string | null;
    accountId: string | null;
    status: "PENDING" | "SETTLED";
    settledAt: string | null;
  }[];
}

interface Props {
  today: string;
  defaultType: EntryType;
  categories: Category[];
  operations: Operation[];
  accounts: FinancialAccount[];
  suppliers: Supplier[];
  initial?: EntryFormInitial;
  /** Pré-preenchimento de estorno */
  refund?: { id: string; description: string; amount: number; operationId: string };
}

function Segmented<T extends string>({ value, onChange, options, disabled }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; disabled?: boolean }) {
  return (
    <div className="grid rounded-lg border border-line-strong bg-canvas p-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }} role="radiogroup">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          disabled={disabled}
          onClick={() => onChange(o.value)}
          className={cn(
            "h-10 rounded-md px-2 text-sm font-medium transition-colors disabled:cursor-not-allowed",
            value === o.value ? "bg-surface text-ink shadow-sm ring-1 ring-line" : "text-muted hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function EntryForm({ today, defaultType, categories, operations, accounts, suppliers, initial, refund }: Props) {
  const [state, formAction, pending] = useActionState(saveEntryAction, initialActionState);
  useActionRedirect(state);
  const busy = pending || Boolean(state.ok && state.redirectTo);
  const isEdit = Boolean(initial);
  const first = initial?.installments[0];

  const [type, setType] = useState<EntryType>(initial?.type ?? (refund ? "EXPENSE" : defaultType));
  const [description, setDescription] = useState(initial?.description ?? (refund ? `Estorno — ${refund.description}` : ""));
  const [total, setTotal] = useState(initial ? centsToInput(initial.installments.reduce((a, i) => a + i.amount, 0)) : refund ? centsToInput(refund.amount) : "");
  const [competenceDate, setCompetenceDate] = useState(initial?.competenceDate ?? today);
  const typeCategories = categories.filter((c) => c.type === type);
  const defaultCategory = refund ? typeCategories.find((c) => c.group === "SALES_DEDUCTION")?.id : undefined;
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? defaultCategory ?? "");
  const [operationId, setOperationId] = useState(initial?.operationId ?? refund?.operationId ?? "");
  const [supplierId, setSupplierId] = useState(initial?.supplierId ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");

  const initialMode: Mode = !initial ? "settled" : initial.installments.length > 1 ? "installments" : first?.status === "SETTLED" ? "settled" : "pending";
  const [mode, setMode] = useState<Mode>(initialMode);
  const [paymentMethod, setPaymentMethod] = useState(first?.paymentMethod ?? "");
  const [accountId, setAccountId] = useState(first?.accountId ?? "");
  const [settledAt, setSettledAt] = useState(first?.settledAt ?? today);
  const [dueDate, setDueDate] = useState(first?.dueDate ?? today);
  const [fee, setFee] = useState(initial && initialMode !== "installments" && first?.feeAmount ? centsToInput(first.feeAmount) : "");

  // Parcelamento
  const [count, setCount] = useState(initial && initial.installments.length > 1 ? initial.installments.length : 2);
  const [firstDue, setFirstDue] = useState(initial && initial.installments.length > 1 ? initial.installments[0]!.dueDate : addMonthsISO(today, 1));
  const [interval, setInterval] = useState<"month" | "30" | "15" | "7">("month");
  const [totalFee, setTotalFee] = useState("");
  const [rows, setRows] = useState<Row[]>(
    initial && initial.installments.length > 1
      ? initial.installments.map((i) => ({
          dueDate: i.dueDate,
          amount: centsToInput(i.amount),
          fee: i.feeAmount ? centsToInput(i.feeAmount) : "",
          settled: i.status === "SETTLED",
          settledAt: i.settledAt ?? today,
        }))
      : [],
  );
  const [clientError, setClientError] = useState<string | null>(null);

  function regenerate(next: Partial<{ count: number; firstDue: string; interval: typeof interval; total: string; totalFee: string }> = {}) {
    const c = Math.min(60, Math.max(2, next.count ?? count));
    const fd = next.firstDue ?? firstDue;
    const iv = next.interval ?? interval;
    const totalCents = parseMoneyToCents(next.total ?? total) ?? 0;
    const feeCents = parseMoneyToCents(next.totalFee ?? totalFee) ?? 0;
    const amounts = splitCents(totalCents, c);
    const fees = splitProportional(Math.min(feeCents, totalCents), amounts);
    setRows(
      amounts.map((amt, i) => ({
        dueDate: iv === "month" ? addMonthsISO(fd, i) : addDaysISO(fd, i * Number(iv)),
        amount: centsToInput(amt),
        fee: fees[i] ? centsToInput(fees[i]!) : "",
        settled: false,
        settledAt: today,
      })),
    );
  }

  const isIncome = type === "INCOME";
  const verbDone = isIncome ? "Recebido" : "Pago";
  const groupedCategories = useMemo(() => {
    const map = new Map<string, Category[]>();
    for (const c of typeCategories) map.set(c.group, [...(map.get(c.group) ?? []), c]);
    return [...map.entries()];
  }, [typeCategories]);

  const totalCents = parseMoneyToCents(total);
  const rowsSum = rows.reduce((a, r) => a + (parseMoneyToCents(r.amount) ?? 0), 0);

  function buildPayload(): { payload?: unknown; error?: string } {
    if (!description.trim()) return { error: "Descreva o lançamento." };
    if (!categoryId) return { error: "Escolha a categoria." };
    if (!operationId) return { error: "Escolha a operação." };
    if (totalCents === null || totalCents <= 0) return { error: "Informe um valor total válido." };
    const pm = paymentMethod || null;
    const acc = accountId || null;
    let installments;
    if (mode === "installments") {
      if (rows.length < 2) return { error: "Gere as parcelas." };
      if (rowsSum !== totalCents)
        return { error: `A soma das parcelas (${formatMoney(rowsSum)}) é diferente do valor total (${formatMoney(totalCents)}).` };
      installments = [];
      for (const [i, r] of rows.entries()) {
        const amount = parseMoneyToCents(r.amount);
        const feeAmount = isIncome ? (r.fee ? parseMoneyToCents(r.fee) : 0) : 0;
        if (!amount) return { error: `Parcela ${i + 1}: valor inválido.` };
        if (feeAmount === null) return { error: `Parcela ${i + 1}: taxa inválida.` };
        installments.push({ dueDate: r.dueDate, amount, feeAmount, paymentMethod: pm, accountId: acc, settled: r.settled, settledAt: r.settled ? r.settledAt : null });
      }
    } else {
      const feeAmount = isIncome && fee ? parseMoneyToCents(fee) : 0;
      if (feeAmount === null) return { error: "Taxa inválida." };
      const settled = mode === "settled";
      installments = [{ dueDate: settled ? settledAt : dueDate, amount: totalCents, feeAmount, paymentMethod: pm, accountId: acc, settled, settledAt: settled ? settledAt : null }];
    }
    return {
      payload: {
        type,
        description: description.trim(),
        competenceDate,
        categoryId,
        operationId,
        supplierId: !isIncome && supplierId ? supplierId : null,
        refundOfId: initial?.refundOfId ?? refund?.id ?? null,
        notes: notes.trim() || null,
        installments,
      },
    };
  }

  const built = buildPayload();
  const fe = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-4">
      {initial ? <input type="hidden" name="entryId" value={initial.id} /> : null}
      <input type="hidden" name="payload" value={built.payload ? JSON.stringify(built.payload) : ""} />

      <Card>
        <CardBody className="space-y-4">
          {!isEdit && !refund ? (
            <Segmented
              value={type}
              onChange={(v) => {
                setType(v);
                setCategoryId("");
              }}
              options={[
                { value: "INCOME", label: "Entrada" },
                { value: "EXPENSE", label: "Saída" },
              ]}
            />
          ) : null}

          <Field label="Descrição" htmlFor="description" error={fe.description}>
            <Input id="description" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={200} required placeholder={isIncome ? "Ex.: Vendas do dia" : "Ex.: Boleto fornecedor de essências"} />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Valor total" htmlFor="total">
              <MoneyInput
                id="total"
                value={total}
                onChange={(v) => {
                  setTotal(v);
                  if (mode === "installments" && !isEdit) regenerate({ total: v });
                }}
                required
              />
            </Field>
            <Field label="Data do lançamento (competência)" htmlFor="competenceDate" error={fe.competenceDate} hint="Quando a venda/despesa aconteceu.">
              <Input id="competenceDate" type="date" value={competenceDate} onChange={(e) => setCompetenceDate(e.target.value)} required />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Categoria" htmlFor="categoryId" error={fe.categoryId}>
              <Select id="categoryId" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required>
                <option value="">Selecione…</option>
                {groupedCategories.map(([group, cats]) => (
                  <optgroup key={group} label={GROUP_LABELS[group as keyof typeof GROUP_LABELS]}>
                    {cats.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                        {!c.active ? " (inativa)" : ""}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </Select>
            </Field>
            <Field label="Operação" htmlFor="operationId" error={fe.operationId}>
              <Select id="operationId" value={operationId} onChange={(e) => setOperationId(e.target.value)} required>
                <option value="">Selecione…</option>
                {operations.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          {!isIncome ? (
            <Field label="Fornecedor (opcional)" htmlFor="supplierId" error={fe.supplierId} hint={suppliers.length === 0 ? "Cadastre fornecedores em Configurações." : undefined}>
              <Select id="supplierId" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                <option value="">Nenhum</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={isIncome ? "Recebimento" : "Pagamento"} />
        <CardBody className="space-y-4">
          <Segmented
            value={mode}
            onChange={(m) => {
              setMode(m);
              if (m === "installments" && rows.length === 0) regenerate();
            }}
            options={[
              { value: "settled", label: verbDone },
              { value: "pending", label: isIncome ? "A receber" : "A pagar" },
              { value: "installments", label: "Parcelado" },
            ]}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Forma de pagamento" htmlFor="paymentMethod">
              <Select id="paymentMethod" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                <option value="">Não informado</option>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {PAYMENT_METHOD_LABELS[m]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label={mode === "settled" ? (isIncome ? "Conta que recebeu" : "Conta de onde saiu") : "Conta prevista (opcional)"}
              htmlFor="accountId"
              hint={accounts.length === 0 ? "Cadastre suas contas (caixas, bancos) em Configurações para acompanhar saldos." : undefined}
            >
              <Select id="accountId" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                <option value="">Não informada</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          {mode === "settled" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={`Data em que foi ${verbDone.toLowerCase()}`} htmlFor="settledAt">
                <Input id="settledAt" type="date" value={settledAt} max={today} onChange={(e) => setSettledAt(e.target.value)} required />
              </Field>
              {isIncome ? (
                <Field label="Taxa (cartão/maquininha)" htmlFor="fee" hint="Valor descontado pela operadora. Deixe vazio se não houver.">
                  <MoneyInput id="fee" value={fee} onChange={setFee} />
                </Field>
              ) : null}
            </div>
          ) : null}

          {mode === "pending" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Vencimento" htmlFor="dueDate">
                <Input id="dueDate" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required />
              </Field>
              {isIncome ? (
                <Field label="Taxa prevista" htmlFor="fee">
                  <MoneyInput id="fee" value={fee} onChange={setFee} />
                </Field>
              ) : null}
            </div>
          ) : null}

          {mode === "installments" ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Field label="Nº de parcelas" htmlFor="count">
                  <Input
                    id="count"
                    type="number"
                    min={2}
                    max={60}
                    inputMode="numeric"
                    value={count}
                    onChange={(e) => {
                      const v = Number(e.target.value) || 2;
                      setCount(v);
                      regenerate({ count: v });
                    }}
                  />
                </Field>
                <Field label="1º vencimento" htmlFor="firstDue">
                  <Input
                    id="firstDue"
                    type="date"
                    value={firstDue}
                    onChange={(e) => {
                      setFirstDue(e.target.value);
                      if (e.target.value) regenerate({ firstDue: e.target.value });
                    }}
                  />
                </Field>
                <Field label="Intervalo" htmlFor="interval">
                  <Select
                    id="interval"
                    value={interval}
                    onChange={(e) => {
                      const v = e.target.value as typeof interval;
                      setInterval(v);
                      regenerate({ interval: v });
                    }}
                  >
                    <option value="month">Mensal</option>
                    <option value="30">A cada 30 dias</option>
                    <option value="15">A cada 15 dias</option>
                    <option value="7">Semanal</option>
                  </Select>
                </Field>
                {isIncome ? (
                  <Field label="Taxa total" htmlFor="totalFee">
                    <MoneyInput
                      id="totalFee"
                      value={totalFee}
                      onChange={(v) => {
                        setTotalFee(v);
                        regenerate({ totalFee: v });
                      }}
                    />
                  </Field>
                ) : null}
              </div>

              <div className="rounded-lg border border-line">
                <div className="flex items-center justify-between border-b border-line px-3 py-2 text-sm">
                  <span className="font-medium">Parcelas</span>
                  <span className={cn("num", totalCents !== null && rowsSum !== totalCents ? "font-medium text-negative" : "text-muted")}>
                    Soma {formatMoney(rowsSum)}
                  </span>
                </div>
                <ul className="divide-y divide-line">
                  {rows.map((r, i) => (
                    <li key={i} className="space-y-2 px-3 py-3">
                      <p className="text-xs font-medium text-muted">Parcela {i + 1}</p>
                      <div className="grid grid-cols-2 items-center gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
                        <Input aria-label={`Vencimento da parcela ${i + 1}`} type="date" value={r.dueDate} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, dueDate: e.target.value } : x)))} />
                        <MoneyInput aria-label={`Valor da parcela ${i + 1}`} value={r.amount} onChange={(v) => setRows(rows.map((x, j) => (j === i ? { ...x, amount: v } : x)))} />
                        {isIncome ? (
                          <MoneyInput aria-label={`Taxa da parcela ${i + 1}`} placeholder="Taxa" value={r.fee} onChange={(v) => setRows(rows.map((x, j) => (j === i ? { ...x, fee: v } : x)))} />
                        ) : null}
                        <Checkbox label={verbDone} checked={r.settled} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, settled: e.target.checked } : x)))} />
                        {r.settled ? (
                          <Input aria-label={`Data em que a parcela ${i + 1} foi ${verbDone.toLowerCase()}`} type="date" className="col-span-2 sm:col-span-1" max={today} value={r.settledAt} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, settledAt: e.target.value } : x)))} />
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
              <p className="text-xs text-muted">
                Os valores são divididos automaticamente; você pode ajustar cada parcela. A soma precisa ser igual ao valor total.
                {rows[0] ? ` Primeira parcela em ${formatDateBR(rows[0].dueDate)}.` : ""}
              </p>
            </div>
          ) : null}
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <Field label="Observações (opcional)" htmlFor="notes">
            <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} rows={3} />
          </Field>
        </CardBody>
      </Card>

      {clientError ? (
        <p role="alert" className="rounded-lg bg-negative-soft px-3 py-2 text-sm text-negative">
          {clientError}
        </p>
      ) : null}
      {!state.ok ? <FormMessage state={state} /> : null}

      <div className="sticky bottom-20 z-10 flex gap-2 lg:bottom-4">
        <Button
          type="submit"
          size="lg"
          className="flex-1 shadow-lg shadow-black/10 sm:flex-none"
          disabled={busy}
          onClick={(e) => {
            if (built.error) {
              e.preventDefault();
              setClientError(built.error);
            } else setClientError(null);
          }}
        >
          {busy ? "Salvando…" : isEdit ? "Salvar alterações" : `Registrar ${isIncome ? "entrada" : "saída"}`}
        </Button>
      </div>
    </form>
  );
}
