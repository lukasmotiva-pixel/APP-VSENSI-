import type { Prisma } from "@prisma/client";
import { prisma } from "./db";

type Tx = Prisma.TransactionClient;

export interface AuditInput {
  action: string;
  summary: string;
  entity?: string;
  entityId?: string;
  metadata?: Prisma.InputJsonValue;
  ip?: string | null;
}

/** Registra uma atividade importante. Aceita o cliente de uma transação para gravar junto. */
export async function audit(input: AuditInput, tx: Tx = prisma): Promise<void> {
  await tx.auditLog.create({
    data: {
      action: input.action,
      summary: input.summary,
      entity: input.entity,
      entityId: input.entityId,
      metadata: input.metadata,
      ip: input.ip ?? null,
    },
  });
}
