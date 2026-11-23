/**
 * Regras de ESCRITA do financeiro. Toda função valida a entrada e grava em transação,
 * junto com o registro de auditoria. Recebe o cliente do banco por parâmetro (testável).
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import { audit } from "@/lib/audit";
import { dateOnly, monthKey, todayISO, toISO, formatMonthShort } from "@/lib/dates";
import { DomainError } from "@/lib/errors";
import { formatMoney } from "@/lib/money";
import { groupMatchesType } from "./calculations";
import {
  cancelInputSchema,
  entryInputSchema,
  monthKeySchema,
  settleInputSchema,
  transferInputSchema,
  type EntryInput,
} from "./schemas";

type Tx = Prisma.TransactionClient;
interface Meta {
  ip: string | null;
}

// ---------------------------------------------------------------------------
// Verificações compartilhadas
// ---------------------------------------------------------------------------

export async function assertMonthOpen(tx: Tx, isoDate: string): Promise<void> {
  const month = monthKey(isoDate);
  const closed = await tx.periodClose.findUnique({ where: { month } });
  if (closed)
    throw new DomainError(
      `O mês ${formatMonthShort(month)} está fechado. Reabra o mês em Financeiro → Fechamentos para alterar lançamentos dele.`,
    );
}

export async function assertAccountForDate(tx: Tx, accountId: string, isoDate: string): Promise<void> {
  const account = await tx.financialAccount.findUnique({ where: { id: accountId } });
  if (!account) throw new DomainError("Conta financeira não encontrada.", "accountId");
  if (isoDate < toISO(account.openingDate))
    throw new DomainError(
      `A conta "${account.name}" começa em ${toISO(account.openingDate).split("-").reverse().join("/")}; não é possível movimentá-la antes do saldo inicial.`,
      "accountId",
    );
}

async function validateEntryRefs(tx: Tx, input: EntryInput, isNew: boolean): Promise<void> {
  const today = todayISO();

  const category = await tx.category.findUnique({ where: { id: input.categoryId } });
  if (!category) throw new DomainError("Categoria não encontrada.", "categoryId");
  if (category.type !== input.type || !groupMatchesType(category.group, input.type))
    throw new DomainError("A categoria não corresponde ao tipo do lançamento.", "categoryId");
  if (isNew && !category.active) throw new DomainError("Esta categoria está inativa.", "categoryId");

  const operation = await tx.operation.findUnique({ where: { id: input.operationId } });
  if (!operation) throw new DomainError("Operação não encontrada.", "operationId");
  if (isNew && !operation.active) throw new DomainError("Esta operação está inativa.", "operationId");

  if (input.supplierId) {
    const supplier = await tx.supplier.findUnique({ where: { id: input.supplierId } });
    if (!supplier) throw new DomainError("Fornecedor não encontrado.", "supplierId");
  }

  if (input.refundOfId) {
    if (input.type !== "EXPENSE" || category.group !== "SALES_DEDUCTION")
      throw new DomainError("Somente saídas da categoria de estornos/devoluções podem ser vinculadas a uma venda.", "refundOfId");
    const original = await tx.entry.findUnique({ where: { id: input.refundOfId } });
    if (!original || original.type !== "INCOME" || original.canceledAt)
      throw new DomainError("A venda original do estorno não foi encontrada ou está cancelada.", "refundOfId");
  }

  for (const [idx, inst] of input.installments.entries()) {
    if (inst.settled && inst.settledAt! > today)
      throw new DomainError(`Parcela ${idx + 1}: a data de pagamento/recebimento não pode ser no futuro.`, "installments");
    if (inst.accountId && inst.settled) await assertAccountForDate(tx, inst.accountId, inst.settledAt!);
    else if (inst.accountId && !(await tx.financialAccount.findUnique({ where: { id: inst.accountId } })))
      throw new DomainError("Conta financeira não encontrada.", "accountId");
  }
}

function installmentRows(input: EntryInput) {
  return [...input.installments]
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .map((i, idx) => ({
      number: idx + 1,
      dueDate: dateOnly(i.dueDate),
      amount: i.amount,
      feeAmount: input.type === "INCOME" ? i.feeAmount : 0,
      paymentMethod: i.paymentMethod,
      accountId: i.accountId,
      status: i.settled ? ("SETTLED" as const) : ("PENDING" as const),
      settledAt: i.settled ? dateOnly(i.settledAt!) : null,
    }));
}

const SOURCE_LABEL = {
  MANUAL: "",
  ORDER: "Pedidos",
  KIOSK_CLOSING: "Quiosques (fechamento de caixa)",
  PAYROLL: "Pessoas (salários)",
  PURCHASE: "Compras",
} as const;

/** Lançamentos gerados por outro módulo só podem ser alterados/cancelados na origem. */
function assertManual(entry: { source: keyof typeof SOURCE_LABEL }) {
  if (entry.source !== "MANUAL")
    throw new DomainError(`Este lançamento foi gerado pelo módulo ${SOURCE_LABEL[entry.source]}. Altere-o por lá.`);
}

