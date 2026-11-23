"use server";

import { prisma } from "@/lib/db";
import { toActionError, type ActionState } from "@/lib/action-state";
import { getRequestMeta, requireAdmin } from "@/lib/auth/session";
import { DomainError } from "@/lib/errors";
import { parseMoneyToCents } from "@/lib/money";
import { saveAccount, saveCategory, saveOperation, saveSupplier } from "./service";

async function guard() {
  await requireAdmin();
  return { ip: (await getRequestMeta()).ip };
}

const str = (f: FormData, k: string) => String(f.get(k) ?? "");
const idOf = (f: FormData) => str(f, "id") || null;

async function run(path: string, fn: (meta: { ip: string | null }) => Promise<unknown>): Promise<ActionState> {
  try {
    await fn(await guard());
  } catch (e) {
    return toActionError(e);
  }
  return { ok: true, message: "Salvo.", redirectTo: `${path}?salvo=1` };
}

export async function saveOperationAction(_p: ActionState, f: FormData) {
  return run("/configuracoes/operacoes", (meta) =>
    saveOperation(prisma, idOf(f), { name: str(f, "name"), type: str(f, "type"), address: str(f, "address"), notes: str(f, "notes"), active: f.get("active") === "on", sortOrder: str(f, "sortOrder") || 0 }, meta),
  );
}

export async function saveAccountAction(_p: ActionState, f: FormData) {
  return run("/configuracoes/contas", async (meta) => {
    const raw = str(f, "openingBalance").trim();
    const negative = raw.startsWith("-");
    const cents = raw === "" ? 0 : parseMoneyToCents(raw.replace(/^-/, ""));
    if (cents === null) throw new DomainError("Saldo inicial inválido.", "openingBalance");
    return saveAccount(prisma, idOf(f), { name: str(f, "name"), type: str(f, "type"), operationId: str(f, "operationId"), openingBalance: negative ? -cents : cents, openingDate: str(f, "openingDate"), notes: str(f, "notes"), active: f.get("active") === "on" }, meta);
  });
}

export async function saveCategoryAction(_p: ActionState, f: FormData) {
  return run("/configuracoes/categorias", (meta) =>
    saveCategory(prisma, idOf(f), { name: str(f, "name"), type: str(f, "type"), group: str(f, "group"), active: f.get("active") === "on", sortOrder: str(f, "sortOrder") || 0 }, meta),
  );
}

export async function saveSupplierAction(_p: ActionState, f: FormData) {
  return run("/configuracoes/fornecedores", (meta) =>
    saveSupplier(prisma, idOf(f), { name: str(f, "name"), document: str(f, "document"), phone: str(f, "phone"), email: str(f, "email"), notes: str(f, "notes"), active: f.get("active") === "on" }, meta),
  );
}
