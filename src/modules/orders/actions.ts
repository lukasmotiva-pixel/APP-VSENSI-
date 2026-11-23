"use server";

import { prisma } from "@/lib/db";
import { fstr, guard, runAction } from "@/lib/action-helpers";
import type { ActionState } from "@/lib/action-state";
import { changeOrderStatus, createOrder, deleteOrder, updateOrder } from "./service";

/** O formulário de pedido envia os dados como JSON (campo "payload"), montado no cliente. */
export async function saveOrderAction(_p: ActionState, f: FormData): Promise<ActionState> {
  return runAction(async (meta) => {
    const raw = JSON.parse(fstr(f, "payload") || "{}");
    const id = fstr(f, "id");
    const o = id ? await updateOrder(prisma, id, raw, meta) : await createOrder(prisma, raw, meta);
    return { redirectTo: `/pedidos/${o.id}?salvo=1` };
  }, { message: "Pedido salvo." });
}

export async function changeOrderStatusAction(_p: ActionState, f: FormData): Promise<ActionState> {
  return runAction(
    (meta) => changeOrderStatus(prisma, { orderId: fstr(f, "orderId"), status: fstr(f, "status"), paidAt: fstr(f, "paidAt"), note: fstr(f, "note") }, meta).then(() => undefined),
    { message: "Status atualizado." },
  );
}

export async function deleteOrderAction(_p: ActionState, f: FormData): Promise<ActionState> {
  return runAction(async (meta) => {
    await deleteOrder(prisma, fstr(f, "id"), meta);
    return { redirectTo: "/pedidos?excluido=1" };
  }, { message: "Pedido excluído." });
}

export async function quickStatusAction(f: FormData): Promise<void> {
  const meta = await guard();
  await changeOrderStatus(prisma, { orderId: fstr(f, "orderId"), status: fstr(f, "status") }, meta);
}
