"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const ITEMS = [
  { href: "/configuracoes/operacoes", label: "Operações" },
  { href: "/configuracoes/contas", label: "Contas" },
  { href: "/configuracoes/categorias", label: "Categorias" },
  { href: "/configuracoes/fornecedores", label: "Fornecedores" },
  { href: "/configuracoes/seguranca", label: "Segurança" },
  { href: "/configuracoes/auditoria", label: "Auditoria" },
];

export function SettingsNav() {
  const pathname = usePathname();
  return (
    <nav className="-mx-4 mb-5 overflow-x-auto px-4 sm:mx-0 sm:px-0" aria-label="Configurações">
      <ul className="flex w-max gap-1 rounded-lg border border-line-strong bg-surface p-1 text-sm">
        {ITEMS.map((i) => (
          <li key={i.href}>
            <Link href={i.href} aria-current={pathname.startsWith(i.href) ? "page" : undefined} className={cn("block rounded-md px-3 py-1.5 whitespace-nowrap", pathname.startsWith(i.href) ? "bg-navy-900 text-white" : "text-muted hover:text-ink")}>
              {i.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
