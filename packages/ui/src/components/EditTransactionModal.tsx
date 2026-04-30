import { cn } from "../utils";
import type { TransactionCategoryOption } from "../types";

import { MaterialSymbol } from "./MaterialSymbol";

export interface EditTransactionModalProps {
  isOpen: boolean;
  transactionTitle: string;
  selectedCategory: string;
  categoryOptions: readonly TransactionCategoryOption[];
  noteValue: string;
  parsedAmountDisplay: string;
  sourceAccountLabel: string;
  messageTimestampLabel: string;
  sourceInstitutionLabel?: string;
  onClose?: () => void;
  onSaveDraft?: () => void;
  onApproveTransaction?: () => void;
  onTransactionTitleChange?: (value: string) => void;
  onSelectedCategoryChange?: (value: string) => void;
  onNoteChange?: (value: string) => void;
  className?: string;
}

export function EditTransactionModal({
  isOpen,
  transactionTitle,
  selectedCategory,
  categoryOptions,
  noteValue,
  parsedAmountDisplay,
  sourceAccountLabel,
  messageTimestampLabel,
  sourceInstitutionLabel,
  onClose,
  onSaveDraft,
  onApproveTransaction,
  onTransactionTitleChange,
  onSelectedCategoryChange,
  onNoteChange,
  className
}: EditTransactionModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-[60] flex items-end justify-center bg-[#2e3230]/30 p-4 backdrop-blur-sm sm:items-center"
      role="dialog"
    >
      <section
        className={cn(
          "w-full max-w-lg rounded-[28px] bg-surface-container-lowest p-5 shadow-[0_20px_60px_rgba(46,50,48,0.22)]",
          className
        )}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-sm font-medium text-on-surface-variant">
              Edit draft transaction
            </p>
            <h3 className="font-headline text-2xl font-semibold text-on-surface">
              Review before approval
            </h3>
          </div>
          <button
            aria-label="Close edit transaction modal"
            className="min-h-12 min-w-12 rounded-full bg-surface-container px-3 text-on-surface active:scale-95"
            onClick={onClose}
            type="button"
          >
            <MaterialSymbol className="text-[20px]" name="close" />
          </button>
        </div>

        <div className="mb-5 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-surface-container p-3">
            <div className="text-xs font-semibold uppercase tracking-[0.08em] text-on-surface-variant">
              Parsed amount
            </div>
            <div className="mt-1 font-headline text-lg font-semibold text-on-surface">
              {parsedAmountDisplay}
            </div>
          </div>
          <div className="rounded-2xl bg-surface-container p-3">
            <div className="text-xs font-semibold uppercase tracking-[0.08em] text-on-surface-variant">
              Source account
            </div>
            <div className="mt-1 text-sm font-semibold text-on-surface">
              {sourceAccountLabel}
            </div>
          </div>
          <div className="rounded-2xl bg-surface-container p-3">
            <div className="text-xs font-semibold uppercase tracking-[0.08em] text-on-surface-variant">
              Message time
            </div>
            <div className="mt-1 text-sm font-semibold text-on-surface">
              {messageTimestampLabel}
            </div>
          </div>
          <div className="rounded-2xl bg-surface-container p-3">
            <div className="text-xs font-semibold uppercase tracking-[0.08em] text-on-surface-variant">
              Institution
            </div>
            <div className="mt-1 text-sm font-semibold text-on-surface">
              {sourceInstitutionLabel ?? "Unknown source"}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-on-surface">
              Transaction title
            </span>
            <input
              className="min-h-12 w-full rounded-2xl border border-outline-variant bg-surface px-4 py-3 text-sm text-on-surface outline-none transition-colors focus:border-primary"
              onChange={(event) => onTransactionTitleChange?.(event.target.value)}
              type="text"
              value={transactionTitle}
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-on-surface">
              Category
            </span>
            <select
              className="min-h-12 w-full rounded-2xl border border-outline-variant bg-surface px-4 py-3 text-sm text-on-surface outline-none transition-colors focus:border-primary"
              onChange={(event) => onSelectedCategoryChange?.(event.target.value)}
              value={selectedCategory}
            >
              {categoryOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-on-surface">
              Notes
            </span>
            <textarea
              className="min-h-28 w-full rounded-2xl border border-outline-variant bg-surface px-4 py-3 text-sm text-on-surface outline-none transition-colors focus:border-primary"
              onChange={(event) => onNoteChange?.(event.target.value)}
              value={noteValue}
            />
          </label>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button
            className="min-h-12 flex-1 rounded-full bg-surface-container px-4 py-3 text-sm font-semibold text-on-surface active:scale-95"
            onClick={onSaveDraft}
            type="button"
          >
            Save changes
          </button>
          <button
            className="min-h-12 flex-1 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-on-primary active:scale-95"
            onClick={onApproveTransaction}
            type="button"
          >
            Approve transaction
          </button>
        </div>
      </section>
    </div>
  );
}
