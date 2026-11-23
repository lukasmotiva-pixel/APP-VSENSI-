"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, LayoutDashboard, ListOrdered, LogOut, Menu, Plus, Repeat, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { Brand } from "./sidebar";
import { NAV_SECTIONS, isActive } from "./nav-items";
import { logoutAction } from "@/modules/auth-actions";

const TABS = [
  { href: "/", label: "Início", icon: LayoutDashboard, exact: true },
  { href: "/financeiro", label: "Lançamentos", icon: ListOrdered, exact: true },
  { href: "/financeiro/a-pagar", label: "A pagar", icon: ArrowUpRight },
];

export function MobileTopBar() {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-white/10 bg-graphite-900 px-4 lg:hidden">
      <Brand />
    </header>
  );
}

export function MobileBottomNav() {
  const pathname = usePathname();
  const [sheet, setSheet] = useState<null | "new" | "menu">(null);

  useEffect(() => setSheet(null), [pathname]);
  useEffect(() => {
    if (!sheet) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSheet(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sheet]);

  return (
    <>
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur lg:hidden" aria-label="Navegação">
        <ul className="mx-auto grid max-w-lg grid-cols-5 items-end px-1 pt-1.5">
          {TABS.slice(0, 2).map((t) => (
            <TabLink key={t.href} {...t} active={isActive(pathname, t.href, t.exact)} />
          ))}
          <li className="flex justify-center">
            <button
              type="button"
              onClick={() => setSheet(sheet === "new" ? null : "new")}
              className="-mt-4 grid size-13 place-items-center rounded-full bg-navy-900 text-white shadow-lg shadow-navy-900/25 active:bg-navy-950"
              aria-label="Novo lançamento"
              aria-expanded={sheet === "new"}
            >
              <Plus className="size-6" />
            </button>
          </li>
          <TabLink {...TABS[2]!} active={isActive(pathname, TABS[2]!.href)} />
          <li>
            <button
              type="button"
              onClick={() => setSheet(sheet === "menu" ? null : "menu")}
              className="flex w-full flex-col items-center gap-0.5 py-1 text-[11px] text-muted"
              aria-expanded={sheet === "menu"}
            >
              <Menu className="size-5" />
              Mais
            </button>
          </li>
        </ul>
      </nav>

      {sheet ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <button type="button" className="absolute inset-0 bg-black/40" aria-label="Fechar" onClick={() => setSheet(null)} />
          <div className="pb-safe absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-2xl bg-surface px-4 pt-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="font-semibold">{sheet === "new" ? "Novo" : "Menu"}</p>
              <button type="button" onClick={() => setSheet(null)} className="grid size-10 place-items-center rounded-lg text-muted" aria-label="Fechar">
                <X className="size-5" />
              </button>
            </div>
            {sheet === "new" ? (
              <div className="grid gap-2 pb-3">
                <SheetLink href="/financeiro/novo?tipo=entrada" icon={ArrowDownLeft} label="Nova entrada" desc="Venda, recebimento ou outra receita" />
                <SheetLink href="/financeiro/novo?tipo=saida" icon={ArrowUpRight} label="Nova saída" desc="Despesa, compra, boleto, salário" />
                <SheetLink href="/financeiro/transferencias" icon={Repeat} label="Transferência entre contas" desc="Ex.: depósito do caixa no banco" />
              </div>
            ) : (
              <div className="pb-3">
                {NAV_SECTIONS.map((s) => (
                  <div key={s.title} className="mb-3">
                    <p className="pb-1 text-xs font-medium uppercase tracking-wider text-subtle">{s.title}</p>
                    <ul className="divide-y divide-line rounded-xl border border-line">
                      {s.items.map((item) => {
                        const Icon = item.icon;
                        return (
                          <li key={item.href}>
                            <Link href={item.href} className="flex h-12 items-center gap-3 px-3 text-[15px]">
                              <Icon className="size-4.5 text-muted" aria-hidden />
                              {item.label}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
                <form action={logoutAction}>
                  <button type="submit" className="flex h-12 w-full items-center gap-3 rounded-xl border border-line px-3 text-[15px] text-negative">
                    <LogOut className="size-4.5" /> Sair
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}

function TabLink({ href, label, icon: Icon, active }: { href: string; label: string; icon: React.ComponentType<{ className?: string }>; active: boolean }) {
  return (
    <li>
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        className={cn("flex flex-col items-center gap-0.5 py-1 text-[11px]", active ? "font-medium text-navy-900" : "text-muted")}
      >
        <Icon className="size-5" />
        {label}
      </Link>
    </li>
  );
}

function SheetLink({ href, icon: Icon, label, desc }: { href: string; icon: React.ComponentType<{ className?: string }>; label: string; desc: string }) {
  return (
    <Link href={href} className="flex items-center gap-3 rounded-xl border border-line px-3 py-3 active:bg-canvas">
      <span className="grid size-10 place-items-center rounded-lg bg-navy-50 text-navy-900">
        <Icon className="size-5" />
      </span>
      <span>
        <span className="block text-[15px] font-medium">{label}</span>
        <span className="block text-sm text-muted">{desc}</span>
      </span>
    </Link>
  );
}
