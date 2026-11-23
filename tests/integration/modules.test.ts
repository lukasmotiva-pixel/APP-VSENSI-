import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { addDaysISO, endOfMonthISO, monthKey, startOfMonthISO, todayISO } from "@/lib/dates";
import { DomainError } from "@/lib/errors";
import { getCashSummary, getIncomeStatement, getOpenTotals } from "@/modules/finance/queries";
import { cancelEntry, closeMonth, deleteEntry } from "@/modules/finance/service";
import { buildClosingInstallments, deleteClosing, saveClosing } from "@/modules/kiosks/service";
import { changeOrderStatus, createOrder, deleteOrder, updateOrder } from "@/modules/orders/service";
import { deleteSalaryPayment, generatePayroll, salaryDueDate, saveEmployee } from "@/modules/people/service";
import { saveAccount } from "@/modules/settings/service";
import { db, meta, operation, resetDb } from "./helpers";

const today = todayISO();
const range = { from: startOfMonthISO(today), to: endOfMonthISO(today) };
beforeEach(resetDb);
afterAll(() => db.$disconnect());

const closingBase = { cash: 0, pix: 0, debit: 0, credit: 0, other: 0, debitFee: 0, creditFee: 0, creditReceiveDate: null, cashAccountId: null, pixAccountId: null, cardAccountId: null, notes: null };

describe("quiosques — fechamento de caixa", () => {
  it("monta uma parcela por forma; crédito futuro fica a receber", () => {
    const rows = buildClosingInstallments({ ...closingBase, operationId: "x", date: "2026-11-20", cash: 100, pix: 200, credit: 300, creditFee: 9, creditReceiveDate: "2026-12-20" }, "2026-11-23");
    expect(rows.map((r) => [r.paymentMethod, r.amount, r.settledAt])).toEqual([["CASH", 100, "2026-11-20"], ["PIX", 200, "2026-11-20"], ["CREDIT_CARD", 300, null]]);
  });

  it("gera UM lançamento; editar não duplica; mesma data é recusada; excluir remove", async () => {
    const q1 = await operation("Quiosque 1");
    const caixa = await saveAccount(db, null, { name: "Caixa Q1", type: "CASH", openingBalance: 0, openingDate: startOfMonthISO(today), active: true }, meta);
    const c = await saveClosing(db, null, { ...closingBase, operationId: q1.id, date: today, cash: 10_000, pix: 5_000, credit: 3_000, creditFee: 90, cashAccountId: caixa!.id, creditReceiveDate: addDaysISO(today, 30) }, meta);
    let dre = await getIncomeStatement(db, range);
    expect(dre.grossRevenue).toBe(18_000);
    expect(dre.fees).toBe(90);
    expect((await getOpenTotals(db, today)).receivable.pending).toBe(3_000);
    expect((await getCashSummary(db, range)).received).toBe(15_000);

    await saveClosing(db, c.id, { ...closingBase, operationId: q1.id, date: today, cash: 12_000, cashAccountId: caixa!.id }, meta);
    dre = await getIncomeStatement(db, range);
    expect(dre.grossRevenue).toBe(12_000);
    expect(await db.entry.count()).toBe(1);

    await expect(saveClosing(db, null, { ...closingBase, operationId: q1.id, date: today, cash: 1 }, meta)).rejects.toBeInstanceOf(DomainError);
    // não pode ser cancelado/excluído pelo financeiro
    const entry = await db.entry.findFirstOrThrow();
    await expect(deleteEntry(db, entry.id, meta)).rejects.toBeInstanceOf(DomainError);
    await expect(cancelEntry(db, { entryId: entry.id, reason: "teste" }, meta)).rejects.toBeInstanceOf(DomainError);

    await deleteClosing(db, c.id, meta);
    expect(await db.entry.count()).toBe(0);
  });

  it("recusa operação que não é quiosque e fechamento vazio", async () => {
    const online = await operation("Online");
    await expect(saveClosing(db, null, { ...closingBase, operationId: online.id, date: today, cash: 1 }, meta)).rejects.toBeInstanceOf(DomainError);
    const q1 = await operation("Quiosque 1");
    await expect(saveClosing(db, null, { ...closingBase, operationId: q1.id, date: today }, meta)).rejects.toThrow();
  });
});

