/**
 * Consultas de LEITURA e relatórios financeiros. Agregações feitas no PostgreSQL com SQL
 * parametrizado (Prisma.sql), sempre excluindo lançamentos cancelados.
 */
import { Prisma, type CategoryGroup, type EntryType, type PrismaClient } from "@prisma/client";
import { addDaysISO, dateOnly, monthsInRange, startOfMonthISO, endOfMonthISO, addMonthsISO, toISO } from "@/lib/dates";
import { assessCompleteness, buildIncomeStatement, type Completeness, type GroupTotals, type IncomeStatement } from "./calculations";

export interface RangeFilter {
  from: string; // AAAA-MM-DD
  to: string;
  operationId?: string | null;
}

const n = (v: bigint | number | null | undefined) => Number(v ?? 0);

function opFilter(operationId?: string | null) {
  return operationId ? Prisma.sql`AND e.operation_id = ${operationId}` : Prisma.empty;
}

// ---------------------------------------------------------------------------
// Resultado (competência)
// ---------------------------------------------------------------------------

async function groupTotals(db: PrismaClient, f: RangeFilter): Promise<{ groups: GroupTotals; fees: number }> {
  const rows = await db.$queryRaw<{ group: CategoryGroup; total: bigint }[]>`
    SELECT c."group" AS "group", SUM(e.amount)::bigint AS total
    FROM entries e JOIN categories c ON c.id = e.category_id
    WHERE e.canceled_at IS NULL
      AND e.competence_date BETWEEN ${f.from}::date AND ${f.to}::date
      ${opFilter(f.operationId)}
    GROUP BY c."group"`;
  const feeRows = await db.$queryRaw<{ fees: bigint | null }[]>`
    SELECT SUM(i.fee_amount)::bigint AS fees
    FROM installments i JOIN entries e ON e.id = i.entry_id
    WHERE e.canceled_at IS NULL AND e.type = 'INCOME'
      AND e.competence_date BETWEEN ${f.from}::date AND ${f.to}::date
      ${opFilter(f.operationId)}`;
  const groups: GroupTotals = {};
  for (const r of rows) groups[r.group] = n(r.total);
  return { groups, fees: n(feeRows[0]?.fees) };
}

export async function getIncomeStatement(db: PrismaClient, f: RangeFilter): Promise<IncomeStatement> {
  const { groups, fees } = await groupTotals(db, f);
  return buildIncomeStatement(groups, fees);
}

/** Resultado de cada operação no período (para comparação entre quiosques/online/central). */
export async function getStatementsByOperation(db: PrismaClient, f: Omit<RangeFilter, "operationId">) {
  const ops = await db.operation.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
  const rows = await db.$queryRaw<{ operation_id: string; group: CategoryGroup; total: bigint }[]>`
    SELECT e.operation_id, c."group" AS "group", SUM(e.amount)::bigint AS total
    FROM entries e JOIN categories c ON c.id = e.category_id
    WHERE e.canceled_at IS NULL AND e.competence_date BETWEEN ${f.from}::date AND ${f.to}::date
    GROUP BY e.operation_id, c."group"`;
  const feeRows = await db.$queryRaw<{ operation_id: string; fees: bigint }[]>`
    SELECT e.operation_id, SUM(i.fee_amount)::bigint AS fees
    FROM installments i JOIN entries e ON e.id = i.entry_id
    WHERE e.canceled_at IS NULL AND e.type = 'INCOME' AND e.competence_date BETWEEN ${f.from}::date AND ${f.to}::date
    GROUP BY e.operation_id`;
  return ops
    .map((op) => {
      const groups: GroupTotals = {};
      for (const r of rows) if (r.operation_id === op.id) groups[r.group] = n(r.total);
      const fees = n(feeRows.find((r) => r.operation_id === op.id)?.fees);
      const hasData = Object.keys(groups).length > 0;
      return { operation: op, statement: buildIncomeStatement(groups, fees), hasData };
    })
    .filter((r) => r.operation.active || r.hasData);
}

