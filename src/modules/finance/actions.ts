"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { toActionError, type ActionState } from "@/lib/action-state";
import { getRequestMeta, requireAdmin } from "@/lib/auth/session";
import { DomainError } from "@/lib/errors";
import { parseMoneyToCents } from "@/lib/money";
import { removeStored, storeUpload } from "@/lib/storage";
import * as service from "./service";

const id = z.string().min(1).max(40);

async function guard() {
  await requireAdmin();
  return { ip: (await getRequestMeta()).ip };
}

function refreshAll() {
  revalidatePath("/", "layout");
}

function optionalMoney(value: FormDataEntryValue | null, label: string): number | undefined {
  const s = String(value ?? "").trim();
  if (!s) return undefined;
  const cents = parseMoneyToCents(s);
  if (cents === null) throw new DomainError(`${label}: valor inválido.`);
  return cents;
}

// ---------------------------------------------------------------------------
// Lançamentos
// ---------------------------------------------------------------------------

/** O formulário envia os dados do lançamento como JSON (campo "payload"), montado no cliente. */
export async function saveEntryAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  let entryId: string;
  try {
    const meta = await guard();
    const raw = JSON.parse(String(form.get("payload") ?? "{}"));
    const existingId = String(form.get("entryId") ?? "");
    const entry = existingId
      ? await service.updateEntry(prisma, existingId, raw, meta)
      : await service.createEntry(prisma, raw, meta);
    entryId = entry.id;
  } catch (e) {
    if (e instanceof SyntaxError) return { ok: false, message: "Dados do formulário inválidos." };
    return toActionError(e);
  }
  return { ok: true, message: "Lançamento salvo.", redirectTo: `/financeiro/${entryId}?salvo=1` };
}

export async function settleInstallmentAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  try {
    const meta = await guard();
    await service.settleInstallment(
      prisma,
      {
        installmentId: form.get("installmentId"),
        settledAt: form.get("settledAt"),
        accountId: form.get("accountId") || null,
        paymentMethod: form.get("paymentMethod") || null,
        feeAmount: optionalMoney(form.get("feeAmount"), "Taxa"),
      },
      meta,
    );
  } catch (e) {
    return toActionError(e);
  }
  refreshAll();
  return { ok: true, message: "Baixa registrada." };
}

export async function unsettleInstallmentAction(form: FormData): Promise<void> {
  const meta = await guard();
  await service.unsettleInstallment(prisma, id.parse(form.get("installmentId")), meta);
  refreshAll();
}

export async function cancelEntryAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  try {
    const meta = await guard();
    await service.cancelEntry(prisma, { entryId: form.get("entryId"), reason: form.get("reason") }, meta);
  } catch (e) {
    return toActionError(e);
  }
  refreshAll();
  return { ok: true, message: "Lançamento cancelado." };
}

export async function restoreEntryAction(form: FormData): Promise<void> {
  const meta = await guard();
  await service.restoreEntry(prisma, id.parse(form.get("entryId")), meta);
  refreshAll();
}

export async function deleteEntryAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  try {
    const meta = await guard();
    const keys = await service.deleteEntry(prisma, id.parse(form.get("entryId")), meta);
    await removeStored(keys);
  } catch (e) {
    return toActionError(e);
  }
  return { ok: true, message: "Lançamento excluído.", redirectTo: "/financeiro?excluido=1" };
}

// ---------------------------------------------------------------------------
// Anexos
// ---------------------------------------------------------------------------

export async function uploadAttachmentAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  let storedKey: string | null = null;
  try {
    const meta = await guard();
    const entryId = id.parse(form.get("entryId"));
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) return { ok: false, message: "Escolha um arquivo." };
    const entry = await prisma.entry.findUnique({ where: { id: entryId } });
    if (!entry) return { ok: false, message: "Lançamento não encontrado." };
    const stored = await storeUpload(file);
    storedKey = stored.storageKey;
    await prisma.$transaction(async (tx) => {
      const att = await tx.attachment.create({ data: { entryId, ...stored } });
      await audit({ action: "finance.attachment.add", entity: "Entry", entityId: entryId, summary: `Anexo adicionado: ${stored.fileName}`, metadata: { attachmentId: att.id, sha256: stored.sha256 }, ip: meta.ip }, tx);
    });
  } catch (e) {
    if (storedKey) await removeStored([storedKey]);
    return toActionError(e);
  }
  refreshAll();
  return { ok: true, message: "Anexo enviado." };
}

export async function deleteAttachmentAction(form: FormData): Promise<void> {
  const meta = await guard();
  const attachmentId = id.parse(form.get("attachmentId"));
  const att = await prisma.attachment.findUnique({ where: { id: attachmentId } });
  if (!att) return;
  await prisma.$transaction(async (tx) => {
    await tx.attachment.delete({ where: { id: attachmentId } });
    await audit({ action: "finance.attachment.delete", entity: "Entry", entityId: att.entryId, summary: `Anexo removido: ${att.fileName}`, ip: meta.ip }, tx);
  });
  await removeStored([att.storageKey]);
  refreshAll();
}

// ---------------------------------------------------------------------------
// Transferências
// ---------------------------------------------------------------------------

export async function createTransferAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  try {
    const meta = await guard();
    const amount = parseMoneyToCents(String(form.get("amount") ?? ""));
    if (amount === null) throw new DomainError("Valor inválido.", "amount");
    await service.createTransfer(
      prisma,
      {
        date: form.get("date"),
        amount,
        fromAccountId: form.get("fromAccountId"),
        toAccountId: form.get("toAccountId"),
        description: form.get("description"),
        notes: form.get("notes"),
      },
      meta,
    );
  } catch (e) {
    return toActionError(e);
  }
  refreshAll();
  return { ok: true, message: "Transferência registrada." };
}

export async function deleteTransferAction(form: FormData): Promise<void> {
  const meta = await guard();
  await service.deleteTransfer(prisma, id.parse(form.get("transferId")), meta);
  refreshAll();
}

// ---------------------------------------------------------------------------
// Fechamento mensal
// ---------------------------------------------------------------------------

export async function closeMonthAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  try {
    const meta = await guard();
    await service.closeMonth(prisma, String(form.get("month") ?? ""), String(form.get("notes") ?? "") || null, meta);
  } catch (e) {
    return toActionError(e);
  }
  refreshAll();
  return { ok: true, message: "Mês fechado." };
}

export async function reopenMonthAction(form: FormData): Promise<void> {
  const meta = await guard();
  await service.reopenMonth(prisma, String(form.get("month") ?? ""), meta);
  refreshAll();
}
