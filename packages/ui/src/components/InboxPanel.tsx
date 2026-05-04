import { cn } from "../utils";
import { InboxTransactionItem } from "./InboxTransactionItem";
import type { InboxTransactionPreview } from "../types";

export interface InboxPanelProps {
  title: string;
  pendingCount: number;
  transactions: readonly InboxTransactionPreview[];
  onSeeAll?: () => void;
  onEditTransaction?: (transaction: InboxTransactionPreview) => void;
  onRejectTransaction?: (transaction: InboxTransactionPreview) => void;
  onApproveTransaction?: (transaction: InboxTransactionPreview) => void;
  seeAllLabel?: string;
  showSeeAll?: boolean;
  className?: string;
  orientation?: "horizontal" | "vertical";
  emptyStateTitle?: string;
  emptyStateDescription?: string;
}

export function InboxPanel({
  title,
  pendingCount,
  transactions,
  onSeeAll,
  onEditTransaction,
  onRejectTransaction,
  onApproveTransaction,
  seeAllLabel = "See All",
  showSeeAll = true,
  className,
  orientation = "horizontal",
  emptyStateTitle = "Nothing is waiting for review yet.",
  emptyStateDescription = "Add a manual transaction or finish SMS setup to start your inbox.",
}: InboxPanelProps) {
  return (
    <section className={cn("flex w-full min-w-0 flex-col gap-3", className)}>
      <div className="flex items-center justify-between gap-4 px-2">
        <h3 className="font-headline text-lg font-semibold text-on-surface">
          {title}
        </h3>

        <div className="flex items-center gap-3">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#b45a56]/14 text-xs font-semibold text-[#8b3330] ring-1 ring-inset ring-[#b45a56]/16">
            {pendingCount}
          </span>

          {showSeeAll ? (
            <button
              className="min-h-10 rounded-full px-2 text-sm font-semibold text-primary active:scale-95"
              onClick={onSeeAll}
              type="button"
            >
              {seeAllLabel}
            </button>
          ) : null}
        </div>
      </div>

      <div
        className={cn(
          "min-h-24 w-full min-w-0 rounded-[24px] border border-surface-container bg-surface-container-lowest p-3 shadow-[0_4px_20px_rgba(46,50,48,0.06)]",
          orientation === "horizontal"
            ? "flex gap-3 overflow-x-auto"
            : "grid gap-3",
        )}
      >
        {transactions.length > 0 ? (
          transactions.map((transaction) => (
            <InboxTransactionItem
              className={
                orientation === "horizontal"
                  ? "w-[216px] min-w-[216px] shrink-0 hover:bg-surface-container-low"
                  : "w-full hover:bg-surface-container-low"
              }
              key={transaction.id}
              onApproveTransaction={onApproveTransaction}
              onEditTransaction={onEditTransaction}
              onRejectTransaction={onRejectTransaction}
              transaction={transaction}
            />
          ))
        ) : (
          <div className="flex min-h-24 flex-col justify-center rounded-xl border border-dashed border-outline-variant bg-surface-container-low p-4">
            <p className="text-sm font-semibold text-on-surface">{emptyStateTitle}</p>
            <p className="mt-1 text-sm text-on-surface-variant">
              {emptyStateDescription}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