/** Avalia se o resultado do período pode ser apresentado como calculado ou apenas estimado. */
export async function getCompleteness(db: PrismaClient, f: RangeFilter): Promise<Completeness> {
  const months = monthsInRange(f.from, f.to);
  const closed = await db.periodClose.findMany({ where: { month: { in: months } } });
  // Indícios por mês inteiro (não só pelo recorte), porque custos e folha costumam ser mensais.
  const monthFrom = startOfMonthISO(f.from);
  const monthTo = endOfMonthISO(f.to);
  const rows = await db.$queryRaw<{ month: string; group: CategoryGroup }[]>`
    SELECT DISTINCT to_char(e.competence_date, 'YYYY-MM') AS month, c."group" AS "group"
    FROM entries e JOIN categories c ON c.id = e.category_id
    WHERE e.canceled_at IS NULL AND e.competence_date BETWEEN ${monthFrom}::date AND ${monthTo}::date
      AND c."group" IN ('SALES', 'PRODUCTION_COST', 'PAYROLL')
      ${opFilter(f.operationId)}`;
  const monthsWith = (g: CategoryGroup) => new Set(rows.filter((r) => r.group === g).map((r) => r.month));

  let operationsWithoutSales: string[] = [];
  const salesOps = await db.$queryRaw<{ operation_id: string }[]>`
    SELECT DISTINCT e.operation_id FROM entries e JOIN categories c ON c.id = e.category_id
    WHERE e.canceled_at IS NULL AND c."group" = 'SALES'
      AND e.competence_date BETWEEN ${f.from}::date AND ${f.to}::date`;
  const withSales = new Set(salesOps.map((r) => r.operation_id));
  const ops = await db.operation.findMany({
    where: { active: true, type: { in: ["KIOSK", "ONLINE"] }, ...(f.operationId ? { id: f.operationId } : {}) },
    orderBy: { sortOrder: "asc" },
  });
  operationsWithoutSales = ops.filter((o) => !withSales.has(o.id)).map((o) => o.name);

  return assessCompleteness({
    months,
    closedMonths: new Set(closed.map((c) => c.month)),
    monthsWithSales: monthsWith("SALES"),
    monthsWithProductionCost: monthsWith("PRODUCTION_COST"),
    monthsWithPayroll: monthsWith("PAYROLL"),
    operationsWithoutSales,
  });
}

// ---------------------------------------------------------------------------
// Caixa
// ---------------------------------------------------------------------------

/** Recebimentos (líquidos de taxa) e pagamentos efetivados no período. */
export async function getCashSummary(db: PrismaClient, f: RangeFilter) {
  const rows = await db.$queryRaw<{ type: EntryType; net: bigint; fees: bigint; gross: bigint }[]>`
    SELECT e.type, SUM(i.amount - i.fee_amount)::bigint AS net, SUM(i.fee_amount)::bigint AS fees, SUM(i.amount)::bigint AS gross
    FROM installments i JOIN entries e ON e.id = i.entry_id
    WHERE e.canceled_at IS NULL AND i.status = 'SETTLED'
      AND i.settled_at BETWEEN ${f.from}::date AND ${f.to}::date
      ${opFilter(f.operationId)}
    GROUP BY e.type`;
  const inc = rows.find((r) => r.type === "INCOME");
  const exp = rows.find((r) => r.type === "EXPENSE");
  const received = n(inc?.net);
  const paid = n(exp?.gross);
  return { received, receivedGross: n(inc?.gross), receivedFees: n(inc?.fees), paid, net: received - paid };
}

export type Granularity = "day" | "month";

export async function getCashFlowSeries(db: PrismaClient, f: RangeFilter, granularity: Granularity) {
  const fmt = granularity === "day" ? "YYYY-MM-DD" : "YYYY-MM";
  const rows = await db.$queryRaw<{ key: string; type: EntryType; total: bigint }[]>`
    SELECT to_char(i.settled_at, ${fmt}) AS key, e.type,
           SUM(CASE WHEN e.type = 'INCOME' THEN i.amount - i.fee_amount ELSE i.amount END)::bigint AS total
    FROM installments i JOIN entries e ON e.id = i.entry_id
    WHERE e.canceled_at IS NULL AND i.status = 'SETTLED'
      AND i.settled_at BETWEEN ${f.from}::date AND ${f.to}::date
      ${opFilter(f.operationId)}
    GROUP BY 1, 2`;
  const keys =
    granularity === "day"
      ? Array.from({ length: Math.round((dateOnly(f.to).getTime() - dateOnly(f.from).getTime()) / 86_400_000) + 1 }, (_, i) => addDaysISO(f.from, i))
      : monthsInRange(f.from, f.to);
  let running = 0;
  return keys.map((key) => {
    const inflow = n(rows.find((r) => r.key === key && r.type === "INCOME")?.total);
    const outflow = n(rows.find((r) => r.key === key && r.type === "EXPENSE")?.total);
    running += inflow - outflow;
    return { key, inflow, outflow, net: inflow - outflow, accumulated: running };
  });
}

