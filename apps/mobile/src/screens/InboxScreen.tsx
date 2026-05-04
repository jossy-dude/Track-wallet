import { InboxPanel, MaterialSymbol, type InboxTransactionPreview } from "@omni-sync/ui";

import { ActivityFeed, type ActivityFeedItem } from "../components/ActivityFeed";
import { MetricCard } from "../components/MetricCard";
import {
  MotionPage,
  MotionPanel,
  MotionStagger,
} from "../components/settingsMotionPrimitives";
import {
  UnmatchedSmsPanel,
  type UnmatchedSmsPreview,
} from "../components/UnmatchedSmsPanel";

interface InboxScreenProps {
  pendingCount: number;
  pendingValueDisplay: string;
  pendingInstitutionCount: number;
  unmatchedCount: number;
  showFirstUseGuidance?: boolean;
  inboxTransactions: readonly InboxTransactionPreview[];
  unmatchedMessages: readonly UnmatchedSmsPreview[];
  recentApprovedActivity: readonly ActivityFeedItem[];
  onApproveTransaction: (transaction: InboxTransactionPreview) => void;
  onEditTransaction: (transaction: InboxTransactionPreview) => void;
  onRejectTransaction: (transaction: InboxTransactionPreview) => void;
  onDismissUnmatchedMessage: (message: UnmatchedSmsPreview) => void;
  onOpenSettings: () => void;
}

export function InboxScreen({
  pendingCount,
  pendingValueDisplay,
  pendingInstitutionCount,
  unmatchedCount,
  showFirstUseGuidance = false,
  inboxTransactions,
  unmatchedMessages,
  recentApprovedActivity,
  onApproveTransaction,
  onEditTransaction,
  onRejectTransaction,
  onDismissUnmatchedMessage,
  onOpenSettings,
}: InboxScreenProps) {
  const hasApprovedActivity = recentApprovedActivity.length > 0;

  return (
    <MotionPage includeStyles className="space-y-5">
      <section className="space-y-5">
        <MotionPanel
          className="rounded-[28px] border border-outline-variant/18 bg-surface-container-low p-5 shadow-[0_4px_20px_rgba(46,50,48,0.06)]"
          variant="hero"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-on-surface-variant">
                Inbox
              </p>
              <h2 className="font-headline text-[2rem] font-semibold tracking-tight text-on-surface">
                Review new money moves
              </h2>
              <p className="max-w-xl text-sm text-on-surface-variant">
                New transactions stop here first so you can fix them before they
                move into your wallet activity.
              </p>
            </div>
            <button
              className="flex min-h-12 min-w-12 items-center justify-center rounded-full bg-surface text-on-surface active:scale-95"
              onClick={onOpenSettings}
              type="button"
            >
              <MaterialSymbol className="text-[22px]" name="tune" />
            </button>
          </div>

          <MotionStagger className="mt-5 grid grid-cols-2 gap-3" step={30}>
            <MetricCard
              hint="Waiting for review"
              icon="mark_email_unread"
              label="To review"
              tone="primary"
              value={String(pendingCount)}
            />
            <MetricCard
              hint="Estimated amount"
              icon="payments"
              label="Value"
              tone="tertiary"
              value={pendingValueDisplay}
            />
            <MetricCard
              hint="Banks and wallets"
              icon="hub"
              label="Sources"
              tone="secondary"
              value={String(pendingInstitutionCount)}
            />
            <MetricCard
              hint="Needs extra help"
              icon="sms_failed"
              label="Needs help"
              tone="secondary"
              value={String(unmatchedCount)}
            />
          </MotionStagger>
        </MotionPanel>

        <MotionStagger className="space-y-5" delay={70} step={45}>
          {showFirstUseGuidance ? (
            <MotionPanel className="rounded-[24px] border border-outline-variant/18 bg-surface p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-on-surface-variant">
                First review pass
              </p>
              <h3 className="mt-2 font-headline text-2xl font-semibold text-on-surface">
                Start your first review loop
              </h3>
              <p className="mt-3 text-sm leading-6 text-on-surface-variant">
                Your inbox will fill up after you add a manual transaction or
                finish SMS setup. Both paths use the same approve-or-fix review
                flow.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-[20px] border border-outline-variant/20 bg-surface-container-low px-4 py-4">
                  <p className="text-sm font-semibold text-on-surface">
                    Add a manual transaction
                  </p>
                  <p className="mt-1 text-sm text-on-surface-variant">
                    Use manual entry to practice the review loop right away.
                  </p>
                </div>
                <div className="rounded-[20px] border border-outline-variant/20 bg-surface-container-low px-4 py-4">
                  <p className="text-sm font-semibold text-on-surface">
                    Set up SMS capture
                  </p>
                  <p className="mt-1 text-sm text-on-surface-variant">
                    Connect automatic SMS imports when this phone is ready.
                  </p>
                </div>
              </div>
            </MotionPanel>
          ) : null}

          <MotionPanel>
            <InboxPanel
              emptyStateDescription="Add a manual transaction or finish SMS setup to start your inbox."
              emptyStateTitle="Nothing is waiting for review yet."
              orientation="vertical"
              onApproveTransaction={onApproveTransaction}
              onEditTransaction={onEditTransaction}
              onRejectTransaction={onRejectTransaction}
              pendingCount={pendingCount}
              showSeeAll={false}
              title="Ready to review"
              transactions={inboxTransactions}
            />
          </MotionPanel>

          <MotionPanel>
            <UnmatchedSmsPanel
              messages={unmatchedMessages}
              onDismissMessage={onDismissUnmatchedMessage}
            />
          </MotionPanel>

          {hasApprovedActivity ? (
            <MotionPanel variant="subtle">
              <ActivityFeed
                description="Approved items move here after review."
                emptyLabel="Nothing approved yet."
                items={recentApprovedActivity}
                title="Approved activity"
              />
            </MotionPanel>
          ) : (
            <MotionPanel
              className="rounded-[24px] border border-outline-variant/18 bg-surface p-5"
              variant="subtle"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-on-surface-variant">
                Approved activity
              </p>
              <h3 className="mt-2 text-lg font-semibold text-on-surface">
                Nothing approved yet
              </h3>
              <p className="mt-2 text-sm text-on-surface-variant">
                Approved transactions will appear here after you review them in
                the inbox.
              </p>
            </MotionPanel>
          )}
        </MotionStagger>
      </section>
    </MotionPage>
  );
}
