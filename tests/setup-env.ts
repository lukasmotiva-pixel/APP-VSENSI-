// Carrega o .env e aponta o Prisma para o banco de TESTE.
try {
  process.loadEnvFile(".env");
} catch {
  /* sem .env: usa variáveis do ambiente */
}
if (process.env.TEST_DATABASE_URL) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
if (process.env.DATABASE_URL && !/test/i.test(new URL(process.env.DATABASE_URL).pathname)) {
  throw new Error("Os testes só podem rodar em um banco cujo nome contenha 'test'.");
}
process.env.APP_TIMEZONE ??= "America/Sao_Paulo";
