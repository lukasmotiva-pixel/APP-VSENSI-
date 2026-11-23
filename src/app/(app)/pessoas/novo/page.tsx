import { prisma } from "@/lib/db";
import { EmployeeForm } from "@/modules/people/components/forms";
import { Card, CardBody } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

export const metadata = { title: "Novo funcionário" };

export default async function NewEmployeePage() {
  const operations = await prisma.operation.findMany({ where: { active: true, type: { not: "CENTRAL" } }, orderBy: { sortOrder: "asc" } });
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Novo funcionário" />
      <Card><CardBody><EmployeeForm operations={operations} /></CardBody></Card>
    </div>
  );
}
