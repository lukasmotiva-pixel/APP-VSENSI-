import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { addDaysISO, startOfMonthISO, endOfMonthISO, todayISO, monthKey, addMonthsISO } from "@/lib/dates";
import { DomainError } from "@/lib/errors";
import {
  cancelEntry, closeMonth, createEntry, createTransfer, deleteEntry, reopenMonth, restoreEntry,
  settleInstallment, unsettleInstallment, updateEntry,
} from "@/modules/finance/service";
import {
  getAccountBalances, getCashFlowSeries, getCashSummary, getCompleteness, getIncomeStatement,
  getOpenTotals, getStatementsByOperation, listEntries,
} from "@/modules/finance/queries";
import { saveAccount } from "@/modules/settings/service";
import { category, db, meta, operation, resetDb } from "./helpers";

const today = todayISO();
const monthFrom = startOfMonthISO(today);
const monthTo = endOfMonthISO(today);

async function base() {
  const vendas = await category("Vendas");
  const mp = await category("Matérias-primas");
  const aluguel = await category("Aluguel");
  const estorno = await category("Estornos e devoluções");
  const q1 = await operation("Quiosque 1");
  const online = await operation("Online");
  const banco = await saveAccount(db, null, { name: "Banco", type: "BANK", openingBalance: 100_000, openingDate: monthFrom, active: true }, meta);
  const caixa = await saveAccount(db, null, { name: "Caixa Q1", type: "CASH", operationId: q1.id, openingBalance: 0, openingDate: monthFrom, active: true }, meta);
  return { vendas, mp, aluguel, estorno, q1, online, banco: banco!, caixa: caixa! };
}

const inst = (o: Partial<{ dueDate: string; amount: number; feeAmount: number; settled: boolean; settledAt: string | null; accountId: string | null; paymentMethod: string | null }>) => ({
  dueDate: today, amount: 0, feeAmount: 0, settled: false, settledAt: null, accountId: null, paymentMethod: null, ...o,
});

beforeEach(resetDb);
afterAll(() => db.$disconnect());

