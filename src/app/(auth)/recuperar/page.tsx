import { RecoverForm } from "./recover-form";

export const metadata = { title: "Recuperar acesso" };

export default function RecoverPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Recuperar acesso</h1>
      <p className="mt-1 mb-6 text-sm text-muted">
        Use um dos códigos de recuperação gerados em Configurações → Segurança. Sem códigos, a senha pode ser
        redefinida no servidor com <code className="rounded bg-black/5 px-1">npm run admin:reset-password</code>.
      </p>
      <RecoverForm />
    </>
  );
}
