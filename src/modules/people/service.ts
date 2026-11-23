/**
 * Funcionários e salários. Gerar a folha do mês cria, para cada funcionário ativo, um lançamento
 * de saída pendente (grupo Pessoal) — um por funcionário/mês (chave única), sem duplicidade.
 * O pagamento é a baixa desse lançamento.
 */
import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { addMonthsISO, dateOnly, endOfMonthISO, formatMonthShort, toISO } from "@/lib/dates";
import { DomainError } from "@/lib/errors";
import { formatMoney, MAX_CENTS } from "@/lib/money";
import { assertMonthOpen } from "@/modules/finance/service";
import { optionalIsoDate, monthKeySchema } from "@/modules/finance/schemas";

interface Meta {
  ip: string | null;
}
const text = (max: number) => z.string().trim().max(max).nullish().transform((v) => v || null);

export const employeeSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome.").max(120),
  role: text(80),
  operationId: z.string().max(40).nullish().transform((v) => v || null),
  salary: z.number().int().min(0).max(MAX_CENTS),
  paymentDay: z.coerce.number().int().min(1, "Dia entre 1 e 31.").max(31, "Dia entre 1 e 31."),
  hireDate: optionalIsoDate,
  active: z.boolean(),
  notes: text(2000),
});

export async function saveEmployee(db: PrismaClient, id: string | null, raw: unknown, meta: Meta) {
  const input = employeeSchema.parse(raw);
  const data = { ...input, hireDate: input.hireDate ? dateOnly(input.hireDate) : null };
  const e = id ? await db.employee.update({ where: { id }, data }) : await db.employee.create({ data });
  await audit({ action: id ? "people.employee.update" : "people.employee.create", entity: "Employee", entityId: e.id, summary: `Funcionário ${id ? "atualizado" : "cadastrado"}: ${e.name}`, ip: meta.ip }, db);
  return e;
}

/** Data de vencimento do salário de `month`: dia de pagamento no próprio mês ou no seguinte. */
export function salaryDueDate(month: string, paymentDay: number, nextMonth: boolean): string {
  const ref = nextMonth ? addMonthsISO(`${month}-01`, 1) : `${month}-01`;
  const last = Number(endOfMonthISO(ref).slice(8));
  return `${ref.slice(0, 8)}${String(Math.min(paymentDay, last)).padStart(2, "0")}`;
}

/** Gera os salários do mês (competência) para os funcionários ativos que ainda não os têm. */
export async function generatePayroll(db: PrismaClient, month: string, nextMonth: boolean, meta: Meta) {
  monthKeySchema.parse(month);
  return db.$transaction(async (tx) => {
    const competence = endOfMonthISO(`${month}-01`);
    await assertMonthOpen(tx, competence);
    const category =
      (await tx.category.findFirst({ where: { group: "PAYROLL", type: "EXPENSE", active: true, name: "Salários" } })) ??
      (await tx.category.findFirst({ where: { group: "PAYROLL", type: "EXPENSE", active: true }, orderBy: { sortOrder: "asc" } }));
    if (!category) throw new DomainError("Não há categoria de pessoal ativa (ex.: Salários).");
    const central = await tx.operation.findFirst({ where: { type: "CENTRAL" }, orderBy: { sortOrder: "asc" } });

    const employees = await tx.employee.findMany({ where: { active: true, salary: { gt: 0 }, payments: { none: { month } } } });
    let total = 0;
    for (const emp of employees) {
      const operationId = emp.operationId ?? central?.id;
      if (!operationId) throw new DomainError(`Defina o local de trabalho de ${emp.name} ou crie a operação Central.`);
      const due = salaryDueDate(month, emp.paymentDay, nextMonth);
      const entry = await tx.entry.create({
        data: {
          type: "EXPENSE",
          source: "PAYROLL",
          description: `Salário ${formatMonthShort(month)} — ${emp.name}`,
          amount: emp.salary,
          competenceDate: dateOnly(competence),
          categoryId: category.id,
          operationId,
          installments: { create: { number: 1, dueDate: dateOnly(due), amount: emp.salary, status: "PENDING" } },
        },
      });
      await tx.salaryPayment.create({ data: { employeeId: emp.id, month, amount: emp.salary, entryId: entry.id } });
      total += emp.salary;
    }
    await audit({ action: "people.payroll.generate", summary: `Folha de ${formatMonthShort(month)} gerada: ${employees.length} funcionário(s), ${formatMoney(total)}`, ip: meta.ip }, tx);
    return { count: employees.length, total };
  });
}

/** Remove um salário gerado (somente se ainda não foi pago). */
export async function deleteSalaryPayment(db: PrismaClient, id: string, meta: Meta) {
  return db.$transaction(async (tx) => {
    const sp = await tx.salaryPayment.findUnique({ where: { id }, include: { employee: true, entry: { include: { installments: true } } } });
    if (!sp) throw new DomainError("Salário não encontrado.");
    if (sp.entry?.installments.some((i) => i.status === "SETTLED")) throw new DomainError("Este salário já foi pago. Desfaça o pagamento antes de excluir.");
    if (sp.entry) await assertMonthOpen(tx, toISO(sp.entry.competenceDate));
    await tx.salaryPayment.delete({ where: { id } });
    if (sp.entryId) await tx.entry.delete({ where: { id: sp.entryId } });
    await audit({ action: "people.salary.delete", summary: `Salário de ${formatMonthShort(sp.month)} de ${sp.employee.name} excluído`, ip: meta.ip }, tx);
  });
}
