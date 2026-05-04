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
  onItemPress?: (item: BalanceBreakdownItem) => void;
}

export function BalanceBreakdownGrid({
  items,
  className,
  onItemPress,
}: BalanceBreakdownGridProps) {
  return (
    <div className={cn("grid grid-cols-3 gap-4", className)}>
      {items.map((item) => (
        <button
          className="flex flex-col items-center justify-center gap-2 rounded-xl bg-surface-container p-4 text-center transition-[transform,box-shadow,background-color] duration-150 hover:bg-surface-container-high active:scale-[0.985]"
          key={item.id}
          onClick={(event) => {
            event.stopPropagation();
            onItemPress?.(item);
          }}
          type="button"
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
        </button>
      ))}
    </div>
  );
}
