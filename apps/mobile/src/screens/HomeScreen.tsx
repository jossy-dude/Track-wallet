import { useMemo } from "react";

import type { AccountSummary } from "@omni-sync/core";
import {
  BalanceBreakdownGrid,
  BalanceSummaryCard,
  InboxPanel,
  type BalanceBreakdownItem,
  type BudgetCategorySnapshot,
  type InboxTransactionPreview,
} from "@omni-sync/ui";

import { ActivityFeed, type ActivityFeedItem } from "../components/ActivityFeed";
import { AmountFigure } from "../components/AmountFigure";
import { LiquidMeter } from "../components/LiquidMeter";
import {
  MotionPage,
  MotionPanel,
  MotionStagger,
} from "../components/settingsMotionPrimitives";
import {
  StackedPocketDeck,
  deriveWalletVisualSeed,
  type WalletCardVisual,
} from "../components/accountCardStudio";
import type { CurrencyLabelPreference } from "../preferences/displayPreferences";

interface HomeScreenProps {
  balanceBreakdownItems: readonly BalanceBreakdownItem[];
  totalBalanceMinor: number;
  currencyLabel: CurrencyLabelPreference;
  defaultAccountId: string | null;
  accountCards: readonly {
    id: string;
    institutionName: string;
    balanceDisplay: string;
    maskedAccountNumber: string;
    icon: string;
    tone: "primary" | "tertiary" | "secondary" | "surface";
  }[];
  accountSummaries: readonly AccountSummary[];
  budgetCards: readonly BudgetCategorySnapshot[];
  pendingCount: number;
  inboxTransactions: readonly InboxTransactionPreview[];
  recentApprovedActivity: readonly ActivityFeedItem[];
  onOpenInbox: () => void;
  onApproveTransaction: (transaction: InboxTransactionPreview) => void;
  onEditTransaction: (transaction: InboxTransactionPreview) => void;
  onRejectTransaction: (transaction: InboxTransactionPreview) => void;
  onEditApprovedTransaction: (transactionId: string) => void;
  onOpenAccountView: (focusSection?: "bank" | "mobile_money" | "cash") => void;
  onOpenBudget: () => void;
  onAddBudgetCategory: () => void;
  detailedTotalBalanceEnabled: boolean;
}

type HomeAccountFocus = "bank" | "mobile_money" | "cash";

