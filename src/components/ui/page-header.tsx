export function PageHeader({ title, description, actions }: { title: string; description?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">{title}</h1>
        {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      <p className="font-medium text-ink">{title}</p>
      {description ? <p className="mt-1 max-w-sm text-sm text-muted">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function Notice({ tone = "neutral", title, children }: { tone?: "neutral" | "warning" | "negative" | "positive"; title?: string; children: React.ReactNode }) {
  const cls = {
    neutral: "border-line bg-surface text-ink",
    warning: "border-warning/25 bg-warning-soft text-ink",
    negative: "border-negative/25 bg-negative-soft text-ink",
    positive: "border-positive/20 bg-positive-soft text-ink",
  }[tone];
  return (
    <div className={`rounded-xl border px-4 py-3 text-sm ${cls}`} role={tone === "negative" ? "alert" : undefined}>
      {title ? <p className="mb-0.5 font-semibold">{title}</p> : null}
      <div className="text-ink/85">{children}</div>
    </div>
  );
}
