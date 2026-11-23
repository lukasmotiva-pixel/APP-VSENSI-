import { SettingsNav } from "@/components/layout/settings-nav";
import { PageHeader } from "@/components/ui/page-header";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PageHeader title="Configurações" description="Cadastros básicos, segurança e registro de atividades." />
      <SettingsNav />
      {children}
    </>
  );
}
