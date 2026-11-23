import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "../db";
import { validateSessionToken, type RequestMeta, type ValidSession } from "./core";

export const SESSION_COOKIE = "vs_session";

export async function getRequestMeta(): Promise<RequestMeta> {
  const h = await headers();
  // Atrás de proxy reverso confiável (ver docs/06-operacao.md), o IP real vem em X-Forwarded-For.
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return { ip: forwarded || h.get("x-real-ip") || null, userAgent: h.get("user-agent") };
}

export async function setSessionCookie(token: string, expiresAt: Date): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

/** Sessão atual (memoizada por requisição). */
export const getCurrentSession = cache(async (): Promise<ValidSession | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return validateSessionToken(prisma, token);
});

/**
 * Exige o administrador autenticado. Use em TODO layout protegido, Server Action e rota de API.
 * O middleware apenas redireciona; a validação real é esta.
 */
export async function requireAdmin(): Promise<ValidSession> {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  return session;
}
