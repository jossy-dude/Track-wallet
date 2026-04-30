import { BudgetLimitCard, MaterialSymbol, type BudgetCategorySnapshot } from "@omni-sync/ui";

import { ActivityFeed, type ActivityFeedItem } from "../components/ActivityFeed";
import { MetricCard } from "../components/MetricCard";

interface InsightsScreenProps {
  netFlowDisplay: string;
  incomeDisplay: string;
  outflowDisplay: string;
  totalBalanceDisplay: string;
  budgetCards: readonly BudgetCategorySnapshot[];
  recentApprovedActivity: readonly ActivityFeedItem[];
}

export function InsightsScreen({
  netFlowDisplay,
  incomeDisplay,
  outflowDisplay,
  totalBalanceDisplay,
  budgetCards,
  recentApprovedActivity,
}: InsightsScreenProps) {
  return (
    <>
      <section className="rounded-[24px] bg-surface-container-low p-6 shadow-[0_4px_20px_rgba(46,50,48,0.06)]">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-on-surface-variant">
              Insight snapshot
            </p>
            <h2 className="font-headline text-3xl font-semibold tracking-tight text-on-surface">
              Net movement {netFlowDisplay}
            </h2>
            <p className="max-w-xl text-sm text-on-surface-variant">
              A compact view of approved income, outgoing spend, and the categories that currently shape your month.
            </p>
          </div>
          <div className="rounded-full bg-primary-container/30 p-3 text-primary">
            <MaterialSymbol className="text-[24px]" filled name="insights" />
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <MetricCard
            hint="Credits approved"
            icon="south_west"
            label="Income"
            tone="primary"
            value={incomeDisplay}
          />
          <MetricCard
            hint="Debits and transfers"
            icon="north_east"
            label="Outflow"
            tone="tertiary"
            value={outflowDisplay}
          />
          <MetricCard
            hint="Current wallet stack"
            icon="account_balance_wallet"
            label="Total balance"
            tone="secondary"
            value={totalBalanceDisplay}
          />
        </div>
      </section>

      <BudgetLimitCard
        categories={budgetCards}
        periodLabel="This Month"
        title="Budget Limit"
      />

      <ActivityFeed
        description="Recent approved ledger flow powering the dashboard totals."
        emptyLabel="No approved entries yet, so insights are still empty."
        items={recentApprovedActivity}
        title="Recent Approved Flow"
      />
    </>
  );
}
