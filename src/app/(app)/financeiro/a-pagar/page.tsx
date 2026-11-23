import type { SearchParams } from "@/lib/search-params";
import { OpenInstallmentsPage } from "@/modules/finance/components/open-installments-page";

export const metadata = { title: "Contas a pagar" };

export default async function PayablesPage({ searchParams }: { searchParams: SearchParams }) {
  return <OpenInstallmentsPage type="EXPENSE" sp={await searchParams} />;
}
