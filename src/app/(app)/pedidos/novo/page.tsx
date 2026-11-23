import { todayISO } from "@/lib/dates";
import { param, type SearchParams } from "@/lib/search-params";
import { getOrderFormOptions } from "@/modules/orders/form-options";
import { OrderForm } from "@/modules/orders/components/order-form";
import { PageHeader } from "@/components/ui/page-header";

export const metadata = { title: "Novo pedido" };

export default async function NewOrderPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Novo pedido" />
      <OrderForm today={todayISO()} presetCustomerId={param(sp, "cliente")} {...await getOrderFormOptions()} />
    </div>
  );
}