function entrySnapshot(e: { description: string; amount: number; competenceDate: Date; categoryId: string; operationId: string }) {
  return {
    description: e.description,
    amount: e.amount,
    competenceDate: toISO(e.competenceDate),
    categoryId: e.categoryId,
    operationId: e.operationId,
  };
}

// ---------------------------------------------------------------------------
// Lançamentos
// ---------------------------------------------------------------------------

export async function createEntry(db: PrismaClient, raw: unknown, meta: Meta) {
  const input = entryInputSchema.parse(raw);
  return db.$transaction(async (tx) => {
    await assertMonthOpen(tx, input.competenceDate);
    await validateEntryRefs(tx, input, true);
    const amount = input.installments.reduce((a, i) => a + i.amount, 0);
    const entry = await tx.entry.create({
      data: {
        type: input.type,
        description: input.description,
        amount,
        competenceDate: dateOnly(input.competenceDate),
        categoryId: input.categoryId,
        operationId: input.operationId,
        supplierId: input.supplierId,
        refundOfId: input.refundOfId,
        notes: input.notes,
        installments: { create: installmentRows(input) },
      },
    });
    await audit(
      {
        action: "finance.entry.create",
        entity: "Entry",
        entityId: entry.id,
        summary: `${input.type === "INCOME" ? "Entrada" : "Saída"} criada: ${input.description} (${formatMoney(amount)})`,
        metadata: { ...entrySnapshot(entry), installments: input.installments.length },
        ip: meta.ip,
      },
      tx,
    );
    return entry;
  });
}

export async function updateEntry(db: PrismaClient, entryId: string, raw: unknown, meta: Meta) {
  const input = entryInputSchema.parse(raw);
  return db.$transaction(async (tx) => {
    const current = await tx.entry.findUnique({ where: { id: entryId } });
    if (!current) throw new DomainError("Lançamento não encontrado.");
    if (current.canceledAt) throw new DomainError("Lançamentos cancelados não podem ser editados. Desfaça o cancelamento primeiro.");
    if (current.type !== input.type) throw new DomainError("Não é possível trocar o tipo (entrada/saída) de um lançamento.");
    assertManual(current);
    await assertMonthOpen(tx, toISO(current.competenceDate));
    await assertMonthOpen(tx, input.competenceDate);
    await validateEntryRefs(tx, input, false);

    const amount = input.installments.reduce((a, i) => a + i.amount, 0);
    // As parcelas são substituídas integralmente: nada além do próprio lançamento as referencia.
    await tx.installment.deleteMany({ where: { entryId } });
    const updated = await tx.entry.update({
      where: { id: entryId },
      data: {
        description: input.description,
        amount,
        competenceDate: dateOnly(input.competenceDate),
        categoryId: input.categoryId,
        operationId: input.operationId,
        supplierId: input.supplierId,
        refundOfId: input.refundOfId,
        notes: input.notes,
        installments: { create: installmentRows(input) },
      },
    });
    await audit(
      {
        action: "finance.entry.update",
        entity: "Entry",
        entityId: entryId,
        summary: `Lançamento editado: ${input.description} (${formatMoney(amount)})`,
        metadata: { before: entrySnapshot(current), after: entrySnapshot(updated) },
        ip: meta.ip,
      },
      tx,
    );
    return updated;
  });
}

