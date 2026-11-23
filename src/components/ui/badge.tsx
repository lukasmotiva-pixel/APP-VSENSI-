import { cn } from "@/lib/cn";

const tones = {
  neutral: "bg-canvas text-muted border-line",
  navy: "bg-navy-100 text-navy-900 border-navy-100",
  positive: "bg-positive-soft text-positive border-positive/15",
  negative: "bg-negative-soft text-negative border-negative/15",
  warning: "bg-warning-soft text-warning border-warning/20",
} as const;

export type BadgeTone = keyof typeof tones;

export function Badge({ tone = "neutral", className, ...props }: React.HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn("inline-flex items-center whitespace-nowrap rounded-md border px-1.5 py-0.5 text-xs font-medium", tones[tone], className)}
      {...props}
    />
  );
}
