"use server";

import { prisma } from "@/lib/db";
import { fmoney, fstr, guard, runAction } from "@/lib/action-helpers";
import type { ActionState } from "@/lib/action-state";
import { formatMoney } from "@/lib/money";
import { deleteSalaryPayment, generatePayroll, saveEmployee } from "./service";

export async function saveEmployeeAction(_p: ActionState, f: FormData): Promise<ActionState> {
  return runAction(async (meta) => {
    const e = await saveEmployee(prisma, fstr(f, "id") || null, {
      name: fstr(f, "name"), role: fstr(f, "role"), operationId: fstr(f, "operationId"), salary: fmoney(f, "salary", "Salário"),
      paymentDay: fstr(f, "paymentDay"), hireDate: fstr(f, "hireDate"), active: f.get("active") === "on", notes: fstr(f, "notes"),
    }, meta);
    return { redirectTo: `/pessoas/${e.id}?salvo=1` };
  }, { message: "Funcionário salvo." });
}

export async function generatePayrollAction(_p: ActionState, f: FormData): Promise<ActionState> {
  return runAction(async (meta) => {
    const r = await generatePayroll(prisma, fstr(f, "month"), f.get("nextMonth") === "on", meta);
    return {
      message: r.count
        ? `${r.count} salário(s) gerado(s), total ${formatMoney(r.total)}. Eles aparecem em Contas a pagar.`
        : "Nenhum salário novo: todos os funcionários ativos já têm o salário deste mês.",
    };
  });
}

export async function deleteSalaryPaymentAction(f: FormData): Promise<void> {
  const meta = await guard();
  await deleteSalaryPayment(prisma, fstr(f, "id"), meta);
}
