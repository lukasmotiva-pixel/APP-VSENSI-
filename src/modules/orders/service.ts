/**
 * Pedidos da operação online. Quando o pagamento é confirmado, o pedido gera UM lançamento de
 * entrada (origem ORDER, entryId único) — a venda nunca é registrada duas vezes.
 */
import { Prisma, type OrderStatus, type PrismaClient } from "@prisma/client";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { dateOnly, todayISO, toISO } from "@/lib/dates";
import { DomainError } from "@/lib/errors";
import { formatMoney, MAX_CENTS } from "@/lib/money";
import { assertAccountForDate, assertMonthOpen } from "@/modules/finance/service";
import { isoDate, optionalIsoDate, PAYMENT_METHODS } from "@/modules/finance/schemas";

type Tx = Prisma.TransactionClient;
interface Meta {
  ip: string | null;
}

export const ORDER_STATUSES = [
  "RECEIVED", "AWAITING_PAYMENT", "PAYMENT_CONFIRMED", "IN_PREPARATION", "READY_TO_SHIP", "SHIPPED", "DELIVERED", "CANCELED",
] as const satisfies readonly OrderStatus[];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  RECEIVED: "Pedido recebido",
  AWAITING_PAYMENT: "Aguardando pagamento",
  PAYMENT_CONFIRMED: "Pagamento confirmado",
  IN_PREPARATION: "Em preparação",
  READY_TO_SHIP: "Pronto para envio",
  SHIPPED: "Enviado / saiu para entrega",
  DELIVERED: "Entregue",
  CANCELED: "Cancelado",
};

/** Status em que o pagamento já foi confirmado. */
export const PAID_STATUSES: OrderStatus[] = ["PAYMENT_CONFIRMED", "IN_PREPARATION", "READY_TO_SHIP", "SHIPPED", "DELIVERED"];

export const DELIVERY_LABELS = { CORREIOS: "Correios", CAR: "Carro (entrega própria)", EXCURSION: "Excursão", PICKUP: "Retirada" } as const;
export const CHANNEL_LABELS = { WHATSAPP: "WhatsApp", INSTAGRAM: "Instagram", KIOSK: "Quiosque", OTHER: "Outro" } as const;

const money = z.number().int().min(0).max(MAX_CENTS);
const text = (max: number) => z.string().trim().max(max).nullish().transform((v) => v || null);

export const orderSchema = z
  .object({
    customerId: z.string().max(40).nullish().transform((v) => v || null),
    newCustomer: z
      .object({ name: z.string().trim().min(2, "Informe o nome do cliente.").max(120), phone: text(30) })
      .nullish()
      .transform((v) => v ?? null),
    operationId: z.string().min(1, "Escolha a operação."),
    channel: z.enum(["WHATSAPP", "INSTAGRAM", "KIOSK", "OTHER"]),
    orderDate: isoDate,
    items: z
      .array(
        z.object({
          productId: z.string().max(40).nullish().transform((v) => v || null),
          description: z.string().trim().min(1, "Descreva o item.").max(200),
          quantity: z.number().int().min(1, "Quantidade inválida.").max(100000),
          unitPrice: money,
        }),
      )
      .min(1, "Adicione pelo menos um item.")
      .max(100),
    discount: money,
    shippingFee: money,
    paymentMethod: z.enum(PAYMENT_METHODS).nullish().transform((v) => v ?? null),
    accountId: z.string().max(40).nullish().transform((v) => v || null),
    attendant: text(80),
    deliveryMethod: z.enum(["CORREIOS", "CAR", "EXCURSION", "PICKUP"]).nullish().transform((v) => v ?? null),
    address: text(500),
    trackingCode: text(60),
    deliveryPerson: text(80),
    excursionInfo: text(200),
    expectedDelivery: optionalIsoDate,
    notes: text(2000),
  })
  .superRefine((o, ctx) => {
    if (!o.customerId && !o.newCustomer) ctx.addIssue({ code: "custom", path: ["customerId"], message: "Escolha ou cadastre o cliente." });
    const subtotal = o.items.reduce((a, i) => a + i.quantity * i.unitPrice, 0);
    if (o.discount > subtotal) ctx.addIssue({ code: "custom", path: ["discount"], message: "O desconto é maior que o valor dos itens." });
    if (subtotal - o.discount + o.shippingFee > MAX_CENTS) ctx.addIssue({ code: "custom", path: ["items"], message: "Valor total alto demais." });
  });

export type OrderInput = z.infer<typeof orderSchema>;

export function orderTotals(o: Pick<OrderInput, "items" | "discount" | "shippingFee">) {
  const subtotal = o.items.reduce((a, i) => a + i.quantity * i.unitPrice, 0);
  return { subtotal, total: subtotal - o.discount + o.shippingFee };
}

