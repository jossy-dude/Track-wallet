import { cn } from "../utils";
import type { TransactionCategoryOption } from "../types";

import { MaterialSymbol } from "./MaterialSymbol";

export interface EditTransactionModalProps {
  isOpen: boolean;
  contextLabel?: string;
  titleLabel?: string;
  transactionTitle: string;
  selectedCategory: string;
  categoryOptions: readonly TransactionCategoryOption[];
  noteValue: string;
  parsedAmountDisplay: string;
  sourceAccountLabel: string;
  messageTimestampLabel: string;
  sourceInstitutionLabel?: string;
  sourceSenderLabel?: string;
  sourceConfidenceLabel?: string;
  sourceMessageBody?: string;
  selectedCategoryLabel?: string;
  selectedCategoryIcon?: string;
  categoryBudgetLabel?: string;
  categoryBudgetSpentDisplay?: string;
  categoryBudgetProgressPercent?: number;
  onClose?: () => void;
  onSaveDraft?: () => void;
  onRejectTransaction?: () => void;
  onApproveTransaction?: () => void;
  onTransactionTitleChange?: (value: string) => void;
  onSelectedCategoryChange?: (value: string) => void;
  onNoteChange?: (value: string) => void;
  saveButtonLabel?: string;
  rejectButtonLabel?: string;
  primaryButtonLabel?: string;
  className?: string;
}

