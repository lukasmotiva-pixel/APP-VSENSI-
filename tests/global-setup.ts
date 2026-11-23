import { execSync } from "node:child_process";

/** Aplica as migrações no banco de teste antes da suíte. */
export default function setup() {
  try {
    process.loadEnvFile(".env");
  } catch {
    /* ok */
  }
  const url = process.env.TEST_DATABASE_URL;
  if (!url) return; // sem banco de teste: testes de integração serão ignorados
  if (!/test/i.test(new URL(url).pathname)) throw new Error("TEST_DATABASE_URL precisa apontar para um banco de teste.");
  execSync("npx prisma migrate deploy", { env: { ...process.env, DATABASE_URL: url }, stdio: "pipe" });
}
