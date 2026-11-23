import { cn } from "@/lib/cn";

const control =
  "block w-full rounded-lg border border-line-strong bg-surface px-3 text-[16px] sm:text-sm text-ink placeholder:text-subtle " +
  "focus:border-navy-700 focus:outline-none focus:ring-2 focus:ring-navy-700/15 disabled:bg-canvas disabled:text-muted";

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("mb-1.5 block text-sm font-medium text-ink", className)} {...props} />;
}

export function Input({ className, invalid, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return <input className={cn(control, "h-11", invalid && "border-negative", className)} aria-invalid={invalid || undefined} {...props} />;
}

export function Select({ className, invalid, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }) {
  return <select className={cn(control, "h-11 pr-8", invalid && "border-negative", className)} aria-invalid={invalid || undefined} {...props} />;
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(control, "min-h-20 py-2.5", className)} {...props} />;
}

export function FieldError({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return <p className="mt-1 text-sm text-negative">{children}</p>;
}

export function Hint({ children }: { children: React.ReactNode }) {
  return <p className="mt-1 text-xs text-muted">{children}</p>;
}

export function Field({
  label,
  htmlFor,
  error,
  hint,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? <FieldError>{error}</FieldError> : hint ? <Hint>{hint}</Hint> : null}
    </div>
  );
}

export function Checkbox({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="inline-flex min-h-11 cursor-pointer items-center gap-2.5 text-sm">
      <input type="checkbox" className="size-4.5 rounded border-line-strong accent-navy-900" {...props} />
      {label}
    </label>
  );
}
