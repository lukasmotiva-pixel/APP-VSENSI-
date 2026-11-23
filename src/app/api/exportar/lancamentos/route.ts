import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentSession } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { dateOnly, formatDateBR, resolvePeriod, todayISO, toISO } from "@/lib/dates";
import { entryState } from "@/modules/finance/calculations";
import { PAYMENT_METHOD_LABELS } from "@/modules/finance/schemas";

/** Exporta lançamentos (uma linha por parcela) em CSV compatível com Excel em português. */
export async function GET(req: NextRequest) {
  if (!(await getCurrentSession())) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const sp = Object.fromEntries(req.nextUrl.searchParams);
  const period = resolvePeriod({ p: sp.p, de: sp.de, ate: sp.ate });
  const tipo = sp.tipo === "entrada" ? "INCOME" : sp.tipo === "saida" ? "EXPENSE" : undefined;
  const entries = await prisma.entry.findMany({
    where: {
      competenceDate: { gte: dateOnly(period.from), lte: dateOnly(period.to) },
      ...(tipo ? { type: tipo } : {}),
      ...(sp.operacao ? { operationId: sp.operacao } : {}),
      ...(sp.categoria ? { categoryId: sp.categoria } : {}),
    },
    include: { category: true, operation: true, supplier: true, installments: { include: { account: true }, orderBy: { number: "asc" } } },
    orderBy: [{ competenceDate: "asc" }, { createdAt: "asc" }],
    take: 20000,
  });
  const today = todayISO();
  const money = (c: number) => (c / 100).toFixed(2).replace(".", ",");
  const cell = (v: string | number | null | undefined) => {
    const s = String(v ?? "");
    // Evita injeção de fórmulas em planilhas (=, +, -, @ no início).
    const safe = /^[=+\-@]/.test(s) && !/^-?\d/.test(s) ? `'${s}` : s;
    return /[";\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  const header = ["Competência", "Tipo", "Descrição", "Categoria", "Operação", "Fornecedor", "Situação", "Parcela", "Vencimento", "Valor", "Taxa", "Líquido", "Forma de pagamento", "Conta", "Pago/recebido em", "Observações"];
  const STATE = { CANCELED: "Cancelado", SETTLED: "Quitado", PARTIAL: "Parcial", OVERDUE: "Vencido", PENDING: "Em aberto" } as const;
  const lines = [header.join(";")];
  for (const e of entries) {
    const st = STATE[entryState({ canceledAt: e.canceledAt, installments: e.installments.map((i) => ({ status: i.status, dueDate: toISO(i.dueDate) })) }, today)];
    for (const i of e.installments) {
      lines.push([
        formatDateBR(e.competenceDate), e.type === "INCOME" ? "Entrada" : "Saída", e.description, e.category.name, e.operation.name, e.supplier?.name,
        st, `${i.number}/${e.installments.length}`, formatDateBR(i.dueDate), money(i.amount), money(i.feeAmount), money(i.amount - i.feeAmount),
        i.paymentMethod ? PAYMENT_METHOD_LABELS[i.paymentMethod] : "", i.account?.name, i.settledAt ? formatDateBR(i.settledAt) : "", e.notes,
      ].map(cell).join(";"));
    }
  }
  await audit({ action: "finance.export", summary: `Exportação de lançamentos (${period.from} a ${period.to}, ${entries.length} lançamentos)` });
  return new NextResponse("﻿" + lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="lancamentos-${period.from}-a-${period.to}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
