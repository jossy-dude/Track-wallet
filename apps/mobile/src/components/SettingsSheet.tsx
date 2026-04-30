import { useState } from "react";

import { MaterialSymbol } from "@omni-sync/ui";

interface DebugSenderOption {
  value: string
  label: string
}

interface SettingsSheetProps {
  isOpen: boolean
  onClose: () => void
  pendingCount: number
  approvedCount: number
  accountCount: number
  totalBalanceDisplay: string
  debugSenderLabel: string
  debugSenderOptions: readonly DebugSenderOption[]
  rawInput: string
  previewSummary: string
  debugFeedback: string
  onDebugSenderChange: (value: string) => void
  onRawInputChange: (value: string) => void
  onQueueDebugSms: () => void
  onRestoreDemoData: () => void
  onClearLocalState: () => void
}

export function SettingsSheet({
  isOpen,
  onClose,
  pendingCount,
  approvedCount,
  accountCount,
  totalBalanceDisplay,
  debugSenderLabel,
  debugSenderOptions,
  rawInput,
  previewSummary,
  debugFeedback,
  onDebugSenderChange,
  onRawInputChange,
  onQueueDebugSms,
  onRestoreDemoData,
  onClearLocalState,
}: SettingsSheetProps) {
  const [showParserLab, setShowParserLab] = useState(false)

  if (!isOpen) {
    return null
  }

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-[55] flex items-end justify-center bg-[#2e3230]/30 p-4 backdrop-blur-sm sm:items-center sm:justify-end"
      role="dialog"
    >
      <section className="max-h-[calc(100dvh-2rem)] w-full max-w-xl overflow-y-auto rounded-[28px] bg-surface-container-lowest p-5 shadow-[0_20px_60px_rgba(46,50,48,0.22)]">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-sm font-medium text-on-surface-variant">
              Workspace controls
            </p>
            <h2 className="font-headline text-2xl font-semibold text-on-surface">
              Settings and Sync Hub
            </h2>
          </div>
          <button
            aria-label="Close settings"
            className="flex min-h-12 min-w-12 items-center justify-center rounded-full bg-surface-container text-on-surface active:scale-95"
            onClick={onClose}
            type="button"
          >
            <MaterialSymbol className="text-[20px]" name="close" />
          </button>
        </div>

        <section className="rounded-[24px] bg-primary p-5 text-on-primary shadow-[0_4px_20px_rgba(46,50,48,0.06)]">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-on-primary/80">
                Local-first mode
              </p>
              <h3 className="font-headline text-2xl font-semibold">
                Sync-ready mobile shell
              </h3>
              <p className="max-w-md text-sm text-on-primary/85">
                The frontend is live on dummy local data. SMS parsing, edit, and approval are active; desktop sync stays dormant for this pass.
              </p>
            </div>
            <div className="rounded-full bg-white/10 p-3">
              <MaterialSymbol className="text-[24px]" filled name="settings" />
            </div>
          </div>
        </section>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <article className="rounded-2xl bg-surface-container p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
              Pending inbox
            </div>
            <div className="mt-2 font-headline text-2xl font-semibold text-on-surface">
              {pendingCount}
            </div>
          </article>
          <article className="rounded-2xl bg-surface-container p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
              Approved ledger
            </div>
            <div className="mt-2 font-headline text-2xl font-semibold text-on-surface">
              {approvedCount}
            </div>
          </article>
          <article className="rounded-2xl bg-surface-container p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
              Visible accounts
            </div>
            <div className="mt-2 font-headline text-2xl font-semibold text-on-surface">
              {accountCount}
            </div>
          </article>
          <article className="rounded-2xl bg-surface-container p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
              Total balance
            </div>
            <div className="mt-2 font-headline text-lg font-semibold text-on-surface">
              {totalBalanceDisplay}
            </div>
          </article>
        </div>

        <div className="mt-5 grid gap-3">
          <button
            className="flex min-h-12 items-center justify-between rounded-2xl bg-surface-container px-4 py-3 text-left text-on-surface active:scale-[0.99]"
            onClick={() => setShowParserLab((current) => !current)}
            type="button"
          >
            <div>
              <div className="text-sm font-semibold">Developer parser lab</div>
              <div className="text-xs text-on-surface-variant">
                Hidden from the main dashboard, available for browser-side SMS testing.
              </div>
            </div>
            <MaterialSymbol
              className="text-[20px]"
              name={showParserLab ? "expand_less" : "expand_more"}
            />
          </button>

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              className="min-h-12 rounded-full bg-surface-container px-5 py-3 text-sm font-semibold text-on-surface active:scale-95"
              onClick={onRestoreDemoData}
              type="button"
            >
              Restore demo data
            </button>
            <button
              className="min-h-12 rounded-full border border-outline-variant bg-surface-container-low px-5 py-3 text-sm font-semibold text-on-surface active:scale-95"
              onClick={onClearLocalState}
              type="button"
            >
              Clear local state
            </button>
          </div>
        </div>

        {showParserLab ? (
          <section className="mt-5 rounded-[24px] bg-surface-container-high p-5">
            <div className="mb-4 space-y-1">
              <h3 className="font-headline text-xl font-semibold text-on-surface">
                Parser debug console
              </h3>
              <p className="text-sm text-on-surface-variant">
                Paste a raw bank SMS here to drive the inbox flow before the native listener lands.
              </p>
            </div>

            <div className="grid gap-4">
              <label className="grid gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-on-surface-variant">
                  Sender
                </span>
                <select
                  className="min-h-12 rounded-2xl border border-outline-variant bg-surface-container-lowest px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
                  onChange={(event) => onDebugSenderChange(event.target.value)}
                  value={debugSenderLabel}
                >
                  {debugSenderOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-on-surface-variant">
                  Raw SMS
                </span>
                <textarea
                  className="min-h-32 rounded-2xl border border-outline-variant bg-surface-container-lowest px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
                  onChange={(event) => onRawInputChange(event.target.value)}
                  placeholder="Paste a raw bank SMS here to preview and queue it."
                  value={rawInput}
                />
              </label>

              <div className="rounded-2xl bg-surface-container p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-on-surface-variant">
                  Preview
                </div>
                <p className="mt-2 text-sm text-on-surface">{previewSummary}</p>
                <p className="mt-2 text-xs text-on-surface-variant">{debugFeedback}</p>
              </div>

              <button
                className="min-h-12 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-on-primary active:scale-95 disabled:opacity-50"
                disabled={!rawInput.trim()}
                onClick={onQueueDebugSms}
                type="button"
              >
                Queue SMS into inbox
              </button>
            </div>
          </section>
        ) : null}
      </section>
    </div>
  )
}
