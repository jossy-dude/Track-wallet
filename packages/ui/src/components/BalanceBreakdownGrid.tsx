import { cn } from "../utils";
import { MaterialSymbol } from "./MaterialSymbol";
import type { BalanceBreakdownItem, FinanceAccentTone } from "../types";

const toneStyles: Record<FinanceAccentTone, string> = {
  primary: "text-primary",
  tertiary: "text-tertiary",
  secondary: "text-secondary"
};

export interface BalanceBreakdownGridProps {
  items: readonly BalanceBreakdownItem[];
  className?: string;
}

export function BalanceBreakdownGrid({
  items,
  className
}: BalanceBreakdownGridProps) {
  return (
    <div className={cn("grid grid-cols-3 gap-4", className)}>
      {items.map((item) => (
        <article
          className="flex flex-col items-center justify-center gap-2 rounded-xl bg-surface-container p-4 text-center"
          key={item.id}
        >
          <MaterialSymbol
            className={cn("text-[24px]", toneStyles[item.tone])}
            filled
            name={item.icon}
          />
          <span className="text-xs font-semibold text-on-surface-variant">
            {item.label}
          </span>
          <span className="font-headline text-sm font-semibold text-on-surface">
            {item.amountDisplay}
          </span>
        </article>
      ))}
    </div>
  );
}
