"use client";

/**
 * Gráficos (Recharts). Paleta validada para daltonismo e contraste no fundo claro:
 *   série 1 (entradas/faturamento) #2a5aa0 · série 2 (saídas) #c2620f
 * Marcas finas, cantos de 4px na ponta, grade discreta, tooltip ao passar/tocar.
 */
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from "recharts";
import { formatMoney } from "@/lib/money";

const SERIES_1 = "#2a5aa0";
const SERIES_2 = "#c2620f";
const GRID = "#e3e6eb";
const AXIS = "#5d6573";

function compactMoney(cents: number) {
  const v = cents / 100;
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
  if (Math.abs(v) >= 1_000) return `${(v / 1_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
  return v.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
}

function ChartTooltip({ active, payload, label }: TooltipContentProps<number, string>) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-medium text-ink">{label}</p>
      {payload.map((p) => (
        <p key={String(p.dataKey)} className="flex items-center gap-2 text-muted">
          <span className="inline-block size-2 rounded-sm" style={{ background: p.color }} aria-hidden />
          {p.name}: <span className="num font-medium text-ink">{formatMoney(Number(p.value))}</span>
        </p>
      ))}
    </div>
  );
}

export function RevenueBarChart({ data, height = 220 }: { data: { label: string; revenue: number }[]; height?: number }) {
  return (
    <div style={{ height }} role="img" aria-label="Gráfico de faturamento por dia">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barCategoryGap={data.length > 20 ? 2 : "20%"}>
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: GRID }} tick={{ fill: AXIS, fontSize: 11 }} interval="preserveStartEnd" minTickGap={16} />
          <YAxis tickFormatter={compactMoney} tickLine={false} axisLine={false} tick={{ fill: AXIS, fontSize: 11 }} width={48} />
          <Tooltip content={(p) => <ChartTooltip {...(p as TooltipContentProps<number, string>)} />} cursor={{ fill: "rgba(11,30,59,0.05)" }} />
          <Bar dataKey="revenue" name="Faturamento" fill={SERIES_1} radius={[4, 4, 0, 0]} maxBarSize={36} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CashFlowChart({ data, height = 240 }: { data: { label: string; inflow: number; outflow: number }[]; height?: number }) {
  return (
    <div>
      <div className="mb-2 flex gap-4 text-xs text-muted" aria-hidden>
        <span className="flex items-center gap-1.5"><span className="inline-block size-2.5 rounded-sm" style={{ background: SERIES_1 }} />Entradas</span>
        <span className="flex items-center gap-1.5"><span className="inline-block size-2.5 rounded-sm" style={{ background: SERIES_2 }} />Saídas</span>
      </div>
      <div style={{ height }} role="img" aria-label="Gráfico de entradas e saídas de caixa">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barGap={2}>
            <CartesianGrid vertical={false} stroke={GRID} />
            <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: GRID }} tick={{ fill: AXIS, fontSize: 11 }} interval="preserveStartEnd" minTickGap={16} />
            <YAxis tickFormatter={compactMoney} tickLine={false} axisLine={false} tick={{ fill: AXIS, fontSize: 11 }} width={48} />
            <Tooltip content={(p) => <ChartTooltip {...(p as TooltipContentProps<number, string>)} />} cursor={{ fill: "rgba(11,30,59,0.05)" }} />
            <Bar dataKey="inflow" name="Entradas" fill={SERIES_1} radius={[4, 4, 0, 0]} maxBarSize={28} />
            <Bar dataKey="outflow" name="Saídas" fill={SERIES_2} radius={[4, 4, 0, 0]} maxBarSize={28} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/** Barra horizontal simples (HTML) para comparar operações — legível no celular, sem eixo. */
export function HBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className="h-2 w-full rounded-full bg-canvas" aria-hidden>
      <div className="h-2 rounded-full" style={{ width: `${pct}%`, background: SERIES_1 }} />
    </div>
  );
}
