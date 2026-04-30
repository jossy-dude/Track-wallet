import type { ReactNode } from "react";

import { cn } from "../utils";

export interface BalanceSummaryCardProps {
  title: string;
  totalBalanceDisplay: string;
  breakdown?: ReactNode;
  className?: string;
}

export function BalanceSummaryCard({
  title,
  totalBalanceDisplay,
  breakdown,
  className
}: BalanceSummaryCardProps) {
  return (
    <section
      className={cn(
        "rounded-[24px] bg-surface-container-low p-6 shadow-[0_4px_20px_rgba(46,50,48,0.06)]",
        className
      )}
    >
      <div className="mb-6 flex flex-col gap-2">
        <h2 className="text-sm font-medium text-on-surface-variant">{title}</h2>
        <div className="font-headline text-4xl font-semibold tracking-tight text-on-surface">
          {totalBalanceDisplay}
        </div>
      </div>
      {breakdown}
    </section>
  );
}