describe("pedidos", () => {
  async function newOrder() {
    const online = await operation("Online");
    return createOrder(db, {
      newCustomer: { name: "Cliente Teste", phone: "11999990000" }, operationId: online.id, channel: "WHATSAPP", orderDate: today,
      items: [{ description: "Produto A", quantity: 2, unitPrice: 5_000 }, { description: "Produto B", quantity: 1, unitPrice: 3_000 }],
      discount: 1_000, shippingFee: 2_000, paymentMethod: "PIX",
    }, meta);
  }

  it("calcula total; só gera venda ao confirmar pagamento, uma única vez", async () => {
    const o = await newOrder();
    expect(o.total).toBe(14_000);
    expect((await getIncomeStatement(db, range)).grossRevenue).toBe(0);
    await changeOrderStatus(db, { orderId: o.id, status: "AWAITING_PAYMENT" }, meta);
    await changeOrderStatus(db, { orderId: o.id, status: "PAYMENT_CONFIRMED" }, meta);
    await changeOrderStatus(db, { orderId: o.id, status: "IN_PREPARATION" }, meta);
    await changeOrderStatus(db, { orderId: o.id, status: "SHIPPED" }, meta);
    await changeOrderStatus(db, { orderId: o.id, status: "DELIVERED" }, meta);
    expect(await db.entry.count()).toBe(1);
    expect((await getIncomeStatement(db, range)).grossRevenue).toBe(14_000);
    expect(await db.orderStatusHistory.count({ where: { orderId: o.id } })).toBe(6);
    // pago não volta para aguardando pagamento
    await expect(changeOrderStatus(db, { orderId: o.id, status: "AWAITING_PAYMENT" }, meta)).rejects.toBeInstanceOf(DomainError);
    await expect(deleteOrder(db, o.id, meta)).rejects.toBeInstanceOf(DomainError);
  });

  it("editar pedido pago atualiza o lançamento; cancelar tira do faturamento; reativar não duplica", async () => {
    const o = await newOrder();
    await changeOrderStatus(db, { orderId: o.id, status: "PAYMENT_CONFIRMED" }, meta);
    await updateOrder(db, o.id, { customerId: o.customerId, operationId: o.operationId, channel: "INSTAGRAM", orderDate: today, items: [{ description: "Produto A", quantity: 3, unitPrice: 5_000 }], discount: 0, shippingFee: 0, paymentMethod: "PIX" }, meta);
    expect((await getIncomeStatement(db, range)).grossRevenue).toBe(15_000);
    await changeOrderStatus(db, { orderId: o.id, status: "CANCELED", note: "desistiu" }, meta);
    expect((await getIncomeStatement(db, range)).grossRevenue).toBe(0);
    await changeOrderStatus(db, { orderId: o.id, status: "PAYMENT_CONFIRMED" }, meta);
    expect((await getIncomeStatement(db, range)).grossRevenue).toBe(15_000);
    expect(await db.entry.count()).toBe(1);
  });

  it("restrição do banco garante total coerente", async () => {
    const o = await newOrder();
    await expect(db.order.update({ where: { id: o.id }, data: { total: 1 } })).rejects.toThrow();
  });
});

describe("pessoas — salários", () => {
  it("vencimento respeita o fim do mês", () => {
    expect(salaryDueDate("2026-01", 31, true)).toBe("2026-02-28");
    expect(salaryDueDate("2026-11", 5, true)).toBe("2026-12-05");
    expect(salaryDueDate("2026-11", 30, false)).toBe("2026-11-30");
  });

  it("gera a folha sem duplicar; salário pago não pode ser excluído", async () => {
    const q1 = await operation("Quiosque 1");
    await saveEmployee(db, null, { name: "Funcionária A", role: "Vendedora", operationId: q1.id, salary: 200_000, paymentDay: 5, active: true }, meta);
    await saveEmployee(db, null, { name: "Funcionário B", salary: 180_000, paymentDay: 5, active: true }, meta);
    await saveEmployee(db, null, { name: "Inativo", salary: 100_000, paymentDay: 5, active: false }, meta);
    const month = monthKey(today);
    expect(await generatePayroll(db, month, true, meta)).toEqual({ count: 2, total: 380_000 });
    expect(await generatePayroll(db, month, true, meta)).toEqual({ count: 0, total: 0 });
    expect((await getIncomeStatement(db, range)).payroll).toBe(380_000);
    const sp = await db.salaryPayment.findFirstOrThrow({ include: { entry: { include: { installments: true } } } });
    await db.installment.update({ where: { id: sp.entry!.installments[0]!.id }, data: { status: "SETTLED", settledAt: new Date(`${today}T00:00:00Z`) } });
    await expect(deleteSalaryPayment(db, sp.id, meta)).rejects.toBeInstanceOf(DomainError);
    await closeMonth(db, month, null, meta);
    await expect(generatePayroll(db, month, true, meta)).rejects.toBeInstanceOf(DomainError);
  });
});
