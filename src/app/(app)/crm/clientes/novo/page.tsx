import { CustomerForm } from "@/modules/crm/components/forms";
import { Card, CardBody } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

export const metadata = { title: "Novo cliente" };

export default function NewCustomerPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Novo cliente" />
      <Card><CardBody><CustomerForm /></CardBody></Card>
    </div>
  );
}
