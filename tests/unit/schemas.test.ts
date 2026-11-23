import { describe, expect, it } from "vitest";
import { optionalIsoDate } from "@/modules/finance/schemas";

describe("optionalIsoDate", () => {
  it("campo de data vazio vira null; data inválida é recusada", () => {
    expect(optionalIsoDate.parse("")).toBeNull();
    expect(optionalIsoDate.parse(null)).toBeNull();
    expect(optionalIsoDate.parse(undefined)).toBeNull();
    expect(optionalIsoDate.parse("2026-11-23")).toBe("2026-11-23");
    expect(() => optionalIsoDate.parse("2026-13-01")).toThrow();
  });
});
