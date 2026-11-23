import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { todayISO, toISO } from "@/lib/dates";
import { getOrderFormOptions } from "@/modules/orders/form-options";
import { OrderForm } from "@/modules/orders/components/order-form";
import { PageHeader } from "@/components/ui/page-header";

export const metadata = { title: "Editar pedido" };

export default async function EditOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const o = await prisma.order.findUnique({ where: { id }, include: { items: true } });
  if (!o) notFound();
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={`Editar pedido #${o.number}`} description={o.entryId ? "Este pedido já está pago: a alteração de valor atualiza a venda no financeiro." : undefined} />
      <OrderForm
        today={todayISO()}
        {...await getOrderFormOptions()}
        initial={{
          id: o.id, customerId: o.customerId, operationId: o.operationId, channel: o.channel, orderDate: toISO(o.orderDate),
          items: o.items.map((i) => ({ productId: i.productId, description: i.description, quantity: i.quantity, unitPrice: i.unitPrice })),
          discount: o.discount, shippingFee: o.shippingFee, paymentMethod: o.paymentMethod, accountId: o.accountId, attendant: o.attendant,
          deliveryMethod: o.deliveryMethod, address: o.address, trackingCode: o.trackingCode, deliveryPerson: o.deliveryPerson,
          excursionInfo: o.excursionInfo, expectedDelivery: o.expectedDelivery ? toISO(o.expectedDelivery) : null, notes: o.notes,
        }}
      />
    </div>
  );
}
