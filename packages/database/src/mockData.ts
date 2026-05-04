import type {
  AccountSummary,
  ApprovalQueueItem,
  ApprovedTransaction,
  BudgetSummary,
  ParsedTransactionDraft,
  NearbySyncDevice,
  PairingCodeState,
  SyncActivityEntry,
  TrustedSyncDevice,
} from "@omni-sync/core";

const BUDGET_LIMITS: Record<BudgetSummary["category"], number> = {
  housing: 171400,
  food: 112500,
  transport: 72000,
  income: 1,
  entertainment: 60000,
  misc: 50000,
};

const BUDGET_METADATA: Record<
  BudgetSummary["category"],
  Pick<BudgetSummary, "label" | "iconName" | "tone">
> = {
  housing: {
    label: "Housing",
    iconName: "home",
    tone: "primary",
  },
  food: {
    label: "Food",
    iconName: "restaurant",
    tone: "tertiary",
  },
  transport: {
    label: "Transport",
    iconName: "directions_car",
    tone: "secondary",
  },
  income: {
    label: "Income",
    iconName: "payments",
    tone: "primary",
  },
  entertainment: {
    label: "Entertainment",
    iconName: "theater_comedy",
    tone: "secondary",
  },
  misc: {
    label: "Misc",
    iconName: "category",
    tone: "tertiary",
  },
};

function createApprovalQueueItem(
  draft: ParsedTransactionDraft,
  queuedAt: string,
): ApprovalQueueItem {
  return {
    ...draft,
    queueEntryId: `queue-${draft.draftId}`,
    queuedAt,
    approvalStatus: "pending_approval",
    note: draft.note ?? "",
  };
}

function createApprovedTransaction(
  draft: ParsedTransactionDraft,
  approvedAt: string,
): ApprovedTransaction {
  return {
    ...draft,
    transactionId: `tx-${draft.draftId}`,
    approvedAt,
    approvalStatus: "approved",
    note: draft.note ?? "",
  };
}

export const demoAccountSummaries: AccountSummary[] = [
  {
    accountId: "acct-cbe-2401",
    institutionName: "CBE",
    maskedAccountNumber: "**** 2401",
    fullAccountNumber: "0000 0000 2401",
    balanceMinor: 640000,
    currencyCode: "ETB",
    channel: "bank",
    iconName: "account_balance",
    tone: "primary",
  },
  {
    accountId: "acct-dashen-8805",
    institutionName: "Dashen Bank",
    maskedAccountNumber: "**** 8805",
    fullAccountNumber: "0000 0000 8805",
    balanceMinor: 285000,
    currencyCode: "ETB",
    channel: "bank",
    iconName: "diamond",
    tone: "tertiary",
  },
  {
    accountId: "acct-telebirr-0042",
    institutionName: "Telebirr",
    maskedAccountNumber: "**** 0042",
    fullAccountNumber: "0900 0000 0042",
    balanceMinor: 96000,
    currencyCode: "ETB",
    channel: "mobile_money",
    iconName: "phone_iphone",
    tone: "secondary",
  },
  {
    accountId: "acct-cash-0001",
    institutionName: "Cash Wallet",
    maskedAccountNumber: "Pocket cash",
    balanceMinor: 18000,
    currencyCode: "ETB",
    channel: "cash",
    iconName: "payments",
    tone: "surface",
  },
];

