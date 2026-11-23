import { requireAdmin } from "@/lib/auth/session";
import { Sidebar } from "@/components/layout/sidebar";
import { MobileBottomNav, MobileTopBar } from "@/components/layout/mobile-nav";

/** Área protegida: toda página aqui exige a sessão válida do administrador. */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAdmin();
  return (
    <div className="min-h-dvh">
      <Sidebar userName={session.user.name} />
      <MobileTopBar />
      <main className="px-4 pt-5 pb-28 sm:px-6 lg:ml-64 lg:px-8 lg:pt-8 lg:pb-12">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
      <MobileBottomNav />
    </div>
  );
}
