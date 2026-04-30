import { MaterialSymbol, type FinanceAccentTone } from "@omni-sync/ui";

interface MetricCardProps {
  label: string
  value: string
  icon: string
  tone: FinanceAccentTone
  hint?: string
}

const toneStyles: Record<
  FinanceAccentTone,
  {
    panel: string
    iconBadge: string
    icon: string
  }
> = {
  primary: {
    panel: "bg-primary-container/20",
    iconBadge: "bg-primary-container/50",
    icon: "text-primary",
  },
  tertiary: {
    panel: "bg-tertiary-container/20",
    iconBadge: "bg-tertiary-container/50",
    icon: "text-tertiary",
  },
  secondary: {
    panel: "bg-secondary-container/40",
    iconBadge: "bg-secondary-container",
    icon: "text-secondary",
  },
}

export function MetricCard({
  label,
  value,
  icon,
  tone,
  hint,
}: MetricCardProps) {
  const styles = toneStyles[tone]

  return (
    <article
      className={`rounded-[20px] ${styles.panel} p-4 shadow-[0_4px_20px_rgba(46,50,48,0.04)]`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-on-surface-variant">
            {label}
          </p>
          <div className="font-headline text-2xl font-semibold text-on-surface">
            {value}
          </div>
          {hint ? (
            <p className="text-sm text-on-surface-variant">{hint}</p>
          ) : null}
        </div>
        <div
          className={`flex h-11 w-11 items-center justify-center rounded-full ${styles.iconBadge}`}
        >
          <MaterialSymbol className={`text-[22px] ${styles.icon}`} filled name={icon} />
        </div>
      </div>
    </article>
  )
}
