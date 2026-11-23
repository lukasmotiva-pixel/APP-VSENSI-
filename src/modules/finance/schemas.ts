import { z } from "zod";
import { isValidISODate } from "@/lib/dates";
import { MAX_CENTS } from "@/lib/money";

export const PAYMENT_METHODS = ["PIX", "CASH", "DEBIT_CARD", "CREDIT_CARD", "BOLETO", "BANK_TRANSFER", "OTHER"] as const;

export const PAYMENT_METHOD_LABELS: Record<(typeof PAYMENT_METHODS)[number], string> = {
  PIX: "Pix",
  CASH: "Dinheiro",
  DEBIT_CARD: "Cartão de débito",
  CREDIT_CARD: "Cartão de crédito",
  BOLETO: "Boleto",
  BANK_TRANSFER: "Transferência/TED",
  OTHER: "Outro",
};

export const isoDate = z.string().refine(isValidISODate, "Data inválida.");
/** Data opcional: vazio ("") vira null — campos de data não preenchidos chegam assim dos formulários. */
export const optionalIsoDate = z.preprocess((v) => (v === "" || v === undefined ? null : v), isoDate.nullable());
const cents = z.number().int("Valor inválido.").max(MAX_CENTS, "Valor alto demais.");
const optionalId = z.string().min(1).max(40).nullish().transform((v) => v || null);
const optionalText = (max: number) =>
  z.string().trim().max(max, `Máximo de ${max} caracteres.`).nullish().transform((v) => v || null);

export const installmentInputSchema = z
  .object({
    id: z.string().max(40).optional(),
    dueDate: isoDate,
    amount: cents.positive("O valor da parcela deve ser maior que zero."),
    feeAmount: cents.min(0, "A taxa não pode ser negativa.").default(0),
    paymentMethod: z.enum(PAYMENT_METHODS).nullish().transform((v) => v ?? null),
    accountId: optionalId,
    settled: z.boolean(),
    settledAt: optionalIsoDate,
  })
  .superRefine((i, ctx) => {
    if (i.feeAmount > i.amount) ctx.addIssue({ code: "custom", path: ["feeAmount"], message: "A taxa não pode ser maior que a parcela." });
    if (i.settled && !i.settledAt) ctx.addIssue({ code: "custom", path: ["settledAt"], message: "Informe a data do pagamento/recebimento." });
  });

export type InstallmentInput = z.infer<typeof installmentInputSchema>;

export const entryInputSchema = z
  .object({
    type: z.enum(["INCOME", "EXPENSE"]),
    description: z.string().trim().min(2, "Descreva o lançamento.").max(200, "Máximo de 200 caracteres."),
    competenceDate: isoDate,
    categoryId: z.string().min(1, "Escolha a categoria."),
    operationId: z.string().min(1, "Escolha a operação."),
    supplierId: optionalId,
    refundOfId: optionalId,
    notes: optionalText(2000),
    installments: z.array(installmentInputSchema).min(1, "Informe ao menos uma parcela.").max(60, "Máximo de 60 parcelas."),
  })
  .superRefine((e, ctx) => {
    if (e.type === "EXPENSE" && e.installments.some((i) => i.feeAmount > 0))
      ctx.addIssue({ code: "custom", path: ["installments"], message: "Taxa de cartão só se aplica a entradas. Lance juros/tarifas como despesa." });
    const total = e.installments.reduce((a, i) => a + i.amount, 0);
    if (total > MAX_CENTS) ctx.addIssue({ code: "custom", path: ["installments"], message: "Valor total alto demais." });
  });

export type EntryInput = z.infer<typeof entryInputSchema>;

export const settleInputSchema = z.object({
  installmentId: z.string().min(1),
  settledAt: isoDate,
  accountId: optionalId,
  paymentMethod: z.enum(PAYMENT_METHODS).nullish().transform((v) => v ?? null),
  feeAmount: cents.min(0).optional(),
});

export const cancelInputSchema = z.object({
  entryId: z.string().min(1),
  reason: z.string().trim().min(3, "Informe o motivo do cancelamento.").max(500),
});

export const transferInputSchema = z
  .object({
    date: isoDate,
    amount: cents.positive("Informe o valor."),
    fromAccountId: z.string().min(1, "Escolha a conta de origem."),
    toAccountId: z.string().min(1, "Escolha a conta de destino."),
    description: z.string().trim().min(2, "Descreva a transferência.").max(200),
    notes: optionalText(1000),
  })
  .refine((t) => t.fromAccountId !== t.toAccountId, { path: ["toAccountId"], message: "Origem e destino devem ser diferentes." });

export const monthKeySchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Mês inválido.");
