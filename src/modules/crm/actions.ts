"use server";

import { prisma } from "@/lib/db";
import { fmoney, fstr, guard, runAction } from "@/lib/action-helpers";
import type { ActionState } from "@/lib/action-state";
import { deleteCustomer, deleteInteraction, deleteQuickReply, saveCustomer, saveInteraction, saveProduct, saveQuickReply } from "./service";

export async function saveCustomerAction(_p: ActionState, f: FormData): Promise<ActionState> {
  return runAction(async (meta) => {
    const c = await saveCustomer(prisma, fstr(f, "id") || null, {
      name: fstr(f, "name"), phone: fstr(f, "phone"), instagram: fstr(f, "instagram"), channel: fstr(f, "channel"),
      city: fstr(f, "city"), address: fstr(f, "address"), notes: fstr(f, "notes"),
    }, meta);
    return { redirectTo: `/crm/clientes/${c.id}?salvo=1` };
  }, { message: "Cliente salvo." });
}

export async function deleteCustomerAction(_p: ActionState, f: FormData): Promise<ActionState> {
  return runAction(async (meta) => {
    await deleteCustomer(prisma, fstr(f, "id"), meta);
    return { redirectTo: "/crm/clientes" };
  }, { message: "Cliente excluído." });
}

export async function saveInteractionAction(_p: ActionState, f: FormData): Promise<ActionState> {
  return runAction(
    (meta) => saveInteraction(prisma, fstr(f, "id") || null, {
      customerId: fstr(f, "customerId"), channel: fstr(f, "channel"), date: fstr(f, "date"), summary: fstr(f, "summary"),
      status: fstr(f, "status"), attendant: fstr(f, "attendant"), followUpDate: fstr(f, "followUpDate"), orderId: fstr(f, "orderId"),
    }, meta).then(() => undefined),
    { message: "Atendimento registrado." },
  );
}

export async function setInteractionStatusAction(f: FormData): Promise<void> {
  const meta = await guard();
  const it = await prisma.interaction.findUniqueOrThrow({ where: { id: fstr(f, "id") } });
  await saveInteraction(prisma, it.id, {
    customerId: it.customerId, channel: it.channel, date: it.date.toISOString().slice(0, 10), summary: it.summary,
    status: fstr(f, "status"), attendant: it.attendant, followUpDate: it.followUpDate?.toISOString().slice(0, 10) ?? null, orderId: it.orderId,
  }, meta);
}

export async function deleteInteractionAction(f: FormData): Promise<void> {
  const meta = await guard();
  await deleteInteraction(prisma, fstr(f, "id"), meta);
}

export async function saveQuickReplyAction(_p: ActionState, f: FormData): Promise<ActionState> {
  return runAction(async (meta) => {
    await saveQuickReply(prisma, fstr(f, "id") || null, { title: fstr(f, "title"), text: fstr(f, "text"), category: fstr(f, "category"), sortOrder: fstr(f, "sortOrder") || 0 }, meta);
    return { redirectTo: "/crm/respostas?salvo=1" };
  }, { message: "Resposta salva." });
}

export async function deleteQuickReplyAction(f: FormData): Promise<void> {
  const meta = await guard();
  await deleteQuickReply(prisma, fstr(f, "id"), meta);
}

export async function saveProductAction(_p: ActionState, f: FormData): Promise<ActionState> {
  return runAction(async (meta) => {
    await saveProduct(prisma, fstr(f, "id") || null, { name: fstr(f, "name"), price: fmoney(f, "price", "Preço"), active: f.get("active") === "on", notes: fstr(f, "notes") }, meta);
    return { redirectTo: "/configuracoes/produtos?salvo=1" };
  }, { message: "Produto salvo." });
}
