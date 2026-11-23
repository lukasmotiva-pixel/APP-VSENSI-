/** Cadastros de configuração: operações, contas financeiras, categorias e fornecedores. */
import { Prisma, type PrismaClient } from "@prisma/client";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { dateOnly } from "@/lib/dates";
import { DomainError } from "@/lib/errors";
import { MAX_CENTS } from "@/lib/money";
import { groupMatchesType } from "@/modules/finance/calculations";
import { isoDate } from "@/modules/finance/schemas";

interface Meta {
  ip: string | null;
}

const text = (max: number) => z.string().trim().max(max).nullish().transform((v) => v || null);
const name = z.string().trim().min(2, "Informe o nome.").max(80, "Máximo de 80 caracteres.");

function uniqueGuard(err: unknown, message: string): never {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") throw new DomainError(message, "name");
  throw err;
}

// ---------------------------------------------------------------------------
// Operações (quiosques, online, central)
// ---------------------------------------------------------------------------

export const operationSchema = z.object({
  name,
  type: z.enum(["KIOSK", "ONLINE", "CENTRAL"]),
  address: text(200),
  notes: text(1000),
  active: z.boolean(),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
});

export async function saveOperation(db: PrismaClient, id: string | null, raw: unknown, meta: Meta) {
  const data = operationSchema.parse(raw);
  try {
    const op = id ? await db.operation.update({ where: { id }, data }) : await db.operation.create({ data });
    await audit({ action: id ? "settings.operation.update" : "settings.operation.create", entity: "Operation", entityId: op.id, summary: `Operação ${id ? "atualizada" : "criada"}: ${op.name}`, ip: meta.ip }, db);
    return op;
  } catch (e) {
    uniqueGuard(e, "Já existe uma operação com este nome.");
  }
}

// ---------------------------------------------------------------------------
// Contas financeiras
// ---------------------------------------------------------------------------

export const accountSchema = z.object({
  name,
  type: z.enum(["CASH", "BANK", "PAYMENT_PROVIDER", "OTHER"]),
  operationId: z.string().nullish().transform((v) => v || null),
  openingBalance: z.number().int().min(-MAX_CENTS).max(MAX_CENTS),
  openingDate: isoDate,
  notes: text(1000),
  active: z.boolean(),
});

export async function saveAccount(db: PrismaClient, id: string | null, raw: unknown, meta: Meta) {
  const input = accountSchema.parse(raw);
  const data = { ...input, openingDate: dateOnly(input.openingDate) };
  if (id) {
    // Não permitir mover a data inicial para depois de movimentações já existentes.
    const first = await db.installment.findFirst({ where: { accountId: id, status: "SETTLED" }, orderBy: { settledAt: "asc" } });
    const firstT = await db.transfer.findFirst({ where: { OR: [{ fromAccountId: id }, { toAccountId: id }] }, orderBy: { date: "asc" } });
    const earliest = [first?.settledAt, firstT?.date].filter(Boolean).sort((a, b) => a!.getTime() - b!.getTime())[0];
    if (earliest && data.openingDate > earliest)
      throw new DomainError("A data do saldo inicial não pode ser posterior às movimentações já registradas nesta conta.", "openingDate");
  }
  try {
    const acc = id ? await db.financialAccount.update({ where: { id }, data }) : await db.financialAccount.create({ data });
    await audit({ action: id ? "settings.account.update" : "settings.account.create", entity: "FinancialAccount", entityId: acc.id, summary: `Conta ${id ? "atualizada" : "criada"}: ${acc.name}`, metadata: { openingBalance: acc.openingBalance, openingDate: input.openingDate }, ip: meta.ip }, db);
    return acc;
  } catch (e) {
    uniqueGuard(e, "Já existe uma conta com este nome.");
  }
}

// ---------------------------------------------------------------------------
// Categorias
// ---------------------------------------------------------------------------

export const categorySchema = z
  .object({
    name,
    type: z.enum(["INCOME", "EXPENSE"]),
    group: z.enum([
      "SALES", "OTHER_INCOME", "SALES_DEDUCTION", "FINANCIAL_FEES", "PRODUCTION_COST", "PAYROLL",
      "OPERATING_EXPENSE", "ADMINISTRATIVE_EXPENSE", "TAXES", "OTHER_EXPENSE", "OWNER_WITHDRAWAL", "INVESTMENT",
    ]),
    active: z.boolean(),
    sortOrder: z.coerce.number().int().min(0).max(999).default(0),
  })
  .refine((c) => groupMatchesType(c.group, c.type), { path: ["group"], message: "O grupo não corresponde ao tipo (entrada/saída)." });

export async function saveCategory(db: PrismaClient, id: string | null, raw: unknown, meta: Meta) {
  const data = categorySchema.parse(raw);
  if (id) {
    const current = await db.category.findUniqueOrThrow({ where: { id } });
    if (current.type !== data.type) {
      const used = await db.entry.count({ where: { categoryId: id } });
      if (used > 0) throw new DomainError("Esta categoria já tem lançamentos; o tipo não pode ser alterado.", "type");
    }
  }
  try {
    const cat = id ? await db.category.update({ where: { id }, data }) : await db.category.create({ data });
    await audit({ action: id ? "settings.category.update" : "settings.category.create", entity: "Category", entityId: cat.id, summary: `Categoria ${id ? "atualizada" : "criada"}: ${cat.name}`, ip: meta.ip }, db);
    return cat;
  } catch (e) {
    uniqueGuard(e, "Já existe uma categoria com este nome para este tipo.");
  }
}

// ---------------------------------------------------------------------------
// Fornecedores
// ---------------------------------------------------------------------------

export const supplierSchema = z.object({
  name,
  document: text(30),
  phone: text(30),
  email: z.union([z.literal(""), z.email("E-mail inválido.")]).nullish().transform((v) => v || null),
  notes: text(1000),
  active: z.boolean(),
});

export async function saveSupplier(db: PrismaClient, id: string | null, raw: unknown, meta: Meta) {
  const data = supplierSchema.parse(raw);
  try {
    const s = id ? await db.supplier.update({ where: { id }, data }) : await db.supplier.create({ data });
    await audit({ action: id ? "settings.supplier.update" : "settings.supplier.create", entity: "Supplier", entityId: s.id, summary: `Fornecedor ${id ? "atualizado" : "criado"}: ${s.name}`, ip: meta.ip }, db);
    return s;
  } catch (e) {
    uniqueGuard(e, "Já existe um fornecedor com este nome.");
  }
}
