import { PrismaClient } from "@prisma/client";
import { seedDefaults } from "../../prisma/seed";

export const db = new PrismaClient();
export const meta = { ip: "127.0.0.1" };

/** Limpa todas as tabelas e recria as configurações padrão. */
export async function resetDb() {
  const tables = await db.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  await db.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(", ")} RESTART IDENTITY CASCADE`);
  await seedDefaults(db);
}

export async function category(name: string) {
  return db.category.findFirstOrThrow({ where: { name } });
}
export async function operation(name: string) {
  return db.operation.findFirstOrThrow({ where: { name } });
}
