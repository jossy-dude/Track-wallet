import { InboxPanel, MaterialSymbol, type InboxTransactionPreview } from "@omni-sync/ui";

import { ActivityFeed, type ActivityFeedItem } from "../components/ActivityFeed";
import { MetricCard } from "../components/MetricCard";
import {
  UnmatchedSmsPanel,
  type UnmatchedSmsPreview,
} from "../components/UnmatchedSmsPanel";

interface InboxScreenProps {
  pendingCount: number;
  pendingValueDisplay: string;
  pendingInstitutionCount: number;
  unmatchedCount: number;
  inboxTransactions: readonly InboxTransactionPreview[];
  unmatchedMessages: readonly UnmatchedSmsPreview[];
  recentApprovedActivity: readonly ActivityFeedItem[];
  onApproveTransaction: (transaction: InboxTransactionPreview) => void;
  onEditTransaction: (transaction: InboxTransactionPreview) => void;
  onDismissUnmatchedMessage: (message: UnmatchedSmsPreview) => void;
  onOpenSettings: () => void;
}

export function InboxScreen({
  pendingCount,
  pendingValueDisplay,
  pendingInstitutionCount,
  unmatchedCount,
  inboxTransactions,
  unmatchedMessages,
  recentApprovedActivity,
  onApproveTransaction,
  onEditTransaction,
  onDismissUnmatchedMessage,
  onOpenSettings,
}: InboxScreenProps) {
  return (
    <>
      <section className="rounded-[24px] bg-surface-container-low p-6 shadow-[0_4px_20px_rgba(46,50,48,0.06)]">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-on-surface-variant">
              Approval queue
            </p>
            <h2 className="font-headline text-3xl font-semibold tracking-tight text-on-surface">
              Inbox staging area
            </h2>
            <p className="max-w-xl text-sm text-on-surface-variant">
              Every parsed SMS lands here first. Edit good matches into the ledger, and keep unmatched messages visible for parser expansion.
            </p>
          </div>
          <button
            className="flex min-h-12 min-w-12 items-center justify-center rounded-full bg-surface-container text-on-surface active:scale-95"
            onClick={onOpenSettings}
            type="button"
          >
            <MaterialSymbol className="text-[22px]" name="tune" />
          </button>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-4">
          <MetricCard
            hint="Waiting review"
            icon="mark_email_unread"
            label="Pending"
            tone="primary"
            value={String(pendingCount)}
          />
          <MetricCard
            hint="Queue amount"
            icon="payments"
            label="Value"
            tone="tertiary"
            value={pendingValueDisplay}
          />
          <MetricCard
            hint="Sender families"
            icon="hub"
            label="Sources"
            tone="secondary"
            value={String(pendingInstitutionCount)}
          />
          <MetricCard
            hint="Needs regex work"
            icon="sms_failed"
            label="Unmatched"
            tone="secondary"
            value={String(unmatchedCount)}
          />
        </div>
      </section>

      <InboxPanel
        onApproveTransaction={onApproveTransaction}
        onEditTransaction={onEditTransaction}
        pendingCount={pendingCount}
        showSeeAll={false}
        title="Inbox"
        transactions={inboxTransactions}
      />

      <UnmatchedSmsPanel
        messages={unmatchedMessages}
        onDismissMessage={onDismissUnmatchedMessage}
      />

      <ActivityFeed
        description="Approved transactions fall out of the inbox and become part of your ledger immediately."
        emptyLabel="No approved history yet."
        items={recentApprovedActivity}
        title="Approved Recently"
      />
    </>
  );
}
