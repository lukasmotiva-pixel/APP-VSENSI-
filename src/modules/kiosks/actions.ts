"use server";

import { prisma } from "@/lib/db";
import { fmoney, fstr, guard, runAction } from "@/lib/action-helpers";
import type { ActionState } from "@/lib/action-state";
import { deleteClosing, saveClosing } from "./service";

export async function saveClosingAction(_p: ActionState, f: FormData): Promise<ActionState> {
  return runAction(async (meta) => {
    const operationId = fstr(f, "operationId");
    const c = await saveClosing(
      prisma,
      fstr(f, "id") || null,
      {
        operationId,
        date: fstr(f, "date"),
        cash: fmoney(f, "cash", "Dinheiro"),
        pix: fmoney(f, "pix", "Pix"),
        debit: fmoney(f, "debit", "Débito"),
        credit: fmoney(f, "credit", "Crédito"),
        other: fmoney(f, "other", "Outros"),
        debitFee: fmoney(f, "debitFee", "Taxa do débito"),
        creditFee: fmoney(f, "creditFee", "Taxa do crédito"),
        creditReceiveDate: fstr(f, "creditReceiveDate"),
        cashAccountId: fstr(f, "cashAccountId"),
        pixAccountId: fstr(f, "pixAccountId"),
        cardAccountId: fstr(f, "cardAccountId"),
        notes: fstr(f, "notes"),
      },
      meta,
    );
    return { redirectTo: `/quiosques/${c.operationId}?salvo=1` };
  }, { message: "Fechamento salvo." });
}

export async function deleteClosingAction(f: FormData): Promise<void> {
  const meta = await guard();
  await deleteClosing(prisma, fstr(f, "id"), meta);
}
