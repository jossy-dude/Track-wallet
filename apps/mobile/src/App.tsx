import { useEffect, useMemo, useState } from "react";

import { Capacitor } from "@capacitor/core";
import {
  FINANCIAL_INSTITUTION_LABELS,
  TRANSACTION_CATEGORY_LABELS,
  type FinancialInstitution,
  type TransactionCategory,
  type TransactionDirection,
} from "@omni-sync/core";
import {
  buildDashboardSnapshot,
  configureTransactionStore,
  selectSmsCaptureRoutingSummary,
  useTransactionStore,
} from "@omni-sync/database";
import {
  BottomNavBar,
  EditTransactionModal,
  MaterialSymbol,
  TopAppBar,
  type AccountSummaryCardData,
  type BalanceBreakdownItem,
  type BudgetCategorySnapshot,
  type BottomNavigationItem,
  type InboxTransactionPreview,
  type TopAppBarAction,
  type TopAppBarProfile,
  type TransactionCategoryOption,
} from "@omni-sync/ui";

import { type ActivityFeedItem } from "./components/ActivityFeed";
import { BottomSheet } from "./components/BottomSheet";
import { CategoryCreateWindow } from "./components/CategoryCreateWindow";
import { type UnmatchedSmsPreview } from "./components/UnmatchedSmsPanel";
import {
  getAccountProfilePreferencesEvent,
  getAccountProfilePreferencesStorageKey,
  readAccountProfilePreferences,
} from "./preferences/accountPreferences";
import {
  getAccountOrderPreferenceEvent,
  clearFinanceLinkedDisplayPreferences,
  getBottomNavStylePreferenceEvent,
  getCurrencyLabelPreferenceEvent,
  getDefaultAccountPreferenceEvent,
  getHomeBalanceDetailPreferenceEvent,
  persistAccountOrderPreference,
  readAccountOrderPreference,
  readBottomNavStylePreference,
  readCurrencyLabelPreference,
  readDefaultAccountIdPreference,
  type BottomNavStylePreference,
  readHomeBalanceDetailMode,
  type CurrencyLabelPreference,
  type HomeBalanceDetailMode,
} from "./preferences/displayPreferences";
import {
  persistBudgetWorkspacePreferences,
  readBudgetWorkspacePreferences,
} from "./preferences/budgetPreferences";
import {
  getDemoModePreferenceEvent,
  persistSetupChecklistPending,
  persistShowcaseLocationReviewed,
  persistDemoModeEnabled,
  persistOnboardingCompleted,
  readDemoModeEnabled,
  readOnboardingCompleted,
  readSetupChecklistPending,
  readShowcaseLocationReviewed,
} from "./preferences/setupPreferences";
import { clearLocalFinanceWorkspace } from "./clearLocalFinanceWorkspace";
import { BudgetScreen, type BudgetCategoryPlan } from "./screens/BudgetScreen";
import { CardsScreen } from "./screens/CardsScreen";
import { HomeScreen } from "./screens/HomeScreen";
import { InboxScreen } from "./screens/InboxScreen";
import { IntroOnboardingScreen } from "./screens/IntroOnboardingScreen";
import { LedgerScreen } from "./screens/LedgerScreen";
import { SettingsDetailScreen } from "./screens/SettingsDetailScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { SetupChecklistScreen } from "./screens/SetupChecklistScreen";
import {
  getSettingsPageParent,
  getSettingsPageTitle,
  type SettingsPageId,
} from "./screens/settingsHubContent";
import {
  getPrivateWalletSetupContinueLabel,
  getPrivateWalletSetupState,
} from "./setupChecklist";
import { useSmsCaptureRuntime } from "./sms";

configureTransactionStore({
  runtime: Capacitor.isNativePlatform() ? "native_mobile" : "web",
});

type MobileTab = "home" | "inbox" | "ledger" | "accounts";
type OverlayRoute = "budget" | null;

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
  ledger: "receipt_long",
  accounts: "account_balance_wallet",
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
  return `${currencyFormatter.format(amountMinor / 100)} ETB`;
}

function formatSignedCurrencyMinor(amountMinor: number): string {
  const sign = amountMinor > 0 ? "+" : amountMinor < 0 ? "-" : "";
  return `${sign}${currencyFormatter.format(Math.abs(amountMinor) / 100)} ETB`;
}