describe("lançamentos e não duplicidade", () => {
  it("venda parcelada no cartão conta UMA vez no faturamento e por parcela nos recebimentos", async () => {
    const b = await base();
    const e = await createEntry(db, {
      type: "INCOME", description: "Venda cartão 3x", competenceDate: today, categoryId: b.vendas.id, operationId: b.q1.id,
      installments: [
        inst({ amount: 10_000, feeAmount: 300, paymentMethod: "CREDIT_CARD", accountId: b.banco.id, settled: true, settledAt: today }),
        inst({ dueDate: addMonthsISO(today, 1), amount: 10_000, feeAmount: 300, paymentMethod: "CREDIT_CARD", accountId: b.banco.id }),
        inst({ dueDate: addMonthsISO(today, 2), amount: 10_000, feeAmount: 300, paymentMethod: "CREDIT_CARD", accountId: b.banco.id }),
      ],
    }, meta);
    expect(e.amount).toBe(30_000);

    const dre = await getIncomeStatement(db, { from: monthFrom, to: monthTo });
    expect(dre.grossRevenue).toBe(30_000); // faturamento: a venda inteira, uma vez
    expect(dre.fees).toBe(900);
    expect(dre.netRevenue).toBe(29_100);

    const cash = await getCashSummary(db, { from: monthFrom, to: monthTo });
    expect(cash.received).toBe(9_700); // só a parcela recebida, líquida da taxa
    expect(cash.receivedGross).toBe(10_000);

    const open = await getOpenTotals(db, today);
    expect(open.receivable.pending).toBe(20_000);
  });

  it("soma das parcelas define o valor e recusa dados inválidos", async () => {
    const b = await base();
    await expect(createEntry(db, { type: "INCOME", description: "x", competenceDate: today, categoryId: b.vendas.id, operationId: b.q1.id, installments: [] }, meta)).rejects.toThrow();
    // categoria de saída em lançamento de entrada
    await expect(createEntry(db, { type: "INCOME", description: "Errado", competenceDate: today, categoryId: b.aluguel.id, operationId: b.q1.id, installments: [inst({ amount: 100 })] }, meta)).rejects.toBeInstanceOf(DomainError);
    // taxa em saída
    await expect(createEntry(db, { type: "EXPENSE", description: "Aluguel", competenceDate: today, categoryId: b.aluguel.id, operationId: b.q1.id, installments: [inst({ amount: 100, feeAmount: 1 })] }, meta)).rejects.toThrow();
    // pagamento no futuro
    await expect(createEntry(db, { type: "EXPENSE", description: "Aluguel", competenceDate: today, categoryId: b.aluguel.id, operationId: b.q1.id, installments: [inst({ amount: 100, settled: true, settledAt: addDaysISO(today, 1) })] }, meta)).rejects.toBeInstanceOf(DomainError);
    // movimentar conta antes do saldo inicial
    await expect(createEntry(db, { type: "EXPENSE", description: "Antigo", competenceDate: today, categoryId: b.aluguel.id, operationId: b.q1.id, installments: [inst({ amount: 100, settled: true, settledAt: addDaysISO(monthFrom, -1), accountId: b.banco.id })] }, meta)).rejects.toBeInstanceOf(DomainError);
  });

  it("restrições do banco impedem valores negativos mesmo fora do serviço", async () => {
    const b = await base();
    await expect(db.entry.create({ data: { type: "INCOME", description: "neg", amount: -1, competenceDate: new Date(`${today}T00:00:00Z`), categoryId: b.vendas.id, operationId: b.q1.id } })).rejects.toThrow();
  });

  it("cancelar remove de todos os totais; desfazer restaura", async () => {
    const b = await base();
    const e = await createEntry(db, { type: "INCOME", description: "Venda", competenceDate: today, categoryId: b.vendas.id, operationId: b.q1.id, installments: [inst({ amount: 5_000, settled: true, settledAt: today, accountId: b.caixa.id, paymentMethod: "CASH" })] }, meta);
    await cancelEntry(db, { entryId: e.id, reason: "lançado em duplicidade" }, meta);
    expect((await getIncomeStatement(db, { from: monthFrom, to: monthTo })).grossRevenue).toBe(0);
    expect((await getCashSummary(db, { from: monthFrom, to: monthTo })).received).toBe(0);
    expect((await getAccountBalances(db, today)).items.find((i) => i.account.id === b.caixa.id)!.balance).toBe(0);
    await restoreEntry(db, e.id, meta);
    expect((await getIncomeStatement(db, { from: monthFrom, to: monthTo })).grossRevenue).toBe(5_000);
    const logs = await db.auditLog.findMany({ where: { entityId: e.id } });
    expect(logs.map((l) => l.action).sort()).toEqual(["finance.entry.cancel", "finance.entry.create", "finance.entry.restore"]);
  });

  it("estorno reduz a receita líquida sem apagar a venda", async () => {
    const b = await base();
    const venda = await createEntry(db, { type: "INCOME", description: "Venda", competenceDate: today, categoryId: b.vendas.id, operationId: b.online.id, installments: [inst({ amount: 8_000, settled: true, settledAt: today, accountId: b.banco.id, paymentMethod: "PIX" })] }, meta);
    await createEntry(db, { type: "EXPENSE", description: "Estorno", competenceDate: today, categoryId: b.estorno.id, operationId: b.online.id, refundOfId: venda.id, installments: [inst({ amount: 8_000, settled: true, settledAt: today, accountId: b.banco.id, paymentMethod: "PIX" })] }, meta);
    const dre = await getIncomeStatement(db, { from: monthFrom, to: monthTo });
    expect(dre.grossRevenue).toBe(8_000);
    expect(dre.deductions).toBe(8_000);
    expect(dre.netRevenue).toBe(0);
    await expect(deleteEntry(db, venda.id, meta)).rejects.toBeInstanceOf(DomainError);
  });

  it("edição substitui parcelas e mantém consistência", async () => {
    const b = await base();
    const e = await createEntry(db, { type: "EXPENSE", description: "MP", competenceDate: today, categoryId: b.mp.id, operationId: b.q1.id, installments: [inst({ amount: 1_000 })] }, meta);
    await updateEntry(db, e.id, { type: "EXPENSE", description: "MP boletos", competenceDate: today, categoryId: b.mp.id, operationId: b.q1.id, installments: [inst({ amount: 600 }), inst({ amount: 900, dueDate: addDaysISO(today, 30) })] }, meta);
    const after = await db.entry.findUniqueOrThrow({ where: { id: e.id }, include: { installments: true } });
    expect(after.amount).toBe(1_500);
    expect(after.installments).toHaveLength(2);
    await expect(updateEntry(db, e.id, { type: "INCOME", description: "Trocar tipo", competenceDate: today, categoryId: b.vendas.id, operationId: b.q1.id, installments: [inst({ amount: 1 })] }, meta)).rejects.toBeInstanceOf(DomainError);
  });
});

