import { ArrowDownLeft, ArrowUpRight, BarChart3, CalendarCheck, Factory, LayoutDashboard, ListOrdered, MessagesSquare, Repeat, Settings, ShoppingBag, Store, Users, Wallet } from "lucide-react";

/** Apenas módulos já implementados aparecem no menu (sem links para telas inexistentes). */
export const NAV_SECTIONS = [
  {
    title: "Visão geral",
    items: [{ href: "/", label: "Início", icon: LayoutDashboard, exact: true }],
  },
  {
    title: "Operação",
    items: [
      { href: "/quiosques", label: "Quiosques", icon: Store },
      { href: "/pedidos", label: "Pedidos", icon: ShoppingBag },
      { href: "/crm", label: "Atendimento", icon: MessagesSquare },
      { href: "/pessoas", label: "Pessoas", icon: Users },
      { href: "/producao", label: "Compras e produção", icon: Factory },
    ],
  },
  {
    title: "Financeiro",
    items: [
      { href: "/financeiro", label: "Lançamentos", icon: ListOrdered, exact: true },
      { href: "/financeiro/a-pagar", label: "Contas a pagar", icon: ArrowUpRight },
      { href: "/financeiro/a-receber", label: "Contas a receber", icon: ArrowDownLeft },
      { href: "/financeiro/transferencias", label: "Transferências", icon: Repeat },
      { href: "/financeiro/saldos", label: "Saldos das contas", icon: Wallet },
      { href: "/financeiro/relatorios", label: "Relatórios", icon: BarChart3 },
      { href: "/financeiro/fechamentos", label: "Fechamentos", icon: CalendarCheck },
    ],
  },
  {
    title: "Sistema",
    items: [{ href: "/configuracoes", label: "Configurações", icon: Settings }],
  },
] as const;

export function isActive(pathname: string, href: string, exact?: boolean) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}
