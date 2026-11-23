/**
 * Datas de negócio são tratadas como texto ISO "AAAA-MM-DD" (sem hora e sem fuso).
 * No banco ficam em colunas DATE; o Prisma as devolve como Date à meia-noite UTC.
 * "Hoje" é sempre calculado no fuso de negócio (America/Sao_Paulo por padrão).
 */

export const APP_TIMEZONE = process.env.APP_TIMEZONE || "America/Sao_Paulo";

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isValidISODate(iso: string): boolean {
  const m = ISO_RE.exec(iso);
  if (!m) return false;
  const d = new Date(`${iso}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso;
}

/** Data de hoje no fuso de negócio, em ISO. */
export function todayISO(now: Date = new Date(), timeZone: string = APP_TIMEZONE): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return parts; // en-CA => AAAA-MM-DD
}

/** "AAAA-MM-DD" -> Date (meia-noite UTC), adequado para colunas DATE. */
export function dateOnly(iso: string): Date {
  if (!isValidISODate(iso)) throw new Error(`Data inválida: ${iso}`);
  return new Date(`${iso}T00:00:00.000Z`);
}

/** Date (coluna DATE) -> "AAAA-MM-DD". */
export function toISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDaysISO(iso: string, days: number): string {
  const d = dateOnly(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return toISO(d);
}

function daysInMonth(year: number, month0: number): number {
  return new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
}

/** Soma meses mantendo o dia; se o mês destino for menor, usa o último dia (31/01 + 1 mês = 28/02). */
export function addMonthsISO(iso: string, months: number): string {
  const d = dateOnly(iso);
  const day = d.getUTCDate();
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1));
  const clamped = Math.min(day, daysInMonth(target.getUTCFullYear(), target.getUTCMonth()));
  target.setUTCDate(clamped);
  return toISO(target);
}

export function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

export function startOfMonthISO(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

export function endOfMonthISO(iso: string): string {
  const d = dateOnly(startOfMonthISO(iso));
  return toISO(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)));
}

/** Lista de meses "AAAA-MM" entre duas datas (inclusive). */
export function monthsInRange(fromISO: string, toISO_: string): string[] {
  const out: string[] = [];
  let cur = startOfMonthISO(fromISO);
  const last = monthKey(toISO_);
  while (monthKey(cur) <= last) {
    out.push(monthKey(cur));
    cur = addMonthsISO(cur, 1);
  }
  return out;
}

/** Lista de dias ISO entre duas datas (inclusive). */
export function daysInRange(fromISO: string, toISO_: string): string[] {
  const out: string[] = [];
  for (let cur = fromISO; cur <= toISO_; cur = addDaysISO(cur, 1)) out.push(cur);
  return out;
}

export function diffDaysISO(a: string, b: string): number {
  return Math.round((dateOnly(a).getTime() - dateOnly(b).getTime()) / 86_400_000);
}

/** Formata para exibição: "23/11/2026". */
export function formatDateBR(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const iso = typeof value === "string" ? value.slice(0, 10) : toISO(value);
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

const MONTHS_PT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const MONTHS_PT_LONG = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

/** "2026-11" -> "nov/26" */
export function formatMonthShort(key: string): string {
  const [y, m] = key.split("-");
  return `${MONTHS_PT[Number(m) - 1]}/${y!.slice(2)}`;
}

/** "2026-11" -> "novembro de 2026" */
export function formatMonthLong(key: string): string {
  const [y, m] = key.split("-");
  return `${MONTHS_PT_LONG[Number(m) - 1]} de ${y}`;
}

/** "2026-11-23" -> "23/nov" */
export function formatDayShort(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${MONTHS_PT[Number(m) - 1]}`;
}

// ---------------------------------------------------------------------------
// Períodos de filtro
// ---------------------------------------------------------------------------

export const PERIOD_PRESETS = [
  { key: "today", label: "Hoje" },
  { key: "yesterday", label: "Ontem" },
  { key: "7d", label: "Últimos 7 dias" },
  { key: "30d", label: "Últimos 30 dias" },
  { key: "month", label: "Mês atual" },
  { key: "lastmonth", label: "Mês anterior" },
  { key: "custom", label: "Personalizado" },
] as const;

export type PeriodKey = (typeof PERIOD_PRESETS)[number]["key"];

export interface Period {
  key: PeriodKey;
  from: string;
  to: string;
  label: string;
}

/** Resolve o período a partir dos parâmetros da URL (?p=...&de=...&ate=...). */
export function resolvePeriod(
  params: { p?: string; de?: string; ate?: string },
  defaultKey: PeriodKey = "month",
  today: string = todayISO(),
): Period {
  const key = (PERIOD_PRESETS.find((p) => p.key === params.p)?.key ?? defaultKey) as PeriodKey;
  const label = PERIOD_PRESETS.find((p) => p.key === key)!.label;
  switch (key) {
    case "today":
      return { key, from: today, to: today, label };
    case "yesterday": {
      const y = addDaysISO(today, -1);
      return { key, from: y, to: y, label };
    }
    case "7d":
      return { key, from: addDaysISO(today, -6), to: today, label };
    case "30d":
      return { key, from: addDaysISO(today, -29), to: today, label };
    case "month":
      return { key, from: startOfMonthISO(today), to: endOfMonthISO(today), label };
    case "lastmonth": {
      const ref = addMonthsISO(startOfMonthISO(today), -1);
      return { key, from: ref, to: endOfMonthISO(ref), label };
    }
    case "custom": {
      const from = params.de && isValidISODate(params.de) ? params.de : startOfMonthISO(today);
      let to = params.ate && isValidISODate(params.ate) ? params.ate : today;
      if (to < from) to = from;
      // Limite de segurança: até 5 anos por consulta
      if (diffDaysISO(to, from) > 366 * 5) to = addDaysISO(from, 366 * 5);
      return { key, from, to, label: `${formatDateBR(from)} a ${formatDateBR(to)}` };
    }
  }
}
