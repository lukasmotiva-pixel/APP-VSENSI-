"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { cn } from "@/lib/cn";
import { NAV_SECTIONS, isActive } from "./nav-items";
import { logoutAction } from "@/modules/auth-actions";

export function Brand({ dark = true }: { dark?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid size-8 place-items-center rounded-lg bg-navy-800 text-sm font-bold text-white ring-1 ring-white/10">V</span>
      <div className="leading-tight">
        <p className={cn("text-[15px] font-semibold", dark ? "text-white" : "text-ink")}>V&apos;Sensi</p>
        <p className={cn("text-[11px] uppercase tracking-wider", dark ? "text-white/50" : "text-muted")}>Gestão</p>
      </div>
    </div>
  );
}

export function Sidebar({ userName }: { userName: string }) {
  const pathname = usePathname();
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-graphite-900 lg:flex">
      <div className="px-5 py-5">
        <Brand />
      </div>
      <nav className="flex-1 overflow-y-auto px-3 pb-4" aria-label="Menu principal">
        {NAV_SECTIONS.map((section) => (
          <div key={section.title} className="mb-4">
            <p className="px-2 pb-1.5 text-[11px] font-medium uppercase tracking-wider text-white/40">{section.title}</p>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const active = isActive(pathname, item.href, "exact" in item ? item.exact : false);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm transition-colors",
                        active ? "bg-white/10 font-medium text-white" : "text-white/70 hover:bg-white/5 hover:text-white",
                      )}
                    >
                      <Icon className="size-4 shrink-0" aria-hidden />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className="border-t border-white/10 px-3 py-3">
        <div className="flex items-center justify-between gap-2 px-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-white">{userName}</p>
            <p className="text-xs text-white/50">Administrador</p>
          </div>
          <form action={logoutAction}>
            <button type="submit" className="grid size-9 place-items-center rounded-lg text-white/60 hover:bg-white/10 hover:text-white" title="Sair" aria-label="Sair">
              <LogOut className="size-4" />
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