describe("baixas, saldos e transferências", () => {
  it("baixa de parcela entra no caixa; baixa dupla é recusada; desfazer funciona", async () => {
    const b = await base();
    const e = await createEntry(db, { type: "EXPENSE", description: "Aluguel", competenceDate: today, categoryId: b.aluguel.id, operationId: b.q1.id, installments: [inst({ amount: 20_000, paymentMethod: "BOLETO" })] }, meta);
    const i = await db.installment.findFirstOrThrow({ where: { entryId: e.id } });
    await settleInstallment(db, { installmentId: i.id, settledAt: today, accountId: b.banco.id }, meta);
    await expect(settleInstallment(db, { installmentId: i.id, settledAt: today, accountId: b.banco.id }, meta)).rejects.toBeInstanceOf(DomainError);
    let bal = await getAccountBalances(db, today);
    expect(bal.items.find((x) => x.account.id === b.banco.id)!.balance).toBe(80_000);
    await unsettleInstallment(db, i.id, meta);
    bal = await getAccountBalances(db, today);
    expect(bal.items.find((x) => x.account.id === b.banco.id)!.balance).toBe(100_000);
  });

  it("transferência move saldo sem afetar receita, despesa ou fluxo consolidado", async () => {
    const b = await base();
    await createEntry(db, { type: "INCOME", description: "Venda dinheiro", competenceDate: today, categoryId: b.vendas.id, operationId: b.q1.id, installments: [inst({ amount: 50_000, settled: true, settledAt: today, accountId: b.caixa.id, paymentMethod: "CASH" })] }, meta);
    await createTransfer(db, { date: today, amount: 30_000, fromAccountId: b.caixa.id, toAccountId: b.banco.id, description: "Depósito" }, meta);
    const bal = await getAccountBalances(db, today);
    expect(bal.items.find((x) => x.account.id === b.caixa.id)!.balance).toBe(20_000);
    expect(bal.items.find((x) => x.account.id === b.banco.id)!.balance).toBe(130_000);
    expect(bal.total).toBe(150_000);
    const dre = await getIncomeStatement(db, { from: monthFrom, to: monthTo });
    expect(dre.grossRevenue).toBe(50_000);
    expect(dre.totalExpenses).toBe(0);
    const flow = await getCashFlowSeries(db, { from: monthFrom, to: monthTo }, "month");
    expect(flow[0]).toMatchObject({ inflow: 50_000, outflow: 0 });
    await expect(createTransfer(db, { date: today, amount: 1, fromAccountId: b.caixa.id, toAccountId: b.caixa.id, description: "x" }, meta)).rejects.toThrow();
  });

  it("vencidos e totais em aberto", async () => {
    const b = await base();
    await createEntry(db, { type: "EXPENSE", description: "Boleto vencido", competenceDate: today, categoryId: b.mp.id, operationId: b.q1.id, installments: [inst({ amount: 700, dueDate: addDaysISO(today, -3) }), inst({ amount: 300, dueDate: addDaysISO(today, 3) })] }, meta);
    const open = await getOpenTotals(db, today);
    expect(open.payable).toMatchObject({ pending: 1_000, overdue: 700, next7: 300, overdueCount: 1 });
    const list = await listEntries(db, { from: monthFrom, to: monthTo, status: "overdue" }, today);
    expect(list.total).toBe(1);
  });
});

