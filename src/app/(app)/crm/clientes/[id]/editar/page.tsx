import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { CustomerForm, DeleteCustomerForm } from "@/modules/crm/components/forms";
import { Card, CardBody } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

export const metadata = { title: "Editar cliente" };

export default async function EditCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await prisma.customer.findUnique({ where: { id } });
  if (!c) notFound();
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader title={`Editar ${c.name}`} />
      <Card><CardBody><CustomerForm item={c} /></CardBody></Card>
      <DeleteCustomerForm id={c.id} />
    </div>
  );
}
