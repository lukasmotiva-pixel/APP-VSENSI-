"use client";

import { Printer } from "lucide-react";
import { Button } from "./button";

/** Abre a impressão do navegador — no celular e no computador permite "Salvar como PDF". */
export function PrintButton({ label = "PDF / imprimir" }: { label?: string }) {
  return (
    <Button type="button" variant="secondary" onClick={() => window.print()} className="print:hidden">
      <Printer className="size-4" /> {label}
    </Button>
  );
}