describe("operações e fechamento", () => {
  it("resultado por operação e consolidado batem", async () => {
    const b = await base();
    const central = await operation("Central / administrativo");
    await createEntry(db, { type: "INCOME", description: "V1", competenceDate: today, categoryId: b.vendas.id, operationId: b.q1.id, installments: [inst({ amount: 10_000 })] }, meta);
    await createEntry(db, { type: "INCOME", description: "V2", competenceDate: today, categoryId: b.vendas.id, operationId: b.online.id, installments: [inst({ amount: 4_000 })] }, meta);
    await createEntry(db, { type: "EXPENSE", description: "Aluguel", competenceDate: today, categoryId: b.aluguel.id, operationId: central.id, installments: [inst({ amount: 3_000 })] }, meta);
    const per = await getStatementsByOperation(db, { from: monthFrom, to: monthTo });
    const total = per.reduce((s, r) => s + r.statement.result, 0);
    const consolidated = await getIncomeStatement(db, { from: monthFrom, to: monthTo });
    expect(total).toBe(consolidated.result);
    expect(consolidated.result).toBe(11_000);
    expect(per.find((r) => r.operation.id === b.q1.id)!.statement.result).toBe(10_000);
    const onlyQ1 = await getIncomeStatement(db, { from: monthFrom, to: monthTo, operationId: b.q1.id });
    expect(onlyQ1.grossRevenue).toBe(10_000);
  });

  it("mês fechado bloqueia alterações e torna o resultado calculado", async () => {
    const b = await base();
    const e = await createEntry(db, { type: "INCOME", description: "Venda", competenceDate: today, categoryId: b.vendas.id, operationId: b.q1.id, installments: [inst({ amount: 1_000 })] }, meta);
    let c = await getCompleteness(db, { from: monthFrom, to: monthTo });
    expect(c.status).toBe("ESTIMATED");
    expect(c.issues.join(" ")).toContain("nenhum custo de produção");

    await closeMonth(db, monthKey(today), null, meta);
    c = await getCompleteness(db, { from: monthFrom, to: monthTo });
    expect(c.status).toBe("CALCULATED");
    await expect(cancelEntry(db, { entryId: e.id, reason: "teste" }, meta)).rejects.toBeInstanceOf(DomainError);
    await expect(createEntry(db, { type: "INCOME", description: "Nova", competenceDate: today, categoryId: b.vendas.id, operationId: b.q1.id, installments: [inst({ amount: 1 })] }, meta)).rejects.toBeInstanceOf(DomainError);
    await expect(closeMonth(db, monthKey(addMonthsISO(today, 1)), null, meta)).rejects.toBeInstanceOf(DomainError);
    await reopenMonth(db, monthKey(today), meta);
    await cancelEntry(db, { entryId: e.id, reason: "teste" }, meta);
  });

  it("exclusão definitiva registra o histórico na auditoria", async () => {
    const b = await base();
    const e = await createEntry(db, { type: "EXPENSE", description: "Errado", competenceDate: today, categoryId: b.aluguel.id, operationId: b.q1.id, installments: [inst({ amount: 123 })] }, meta);
    await deleteEntry(db, e.id, meta);
    expect(await db.entry.count()).toBe(0);
    const log = await db.auditLog.findFirstOrThrow({ where: { action: "finance.entry.delete" } });
    expect(log.metadata).toMatchObject({ amount: 123, description: "Errado" });
  });
});