async function salesCategoryId(tx: Tx) {
  const cat = await tx.category.findFirst({ where: { group: "SALES", type: "INCOME", active: true }, orderBy: { sortOrder: "asc" } });
  if (!cat) throw new DomainError("Não há categoria de vendas ativa. Crie uma em Configurações → Categorias.");
  return cat.id;
}

async function resolveCustomer(tx: Tx, input: OrderInput) {
  if (input.customerId) {
    const c = await tx.customer.findUnique({ where: { id: input.customerId } });
    if (!c) throw new DomainError("Cliente não encontrado.", "customerId");
    return c.id;
  }
  const c = await tx.customer.create({ data: { name: input.newCustomer!.name, phone: input.newCustomer!.phone, channel: input.channel } });
  return c.id;
}

function orderData(input: OrderInput) {
  const { subtotal, total } = orderTotals(input);
  return {
    operationId: input.operationId,
    channel: input.channel,
    orderDate: dateOnly(input.orderDate),
    subtotal,
    discount: input.discount,
    shippingFee: input.shippingFee,
    total,
    paymentMethod: input.paymentMethod,
    accountId: input.accountId,
    attendant: input.attendant,
    deliveryMethod: input.deliveryMethod,
    address: input.address,
    trackingCode: input.trackingCode,
    deliveryPerson: input.deliveryPerson,
    excursionInfo: input.excursionInfo,
    expectedDelivery: input.expectedDelivery ? dateOnly(input.expectedDelivery) : null,
    notes: input.notes,
  };
}

/** Mantém o lançamento financeiro do pedido coerente com o valor/forma de pagamento atuais. */
async function syncEntry(tx: Tx, orderId: string) {
  const o = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { customer: true, entry: true } });
  if (!o.entry || o.entry.canceledAt) return;
  await assertMonthOpen(tx, toISO(o.entry.competenceDate));
  if (o.total <= 0) throw new DomainError("Um pedido pago precisa ter valor maior que zero.");
  if (o.accountId) await assertAccountForDate(tx, o.accountId, toISO(o.paidAt ?? o.entry.competenceDate));
  await tx.installment.updateMany({
    where: { entryId: o.entry.id },
    data: { amount: o.total, paymentMethod: o.paymentMethod, accountId: o.accountId },
  });
  await tx.entry.update({
    where: { id: o.entry.id },
    data: { amount: o.total, description: `Pedido #${o.number} — ${o.customer.name}`, operationId: o.operationId },
  });
}

export async function createOrder(db: PrismaClient, raw: unknown, meta: Meta) {
  const input = orderSchema.parse(raw);
  return db.$transaction(async (tx) => {
    const op = await tx.operation.findUnique({ where: { id: input.operationId } });
    if (!op) throw new DomainError("Operação não encontrada.", "operationId");
    const customerId = await resolveCustomer(tx, input);
    const order = await tx.order.create({
      data: {
        ...orderData(input),
        customerId,
        status: "RECEIVED",
        items: { create: input.items },
        history: { create: { status: "RECEIVED" } },
      },
    });
    await audit({ action: "order.create", entity: "Order", entityId: order.id, summary: `Pedido #${order.number} criado (${formatMoney(order.total)})`, ip: meta.ip }, tx);
    return order;
  });
}

export async function updateOrder(db: PrismaClient, id: string, raw: unknown, meta: Meta) {
  const input = orderSchema.parse(raw);
  return db.$transaction(async (tx) => {
    const current = await tx.order.findUnique({ where: { id } });
    if (!current) throw new DomainError("Pedido não encontrado.");
    const customerId = await resolveCustomer(tx, input);
    await tx.orderItem.deleteMany({ where: { orderId: id } });
    const order = await tx.order.update({ where: { id }, data: { ...orderData(input), customerId, items: { create: input.items } } });
    await syncEntry(tx, id);
    await audit({ action: "order.update", entity: "Order", entityId: id, summary: `Pedido #${order.number} editado (${formatMoney(order.total)})`, ip: meta.ip }, tx);
    return order;
  });
}

export const statusChangeSchema = z.object({
  orderId: z.string().min(1),
  status: z.enum(ORDER_STATUSES),
  paidAt: optionalIsoDate,
  note: z.string().trim().max(500).nullish().transform((v) => v || null),
});

/**
 * Muda o status. Regras financeiras:
 *  - ao entrar em um status pago pela 1ª vez, cria o lançamento (recebido na data do pagamento);
 *  - ao cancelar, o lançamento (se houver) é cancelado;
 *  - um pedido pago não volta para "recebido"/"aguardando pagamento" (cancele-o).
 */
