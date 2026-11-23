import Link from "next/link";
import { prisma } from "@/lib/db";
import { param, type SearchParams } from "@/lib/search-params";
import { Card, CardHeader } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/button";

export const metadata = { title: "Auditoria" };
const PAGE = 50;

export default async function AuditPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(param(sp, "pagina") ?? 1) || 1);
  const prefix = param(sp, "tipo");
  const where = prefix && ["auth", "finance", "settings"].includes(prefix) ? { action: { startsWith: `${prefix}.` } } : {};
  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE, take: PAGE }),
    prisma.auditLog.count({ where }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE));
  return (
    <Card>
      <CardHeader
        title="Registro de atividades"
        description="Logins, tentativas, alterações financeiras e de configuração."
        action={
          <div className="flex gap-2 text-sm">
            {[["", "Tudo"], ["auth", "Acesso"], ["finance", "Financeiro"], ["settings", "Config."]].map(([k, l]) => (
              <Link key={k} href={k ? `?tipo=${k}` : "?"} className={(prefix ?? "") === k ? "font-medium text-ink" : "text-muted hover:text-ink"}>{l}</Link>
            ))}
          </div>
        }
      />
      <ul className="divide-y divide-line">
        {items.map((l) => (
          <li key={l.id} className="px-4 py-2.5 text-sm sm:px-5">
            <div className="flex flex-wrap justify-between gap-x-3">
              <p>
                {l.entity === "Entry" && l.entityId && !l.action.endsWith(".delete") ? <Link href={`/financeiro/${l.entityId}`} className="hover:underline">{l.summary}</Link> : l.summary}
              </p>
              <p className="num text-xs text-muted">{l.createdAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</p>
            </div>
            <p className="text-xs text-subtle">{l.action}{l.ip ? ` · IP ${l.ip}` : ""}</p>
          </li>
        ))}
      </ul>
      {pages > 1 ? (
        <div className="flex items-center justify-between border-t border-line px-4 py-3 text-sm sm:px-5">
          {page > 1 ? <LinkButton size="sm" variant="secondary" href={`?${prefix ? `tipo=${prefix}&` : ""}pagina=${page - 1}`}>Anterior</LinkButton> : <span />}
          <span className="text-muted">Página {page} de {pages}</span>
          {page < pages ? <LinkButton size="sm" variant="secondary" href={`?${prefix ? `tipo=${prefix}&` : ""}pagina=${page + 1}`}>Próxima</LinkButton> : <span />}
        </div>
      ) : null}
    </Card>
  );
}
