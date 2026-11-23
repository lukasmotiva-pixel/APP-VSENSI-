/**
 * Seed de CONFIGURAÇÕES PADRÃO (idempotente).
 * Não cria nenhum dado de negócio (lançamentos, saldos, contas bancárias, fornecedores).
 * Operações recebem nomes genéricos ("Quiosque 1"...), que o Val renomeia em Configurações.
 */
import { PrismaClient, type CategoryGroup, type EntryType, type OperationType } from "@prisma/client";

const prisma = new PrismaClient();

const operations: { name: string; type: OperationType; sortOrder: number }[] = [
  { name: "Quiosque 1", type: "KIOSK", sortOrder: 1 },
  { name: "Quiosque 2", type: "KIOSK", sortOrder: 2 },
  { name: "Quiosque 3", type: "KIOSK", sortOrder: 3 },
  { name: "Quiosque 4", type: "KIOSK", sortOrder: 4 },
  { name: "Quiosque 5", type: "KIOSK", sortOrder: 5 },
  { name: "Online", type: "ONLINE", sortOrder: 6 },
  { name: "Central / administrativo", type: "CENTRAL", sortOrder: 7 },
];

const categories: { name: string; type: EntryType; group: CategoryGroup }[] = [
  // Entradas
  { name: "Vendas", type: "INCOME", group: "SALES" },
  { name: "Outras receitas", type: "INCOME", group: "OTHER_INCOME" },
  { name: "Rendimentos financeiros", type: "INCOME", group: "OTHER_INCOME" },
  // Custos de produção
  { name: "Matérias-primas", type: "EXPENSE", group: "PRODUCTION_COST" },
  { name: "Embalagens", type: "EXPENSE", group: "PRODUCTION_COST" },
  { name: "Outros custos de fabricação", type: "EXPENSE", group: "PRODUCTION_COST" },
  // Pessoal
  { name: "Salários", type: "EXPENSE", group: "PAYROLL" },
  { name: "Encargos e benefícios", type: "EXPENSE", group: "PAYROLL" },
  { name: "Pró-labore", type: "EXPENSE", group: "PAYROLL" },
  // Operacionais
  { name: "Aluguel", type: "EXPENSE", group: "OPERATING_EXPENSE" },
  { name: "Contas de consumo (água, luz, internet, telefone)", type: "EXPENSE", group: "OPERATING_EXPENSE" },
  { name: "Manutenção", type: "EXPENSE", group: "OPERATING_EXPENSE" },
  { name: "Fretes e entregas", type: "EXPENSE", group: "OPERATING_EXPENSE" },
  { name: "Marketing e anúncios", type: "EXPENSE", group: "OPERATING_EXPENSE" },
  { name: "Outras despesas operacionais", type: "EXPENSE", group: "OPERATING_EXPENSE" },
  // Administrativas
  { name: "Contabilidade", type: "EXPENSE", group: "ADMINISTRATIVE_EXPENSE" },
  { name: "Sistemas e assinaturas", type: "EXPENSE", group: "ADMINISTRATIVE_EXPENSE" },
  { name: "Outras despesas administrativas", type: "EXPENSE", group: "ADMINISTRATIVE_EXPENSE" },
  // Financeiras, impostos, deduções
  { name: "Taxas de cartão", type: "EXPENSE", group: "FINANCIAL_FEES" },
  { name: "Tarifas bancárias e juros", type: "EXPENSE", group: "FINANCIAL_FEES" },
  { name: "Impostos", type: "EXPENSE", group: "TAXES" },
  { name: "Estornos e devoluções", type: "EXPENSE", group: "SALES_DEDUCTION" },
  { name: "Outras despesas", type: "EXPENSE", group: "OTHER_EXPENSE" },
  // Fora do resultado
  { name: "Retiradas do proprietário", type: "EXPENSE", group: "OWNER_WITHDRAWAL" },
  { name: "Investimentos e equipamentos", type: "EXPENSE", group: "INVESTMENT" },
];

/**
 * Só insere quando a tabela está vazia: se o Val renomear "Quiosque 1" ou uma categoria,
 * executar o seed de novo não recria os nomes antigos.
 */
export async function seedDefaults(db: PrismaClient = prisma) {
  if ((await db.operation.count()) === 0) {
    await db.operation.createMany({ data: operations });
  }
  if ((await db.category.count()) === 0) {
    await db.category.createMany({ data: categories.map((c, i) => ({ ...c, sortOrder: i })) });
  }
}

// Executa apenas quando chamado diretamente (npm run db:seed)
if (process.argv[1]?.includes("seed")) {
  seedDefaults()
    .then(() => console.log("Configurações padrão criadas/verificadas."))
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
