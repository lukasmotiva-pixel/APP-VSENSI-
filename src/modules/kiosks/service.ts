/**
 * Fechamento de caixa diário dos quiosques. Cada fechamento gera exatamente UM lançamento de
 * entrada (origem KIOSK_CLOSING), com uma parcela por forma de pagamento. Assim a venda do dia
 * entra no faturamento uma única vez e cada forma de pagamento cai na conta correta.
 */
import { Prisma, type PaymentMethod, type PrismaClient } from "@prisma/client";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { dateOnly, formatDateBR, todayISO, toISO } from "@/lib/dates";
import { DomainError } from "@/lib/errors";
import { formatMoney, MAX_CENTS } from "@/lib/money";
import { assertAccountForDate, assertMonthOpen } from "@/modules/finance/service";
import { isoDate, optionalIsoDate } from "@/modules/finance/schemas";

type Tx = Prisma.TransactionClient;
interface Meta {
  ip: string | null;
}

const cents = z.number().int().min(0, "Valor inválido.").max(MAX_CENTS);
const optId = z.string().max(40).nullish().transform((v) => v || null);

export const closingSchema = z
  .object({
    operationId: z.string().min(1, "Escolha o quiosque."),
    date: isoDate,
    cash: cents,
    pix: cents,
    debit: cents,
    credit: cents,
    other: cents,
    debitFee: cents,
    creditFee: cents,
    creditReceiveDate: optionalIsoDate,
    cashAccountId: optId,
    pixAccountId: optId,
    cardAccountId: optId,
    notes: z.string().trim().max(1000).nullish().transform((v) => v || null),
  })
  .superRefine((c, ctx) => {
    if (c.cash + c.pix + c.debit + c.credit + c.other <= 0) ctx.addIssue({ code: "custom", path: ["cash"], message: "Informe o valor vendido em pelo menos uma forma de pagamento." });
    if (c.debitFee > c.debit) ctx.addIssue({ code: "custom", path: ["debitFee"], message: "A taxa do débito é maior que o valor do débito." });
    if (c.creditFee > c.credit) ctx.addIssue({ code: "custom", path: ["creditFee"], message: "A taxa do crédito é maior que o valor do crédito." });
    if (c.creditReceiveDate && c.creditReceiveDate < c.date) ctx.addIssue({ code: "custom", path: ["creditReceiveDate"], message: "O recebimento do crédito não pode ser antes da venda." });
  });

export type ClosingInput = z.infer<typeof closingSchema>;

export function closingTotal(c: { cash: number; pix: number; debit: number; credit: number; other: number }) {
  return c.cash + c.pix + c.debit + c.credit + c.other;
}

interface InstallmentRow {
  paymentMethod: PaymentMethod;
  amount: number;
  feeAmount: number;
  accountId: string | null;
  dueDate: string;
  settledAt: string | null;
}

/** Monta as parcelas do lançamento a partir do fechamento (função pura, testada). */
export function buildClosingInstallments(c: ClosingInput, today: string): InstallmentRow[] {
  const rows: InstallmentRow[] = [];
  const same = (paymentMethod: PaymentMethod, amount: number, accountId: string | null, feeAmount = 0) => {
    if (amount > 0) rows.push({ paymentMethod, amount, feeAmount, accountId, dueDate: c.date, settledAt: c.date });
  };
  same("CASH", c.cash, c.cashAccountId);
  same("PIX", c.pix, c.pixAccountId);
  same("DEBIT_CARD", c.debit, c.cardAccountId, c.debitFee);
  if (c.credit > 0) {
    const receive = c.creditReceiveDate ?? c.date;
    rows.push({
      paymentMethod: "CREDIT_CARD",
      amount: c.credit,
      feeAmount: c.creditFee,
      accountId: c.cardAccountId,
      dueDate: receive,
      settledAt: receive <= today ? receive : null, // data futura => fica em "a receber"
    });
  }
  same("OTHER", c.other, null);
  return rows;
}

async function salesCategoryId(tx: Tx): Promise<string> {
  const cat = await tx.category.findFirst({ where: { group: "SALES", type: "INCOME", active: true }, orderBy: { sortOrder: "asc" } });
  if (!cat) throw new DomainError("Não há categoria de vendas ativa. Crie uma em Configurações → Categorias.");
  return cat.id;
}

