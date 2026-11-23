"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { PERIOD_PRESETS } from "@/lib/dates";
import { cn } from "@/lib/cn";

function useParamUpdater() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const update = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(changes)) {
      if (v === null || v === "") next.delete(k);
      else next.set(k, v);
    }
    next.delete("pagina");
    start(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
  };
  return { params, update, pending };
}

const control = "h-10 rounded-lg border border-line-strong bg-surface px-2.5 text-[16px] sm:text-sm text-ink focus:border-navy-700 focus:outline-none";

/** Filtro de período (Hoje, Ontem, 7 dias, 30 dias, Mês atual, Mês anterior, Personalizado). */
export function PeriodFilter({ defaultKey = "month" }: { defaultKey?: string }) {
  const { params, update, pending } = useParamUpdater();
  const current = params.get("p") ?? defaultKey;
  const [from, setFrom] = useState(params.get("de") ?? "");
  const [to, setTo] = useState(params.get("ate") ?? "");
  return (
    <div className={cn("flex flex-wrap items-center gap-2", pending && "opacity-60")}>
      <select aria-label="Período" className={control} value={current} onChange={(e) => update({ p: e.target.value, ...(e.target.value !== "custom" ? { de: null, ate: null } : {}) })}>
        {PERIOD_PRESETS.map((p) => (
          <option key={p.key} value={p.key}>
            {p.label}
          </option>
        ))}
      </select>
      {current === "custom" ? (
        <>
          <input aria-label="De" type="date" className={control} value={from} onChange={(e) => setFrom(e.target.value)} />
          <input aria-label="Até" type="date" className={control} value={to} onChange={(e) => setTo(e.target.value)} />
          <button type="button" className="h-10 rounded-lg bg-navy-900 px-3 text-sm font-medium text-white" onClick={() => update({ p: "custom", de: from, ate: to })}>
            Aplicar
          </button>
        </>
      ) : null}
    </div>
  );
}

/** Select genérico que grava a escolha em um parâmetro da URL. */
export function ParamSelect({ name, label, options, allLabel = "Todos" }: { name: string; label: string; options: { value: string; label: string }[]; allLabel?: string | null }) {
  const { params, update, pending } = useParamUpdater();
  return (
    <select aria-label={label} className={cn(control, "max-w-full", pending && "opacity-60")} value={params.get(name) ?? ""} onChange={(e) => update({ [name]: e.target.value })}>
      {allLabel !== null ? <option value="">{allLabel}</option> : null}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function SearchInput({ name = "q", placeholder = "Buscar…" }: { name?: string; placeholder?: string }) {
  const { params, update } = useParamUpdater();
  const [value, setValue] = useState(params.get(name) ?? "");
  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        update({ [name]: value.trim() });
      }}
      className="min-w-0 flex-1"
    >
      <input aria-label={placeholder} type="search" className={cn(control, "w-full")} placeholder={placeholder} value={value} onChange={(e) => setValue(e.target.value)} maxLength={100} />
    </form>
  );
}
