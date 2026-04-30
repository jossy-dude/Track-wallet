import { cn } from "../utils";
import { MaterialSymbol } from "./MaterialSymbol";
import type { BudgetCategorySnapshot, FinanceAccentTone } from "../types";

const barToneStyles: Record<FinanceAccentTone, string> = {
  primary: "bg-primary",
  tertiary: "bg-tertiary",
  secondary: "bg-secondary"
};

export interface BudgetLimitCardProps {
  title: string;
  periodLabel: string;
  categories: readonly BudgetCategorySnapshot[];
  className?: string;
}

export function BudgetLimitCard({
  title,
  periodLabel,
  categories,
  className
}: BudgetLimitCardProps) {
  return (
    <section
      className={cn(
        "flex flex-col gap-6 rounded-[24px] bg-surface-container-low p-6 shadow-[0_4px_20px_rgba(46,50,48,0.06)]",
        className
      )}
    >
      <div className="flex items-center justify-between gap-4">
        <h3 className="font-headline text-lg font-semibold text-on-surface">
          {title}
        </h3>
        <span className="rounded-full bg-primary-container/30 px-3 py-1 text-xs font-semibold text-primary">
          {periodLabel}
        </span>
      </div>

      <div className="flex flex-col gap-4">
        {categories.length > 0 ? (
          categories.map((category) => {
            const progressPercent = Math.max(
              0,
              Math.min(100, category.progressPercent)
            );

            return (
              <div key={category.id}>
                <div className="mb-1 flex items-center justify-between gap-4 text-sm">
                  <span className="flex items-center gap-2 text-on-surface-variant">
                    <MaterialSymbol
                      className="text-sm"
                      filled
                      name={category.icon}
                    />
                    {category.label}
                  </span>
                  <span className="font-semibold text-on-surface">
                    {category.amountDisplay}
                  </span>
                </div>

                <div className="h-2 w-full rounded-full bg-surface-variant">
                  <div
                    className={cn(
                      "h-2 rounded-full",
                      barToneStyles[category.tone]
                    )}
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            );
          })
        ) : (
          <p className="rounded-2xl border border-dashed border-outline-variant bg-surface-container-lowest p-4 text-sm text-on-surface-variant">
            No approved spending yet. Approve parsed SMS entries to build this month&apos;s budget view.
          </p>
        )}
      </div>
    </section>
  );
}