/** Faturamento (vendas por competência) por dia. */
export async function getDailyRevenue(db: PrismaClient, f: RangeFilter) {
  const rows = await db.$queryRaw<{ day: string; total: bigint }[]>`
    SELECT to_char(e.competence_date, 'YYYY-MM-DD') AS day, SUM(e.amount)::bigint AS total
    FROM entries e JOIN categories c ON c.id = e.category_id
    WHERE e.canceled_at IS NULL AND c."group" = 'SALES'
      AND e.competence_date BETWEEN ${f.from}::date AND ${f.to}::date
      ${opFilter(f.operationId)}
    GROUP BY 1`;
  const map = new Map(rows.map((r) => [r.day, n(r.total)]));
  const out: { day: string; revenue: number }[] = [];
  for (let d = f.from; d <= f.to; d = addDaysISO(d, 1)) out.push({ day: d, revenue: map.get(d) ?? 0 });
  return out;
}

export async function getSalesByPaymentMethod(db: PrismaClient, f: RangeFilter) {
  const rows = await db.$queryRaw<{ method: string | null; total: bigint }[]>`
    SELECT i.payment_method::text AS method, SUM(i.amount)::bigint AS total
    FROM installments i JOIN entries e ON e.id = i.entry_id JOIN categories c ON c.id = e.category_id
    WHERE e.canceled_at IS NULL AND c."group" = 'SALES'
      AND e.competence_date BETWEEN ${f.from}::date AND ${f.to}::date
      ${opFilter(f.operationId)}
    GROUP BY 1 ORDER BY 2 DESC`;
  return rows.map((r) => ({ method: r.method, total: n(r.total) }));
}

export async function getTotalsByCategory(db: PrismaClient, f: RangeFilter, type: EntryType) {
  const rows = await db.$queryRaw<{ id: string; name: string; group: CategoryGroup; total: bigint; count: bigint }[]>`
    SELECT c.id, c.name, c."group" AS "group", SUM(e.amount)::bigint AS total, COUNT(*)::bigint AS count
    FROM entries e JOIN categories c ON c.id = e.category_id
    WHERE e.canceled_at IS NULL AND e.type = ${type}::"EntryType"
      AND e.competence_date BETWEEN ${f.from}::date AND ${f.to}::date
      ${opFilter(f.operationId)}
    GROUP BY c.id, c.name, c."group" ORDER BY total DESC`;
  return rows.map((r) => ({ id: r.id, name: r.name, group: r.group, total: n(r.total), count: n(r.count) }));
}

/** Comparativo dos últimos N meses (terminando no mês de `endMonthISO`). */
export async function getMonthlyComparison(db: PrismaClient, endISO: string, monthsBack: number, operationId?: string | null) {
  const from = addMonthsISO(startOfMonthISO(endISO), -(monthsBack - 1));
  const to = endOfMonthISO(endISO);
  const rows = await db.$queryRaw<{ month: string; group: CategoryGroup; total: bigint }[]>`
    SELECT to_char(e.competence_date, 'YYYY-MM') AS month, c."group" AS "group", SUM(e.amount)::bigint AS total
    FROM entries e JOIN categories c ON c.id = e.category_id
    WHERE e.canceled_at IS NULL AND e.competence_date BETWEEN ${from}::date AND ${to}::date
      ${opFilter(operationId)}
    GROUP BY 1, 2`;
  const feeRows = await db.$queryRaw<{ month: string; fees: bigint }[]>`
    SELECT to_char(e.competence_date, 'YYYY-MM') AS month, SUM(i.fee_amount)::bigint AS fees
    FROM installments i JOIN entries e ON e.id = i.entry_id
    WHERE e.canceled_at IS NULL AND e.type = 'INCOME' AND e.competence_date BETWEEN ${from}::date AND ${to}::date
      ${opFilter(operationId)}
    GROUP BY 1`;
  const closed = new Set((await db.periodClose.findMany()).map((c) => c.month));
  return monthsInRange(from, to).map((month) => {
    const groups: GroupTotals = {};
    for (const r of rows) if (r.month === month) groups[r.group] = n(r.total);
    const statement = buildIncomeStatement(groups, n(feeRows.find((r) => r.month === month)?.fees));
    return { month, statement, closed: closed.has(month) };
  });
}

