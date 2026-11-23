import { describe, expect, it } from "vitest";
import { generateRecoveryCode, generateSessionToken, normalizeRecoveryCode, sha256 } from "@/lib/auth/tokens";

describe("tokens", () => {
  it("gera tokens de sessão longos e únicos", () => {
    const a = generateSessionToken();
    expect(a.length).toBeGreaterThanOrEqual(43);
    expect(a).not.toBe(generateSessionToken());
    expect(sha256(a)).toHaveLength(64);
  });
  it("códigos de recuperação no formato XXXX-XXXX-XXXX e normalização", () => {
    const c = generateRecoveryCode();
    expect(c).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    expect(normalizeRecoveryCode(c.toLowerCase().replace(/-/g, " "))).toBe(c);
  });
});
