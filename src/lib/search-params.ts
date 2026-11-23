export type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Lê um parâmetro de URL como string simples (ignora repetições). */
export function param(sp: Record<string, string | string[] | undefined>, key: string): string | undefined {
  const v = sp[key];
  const s = Array.isArray(v) ? v[0] : v;
  return s && s.length <= 200 ? s : undefined;
}
