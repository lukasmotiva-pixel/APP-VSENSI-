import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/session";
import { revokeOtherSessionsAction, revokeSessionAction } from "@/modules/auth-actions";
import { ChangePasswordForm, RecoveryCodesForm } from "@/modules/settings/components/security-forms";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ConfirmSubmit } from "@/components/ui/form-bits";

export const metadata = { title: "Segurança" };

function describeAgent(ua: string | null) {
  if (!ua) return "Navegador desconhecido";
  const os = /iPhone|iPad/.test(ua) ? "iPhone/iPad" : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows" : /Mac OS/.test(ua) ? "Mac" : /Linux/.test(ua) ? "Linux" : "Outro";
  const br = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : /Firefox\//.test(ua) ? "Firefox" : "Navegador";
  return `${br} · ${os}`;
}

export default async function SecurityPage() {
  const session = await requireAdmin();
  const [user, sessions, remaining] = await Promise.all([
    prisma.adminUser.findUniqueOrThrow({ where: { id: session.user.id } }),
    prisma.session.findMany({ where: { userId: session.user.id }, orderBy: { lastSeenAt: "desc" } }),
    prisma.recoveryCode.count({ where: { userId: session.user.id, usedAt: null } }),
  ]);
  const fmt = (d: Date) => d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader title="Conta" description="Acesso exclusivo — não existe cadastro de outros usuários." />
        <CardBody className="space-y-1 text-sm">
          <p><span className="text-muted">Nome:</span> {user.name}</p>
          <p><span className="text-muted">E-mail:</span> {user.email}</p>
          <p><span className="text-muted">Senha alterada em:</span> {fmt(user.passwordChangedAt)}</p>
          {user.lastLoginAt ? <p><span className="text-muted">Último login:</span> {fmt(user.lastLoginAt)}</p> : null}
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Alterar senha" description="Ao alterar, as outras sessões são encerradas." />
        <CardBody><ChangePasswordForm /></CardBody>
      </Card>
      <Card>
        <CardHeader title="Códigos de recuperação" description="Permitem redefinir a senha se você esquecê-la." />
        <CardBody><RecoveryCodesForm remaining={remaining} /></CardBody>
      </Card>
      <Card>
        <CardHeader
          title="Sessões ativas"
          description="Dispositivos conectados à sua conta."
          action={sessions.length > 1 ? (
            <form action={revokeOtherSessionsAction}>
              <ConfirmSubmit message="Encerrar todas as outras sessões?">Encerrar outras</ConfirmSubmit>
            </form>
          ) : null}
        />
        <ul className="divide-y divide-line">
          {sessions.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm sm:px-5">
              <div>
                <p className="font-medium">{describeAgent(s.userAgent)} {s.id === session.sessionId ? <Badge tone="navy">Esta sessão</Badge> : null}</p>
                <p className="text-xs text-muted">Último acesso {fmt(s.lastSeenAt)}{s.ip ? ` · IP ${s.ip}` : ""}</p>
              </div>
              {s.id !== session.sessionId ? (
                <form action={revokeSessionAction}>
                  <input type="hidden" name="sessionId" value={s.id} />
                  <ConfirmSubmit variant="ghost" message="Encerrar esta sessão?">Encerrar</ConfirmSubmit>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
