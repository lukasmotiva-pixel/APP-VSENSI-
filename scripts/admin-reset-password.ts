/**
 * Redefine a senha do administrador diretamente no servidor (recuperação de último recurso).
 * Encerra todas as sessões abertas.  Uso: npm run admin:reset-password
 */
import { PrismaClient } from "@prisma/client";
import { hashPassword, validatePasswordStrength } from "../src/lib/auth/password";
import { ask } from "./prompt";

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.adminUser.findFirst();
  if (!user) throw new Error("Nenhum administrador cadastrado. Use: npm run admin:create");
  console.log(`Redefinindo a senha de ${user.email}`);
  const password = process.env.ADMIN_PASSWORD || (await ask("Nova senha (mín. 12 caracteres): ", true));
  const weak = validatePasswordStrength(password);
  if (weak) throw new Error(weak);
  if (!process.env.ADMIN_PASSWORD && (await ask("Confirme a nova senha: ", true)) !== password)
    throw new Error("As senhas não conferem.");
  await prisma.$transaction([
    prisma.adminUser.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(password), passwordChangedAt: new Date(), failedLoginCount: 0, lockedUntil: null },
    }),
    prisma.session.deleteMany({ where: { userId: user.id } }),
    prisma.auditLog.create({ data: { action: "auth.password.reset_cli", summary: "Senha redefinida via script no servidor; sessões encerradas" } }),
  ]);
  console.log("Senha redefinida. Todas as sessões foram encerradas.");
}

main()
  .catch((e) => {
    console.error("Erro:", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