export async function changeOrderStatus(db: PrismaClient, raw: unknown, meta: Meta) {
  const input = statusChangeSchema.parse(raw);
  const today = todayISO();
  return db.$transaction(async (tx) => {
    const o = await tx.order.findUnique({ where: { id: input.orderId }, include: { customer: true, entry: true } });
    if (!o) throw new DomainError("Pedido não encontrado.");
    if (o.status === input.status) return o;
    const toPaid = PAID_STATUSES.includes(input.status);
    const hasActiveEntry = Boolean(o.entry && !o.entry.canceledAt);

    if (!toPaid && input.status !== "CANCELED" && hasActiveEntry)
      throw new DomainError("O pagamento deste pedido já foi confirmado. Para desfazer, cancele o pedido.");

    let paidAt = o.paidAt ? toISO(o.paidAt) : null;
    if (toPaid && !hasActiveEntry) {
      if (o.total <= 0) throw new DomainError("O pedido precisa ter valor maior que zero para confirmar o pagamento.");
      paidAt = input.paidAt ?? today;
      if (paidAt > today) throw new DomainError("A data do pagamento não pode ser no futuro.", "paidAt");
      await assertMonthOpen(tx, paidAt);
      if (o.accountId) await assertAccountForDate(tx, o.accountId, paidAt);
      if (o.entry) {
        // Pedido cancelado e reativado: reaproveita o lançamento.
        await assertMonthOpen(tx, toISO(o.entry.competenceDate));
        await tx.installment.deleteMany({ where: { entryId: o.entry.id } });
        await tx.entry.update({
          where: { id: o.entry.id },
          data: {
            canceledAt: null,
            cancelReason: null,
            amount: o.total,
            competenceDate: dateOnly(paidAt),
            installments: { create: { number: 1, dueDate: dateOnly(paidAt), amount: o.total, paymentMethod: o.paymentMethod, accountId: o.accountId, status: "SETTLED", settledAt: dateOnly(paidAt) } },
          },
        });
      } else {
        const entry = await tx.entry.create({
          data: {
            type: "INCOME",
            source: "ORDER",
            description: `Pedido #${o.number} — ${o.customer.name}`,
            amount: o.total,
            competenceDate: dateOnly(paidAt),
            categoryId: await salesCategoryId(tx),
            operationId: o.operationId,
            installments: { create: { number: 1, dueDate: dateOnly(paidAt), amount: o.total, paymentMethod: o.paymentMethod, accountId: o.accountId, status: "SETTLED", settledAt: dateOnly(paidAt) } },
          },
        });
        await tx.order.update({ where: { id: o.id }, data: { entryId: entry.id } });
      }
    }

    if (input.status === "CANCELED" && hasActiveEntry) {
      await assertMonthOpen(tx, toISO(o.entry!.competenceDate));
      await tx.entry.update({ where: { id: o.entry!.id }, data: { canceledAt: new Date(), cancelReason: `Pedido #${o.number} cancelado${input.note ? `: ${input.note}` : ""}` } });
    }

    const updated = await tx.order.update({
      where: { id: o.id },
      data: { status: input.status, paidAt: paidAt ? dateOnly(paidAt) : null, history: { create: { status: input.status, note: input.note } } },
    });
    await audit(
      { action: "order.status", entity: "Order", entityId: o.id, summary: `Pedido #${o.number}: ${ORDER_STATUS_LABELS[o.status]} → ${ORDER_STATUS_LABELS[input.status]}`, ip: meta.ip },
      tx,
    );
    return updated;
  });
}

export async function deleteOrder(db: PrismaClient, id: string, meta: Meta) {
  return db.$transaction(async (tx) => {
    const o = await tx.order.findUnique({ where: { id }, include: { entry: true } });
    if (!o) throw new DomainError("Pedido não encontrado.");
    if (o.entry && !o.entry.canceledAt) throw new DomainError("Pedido com pagamento confirmado não pode ser excluído. Cancele-o.");
    await tx.order.delete({ where: { id } });
    if (o.entry) {
      await assertMonthOpen(tx, toISO(o.entry.competenceDate));
      await tx.entry.delete({ where: { id: o.entry.id } });
    }
    await audit({ action: "order.delete", entity: "Order", entityId: id, summary: `Pedido #${o.number} excluído (${formatMoney(o.total)})`, ip: meta.ip }, tx);
  });
}

/** Pedidos que precisam de atenção (parados há tempo demais em uma etapa). */
export function needsAttention(o: { status: OrderStatus; updatedAt: Date; expectedDelivery: Date | null }, today: string, now = new Date()): string | null {
  const hours = (now.getTime() - o.updatedAt.getTime()) / 3_600_000;
  if (o.status === "RECEIVED" && hours > 12) return "Recebido há mais de 12h sem andamento";
  if (o.status === "AWAITING_PAYMENT" && hours > 24) return "Aguardando pagamento há mais de 1 dia";
  if ((o.status === "PAYMENT_CONFIRMED" || o.status === "IN_PREPARATION") && hours > 48) return "Pago e ainda não preparado após 2 dias";
  if (o.status === "READY_TO_SHIP" && hours > 24) return "Pronto e não enviado há mais de 1 dia";
  if (o.status === "SHIPPED" && o.expectedDelivery && toISO(o.expectedDelivery) < today) return "Previsão de entrega ultrapassada";
  return null;
}
