import Link from "next/link";

export default function NotFound() {
  return (
    <div className="grid min-h-[60dvh] place-items-center px-6 text-center">
      <div>
        <p className="text-sm font-medium text-muted">404</p>
        <h1 className="mt-1 text-xl font-semibold">Página não encontrada</h1>
        <Link href="/" className="mt-4 inline-block text-sm text-navy-800 underline">Voltar ao início</Link>
      </div>
    </div>
  );
}
