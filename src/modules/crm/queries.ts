import type { Channel, PrismaClient } from "@prisma/client";
import { dateOnly } from "@/lib/dates";
import { PAID_STATUSES } from "@/modules/orders/service";

export interface Range {
  from: string;
  to: string;
}

/** Indicadores de atendimento e vendas online no período. */
export async function getCrmMetrics(db: PrismaClient, r: Range) {
  const between = { gte: dateOnly(r.from), lte: dateOnly(r.to) };
  const [byStatus, newCustomers, ordersByChannel, recurring, interactionsByChannel] = await Promise.all([
    db.interaction.groupBy({ by: ["status"], where: { date: between }, _count: true }),
    db.customer.count({ where: { createdAt: { gte: new Date(`${r.from}T03:00:00Z`), lt: new Date(new Date(`${r.to}T03:00:00Z`).getTime() + 86_400_000) } } }),
    db.order.groupBy({ by: ["channel"], where: { status: { in: PAID_STATUSES }, paidAt: between }, _count: true, _sum: { total: true } }),
    db.$queryRaw<{ n: bigint }[]>`
      SELECT COUNT(*)::bigint AS n FROM (
        SELECT customer_id FROM orders WHERE status::text <> 'CANCELED' AND entry_id IS NOT NULL GROUP BY customer_id HAVING COUNT(*) >= 2
      ) t`,
    db.interaction.groupBy({ by: ["channel"], where: { date: between }, _count: true }),
  ]);
  const total = byStatus.reduce((a, s) => a + s._count, 0);
  const converted = byStatus.find((s) => s.status === "CONVERTED")?._count ?? 0;
  const chan = (c: Channel) => ordersByChannel.find((o) => o.channel === c);
  return {
    interactions: total,
    converted,
    lost: byStatus.find((s) => s.status === "LOST")?._count ?? 0,
    open: (byStatus.find((s) => s.status === "PENDING")?._count ?? 0) + (byStatus.find((s) => s.status === "INTERESTED")?._count ?? 0),
    conversionPct: total ? Math.round((converted / total) * 1000) / 10 : null,
    newCustomers,
    recurringCustomers: Number(recurring[0]?.n ?? 0),
    sales: {
      whatsapp: { count: chan("WHATSAPP")?._count ?? 0, total: chan("WHATSAPP")?._sum.total ?? 0 },
      instagram: { count: chan("INSTAGRAM")?._count ?? 0, total: chan("INSTAGRAM")?._sum.total ?? 0 },
      other: {
        count: (chan("OTHER")?._count ?? 0) + (chan("KIOSK")?._count ?? 0),
        total: (chan("OTHER")?._sum.total ?? 0) + (chan("KIOSK")?._sum.total ?? 0),
      },
    },
    interactionsByChannel: interactionsByChannel.map((c) => ({ channel: c.channel, count: c._count })),
  };
}

/** Atendimentos em aberto (pendentes ou oportunidades), com retorno vencido primeiro. */
export async function listOpenInteractions(db: PrismaClient) {
  return db.interaction.findMany({
    where: { status: { in: ["PENDING", "INTERESTED"] } },
    include: { customer: true },
    orderBy: [{ followUpDate: { sort: "asc", nulls: "last" } }, { date: "asc" }],
    take: 200,
  });
}