export const demoApprovalQueue: ApprovalQueueItem[] = [
  createApprovalQueueItem(
    {
      draftId: "draft-demo-grocery-pending",
      rawMessageId: "demo-grocery-pending",
      senderLabel: "CBE",
      rawBody:
        "CBE ALERT: Your account 2401 was debited with ETB 450.00 on 2026-04-29 at GROCERY STORE. Bal ETB 6400.00",
      financialInstitution: "cbe",
      transactionDirection: "debit",
      amountMinor: 45000,
      feeMinor: 0,
      runningBalanceMinor: 640000,
      reportedBalanceMinor: 640000,
      currencyCode: "ETB",
      title: "Grocery Store",
      merchantName: "GROCERY STORE",
      category: "food",
      parserTemplateId: "cbe_debit_v1",
      confidence: 100,
      occurredAt: "2026-04-29T00:00:00.000Z",
      accountReference: "2401",
      accountChannel: "bank",
      note: "",
    },
    "2026-04-29T08:12:00.000Z",
  ),
  createApprovalQueueItem(
    {
      draftId: "draft-demo-fuel-pending",
      rawMessageId: "demo-fuel-pending",
      senderLabel: "Dashen",
      rawBody:
        "Dashen Alert: ETB 180.00 paid from Acct 8805 on 2026-04-28 to FUEL STATION. Bal ETB 2850.00",
      financialInstitution: "dashen",
      transactionDirection: "debit",
      amountMinor: 18000,
      feeMinor: 0,
      runningBalanceMinor: 285000,
      reportedBalanceMinor: 285000,
      currencyCode: "ETB",
      title: "Fuel Station",
      merchantName: "FUEL STATION",
      category: "transport",
      parserTemplateId: "dashen_debit_v1",
      confidence: 100,
      occurredAt: "2026-04-28T00:00:00.000Z",
      accountReference: "8805",
      accountChannel: "bank",
      note: "",
    },
    "2026-04-28T12:32:00.000Z",
  ),
  createApprovalQueueItem(
    {
      draftId: "draft-demo-streaming-pending",
      rawMessageId: "demo-streaming-pending",
      senderLabel: "Telebirr",
      rawBody:
        "Telebirr: you have paid ETB 120.00 to STREAMING SERVICE on 2026-04-27. current balance is ETB 960.00",
      financialInstitution: "telebirr",
      transactionDirection: "debit",
      amountMinor: 12000,
      feeMinor: 0,
      runningBalanceMinor: 96000,
      reportedBalanceMinor: 96000,
      currencyCode: "ETB",
      title: "Streaming Service",
      merchantName: "STREAMING SERVICE",
      category: "entertainment",
      parserTemplateId: "telebirr_manual_seed_v1",
      confidence: 94,
      occurredAt: "2026-04-27T00:00:00.000Z",
      accountReference: "0042",
      accountChannel: "mobile_money",
      note: "",
    },
    "2026-04-27T18:25:00.000Z",
  ),
];

export const demoApprovedTransactions: ApprovedTransaction[] = [
  createApprovedTransaction(
    {
      draftId: "draft-demo-rent-approved",
      rawMessageId: "demo-rent-approved",
      senderLabel: "Dashen",
      rawBody:
        "Dashen Alert: ETB 1200.00 paid from Acct 8805 on 2026-04-02 to RENT PAYMENT. Bal ETB 3010.00",
      financialInstitution: "dashen",
      transactionDirection: "debit",
      amountMinor: 120000,
      feeMinor: 0,
      runningBalanceMinor: 301000,
      reportedBalanceMinor: 301000,
      currencyCode: "ETB",
      title: "Rent Payment",
      merchantName: "RENT PAYMENT",
      category: "housing",
      parserTemplateId: "dashen_seed_housing_v1",
      confidence: 100,
      occurredAt: "2026-04-02T00:00:00.000Z",
      accountReference: "8805",
      accountChannel: "bank",
      note: "Monthly housing payment",
    },
    "2026-04-02T10:15:00.000Z",
  ),
  createApprovedTransaction(
    {
      draftId: "draft-demo-grocery-approved",
      rawMessageId: "demo-grocery-approved",
      senderLabel: "CBE",
      rawBody:
        "CBE ALERT: Your account 2401 was debited with ETB 450.00 on 2026-04-10 at GROCERY STORE. Bal ETB 6850.00",
      financialInstitution: "cbe",
      transactionDirection: "debit",
      amountMinor: 45000,
      feeMinor: 0,
      runningBalanceMinor: 685000,
      reportedBalanceMinor: 685000,
      currencyCode: "ETB",
      title: "Grocery Store",
      merchantName: "GROCERY STORE",
      category: "food",
      parserTemplateId: "cbe_seed_food_v1",
      confidence: 100,
      occurredAt: "2026-04-10T00:00:00.000Z",
      accountReference: "2401",
      accountChannel: "bank",
      note: "Weekly groceries",
    },
    "2026-04-10T07:30:00.000Z",
  ),
  createApprovedTransaction(
    {
      draftId: "draft-demo-fuel-approved",
      rawMessageId: "demo-fuel-approved",
      senderLabel: "Dashen",
      rawBody:
        "Dashen Alert: ETB 180.00 paid from Acct 8805 on 2026-04-14 to FUEL STATION. Bal ETB 3170.00",
      financialInstitution: "dashen",
      transactionDirection: "debit",
      amountMinor: 18000,
      feeMinor: 0,
      runningBalanceMinor: 317000,
      reportedBalanceMinor: 317000,
      currencyCode: "ETB",
      title: "Fuel Station",
      merchantName: "FUEL STATION",
      category: "transport",
      parserTemplateId: "dashen_seed_transport_v1",
      confidence: 100,
      occurredAt: "2026-04-14T00:00:00.000Z",
      accountReference: "8805",
      accountChannel: "bank",
      note: "Fuel top-up",
    },
    "2026-04-14T08:45:00.000Z",
  ),
];

