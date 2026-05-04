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
  onRejectTransaction?: (transaction: InboxTransactionPreview) => void;
  onApproveTransaction?: (transaction: InboxTransactionPreview) => void;
  editActionLabel?: string;
  rejectActionLabel?: string;
  approveActionLabel?: string;
  className?: string;
}

export function InboxTransactionItem({
  transaction,
  onEditTransaction,
  onRejectTransaction,
  onApproveTransaction,
  editActionLabel = "Modify",
  rejectActionLabel = "Reject",
  approveActionLabel = "Approve",
  className
}: InboxTransactionItemProps) {
  const styles = toneStyles[transaction.tone];
  const hasActions = Boolean(
    onEditTransaction || onRejectTransaction || onApproveTransaction,
  );
  const hasSourceEvidence = Boolean(
    transaction.sourceSenderLabel ||
      transaction.sourceAccountLabel ||
      transaction.sourceInstitutionLabel ||
      transaction.sourceConfidenceLabel,
  );

  return (
    <article
      className={cn(
        "rounded-[22px] border border-outline-variant/10 bg-surface px-4 py-3 shadow-[0_2px_10px_rgba(46,50,48,0.03)]",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div
            className={cn(
              "pointer-events-none flex min-h-11 min-w-11 items-center justify-center rounded-[18px]",
              styles.badge,
              styles.icon
            )}
          >
            <MaterialSymbol
              className="text-[22px]"
              filled
              name={transaction.transactionIcon}
            />
          </div>

          <div className="min-w-0 space-y-1.5">
            <div className="max-w-full truncate text-sm font-semibold text-on-surface">
              {transaction.merchantName}
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-on-surface-variant">
              <MaterialSymbol className="text-[14px]" name={transaction.categoryIcon} />
              <span className="max-w-[8rem] truncate">{transaction.categoryName}</span>
              <span className="rounded-full bg-surface-container-low px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em]">
                Queue
              </span>
            </div>
          </div>
        </div>

        <div className="shrink-0 text-right">
          {transaction.amountDisplay ? (
            <div className="text-sm font-semibold text-on-surface">
              {transaction.amountDisplay}
            </div>
          ) : null}
        </div>
      </div>

      {hasSourceEvidence ? (
        <div className="mt-3 flex flex-wrap gap-1.5 text-[11px] text-on-surface-variant">
          {transaction.sourceSenderLabel ? (
            <span className="rounded-full bg-surface-container-low px-2.5 py-1 font-medium text-on-surface">
              {transaction.sourceSenderLabel}
            </span>
          ) : null}
          {transaction.sourceAccountLabel ? (
            <span className="rounded-full bg-surface-container-low px-2.5 py-1 font-medium text-on-surface">
              {transaction.sourceAccountLabel}
            </span>
          ) : null}
          {transaction.sourceConfidenceLabel ? (
            <span className="rounded-full bg-primary-container/40 px-2.5 py-1 font-medium text-on-surface">
              {transaction.sourceConfidenceLabel}
            </span>
          ) : null}
          {!transaction.sourceSenderLabel && transaction.sourceInstitutionLabel ? (
            <span className="rounded-full bg-surface-container-low px-2.5 py-1 font-medium text-on-surface">
              {transaction.sourceInstitutionLabel}
            </span>
          ) : null}
        </div>
      ) : null}

      {hasActions ? (
        <div className="mt-3 flex items-center justify-end gap-2 border-t border-outline-variant/10 pt-3">
          {onEditTransaction ? (
            <button
              className="inline-flex min-h-8 items-center gap-1 rounded-full bg-surface-container-low px-3 py-1.5 text-[11px] font-semibold text-on-surface-variant transition-colors active:scale-95"
              onClick={() => onEditTransaction(transaction)}
              type="button"
            >
              <MaterialSymbol className="text-sm" name="edit" />
              {editActionLabel}
            </button>
          ) : null}

          {onRejectTransaction ? (
            <button
              className="inline-flex min-h-8 items-center gap-1 rounded-full bg-error/10 px-3 py-1.5 text-[11px] font-semibold text-error transition-colors active:scale-95"
              onClick={() => onRejectTransaction(transaction)}
              type="button"
            >
              <MaterialSymbol className="text-sm" name="close" />
              {rejectActionLabel}
            </button>
          ) : null}

          {onApproveTransaction ? (
            <button
              className="inline-flex min-h-8 items-center gap-1.5 rounded-full bg-primary px-3 py-2 text-[11px] font-semibold text-on-primary shadow-[0_8px_18px_rgba(30,94,55,0.18)] transition-opacity active:scale-95"
              onClick={() => onApproveTransaction(transaction)}
              type="button"
            >
              <MaterialSymbol className="text-sm" filled name="check" />
              {approveActionLabel}
            </button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