// ---------------------------------------------------------------------------
// Contas a pagar / receber e saldos
// ---------------------------------------------------------------------------

export async function getOpenTotals(db: PrismaClient, today: string, operationId?: string | null) {
  const in7 = addDaysISO(today, 7);
  const rows = await db.$queryRaw<{ type: EntryType; pending: bigint; overdue: bigint; next7: bigint; overdue_count: bigint; count: bigint }[]>`
    SELECT e.type,
      SUM(i.amount)::bigint AS pending,
      SUM(CASE WHEN i.due_date < ${today}::date THEN i.amount ELSE 0 END)::bigint AS overdue,
      SUM(CASE WHEN i.due_date BETWEEN ${today}::date AND ${in7}::date THEN i.amount ELSE 0 END)::bigint AS next7,
      COUNT(*) FILTER (WHERE i.due_date < ${today}::date)::bigint AS overdue_count,
      COUNT(*)::bigint AS count
    FROM installments i JOIN entries e ON e.id = i.entry_id
    WHERE e.canceled_at IS NULL AND i.status = 'PENDING'
      ${opFilter(operationId)}
    GROUP BY e.type`;
  const pick = (t: EntryType) => {
    const r = rows.find((x) => x.type === t);
    return { pending: n(r?.pending), overdue: n(r?.overdue), next7: n(r?.next7), overdueCount: n(r?.overdue_count), count: n(r?.count) };
  };
  return { receivable: pick("INCOME"), payable: pick("EXPENSE") };
}

export async function listOpenInstallments(db: PrismaClient, type: EntryType, operationId?: string | null) {
  return db.installment.findMany({
    where: { status: "PENDING", entry: { type, canceledAt: null, ...(operationId ? { operationId } : {}) } },
    include: {
      entry: { include: { category: true, operation: true, supplier: true } },
      account: true,
    },
    orderBy: [{ dueDate: "asc" }, { amount: "desc" }],
    take: 500,
  });
}

export async function listSettledInstallments(db: PrismaClient, type: EntryType, f: RangeFilter) {
  return db.installment.findMany({
    where: {
      status: "SETTLED",
      settledAt: { gte: dateOnly(f.from), lte: dateOnly(f.to) },
      entry: { type, canceledAt: null, ...(f.operationId ? { operationId: f.operationId } : {}) },
    },
    include: { entry: { include: { category: true, operation: true, supplier: true } }, account: true },
    orderBy: [{ settledAt: "desc" }],
    take: 500,
  });
}

/** Saldo de cada conta em uma data: saldo inicial + recebimentos líquidos − pagamentos ± transferências. */
export async function getAccountBalances(db: PrismaClient, asOf: string) {
  const accounts = await db.financialAccount.findMany({ include: { operation: true }, orderBy: [{ active: "desc" }, { name: "asc" }] });
  const mov = await db.$queryRaw<{ account_id: string; total: bigint }[]>`
    SELECT i.account_id,
      SUM(CASE WHEN e.type = 'INCOME' THEN i.amount - i.fee_amount ELSE -i.amount END)::bigint AS total
    FROM installments i JOIN entries e ON e.id = i.entry_id
    WHERE e.canceled_at IS NULL AND i.status = 'SETTLED' AND i.account_id IS NOT NULL AND i.settled_at <= ${asOf}::date
    GROUP BY i.account_id`;
  const tin = await db.$queryRaw<{ account_id: string; total: bigint }[]>`
    SELECT to_account_id AS account_id, SUM(amount)::bigint AS total FROM transfers WHERE date <= ${asOf}::date GROUP BY 1`;
  const tout = await db.$queryRaw<{ account_id: string; total: bigint }[]>`
    SELECT from_account_id AS account_id, SUM(amount)::bigint AS total FROM transfers WHERE date <= ${asOf}::date GROUP BY 1`;
  const unassigned = await db.$queryRaw<{ total: bigint | null; count: bigint }[]>`
    SELECT SUM(CASE WHEN e.type = 'INCOME' THEN i.amount - i.fee_amount ELSE -i.amount END)::bigint AS total, COUNT(*)::bigint AS count
    FROM installments i JOIN entries e ON e.id = i.entry_id
    WHERE e.canceled_at IS NULL AND i.status = 'SETTLED' AND i.account_id IS NULL AND i.settled_at <= ${asOf}::date`;
  const get = (list: { account_id: string; total: bigint }[], id: string) => n(list.find((r) => r.account_id === id)?.total);
  const items = accounts.map((a) => {
    const started = toISO(a.openingDate) <= asOf;
    const balance = started ? a.openingBalance + get(mov, a.id) + get(tin, a.id) - get(tout, a.id) : 0;
    return { account: a, balance, started };
  });
  return {
    items,
    total: items.reduce((s, i) => s + i.balance, 0),
    unassigned: { total: n(unassigned[0]?.total), count: n(unassigned[0]?.count) },
  };
}

