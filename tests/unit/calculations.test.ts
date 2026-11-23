import { describe, expect, it } from "vitest";
import { assessCompleteness, buildIncomeStatement, entryState, installmentState } from "@/modules/finance/calculations";

describe("status", () => {
  const today = "2026-11-23";
  it("deriva vencido a partir da data", () => {
    expect(installmentState({ status: "PENDING", dueDate: "2026-11-22" }, today)).toBe("OVERDUE");
    expect(installmentState({ status: "PENDING", dueDate: today }, today)).toBe("PENDING");
    expect(installmentState({ status: "SETTLED", dueDate: "2026-01-01" }, today)).toBe("SETTLED");
  });
  it("status do lançamento", () => {
    const i = (status: "PENDING" | "SETTLED", dueDate: string) => ({ status, dueDate });
    expect(entryState({ canceledAt: new Date(), installments: [i("SETTLED", today)] }, today)).toBe("CANCELED");
    expect(entryState({ canceledAt: null, installments: [i("SETTLED", today), i("SETTLED", today)] }, today)).toBe("SETTLED");
    expect(entryState({ canceledAt: null, installments: [i("SETTLED", today), i("PENDING", "2026-12-01")] }, today)).toBe("PARTIAL");
    expect(entryState({ canceledAt: null, installments: [i("SETTLED", today), i("PENDING", "2026-11-01")] }, today)).toBe("OVERDUE");
    expect(entryState({ canceledAt: null, installments: [i("PENDING", "2026-12-01")] }, today)).toBe("PENDING");
  });
});

describe("DRE", () => {
  it("separa faturamento, receita líquida, custos e resultado", () => {
    const s = buildIncomeStatement(
      {
        SALES: 100_000_00,
        SALES_DEDUCTION: 1_000_00,
        FINANCIAL_FEES: 500_00,
        PRODUCTION_COST: 30_000_00,
        PAYROLL: 20_000_00,
        OPERATING_EXPENSE: 10_000_00,
        ADMINISTRATIVE_EXPENSE: 2_000_00,
        TAXES: 6_000_00,
        OTHER_EXPENSE: 500_00,
        OTHER_INCOME: 300_00,
        OWNER_WITHDRAWAL: 5_000_00,
        INVESTMENT: 7_000_00,
      },
      1_500_00,
    );
    expect(s.grossRevenue).toBe(100_000_00);
    expect(s.fees).toBe(2_000_00);
    expect(s.netRevenue).toBe(97_000_00);
    expect(s.grossProfit).toBe(67_000_00);
    expect(s.totalExpenses).toBe(38_500_00);
    expect(s.operatingResult).toBe(28_500_00);
    expect(s.result).toBe(28_800_00);
    expect(s.marginPct).toBe(28.8);
    // Retiradas e investimentos NÃO afetam o resultado
    expect(s.ownerWithdrawals).toBe(5_000_00);
    expect(s.investments).toBe(7_000_00);
  });

  it("sem faturamento a margem é nula", () => {
    expect(buildIncomeStatement({}, 0).marginPct).toBeNull();
  });
});

describe("completude do lucro", () => {
  const base = {
    months: ["2026-10", "2026-11"],
    closedMonths: new Set<string>(),
    monthsWithSales: new Set(["2026-11"]),
    monthsWithProductionCost: new Set<string>(),
    monthsWithPayroll: new Set(["2026-11"]),
    operationsWithoutSales: ["Quiosque 3"],
  };
  it("é estimado enquanto houver mês aberto, com as pendências descritas", () => {
    const r = assessCompleteness(base);
    expect(r.status).toBe("ESTIMATED");
    expect(r.issues.join("\n")).toContain("out/26 não fechado — nenhuma despesa de pessoal lançada");
    expect(r.issues.join("\n")).toContain("nov/26 não fechado — há vendas, mas nenhum custo de produção lançado");
    expect(r.issues.join("\n")).toContain("Quiosque 3");
  });
  it("é calculado quando todos os meses foram fechados", () => {
    const r = assessCompleteness({ ...base, closedMonths: new Set(base.months) });
    expect(r).toEqual({ status: "CALCULATED", issues: [] });
  });
});
