export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-graphite-900 lg:flex-row">
      <div className="flex flex-1 flex-col justify-between px-6 pt-10 pb-6 lg:px-14 lg:py-14">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-lg bg-navy-800 font-bold text-white ring-1 ring-white/10">V</span>
          <span className="text-lg font-semibold text-white">V&apos;Sensi Gestão</span>
        </div>
        <div className="hidden max-w-md lg:block">
          <p className="text-3xl font-semibold leading-tight text-white">O centro de controle da empresa, em um só lugar.</p>
          <p className="mt-3 text-white/60">Financeiro, quiosques, operação online e resultados — com acesso exclusivo do proprietário.</p>
        </div>
        <p className="hidden text-xs text-white/40 lg:block">Acesso restrito. Atividades são registradas.</p>
      </div>
      <div className="flex flex-1 items-start justify-center rounded-t-3xl bg-canvas px-5 pt-8 pb-10 lg:items-center lg:rounded-none lg:px-14">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}
