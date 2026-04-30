import { cn } from "../utils";
import { InboxTransactionItem } from "./InboxTransactionItem";
import type { InboxTransactionPreview } from "../types";

export interface InboxPanelProps {
  title: string;
  pendingCount: number;
  transactions: readonly InboxTransactionPreview[];
  onSeeAll?: () => void;
  onEditTransaction?: (transaction: InboxTransactionPreview) => void;
  onApproveTransaction?: (transaction: InboxTransactionPreview) => void;
  seeAllLabel?: string;
  className?: string;
}

export function InboxPanel({
  title,
  pendingCount,
  transactions,
  onSeeAll,
  onEditTransaction,
  onApproveTransaction,
  seeAllLabel = "See All",
  className
}: InboxPanelProps) {
  return (
    <section className={cn("flex flex-col gap-4", className)}>
      <div className="flex items-center justify-between gap-4 px-2">
        <h3 className="font-headline text-lg font-semibold text-on-surface">
          {title} ({pendingCount} Pending)
        </h3>
        <button
          className="min-h-10 px-2 text-sm font-semibold text-primary active:scale-95"
          onClick={onSeeAll}
          type="button"
        >
          {seeAllLabel}
        </button>
      </div>

      <div className="flex min-h-24 flex-col gap-1 rounded-[24px] border border-surface-container bg-surface-container-lowest p-2 shadow-[0_4px_20px_rgba(46,50,48,0.06)]">
        {transactions.length > 0 ? (
          transactions.map((transaction) => (
            <InboxTransactionItem
              className="hover:bg-surface-container-low"
              key={transaction.id}
              onApproveTransaction={onApproveTransaction}
              onEditTransaction={onEditTransaction}
              transaction={transaction}
            />
          ))
        ) : (
          <div className="flex min-h-24 items-center rounded-xl border border-dashed border-outline-variant bg-surface-container-low p-4 text-sm text-on-surface-variant">
            No pending SMS approvals. Queue a parser test or wait for new bank messages.
          </div>
        )}
      </div>
    </section>
  );
}