export async function cancelEntry(db: PrismaClient, raw: unknown, meta: Meta) {
  const { entryId, reason } = cancelInputSchema.parse(raw);
  return db.$transaction(async (tx) => {
    const entry = await tx.entry.findUnique({ where: { id: entryId } });
    if (!entry) throw new DomainError("Lançamento não encontrado.");
    if (entry.canceledAt) throw new DomainError("Este lançamento já está cancelado.");
    assertManual(entry);
    await assertMonthOpen(tx, toISO(entry.competenceDate));
    await tx.entry.update({ where: { id: entryId }, data: { canceledAt: new Date(), cancelReason: reason } });
    await audit(
      { action: "finance.entry.cancel", entity: "Entry", entityId: entryId, summary: `Lançamento cancelado: ${entry.description} — ${reason}`, ip: meta.ip },
      tx,
    );
  });
}

export async function restoreEntry(db: PrismaClient, entryId: string, meta: Meta) {
  return db.$transaction(async (tx) => {
    const entry = await tx.entry.findUnique({ where: { id: entryId } });
    if (!entry) throw new DomainError("Lançamento não encontrado.");
    if (!entry.canceledAt) throw new DomainError("Este lançamento não está cancelado.");
    assertManual(entry);
    await assertMonthOpen(tx, toISO(entry.competenceDate));
    await tx.entry.update({ where: { id: entryId }, data: { canceledAt: null, cancelReason: null } });
    await audit(
      { action: "finance.entry.restore", entity: "Entry", entityId: entryId, summary: `Cancelamento desfeito: ${entry.description}`, ip: meta.ip },
      tx,
    );
  });
}

/** Exclusão definitiva. Retorna as chaves dos anexos para remoção do disco após o commit. */
export async function deleteEntry(db: PrismaClient, entryId: string, meta: Meta): Promise<string[]> {
  return db.$transaction(async (tx) => {
    const entry = await tx.entry.findUnique({
      where: { id: entryId },
      include: { installments: true, attachments: true, refunds: { select: { id: true } } },
    });
    if (!entry) throw new DomainError("Lançamento não encontrado.");
    assertManual(entry);
    if (entry.refunds.length > 0)
      throw new DomainError("Existem estornos vinculados a esta venda. Exclua ou desvincule os estornos primeiro.");
    await assertMonthOpen(tx, toISO(entry.competenceDate));
    await tx.entry.delete({ where: { id: entryId } });
    await audit(
      {
        action: "finance.entry.delete",
        entity: "Entry",
        entityId: entryId,
        summary: `Lançamento excluído: ${entry.description} (${formatMoney(entry.amount)})`,
        metadata: {
          ...entrySnapshot(entry),
          type: entry.type,
          installments: entry.installments.map((i) => ({
            dueDate: toISO(i.dueDate),
            amount: i.amount,
            feeAmount: i.feeAmount,
            status: i.status,
            settledAt: i.settledAt ? toISO(i.settledAt) : null,
          })),
        },
        ip: meta.ip,
      },
      tx,
    );
    return entry.attachments.map((a) => a.storageKey);
  });
}

// ---------------------------------------------------------------------------
// Liquidação (baixa) de parcelas
// ---------------------------------------------------------------------------

export async function settleInstallment(db: PrismaClient, raw: unknown, meta: Meta) {
  const input = settleInputSchema.parse(raw);
  if (input.settledAt > todayISO()) throw new DomainError("A data não pode ser no futuro.", "settledAt");
  return db.$transaction(async (tx) => {
    const inst = await tx.installment.findUnique({ where: { id: input.installmentId }, include: { entry: true } });
    if (!inst) throw new DomainError("Parcela não encontrada.");
    if (inst.entry.canceledAt) throw new DomainError("O lançamento está cancelado.");
    if (inst.status === "SETTLED") throw new DomainError("Esta parcela já foi baixada.");
    const accountId = input.accountId ?? inst.accountId;
    if (accountId) await assertAccountForDate(tx, accountId, input.settledAt);
    const feeAmount = inst.entry.type === "INCOME" ? (input.feeAmount ?? inst.feeAmount) : 0;
    if (feeAmount > inst.amount) throw new DomainError("A taxa não pode ser maior que a parcela.", "feeAmount");

    // Atualização condicional: evita baixa dupla em requisições simultâneas.
    const res = await tx.installment.updateMany({
      where: { id: inst.id, status: "PENDING" },
      data: {
        status: "SETTLED",
        settledAt: dateOnly(input.settledAt),
        accountId,
        paymentMethod: input.paymentMethod ?? inst.paymentMethod,
        feeAmount,
      },
    });
    if (res.count !== 1) throw new DomainError("Esta parcela já foi baixada.");
    await audit(
      {
        action: "finance.installment.settle",
        entity: "Entry",
        entityId: inst.entryId,
        summary: `${inst.entry.type === "INCOME" ? "Recebimento" : "Pagamento"} registrado: ${inst.entry.description} — parcela ${inst.number} (${formatMoney(inst.amount)})`,
        metadata: { installmentId: inst.id, settledAt: input.settledAt, accountId, feeAmount },
        ip: meta.ip,
      },
      tx,
    );
  });
}