export const demoNearbySyncDevices: NearbySyncDevice[] = [
  {
    deviceId: "nearby-desktop-authority",
    displayName: "Demo Desktop Authority",
    platform: "desktop",
    signalStrength: 92,
    statusLabel: "Ready for trusted pairing",
    discoveredAt: "2026-04-30T14:00:00.000Z",
    pairingCodeHint: "284913",
  },
  {
    deviceId: "nearby-surface-review",
    displayName: "Surface Review Station",
    platform: "desktop",
    signalStrength: 74,
    statusLabel: "Seen on local network",
    discoveredAt: "2026-04-30T14:03:00.000Z",
    pairingCodeHint: "551204",
  },
];

export const demoTrustedSyncDevices: TrustedSyncDevice[] = [
  {
    deviceId: "trusted-desktop-authority",
    displayName: "Demo Desktop Vault",
    platform: "desktop",
    connectedAt: "2026-04-29T20:00:00.000Z",
    lastSyncedAt: "2026-04-30T11:45:00.000Z",
    health: "healthy",
    isPrimary: true,
    autoSyncEnabled: true,
  },
];

export const demoSyncActivity: SyncActivityEntry[] = [
  {
    activityId: "sync-activity-001",
    type: "sync",
    status: "success",
    title: "Manual sync completed",
    detail: "Pushed 3 approved transactions to Demo Desktop Vault.",
    occurredAt: "2026-04-30T11:45:00.000Z",
  },
  {
    activityId: "sync-activity-002",
    type: "pairing",
    status: "success",
    title: "Desktop authority trusted",
    detail: "Demo Desktop Vault is now marked as the primary nearby target.",
    occurredAt: "2026-04-29T20:00:00.000Z",
  },
  {
    activityId: "sync-activity-003",
    type: "discovery",
    status: "pending",
    title: "Nearby scan active",
    detail: "Looking for trusted desktop listeners on the local network.",
    occurredAt: "2026-04-30T14:03:00.000Z",
  },
];

export const demoPairingCodeState: PairingCodeState = {
  generatedCode: "284913",
  expiresAt: "2026-04-30T14:20:00.000Z",
  pendingCodeInput: "",
  lastSubmittedCode: null,
  errorMessage: null,
};

export function buildBudgetSummaries(
  approvedTransactions: readonly ApprovedTransaction[],
): BudgetSummary[] {
  const trackedCategories: BudgetSummary["category"][] = [
    "housing",
    "food",
    "transport",
    "entertainment",
    "misc",
  ];
  const includesIncome = approvedTransactions.some(
    (transaction) => transaction.category === "income",
  );

  if (includesIncome) {
    trackedCategories.push("income");
  }

  return trackedCategories.map((category) => {
    const spentMinor = approvedTransactions
      .filter((transaction) => transaction.category === category)
      .reduce((total, transaction) => total + transaction.amountMinor, 0);
    const limitMinor = BUDGET_LIMITS[category];
    const progressPercent =
      limitMinor > 0
        ? Math.max(0, Math.min(100, Math.round((spentMinor / limitMinor) * 100)))
        : 0;

    return {
      budgetId: `budget-${category}`,
      category,
      label: BUDGET_METADATA[category].label,
      spentMinor,
      limitMinor,
      progressPercent,
      iconName: BUDGET_METADATA[category].iconName,
      tone: BUDGET_METADATA[category].tone,
    };
  });
}
