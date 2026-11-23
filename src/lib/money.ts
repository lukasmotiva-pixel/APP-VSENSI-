/**
 * Utilitários monetários. Todo valor é tratado em CENTAVOS inteiros.
 * Nunca use ponto flutuante para somar dinheiro.
 */

/** Maior valor aceito em um único lançamento/parcela (limite de INTEGER no PostgreSQL). */
export const MAX_CENTS = 2_147_483_647;

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/** 123456 -> "R$ 1.234,56" */
export function formatMoney(cents: number | bigint | null | undefined): string {
  const value = Number(cents ?? 0);
  return brl.format(value / 100).replace(/ /g, " ");
}

/** 123456 -> "1.234,56" (para preencher campos de formulário) */
export function centsToInput(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Converte texto digitado em centavos. Aceita "1.234,56", "1234,56", "1234.56", "R$ 10".
 * Regras: se houver vírgula, ela é o separador decimal e os pontos são de milhar.
 * Sem vírgula, um único ponto seguido de 1 ou 2 dígitos no final é decimal; caso contrário é milhar.
 * Retorna null para entradas inválidas ou negativas.
 */
export function parseMoneyToCents(input: string | null | undefined): number | null {
  if (input == null) return null;
  let s = String(input).trim().replace(/^R\$\s*/i, "").replace(/\s/g, "");
  if (s === "") return null;
  if (!/^[0-9.,]+$/.test(s)) return null;

  if (s.includes(",")) {
    if ((s.match(/,/g) ?? []).length > 1) return null;
    const [intPart, decPart = ""] = s.split(",") as [string, string?];
    if (!/^\d{1,3}(\.\d{3})*$|^\d+$/.test(intPart)) return null;
    if (!/^\d{0,2}$/.test(decPart ?? "")) return null;
    s = intPart.replace(/\./g, "") + "." + (decPart || "0");
  } else if (s.includes(".")) {
    const dots = (s.match(/\./g) ?? []).length;
    if (dots === 1 && /\.\d{1,2}$/.test(s)) {
      // decimal com ponto: "1234.5"
    } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
      s = s.replace(/\./g, "");
    } else {
      return null;
    }
  }

  const [i, d = "0"] = s.split(".") as [string, string?];
  const cents = Number(i) * 100 + Number((d ?? "0").padEnd(2, "0").slice(0, 2));
  if (!Number.isSafeInteger(cents) || cents < 0 || cents > MAX_CENTS) return null;
  return cents;
}

/**
 * Divide um total em N partes inteiras cuja soma é exatamente o total.
 * Os centavos restantes vão para as primeiras parcelas.
 */
export function splitCents(total: number, parts: number): number[] {
  if (!Number.isInteger(total) || total < 0) throw new Error("total inválido");
  if (!Number.isInteger(parts) || parts < 1) throw new Error("quantidade de parcelas inválida");
  const base = Math.floor(total / parts);
  const remainder = total - base * parts;
  return Array.from({ length: parts }, (_, i) => base + (i < remainder ? 1 : 0));
}

/**
 * Distribui um valor (ex.: taxa total) proporcionalmente a pesos (ex.: valores das parcelas),
 * garantindo que a soma seja exatamente o valor (método do maior resto).
 */
export function splitProportional(total: number, weights: number[]): number[] {
  const sumW = weights.reduce((a, b) => a + b, 0);
  if (total === 0 || sumW === 0) return weights.map(() => 0);
  const raw = weights.map((w) => (total * w) / sumW);
  const floors = raw.map(Math.floor);
  let rest = total - floors.reduce((a, b) => a + b, 0);
  const order = raw
    .map((r, i) => ({ i, frac: r - Math.floor(r) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (const { i } of order) {
    if (rest <= 0) break;
    floors[i]! += 1;
    rest -= 1;
  }
  return floors;
}

/** Percentual com 1 casa, tolerante a divisão por zero. */
export function percent(part: number, whole: number): number | null {
  if (!whole) return null;
  return Math.round((part / whole) * 1000) / 10;
}
