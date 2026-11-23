import { prisma } from "@/lib/db";

export async function getOrderFormOptions() {
  const [customers, products, operations, accounts] = await Promise.all([
    prisma.customer.findMany({ select: { id: true, name: true, phone: true }, orderBy: { name: "asc" }, take: 5000 }),
    prisma.product.findMany({ orderBy: { name: "asc" } }),
    prisma.operation.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
    prisma.financialAccount.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);
  return { customers, products, operations, accounts };
}