// ---------------------------------------------------------------------------
// Listagens
// ---------------------------------------------------------------------------

export interface EntryListFilter extends RangeFilter {
  type?: EntryType | null;
  categoryId?: string | null;
  status?: "pending" | "overdue" | "settled" | "canceled" | null;
  q?: string | null;
  page?: number;
}

export const ENTRIES_PAGE_SIZE = 30;

export async function listEntries(db: PrismaClient, f: EntryListFilter, today: string) {
  const where: Prisma.EntryWhereInput = {
    competenceDate: { gte: dateOnly(f.from), lte: dateOnly(f.to) },
    ...(f.type ? { type: f.type } : {}),
    ...(f.operationId ? { operationId: f.operationId } : {}),
    ...(f.categoryId ? { categoryId: f.categoryId } : {}),
    ...(f.q ? { OR: [{ description: { contains: f.q, mode: "insensitive" } }, { notes: { contains: f.q, mode: "insensitive" } }] } : {}),
  };
  if (f.status === "canceled") where.canceledAt = { not: null };
  else {
    where.canceledAt = null;
    if (f.status === "pending") where.installments = { some: { status: "PENDING" } };
    if (f.status === "overdue") where.installments = { some: { status: "PENDING", dueDate: { lt: dateOnly(today) } } };
    if (f.status === "settled") where.installments = { every: { status: "SETTLED" } };
  }
  const page = Math.max(1, f.page ?? 1);
  const [items, total, sums] = await Promise.all([
    db.entry.findMany({
      where,
      include: { category: true, operation: true, supplier: true, installments: { orderBy: { number: "asc" } }, _count: { select: { attachments: true } } },
      orderBy: [{ competenceDate: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * ENTRIES_PAGE_SIZE,
      take: ENTRIES_PAGE_SIZE,
    }),
    db.entry.count({ where }),
    db.entry.groupBy({ by: ["type"], where: { ...where, canceledAt: f.status === "canceled" ? where.canceledAt : null }, _sum: { amount: true } }),
  ]);
  return {
    items,
    total,
    page,
    pages: Math.max(1, Math.ceil(total / ENTRIES_PAGE_SIZE)),
    sumIncome: sums.find((s) => s.type === "INCOME")?._sum.amount ?? 0,
    sumExpense: sums.find((s) => s.type === "EXPENSE")?._sum.amount ?? 0,
  };
}

export async function getEntryDetail(db: PrismaClient, id: string) {
  return db.entry.findUnique({
    where: { id },
    include: {
      category: true,
      operation: true,
      supplier: true,
      refundOf: true,
      refunds: { include: { installments: true } },
      installments: { include: { account: true }, orderBy: { number: "asc" } },
      attachments: { orderBy: { createdAt: "asc" } },
    },
  });
}

export async function getEntryHistory(db: PrismaClient, id: string) {
  return db.auditLog.findMany({ where: { entity: "Entry", entityId: id }, orderBy: { createdAt: "desc" }, take: 50 });
}

export async function listTransfers(db: PrismaClient, f: { from: string; to: string }) {
  return db.transfer.findMany({
    where: { date: { gte: dateOnly(f.from), lte: dateOnly(f.to) } },
    include: { fromAccount: true, toAccount: true },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });
}

/** Listas para os formulários (inclui inativos só quando já usados pelo registro em edição). */
export async function getFormOptions(db: PrismaClient, includeIds: string[] = []) {
  const activeOr = { OR: [{ active: true }, { id: { in: includeIds } }] };
  const [categories, operations, accounts, suppliers] = await Promise.all([
    db.category.findMany({ where: activeOr, orderBy: [{ type: "asc" }, { sortOrder: "asc" }, { name: "asc" }] }),
    db.operation.findMany({ where: activeOr, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    db.financialAccount.findMany({ where: activeOr, orderBy: { name: "asc" } }),
    db.supplier.findMany({ where: activeOr, orderBy: { name: "asc" } }),
  ]);
  return { categories, operations, accounts, suppliers };
}
