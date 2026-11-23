import { describe, expect, it } from "vitest";
import { addMonthsISO, endOfMonthISO, isValidISODate, monthsInRange, resolvePeriod, todayISO } from "@/lib/dates";

describe("datas", () => {
  it("valida datas ISO", () => {
    expect(isValidISODate("2026-02-28")).toBe(true);
    expect(isValidISODate("2026-02-30")).toBe(false);
    expect(isValidISODate("26-02-01")).toBe(false);
  });

  it("calcula hoje no fuso de São Paulo", () => {
    // 02:00 UTC do dia 24 ainda é dia 23 em São Paulo (UTC-3)
    expect(todayISO(new Date("2026-11-24T02:00:00Z"), "America/Sao_Paulo")).toBe("2026-11-23");
    expect(todayISO(new Date("2026-11-24T03:00:00Z"), "America/Sao_Paulo")).toBe("2026-11-24");
  });

  it("soma meses limitando ao último dia", () => {
    expect(addMonthsISO("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonthsISO("2028-01-31", 1)).toBe("2028-02-29");
    expect(addMonthsISO("2026-11-15", 3)).toBe("2027-02-15");
    expect(endOfMonthISO("2026-02-10")).toBe("2026-02-28");
  });

  it("lista meses do intervalo", () => {
    expect(monthsInRange("2026-11-20", "2027-01-05")).toEqual(["2026-11", "2026-12", "2027-01"]);
  });

  it("resolve períodos de filtro", () => {
    const t = "2026-11-23";
    expect(resolvePeriod({ p: "today" }, "month", t)).toMatchObject({ from: t, to: t });
    expect(resolvePeriod({ p: "yesterday" }, "month", t)).toMatchObject({ from: "2026-11-22", to: "2026-11-22" });
    expect(resolvePeriod({ p: "7d" }, "month", t)).toMatchObject({ from: "2026-11-17", to: t });
    expect(resolvePeriod({ p: "30d" }, "month", t)).toMatchObject({ from: "2026-10-25", to: t });
    expect(resolvePeriod({}, "month", t)).toMatchObject({ key: "month", from: "2026-11-01", to: "2026-11-30" });
    expect(resolvePeriod({ p: "lastmonth" }, "month", t)).toMatchObject({ from: "2026-10-01", to: "2026-10-31" });
    expect(resolvePeriod({ p: "custom", de: "2026-11-10", ate: "2026-11-01" }, "month", t)).toMatchObject({ from: "2026-11-10", to: "2026-11-10" });
    expect(resolvePeriod({ p: "custom", de: "lixo" }, "month", t)).toMatchObject({ from: "2026-11-01", to: t });
  });
});
