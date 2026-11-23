"use client";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="grid min-h-[50dvh] place-items-center text-center">
      <div>
        <h1 className="text-lg font-semibold">Algo deu errado ao carregar esta tela.</h1>
        <p className="mt-1 text-sm text-muted">Nenhum dado foi alterado. Tente novamente.</p>
        <button onClick={reset} className="mt-4 h-10 rounded-lg bg-navy-900 px-4 text-sm font-medium text-white">Tentar novamente</button>
      </div>
    </div>
  );
}
