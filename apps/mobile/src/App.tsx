import { useEffect, useMemo, useState } from "react";

import {
  FINANCIAL_INSTITUTION_LABELS,
  TRANSACTION_CATEGORY_LABELS,
  type FinancialInstitution,
  type TransactionCategory,
  type TransactionDirection,
} from "@omni-sync/core";
import {
  buildDashboardSnapshot,
  useTransactionStore,
} from "@omni-sync/database";
import {
  BottomNavBar,
  EditTransactionModal,
  MaterialSymbol,
  TopAppBar,
  type AccountSummaryCardData,
  type BalanceBreakdownItem,
  type BottomNavigationItem,
  type BudgetCategorySnapshot,
  type InboxTransactionPreview,
  type TopAppBarAction,
  type TopAppBarProfile,
  type TransactionCategoryOption,
} from "@omni-sync/ui";

import { type ActivityFeedItem } from "./components/ActivityFeed";
import { SettingsSheet } from "./components/SettingsSheet";
import { type UnmatchedSmsPreview } from "./components/UnmatchedSmsPanel";
import { useParser } from "./hooks/useParser";
import { CardsScreen } from "./screens/CardsScreen";
import { HomeScreen } from "./screens/HomeScreen";
import { InboxScreen } from "./screens/InboxScreen";
import { InsightsScreen } from "./screens/InsightsScreen";

type MobileTab = "home" | "inbox" | "insights" | "cards";

const topAppBarProfile: TopAppBarProfile = {
  avatarUrl:
    "https://lh3.googleusercontent.com/aida-public/AB6AXuApl2JJNkqTUWCzCBjNsmgpYNuGrgo7J2_M6p-6xQ6zC6bePHumpKio9CtMjNOUxWY5yDK6HVeuKBL9RY4v3THf-ME3J9f3W-K5h4NpUlLrS1KLYHKcFeuWQXt8KqAPHACNQ9qBkEpTPDTrOE0xoHTOrxan-DezI1pmu-wrqTbBkEcEAyxgcGrSCIAK-t33Putza9TpjOBz9PmXp4Slddn2OuLKKZcx9tAem8hO0IEiiqNTfF3znH0_dY2VLURavC-4hnBfasWFirA",
  avatarAlt: "Track Wallet user profile",
};

const debugSenderOptions = [
  { value: "CBE", label: "CBE" },
  { value: "127", label: "Telebirr" },
  { value: "CBEBirr", label: "CBEBirr" },
  { value: "DashenBank", label: "Dashen Bank" },
  { value: "BOA", label: "BOA" },
  { value: "BunnaBank", label: "Bunna Bank" },
] as const;

const categoryToneMap: Record<
  TransactionCategory,
  "primary" | "tertiary" | "secondary"
> = {
  food: "primary",
  transport: "tertiary",
  housing: "secondary",
  income: "primary",
  entertainment: "secondary",
  misc: "tertiary",
};

const categoryIconMap: Record<TransactionCategory, string> = {
  food: "restaurant",
  transport: "directions_car",
  housing: "home",
  income: "payments",
  entertainment: "theater_comedy",
  misc: "category",
};

const institutionToneMap: Record<
  FinancialInstitution,
  "primary" | "tertiary" | "secondary"
> = {
  cbe: "primary",
  boa: "secondary",
  telebirr: "secondary",
  cbebirr: "secondary",
  dashen: "tertiary",
  bunna: "primary",
  unknown: "secondary",
};

const tabIconMap: Record<MobileTab, string> = {
  home: "home",
  inbox: "mail",
  insights: "analytics",
  cards: "credit_card",
};

const currencyFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const compactCurrencyFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const shortDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

const shortDateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const categoryOptions: TransactionCategoryOption[] = Object.entries(
  TRANSACTION_CATEGORY_LABELS,
).map(([value, label]) => ({
  value,
  label,
}));

function formatCurrencyMinor(amountMinor: number): string {
  return `ETB ${currencyFormatter.format(amountMinor / 100)}`;
}

