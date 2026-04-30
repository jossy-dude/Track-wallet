import {
  MaterialSymbol,
  type FinanceAccentTone,
} from "@omni-sync/ui";

export interface ActivityFeedItem {
  id: string
  title: string
  subtitle: string
  amountDisplay: string
  icon: string
  tone: FinanceAccentTone
  metaLabel?: string
}

interface ActivityFeedProps {
  title: string
  description?: string
  items: readonly ActivityFeedItem[]
  emptyLabel: string
}

const toneStyles: Record<
  FinanceAccentTone,
  {
    badge: string
    icon: string
  }
> = {
  primary: {
    badge: "bg-primary-container/30",
    icon: "text-primary",
  },
  tertiary: {
    badge: "bg-tertiary-container/30",
    icon: "text-tertiary",
  },
  secondary: {
    badge: "bg-secondary-container",
    icon: "text-secondary",
  },
}

export function ActivityFeed({
  title,
  description,
  items,
  emptyLabel,
}: ActivityFeedProps) {
  return (
    <section className="rounded-[24px] border border-surface-container bg-surface-container-lowest p-4 shadow-[0_4px_20px_rgba(46,50,48,0.06)]">
      <div className="mb-4 space-y-1 px-2">
        <h3 className="font-headline text-lg font-semibold text-on-surface">
          {title}
        </h3>
        {description ? (
          <p className="text-sm text-on-surface-variant">{description}</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        {items.length > 0 ? (
          items.map((item) => {
            const styles = toneStyles[item.tone]

            return (
              <article
                className="flex items-center justify-between gap-3 rounded-2xl bg-surface-container-low p-3"
                key={item.id}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${styles.badge}`}
                  >
                    <MaterialSymbol
                      className={`text-[20px] ${styles.icon}`}
                      filled
                      name={item.icon}
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-on-surface">
                      {item.title}
                    </div>
                    <div className="truncate text-xs text-on-surface-variant">
                      {item.subtitle}
                    </div>
                    {item.metaLabel ? (
                      <div className="mt-1 text-[11px] font-medium uppercase tracking-[0.12em] text-outline">
                        {item.metaLabel}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="text-right text-sm font-semibold text-on-surface">
                  {item.amountDisplay}
                </div>
              </article>
            )
          })
        ) : (
          <div className="rounded-2xl border border-dashed border-outline-variant bg-surface-container-low p-4 text-sm text-on-surface-variant">
            {emptyLabel}
          </div>
        )}
      </div>
    </section>
  )
}