export function EditTransactionModal({
  isOpen,
  contextLabel = "Approval editor",
  titleLabel = "Confirm transaction",
  transactionTitle,
  selectedCategory,
  categoryOptions,
  noteValue,
  parsedAmountDisplay,
  sourceAccountLabel,
  messageTimestampLabel,
  sourceInstitutionLabel,
  sourceSenderLabel,
  sourceConfidenceLabel,
  sourceMessageBody,
  selectedCategoryLabel,
  selectedCategoryIcon,
  categoryBudgetLabel,
  categoryBudgetSpentDisplay,
  categoryBudgetProgressPercent,
  onClose,
  onSaveDraft,
  onRejectTransaction,
  onApproveTransaction,
  onTransactionTitleChange,
  onSelectedCategoryChange,
  onNoteChange,
  saveButtonLabel = "Save changes",
  rejectButtonLabel = "Reject",
  primaryButtonLabel = "Approve transaction",
  className
}: EditTransactionModalProps) {
  if (!isOpen) {
    return null;
  }

  const hasSourceMessageEvidence = Boolean(
    sourceSenderLabel || sourceConfidenceLabel || sourceMessageBody,
  );

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-[60] flex items-end justify-center bg-[#2e3230]/30 p-4 backdrop-blur-sm sm:items-center"
      role="dialog"
    >
      <section
        className={cn(
          "max-h-[78vh] w-full max-w-lg overflow-y-auto rounded-[30px] border border-outline-variant/18 bg-[linear-gradient(180deg,rgba(248,244,237,0.98),rgba(240,235,226,0.98))] p-5 text-on-surface shadow-[0_24px_64px_rgba(46,50,48,0.18)]",
          className
        )}
      >
        <div className="-mx-5 -mt-5 mb-5 sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-outline-variant/12 bg-[linear-gradient(180deg,rgba(248,244,237,0.98),rgba(244,239,231,0.96))] px-5 py-4 backdrop-blur-sm">
          <div className="space-y-1">
            <p className="text-sm font-medium text-on-surface-variant">
              {contextLabel}
            </p>
            <h3 className="font-headline text-2xl font-semibold text-on-surface">
              {titleLabel}
            </h3>
          </div>
          <button
            aria-label="Close edit transaction modal"
            className="min-h-12 min-w-12 rounded-full bg-surface px-3 text-on-surface active:scale-95"
            onClick={onClose}
            type="button"
          >
            <MaterialSymbol className="text-[20px]" name="close" />
          </button>
        </div>

        <div className="mb-5 rounded-[28px] border border-outline-variant/18 bg-surface p-5 text-on-surface shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-on-surface-variant">
                Review draft
              </div>
              <div className="mt-2 font-headline text-3xl font-semibold leading-none">
                {parsedAmountDisplay}
              </div>
            </div>
            {selectedCategoryLabel ? (
              <div className="rounded-full bg-surface-container px-3 py-2 text-xs font-semibold text-on-surface">
                {selectedCategoryLabel}
              </div>
            ) : null}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <div className="inline-flex max-w-full items-center gap-2 rounded-full bg-surface-container-low px-3 py-2 text-xs font-semibold text-on-surface">
              {selectedCategoryIcon ? (
                <MaterialSymbol className="text-[16px]" filled name={selectedCategoryIcon} />
              ) : null}
              <span className="truncate">{sourceInstitutionLabel ?? "Unknown source"}</span>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full bg-surface-container-low px-3 py-2 text-xs font-semibold text-on-surface">
              <MaterialSymbol className="text-[16px]" name="schedule" />
              {messageTimestampLabel}
            </div>
          </div>
          {selectedCategoryLabel && categoryBudgetLabel ? (
            <div className="mt-4 rounded-[22px] bg-surface-container-low p-3 text-on-surface">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-on-surface-variant">
                    {categoryBudgetLabel}
                  </div>
                  <div className="mt-1 text-sm font-semibold text-on-surface">
                    {categoryBudgetSpentDisplay ?? "No spend yet"}
                  </div>
                </div>
                <div className="text-lg font-semibold">
                  {categoryBudgetProgressPercent ?? 0}%
                </div>
              </div>
              <div className="mt-3 h-2 rounded-full bg-surface-container">
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-200"
                  style={{
                    width:
                      (categoryBudgetProgressPercent ?? 0) <= 0
                        ? "0%"
                        : `${Math.min(100, categoryBudgetProgressPercent ?? 0)}%`,
                  }}
                />
              </div>
            </div>
          ) : null}
        </div>

        <div className="mb-5 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-surface p-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-on-surface-variant">
              Source account
            </div>
            <div className="mt-1 truncate text-sm font-semibold text-on-surface">
              {sourceAccountLabel}
            </div>
          </div>
          <div className="rounded-2xl bg-surface p-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-on-surface-variant">
              Message time
            </div>
            <div className="mt-1 truncate text-sm font-semibold text-on-surface">
              {messageTimestampLabel}
            </div>
          </div>
          <div className="col-span-2 rounded-2xl bg-surface p-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-on-surface-variant">
              Institution
            </div>
            <div className="mt-1 truncate text-sm font-semibold text-on-surface">
              {sourceInstitutionLabel ?? "Unknown source"}
            </div>
          </div>
        </div>

        {hasSourceMessageEvidence ? (
          <div className="mb-5 rounded-[24px] border border-outline-variant/12 bg-surface p-4 text-on-surface">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-on-surface-variant">
              Source message
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              {sourceSenderLabel ? (
                <span className="rounded-full bg-surface-container-low px-3 py-1.5 font-semibold text-on-surface">
                  {sourceSenderLabel}
                </span>
              ) : null}
              {sourceConfidenceLabel ? (
                <span className="rounded-full bg-primary-container/40 px-3 py-1.5 font-semibold text-on-surface">
                  {sourceConfidenceLabel}
                </span>
              ) : null}
            </div>
            {sourceMessageBody ? (
              <p className="mt-3 whitespace-pre-wrap break-words rounded-[20px] bg-surface-container-low px-3 py-3 text-sm leading-6 text-on-surface">
                {sourceMessageBody}
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="space-y-4">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-on-surface">
              Transaction title
            </span>
            <input
              aria-label="Transaction title"
              className="min-h-12 w-full rounded-2xl border border-outline-variant/20 bg-surface px-4 py-3 text-sm text-on-surface outline-none transition-colors focus:border-primary"
              name="transactionTitle"
              onChange={(event) => onTransactionTitleChange?.(event.target.value)}
              type="text"
              value={transactionTitle}
            />
          </label>

          <div className="block">
            <span className="mb-2 block text-sm font-semibold text-on-surface">
              Category
            </span>
            <div className="flex flex-wrap gap-2">
              {categoryOptions.map((option) => {
                const isSelected = option.value === selectedCategory;
                return (
                  <button
                    className={cn(
                      "rounded-full border px-3 py-2 text-[11px] font-semibold transition active:scale-[0.97]",
                      isSelected
                        ? "border-primary bg-primary text-on-primary"
                        : "border-outline-variant/20 bg-surface text-on-surface-variant",
                    )}
                    key={option.value}
                    onClick={() => onSelectedCategoryChange?.(option.value)}
                    type="button"
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-on-surface">
              Note
            </span>
            <textarea
              aria-label="Transaction note"
              className="min-h-24 w-full rounded-2xl border border-outline-variant/20 bg-surface px-4 py-3 text-sm text-on-surface outline-none transition-colors focus:border-primary"
              name="transactionNote"
              onChange={(event) => onNoteChange?.(event.target.value)}
              value={noteValue}
            />
          </label>
        </div>

        <div className="-mx-5 -mb-5 mt-6 sticky bottom-0 flex flex-col gap-3 border-t border-outline-variant/12 bg-[linear-gradient(180deg,rgba(244,239,231,0.92),rgba(240,235,226,0.98))] px-5 py-4 backdrop-blur-sm sm:flex-row">
          <button
            className="min-h-12 flex-1 rounded-full bg-surface px-4 py-3 text-sm font-semibold text-on-surface active:scale-95"
            onClick={onSaveDraft}
            type="button"
          >
            {saveButtonLabel}
          </button>
          {onRejectTransaction ? (
            <button
              className="min-h-12 flex-1 rounded-full bg-error/10 px-4 py-3 text-sm font-semibold text-error active:scale-95"
              onClick={onRejectTransaction}
              type="button"
            >
              {rejectButtonLabel}
            </button>
          ) : null}
          <button
            className="min-h-12 flex-1 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-on-primary active:scale-95"
            onClick={onApproveTransaction}
            type="button"
          >
            {primaryButtonLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