function formatSignedCurrencyMinor(amountMinor: number): string {
  const sign = amountMinor > 0 ? "+" : amountMinor < 0 ? "-" : "";
  return `${sign}ETB ${currencyFormatter.format(Math.abs(amountMinor) / 100)}`;
}

function formatCompactCurrencyMinor(amountMinor: number): string {
  return `ETB ${compactCurrencyFormatter.format(amountMinor / 100)}`;
}

function formatShortDate(value: string): string {
  return shortDateFormatter.format(new Date(value));
}

function formatShortDateTime(value: string): string {
  return shortDateTimeFormatter.format(new Date(value));
}

function maskAccountReference(accountReference: string | undefined): string {
  if (!accountReference) {
    return "Unknown account";
  }

  return `**** ${accountReference.slice(-4)}`;
}

function formatDirectionAmount(
  amountMinor: number,
  feeMinor: number,
  direction: TransactionDirection,
): string {
  if (direction === "credit") {
    return formatSignedCurrencyMinor(amountMinor);
  }

  return formatSignedCurrencyMinor(-1 * (amountMinor + feeMinor));
}

function sortByNewest<T extends { occurredAt: string }>(items: readonly T[]): T[] {
  return [...items].sort(
    (left, right) =>
      new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime(),
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState<MobileTab>("home");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [rawInput, setRawInput] = useState("");
  const [debugSenderLabel, setDebugSenderLabel] = useState<string>("CBE");
  const [debugFeedback, setDebugFeedback] = useState(
    "Paste a raw bank SMS to preview how the parser and inbox will react.",
  );

  const { previewResult, parseAndQueue } = useParser(rawInput, debugSenderLabel);
  const hasInitialized = useTransactionStore((state) => state.hasInitialized);
  const approvalQueue = useTransactionStore((state) => state.approvalQueue);
  const approvedTransactions = useTransactionStore(
    (state) => state.approvedTransactions,
  );
  const unmatchedMessages = useTransactionStore((state) => state.unmatchedMessages);
  const accountSummaries = useTransactionStore((state) => state.accountSummaries);
  const budgetSummaries = useTransactionStore((state) => state.budgetSummaries);
  const activeQueueEntryId = useTransactionStore(
    (state) => state.activeQueueEntryId,
  );
  const seedDemoData = useTransactionStore((state) => state.seedDemoData);
  const openTransactionEditor = useTransactionStore(
    (state) => state.openTransactionEditor,
  );
  const closeTransactionEditor = useTransactionStore(
    (state) => state.closeTransactionEditor,
  );
  const editApprovalQueueItem = useTransactionStore(
    (state) => state.editApprovalQueueItem,
  );
  const approveQueueItem = useTransactionStore((state) => state.approveQueueItem);
  const dismissUnmatchedSms = useTransactionStore(
    (state) => state.dismissUnmatchedSms,
  );
  const clearAllData = useTransactionStore((state) => state.clearAllData);

  useEffect(() => {
    if (
      !hasInitialized &&
      approvalQueue.length === 0 &&
      approvedTransactions.length === 0
    ) {
      seedDemoData();
    }
  }, [
    approvalQueue.length,
    approvedTransactions.length,
    hasInitialized,
    seedDemoData,
  ]);

  const dashboardSnapshot = useMemo(
    () =>
      buildDashboardSnapshot({
        accountSummaries,
        approvalQueue,
        approvedTransactions,
      }),
    [accountSummaries, approvalQueue, approvedTransactions],
  );

  const sortedApprovalQueue = useMemo(
    () =>
      [...approvalQueue].sort(
        (left, right) =>
          new Date(right.queuedAt).getTime() - new Date(left.queuedAt).getTime(),
      ),
    [approvalQueue],
  );

  const sortedApprovedTransactions = useMemo(
    () => sortByNewest(approvedTransactions),
    [approvedTransactions],
  );

  const balanceBreakdownItems = useMemo<BalanceBreakdownItem[]>(
    () => [
      {
        id: "bank",
        label: "Banks",
        amountDisplay: formatCurrencyMinor(
          dashboardSnapshot.balanceByChannel.bank,
        ),
        icon: "account_balance",
        tone: "primary",
      },
      {
        id: "mobile-money",
        label: "Mobile",
        amountDisplay: formatCurrencyMinor(
          dashboardSnapshot.balanceByChannel.mobile_money,
        ),
        icon: "phone_iphone",
        tone: "tertiary",
      },
      {
        id: "cash",
        label: "Cash",
        amountDisplay: formatCurrencyMinor(
          dashboardSnapshot.balanceByChannel.cash,
        ),
        icon: "payments",
        tone: "secondary",
      },
    ],
    [dashboardSnapshot.balanceByChannel],
  );

  const accountCards = useMemo<AccountSummaryCardData[]>(
    () =>
      accountSummaries.map((accountSummary) => ({
        id: accountSummary.accountId,
        institutionName: accountSummary.institutionName,
        balanceDisplay: formatCurrencyMinor(accountSummary.balanceMinor),
        maskedAccountNumber: accountSummary.maskedAccountNumber,
        icon: accountSummary.iconName,
        tone: accountSummary.tone,
      })),
    [accountSummaries],
  );

  const budgetCards = useMemo<BudgetCategorySnapshot[]>(
    () =>
      budgetSummaries.map((budgetSummary) => ({
        id: budgetSummary.budgetId,
        label: budgetSummary.label,
        amountDisplay: formatCurrencyMinor(budgetSummary.spentMinor),
        progressPercent: budgetSummary.progressPercent,
        icon: budgetSummary.iconName,
        tone: budgetSummary.tone,
      })),
    [budgetSummaries],
  );

  const inboxTransactions = useMemo<InboxTransactionPreview[]>(
    () =>
      sortedApprovalQueue.map((queueItem) => ({
        id: queueItem.queueEntryId,
        merchantName: queueItem.title,
        categoryName: TRANSACTION_CATEGORY_LABELS[queueItem.category],
        categoryIcon: categoryIconMap[queueItem.category],
        transactionIcon: categoryIconMap[queueItem.category],
        tone: categoryToneMap[queueItem.category],
        amountDisplay: formatCurrencyMinor(queueItem.amountMinor),
      })),
    [sortedApprovalQueue],
  );

  const homeInboxTransactions = useMemo(
    () => inboxTransactions.slice(0, 3),
    [inboxTransactions],
  );

  const recentApprovedActivity = useMemo<ActivityFeedItem[]>(
    () =>
      sortedApprovedTransactions.slice(0, 4).map((transaction) => ({
        id: transaction.transactionId,
        title: transaction.title,
        subtitle: `${TRANSACTION_CATEGORY_LABELS[transaction.category]} | ${
          FINANCIAL_INSTITUTION_LABELS[transaction.financialInstitution]
        }`,
        amountDisplay: formatDirectionAmount(
          transaction.amountMinor,
          transaction.feeMinor,
          transaction.transactionDirection,
        ),
        icon: categoryIconMap[transaction.category],
        tone: categoryToneMap[transaction.category],
        metaLabel: formatShortDate(transaction.occurredAt),
      })),
    [sortedApprovedTransactions],
  );

  const accountActivity = useMemo<ActivityFeedItem[]>(
    () =>
      sortedApprovedTransactions.slice(0, 6).map((transaction) => ({
        id: `account-${transaction.transactionId}`,
        title: transaction.title,
        subtitle: `${
          FINANCIAL_INSTITUTION_LABELS[transaction.financialInstitution]
        } | ${maskAccountReference(transaction.accountReference)}`,
        amountDisplay: formatDirectionAmount(
          transaction.amountMinor,
          transaction.feeMinor,
          transaction.transactionDirection,
        ),
        icon: categoryIconMap[transaction.category],
        tone: institutionToneMap[transaction.financialInstitution],
        metaLabel: formatShortDate(transaction.occurredAt),
      })),
    [sortedApprovedTransactions],
  );

  const activeQueueItem = useMemo(
    () =>
      approvalQueue.find((queueItem) => queueItem.queueEntryId === activeQueueEntryId) ??
      null,
    [activeQueueEntryId, approvalQueue],
  );

  const sortedUnmatchedMessages = useMemo(
    () =>
      [...unmatchedMessages].sort(
        (left, right) =>
          new Date(right.capturedAt).getTime() -
          new Date(left.capturedAt).getTime(),
      ),
    [unmatchedMessages],
  );

  const unmatchedMessagePreviews = useMemo<UnmatchedSmsPreview[]>(
    () =>
      sortedUnmatchedMessages.map((message) => ({
        id: message.unmatchedEntryId,
        senderLabel: message.senderLabel,
        smsBody: message.smsBody,
        receivedAtLabel: formatShortDateTime(message.receivedAt),
        capturedAtLabel: formatShortDateTime(message.capturedAt),
      })),
    [sortedUnmatchedMessages],
  );

  const pendingValueMinor = useMemo(
    () =>
      approvalQueue.reduce(
        (total, queueItem) => total + queueItem.amountMinor + queueItem.feeMinor,
        0,
      ),
    [approvalQueue],
  );

  const approvedExpenseMinor = useMemo(
    () =>
      approvedTransactions.reduce((total, transaction) => {
        if (transaction.transactionDirection === "credit") {
          return total;
        }

        return total + transaction.amountMinor + transaction.feeMinor;
      }, 0),
    [approvedTransactions],
  );

  const approvedIncomeMinor = useMemo(
    () =>
      approvedTransactions.reduce((total, transaction) => {
        if (transaction.transactionDirection !== "credit") {
          return total;
        }

        return total + transaction.amountMinor;
      }, 0),
    [approvedTransactions],
  );

  const netFlowMinor = approvedIncomeMinor - approvedExpenseMinor;

  const topInstitution = useMemo(() => {
    if (accountSummaries.length === 0) {
      return null;
    }

    return [...accountSummaries].sort(
      (left, right) => right.balanceMinor - left.balanceMinor,
    )[0];
  }, [accountSummaries]);

  const pendingInstitutionsCount = useMemo(
    () => new Set(approvalQueue.map((item) => item.financialInstitution)).size,
    [approvalQueue],
  );

  const visibleChannelCount = useMemo(
    () =>
      Object.values(dashboardSnapshot.balanceByChannel).filter(
        (balanceMinor) => balanceMinor > 0,
      ).length,
    [dashboardSnapshot.balanceByChannel],
  );

  const previewSummary = useMemo(() => {
    if (!rawInput.trim()) {
      return "Preview is waiting for a pasted SMS message.";
    }

    if (previewResult.status !== "matched") {
      return `No parser template matched this ${debugSenderLabel} message yet.`;
    }

    return [
      `Matched ${
        FINANCIAL_INSTITUTION_LABELS[previewResult.draft.financialInstitution]
      }`,
      previewResult.draft.parserTemplateId,
      formatCurrencyMinor(previewResult.draft.amountMinor),
      TRANSACTION_CATEGORY_LABELS[previewResult.draft.category],
      previewResult.draft.title,
    ].join(" | ");
  }, [debugSenderLabel, previewResult, rawInput]);

  const topAppBarAction: TopAppBarAction = useMemo(
    () => ({
      icon: "settings",
      label: "Settings",
      onPress: () => setIsSettingsOpen(true),
    }),
    [],
  );

  const bottomNavigationItems = useMemo<BottomNavigationItem[]>(
    () =>
      (["home", "inbox", "insights", "cards"] as const).map((tabId) => ({
        id: tabId,
        label:
          tabId === "home"
            ? "Home"
            : tabId === "inbox"
              ? "Inbox"
              : tabId === "insights"
                ? "Insights"
                : "Cards",
        icon: tabIconMap[tabId],
        isActive: activeTab === tabId,
        onPress: () => activateTab(tabId),
      })),
    [activeTab],
  );

  function activateTab(tabId: MobileTab) {
    setActiveTab(tabId);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function handleQueueDebugSms() {
    const trimmedInput = rawInput.trim();
    if (!trimmedInput) {
      setDebugFeedback("Paste a raw SMS body before queueing a parser test.");
      return;
    }

    const result = parseAndQueue({
      address: debugSenderLabel,
      body: trimmedInput,
      timestamp_ms: Date.now(),
    });

    if (result.status === "unmatched_captured") {
      setIsSettingsOpen(false);
      setActiveTab("inbox");
      setDebugFeedback(
        "No parser template matched. Saved the raw SMS into Needs Parser Review.",
      );
      setRawInput("");
      return;
    }

    openTransactionEditor(result.queueEntryId);
    setIsSettingsOpen(false);
    setActiveTab("inbox");
    setDebugFeedback(
      "Queued the SMS in Inbox and opened the edit window for review.",
    );
    setRawInput("");
  }

  function handleClearLocalState() {
    clearAllData();
    closeTransactionEditor();
    setDebugFeedback(
      "Cleared the local browser state. Refresh now to verify the empty dashboard persists.",
    );
    setActiveTab("home");
  }

  function handleRestoreDemoData() {
    seedDemoData();
    setDebugFeedback("Restored the seeded demo data for the dashboard and inbox.");
  }

  function renderActiveTab() {
    switch (activeTab) {
      case "inbox":
        return (
          <InboxScreen
            inboxTransactions={inboxTransactions}
            onApproveTransaction={(transaction) => approveQueueItem(transaction.id)}
            onDismissUnmatchedMessage={(message) =>
              dismissUnmatchedSms(message.id)
            }
            onEditTransaction={(transaction) =>
              openTransactionEditor(transaction.id)
            }
            onOpenSettings={() => setIsSettingsOpen(true)}
            pendingCount={dashboardSnapshot.pendingApprovalCount}
            pendingInstitutionCount={pendingInstitutionsCount}
            pendingValueDisplay={formatCompactCurrencyMinor(pendingValueMinor)}
            recentApprovedActivity={recentApprovedActivity}
            unmatchedCount={unmatchedMessagePreviews.length}
            unmatchedMessages={unmatchedMessagePreviews}
          />
        );
      case "insights":
        return (
          <InsightsScreen
            budgetCards={budgetCards}
            incomeDisplay={formatCompactCurrencyMinor(approvedIncomeMinor)}
            netFlowDisplay={formatSignedCurrencyMinor(netFlowMinor)}
            outflowDisplay={formatCompactCurrencyMinor(approvedExpenseMinor)}
            recentApprovedActivity={recentApprovedActivity}
            totalBalanceDisplay={formatCompactCurrencyMinor(
              dashboardSnapshot.totalBalanceMinor,
            )}
          />
        );
      case "cards":
        return (
          <CardsScreen
            accountActivity={accountActivity}
            accountCards={accountCards}
            accountCount={accountSummaries.length}
            balanceBreakdownItems={balanceBreakdownItems}
            topBalanceDisplay={
              topInstitution
                ? formatCompactCurrencyMinor(topInstitution.balanceMinor)
                : "ETB 0"
            }
            topInstitutionHeadline={
              topInstitution
                ? `${topInstitution.institutionName} leads your balances`
                : "No account balances yet"
            }
            totalBalanceDisplay={formatCurrencyMinor(
              dashboardSnapshot.totalBalanceMinor,
            )}
            visibleChannelCount={visibleChannelCount}
          />
        );
      case "home":
      default:
        return (
          <HomeScreen
            accountCards={accountCards}
            balanceBreakdownItems={balanceBreakdownItems}
            budgetCards={budgetCards}
            inboxTransactions={homeInboxTransactions}
            onApproveTransaction={(transaction) => approveQueueItem(transaction.id)}
            onEditTransaction={(transaction) =>
              openTransactionEditor(transaction.id)
            }
            onOpenAccountView={() => activateTab("cards")}
            onOpenInbox={() => activateTab("inbox")}
            pendingCount={dashboardSnapshot.pendingApprovalCount}
            recentApprovedActivity={recentApprovedActivity}
            totalBalanceDisplay={formatCurrencyMinor(
              dashboardSnapshot.totalBalanceMinor,
            )}
          />
        );
    }
  }

  return (
    <div className="min-h-screen bg-background pb-24 text-on-background md:pb-0">
      <TopAppBar
        action={topAppBarAction}
        brandLabel="Track Wallet"
        profile={topAppBarProfile}
      />

      <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-6 md:px-8">
        <section className="hidden items-center justify-between rounded-[24px] bg-surface-container-low p-2 shadow-[0_4px_20px_rgba(46,50,48,0.06)] md:flex">
          <div className="flex flex-wrap gap-2">
            {bottomNavigationItems.map((item) => (
              <button
                className={
                  item.isActive
                    ? "flex min-h-11 items-center gap-2 rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-on-primary active:scale-95"
                    : "flex min-h-11 items-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold text-on-surface-variant active:scale-95"
                }
                key={`desktop-${item.id}`}
                onClick={item.onPress}
                type="button"
              >
                <MaterialSymbol
                  className="text-[20px]"
                  filled={item.isActive}
                  name={item.icon}
                />
                {item.label}
              </button>
            ))}
          </div>

          <div className="text-right">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-on-surface-variant">
              Active view
            </div>
            <div className="font-headline text-lg font-semibold text-on-surface">
              {bottomNavigationItems.find((item) => item.isActive)?.label ?? "Home"}
            </div>
          </div>
        </section>

        {renderActiveTab()}
      </main>

      <BottomNavBar items={bottomNavigationItems} />

      <SettingsSheet
        accountCount={accountSummaries.length}
        approvedCount={approvedTransactions.length}
        debugFeedback={debugFeedback}
        debugSenderLabel={debugSenderLabel}
        debugSenderOptions={debugSenderOptions}
        isOpen={isSettingsOpen}
        onClearLocalState={handleClearLocalState}
        onClose={() => setIsSettingsOpen(false)}
        onDebugSenderChange={setDebugSenderLabel}
        onQueueDebugSms={handleQueueDebugSms}
        onRawInputChange={setRawInput}
        onRestoreDemoData={handleRestoreDemoData}
        pendingCount={dashboardSnapshot.pendingApprovalCount}
        previewSummary={previewSummary}
        rawInput={rawInput}
        totalBalanceDisplay={formatCurrencyMinor(
          dashboardSnapshot.totalBalanceMinor,
        )}
        unmatchedCount={unmatchedMessages.length}
      />

      <EditTransactionModal
        categoryOptions={categoryOptions}
        isOpen={activeQueueItem !== null}
        messageTimestampLabel={
          activeQueueItem ? formatShortDateTime(activeQueueItem.occurredAt) : ""
        }
        noteValue={activeQueueItem?.note ?? ""}
        onApproveTransaction={() => {
          if (activeQueueItem) {
            approveQueueItem(activeQueueItem.queueEntryId);
          }
        }}
        onClose={closeTransactionEditor}
        onNoteChange={(value) => {
          if (activeQueueItem) {
            editApprovalQueueItem(activeQueueItem.queueEntryId, { note: value });
          }
        }}
        onSaveDraft={closeTransactionEditor}
        onSelectedCategoryChange={(value) => {
          if (activeQueueItem) {
            editApprovalQueueItem(activeQueueItem.queueEntryId, {
              category: value as TransactionCategory,
            });
          }
        }}
        onTransactionTitleChange={(value) => {
          if (activeQueueItem) {
            editApprovalQueueItem(activeQueueItem.queueEntryId, { title: value });
          }
        }}
        parsedAmountDisplay={
          activeQueueItem ? formatCurrencyMinor(activeQueueItem.amountMinor) : ""
        }
        selectedCategory={activeQueueItem?.category ?? "misc"}
        sourceAccountLabel={
          activeQueueItem ? maskAccountReference(activeQueueItem.accountReference) : ""
        }
        sourceInstitutionLabel={
          activeQueueItem
            ? FINANCIAL_INSTITUTION_LABELS[activeQueueItem.financialInstitution]
            : ""
        }
        transactionTitle={activeQueueItem?.title ?? ""}
      />
    </div>
  );
}
