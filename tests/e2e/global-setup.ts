import { execSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../../src/lib/auth/password";
import { seedDefaults } from "../../prisma/seed";

export const E2E_ADMIN = { email: "admin-e2e@example.com", password: "senha-de-teste-e2e-123" };

/** Banco E2E limpo, com as configurações padrão e um administrador de TESTE. */
export default async function globalSetup() {
  const url = process.env.E2E_DATABASE_URL;
  if (!url || !/e2e/.test(new URL(url).pathname)) throw new Error("Defina E2E_DATABASE_URL apontando para um banco *_e2e.");
  execSync("npx prisma migrate deploy", { env: { ...process.env, DATABASE_URL: url }, stdio: "pipe" });
  const db = new PrismaClient({ datasources: { db: { url } } });
  const tables = await db.$queryRaw<{ tablename: string }[]>`SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename <> '_prisma_migrations'`;
  await db.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(", ")} CASCADE`);
  await seedDefaults(db);
  await db.adminUser.create({ data: { name: "Administrador de teste", email: E2E_ADMIN.email, passwordHash: await hashPassword(E2E_ADMIN.password) } });
  await db.$disconnect();
}