function formatCompactCurrencyMinor(amountMinor: number): string {
  return `${compactCurrencyFormatter.format(amountMinor / 100)} ETB`;
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

function isSmsBackedQueueItem(queueItem: {
  parserTemplateId: string;
  senderLabel: string;
}): boolean {
  return (
    queueItem.parserTemplateId !== "manual-entry" &&
    queueItem.senderLabel !== "Manual Entry"
  );
}

function formatConfidenceLabel(confidence: number): string {
  return `${Math.round(confidence)}% confidence`;
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

function formatBudgetProgressPercent(spentMinor: number, limitMinor: number): number {
  if (limitMinor <= 0) {
    return 0;
  }

  return Math.round((spentMinor / limitMinor) * 100);
}

function clampProgressWidth(progressPercent: number | undefined, minimum = 12): number {
  const resolvedProgress = progressPercent ?? 0;
  if (resolvedProgress <= 0) {
    return 0;
  }

  return Math.max(minimum, Math.min(100, resolvedProgress));
}

export default function App() {
  const initialBudgetWorkspacePreferences = readBudgetWorkspacePreferences();
  const [activeTab, setActiveTab] = useState<MobileTab>("home");
  const [activeOverlayRoute, setActiveOverlayRoute] = useState<OverlayRoute>(null);
  const [isSettingsPageOpen, setIsSettingsPageOpen] = useState(false);
  const [activeSettingsPageId, setActiveSettingsPageId] =
    useState<SettingsPageId | null>(null);
  const [accountsFocusSection, setAccountsFocusSection] = useState<
    "bank" | "mobile_money" | "cash" | null
  >(null);
  const [homeBalanceDetailMode, setHomeBalanceDetailMode] =
    useState<HomeBalanceDetailMode>(() => readHomeBalanceDetailMode());
  const [defaultAccountId, setDefaultAccountId] = useState<string | null>(() =>
    readDefaultAccountIdPreference(),
  );
  const [accountOrder, setAccountOrder] = useState<string[]>(() =>
    readAccountOrderPreference(),
  );
  const [currencyLabel, setCurrencyLabel] = useState<CurrencyLabelPreference>(() =>
    readCurrencyLabelPreference(),
  );
  const [bottomNavStyle, setBottomNavStyle] =
    useState<BottomNavStylePreference>(() => readBottomNavStylePreference());
  const [demoModeEnabled, setDemoModeEnabled] = useState(() => readDemoModeEnabled());
  const [accountDisplayName, setAccountDisplayName] = useState(
    () => readAccountProfilePreferences().displayName,
  );
  const [isSetupChecklistPending, setIsSetupChecklistPending] = useState(() =>
    readSetupChecklistPending(),
  );
  const [hasReviewedShowcaseLocation, setHasReviewedShowcaseLocation] = useState(
    () => readShowcaseLocationReviewed(),
  );
  const [isBudgetQuickAddOpen, setIsBudgetQuickAddOpen] = useState(false);
  const [quickBudgetId, setQuickBudgetId] = useState("");
  const [quickBudgetLimitInput, setQuickBudgetLimitInput] = useState("");
  const [isOnboardingVisible, setIsOnboardingVisible] = useState(
    () => !readOnboardingCompleted(),
  );
  const [isDisableDemoDialogOpen, setIsDisableDemoDialogOpen] = useState(false);
  const [isEnableDemoDialogOpen, setIsEnableDemoDialogOpen] = useState(false);
  const [isAddBlockedDialogOpen, setIsAddBlockedDialogOpen] = useState(false);
  const [isCategoryWindowOpen, setIsCategoryWindowOpen] = useState(false);
  const [categoryWindowOrigin, setCategoryWindowOrigin] = useState("Setup");
  const [hasStartedRuntimeBootstrap, setHasStartedRuntimeBootstrap] = useState(false);
  const [hasBypassedBootstrapError, setHasBypassedBootstrapError] =
    useState(false);
  const [isManualEntryOpen, setIsManualEntryOpen] = useState(false);
  const [manualTitle, setManualTitle] = useState("");
  const [manualAmount, setManualAmount] = useState("");
  const [manualCategory, setManualCategory] = useState<TransactionCategory | "">("");
  const [manualDirection, setManualDirection] =
    useState<TransactionDirection>("debit");
  const [manualNote, setManualNote] = useState("");
  const [manualAccountId, setManualAccountId] = useState<string>("");
  const [visibleBudgetIds, setVisibleBudgetIds] = useState<readonly string[]>(
    () => initialBudgetWorkspacePreferences?.visibleBudgetIds ?? [],
  );
  const [hasInitializedBudgetVisibility, setHasInitializedBudgetVisibility] =
    useState(() => initialBudgetWorkspacePreferences !== null);
  const [budgetLimitOverrides, setBudgetLimitOverrides] = useState<
    Record<string, number>
  >(() => initialBudgetWorkspacePreferences?.limitOverrides ?? {});
  const hasInitialized = useTransactionStore((state) => state.hasInitialized);
  const hasHydrated = useTransactionStore((state) => state.hasHydrated);
  const approvalQueue = useTransactionStore((state) => state.approvalQueue);
  const approvedTransactions = useTransactionStore(
    (state) => state.approvedTransactions,
  );
  const unmatchedMessages = useTransactionStore((state) => state.unmatchedMessages);
  const accountSummaries = useTransactionStore((state) => state.accountSummaries);
  const customAccounts = useTransactionStore((state) => state.customAccounts);
  const budgetSummaries = useTransactionStore((state) => state.budgetSummaries);
  const smsCaptureSettings = useTransactionStore((state) => state.smsCaptureSettings);
  const activeQueueEntryId = useTransactionStore(
    (state) => state.activeQueueEntryId,
  );
  const activeApprovedTransactionId = useTransactionStore(
    (state) => state.activeApprovedTransactionId,
  );
  const seedDemoData = useTransactionStore((state) => state.seedDemoData);
  const openTransactionEditor = useTransactionStore(
    (state) => state.openTransactionEditor,
  );
  const openApprovedTransactionEditor = useTransactionStore(
    (state) => state.openApprovedTransactionEditor,
  );
  const closeTransactionEditor = useTransactionStore(
    (state) => state.closeTransactionEditor,
  );
  const editApprovalQueueItem = useTransactionStore(
    (state) => state.editApprovalQueueItem,
  );
  const editApprovedTransaction = useTransactionStore(
    (state) => state.editApprovedTransaction,
  );
  const approveQueueItem = useTransactionStore((state) => state.approveQueueItem);
  const rejectQueueItem = useTransactionStore((state) => state.rejectQueueItem);
  const queueParsedTransaction = useTransactionStore(
    (state) => state.queueParsedTransaction,
  );
  const dismissUnmatchedSms = useTransactionStore(
    (state) => state.dismissUnmatchedSms,
  );
  const smsCaptureRoutingSummary = useTransactionStore((state) =>
    selectSmsCaptureRoutingSummary(state),
  );
  const privateWalletSetupState = getPrivateWalletSetupState({
    hasAccount: customAccounts.length > 0 || accountSummaries.length > 0,
    routingSummary: smsCaptureRoutingSummary,
  });
  const {
    isSyncing: isSmsRuntimeSyncing,
    refreshRuntime,
    syncError: smsRuntimeSyncError,
  } = useSmsCaptureRuntime();
  const requiresInitialRuntimeSync = Capacitor.isNativePlatform();
  const isPrivateSetupBlocking =
    !demoModeEnabled &&
    (!privateWalletSetupState.allReady || isSetupChecklistPending);

  useEffect(() => {
    if (!hasHydrated) {
      setHasStartedRuntimeBootstrap(false);
      setHasBypassedBootstrapError(false);
      return;
    }

    if (!requiresInitialRuntimeSync || hasBypassedBootstrapError) {
      return;
    }

    if (isSmsRuntimeSyncing) {
      setHasStartedRuntimeBootstrap(true);
    }
  }, [
    hasBypassedBootstrapError,
    hasHydrated,
    isSmsRuntimeSyncing,
    requiresInitialRuntimeSync,
  ]);

  useEffect(() => {
    if (
      hasHydrated &&
      demoModeEnabled &&
      !hasInitialized &&
      approvalQueue.length === 0 &&
      approvedTransactions.length === 0
    ) {
      seedDemoData();
    }
  }, [
    demoModeEnabled,
    approvalQueue.length,
    approvedTransactions.length,
    hasHydrated,
    hasInitialized,
    seedDemoData,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const syncPreferencesFromStorage = () => {
      setHomeBalanceDetailMode(readHomeBalanceDetailMode());
      setDefaultAccountId(readDefaultAccountIdPreference());
      setAccountOrder(readAccountOrderPreference());
      setCurrencyLabel(readCurrencyLabelPreference());
      setBottomNavStyle(readBottomNavStylePreference());
      setDemoModeEnabled(readDemoModeEnabled());
      setAccountDisplayName(readAccountProfilePreferences().displayName);
    };

    const handleStorage = (event: StorageEvent) => {
      if (
        event.key === null ||
        event.key === "trackwallet.mobile.home-balance-detail-mode" ||
        event.key === "trackwallet.mobile.default-account-id" ||
        event.key === "trackwallet.mobile.account-order" ||
        event.key === "trackwallet.mobile.currency-label" ||
        event.key === "trackwallet.mobile.bottom-nav-style" ||
        event.key === "trackwallet.mobile.demo-mode-v1" ||
        event.key === getAccountProfilePreferencesStorageKey()
      ) {
        syncPreferencesFromStorage();
      }
    };

    const handlePreferenceEvent = () => {
      syncPreferencesFromStorage();
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener(
      getHomeBalanceDetailPreferenceEvent(),
      handlePreferenceEvent as EventListener,
    );
    window.addEventListener(
      getDefaultAccountPreferenceEvent(),
      handlePreferenceEvent as EventListener,
    );
    window.addEventListener(
      getAccountOrderPreferenceEvent(),
      handlePreferenceEvent as EventListener,
    );
    window.addEventListener(
      getCurrencyLabelPreferenceEvent(),
      handlePreferenceEvent as EventListener,
    );
    window.addEventListener(
      getBottomNavStylePreferenceEvent(),
      handlePreferenceEvent as EventListener,
    );
    window.addEventListener(
      getDemoModePreferenceEvent(),
      handlePreferenceEvent as EventListener,
    );
    window.addEventListener(
      getAccountProfilePreferencesEvent(),
      handlePreferenceEvent as EventListener,
    );

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(
        getHomeBalanceDetailPreferenceEvent(),
        handlePreferenceEvent as EventListener,
      );
      window.removeEventListener(
        getDefaultAccountPreferenceEvent(),
        handlePreferenceEvent as EventListener,
      );
      window.removeEventListener(
        getAccountOrderPreferenceEvent(),
        handlePreferenceEvent as EventListener,
      );
      window.removeEventListener(
        getCurrencyLabelPreferenceEvent(),
        handlePreferenceEvent as EventListener,
      );
      window.removeEventListener(
        getBottomNavStylePreferenceEvent(),
        handlePreferenceEvent as EventListener,
      );
      window.removeEventListener(
        getDemoModePreferenceEvent(),
        handlePreferenceEvent as EventListener,
      );
      window.removeEventListener(
        getAccountProfilePreferencesEvent(),
        handlePreferenceEvent as EventListener,
      );
    };
  }, []);

  const topAppBarProfile: TopAppBarProfile = useMemo(
    () => ({
      avatarAlt: `${accountDisplayName} workspace profile`,
      avatarFallbackLabel: accountDisplayName,
    }),
    [accountDisplayName],
  );

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

  const orderedAccountSummaries = useMemo(() => {
    if (accountOrder.length === 0) {
      return accountSummaries;
    }

    const rank = new Map(accountOrder.map((accountId, index) => [accountId, index]));
    return [...accountSummaries].sort((left, right) => {
      const leftRank = rank.get(left.accountId) ?? Number.MAX_SAFE_INTEGER;
      const rightRank = rank.get(right.accountId) ?? Number.MAX_SAFE_INTEGER;

      if (leftRank !== rightRank) {
        return leftRank - rightRank;
      }

      return left.institutionName.localeCompare(right.institutionName);
    });
  }, [accountOrder, accountSummaries]);

  const orderedAccountCards = useMemo(() => {
    const rank = new Map(
      orderedAccountSummaries.map((account, index) => [account.accountId, index]),
    );

    return [...accountCards].sort(
      (left, right) =>
        (rank.get(left.id) ?? Number.MAX_SAFE_INTEGER) -
        (rank.get(right.id) ?? Number.MAX_SAFE_INTEGER),
    );
  }, [accountCards, orderedAccountSummaries]);

  const managedBudgetPlans = useMemo<BudgetCategoryPlan[]>(
    () =>
      budgetSummaries.map((budgetSummary) => {
        const limitMinor =
          budgetLimitOverrides[budgetSummary.budgetId] ?? budgetSummary.limitMinor;

        return {
          budgetId: budgetSummary.budgetId,
          category: budgetSummary.category,
          label: budgetSummary.label,
          spentMinor: budgetSummary.spentMinor,
          limitMinor,
          progressPercent: formatBudgetProgressPercent(
            budgetSummary.spentMinor,
            limitMinor,
          ),
          iconName: budgetSummary.iconName,
          tone: budgetSummary.tone,
        };
      }),
    [budgetLimitOverrides, budgetSummaries],
  );

  const inboxTransactions = useMemo<InboxTransactionPreview[]>(
    () =>
      sortedApprovalQueue.map((queueItem) => {
        const smsBacked = isSmsBackedQueueItem(queueItem);

        return {
          id: queueItem.queueEntryId,
          merchantName: queueItem.title,
          categoryName: TRANSACTION_CATEGORY_LABELS[queueItem.category],
          categoryIcon: categoryIconMap[queueItem.category],
          transactionIcon: categoryIconMap[queueItem.category],
          tone: categoryToneMap[queueItem.category],
          amountDisplay: formatCurrencyMinor(queueItem.amountMinor),
          sourceSenderLabel: smsBacked ? queueItem.senderLabel : undefined,
          sourceAccountLabel: maskAccountReference(queueItem.accountReference),
          sourceInstitutionLabel:
            FINANCIAL_INSTITUTION_LABELS[queueItem.financialInstitution],
          sourceConfidenceLabel: smsBacked
            ? formatConfidenceLabel(queueItem.confidence)
            : undefined,
        };
      }),
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
        onIconPress: () => openApprovedTransactionEditor(transaction.transactionId),
      })),
    [openApprovedTransactionEditor, sortedApprovedTransactions],
  );

  const existingCategoryEntries = useMemo(
    () =>
      Object.entries(TRANSACTION_CATEGORY_LABELS).map(([value, label]) => ({
        id: value,
        label,
        icon: categoryIconMap[value as TransactionCategory],
      })),
    [],
  );

  useEffect(() => {
    if (managedBudgetPlans.length === 0 || hasInitializedBudgetVisibility) {
      return;
    }

    const seededBudgetIds = managedBudgetPlans
      .filter((plan) => plan.spentMinor > 0)
      .map((plan) => plan.budgetId);

    setVisibleBudgetIds(
      seededBudgetIds.length > 0
        ? seededBudgetIds
        : managedBudgetPlans.slice(0, 3).map((plan) => plan.budgetId),
    );
    setHasInitializedBudgetVisibility(true);
  }, [hasInitializedBudgetVisibility, managedBudgetPlans]);

  useEffect(() => {
    if (managedBudgetPlans.length === 0) {
      return;
    }

    const validBudgetIds = new Set(managedBudgetPlans.map((plan) => plan.budgetId));

    setVisibleBudgetIds((current) => current.filter((budgetId) => validBudgetIds.has(budgetId)));
  }, [managedBudgetPlans]);

  useEffect(() => {
    if (!hasInitializedBudgetVisibility) {
      return;
    }

    persistBudgetWorkspacePreferences({
      visibleBudgetIds,
      limitOverrides: budgetLimitOverrides,
    });
  }, [
    budgetLimitOverrides,
    hasInitializedBudgetVisibility,
    visibleBudgetIds,
  ]);

  const activeBudgetPlans = useMemo(
    () =>
      managedBudgetPlans.filter((plan) => visibleBudgetIds.includes(plan.budgetId)),
    [managedBudgetPlans, visibleBudgetIds],
  );

  const availableBudgetPlans = useMemo(
    () =>
      managedBudgetPlans.filter((plan) => !visibleBudgetIds.includes(plan.budgetId)),
    [managedBudgetPlans, visibleBudgetIds],
  );

  useEffect(() => {
    if (availableBudgetPlans.length === 0) {
      setQuickBudgetId("");
      return;
    }

    setQuickBudgetId((current) =>
      current && availableBudgetPlans.some((plan) => plan.budgetId === current)
        ? current
        : availableBudgetPlans[0]?.budgetId ?? "",
    );
  }, [availableBudgetPlans]);

  useEffect(() => {
    if (orderedAccountSummaries.length === 0) {
      setManualAccountId("");
      return;
    }

    setManualAccountId((current) =>
      current &&
      orderedAccountSummaries.some((account) => account.accountId === current)
        ? current
        : defaultAccountId &&
            orderedAccountSummaries.some(
              (account) => account.accountId === defaultAccountId,
            )
          ? defaultAccountId
          : orderedAccountSummaries[0]?.accountId ?? "",
    );
  }, [defaultAccountId, orderedAccountSummaries]);

  const homeBudgetCards = useMemo<BudgetCategorySnapshot[]>(
    () =>
      activeBudgetPlans.map((plan) => ({
        id: plan.budgetId,
        label: plan.label,
        amountDisplay: formatCurrencyMinor(plan.spentMinor),
        progressPercent: plan.progressPercent,
        icon: plan.iconName,
        tone: plan.tone,
      })),
    [activeBudgetPlans],
  );

  const activeQueueItem = useMemo(
    () =>
      approvalQueue.find((queueItem) => queueItem.queueEntryId === activeQueueEntryId) ??
      null,
    [activeQueueEntryId, approvalQueue],
  );
  const activeApprovedTransaction = useMemo(
    () =>
      approvedTransactions.find(
        (transaction) => transaction.transactionId === activeApprovedTransactionId,
      ) ?? null,
    [activeApprovedTransactionId, approvedTransactions],
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

  function scrollToTop() {
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function openSettingsPage() {
    setActiveOverlayRoute(null);
    setIsSettingsPageOpen(true);
    setActiveSettingsPageId(null);
    scrollToTop();
  }

  function closeSettingsPage() {
    setIsSettingsPageOpen(false);
    setActiveSettingsPageId(null);
    scrollToTop();
  }

  function returnToSettingsHub() {
    setActiveSettingsPageId(null);
    scrollToTop();
  }

  function openSettingsRoute(pageId: SettingsPageId) {
    setActiveOverlayRoute(null);
    setIsSettingsPageOpen(true);
    setActiveSettingsPageId(pageId);
    scrollToTop();
  }

  function openBudgetRoute() {
    setIsSettingsPageOpen(false);
    setActiveSettingsPageId(null);
    setActiveTab("home");
    setActiveOverlayRoute("budget");
    setIsBudgetQuickAddOpen(false);
    scrollToTop();
  }

  function closeOverlayRoute() {
    setActiveOverlayRoute(null);
    scrollToTop();
  }

  function createQuickBudgetCard() {
    const sourcePlan = availableBudgetPlans.find(
      (plan) => plan.budgetId === quickBudgetId,
    );

    if (!sourcePlan) {
      return;
    }

    const nextLimitMinor =
      quickBudgetLimitInput.trim().length > 0
        ? Math.round(Number(quickBudgetLimitInput || "0") * 100)
        : sourcePlan.limitMinor;

    if (nextLimitMinor <= 0) {
      return;
    }

    addBudgetToVisibleSet(sourcePlan.budgetId, nextLimitMinor);
    setQuickBudgetLimitInput("");
    setIsBudgetQuickAddOpen(false);
  }

  function resetManualEntry() {
    setManualTitle("");
    setManualAmount("");
    setManualCategory("");
    setManualDirection("debit");
    setManualNote("");
  }

  function completeOnboarding() {
    persistOnboardingCompleted();
    persistSetupChecklistPending(false);
    persistDemoModeEnabled(true);
    setIsOnboardingVisible(false);
    setIsSetupChecklistPending(false);
    setDemoModeEnabled(true);
  }

  async function confirmDisableDemoMode() {
    persistShowcaseLocationReviewed(true);
    persistSetupChecklistPending(true);
    persistDemoModeEnabled(false);
    setHasReviewedShowcaseLocation(true);
    setIsSetupChecklistPending(true);
    setDemoModeEnabled(false);
    setIsDisableDemoDialogOpen(false);
    setActiveTab("home");
    setActiveOverlayRoute(null);
    setIsSettingsPageOpen(false);
    setActiveSettingsPageId(null);
    await clearLocalFinanceWorkspace({ reopenSetupChecklist: true });
  }

  async function confirmEnableDemoMode() {
    persistSetupChecklistPending(false);
    setIsSetupChecklistPending(false);
    await clearLocalFinanceWorkspace({ reopenSetupChecklist: false });
    persistDemoModeEnabled(true);
    setDemoModeEnabled(true);
    setIsEnableDemoDialogOpen(false);
    setIsSettingsPageOpen(false);
    setActiveSettingsPageId(null);
    setActiveOverlayRoute(null);
    setActiveTab("home");
    seedDemoData();
    scrollToTop();
  }

  async function skipIntroAndDisableDemo() {
    persistOnboardingCompleted();
    persistShowcaseLocationReviewed(false);
    persistSetupChecklistPending(true);
    setIsOnboardingVisible(false);
    setHasReviewedShowcaseLocation(false);
    setIsSetupChecklistPending(true);
    persistDemoModeEnabled(false);
    setDemoModeEnabled(false);
    setActiveTab("home");
    setActiveOverlayRoute(null);
    setIsSettingsPageOpen(false);
    setActiveSettingsPageId(null);
    await clearLocalFinanceWorkspace({ reopenSetupChecklist: true });
  }

  function handleBlockedAddAction() {
    setIsAddBlockedDialogOpen(false);

    if (!privateWalletSetupState.accountReady) {
      openAccountsView();
      return;
    }

    openSettingsRoute("forwarding");
  }

  function submitManualEntry() {
    const amountMinor = Math.round(Number(manualAmount || "0") * 100);
    if (amountMinor <= 0 || manualCategory.length === 0) {
      return;
    }

    const selectedAccount =
      accountSummaries.find((account) => account.accountId === manualAccountId) ?? null;
    const referenceDigits = selectedAccount?.maskedAccountNumber.replace(/\D/g, "").slice(-4);
    const matchedInstitution =
      approvedTransactions.find(
        (transaction) =>
          transaction.accountChannel === selectedAccount?.channel &&
          transaction.accountReference?.slice(-4) === referenceDigits,
      )?.financialInstitution ?? "unknown";

    const draft = queueParsedTransaction({
      draftId: `manual-${Date.now()}`,
      rawMessageId: `manual-${Date.now()}`,
      senderLabel: "Manual Entry",
      rawBody: manualNote || "Manual entry",
      financialInstitution: matchedInstitution,
      transactionDirection: manualDirection,
      amountMinor,
      feeMinor: 0,
      runningBalanceMinor: selectedAccount?.balanceMinor ?? 0,
      currencyCode: "ETB",
      title: manualTitle.trim() || "Manual entry",
      merchantName: manualTitle.trim() || "Manual entry",
      category: manualCategory as TransactionCategory,
      parserTemplateId: "manual-entry",
      confidence: 100,
      occurredAt: new Date().toISOString(),
      accountReference: referenceDigits,
      accountChannel: selectedAccount?.channel ?? "cash",
      note: manualNote,
    });

    resetManualEntry();
    setIsManualEntryOpen(false);
    activateTab("inbox");
    openTransactionEditor(draft.queueEntryId);
  }

  const activeSettingsPageParent = useMemo(
    () =>
      activeSettingsPageId === null
        ? null
        : getSettingsPageParent(activeSettingsPageId),
    [activeSettingsPageId],
  );

  const activeSettingsTitle = useMemo(
    () =>
      activeSettingsPageId === null
        ? "Settings"
        : getSettingsPageTitle(activeSettingsPageId),
    [activeSettingsPageId],
  );

  const topAppBarTitle = useMemo(() => {
    if (isSettingsPageOpen) {
      return activeSettingsTitle;
    }

    if (activeOverlayRoute === "budget") {
      return "Budget";
    }

    return "Track Wallet";
  }, [activeOverlayRoute, activeSettingsTitle, isSettingsPageOpen]);

  const shouldShowBootstrapLoading =
    !hasHydrated ||
    (!hasBypassedBootstrapError &&
      requiresInitialRuntimeSync &&
      ((!hasStartedRuntimeBootstrap && smsRuntimeSyncError === null) ||
        isSmsRuntimeSyncing));

  const shouldShowBootstrapError =
    hasHydrated &&
    !hasBypassedBootstrapError &&
    requiresInitialRuntimeSync &&
    !isSmsRuntimeSyncing &&
    smsRuntimeSyncError !== null;

  const shouldShowSetupChecklist =
    isPrivateSetupBlocking &&
    !isSettingsPageOpen &&
    activeOverlayRoute === null &&
    activeTab !== "accounts";

  const setupContinueLabel = getPrivateWalletSetupContinueLabel(
    privateWalletSetupState,
  );
  const setupCaptureTitle = privateWalletSetupState.captureRequired
    ? "Enable SMS capture"
    : "Review SMS fallback";
  const setupCaptureDescription = privateWalletSetupState.captureRequired
    ? "Grant SMS capture, enable live routing, and add at least one trusted sender rule before expecting Inbox drafts on Android. Parser templates and preview remain in Parsing Engine."
    : "This build cannot arm live SMS capture here. Finish account setup first, review sender rules if you want, then continue into the wallet and use Add for manual review on this device or switch to a supported Android host for automatic capture.";
  const setupCaptureActionLabel = privateWalletSetupState.captureRequired
    ? "Open SMS capture"
    : "Review SMS options";
  const setupCaptureStatusLabel = privateWalletSetupState.captureRequired
    ? privateWalletSetupState.captureReady
      ? "Done"
      : "Needs setup"
    : "Optional here";
  const blockedAddActionLabel = !privateWalletSetupState.accountReady
    ? "Go to account setup"
    : "Open SMS capture";
  const blockedAddDescription = !privateWalletSetupState.accountReady
    ? "Create your first account before queueing manual entries or expecting Inbox drafts."
    : "Enable live SMS capture and at least one trusted sender rule before this alpha opens Add on native Android.";
  const showFirstUserInboxGuidance =
    !demoModeEnabled &&
    approvalQueue.length === 0 &&
    approvedTransactions.length === 0 &&
    unmatchedMessages.length === 0;
  const showFirstUserLedgerGuidance =
    !demoModeEnabled && approvedTransactions.length === 0;

  const topAppBarActions: TopAppBarAction[] = useMemo(
    () => {
      if (activeOverlayRoute !== null) {
        return [
          {
            icon: "arrow_back",
            label: "Back",
            onPress: closeOverlayRoute,
          },
        ];
      }

      const actions: TopAppBarAction[] = [];

      if (!isSettingsPageOpen && demoModeEnabled) {
        actions.push({
          icon: "science",
          label: "Showcase",
          onPress: () => setIsDisableDemoDialogOpen(true),
          variant: "pill",
        });
      }

      actions.push(
        isSettingsPageOpen
          ? {
            icon: "arrow_back",
            label: "Back",
            onPress:
              activeSettingsPageId === null
                ? closeSettingsPage
                : activeSettingsPageParent === null
                  ? returnToSettingsHub
                  : () => openSettingsRoute(activeSettingsPageParent),
          }
          : {
            icon: "settings",
            label: "Settings",
            onPress: openSettingsPage,
          },
      );

      return actions;
    },
    [
      activeOverlayRoute,
      activeSettingsPageId,
      activeSettingsPageParent,
      demoModeEnabled,
      isSettingsPageOpen,
    ],
  );

  const bottomNavigationItems = useMemo<BottomNavigationItem[]>(
    () => [
      {
        id: "home",
        label: "Home",
        icon: tabIconMap.home,
        isActive: activeTab === "home",
        onPress: () => activateTab("home"),
      },
      {
        id: "inbox",
        label: "Inbox",
        icon: tabIconMap.inbox,
        isActive: activeTab === "inbox",
        onPress: () => activateTab("inbox"),
      },
      {
        id: "quick-add",
        label: "Add",
        icon: "add",
        isActive: false,
        kind: "action",
        onPress: () => {
          if (isPrivateSetupBlocking) {
            setIsAddBlockedDialogOpen(true);
            return;
          }

          setIsManualEntryOpen(true);
        },
      },
      {
        id: "ledger",
        label: "Ledger",
        icon: tabIconMap.ledger,
        isActive: activeTab === "ledger",
        onPress: () => activateTab("ledger"),
      },
      {
        id: "accounts",
        label: "Accounts",
        icon: tabIconMap.accounts,
        isActive: activeTab === "accounts",
        onPress: () => activateTab("accounts"),
      },
    ],
    [activeTab, isPrivateSetupBlocking],
  );

  function activateTab(tabId: MobileTab) {
    setIsSettingsPageOpen(false);
    setActiveSettingsPageId(null);
    setActiveOverlayRoute(null);
    setAccountsFocusSection(null);
    setActiveTab(
      isPrivateSetupBlocking && tabId !== "accounts" ? "home" : tabId,
    );
    scrollToTop();
  }

  function openAccountsView(
    focusSection: "bank" | "mobile_money" | "cash" | null = null,
  ) {
    setIsSettingsPageOpen(false);
    setActiveSettingsPageId(null);
    setActiveOverlayRoute(null);
    setAccountsFocusSection(focusSection);
    setActiveTab("accounts");
    scrollToTop();
  }

  function addBudgetToVisibleSet(budgetId: string, limitMinor: number) {
    setBudgetLimitOverrides((current) => ({
      ...current,
      [budgetId]: limitMinor,
    }));
    setVisibleBudgetIds((current) =>
      current.includes(budgetId) ? current : [...current, budgetId],
    );
  }

  function updateBudgetLimit(budgetId: string, limitMinor: number) {
    setBudgetLimitOverrides((current) => ({
      ...current,
      [budgetId]: limitMinor,
    }));
  }

  function removeBudgetFromVisibleSet(budgetId: string) {
    setVisibleBudgetIds((current) => current.filter((id) => id !== budgetId));
  }

  function handleSetupChecklistContinue() {
    if (!privateWalletSetupState.accountReady) {
      openAccountsView();
      return;
    }

    if (
      privateWalletSetupState.captureRequired &&
      !privateWalletSetupState.captureReady
    ) {
      openSettingsRoute("forwarding");
      return;
    }

    persistSetupChecklistPending(false);
    setIsSetupChecklistPending(false);
    scrollToTop();
  }

  function handleOpenSetupAccounts() {
    openAccountsView();
  }

  function handleOpenSetupSmsCapture() {
    openSettingsRoute("forwarding");
  }

  function handleRetryRuntimeBootstrap() {
    setHasBypassedBootstrapError(false);
    void refreshRuntime().catch(() => undefined);
  }

  function renderActiveTab() {
    if (shouldShowSetupChecklist) {
      return (
        <SetupChecklistScreen
          accountReady={privateWalletSetupState.accountReady}
          captureActionLabel={setupCaptureActionLabel}
          captureDescription={setupCaptureDescription}
          captureReady={privateWalletSetupState.captureReady}
          captureStatusLabel={setupCaptureStatusLabel}
          captureTitle={setupCaptureTitle}
          continueLabel={setupContinueLabel}
          onContinue={handleSetupChecklistContinue}
          onOpenAccounts={handleOpenSetupAccounts}
          onOpenSmsCapture={handleOpenSetupSmsCapture}
        />
      );
    }

    if (isSettingsPageOpen) {
      if (activeSettingsPageId !== null) {
        return (
          <SettingsDetailScreen
            demoModeEnabled={demoModeEnabled}
            onRequestEnableDemoMode={() => setIsEnableDemoDialogOpen(true)}
            onOpenPage={openSettingsRoute}
            onOpenTab={activateTab}
            pageId={activeSettingsPageId}
            orderedAccountIds={orderedAccountSummaries.map(
              (account) => account.accountId,
            )}
            />
        );
      }

      return (
        <SettingsScreen
          onOpenManageAccount={() => openSettingsRoute("account")}
          onOpenPage={openSettingsRoute}
        />
      );
    }

    if (activeOverlayRoute === "budget") {
      return (
        <BudgetScreen
          activeBudgets={activeBudgetPlans}
          availableBudgets={availableBudgetPlans}
          onAddBudget={addBudgetToVisibleSet}
          onRemoveBudget={removeBudgetFromVisibleSet}
          onUpdateBudgetLimit={updateBudgetLimit}
        />
      );
    }

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
            onRejectTransaction={(transaction) => rejectQueueItem(transaction.id)}
            onOpenSettings={openSettingsPage}
            pendingCount={dashboardSnapshot.pendingApprovalCount}
            pendingInstitutionCount={pendingInstitutionsCount}
            pendingValueDisplay={formatCompactCurrencyMinor(pendingValueMinor)}
            recentApprovedActivity={recentApprovedActivity}
            showFirstUseGuidance={showFirstUserInboxGuidance}
            unmatchedCount={unmatchedMessagePreviews.length}
            unmatchedMessages={unmatchedMessagePreviews}
          />
        );
      case "ledger":
        return (
          <LedgerScreen
            approvedTransactions={approvedTransactions}
            incomeDisplay={formatCompactCurrencyMinor(approvedIncomeMinor)}
            netFlowDisplay={formatSignedCurrencyMinor(netFlowMinor)}
            onEditApprovedTransaction={(transactionId) =>
              openApprovedTransactionEditor(transactionId)
            }
            outflowDisplay={formatCompactCurrencyMinor(approvedExpenseMinor)}
            showFirstUseGuidance={showFirstUserLedgerGuidance}
            totalBalanceDisplay={formatCompactCurrencyMinor(
              dashboardSnapshot.totalBalanceMinor,
            )}
          />
        );
      case "accounts":
        return (
          <CardsScreen
            accountCards={orderedAccountCards}
            accountCount={accountSummaries.length}
            accountSummaries={orderedAccountSummaries}
            approvedTransactions={approvedTransactions}
            balanceBreakdownItems={balanceBreakdownItems}
            currencyLabel={currencyLabel}
            defaultAccountId={defaultAccountId}
            onEditApprovedTransaction={(transactionId) =>
              openApprovedTransactionEditor(transactionId)
            }
            onOpenCategoryWindow={() => {
              setCategoryWindowOrigin("Accounts");
              setIsCategoryWindowOpen(true);
            }}
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
            focusSection={accountsFocusSection}
          />
        );
      case "home":
      default:
        return (
          <HomeScreen
            accountCards={orderedAccountCards}
            accountSummaries={orderedAccountSummaries}
            balanceBreakdownItems={balanceBreakdownItems}
            budgetCards={homeBudgetCards}
            currencyLabel={currencyLabel}
            defaultAccountId={defaultAccountId}
            detailedTotalBalanceEnabled={homeBalanceDetailMode === "detailed"}
            inboxTransactions={homeInboxTransactions}
            onApproveTransaction={(transaction) => approveQueueItem(transaction.id)}
            onEditApprovedTransaction={(transactionId) =>
              openApprovedTransactionEditor(transactionId)
            }
            onAddBudgetCategory={() => setIsBudgetQuickAddOpen(true)}
            onEditTransaction={(transaction) =>
              openTransactionEditor(transaction.id)
            }
            onRejectTransaction={(transaction) => rejectQueueItem(transaction.id)}
            onOpenAccountView={openAccountsView}
            onOpenBudget={openBudgetRoute}
            onOpenInbox={() => activateTab("inbox")}
            pendingCount={dashboardSnapshot.pendingApprovalCount}
            recentApprovedActivity={recentApprovedActivity}
            totalBalanceMinor={dashboardSnapshot.totalBalanceMinor}
          />
        );
    }
  }

  const manualBudgetSummary =
    manualCategory.length === 0
      ? null
      : budgetSummaries.find((budget) => budget.category === manualCategory) ?? null;
  const manualSelectedAccount =
    orderedAccountSummaries.find((account) => account.accountId === manualAccountId) ??
    null;
  const selectedQuickBudgetPlan =
    availableBudgetPlans.find((plan) => plan.budgetId === quickBudgetId) ?? null;
  const manualBudgetLimitDisplay = manualBudgetSummary
    ? formatCurrencyMinor(manualBudgetSummary.limitMinor)
    : null;
  const manualBudgetRemainingDisplay = manualBudgetSummary
    ? formatSignedCurrencyMinor(
        Math.max(0, manualBudgetSummary.limitMinor - manualBudgetSummary.spentMinor),
      )
    : null;
  const activeQueueBudgetSummary =
    activeQueueItem === null
      ? null
      : budgetSummaries.find((budget) => budget.category === activeQueueItem.category) ??
        null;
  const activeApprovedBudgetSummary =
    activeApprovedTransaction === null
      ? null
      : budgetSummaries.find(
          (budget) => budget.category === activeApprovedTransaction.category,
        ) ?? null;
  const activeQueueCategoryLabel =
    activeQueueItem === null
      ? undefined
      : TRANSACTION_CATEGORY_LABELS[activeQueueItem.category];
  const activeApprovedCategoryLabel =
    activeApprovedTransaction === null
      ? undefined
      : TRANSACTION_CATEGORY_LABELS[activeApprovedTransaction.category];

  if (shouldShowBootstrapLoading) {
    return (
      <div className="min-h-screen bg-background px-4 py-6 text-on-background">
        <main className="mx-auto flex min-h-[70vh] max-w-md items-center">
          <section className="w-full rounded-[32px] border border-outline-variant/18 bg-[linear-gradient(145deg,rgba(248,244,237,0.98),rgba(240,235,226,0.96))] p-6 shadow-[0_10px_32px_rgba(46,50,48,0.08)]">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary-container/55 text-primary">
              <MaterialSymbol className="text-[22px]" filled name="sync" />
            </div>
            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-on-surface-variant">
              Bootstrap
            </p>
            <h1 className="mt-2 font-headline text-3xl font-semibold text-on-surface">
              Loading your wallet
            </h1>
            <p className="mt-3 text-sm leading-6 text-on-surface-variant">
              Syncing local data and SMS runtime before the first screen opens.
            </p>
          </section>
        </main>
      </div>
    );
  }

  if (shouldShowBootstrapError) {
    return (
      <div className="min-h-screen bg-background px-4 py-6 text-on-background">
        <main className="mx-auto flex min-h-[70vh] max-w-md items-center">
          <section className="w-full rounded-[32px] border border-tertiary/18 bg-[linear-gradient(145deg,rgba(248,244,237,0.98),rgba(240,235,226,0.96))] p-6 shadow-[0_10px_32px_rgba(46,50,48,0.08)]">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-tertiary-container/55 text-on-tertiary-container">
              <MaterialSymbol className="text-[22px]" filled name="warning" />
            </div>
            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-on-surface-variant">
              Bootstrap
            </p>
            <h1 className="mt-2 font-headline text-3xl font-semibold text-on-surface">
              SMS runtime needs attention
            </h1>
            <p className="mt-3 text-sm leading-6 text-on-surface-variant">
              {smsRuntimeSyncError}
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                className="rounded-[22px] bg-primary px-5 py-3 text-sm font-semibold text-on-primary"
                onClick={handleRetryRuntimeBootstrap}
                type="button"
              >
                Retry runtime sync
              </button>
              <button
                className="rounded-[22px] bg-surface px-5 py-3 text-sm font-semibold text-on-surface"
                onClick={() => setHasBypassedBootstrapError(true)}
                type="button"
              >
                Open app anyway
              </button>
            </div>
          </section>
        </main>
      </div>
    );
  }

  if (isOnboardingVisible) {
    return (
      <div className="min-h-screen bg-background px-4 py-6 text-on-background">
        <main className="mx-auto max-w-md">
          <IntroOnboardingScreen
            onComplete={completeOnboarding}
            onOpenCategoryWindow={() => {
              setCategoryWindowOrigin("Setup");
              setIsCategoryWindowOpen(true);
            }}
            onSkip={skipIntroAndDisableDemo}
          />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24 text-on-background md:pb-0">
      <TopAppBar
        actions={topAppBarActions}
        brandLabel={topAppBarTitle}
        profile={topAppBarProfile}
      />

      <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-6 md:px-8">
        {!isSettingsPageOpen && activeOverlayRoute === null ? (
          <section className="hidden items-center justify-between rounded-[24px] bg-surface-container-low p-2 shadow-[0_4px_20px_rgba(46,50,48,0.06)] md:flex">
            <div className="flex flex-wrap gap-2">
              {bottomNavigationItems
                .filter((item) => item.kind !== "action")
                .map((item) => (
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
        ) : null}

        {renderActiveTab()}
      </main>

      {!isSettingsPageOpen && activeOverlayRoute === null ? (
        <BottomNavBar
          items={bottomNavigationItems}
          styleVariant={bottomNavStyle}
        />
      ) : null}

      <BottomSheet
        isOpen={isDisableDemoDialogOpen}
        onClose={() => setIsDisableDemoDialogOpen(false)}
        subtitle="Clear the sample data and return to your private empty wallet on this phone."
        title="Leave showcase mode?"
      >
        <div className="space-y-4">
          <p className="text-sm leading-6 text-on-surface-variant">
            This removes the sample accounts, balances, transactions, and budget
            surfaces from this device. Parser templates and appearance settings
            stay in place, while finance-linked layout choices and SMS runtime
            cache are reset when this build can reach them.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button
              className="rounded-2xl border border-outline-variant/24 bg-surface px-4 py-3 text-sm font-semibold text-on-surface"
              onClick={() => setIsDisableDemoDialogOpen(false)}
              type="button"
            >
              Stay in showcase
            </button>
            <button
              className="rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-on-primary"
              onClick={confirmDisableDemoMode}
              type="button"
            >
              Use private wallet
            </button>
          </div>
        </div>
      </BottomSheet>

      <BottomSheet
        isOpen={isEnableDemoDialogOpen}
        onClose={() => setIsEnableDemoDialogOpen(false)}
        subtitle="Replace the current local finance view with the showcase sample data on this phone."
        title="Load showcase mode again?"
      >
        <div className="space-y-4">
          <p className="text-sm leading-6 text-on-surface-variant">
            This clears the current local finance state, then reloads the sample
            accounts, balances, transactions, and budget surfaces used for the
            alpha walkthrough.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button
              className="rounded-2xl border border-outline-variant/24 bg-surface px-4 py-3 text-sm font-semibold text-on-surface"
              onClick={() => setIsEnableDemoDialogOpen(false)}
              type="button"
            >
              Cancel
            </button>
            <button
              className="rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-on-primary"
              onClick={confirmEnableDemoMode}
              type="button"
            >
              Load showcase now
            </button>
          </div>
        </div>
      </BottomSheet>

      <BottomSheet
        isOpen={isAddBlockedDialogOpen}
        onClose={() => setIsAddBlockedDialogOpen(false)}
        subtitle="Finish the next private setup step before this alpha opens manual intake."
        title="Add is locked for this wallet"
      >
        <div className="space-y-4">
          <p className="text-sm leading-6 text-on-surface-variant">
            {blockedAddDescription}
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button
              className="rounded-2xl border border-outline-variant/24 bg-surface px-4 py-3 text-sm font-semibold text-on-surface"
              onClick={() => setIsAddBlockedDialogOpen(false)}
              type="button"
            >
              Stay here
            </button>
            <button
              className="rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-on-primary"
              onClick={handleBlockedAddAction}
              type="button"
            >
              {blockedAddActionLabel}
            </button>
          </div>
        </div>
      </BottomSheet>

      <BottomSheet
        isOpen={isBudgetQuickAddOpen}
        onClose={() => setIsBudgetQuickAddOpen(false)}
        subtitle="Pin a category to Home."
        title="Budget cards"
      >
        <div className="space-y-4">
          {availableBudgetPlans.length > 0 ? (
            <>
              {selectedQuickBudgetPlan ? (
                <section className="rounded-[24px] border border-outline-variant/18 bg-surface-container-low p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-on-surface-variant">
                        Home preview
                      </p>
                      <p className="mt-1 font-headline text-xl font-semibold text-on-surface">
                        {selectedQuickBudgetPlan.label}
                      </p>
                    </div>
                    <div className="rounded-full bg-surface px-3 py-1 text-xs font-semibold text-on-surface">
                      {selectedQuickBudgetPlan.progressPercent}%
                    </div>
                  </div>
                  <div className="mt-3 h-2 rounded-full bg-outline-variant/20">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{
                        width: `${clampProgressWidth(selectedQuickBudgetPlan.progressPercent, 10)}%`,
                      }}
                    />
                  </div>
                  <div className="mt-3 flex items-center justify-between text-sm text-on-surface-variant">
                    <span>{formatCurrencyMinor(selectedQuickBudgetPlan.spentMinor)} used</span>
                    <span>{formatCurrencyMinor(selectedQuickBudgetPlan.limitMinor)} cap</span>
                  </div>
                </section>
              ) : null}
              <div className="rounded-[24px] border border-outline-variant/18 bg-surface-container-low p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-on-surface-variant">
                  Category
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {availableBudgetPlans.map((plan) => {
                    const isSelected = plan.budgetId === quickBudgetId;
                    return (
                      <button
                        className={`rounded-2xl px-3 py-2 text-xs font-semibold transition active:scale-[0.97] ${
                          isSelected
                            ? "bg-primary text-on-primary"
                            : "bg-surface text-on-surface-variant"
                        }`}
                        key={plan.budgetId}
                        onClick={() => setQuickBudgetId(plan.budgetId)}
                        type="button"
                      >
                        {plan.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="rounded-[24px] border border-outline-variant/18 bg-surface-container-low p-4">
                <label className="block">
                  <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-on-surface-variant">
                    Limit
                  </span>
                  <div className="flex items-center gap-3 rounded-[20px] bg-surface px-4 py-3">
                    <span className="translate-y-[2px] text-[11px] font-semibold uppercase tracking-[0.16em] text-on-surface-variant">
                      {currencyLabel}
                    </span>
                    <input
                      className="w-full bg-transparent font-headline text-2xl font-semibold text-on-surface outline-none"
                      onChange={(event) => setQuickBudgetLimitInput(event.target.value)}
                      placeholder="0"
                      type="number"
                      value={quickBudgetLimitInput}
                    />
                  </div>
                </label>
              </div>
              <div className="flex justify-end">
                <button
                  className="rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-on-primary"
                  onClick={createQuickBudgetCard}
                  type="button"
                >
                  Add to Home
                </button>
              </div>
            </>
          ) : (
            <div className="rounded-2xl border border-dashed border-outline-variant/24 bg-surface-container-low p-4 text-sm text-on-surface-variant">
              Every tracked category is already visible on Home.
            </div>
          )}
        </div>
      </BottomSheet>

      <BottomSheet
        className="border-none bg-background text-on-background"
        isOpen={isManualEntryOpen}
        maxHeightClassName="max-h-[82vh]"
        onClose={() => setIsManualEntryOpen(false)}
        subtitle="Quick local-first entry"
        title="Add transaction"
      >
        <div className="space-y-5">
          <section className="rounded-[28px] border border-outline-variant/18 bg-[linear-gradient(180deg,rgba(248,244,237,0.98),rgba(240,235,226,0.98))] p-5 text-on-surface shadow-[0_8px_24px_rgba(46,50,48,0.08)]">
            <div className="flex items-start justify-between gap-3">
              <button
                className="flex h-10 w-10 items-center justify-center rounded-full bg-surface text-on-surface"
                onClick={() => setIsManualEntryOpen(false)}
                type="button"
              >
                <MaterialSymbol name="arrow_back" />
              </button>
              <div className="flex items-center gap-2">
                <button
                  className="rounded-full bg-surface px-3 py-2 text-xs font-semibold text-primary"
                  onClick={openBudgetRoute}
                  type="button"
                >
                  Budget
                </button>
                <button
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-on-primary"
                  onClick={submitManualEntry}
                  type="button"
                >
                  <MaterialSymbol name="north_east" />
                </button>
              </div>
            </div>
            <div className="mt-6 flex items-end justify-between gap-3">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-on-surface-variant">
                  {manualBudgetSummary?.label ?? "Choose a category"}
                </p>
                <p className="mt-1 font-headline text-5xl font-semibold text-on-surface">
                  {manualBudgetSummary ? `${manualBudgetSummary.progressPercent}%` : "--"}
                </p>
              </div>
              <p className="text-right text-sm font-semibold text-on-surface-variant">
                {manualBudgetSummary
                  ? `${formatCompactCurrencyMinor(manualBudgetSummary.spentMinor)} used`
                  : "No budget selected"}
              </p>
            </div>
            <div className="mt-4 h-8 rounded-[18px] bg-surface p-1">
              <div
                className="h-full rounded-[14px] bg-primary"
                style={{
                  width: `${manualBudgetSummary ? clampProgressWidth(manualBudgetSummary.progressPercent, 12) : 0}%`,
                }}
              />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-[20px] bg-surface/80 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
                  Remaining
                </p>
                <p className="mt-1 text-sm font-semibold text-on-surface">
                  {manualBudgetRemainingDisplay ?? "--"}
                </p>
              </div>
              <div className="rounded-[20px] bg-surface/80 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
                  Budget cap
                </p>
                <p className="mt-1 text-sm font-semibold text-on-surface">
                  {manualBudgetLimitDisplay ?? "--"}
                </p>
              </div>
            </div>
          </section>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-on-surface">
                Title
              </span>
              <input
                className="w-full rounded-2xl border border-outline-variant/20 bg-surface px-4 py-3 text-on-surface"
                onChange={(event) => setManualTitle(event.target.value)}
                placeholder="Coffee shop"
                type="text"
                value={manualTitle}
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-on-surface">
                Amount
              </span>
              <input
                className="w-full rounded-2xl border border-outline-variant/20 bg-surface px-4 py-3 text-on-surface"
                onChange={(event) => setManualAmount(event.target.value)}
                placeholder="0"
                type="number"
                value={manualAmount}
              />
            </label>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-on-surface">Category</span>
              {manualBudgetSummary ? (
                <button
                  className="text-xs font-semibold uppercase tracking-[0.12em] text-primary"
                  onClick={openBudgetRoute}
                  type="button"
                >
                  Linked to {manualBudgetSummary.label}
                </button>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              {(Object.entries(TRANSACTION_CATEGORY_LABELS) as Array<
                [TransactionCategory, string]
              >).map(([value, label]) => (
                <button
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold transition active:scale-[0.97] ${
                    manualCategory === value
                      ? "border-primary bg-primary text-on-primary"
                      : "border-outline-variant/20 bg-surface text-on-surface"
                  }`}
                  key={value}
                  onClick={() => setManualCategory(value)}
                  type="button"
                >
                  <MaterialSymbol
                    className="text-[16px]"
                    filled={manualCategory === value}
                    name={categoryIconMap[value]}
                  />
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-on-surface">
                Direction
              </span>
              <select
                className="w-full rounded-2xl border border-outline-variant/20 bg-surface px-4 py-3 text-on-surface"
                onChange={(event) =>
                  setManualDirection(event.target.value as TransactionDirection)
                }
                value={manualDirection}
              >
                <option value="debit">Expense</option>
                <option value="credit">Income</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-on-surface">
                Account
              </span>
              <select
                className="w-full rounded-2xl border border-outline-variant/20 bg-surface px-4 py-3 text-on-surface"
                onChange={(event) => setManualAccountId(event.target.value)}
                value={manualAccountId}
              >
                {accountSummaries.map((account) => (
                  <option key={account.accountId} value={account.accountId}>
                    {account.institutionName}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-on-surface">
              Note
            </span>
            <textarea
              className="min-h-24 w-full rounded-2xl border border-outline-variant/20 bg-surface px-4 py-3 text-on-surface"
              onChange={(event) => setManualNote(event.target.value)}
              placeholder="Optional note"
              value={manualNote}
            />
          </label>

          <div className="flex justify-end">
            <button
              className="rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-on-primary disabled:cursor-not-allowed disabled:opacity-45"
              disabled={manualCategory.length === 0}
              onClick={submitManualEntry}
              type="button"
            >
              Queue for review
            </button>
          </div>
        </div>
      </BottomSheet>

      <EditTransactionModal
        categoryBudgetLabel={
          activeQueueItem
            ? activeQueueBudgetSummary
              ? `${activeQueueBudgetSummary.label} budget`
              : undefined
            : activeApprovedBudgetSummary
              ? `${activeApprovedBudgetSummary.label} budget`
              : undefined
        }
        categoryBudgetProgressPercent={
          activeQueueItem
            ? activeQueueBudgetSummary?.progressPercent
            : activeApprovedBudgetSummary?.progressPercent
        }
        categoryBudgetSpentDisplay={
          activeQueueItem
            ? activeQueueBudgetSummary
              ? `${formatCompactCurrencyMinor(activeQueueBudgetSummary.spentMinor)} used`
              : undefined
            : activeApprovedBudgetSummary
              ? `${formatCompactCurrencyMinor(activeApprovedBudgetSummary.spentMinor)} used`
              : undefined
        }
        categoryOptions={categoryOptions}
        contextLabel={activeQueueItem ? "Approval editor" : "Transaction editor"}
        isOpen={activeQueueItem !== null || activeApprovedTransaction !== null}
        messageTimestampLabel={
          activeQueueItem
            ? formatShortDateTime(activeQueueItem.occurredAt)
            : activeApprovedTransaction
              ? formatShortDateTime(activeApprovedTransaction.occurredAt)
              : ""
        }
        noteValue={activeQueueItem?.note ?? activeApprovedTransaction?.note ?? ""}
        onApproveTransaction={() => {
          if (activeQueueItem) {
            approveQueueItem(activeQueueItem.queueEntryId);
            return;
          }
          closeTransactionEditor();
        }}
        onClose={closeTransactionEditor}
        onNoteChange={(value) => {
          if (activeQueueItem) {
            editApprovalQueueItem(activeQueueItem.queueEntryId, { note: value });
            return;
          }
          if (activeApprovedTransaction) {
            editApprovedTransaction(activeApprovedTransaction.transactionId, {
              note: value,
            });
          }
        }}
        onRejectTransaction={
          activeQueueItem
            ? () => {
                rejectQueueItem(activeQueueItem.queueEntryId);
                closeTransactionEditor();
              }
            : undefined
        }
        onSaveDraft={closeTransactionEditor}
        primaryButtonLabel={
          activeQueueItem ? "Approve transaction" : "Close editor"
        }
        rejectButtonLabel="Reject"
        saveButtonLabel={activeQueueItem ? "Save draft" : "Save changes"}
        onSelectedCategoryChange={(value) => {
          if (activeQueueItem) {
            editApprovalQueueItem(activeQueueItem.queueEntryId, {
              category: value as TransactionCategory,
            });
            return;
          }
          if (activeApprovedTransaction) {
            editApprovedTransaction(activeApprovedTransaction.transactionId, {
              category: value as TransactionCategory,
            });
          }
        }}
        onTransactionTitleChange={(value) => {
          if (activeQueueItem) {
            editApprovalQueueItem(activeQueueItem.queueEntryId, { title: value });
            return;
          }
          if (activeApprovedTransaction) {
            editApprovedTransaction(activeApprovedTransaction.transactionId, {
              title: value,
            });
          }
        }}
        parsedAmountDisplay={
          activeQueueItem
            ? formatCurrencyMinor(activeQueueItem.amountMinor)
            : activeApprovedTransaction
              ? formatCurrencyMinor(activeApprovedTransaction.amountMinor)
              : ""
        }
        selectedCategory={activeQueueItem?.category ?? activeApprovedTransaction?.category ?? ""}
        selectedCategoryIcon={
          activeQueueItem
            ? categoryIconMap[activeQueueItem.category]
            : activeApprovedTransaction
              ? categoryIconMap[activeApprovedTransaction.category]
              : undefined
        }
        selectedCategoryLabel={
          activeQueueItem ? activeQueueCategoryLabel : activeApprovedCategoryLabel
        }
        sourceAccountLabel={
          activeQueueItem
            ? maskAccountReference(activeQueueItem.accountReference)
            : activeApprovedTransaction
              ? maskAccountReference(activeApprovedTransaction.accountReference)
              : ""
        }
        sourceInstitutionLabel={
          activeQueueItem
            ? FINANCIAL_INSTITUTION_LABELS[activeQueueItem.financialInstitution]
            : activeApprovedTransaction
              ? FINANCIAL_INSTITUTION_LABELS[activeApprovedTransaction.financialInstitution]
              : ""
        }
        sourceSenderLabel={
          activeQueueItem && isSmsBackedQueueItem(activeQueueItem)
            ? activeQueueItem.senderLabel
            : undefined
        }
        sourceConfidenceLabel={
          activeQueueItem && isSmsBackedQueueItem(activeQueueItem)
            ? formatConfidenceLabel(activeQueueItem.confidence)
            : undefined
        }
        sourceMessageBody={
          activeQueueItem && isSmsBackedQueueItem(activeQueueItem)
            ? activeQueueItem.rawBody
            : undefined
        }
        titleLabel={activeQueueItem ? "Confirm transaction" : "Edit approved transaction"}
        transactionTitle={activeQueueItem?.title ?? activeApprovedTransaction?.title ?? ""}
      />

      <CategoryCreateWindow
        existingCategories={existingCategoryEntries}
        isOpen={isCategoryWindowOpen}
        onClose={() => setIsCategoryWindowOpen(false)}
        originLabel={categoryWindowOrigin}
      />
    </div>
  );
}