function HomeBudgetPreview({
  categories,
  onManage,
  onAdd,
}: {
  categories: readonly BudgetCategorySnapshot[];
  onManage: () => void;
  onAdd: () => void;
}) {
  return (
    <section className="w-full min-w-0 overflow-hidden rounded-[28px] border border-outline-variant/18 bg-surface-container-low p-4 shadow-[0_8px_24px_rgba(46,50,48,0.08)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-on-surface-variant">
            Budget
          </p>
          <h3 className="mt-1 font-headline text-xl font-semibold text-on-surface">
            Limits
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-outline-variant/16 bg-surface text-primary transition active:scale-[0.97]"
            onClick={onAdd}
            type="button"
          >
            +
          </button>
          <button
            className="rounded-full bg-surface px-3 py-2 text-xs font-semibold text-primary transition active:scale-[0.97]"
            onClick={onManage}
            type="button"
          >
            Manage
          </button>
        </div>
      </div>

      <div className="mt-4 rounded-[24px] bg-white/72 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
        <MotionStagger
          className="grid gap-3"
          step={35}
          style={{ gridTemplateColumns: "repeat(auto-fit, minmax(132px, 1fr))" } as never}
        >
          {categories.map((category) => {
            const tone =
              category.progressPercent > 100
                ? "danger"
                : category.tone === "primary"
                  ? "primary"
                  : category.tone === "tertiary"
                    ? "tertiary"
                    : "secondary";

            return (
              <div
                className="flex min-w-0 flex-col gap-2 rounded-[20px] bg-white/55 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.62)]"
                key={`pill-${category.id}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="min-w-0 truncate text-[10px] font-semibold uppercase tracking-[0.08em] text-on-surface-variant">
                    {category.label}
                  </p>
                  <p className="rounded-full bg-white/78 px-2 py-0.5 text-[10px] font-semibold text-on-surface shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
                    {category.progressPercent}%
                  </p>
                </div>
                <div className="rounded-full bg-[#edf0f4] p-[5px]">
                  <LiquidMeter
                    className="h-[88px] w-full rounded-full"
                    orientation="vertical"
                    progressPercent={category.progressPercent}
                    tone={tone}
                  />
                </div>
                <p className="truncate text-[10px] font-semibold text-on-surface-variant">
                  {category.amountDisplay}
                </p>
                </div>
              );
            })}
        </MotionStagger>
      </div>

      <MotionStagger
        className="mt-3 grid gap-2.5"
        step={28}
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" } as never}
      >
        {categories.map((category) => (
          <div
            className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-[20px] bg-white/70 px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]"
            key={category.id}
          >
            <div className="min-w-0">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className={`inline-flex h-2.5 w-2.5 rounded-full ${
                      category.progressPercent > 100
                        ? "bg-[#742626]"
                        : category.tone === "primary"
                          ? "bg-[#f0d55d]"
                          : category.tone === "tertiary"
                            ? "bg-[#90e3d6]"
                            : "bg-[#7780ff]"
                    }`}
                  />
                  <p className="max-w-[11rem] truncate text-[11px] font-semibold text-on-surface-variant">
                    {category.label}
                  </p>
                </div>
                <p className="text-[11px] font-semibold text-on-surface">
                  {category.progressPercent}%
                </p>
              </div>
              <LiquidMeter
                className="h-2.5 w-full"
                progressPercent={category.progressPercent}
                tone={
                  category.progressPercent > 100
                    ? "danger"
                    : category.tone === "primary"
                      ? "primary"
                      : category.tone === "tertiary"
                        ? "tertiary"
                        : "secondary"
                }
              />
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-[0.12em] text-on-surface-variant/75">
                Used
              </p>
              <p className="mt-1 text-xs font-semibold text-on-surface">
                {category.amountDisplay}
              </p>
            </div>
          </div>
        ))}
      </MotionStagger>
    </section>
  );
}

export function HomeScreen({
  balanceBreakdownItems,
  totalBalanceMinor,
  currencyLabel,
  defaultAccountId,
  accountCards,
  accountSummaries,
  budgetCards,
  pendingCount,
  inboxTransactions,
  recentApprovedActivity,
  onOpenInbox,
  onApproveTransaction,
  onEditTransaction,
  onRejectTransaction,
  onEditApprovedTransaction,
  onOpenAccountView,
  onOpenBudget,
  onAddBudgetCategory,
  detailedTotalBalanceEnabled,
}: HomeScreenProps) {
  const walletVisuals = useMemo<WalletCardVisual[]>(
    () =>
      accountSummaries.map((account) => {
        const card = accountCards.find((item) => item.id === account.accountId);
        const seed = deriveWalletVisualSeed(account.accountId, account.channel);

        return {
          accountId: account.accountId,
          institutionName: account.institutionName,
          maskedAccountNumber: account.maskedAccountNumber,
          fullAccountNumber: account.fullAccountNumber,
          balanceMinor: account.balanceMinor,
          iconName: card?.icon ?? account.iconName,
          templateId: seed.templateId,
          accentId: seed.accentId,
          helperLabel:
            account.channel === "bank"
              ? "Bank balance"
              : account.channel === "mobile_money"
                ? "Mobile wallet"
                : "Cash reserve",
          tag:
            account.channel === "bank"
              ? "Tracked account"
              : account.channel === "mobile_money"
                ? "Wallet route"
                : "Manual pocket",
          currencyLabel,
          isDefault: account.accountId === defaultAccountId,
        };
      }),
    [accountCards, accountSummaries, currencyLabel, defaultAccountId],
  );

  return (
    <MotionPage includeStyles className="space-y-6">
      <section className="space-y-6">
        <MotionPanel variant="hero">
          <BalanceSummaryCard
            breakdown={
              <div className="space-y-5">
                <BalanceBreakdownGrid
                  className="gap-3"
                  items={balanceBreakdownItems}
                  onItemPress={(item) => {
                    const target =
                      item.id === "mobile-money"
                        ? "mobile_money"
                        : (item.id as HomeAccountFocus);
                    onOpenAccountView(target);
                  }}
                />

                {detailedTotalBalanceEnabled && walletVisuals.length > 0 ? (
                  <div className="rounded-[30px] border border-outline-variant/14 bg-[linear-gradient(180deg,rgba(255,255,255,0.9),rgba(246,241,232,0.92))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.72),0_10px_24px_rgba(46,50,48,0.06)]">
                    <StackedPocketDeck className="mx-1" visuals={walletVisuals} />
                  </div>
                ) : null}
              </div>
            }
            onPress={
              detailedTotalBalanceEnabled ? undefined : () => onOpenAccountView()
            }
            title="Total balance"
            totalBalanceDisplay=""
            valueContent={
              <AmountFigure
                amountMinor={totalBalanceMinor}
                currencyLabel={currencyLabel}
                valueClassName="text-[2.3rem]"
              />
            }
          />
        </MotionPanel>

        <MotionStagger className="grid gap-4" delay={70} step={45}>
          <MotionPanel>
            <HomeBudgetPreview
              categories={budgetCards}
              onAdd={onAddBudgetCategory}
              onManage={onOpenBudget}
            />
          </MotionPanel>
          <MotionPanel>
            <InboxPanel
              className="h-full w-full min-w-0"
              onApproveTransaction={onApproveTransaction}
              onEditTransaction={onEditTransaction}
              onRejectTransaction={onRejectTransaction}
              onSeeAll={onOpenInbox}
              orientation="horizontal"
              pendingCount={pendingCount}
              seeAllLabel="Open"
              title="Queue"
              transactions={inboxTransactions}
            />
          </MotionPanel>
        </MotionStagger>

        <MotionPanel delay={150} variant="subtle">
          <ActivityFeed
            description="Approved only."
            emptyLabel="No approved transactions yet."
            items={recentApprovedActivity.map((item) => ({
              ...item,
              onIconPress: () => onEditApprovedTransaction(item.id),
            }))}
            title="Recent activity"
          />
        </MotionPanel>
      </section>
    </MotionPage>
  );
}
