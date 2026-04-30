import {
  AccountCarousel,
  BalanceBreakdownGrid,
  BalanceSummaryCard,
  BudgetLimitCard,
  InboxPanel,
  type AccountSummaryCardData,
  type BalanceBreakdownItem,
  type BudgetCategorySnapshot,
  type InboxTransactionPreview,
} from "@omni-sync/ui";

import { ActivityFeed, type ActivityFeedItem } from "../components/ActivityFeed";

interface HomeScreenProps {
  balanceBreakdownItems: readonly BalanceBreakdownItem[];
  totalBalanceDisplay: string;
  accountCards: readonly AccountSummaryCardData[];
  budgetCards: readonly BudgetCategorySnapshot[];
  pendingCount: number;
  inboxTransactions: readonly InboxTransactionPreview[];
  recentApprovedActivity: readonly ActivityFeedItem[];
  onOpenInbox: () => void;
  onApproveTransaction: (transaction: InboxTransactionPreview) => void;
  onEditTransaction: (transaction: InboxTransactionPreview) => void;
  onOpenAccountView: () => void;
}

export function HomeScreen({
  balanceBreakdownItems,
  totalBalanceDisplay,
  accountCards,
  budgetCards,
  pendingCount,
  inboxTransactions,
  recentApprovedActivity,
  onOpenInbox,
  onApproveTransaction,
  onEditTransaction,
  onOpenAccountView,
}: HomeScreenProps) {
  return (
    <>
      <BalanceSummaryCard
        breakdown={<BalanceBreakdownGrid items={balanceBreakdownItems} />}
        title="Total balance"
        totalBalanceDisplay={totalBalanceDisplay}
      />

      <AccountCarousel
        accounts={accountCards}
        onAccountPress={onOpenAccountView}
        title="Your Accounts"
      />

      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <BudgetLimitCard
          categories={budgetCards}
          periodLabel="This Month"
          title="Budget Limit"
        />

        <InboxPanel
          onApproveTransaction={onApproveTransaction}
          onEditTransaction={onEditTransaction}
          onSeeAll={onOpenInbox}
          pendingCount={pendingCount}
          seeAllLabel="Open Inbox"
          title="Inbox"
          transactions={inboxTransactions}
        />
      </div>

      <ActivityFeed
        description="The latest transactions already approved into the dashboard."
        emptyLabel="No approved transactions yet. Approve an inbox item to start building the ledger."
        items={recentApprovedActivity}
        title="Recently Approved"
      />
    </>
  );
}
