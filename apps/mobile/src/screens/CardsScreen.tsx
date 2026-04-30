import {
  AccountCarousel,
  BalanceBreakdownGrid,
  BalanceSummaryCard,
  MaterialSymbol,
  type AccountSummaryCardData,
  type BalanceBreakdownItem,
} from "@omni-sync/ui";

import { ActivityFeed, type ActivityFeedItem } from "../components/ActivityFeed";
import { MetricCard } from "../components/MetricCard";

interface CardsScreenProps {
  topInstitutionHeadline: string;
  accountCount: number;
  topBalanceDisplay: string;
  visibleChannelCount: number;
  balanceBreakdownItems: readonly BalanceBreakdownItem[];
  totalBalanceDisplay: string;
  accountCards: readonly AccountSummaryCardData[];
  accountActivity: readonly ActivityFeedItem[];
}

export function CardsScreen({
  topInstitutionHeadline,
  accountCount,
  topBalanceDisplay,
  visibleChannelCount,
  balanceBreakdownItems,
  totalBalanceDisplay,
  accountCards,
  accountActivity,
}: CardsScreenProps) {
  return (
    <>
      <section className="rounded-[24px] bg-surface-container-low p-6 shadow-[0_4px_20px_rgba(46,50,48,0.06)]">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-on-surface-variant">
              Wallet stack
            </p>
            <h2 className="font-headline text-3xl font-semibold tracking-tight text-on-surface">
              {topInstitutionHeadline}
            </h2>
            <p className="max-w-xl text-sm text-on-surface-variant">
              This is the account-focused view. It reflects the latest running balances extracted from your parsed SMS stream.
            </p>
          </div>
          <div className="rounded-full bg-tertiary-container/30 p-3 text-tertiary">
            <MaterialSymbol className="text-[24px]" filled name="credit_card" />
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <MetricCard
            hint="Known account surfaces"
            icon="inventory_2"
            label="Accounts"
            tone="primary"
            value={String(accountCount)}
          />
          <MetricCard
            hint="Largest visible balance"
            icon="workspace_premium"
            label="Top balance"
            tone="tertiary"
            value={topBalanceDisplay}
          />
          <MetricCard
            hint="Bank, mobile, and cash"
            icon="layers"
            label="Channels"
            tone="secondary"
            value={String(visibleChannelCount)}
          />
        </div>
      </section>

      <BalanceSummaryCard
        breakdown={<BalanceBreakdownGrid items={balanceBreakdownItems} />}
        title="Visible balances"
        totalBalanceDisplay={totalBalanceDisplay}
      />

      <AccountCarousel accounts={accountCards} title="Balance Cards" />

      <ActivityFeed
        description="Latest approved transactions mapped back to their visible account references."
        emptyLabel="No account-linked activity is visible yet."
        items={accountActivity}
        title="Latest Account Activity"
      />
    </>
  );
}
