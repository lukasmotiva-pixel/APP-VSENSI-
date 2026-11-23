/**
 * Cálculos financeiros PUROS (sem banco). Ver docs/05-regras-financeiras.md.
 * Todos os valores em centavos.
 */
import type { CategoryGroup } from "@prisma/client";
import { formatMonthShort } from "@/lib/dates";

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

export type InstallmentState = "SETTLED" | "PENDING" | "OVERDUE";
export type EntryState = "CANCELED" | "SETTLED" | "PARTIAL" | "OVERDUE" | "PENDING";

export function installmentState(i: { status: "PENDING" | "SETTLED"; dueDate: string }, today: string): InstallmentState {
  if (i.status === "SETTLED") return "SETTLED";
  return i.dueDate < today ? "OVERDUE" : "PENDING";
}

export function entryState(
  e: { canceledAt: Date | null; installments: { status: "PENDING" | "SETTLED"; dueDate: string }[] },
  today: string,
): EntryState {
  if (e.canceledAt) return "CANCELED";
  const states = e.installments.map((i) => installmentState(i, today));
  if (states.length > 0 && states.every((s) => s === "SETTLED")) return "SETTLED";
  if (states.includes("OVERDUE")) return "OVERDUE";
  if (states.includes("SETTLED")) return "PARTIAL";
  return "PENDING";
}

// ---------------------------------------------------------------------------
// Grupos de categoria
// ---------------------------------------------------------------------------

export const INCOME_GROUPS: CategoryGroup[] = ["SALES", "OTHER_INCOME"];
export const EXPENSE_GROUPS: CategoryGroup[] = [
  "PRODUCTION_COST",
  "PAYROLL",
  "OPERATING_EXPENSE",
  "ADMINISTRATIVE_EXPENSE",
  "TAXES",
  "FINANCIAL_FEES",
  "SALES_DEDUCTION",
  "OTHER_EXPENSE",
  "OWNER_WITHDRAWAL",
  "INVESTMENT",
];

export const GROUP_LABELS: Record<CategoryGroup, string> = {
  SALES: "Vendas",
  OTHER_INCOME: "Outras receitas",
  SALES_DEDUCTION: "Deduções de vendas (estornos/devoluções)",
  FINANCIAL_FEES: "Taxas financeiras",
  PRODUCTION_COST: "Custos de produção",
  PAYROLL: "Pessoal",
  OPERATING_EXPENSE: "Despesas operacionais",
  ADMINISTRATIVE_EXPENSE: "Despesas administrativas",
  TAXES: "Impostos",
  OTHER_EXPENSE: "Outras despesas",
  OWNER_WITHDRAWAL: "Retiradas do proprietário (fora do resultado)",
  INVESTMENT: "Investimentos (fora do resultado)",
};

export function groupMatchesType(group: CategoryGroup, type: "INCOME" | "EXPENSE"): boolean {
  return type === "INCOME" ? INCOME_GROUPS.includes(group) : EXPENSE_GROUPS.includes(group);
}

// ---------------------------------------------------------------------------
// Demonstrativo de resultado (DRE gerencial, regime de competência)
// ---------------------------------------------------------------------------

export type GroupTotals = Partial<Record<CategoryGroup, number>>;

export interface IncomeStatement {
  grossRevenue: number;
  deductions: number;
  fees: number;
  netRevenue: number;
  productionCost: number;
  grossProfit: number;
  payroll: number;
  operating: number;
  administrative: number;
  taxes: number;
  otherExpenses: number;
  totalExpenses: number;
  operatingResult: number;
  otherIncome: number;
  result: number;
  /** Resultado / faturamento, em % (null sem faturamento). */
  marginPct: number | null;
  ownerWithdrawals: number;
  investments: number;
}

/**
 * @param groups soma dos lançamentos não cancelados por grupo, no período (competência)
 * @param installmentFees soma das taxas informadas nas parcelas de entrada desses lançamentos
 */
export function buildIncomeStatement(groups: GroupTotals, installmentFees: number): IncomeStatement {
  const g = (k: CategoryGroup) => groups[k] ?? 0;
  const grossRevenue = g("SALES");
  const deductions = g("SALES_DEDUCTION");
  const fees = g("FINANCIAL_FEES") + installmentFees;
  const netRevenue = grossRevenue - deductions - fees;
  const productionCost = g("PRODUCTION_COST");
  const grossProfit = netRevenue - productionCost;
  const payroll = g("PAYROLL");
  const operating = g("OPERATING_EXPENSE");
  const administrative = g("ADMINISTRATIVE_EXPENSE");
  const taxes = g("TAXES");
  const otherExpenses = g("OTHER_EXPENSE");
  const totalExpenses = payroll + operating + administrative + taxes + otherExpenses;
  const operatingResult = grossProfit - totalExpenses;
  const otherIncome = g("OTHER_INCOME");
  const result = operatingResult + otherIncome;
  return {
    grossRevenue,
    deductions,
    fees,
    netRevenue,
    productionCost,
    grossProfit,
    payroll,
    operating,
    administrative,
    taxes,
    otherExpenses,
    totalExpenses,
    operatingResult,
    otherIncome,
    result,
    marginPct: grossRevenue ? Math.round((result / grossRevenue) * 1000) / 10 : null,
    ownerWithdrawals: g("OWNER_WITHDRAWAL"),
    investments: g("INVESTMENT"),
  };
}

// ---------------------------------------------------------------------------
// Lucro calculado × estimado
// ---------------------------------------------------------------------------

export interface CompletenessInput {
  months: string[]; // meses (AAAA-MM) tocados pelo período
  closedMonths: Set<string>;
  monthsWithSales: Set<string>;
  monthsWithProductionCost: Set<string>;
  monthsWithPayroll: Set<string>;
  /** Operações ativas (quiosques/online) sem nenhuma venda no período. */
  operationsWithoutSales: string[];
}

export interface Completeness {
  status: "CALCULATED" | "ESTIMATED";
  /** Pendências que impedem considerar o resultado definitivo. */
  issues: string[];
}

export function assessCompleteness(input: CompletenessInput): Completeness {
  const issues: string[] = [];
  const open = input.months.filter((m) => !input.closedMonths.has(m));

  for (const m of open) {
    const label = formatMonthShort(m);
    const hints: string[] = [];
    if (input.monthsWithSales.has(m) && !input.monthsWithProductionCost.has(m))
      hints.push("há vendas, mas nenhum custo de produção lançado");
    if (!input.monthsWithPayroll.has(m)) hints.push("nenhuma despesa de pessoal lançada");
    issues.push(`Mês ${label} não fechado${hints.length ? ` — ${hints.join("; ")}` : ""}.`);
  }
  if (open.length > 0) {
    for (const name of input.operationsWithoutSales) issues.push(`${name}: nenhuma venda lançada no período.`);
  }

  return { status: open.length === 0 ? "CALCULATED" : "ESTIMATED", issues };
}

// ---------------------------------------------------------------------------
// Parcelamento
// ---------------------------------------------------------------------------

export function sumInstallments(items: { amount: number }[]): number {
  return items.reduce((acc, i) => acc + i.amount, 0);
}
