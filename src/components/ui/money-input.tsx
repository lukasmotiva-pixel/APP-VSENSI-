"use client";

import { centsToInput, parseMoneyToCents } from "@/lib/money";
import { Input } from "./field";

/** Campo de valor em reais. Aceita "1.234,56" ou "1234.56"; formata ao sair do campo. */
export function MoneyInput({
  value,
  onChange,
  name,
  ...props
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> & {
  value: string;
  onChange: (value: string) => void;
}) {
  const invalid = value.trim() !== "" && parseMoneyToCents(value) === null;
  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted">R$</span>
      <Input
        {...props}
        name={name}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        placeholder={props.placeholder ?? "0,00"}
        className="num pl-9"
        invalid={invalid}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9.,]/g, ""))}
        onBlur={() => {
          const cents = parseMoneyToCents(value);
          if (cents !== null) onChange(centsToInput(cents));
        }}
      />
    </div>
  );
}
