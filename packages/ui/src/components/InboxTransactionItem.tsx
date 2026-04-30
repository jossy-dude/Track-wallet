import { cn } from "../utils";
import { MaterialSymbol } from "./MaterialSymbol";
import type { FinanceAccentTone, InboxTransactionPreview } from "../types";

const toneStyles: Record<
  FinanceAccentTone,
  {
    badge: string;
    icon: string;
  }
> = {
  primary: {
    badge: "bg-primary-container/30",
    icon: "text-primary"
  },
  tertiary: {
    badge: "bg-tertiary-container/30",
    icon: "text-tertiary"
  },
  secondary: {
    badge: "bg-secondary-container",
    icon: "text-secondary"
  }
};

export interface InboxTransactionItemProps {
  transaction: InboxTransactionPreview;
  onEditTransaction?: (transaction: InboxTransactionPreview) => void;
  onApproveTransaction?: (transaction: InboxTransactionPreview) => void;
  editActionLabel?: string;
  approveActionLabel?: string;
  className?: string;
}

export function InboxTransactionItem({
  transaction,
  onEditTransaction,
  onApproveTransaction,
  editActionLabel = "Modify",
  approveActionLabel = "Approve",
  className
}: InboxTransactionItemProps) {
  const styles = toneStyles[transaction.tone];

  return (
    <article
      className={cn(
        "flex flex-col gap-3 rounded-xl p-3 sm:flex-row sm:items-center sm:justify-between",
        className
      )}
    >
      <div className="flex items-center gap-4">
        <div
          className={cn(
            "pointer-events-none flex min-h-12 min-w-12 items-center justify-center rounded-full",
            styles.badge,
            styles.icon
          )}
        >
          <MaterialSymbol className="text-[22px]" filled name={transaction.transactionIcon} />
        </div>

        <div className="min-w-0 space-y-1">
          <div className="text-sm font-semibold text-on-surface">
            {transaction.merchantName}
          </div>
          <div className="flex items-center gap-1 text-xs text-on-surface-variant">
            <MaterialSymbol className="text-[14px]" name={transaction.categoryIcon} />
            <span>{transaction.categoryName}</span>
            {transaction.amountDisplay ? (
              <>
                <span aria-hidden="true">|</span>
                <span>{transaction.amountDisplay}</span>
              </>
            ) : null}
          </div>
        </div>
      </div>

      <div className="relative z-10 flex w-full flex-wrap items-center justify-end gap-1 self-start rounded-full bg-surface-container p-1 sm:w-auto sm:self-center">
        <button
          className="relative z-10 flex min-h-10 items-center gap-1 rounded-full px-3 py-2 text-xs font-bold text-primary transition-colors active:scale-95"
          onClick={() => onEditTransaction?.(transaction)}
          type="button"
        >
          <MaterialSymbol className="text-sm" name="edit" />
          {editActionLabel}
        </button>

        <div aria-hidden="true" className="h-4 w-px bg-outline-variant" />

        <button
          className="relative z-10 min-h-10 rounded-full bg-primary px-3 py-2 text-xs font-bold text-on-primary transition-opacity active:scale-95"
          onClick={() => onApproveTransaction?.(transaction)}
          type="button"
        >
          {approveActionLabel}
        </button>
      </div>
    </article>
  );
}
