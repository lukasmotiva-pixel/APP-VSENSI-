/** CRM: clientes, atendimentos, respostas rápidas e catálogo de produtos. */
import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { dateOnly } from "@/lib/dates";
import { DomainError } from "@/lib/errors";
import { MAX_CENTS } from "@/lib/money";
import { isoDate, optionalIsoDate } from "@/modules/finance/schemas";

interface Meta {
  ip: string | null;
}
const text = (max: number) => z.string().trim().max(max).nullish().transform((v) => v || null);
const channel = z.enum(["WHATSAPP", "INSTAGRAM", "KIOSK", "OTHER"]);

export const INTERACTION_STATUS_LABELS = {
  PENDING: "Pendente",
  INTERESTED: "Interessado (oportunidade)",
  CONVERTED: "Comprou",
  LOST: "Não comprou",
} as const;

export const customerSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome.").max(120),
  phone: text(30),
  instagram: text(60).transform((v) => (v ? v.replace(/^@/, "") : v)),
  channel,
  city: text(80),
  address: text(500),
  notes: text(2000),
});

export async function saveCustomer(db: PrismaClient, id: string | null, raw: unknown, meta: Meta) {
  const data = customerSchema.parse(raw);
  const c = id ? await db.customer.update({ where: { id }, data }) : await db.customer.create({ data });
  await audit({ action: id ? "crm.customer.update" : "crm.customer.create", entity: "Customer", entityId: c.id, summary: `Cliente ${id ? "atualizado" : "cadastrado"}: ${c.name}`, ip: meta.ip }, db);
  return c;
}

export async function deleteCustomer(db: PrismaClient, id: string, meta: Meta) {
  const orders = await db.order.count({ where: { customerId: id } });
  if (orders > 0) throw new DomainError("Este cliente tem pedidos e não pode ser excluído.");
  const c = await db.customer.delete({ where: { id } });
  await audit({ action: "crm.customer.delete", entity: "Customer", entityId: id, summary: `Cliente excluído: ${c.name}`, ip: meta.ip }, db);
}

export const interactionSchema = z.object({
  customerId: z.string().min(1),
  channel,
  date: isoDate,
  summary: z.string().trim().min(2, "Descreva o atendimento.").max(2000),
  status: z.enum(["PENDING", "INTERESTED", "CONVERTED", "LOST"]),
  attendant: text(80),
  followUpDate: optionalIsoDate,
  orderId: z.string().max(40).nullish().transform((v) => v || null),
});

export async function saveInteraction(db: PrismaClient, id: string | null, raw: unknown, meta: Meta) {
  const input = interactionSchema.parse(raw);
  if (input.orderId) {
    const o = await db.order.findUnique({ where: { id: input.orderId } });
    if (!o || o.customerId !== input.customerId) throw new DomainError("Pedido não pertence a este cliente.", "orderId");
  }
  const data = { ...input, date: dateOnly(input.date), followUpDate: input.followUpDate ? dateOnly(input.followUpDate) : null };
  const it = id ? await db.interaction.update({ where: { id }, data }) : await db.interaction.create({ data });
  await audit({ action: id ? "crm.interaction.update" : "crm.interaction.create", entity: "Customer", entityId: input.customerId, summary: `Atendimento ${id ? "atualizado" : "registrado"} (${INTERACTION_STATUS_LABELS[input.status]})`, ip: meta.ip }, db);
  return it;
}

export async function deleteInteraction(db: PrismaClient, id: string, meta: Meta) {
  const it = await db.interaction.delete({ where: { id } });
  await audit({ action: "crm.interaction.delete", entity: "Customer", entityId: it.customerId, summary: "Atendimento excluído", ip: meta.ip }, db);
}

export const quickReplySchema = z.object({
  title: z.string().trim().min(2, "Informe um título.").max(80),
  text: z.string().trim().min(2, "Escreva a resposta.").max(4000),
  category: text(60),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
});

export async function saveQuickReply(db: PrismaClient, id: string | null, raw: unknown, meta: Meta) {
  const data = quickReplySchema.parse(raw);
  const r = id ? await db.quickReply.update({ where: { id }, data }) : await db.quickReply.create({ data });
  await audit({ action: "crm.quickreply.save", summary: `Resposta rápida salva: ${r.title}`, ip: meta.ip }, db);
  return r;
}

export async function deleteQuickReply(db: PrismaClient, id: string, meta: Meta) {
  const r = await db.quickReply.delete({ where: { id } });
  await audit({ action: "crm.quickreply.delete", summary: `Resposta rápida excluída: ${r.title}`, ip: meta.ip }, db);
}

export const productSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome.").max(120),
  price: z.number().int().min(0).max(MAX_CENTS),
  active: z.boolean(),
  notes: text(1000),
});

export async function saveProduct(db: PrismaClient, id: string | null, raw: unknown, meta: Meta) {
  const data = productSchema.parse(raw);
  try {
    const p = id ? await db.product.update({ where: { id }, data }) : await db.product.create({ data });
    await audit({ action: "catalog.product.save", entity: "Product", entityId: p.id, summary: `Produto salvo: ${p.name}`, ip: meta.ip }, db);
    return p;
  } catch (e) {
    if (e && typeof e === "object" && "code" in e && e.code === "P2002") throw new DomainError("Já existe um produto com este nome.", "name");
    throw e;
  }
}
