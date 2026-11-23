/**
 * Cria o ÚNICO usuário administrador (Val). Executar no servidor:
 *   npm run admin:create
 * Modo não interativo (ex.: implantação): defina ADMIN_NAME, ADMIN_EMAIL e ADMIN_PASSWORD.
 * O banco recusa um segundo usuário (coluna singleton única).
 */
import { PrismaClient } from "@prisma/client";
import { hashPassword, validatePasswordStrength } from "../src/lib/auth/password";
import { seedDefaults } from "../prisma/seed";
import { ask } from "./prompt";

const prisma = new PrismaClient();

async function main() {
  if ((await prisma.adminUser.count()) > 0) {
    console.error("Já existe um administrador. Para trocar a senha use: npm run admin:reset-password");
    process.exitCode = 1;
    return;
  }
  const name = process.env.ADMIN_NAME || (await ask("Nome: "));
  const email = (process.env.ADMIN_EMAIL || (await ask("E-mail: "))).trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("E-mail inválido.");
  const password = process.env.ADMIN_PASSWORD || (await ask("Senha (mín. 12 caracteres): ", true));
  const weak = validatePasswordStrength(password);
  if (weak) throw new Error(weak);
  if (!process.env.ADMIN_PASSWORD) {
    const confirm = await ask("Confirme a senha: ", true);
    if (confirm !== password) throw new Error("As senhas não conferem.");
  }
  await prisma.adminUser.create({ data: { name: name.trim(), email, passwordHash: await hashPassword(password) } });
  await prisma.auditLog.create({ data: { action: "auth.admin.create", summary: `Administrador criado (${email}) via script` } });
  await seedDefaults(prisma);
  console.log("Administrador criado. Gere seus códigos de recuperação em Configurações → Segurança.");
}

main()
  .catch((e) => {
    console.error("Erro:", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
