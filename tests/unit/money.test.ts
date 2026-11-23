import { describe, expect, it } from "vitest";
import { formatMoney, parseMoneyToCents, splitCents, splitProportional } from "@/lib/money";

describe("parseMoneyToCents", () => {
  it.each([
    ["1.234,56", 123456],
    ["1234,56", 123456],
    ["1234.56", 123456],
    ["R$ 10", 1000],
    ["0,5", 50],
    ["1.000", 100000],
    ["1.000.000,00", 100000000],
    ["12,3", 1230],
    ["99", 9900],
  ])("%s -> %i", (input, expected) => {
    expect(parseMoneyToCents(input)).toBe(expected);
  });

  it.each(["", "abc", "-10", "1,2,3", "1.23.4", "10,123", "1e5", "21474837,00"])("rejeita %s", (input) => {
    expect(parseMoneyToCents(input)).toBeNull();
  });
});

describe("formatMoney", () => {
  it("formata em reais", () => {
    expect(formatMoney(123456)).toBe("R$ 1.234,56");
    expect(formatMoney(-500)).toBe("-R$ 5,00");
    expect(formatMoney(0)).toBe("R$ 0,00");
  });
});

describe("splitCents", () => {
  it("soma sempre o total", () => {
    expect(splitCents(10000, 3)).toEqual([3334, 3333, 3333]);
    for (const [t, p] of [[1, 3], [99999, 7], [100, 1], [0, 2]] as const) {
      expect(splitCents(t, p).reduce((a, b) => a + b, 0)).toBe(t);
    }
  });
});

describe("splitProportional", () => {
  it("distribui taxa proporcionalmente sem perder centavos", () => {
    const r = splitProportional(100, [3334, 3333, 3333]);
    expect(r.reduce((a, b) => a + b, 0)).toBe(100);
    expect(r).toEqual([34, 33, 33]);
    expect(splitProportional(0, [1, 2])).toEqual([0, 0]);
  });
});