export async function saveClosing(db: PrismaClient, id: string | null, raw: unknown, meta: Meta) {
  const input = closingSchema.parse(raw);
  const today = todayISO();
  if (input.date > today) throw new DomainError("A data do fechamento não pode ser no futuro.", "date");

  try {
    return await db.$transaction(async (tx) => {
      const op = await tx.operation.findUnique({ where: { id: input.operationId } });
      if (!op || op.type !== "KIOSK") throw new DomainError("Quiosque não encontrado.", "operationId");
      await assertMonthOpen(tx, input.date);

      const current = id ? await tx.kioskClosing.findUnique({ where: { id }, include: { entry: { include: { installments: true } } } }) : null;
      if (id && !current) throw new DomainError("Fechamento não encontrado.");
      if (current) await assertMonthOpen(tx, toISO(current.date));

      const rows = buildClosingInstallments(input, today);
      // Ao editar, preserva a baixa já feita manualmente (ex.: crédito que caiu depois).
      for (const r of rows) {
        const prev = current?.entry?.installments.find((i) => i.paymentMethod === r.paymentMethod);
        if (prev?.status === "SETTLED" && !r.settledAt) {
          r.settledAt = toISO(prev.settledAt!);
          r.accountId = prev.accountId;
        }
      }
      for (const r of rows) if (r.accountId && r.settledAt) await assertAccountForDate(tx, r.accountId, r.settledAt);

      const total = closingTotal(input);
      const description = `Fechamento de caixa — ${op.name} — ${formatDateBR(input.date)}`;
      const installments = rows.map((r, i) => ({
        number: i + 1,
        dueDate: dateOnly(r.dueDate),
        amount: r.amount,
        feeAmount: r.feeAmount,
        paymentMethod: r.paymentMethod,
        accountId: r.accountId,
        status: r.settledAt ? ("SETTLED" as const) : ("PENDING" as const),
        settledAt: r.settledAt ? dateOnly(r.settledAt) : null,
      }));

      const data = {
        operationId: input.operationId,
        date: dateOnly(input.date),
        cash: input.cash,
        pix: input.pix,
        debit: input.debit,
        credit: input.credit,
        other: input.other,
        debitFee: input.debitFee,
        creditFee: input.creditFee,
        creditReceiveDate: input.creditReceiveDate ? dateOnly(input.creditReceiveDate) : null,
        cashAccountId: input.cashAccountId,
        pixAccountId: input.pixAccountId,
        cardAccountId: input.cardAccountId,
        notes: input.notes,
      };

      let entryId = current?.entryId ?? null;
      if (entryId) {
        await tx.installment.deleteMany({ where: { entryId } });
        await tx.entry.update({
          where: { id: entryId },
          data: { description, amount: total, competenceDate: dateOnly(input.date), operationId: input.operationId, canceledAt: null, cancelReason: null, installments: { create: installments } },
        });
      } else {
        const entry = await tx.entry.create({
          data: {
            type: "INCOME",
            source: "KIOSK_CLOSING",
            description,
            amount: total,
            competenceDate: dateOnly(input.date),
            categoryId: await salesCategoryId(tx),
            operationId: input.operationId,
            installments: { create: installments },
          },
        });
        entryId = entry.id;
      }

      const closing = current
        ? await tx.kioskClosing.update({ where: { id: current.id }, data: { ...data, entryId } })
        : await tx.kioskClosing.create({ data: { ...data, entryId } });

      await audit(
        {
          action: current ? "kiosk.closing.update" : "kiosk.closing.create",
          entity: "Entry",
          entityId: entryId,
          summary: `Fechamento ${current ? "editado" : "registrado"}: ${op.name} em ${formatDateBR(input.date)} (${formatMoney(total)})`,
          metadata: { closingId: closing.id, cash: input.cash, pix: input.pix, debit: input.debit, credit: input.credit, other: input.other },
          ip: meta.ip,
        },
        tx,
      );
      return closing;
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")
      throw new DomainError("Já existe um fechamento deste quiosque nesta data. Edite o existente.", "date");
    throw e;
  }
}

export async function deleteClosing(db: PrismaClient, id: string, meta: Meta) {
  return db.$transaction(async (tx) => {
    const c = await tx.kioskClosing.findUnique({ where: { id }, include: { operation: true } });
    if (!c) throw new DomainError("Fechamento não encontrado.");
    await assertMonthOpen(tx, toISO(c.date));
    await tx.kioskClosing.delete({ where: { id } });
    if (c.entryId) await tx.entry.delete({ where: { id: c.entryId } });
    await audit(
      {
        action: "kiosk.closing.delete",
        entity: "KioskClosing",
        entityId: id,
        summary: `Fechamento excluído: ${c.operation.name} em ${formatDateBR(c.date)} (${formatMoney(closingTotal(c))})`,
        ip: meta.ip,
      },
      tx,
    );
  });
}