export async function unsettleInstallment(db: PrismaClient, installmentId: string, meta: Meta) {
  return db.$transaction(async (tx) => {
    const inst = await tx.installment.findUnique({ where: { id: installmentId }, include: { entry: true } });
    if (!inst) throw new DomainError("Parcela não encontrada.");
    if (inst.status !== "SETTLED") throw new DomainError("Esta parcela não está baixada.");
    if (inst.entry.canceledAt) throw new DomainError("O lançamento está cancelado.");
    await tx.installment.update({ where: { id: installmentId }, data: { status: "PENDING", settledAt: null } });
    await audit(
      {
        action: "finance.installment.unsettle",
        entity: "Entry",
        entityId: inst.entryId,
        summary: `Baixa desfeita: ${inst.entry.description} — parcela ${inst.number}`,
        metadata: { installmentId, previousSettledAt: inst.settledAt ? toISO(inst.settledAt) : null },
        ip: meta.ip,
      },
      tx,
    );
  });
}

// ---------------------------------------------------------------------------
// Transferências internas
// ---------------------------------------------------------------------------

export async function createTransfer(db: PrismaClient, raw: unknown, meta: Meta) {
  const input = transferInputSchema.parse(raw);
  if (input.date > todayISO()) throw new DomainError("A data da transferência não pode ser no futuro.", "date");
  return db.$transaction(async (tx) => {
    await assertAccountForDate(tx, input.fromAccountId, input.date);
    await assertAccountForDate(tx, input.toAccountId, input.date);
    const t = await tx.transfer.create({
      data: { ...input, date: dateOnly(input.date) },
      include: { fromAccount: true, toAccount: true },
    });
    await audit(
      {
        action: "finance.transfer.create",
        entity: "Transfer",
        entityId: t.id,
        summary: `Transferência ${t.fromAccount.name} → ${t.toAccount.name} (${formatMoney(t.amount)})`,
        ip: meta.ip,
      },
      tx,
    );
    return t;
  });
}

export async function deleteTransfer(db: PrismaClient, transferId: string, meta: Meta) {
  return db.$transaction(async (tx) => {
    const t = await tx.transfer.findUnique({ where: { id: transferId }, include: { fromAccount: true, toAccount: true } });
    if (!t) throw new DomainError("Transferência não encontrada.");
    await tx.transfer.delete({ where: { id: transferId } });
    await audit(
      {
        action: "finance.transfer.delete",
        entity: "Transfer",
        entityId: transferId,
        summary: `Transferência excluída: ${t.fromAccount.name} → ${t.toAccount.name} (${formatMoney(t.amount)}) de ${toISO(t.date)}`,
        ip: meta.ip,
      },
      tx,
    );
  });
}

// ---------------------------------------------------------------------------
// Fechamento mensal
// ---------------------------------------------------------------------------

export async function closeMonth(db: PrismaClient, month: string, notes: string | null, meta: Meta) {
  monthKeySchema.parse(month);
  if (month > monthKey(todayISO())) throw new DomainError("Não é possível fechar um mês futuro.");
  return db.$transaction(async (tx) => {
    const exists = await tx.periodClose.findUnique({ where: { month } });
    if (exists) throw new DomainError("Este mês já está fechado.");
    await tx.periodClose.create({ data: { month, notes: notes?.trim() || null } });
    await audit({ action: "finance.month.close", summary: `Mês ${formatMonthShort(month)} fechado`, ip: meta.ip }, tx);
  });
}

export async function reopenMonth(db: PrismaClient, month: string, meta: Meta) {
  monthKeySchema.parse(month);
  return db.$transaction(async (tx) => {
    const res = await tx.periodClose.deleteMany({ where: { month } });
    if (res.count === 0) throw new DomainError("Este mês não está fechado.");
    await audit({ action: "finance.month.reopen", summary: `Mês ${formatMonthShort(month)} reaberto`, ip: meta.ip }, tx);
  });
}
