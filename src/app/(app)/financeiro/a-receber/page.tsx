import type { SearchParams } from "@/lib/search-params";
import { OpenInstallmentsPage } from "@/modules/finance/components/open-installments-page";

export const metadata = { title: "Contas a receber" };

export default async function ReceivablesPage({ searchParams }: { searchParams: SearchParams }) {
  return <OpenInstallmentsPage type="INCOME" sp={await searchParams} />;
}
