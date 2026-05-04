import { MaterialSymbol } from "@omni-sync/ui";

import {
  MotionPage,
  MotionPanel,
  MotionStagger,
} from "../components/settingsMotionPrimitives";

interface SetupChecklistScreenProps {
  accountReady: boolean;
  captureReady: boolean;
  captureStatusLabel: string;
  captureTitle: string;
  captureDescription: string;
  captureActionLabel: string;
  continueLabel: string;
  onOpenAccounts: () => void;
  onOpenSmsCapture: () => void;
  onContinue: () => void;
}

function ChecklistRow({
  title,
  description,
  ready,
  actionLabel,
  statusLabel,
  onAction,
}: {
  title: string;
  description: string;
  ready: boolean;
  actionLabel: string;
  statusLabel?: string;
  onAction: () => void;
}) {
  return (
    <article className="rounded-[26px] border border-outline-variant/18 bg-surface px-4 py-4 shadow-[0_4px_20px_rgba(46,50,48,0.04)]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex h-8 w-8 items-center justify-center rounded-full ${
                ready
                  ? "bg-primary-container/70 text-primary"
                  : "bg-surface-container-high text-on-surface-variant"
              }`}
            >
              <MaterialSymbol
                className="text-[18px]"
                filled={ready}
                name={ready ? "check" : "radio_button_unchecked"}
              />
            </span>
            <h3 className="font-headline text-xl font-semibold text-on-surface">
              {title}
            </h3>
          </div>
          <p className="mt-3 text-sm leading-6 text-on-surface-variant">
            {description}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
            ready
              ? "bg-primary/10 text-primary"
              : "bg-surface-container text-on-surface-variant"
          }`}
        >
          {statusLabel ?? (ready ? "Done" : "Needs setup")}
        </span>
      </div>
      <div className="mt-4 flex justify-end">
        <button
          className="rounded-full bg-surface-container px-4 py-2 text-sm font-semibold text-primary transition active:scale-[0.98]"
          onClick={onAction}
          type="button"
        >
          {actionLabel}
        </button>
      </div>
    </article>
  );
}

export function SetupChecklistScreen({
  accountReady,
  captureReady,
  captureStatusLabel,
  captureTitle,
  captureDescription,
  captureActionLabel,
  continueLabel,
  onOpenAccounts,
  onOpenSmsCapture,
  onContinue,
}: SetupChecklistScreenProps) {
  return (
    <MotionPage includeStyles className="space-y-6">
      <section className="space-y-6">
        <MotionPanel
          className="rounded-[32px] border border-outline-variant/18 bg-[linear-gradient(145deg,rgba(248,244,237,0.98),rgba(240,235,226,0.96))] p-6 shadow-[0_10px_32px_rgba(46,50,48,0.08)]"
          variant="hero"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-on-surface-variant">
            Private wallet alpha
          </p>
          <h1 className="mt-3 font-headline text-3xl font-semibold tracking-tight text-on-surface">
            Finish your private wallet setup
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-on-surface-variant">
            Private wallet starts empty. Finish these steps before relying on
            Home, Inbox, Ledger, or Add on this device.
          </p>
        </MotionPanel>

        <MotionStagger className="grid gap-4" delay={60} step={45}>
          <ChecklistRow
            actionLabel={accountReady ? "Review accounts" : "Create account"}
            description="Add the bank, mobile, or cash account you actually use."
            onAction={onOpenAccounts}
            ready={accountReady}
            title="Create your first account"
          />
          <ChecklistRow
            actionLabel={captureActionLabel}
            description={captureDescription}
            onAction={onOpenSmsCapture}
            ready={captureReady}
            statusLabel={captureStatusLabel}
            title={captureTitle}
          />
        </MotionStagger>

        <MotionPanel className="flex justify-end" delay={180} variant="subtle">
          <button
            className="rounded-[22px] bg-primary px-5 py-3 text-sm font-semibold text-on-primary shadow-[0_8px_24px_rgba(31,84,75,0.24)] transition active:scale-[0.98]"
            onClick={onContinue}
            type="button"
          >
            {continueLabel}
          </button>
        </MotionPanel>
      </section>
    </MotionPage>
  );
}
