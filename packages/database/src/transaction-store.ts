import type {
  AccountSummary,
  AccountVisibilityOverride,
  AuthorityDataSnapshot,
  AuthorityRuntime,
  ApprovalQueueItem,
  ApprovedTransaction,
  BackupPackage,
  CapturedSmsEnvelope,
  CreateCustomAccountInput,
  CustomAccountRecord,
  DataExportPackage,
  DashboardSnapshot,
  FinancialInstitution,
  FinanceSnapshot,
  HistoricalImportDefaults,
  HistoricalImportDuplicateMode,
  HistoricalImportPackage,
  HistoricalImportPackageSummary,
  HistoricalImportMode,
  ManagedAccount,
  NearbySyncDevice,
  PairingCodeState,
  ParserMatchResult,
  ParserRuntimeOptions,
  ParserTemplateDefinition,
  ParserWorkspaceAuthorityState,
  ParsedTransactionDraft,
  RawSmsMessage,
  BudgetSummary,
  SmsCaptureBackfillRequest,
  SmsCaptureDiagnostics,
  SmsCaptureEnqueueOptions,
  SmsCaptureEnqueueResult,
  SmsCaptureProcessResult,
  SmsCaptureQueueItem,
  SmsCaptureQueueMergeResult,
  SmsCaptureQueueSummary,
  SmsCaptureRoutingSummary,
  SmsCaptureRuntimeSnapshot,
  SmsCaptureSettings,
  SmsSenderRule,
  SystemLogEntry,
  SystemLogMetric,
  SyncActivityEntry,
  SyncDiscoveryState,
  SyncMode,
  SyncStatusSummary,
  SecurityPreferences,
  TrustedSyncDevice,
  UnmatchedSmsEntry,
  UiTone,
  UpdateCustomAccountInput,
} from "@omni-sync/core";
import {
  buildBackupPackage,
  buildDataExportPackage,
  cloneAuthorityDataSnapshot,
  cloneDefaultParserTemplates,
  cloneFinanceSnapshot,
  cloneParserWorkspaceAuthorityState,
  FINANCIAL_INSTITUTION_LABELS,
  parseSmsMessage,
  sanitizeCreatedAt,
  summarizeHistoricalImportPackage,
} from "@omni-sync/core";
import {
  createJSONStorage,
  persist,
  type PersistStorage,
  type StateStorage,
} from "zustand/middleware";
import { useStore } from "zustand";
import { createStore, type StoreApi } from "zustand/vanilla";

import {
  buildBudgetSummaries,
  demoAccountSummaries,
  demoApprovalQueue,
  demoApprovedTransactions,
  demoNearbySyncDevices,
  demoPairingCodeState,
  demoSyncActivity,
  demoTrustedSyncDevices,
} from "./mockData";
import {
  createCustomAccountRecord,
  selectManagedAccounts,
  selectVisibleManagedAccounts,
  updateCustomAccountRecord,
  upsertAccountVisibilityOverride,
} from "./account-management";
import {
  buildSmsCaptureRoutingSummary,
  buildSmsCaptureQueueSummary,
  createDefaultSmsCaptureBackfillRequest,
  createCapturedSmsEnvelope,
  createDefaultSmsCaptureDiagnostics,
  createDefaultSmsCaptureSettings,
  createSmsCaptureBackfillRequest,
  createSmsCaptureQueueItem,
  createSmsSenderRule,
  findSmsCaptureQueueDuplicate,
  markSmsCaptureQueueItemFailed,
  markSmsCaptureQueueItemParsed,
  markSmsCaptureQueueItemParsing,
  markSmsCaptureQueueItemQueuedForParse,
  markSmsCaptureQueueItemUnmatched,
  mergeSmsCaptureQueueItems,
  shouldCaptureSmsFromSender,
  updateSmsSenderRule as updateSmsSenderRuleRecord,
} from "./sms-capture-management";
import {
  createIndexedDbSqliteBinaryStorage,
  createSQLiteStateStorage,
  type SQLiteBinaryStorage,
  type SQLiteStateStorage,
} from "./sqlite/state-storage";
import type { HistoricalImportResult } from "./services/historical-import-service";

export interface TransactionStoreState {
  hasInitialized: boolean;
  hasHydrated: boolean;
  approvalQueue: ApprovalQueueItem[];
  approvedTransactions: ApprovedTransaction[];
  unmatchedMessages: UnmatchedSmsEntry[];
  smsCaptureSettings: SmsCaptureSettings;
  smsCaptureQueue: SmsCaptureQueueItem[];
  smsCaptureQueueSummary: SmsCaptureQueueSummary;
  smsCaptureDiagnostics: SmsCaptureDiagnostics;
  smsCaptureBackfillRequest: SmsCaptureBackfillRequest;
  accountSummaries: AccountSummary[];
  customAccounts: CustomAccountRecord[];
  accountVisibilityOverrides: AccountVisibilityOverride[];
  budgetSummaries: BudgetSummary[];
  syncEnabled: boolean;
  syncMode: SyncMode;
  syncDiscoveryState: SyncDiscoveryState;
  syncStatusSummary: SyncStatusSummary;
  nearbySyncDevices: NearbySyncDevice[];
  trustedSyncDevices: TrustedSyncDevice[];
  syncActivity: SyncActivityEntry[];
  systemLogs: SystemLogEntry[];
  pairingCodeState: PairingCodeState;
  parserWorkspaceAuthorityState: ParserWorkspaceAuthorityState | null;
  securityPreferences: SecurityPreferences | null;
  activeQueueEntryId: string | null;
  activeApprovedTransactionId: string | null;
  seedDemoData: () => void;
  queueParsedTransaction: (
    draft: ParsedTransactionDraft,
    queuedAt?: string,
  ) => ApprovalQueueItem;
  captureUnmatchedSms: (
    rawSmsMessage: RawSmsMessage,
    unmatchedResult: Extract<ParserMatchResult, { status: "unmatched" }>,
    capturedAt?: string,
  ) => UnmatchedSmsEntry;
  importHistoricalData: (
    options: ImportHistoricalDataOptions,
  ) => Promise<HistoricalImportResult>;
  stageHistoricalImportPackage: (
    historicalImportPackage: HistoricalImportPackage,
    options?: StageHistoricalImportPackageOptions,
  ) => HistoricalImportPackageSummary;
  createDataExportPackage: (createdAt?: string) => DataExportPackage;
  createBackupPackage: (
    defaults: HistoricalImportDefaults,
    createdAt?: string,
  ) => BackupPackage;
  restoreBackupPackage: (
    backupPackage: BackupPackage,
    restoredAt?: string,
  ) => FinanceSnapshot;
  updateSmsCaptureSettings: (
    updates: Partial<Omit<SmsCaptureSettings, "senderRules">>,
  ) => SmsCaptureSettings;
  setSmsCaptureBackfillRequest: (
    lookbackDays: number | null,
    requestedAt?: string,
  ) => SmsCaptureBackfillRequest;
  addSmsSenderRule: (senderLabel: string, createdAt?: string) => SmsSenderRule;
  updateSmsSenderRule: (
    ruleId: string,
    updates: Partial<Pick<SmsSenderRule, "senderLabel" | "isEnabled">>,
    updatedAt?: string,
  ) => SmsSenderRule | null;
  removeSmsSenderRule: (ruleId: string) => boolean;
  enqueueCapturedSms: (
    rawSmsMessage: RawSmsMessage,
    options?: SmsCaptureEnqueueOptions,
  ) => SmsCaptureEnqueueResult;
  mergeNativeSmsCaptureQueueSnapshot: (
    snapshot: readonly CapturedSmsEnvelope[],
  ) => SmsCaptureQueueMergeResult;
  applySmsCaptureRuntimeSnapshot: (
    snapshot: SmsCaptureRuntimeSnapshot,
  ) => SmsCaptureQueueMergeResult;
  markSmsCaptureQueueItemQueuedForParse: (
    captureId: string,
  ) => SmsCaptureQueueItem | null;
  markSmsCaptureQueueItemParsed: (
    captureId: string,
    parserQueueEntryId: string,
    parsedAt?: string,
  ) => SmsCaptureQueueItem | null;
  markSmsCaptureQueueItemUnmatched: (
    captureId: string,
    unmatchedEntryId: string,
    failureReason: string,
    parsedAt?: string,
  ) => SmsCaptureQueueItem | null;
  markSmsCaptureQueueItemFailed: (
    captureId: string,
    failureReason: string,
    failedAt?: string,
  ) => SmsCaptureQueueItem | null;
  processNextSmsCaptureQueueItem: (options?: {
    processedAt?: string;
    runtime?: ParserRuntimeOptions;
  }) => SmsCaptureProcessResult | null;
  createCustomAccount: (
    input: CreateCustomAccountInput,
    createdAt?: string,
  ) => CustomAccountRecord;
  updateCustomAccount: (
    accountId: string,
    updates: UpdateCustomAccountInput,
    updatedAt?: string,
  ) => CustomAccountRecord | null;
  setAccountHidden: (
    accountId: string,
    isHidden: boolean,
    updatedAt?: string,
  ) => AccountVisibilityOverride | null;
  toggleSyncEnabled: () => void;
  setSyncMode: (mode: SyncMode) => void;
  startSyncDiscovery: () => void;
  stopSyncDiscovery: () => void;
  setParserWorkspaceAuthorityState: (
    parserWorkspaceAuthorityState: ParserWorkspaceAuthorityState,
  ) => ParserWorkspaceAuthorityState;
  clearParserWorkspaceAuthorityState: () => void;
  setSecurityPreferences: (
    securityPreferences: SecurityPreferences,
  ) => SecurityPreferences;
  clearSecurityPreferences: () => void;
  updatePairingCodeInput: (value: string) => void;
  pairNearbyDevice: (
    deviceId: string,
    pairedAt?: string,
  ) => TrustedSyncDevice | null;
  submitPairingCode: (submittedAt?: string) => TrustedSyncDevice | null;
  markTrustedDeviceAsPrimary: (deviceId: string) => void;
  removeTrustedDevice: (deviceId: string) => void;
  triggerManualSync: (triggeredAt?: string) => void;
  openTransactionEditor: (queueEntryId: string) => void;
  openApprovedTransactionEditor: (transactionId: string) => void;
  closeTransactionEditor: () => void;
  editApprovalQueueItem: (
    queueEntryId: string,
    updates: TransactionReviewUpdates,
  ) => void;
  editApprovedTransaction: (
    transactionId: string,
    updates: TransactionReviewUpdates,
  ) => void;
  approveQueueItem: (
    queueEntryId: string,
    approvedAt?: string,
  ) => ApprovedTransaction | null;
  rejectQueueItem: (queueEntryId: string) => void;
  dismissUnmatchedSms: (unmatchedEntryId: string) => void;
  clearAllData: (clearedAt?: string) => void;
}

type TransactionReviewEditableField =
  | "title"
  | "category"
  | "note"
  | "amountMinor"
  | "occurredAt"
  | "accountReference"
  | "reference";

type TransactionReviewUpdates = Partial<
  Pick<ApprovalQueueItem, TransactionReviewEditableField>
>;

type TransactionStoreApi = StoreApi<TransactionStoreState> & {
  persist: {
    rehydrate: () => Promise<void> | void;
    hasHydrated: () => boolean;
    onFinishHydration: (
      listener: (state: TransactionStoreState) => void,
    ) => () => void;
  };
};

export interface PersistedTransactionStoreState extends AuthorityDataSnapshot {
  hasInitialized: boolean;
  securityPreferences: SecurityPreferences | null;
}

export interface TransactionStoreOptions {
  persistName?: string;
  runtime?: AuthorityRuntime;
  storage?: PersistStorage<PersistedTransactionStoreState>;
  previewStateStorage?: StateStorage;
  sqliteStateStorage?: SQLiteStateStorage;
  sqliteBinaryStorage?: SQLiteBinaryStorage;
}

type HistoricalImportServiceModule = typeof import("./services/historical-import-service");
type HistoricalImportServiceLoader = () => Promise<
  Pick<HistoricalImportServiceModule, "importHistoricalTransactions">
>;

export interface ImportHistoricalDataOptions {
  drafts: readonly ParsedTransactionDraft[];
  unmatchedEntries?: readonly UnmatchedSmsEntry[];
  mode?: HistoricalImportMode;
  duplicateMode?: HistoricalImportDuplicateMode;
  reviewWindowDays?: number;
  reviewWindowDaysByAccountKey?: Record<string, number>;
  importedAt?: string;
  availableParserTemplates?: readonly ParserTemplateDefinition[];
  sourceLabel?: string;
}

export interface StageHistoricalImportPackageOptions {
  availableParserTemplates?: readonly ParserTemplateDefinition[];
  stagedAt?: string;
  sourceLabel?: string;
}

const loadHistoricalImportServiceDefault: HistoricalImportServiceLoader = async () =>
  import("./services/historical-import-service");

let historicalImportServiceLoader: HistoricalImportServiceLoader =
  loadHistoricalImportServiceDefault;

export function __setHistoricalImportServiceLoaderForTests(
  loader?: HistoricalImportServiceLoader,
): void {
  historicalImportServiceLoader = loader ?? loadHistoricalImportServiceDefault;
}

function cloneApprovalQueue(): ApprovalQueueItem[] {
  return demoApprovalQueue.map((item) => ({ ...item }));
}

function cloneApprovedTransactions(): ApprovedTransaction[] {
  return demoApprovedTransactions.map((item) => ({ ...item }));
}

function cloneAccountSummaries(): AccountSummary[] {
  return demoAccountSummaries.map((item) => ({ ...item }));
}

function cloneNearbySyncDevices(): NearbySyncDevice[] {
  return demoNearbySyncDevices.map((item) => ({ ...item }));
}

function cloneTrustedSyncDevices(): TrustedSyncDevice[] {
  return demoTrustedSyncDevices.map((item) => ({ ...item }));
}

function cloneSyncActivity(): SyncActivityEntry[] {
  return demoSyncActivity.map((item) => ({ ...item }));
}

function clonePairingCodeState(): PairingCodeState {
  return { ...demoPairingCodeState };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isSecurityPreferences(value: unknown): value is SecurityPreferences {
  return (
    isRecord(value) &&
    typeof value.biometricsEnabled === "boolean" &&
    typeof value.requireBiometricOnOpen === "boolean" &&
    typeof value.requireBiometricOnApprove === "boolean" &&
    typeof value.requireBiometricOnDelete === "boolean" &&
    typeof value.requireBiometricOnForwarding === "boolean" &&
    typeof value.twoFactorEnabled === "boolean"
  );
}

function cloneSecurityPreferences(
  securityPreferences: SecurityPreferences,
): SecurityPreferences {
  return { ...securityPreferences };
}

function cloneSmsCaptureSettings(
  smsCaptureSettings: SmsCaptureSettings,
): SmsCaptureSettings {
  return {
    ...smsCaptureSettings,
    senderRules: smsCaptureSettings.senderRules.map((item) => ({ ...item })),
  };
}

function cloneSmsCaptureQueue(
  smsCaptureQueue: readonly SmsCaptureQueueItem[],
): SmsCaptureQueueItem[] {
  return smsCaptureQueue.map((item) => ({ ...item }));
}

function cloneSystemLogs(systemLogs: readonly SystemLogEntry[]): SystemLogEntry[] {
  return systemLogs.map((item) => ({
    ...item,
    metrics: item.metrics.map((metric) => ({ ...metric })),
    templateUsage: item.templateUsage.map((usage) => ({ ...usage })),
  }));
}

function createFallbackStorage(): StateStorage {
  const memory = new Map<string, string>();

  return {
    getItem: (name: string) => memory.get(name) ?? null,
    setItem: (name: string, value: string) => {
      memory.set(name, value);
    },
    removeItem: (name: string) => {
      memory.delete(name);
    },
  };
}

function getWebPreviewStateStorage(
  previewStateStorage?: StateStorage,
): StateStorage {
  if (previewStateStorage) {
    return previewStateStorage;
  }

  if (typeof window !== "undefined" && window.localStorage) {
    return window.localStorage;
  }

  return createFallbackStorage();
}

function resolvePersistStorage(
  options: TransactionStoreOptions = {},
): PersistStorage<PersistedTransactionStoreState> {
  if (options.storage) {
    return options.storage;
  }

  if (options.runtime === "native_mobile") {
    const sqliteStateStorage =
      options.sqliteStateStorage ??
      createSQLiteStateStorage({
        binaryStorage:
          options.sqliteBinaryStorage ?? createIndexedDbSqliteBinaryStorage(),
        legacyStorage: getWebPreviewStateStorage(options.previewStateStorage),
      });

    return createJSONStorage<PersistedTransactionStoreState>(
      () => sqliteStateStorage,
    ) as PersistStorage<PersistedTransactionStoreState>;
  }

  const fallbackStorage =
    options.runtime === "memory"
      ? createFallbackStorage()
      : getWebPreviewStateStorage(options.previewStateStorage);

  return createJSONStorage<PersistedTransactionStoreState>(
    () => fallbackStorage,
  ) as PersistStorage<PersistedTransactionStoreState>;
}

function createInitialState() {
  const syncEnabled = true;
  const syncMode: SyncMode = "automatic";
  const syncDiscoveryState: SyncDiscoveryState = "paused";
  const nearbySyncDevices: NearbySyncDevice[] = [];
  const trustedSyncDevices: TrustedSyncDevice[] = [];
  const syncActivity: SyncActivityEntry[] = [];
  const smsCaptureSettings = createDefaultSmsCaptureSettings();
  const smsCaptureQueue: SmsCaptureQueueItem[] = [];
  const smsCaptureDiagnostics = createDefaultSmsCaptureDiagnostics();
  const smsCaptureBackfillRequest = createDefaultSmsCaptureBackfillRequest();
  const pairingCodeState: PairingCodeState = {
    generatedCode: "284913",
    expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    pendingCodeInput: "",
    lastSubmittedCode: null,
    errorMessage: null,
  };

  return {
    hasInitialized: false,
    hasHydrated: false,
    approvalQueue: [] as ApprovalQueueItem[],
    approvedTransactions: [] as ApprovedTransaction[],
    unmatchedMessages: [] as UnmatchedSmsEntry[],
    smsCaptureSettings,
    smsCaptureQueue,
    smsCaptureQueueSummary: buildSmsCaptureQueueSummary(smsCaptureQueue),
    smsCaptureDiagnostics,
    smsCaptureBackfillRequest,
    accountSummaries: [] as AccountSummary[],
    customAccounts: [] as CustomAccountRecord[],
    accountVisibilityOverrides: [] as AccountVisibilityOverride[],
    budgetSummaries: [] as BudgetSummary[],
    syncEnabled,
    syncMode,
    syncDiscoveryState,
    syncStatusSummary: buildSyncStatusSummary({
      syncEnabled,
      syncMode,
      syncDiscoveryState,
      nearbySyncDevices,
      trustedSyncDevices,
      syncActivity,
    }),
    nearbySyncDevices,
    trustedSyncDevices,
    syncActivity,
    systemLogs: [] as SystemLogEntry[],
    pairingCodeState,
    parserWorkspaceAuthorityState: null as ParserWorkspaceAuthorityState | null,
    securityPreferences: null as SecurityPreferences | null,
    activeQueueEntryId: null as string | null,
    activeApprovedTransactionId: null as string | null,
  };
}

const accountToneByInstitution: Record<FinancialInstitution, UiTone> = {
  cbe: "primary",
  boa: "surface",
  telebirr: "secondary",
  cbebirr: "secondary",
  dashen: "tertiary",
  bunna: "surface",
  unknown: "surface",
};

const accountIconByInstitution: Record<FinancialInstitution, string> = {
  cbe: "account_balance",
  boa: "shield",
  telebirr: "phone_iphone",
  cbebirr: "payments",
  dashen: "diamond",
  bunna: "account_balance_wallet",
  unknown: "payments",
};

function formatMaskedAccountNumber(
  accountReference: string | undefined,
  accountChannel: ParsedTransactionDraft["accountChannel"],
): string {
  if (!accountReference) {
    return accountChannel === "cash" ? "Pocket cash" : "Unknown account";
  }

  return `**** ${accountReference.slice(-4)}`;
}

function normalizeTransactionReviewUpdates(
  updates: TransactionReviewUpdates,
): TransactionReviewUpdates {
  const normalizedUpdates: TransactionReviewUpdates = { ...updates };

  if (typeof normalizedUpdates.title === "string") {
    normalizedUpdates.title = normalizedUpdates.title.trim();
  }

  if (typeof normalizedUpdates.note === "string") {
    normalizedUpdates.note = normalizedUpdates.note.trim();
  }

  if (typeof normalizedUpdates.occurredAt === "string") {
    normalizedUpdates.occurredAt = normalizedUpdates.occurredAt.trim();
  }

  if (typeof normalizedUpdates.accountReference === "string") {
    const trimmedAccountReference = normalizedUpdates.accountReference.trim();
    normalizedUpdates.accountReference =
      trimmedAccountReference.length > 0 ? trimmedAccountReference : undefined;
  }

  if (typeof normalizedUpdates.reference === "string") {
    const trimmedReference = normalizedUpdates.reference.trim();
    normalizedUpdates.reference =
      trimmedReference.length > 0 ? trimmedReference : undefined;
  }

  return normalizedUpdates;
}

function buildAccountSummaryFromDraft(
  draft: ParsedTransactionDraft,
): AccountSummary | null {
  const preferredBalanceMinor =
    draft.reportedBalanceMinor ?? draft.runningBalanceMinor;

  if (preferredBalanceMinor <= 0) {
    return null;
  }

  const accountReference = draft.accountReference?.trim();
  const accountId = `acct-${draft.financialInstitution}-${
    accountReference || draft.accountChannel
  }`;

  return {
    accountId,
    institutionName: FINANCIAL_INSTITUTION_LABELS[draft.financialInstitution],
    maskedAccountNumber: formatMaskedAccountNumber(
      accountReference,
      draft.accountChannel,
    ),
    fullAccountNumber: accountReference,
    balanceMinor: preferredBalanceMinor,
    currencyCode: "ETB",
    channel: draft.accountChannel,
    iconName:
      draft.accountChannel === "cash"
        ? "payments"
        : accountIconByInstitution[draft.financialInstitution],
    tone:
      draft.accountChannel === "cash"
        ? "surface"
        : accountToneByInstitution[draft.financialInstitution],
  };
}

function syncAccountSummariesWithDraft(
  accountSummaries: readonly AccountSummary[],
  draft: ParsedTransactionDraft,
): AccountSummary[] {
  const nextSummary = buildAccountSummaryFromDraft(draft);
  if (!nextSummary) {
    return [...accountSummaries];
  }

  const existingIndex = accountSummaries.findIndex(
    (accountSummary) => accountSummary.accountId === nextSummary.accountId,
  );

  if (existingIndex === -1) {
    return [nextSummary, ...accountSummaries];
  }

  return accountSummaries.map((accountSummary, index) =>
    index === existingIndex ? nextSummary : accountSummary,
  );
}

function formatPlatformLabel(platform: NearbySyncDevice["platform"]): string {
  return platform === "desktop"
    ? "Desktop"
    : platform === "tablet"
      ? "Tablet"
      : "Mobile";
}

function buildSyncStatusSummary(input: {
  syncEnabled: boolean;
  syncMode: SyncMode;
  syncDiscoveryState: SyncDiscoveryState;
  nearbySyncDevices: readonly NearbySyncDevice[];
  trustedSyncDevices: readonly TrustedSyncDevice[];
  syncActivity: readonly SyncActivityEntry[];
}): SyncStatusSummary {
  const primaryTrustedDevice =
    input.trustedSyncDevices.find((device) => device.isPrimary) ?? null;
  const lastSyncEntry =
    input.syncActivity.find((entry) => entry.type === "sync") ?? null;
  const nearbyReadyCount = input.nearbySyncDevices.length;
  const trustedDeviceCount = input.trustedSyncDevices.length;

  if (!input.syncEnabled) {
    return {
      tone: "offline",
      headline: "Sync paused on this phone",
      detail: "Background discovery and automatic handoff are disabled until you turn sync back on.",
      nearbyReadyCount,
      trustedDeviceCount,
      lastSyncAt: lastSyncEntry?.occurredAt ?? null,
    };
  }

  if (input.syncDiscoveryState === "searching" && nearbyReadyCount > 0) {
    return {
      tone: "active",
      headline: "Nearby desktop found",
      detail: `${nearbyReadyCount} device${nearbyReadyCount === 1 ? "" : "s"} ready for pairing or trust promotion.`,
      nearbyReadyCount,
      trustedDeviceCount,
      lastSyncAt: lastSyncEntry?.occurredAt ?? null,
    };
  }

  if (primaryTrustedDevice && primaryTrustedDevice.health === "healthy") {
    return {
      tone: "ready",
      headline: `Primary route: ${primaryTrustedDevice.displayName}`,
      detail: input.syncMode === "automatic"
        ? "Automatic same-network sync is armed for the primary review route."
        : "Manual sync mode is active. Use the sync button when you want to push approved data.",
      nearbyReadyCount,
      trustedDeviceCount,
      lastSyncAt: primaryTrustedDevice.lastSyncedAt,
    };
  }

  if (primaryTrustedDevice) {
    return {
      tone: "attention",
      headline: `${primaryTrustedDevice.displayName} needs attention`,
      detail: "The primary review route exists, but its sync health needs review before relying on automatic handoff.",
      nearbyReadyCount,
      trustedDeviceCount,
      lastSyncAt: primaryTrustedDevice.lastSyncedAt,
    };
  }

  return {
    tone: input.syncDiscoveryState === "searching" ? "active" : "attention",
    headline:
      input.syncDiscoveryState === "searching"
        ? "Looking for desktop listeners"
        : "No trusted route yet",
    detail:
      input.syncDiscoveryState === "searching"
        ? "Nearby discovery is active. Pair a nearby desktop when one appears."
        : "Start discovery or use a 6-digit code to establish the first trusted route.",
    nearbyReadyCount,
    trustedDeviceCount,
    lastSyncAt: lastSyncEntry?.occurredAt ?? null,
  };
}

function prependSyncActivity(
  syncActivity: readonly SyncActivityEntry[],
  activity: SyncActivityEntry,
): SyncActivityEntry[] {
  return [activity, ...syncActivity].slice(0, 12);
}

function prependSystemLog(
  systemLogs: readonly SystemLogEntry[],
  entry: SystemLogEntry,
): SystemLogEntry[] {
  return [entry, ...systemLogs].slice(0, 40);
}

function createSystemLogEntry(
  entry: Omit<SystemLogEntry, "logId">,
): SystemLogEntry {
  return {
    logId: `log-${entry.eventKind}-${entry.occurredAt}`,
    ...entry,
    metrics: entry.metrics.map((metric) => ({ ...metric })),
    templateUsage: entry.templateUsage.map((usage) => ({ ...usage })),
  };
}

function buildFinanceSnapshotFromState(
  state: Pick<
    TransactionStoreState,
    "approvedTransactions" | "approvalQueue" | "unmatchedMessages" | "accountSummaries"
  >,
): FinanceSnapshot {
  return cloneFinanceSnapshot({
    approvedTransactions: state.approvedTransactions,
    approvalQueue: state.approvalQueue,
    unmatchedMessages: state.unmatchedMessages,
    accountSummaries: state.accountSummaries,
  });
}

function buildAuthorityDataSnapshotFromState(
  state: Pick<
    TransactionStoreState,
    | "approvedTransactions"
    | "approvalQueue"
    | "unmatchedMessages"
    | "accountSummaries"
    | "smsCaptureSettings"
    | "smsCaptureQueue"
    | "smsCaptureDiagnostics"
    | "smsCaptureBackfillRequest"
    | "customAccounts"
    | "accountVisibilityOverrides"
    | "syncEnabled"
    | "syncMode"
    | "syncDiscoveryState"
    | "nearbySyncDevices"
    | "trustedSyncDevices"
    | "syncActivity"
    | "systemLogs"
    | "pairingCodeState"
    | "parserWorkspaceAuthorityState"
  >,
): AuthorityDataSnapshot {
  return {
    ...buildFinanceSnapshotFromState(state),
    smsCaptureSettings: cloneSmsCaptureSettings(state.smsCaptureSettings),
    smsCaptureQueue: cloneSmsCaptureQueue(state.smsCaptureQueue),
    smsCaptureDiagnostics: { ...state.smsCaptureDiagnostics },
    smsCaptureBackfillRequest: { ...state.smsCaptureBackfillRequest },
    customAccounts: state.customAccounts.map((item) => ({ ...item })),
    accountVisibilityOverrides: state.accountVisibilityOverrides.map((item) => ({
      ...item,
    })),
    syncEnabled: state.syncEnabled,
    syncMode: state.syncMode,
    syncDiscoveryState: state.syncDiscoveryState,
    nearbySyncDevices: state.nearbySyncDevices.map((item) => ({ ...item })),
    trustedSyncDevices: state.trustedSyncDevices.map((item) => ({ ...item })),
    syncActivity: state.syncActivity.map((item) => ({ ...item })),
    systemLogs: cloneSystemLogs(state.systemLogs),
    pairingCodeState: { ...state.pairingCodeState },
    parserWorkspaceAuthorityState:
      state.parserWorkspaceAuthorityState == null
        ? null
        : cloneParserWorkspaceAuthorityState(state.parserWorkspaceAuthorityState),
  };
}

function buildPersistedTransactionStoreStateFromState(
  state: TransactionStoreState,
): PersistedTransactionStoreState {
  return {
    hasInitialized: state.hasInitialized,
    securityPreferences:
      state.securityPreferences == null
        ? null
        : cloneSecurityPreferences(state.securityPreferences),
    ...buildAuthorityDataSnapshotFromState(state),
  };
}

function buildStateFromAuthoritySnapshot(
  currentState: TransactionStoreState,
  authorityState: AuthorityDataSnapshot,
  hasInitialized: boolean,
): TransactionStoreState {
  const snapshot = cloneAuthorityDataSnapshot(authorityState);

  return {
    ...currentState,
    hasInitialized,
    approvalQueue: snapshot.approvalQueue,
    approvedTransactions: snapshot.approvedTransactions,
    unmatchedMessages: snapshot.unmatchedMessages,
    smsCaptureSettings: snapshot.smsCaptureSettings,
    smsCaptureQueue: snapshot.smsCaptureQueue,
    smsCaptureQueueSummary: buildSmsCaptureQueueSummary(snapshot.smsCaptureQueue),
    smsCaptureDiagnostics: snapshot.smsCaptureDiagnostics,
    smsCaptureBackfillRequest: snapshot.smsCaptureBackfillRequest,
    accountSummaries: snapshot.accountSummaries,
    customAccounts: snapshot.customAccounts,
    accountVisibilityOverrides: snapshot.accountVisibilityOverrides,
    budgetSummaries: buildBudgetSummaries(snapshot.approvedTransactions),
    syncEnabled: snapshot.syncEnabled,
    syncMode: snapshot.syncMode,
    syncDiscoveryState: snapshot.syncDiscoveryState,
    syncStatusSummary: buildSyncStatusSummary({
      syncEnabled: snapshot.syncEnabled,
      syncMode: snapshot.syncMode,
      syncDiscoveryState: snapshot.syncDiscoveryState,
      nearbySyncDevices: snapshot.nearbySyncDevices,
      trustedSyncDevices: snapshot.trustedSyncDevices,
      syncActivity: snapshot.syncActivity,
    }),
    nearbySyncDevices: snapshot.nearbySyncDevices,
    trustedSyncDevices: snapshot.trustedSyncDevices,
    syncActivity: snapshot.syncActivity,
    systemLogs: snapshot.systemLogs,
    pairingCodeState: snapshot.pairingCodeState,
    parserWorkspaceAuthorityState: snapshot.parserWorkspaceAuthorityState,
    activeQueueEntryId: null,
    activeApprovedTransactionId: null,
  };
}

function mergePersistedTransactionStoreState(
  persistedState: unknown,
  currentState: TransactionStoreState,
): TransactionStoreState {
  if (!isRecord(persistedState)) {
    return currentState;
  }

  const maybePersistedState = persistedState as Partial<PersistedTransactionStoreState>;
  const authorityState: AuthorityDataSnapshot = {
    ...buildAuthorityDataSnapshotFromState(currentState),
    ...(maybePersistedState as Partial<AuthorityDataSnapshot>),
  };
  const securityPreferences = isSecurityPreferences(
    maybePersistedState.securityPreferences,
  )
    ? cloneSecurityPreferences(maybePersistedState.securityPreferences)
    : currentState.securityPreferences == null
      ? null
      : cloneSecurityPreferences(currentState.securityPreferences);

  return {
    ...buildStateFromAuthoritySnapshot(
      currentState,
      authorityState,
      maybePersistedState.hasInitialized ?? currentState.hasInitialized,
    ),
    securityPreferences,
  };
}

function formatMetricValue(value: number): string {
  return String(value);
}

function buildFinanceSnapshotMetrics(snapshot: FinanceSnapshot): SystemLogMetric[] {
  return [
    { label: "Approved", value: formatMetricValue(snapshot.approvedTransactions.length) },
    { label: "Queued", value: formatMetricValue(snapshot.approvalQueue.length) },
    { label: "Unmatched", value: formatMetricValue(snapshot.unmatchedMessages.length) },
    { label: "Accounts", value: formatMetricValue(snapshot.accountSummaries.length) },
  ];
}

function resolveParserTemplateCatalog(
  availableParserTemplates?: readonly ParserTemplateDefinition[],
): readonly ParserTemplateDefinition[] {
  return availableParserTemplates ?? cloneDefaultParserTemplates();
}

function buildHistoricalImportSummary(
  drafts: readonly ParsedTransactionDraft[],
  unmatchedEntries: readonly UnmatchedSmsEntry[],
  availableParserTemplates?: readonly ParserTemplateDefinition[],
): HistoricalImportPackageSummary {
  return summarizeHistoricalImportPackage(
    {
      drafts: drafts.map((draft) => ({ ...draft })),
      unmatchedEntries: unmatchedEntries.map((entry) => ({ ...entry })),
    },
    resolveParserTemplateCatalog(availableParserTemplates),
  );
}

function buildHistoricalImportMetrics(
  summary: HistoricalImportPackageSummary,
  additionalMetrics: readonly SystemLogMetric[] = [],
): SystemLogMetric[] {
  return [
    { label: "Drafts", value: formatMetricValue(summary.draftCount) },
    { label: "Unmatched", value: formatMetricValue(summary.unmatchedCount) },
    { label: "Accounts", value: formatMetricValue(summary.uniqueAccountCount) },
    {
      label: "Reported balances",
      value: formatMetricValue(summary.reportedBalanceDraftCount),
    },
    {
      label: "Unknown templates",
      value: formatMetricValue(summary.unknownTemplateIds.length),
    },
    {
      label: "Disabled templates",
      value: formatMetricValue(summary.disabledTemplateIds.length),
    },
    {
      label: "Draft templates",
      value: formatMetricValue(summary.draftTemplateIds.length),
    },
    ...additionalMetrics,
  ];
}

function buildTrustedDeviceFromNearby(
  device: NearbySyncDevice,
  pairedAt: string,
  isPrimary: boolean,
  syncMode: SyncMode,
): TrustedSyncDevice {
  return {
    deviceId: device.deviceId,
    displayName: device.displayName,
    platform: device.platform,
    connectedAt: pairedAt,
    lastSyncedAt: null,
    health: "healthy",
    isPrimary,
    autoSyncEnabled: syncMode === "automatic",
  };
}

function createCodePairedDevice(
  code: string,
  pairedAt: string,
  isPrimary: boolean,
  syncMode: SyncMode,
): TrustedSyncDevice {
  return {
    deviceId: `code-paired-${code}`,
    displayName: `Local Preview ${code}`,
    platform: "desktop",
    connectedAt: pairedAt,
    lastSyncedAt: null,
    health: "healthy",
    isPrimary,
    autoSyncEnabled: syncMode === "automatic",
  };
}

export function buildDashboardSnapshot(
  state: Pick<
    TransactionStoreState,
    "accountSummaries" | "approvalQueue" | "approvedTransactions"
  >,
): DashboardSnapshot {
  const balanceByChannel: DashboardSnapshot["balanceByChannel"] = {
    bank: 0,
    mobile_money: 0,
    cash: 0,
  };

  for (const accountSummary of state.accountSummaries) {
    balanceByChannel[accountSummary.channel] += accountSummary.balanceMinor;
  }

  return {
    totalBalanceMinor: Object.values(balanceByChannel).reduce(
      (total, value) => total + value,
      0,
    ),
    pendingApprovalCount: state.approvalQueue.length,
    approvedTransactionCount: state.approvedTransactions.length,
    balanceByChannel,
  };
}

export function selectSmsCaptureRoutingSummary(
  state: Pick<
    TransactionStoreState,
    | "smsCaptureSettings"
    | "smsCaptureQueue"
    | "smsCaptureQueueSummary"
    | "smsCaptureDiagnostics"
    | "smsCaptureBackfillRequest"
  >,
): SmsCaptureRoutingSummary {
  return buildSmsCaptureRoutingSummary({
    settings: state.smsCaptureSettings,
    queue: state.smsCaptureQueue,
    queueSummary: state.smsCaptureQueueSummary,
    diagnostics: state.smsCaptureDiagnostics,
    backfillRequest: state.smsCaptureBackfillRequest,
  });
}

export function selectParserWorkspaceAuthorityState(
  state: Pick<TransactionStoreState, "parserWorkspaceAuthorityState">,
): ParserWorkspaceAuthorityState | null {
  return state.parserWorkspaceAuthorityState;
}

function buildSmsCaptureStateSnapshot(
  queue: readonly SmsCaptureQueueItem[],
  diagnostics: SmsCaptureDiagnostics,
): Pick<
  TransactionStoreState,
  "smsCaptureQueue" | "smsCaptureQueueSummary" | "smsCaptureDiagnostics"
> {
  return {
    smsCaptureQueue: [...queue],
    smsCaptureQueueSummary: buildSmsCaptureQueueSummary(queue),
    smsCaptureDiagnostics: diagnostics,
  };
}

function updateLatestCapturedDiagnostics(
  diagnostics: SmsCaptureDiagnostics,
  queueItems: readonly SmsCaptureQueueItem[],
): SmsCaptureDiagnostics {
  if (queueItems.length === 0) {
    return diagnostics;
  }

  const latestItem = [...queueItems].sort(
    (left, right) =>
      new Date(right.capturedAt).getTime() - new Date(left.capturedAt).getTime(),
  )[0];

  if (!latestItem) {
    return diagnostics;
  }

  if (
    diagnostics.lastCapturedAt &&
    new Date(diagnostics.lastCapturedAt).getTime() >=
      new Date(latestItem.capturedAt).getTime()
  ) {
    return diagnostics;
  }

  return {
    ...diagnostics,
    lastCapturedAt: latestItem.capturedAt,
    lastCapturedSenderLabel: latestItem.senderLabel,
  };
}

function mergeSmsCaptureRuntimeDiagnostics(
  currentDiagnostics: SmsCaptureDiagnostics,
  nextDiagnostics: Pick<
    SmsCaptureDiagnostics,
    | "permissionState"
    | "nativeCaptureAvailable"
    | "captureSupported"
    | "historyCaptureSupported"
    | "duplicateSuppressedCount"
    | "filteredOutCount"
  >,
  queueItems: readonly SmsCaptureQueueItem[],
): SmsCaptureDiagnostics {
  const mergedDiagnostics = updateLatestCapturedDiagnostics(
    {
      ...currentDiagnostics,
      permissionState: nextDiagnostics.permissionState,
      nativeCaptureAvailable: nextDiagnostics.nativeCaptureAvailable,
      captureSupported: nextDiagnostics.captureSupported,
      historyCaptureSupported: nextDiagnostics.historyCaptureSupported,
      duplicateSuppressedCount: Math.max(
        currentDiagnostics.duplicateSuppressedCount,
        nextDiagnostics.duplicateSuppressedCount,
      ),
      filteredOutCount: Math.max(
        currentDiagnostics.filteredOutCount,
        nextDiagnostics.filteredOutCount,
      ),
    },
    queueItems,
  );

  if (
    nextDiagnostics.duplicateSuppressedCount >
    currentDiagnostics.duplicateSuppressedCount
  ) {
    mergedDiagnostics.duplicateSuppressedCount =
      nextDiagnostics.duplicateSuppressedCount;
  }

  if (nextDiagnostics.filteredOutCount > currentDiagnostics.filteredOutCount) {
    mergedDiagnostics.filteredOutCount = nextDiagnostics.filteredOutCount;
  }

  return mergedDiagnostics;
}

function collectAcceptedSmsCaptureQueueItems(
  queueItems: readonly SmsCaptureQueueItem[],
  senderRules: readonly SmsSenderRule[],
  autoRouteToParserWhenAppOpen: boolean,
): {
  acceptedItems: SmsCaptureQueueItem[];
  filteredOutCount: number;
} {
  const acceptedItems: SmsCaptureQueueItem[] = [];
  let filteredOutCount = 0;

  queueItems.forEach((queueItem) => {
    if (!shouldCaptureSmsFromSender(queueItem.senderLabel, senderRules)) {
      filteredOutCount += 1;
      return;
    }

    acceptedItems.push(
      autoRouteToParserWhenAppOpen && queueItem.status === "captured"
        ? markSmsCaptureQueueItemQueuedForParse(queueItem)
        : queueItem,
    );
  });

  return {
    acceptedItems,
    filteredOutCount,
  };
}

function replaceSmsCaptureQueueItem(
  queue: readonly SmsCaptureQueueItem[],
  captureId: string,
  nextItem: SmsCaptureQueueItem,
): SmsCaptureQueueItem[] {
  return queue.map((item) =>
    item.captureId === captureId ? nextItem : item,
  );
}

function updateSmsCaptureQueueItem(
  queue: readonly SmsCaptureQueueItem[],
  captureId: string,
  updater: (item: SmsCaptureQueueItem) => SmsCaptureQueueItem,
): {
  queue: SmsCaptureQueueItem[];
  updatedItem: SmsCaptureQueueItem | null;
} {
  const currentItem = queue.find((item) => item.captureId === captureId) ?? null;

  if (!currentItem) {
    return {
      queue: [...queue],
      updatedItem: null,
    };
  }

  const updatedItem = updater(currentItem);

  return {
    queue: replaceSmsCaptureQueueItem(queue, captureId, updatedItem),
    updatedItem,
  };
}

export function createTransactionStore(
  options: TransactionStoreOptions = {},
): TransactionStoreApi {
  const transactionStoreApi = createStore<TransactionStoreState>()(
    persist(
      (set, get) => ({
        ...createInitialState(),
        seedDemoData: () => {
          const approvedTransactions = cloneApprovedTransactions();
          const syncEnabled = true;
          const syncMode: SyncMode = "automatic";
          const syncDiscoveryState: SyncDiscoveryState = "searching";
          const smsCaptureSettings = createDefaultSmsCaptureSettings();
          const smsCaptureQueue: SmsCaptureQueueItem[] = [];
          const smsCaptureDiagnostics = createDefaultSmsCaptureDiagnostics();
          const smsCaptureBackfillRequest =
            createDefaultSmsCaptureBackfillRequest();
          const nearbySyncDevices = cloneNearbySyncDevices();
          const trustedSyncDevices = cloneTrustedSyncDevices();
          const syncActivity = cloneSyncActivity();

          set({
            hasInitialized: true,
            approvalQueue: cloneApprovalQueue(),
            approvedTransactions,
            unmatchedMessages: [],
            smsCaptureSettings,
            smsCaptureQueue,
            smsCaptureQueueSummary: buildSmsCaptureQueueSummary(smsCaptureQueue),
            smsCaptureDiagnostics,
            smsCaptureBackfillRequest,
            accountSummaries: cloneAccountSummaries(),
            customAccounts: [],
            accountVisibilityOverrides: [],
            budgetSummaries: buildBudgetSummaries(approvedTransactions),
            syncEnabled,
            syncMode,
            syncDiscoveryState,
            syncStatusSummary: buildSyncStatusSummary({
              syncEnabled,
              syncMode,
              syncDiscoveryState,
              nearbySyncDevices,
              trustedSyncDevices,
              syncActivity,
            }),
            nearbySyncDevices,
            trustedSyncDevices,
            syncActivity,
            pairingCodeState: clonePairingCodeState(),
            activeQueueEntryId: null,
          });
        },
        queueParsedTransaction: (draft, queuedAt = new Date().toISOString()) => {
          const queuedDraft: ApprovalQueueItem = {
            ...draft,
            queueEntryId: `queue-${draft.draftId}-${queuedAt}`,
            queuedAt,
            approvalStatus: "pending_approval",
            note: draft.note ?? "",
          };

          set((state) => ({
            hasInitialized: true,
            approvalQueue: [queuedDraft, ...state.approvalQueue],
          }));

          return queuedDraft;
        },
        captureUnmatchedSms: (
          rawSmsMessage,
          unmatchedResult,
          capturedAt = new Date().toISOString(),
        ) => {
          const unmatchedEntry: UnmatchedSmsEntry = {
            unmatchedEntryId: `unmatched-${rawSmsMessage.messageId}-${capturedAt}`,
            rawMessageId: unmatchedResult.rawMessageId,
            senderLabel: unmatchedResult.senderLabel,
            smsBody: unmatchedResult.smsBody,
            receivedAt: rawSmsMessage.receivedAt,
            capturedAt,
            failureReason: unmatchedResult.failureReason,
          };

          set((state) => ({
            hasInitialized: true,
            unmatchedMessages: [unmatchedEntry, ...state.unmatchedMessages],
          }));

          return unmatchedEntry;
        },
        stageHistoricalImportPackage: (
          historicalImportPackage,
          {
            availableParserTemplates,
            stagedAt = sanitizeCreatedAt(historicalImportPackage.createdAt),
            sourceLabel,
          } = {},
        ) => {
          const summary = buildHistoricalImportSummary(
            historicalImportPackage.drafts,
            historicalImportPackage.unmatchedEntries,
            availableParserTemplates,
          );
          const parserWarningCount =
            summary.unknownTemplateIds.length +
            summary.disabledTemplateIds.length +
            summary.draftTemplateIds.length;
          const sourceDescriptor = sourceLabel
            ? `${sourceLabel}`
            : "historical import package";
          const detail =
            parserWarningCount > 0
              ? `Staged ${sourceDescriptor} with ${summary.draftCount} drafts and ${parserWarningCount} parser template warning(s) on this device.`
              : `Staged ${sourceDescriptor} with ${summary.draftCount} drafts and ${summary.unmatchedCount} unmatched rows for review.`;

          set((state) => ({
            systemLogs: prependSystemLog(
              state.systemLogs,
              createSystemLogEntry({
                eventKind: "import_staged",
                tone: parserWarningCount > 0 ? "warning" : "neutral",
                title: "Historical import staged",
                detail,
                occurredAt: stagedAt,
                metrics: buildHistoricalImportMetrics(summary),
                templateUsage: summary.templateUsage,
              }),
            ),
          }));

          return summary;
        },
        importHistoricalData: async ({
          drafts,
          unmatchedEntries = [],
          mode = "merge",
          duplicateMode = "skip",
          reviewWindowDays = 0,
          reviewWindowDaysByAccountKey,
          importedAt = new Date().toISOString(),
          availableParserTemplates,
          sourceLabel,
        }) => {
          const importSummary = buildHistoricalImportSummary(
            drafts,
            unmatchedEntries,
            availableParserTemplates,
          );

          try {
            const state = get();
            const { importHistoricalTransactions } =
              await historicalImportServiceLoader();
            const result = importHistoricalTransactions({
              existingApprovedTransactions: state.approvedTransactions,
              existingApprovalQueue: state.approvalQueue,
              existingAccountSummaries: state.accountSummaries,
              existingUnmatchedEntries: state.unmatchedMessages,
              importedDrafts: drafts,
              importedUnmatchedEntries: unmatchedEntries,
              options: {
                mode,
                duplicateMode,
                defaultRecentReviewDays: reviewWindowDays,
                recentReviewDaysByAccountKey: reviewWindowDaysByAccountKey,
                processedAt: importedAt,
              },
            });

            const sourceDescriptor = sourceLabel
              ? `${sourceLabel}`
              : "historical import package";
            const importedDraftIds = new Set(drafts.map((draft) => draft.draftId));
            const importedApprovedCount = result.approvedTransactions.filter((transaction) =>
              importedDraftIds.has(transaction.draftId),
            ).length;
            const importedReviewCount = result.approvalQueue.filter((queueItem) =>
              importedDraftIds.has(queueItem.draftId),
            ).length;

            set((currentState) => ({
              hasInitialized: true,
              approvalQueue: result.approvalQueue,
              approvedTransactions: result.approvedTransactions,
              unmatchedMessages: result.unmatchedEntries,
              accountSummaries: result.accountSummaries,
              budgetSummaries: buildBudgetSummaries(result.approvedTransactions),
              activeQueueEntryId: null,
              systemLogs: prependSystemLog(
                currentState.systemLogs,
                createSystemLogEntry({
                  eventKind: "import_applied",
                  tone: "success",
                  title: "Historical import applied",
                  detail: `Applied ${sourceDescriptor} with ${importedApprovedCount} ledger entries, ${importedReviewCount} queued reviews, and ${result.duplicates.length} duplicates detected.`,
                  occurredAt: result.processedAt,
                  metrics: buildHistoricalImportMetrics(importSummary, [
                    {
                      label: "Approved",
                      value: formatMetricValue(importedApprovedCount),
                    },
                    {
                      label: "Queued",
                      value: formatMetricValue(importedReviewCount),
                    },
                    {
                      label: "Duplicates",
                      value: formatMetricValue(result.duplicates.length),
                    },
                    {
                      label: "Inferred accounts",
                      value: formatMetricValue(result.inferredAccounts.length),
                    },
                  ]),
                  templateUsage: importSummary.templateUsage,
                }),
              ),
            }));

            return result;
          } catch (error) {
            const message =
              error instanceof Error ? error.message : "Unknown import failure";
            const sourceDescriptor = sourceLabel
              ? `${sourceLabel}`
              : "historical import package";

            set((state) => ({
              systemLogs: prependSystemLog(
                state.systemLogs,
                createSystemLogEntry({
                  eventKind: "import_failed",
                  tone: "error",
                  title: "Historical import failed",
                  detail: `Failed to apply ${sourceDescriptor}: ${message}`,
                  occurredAt: importedAt,
                  metrics: buildHistoricalImportMetrics(importSummary),
                  templateUsage: importSummary.templateUsage,
                }),
              ),
            }));

            throw error;
          }
        },
        createDataExportPackage: (createdAt = new Date().toISOString()) => {
          const snapshot = buildFinanceSnapshotFromState(get());
          const authorityState = buildAuthorityDataSnapshotFromState(get());
          const dataExportPackage = buildDataExportPackage(
            snapshot,
            createdAt,
            authorityState,
          );

          set((state) => ({
            systemLogs: prependSystemLog(
              state.systemLogs,
              createSystemLogEntry({
                eventKind: "export",
                tone: "success",
                title: "Finance data exported",
                detail: "Created a JSON export from the current local finance state.",
                occurredAt: createdAt,
                metrics: buildFinanceSnapshotMetrics(snapshot),
                templateUsage: [],
              }),
            ),
          }));

          return dataExportPackage;
        },
        createBackupPackage: (defaults, createdAt = new Date().toISOString()) => {
          const snapshot = buildFinanceSnapshotFromState(get());
          const authorityState = buildAuthorityDataSnapshotFromState(get());
          const backupPackage = buildBackupPackage(
            snapshot,
            defaults,
            createdAt,
            authorityState,
          );

          set((state) => ({
            systemLogs: prependSystemLog(
              state.systemLogs,
              createSystemLogEntry({
                eventKind: "backup",
                tone: "success",
                title: "Backup snapshot created",
                detail: "Created a restore-ready backup package from the current local finance state.",
                occurredAt: createdAt,
                metrics: [
                  ...buildFinanceSnapshotMetrics(snapshot),
                  {
                    label: "Import mode",
                    value: backupPackage.defaults.importMode,
                  },
                  {
                    label: "Duplicate mode",
                    value: backupPackage.defaults.duplicateMode,
                  },
                  {
                    label: "Review window",
                    value: formatMetricValue(backupPackage.defaults.reviewWindowDays),
                  },
                ],
                templateUsage: [],
              }),
            ),
          }));

          return backupPackage;
        },
        restoreBackupPackage: (backupPackage, restoredAt = new Date().toISOString()) => {
          const financeSnapshot = cloneFinanceSnapshot(backupPackage.finance);
          const authorityState =
            backupPackage.authorityState == null
              ? null
              : cloneAuthorityDataSnapshot(backupPackage.authorityState);

          set((state) => {
            const restoredState =
              authorityState == null
                ? {
                    ...state,
                    hasInitialized: true,
                    approvedTransactions: financeSnapshot.approvedTransactions,
                    approvalQueue: financeSnapshot.approvalQueue,
                    unmatchedMessages: financeSnapshot.unmatchedMessages,
                    accountSummaries: financeSnapshot.accountSummaries,
                    budgetSummaries: buildBudgetSummaries(
                      financeSnapshot.approvedTransactions,
                    ),
                    activeQueueEntryId: null,
                    activeApprovedTransactionId: null,
                  }
                : buildStateFromAuthoritySnapshot(state, authorityState, true);

            return {
              ...restoredState,
              systemLogs: prependSystemLog(
                authorityState?.systemLogs ?? state.systemLogs,
                createSystemLogEntry({
                  eventKind: "restore",
                  tone: "success",
                  title: "Backup snapshot restored",
                  detail:
                    authorityState == null
                      ? "Restored finance data from a backup package into the current local preview authority."
                      : "Restored authority-backed finance data from a native backup package.",
                  occurredAt: restoredAt,
                  metrics: [
                    ...buildFinanceSnapshotMetrics(financeSnapshot),
                    {
                      label: "Import mode",
                      value: backupPackage.defaults.importMode,
                    },
                    {
                      label: "Duplicate mode",
                      value: backupPackage.defaults.duplicateMode,
                    },
                    {
                      label: "Review window",
                      value: formatMetricValue(
                        backupPackage.defaults.reviewWindowDays,
                      ),
                    },
                  ],
                  templateUsage: [],
                }),
              ),
            };
          });

          return financeSnapshot;
        },
        updateSmsCaptureSettings: (updates) => {
          const state = get();
          const nextSettings = {
            ...state.smsCaptureSettings,
            ...updates,
            senderRules: state.smsCaptureSettings.senderRules,
          };

          set({
            smsCaptureSettings: nextSettings,
          });

          return nextSettings;
        },
        setSmsCaptureBackfillRequest: (
          lookbackDays,
          requestedAt = new Date().toISOString(),
        ) => {
          const nextBackfillRequest = createSmsCaptureBackfillRequest(
            lookbackDays,
            requestedAt,
          );

          set({
            smsCaptureBackfillRequest: nextBackfillRequest,
          });

          return nextBackfillRequest;
        },
        addSmsSenderRule: (senderLabel, createdAt = new Date().toISOString()) => {
          const nextRule = createSmsSenderRule(senderLabel, createdAt);
          const state = get();
          const existingRule = state.smsCaptureSettings.senderRules.find(
            (rule) =>
              rule.normalizedSenderLabel === nextRule.normalizedSenderLabel,
          );
          const senderRules = existingRule
            ? state.smsCaptureSettings.senderRules.map((rule) =>
                rule.ruleId === existingRule.ruleId
                  ? {
                      ...rule,
                      senderLabel: nextRule.senderLabel,
                      normalizedSenderLabel: nextRule.normalizedSenderLabel,
                      isEnabled: true,
                      updatedAt: createdAt,
                    }
                  : rule,
              )
            : [...state.smsCaptureSettings.senderRules, nextRule];
          const createdRule =
            senderRules.find(
              (rule) =>
                rule.normalizedSenderLabel === nextRule.normalizedSenderLabel,
            ) ?? nextRule;

          set({
            smsCaptureSettings: {
              ...state.smsCaptureSettings,
              senderRules,
            },
          });

          return createdRule;
        },
        updateSmsSenderRule: (
          ruleId,
          updates,
          updatedAt = new Date().toISOString(),
        ) => {
          const state = get();
          const existingRule = state.smsCaptureSettings.senderRules.find(
            (rule) => rule.ruleId === ruleId,
          );

          if (!existingRule) {
            return null;
          }

          const nextRule = updateSmsSenderRuleRecord(
            existingRule,
            updates,
            updatedAt,
          );
          const senderRules = state.smsCaptureSettings.senderRules.map((rule) =>
            rule.ruleId === ruleId ? nextRule : rule,
          );

          set({
            smsCaptureSettings: {
              ...state.smsCaptureSettings,
              senderRules,
            },
          });

          return nextRule;
        },
        removeSmsSenderRule: (ruleId) => {
          const state = get();
          const senderRules = state.smsCaptureSettings.senderRules.filter(
            (rule) => rule.ruleId !== ruleId,
          );

          if (senderRules.length === state.smsCaptureSettings.senderRules.length) {
            return false;
          }

          set({
            smsCaptureSettings: {
              ...state.smsCaptureSettings,
              senderRules,
            },
          });

          return true;
        },
        enqueueCapturedSms: (rawSmsMessage, options = {}) => {
          const state = get();
          if (
            !shouldCaptureSmsFromSender(
              rawSmsMessage.senderLabel,
              state.smsCaptureSettings.senderRules,
            )
          ) {
            set({
              smsCaptureDiagnostics: {
                ...state.smsCaptureDiagnostics,
                filteredOutCount:
                  state.smsCaptureDiagnostics.filteredOutCount + 1,
              },
            });

            return {
              status: "filtered_out" as const,
              senderLabel: rawSmsMessage.senderLabel,
            };
          }

          const envelope = createCapturedSmsEnvelope(rawSmsMessage, options);
          const existingItem = findSmsCaptureQueueDuplicate(
            state.smsCaptureQueue,
            envelope,
          );

          if (existingItem) {
            set({
              smsCaptureDiagnostics: {
                ...state.smsCaptureDiagnostics,
                duplicateSuppressedCount:
                  state.smsCaptureDiagnostics.duplicateSuppressedCount + 1,
              },
            });

            return {
              status: "duplicate_suppressed" as const,
              existingItem,
            };
          }

          const queueItem = createSmsCaptureQueueItem(
            envelope,
            state.smsCaptureSettings.autoRouteToParserWhenAppOpen,
          );
          const mergeSnapshot = mergeSmsCaptureQueueItems(state.smsCaptureQueue, [
            queueItem,
          ]);
          const diagnostics = updateLatestCapturedDiagnostics(
            state.smsCaptureDiagnostics,
            [queueItem],
          );

          set({
            hasInitialized: true,
            ...buildSmsCaptureStateSnapshot(mergeSnapshot.queue, diagnostics),
          });

          return {
            status: "queued" as const,
            queueItem,
          };
        },
        mergeNativeSmsCaptureQueueSnapshot: (snapshot) => {
          const state = get();
          const acceptedItems: SmsCaptureQueueItem[] = [];
          let filteredOutCount = 0;

          snapshot.forEach((envelope) => {
            if (
              !shouldCaptureSmsFromSender(
                envelope.senderLabel,
                state.smsCaptureSettings.senderRules,
              )
            ) {
              filteredOutCount += 1;
              return;
            }

            acceptedItems.push(
              createSmsCaptureQueueItem(
                envelope,
                state.smsCaptureSettings.autoRouteToParserWhenAppOpen,
              ),
            );
          });

          const mergeSnapshot = mergeSmsCaptureQueueItems(
            state.smsCaptureQueue,
            acceptedItems,
          );
          const diagnostics = updateLatestCapturedDiagnostics(
            {
              ...state.smsCaptureDiagnostics,
              duplicateSuppressedCount:
                state.smsCaptureDiagnostics.duplicateSuppressedCount +
                mergeSnapshot.mergeResult.duplicateCount,
              filteredOutCount:
                state.smsCaptureDiagnostics.filteredOutCount + filteredOutCount,
            },
            acceptedItems,
          );

          set({
            hasInitialized: true,
            ...buildSmsCaptureStateSnapshot(mergeSnapshot.queue, diagnostics),
          });

          return {
            ...mergeSnapshot.mergeResult,
            filteredOutCount,
          };
        },
        applySmsCaptureRuntimeSnapshot: (snapshot) => {
          const state = get();
          const { acceptedItems, filteredOutCount } =
            collectAcceptedSmsCaptureQueueItems(
              snapshot.queue,
              state.smsCaptureSettings.senderRules,
              state.smsCaptureSettings.autoRouteToParserWhenAppOpen,
            );
          const mergeSnapshot = mergeSmsCaptureQueueItems(
            state.smsCaptureQueue,
            acceptedItems,
          );
          const diagnostics = mergeSmsCaptureRuntimeDiagnostics(
            {
              ...state.smsCaptureDiagnostics,
              duplicateSuppressedCount:
                state.smsCaptureDiagnostics.duplicateSuppressedCount +
                mergeSnapshot.mergeResult.duplicateCount,
              filteredOutCount:
                state.smsCaptureDiagnostics.filteredOutCount + filteredOutCount,
            },
            {
              permissionState: snapshot.diagnostics.permissionState,
              nativeCaptureAvailable: snapshot.diagnostics.nativeCaptureAvailable,
              captureSupported: snapshot.diagnostics.captureSupported,
              historyCaptureSupported:
                snapshot.diagnostics.historyCaptureSupported,
              duplicateSuppressedCount:
                snapshot.diagnostics.duplicateSuppressedCount,
              filteredOutCount: snapshot.diagnostics.filteredOutCount + filteredOutCount,
            },
            acceptedItems,
          );

          set({
            hasInitialized: true,
            smsCaptureSettings: {
              ...state.smsCaptureSettings,
              captureEnabled: snapshot.captureEnabled,
              buildMode: snapshot.buildMode,
            },
            ...buildSmsCaptureStateSnapshot(mergeSnapshot.queue, diagnostics),
          });

          return {
            ...mergeSnapshot.mergeResult,
            filteredOutCount,
          };
        },
        markSmsCaptureQueueItemQueuedForParse: (captureId) => {
          const state = get();
          const queueUpdate = updateSmsCaptureQueueItem(
            state.smsCaptureQueue,
            captureId,
            markSmsCaptureQueueItemQueuedForParse,
          );

          if (!queueUpdate.updatedItem) {
            return null;
          }

          set({
            ...buildSmsCaptureStateSnapshot(
              queueUpdate.queue,
              state.smsCaptureDiagnostics,
            ),
          });

          return queueUpdate.updatedItem;
        },
        markSmsCaptureQueueItemParsed: (
          captureId,
          parserQueueEntryId,
          parsedAt = new Date().toISOString(),
        ) => {
          const state = get();
          const queueUpdate = updateSmsCaptureQueueItem(
            state.smsCaptureQueue,
            captureId,
            (item) =>
              markSmsCaptureQueueItemParsed(
                item,
                parserQueueEntryId,
                parsedAt,
              ),
          );

          if (!queueUpdate.updatedItem) {
            return null;
          }

          set({
            ...buildSmsCaptureStateSnapshot(queueUpdate.queue, {
              ...state.smsCaptureDiagnostics,
              lastParserHandoffAt: parsedAt,
              lastParserOutcome: "queued",
              lastFailureReason: null,
            }),
          });

          return queueUpdate.updatedItem;
        },
        markSmsCaptureQueueItemUnmatched: (
          captureId,
          unmatchedEntryId,
          failureReason,
          parsedAt = new Date().toISOString(),
        ) => {
          const state = get();
          const queueUpdate = updateSmsCaptureQueueItem(
            state.smsCaptureQueue,
            captureId,
            (item) =>
              markSmsCaptureQueueItemUnmatched(
                item,
                unmatchedEntryId,
                parsedAt,
                failureReason,
              ),
          );

          if (!queueUpdate.updatedItem) {
            return null;
          }

          set({
            ...buildSmsCaptureStateSnapshot(queueUpdate.queue, {
              ...state.smsCaptureDiagnostics,
              lastParserHandoffAt: parsedAt,
              lastParserOutcome: "unmatched",
              lastFailureReason: failureReason,
            }),
          });

          return queueUpdate.updatedItem;
        },
        markSmsCaptureQueueItemFailed: (
          captureId,
          failureReason,
          failedAt = new Date().toISOString(),
        ) => {
          const state = get();
          const queueUpdate = updateSmsCaptureQueueItem(
            state.smsCaptureQueue,
            captureId,
            (item) =>
              markSmsCaptureQueueItemFailed(item, failureReason, failedAt),
          );

          if (!queueUpdate.updatedItem) {
            return null;
          }

          set({
            ...buildSmsCaptureStateSnapshot(queueUpdate.queue, {
              ...state.smsCaptureDiagnostics,
              lastParserOutcome: "failed",
              lastFailureReason: failureReason,
            }),
          });

          return queueUpdate.updatedItem;
        },
        processNextSmsCaptureQueueItem: (options = {}) => {
          const processedAt = options.processedAt ?? new Date().toISOString();
          const state = get();
          const nextQueueItem =
            state.smsCaptureQueue.find(
              (item) => item.status === "queued_for_parse",
            ) ?? null;

          if (!nextQueueItem) {
            return null;
          }

          const parsingUpdate = updateSmsCaptureQueueItem(
            state.smsCaptureQueue,
            nextQueueItem.captureId,
            markSmsCaptureQueueItemParsing,
          );

          if (!parsingUpdate.updatedItem) {
            return null;
          }

          set({
            ...buildSmsCaptureStateSnapshot(
              parsingUpdate.queue,
              state.smsCaptureDiagnostics,
            ),
          });

          const rawSmsMessage: RawSmsMessage = {
            messageId: parsingUpdate.updatedItem.messageId,
            senderLabel: parsingUpdate.updatedItem.senderLabel,
            smsBody: parsingUpdate.updatedItem.smsBody,
            receivedAt: parsingUpdate.updatedItem.receivedAt,
          };

          try {
            const parseResult = parseSmsMessage(rawSmsMessage, options.runtime);

            if (parseResult.status === "matched") {
              const queueEntry = get().queueParsedTransaction(
                parseResult.draft,
                processedAt,
              );
              const queueItem = get().markSmsCaptureQueueItemParsed(
                parsingUpdate.updatedItem.captureId,
                queueEntry.queueEntryId,
                processedAt,
              );

              if (!queueItem) {
                return null;
              }

              return {
                status: "queued" as const,
                queueItem,
                parserQueueEntryId: queueEntry.queueEntryId,
              };
            }

            const unmatchedEntry = get().captureUnmatchedSms(
              rawSmsMessage,
              parseResult,
              processedAt,
            );
            const queueItem = get().markSmsCaptureQueueItemUnmatched(
              parsingUpdate.updatedItem.captureId,
              unmatchedEntry.unmatchedEntryId,
              parseResult.failureReason,
              processedAt,
            );

            if (!queueItem) {
              return null;
            }

            return {
              status: "unmatched" as const,
              queueItem,
              unmatchedEntryId: unmatchedEntry.unmatchedEntryId,
            };
          } catch (error) {
            const failureReason =
              error instanceof Error ? error.message : "Unknown parser failure";
            const queueItem = get().markSmsCaptureQueueItemFailed(
              parsingUpdate.updatedItem.captureId,
              failureReason,
              processedAt,
            );

            if (!queueItem) {
              return null;
            }

            return {
              status: "failed" as const,
              queueItem,
              failureReason,
            };
          }
        },
        createCustomAccount: (input, createdAt = new Date().toISOString()) => {
          const customAccount = createCustomAccountRecord(input, createdAt);

          set((state) => ({
            hasInitialized: true,
            customAccounts: [
              customAccount,
              ...state.customAccounts.filter(
                (account) => account.accountId !== customAccount.accountId,
              ),
            ],
          }));

          return customAccount;
        },
        updateCustomAccount: (accountId, updates, updatedAt = new Date().toISOString()) => {
          const existingAccount = get().customAccounts.find(
            (account) => account.accountId === accountId,
          );

          if (!existingAccount) {
            return null;
          }

          const updatedAccount = updateCustomAccountRecord(
            existingAccount,
            updates,
            updatedAt,
          );

          set((state) => ({
            customAccounts: state.customAccounts.map((account) =>
              account.accountId === accountId ? updatedAccount : account,
            ),
          }));

          return updatedAccount;
        },
        setAccountHidden: (accountId, isHidden, updatedAt = new Date().toISOString()) => {
          const state = get();
          const accountExists =
            state.accountSummaries.some((account) => account.accountId === accountId) ||
            state.customAccounts.some((account) => account.accountId === accountId);

          if (!accountExists) {
            return null;
          }

          const accountVisibilityOverrides = upsertAccountVisibilityOverride(
            state.accountVisibilityOverrides,
            accountId,
            isHidden,
            updatedAt,
          );
          const updatedOverride =
            accountVisibilityOverrides.find(
              (override) => override.accountId === accountId,
            ) ?? null;

          set({
            accountVisibilityOverrides,
          });

          return updatedOverride;
        },
        toggleSyncEnabled: () => {
          set((state) => {
            const syncEnabled = !state.syncEnabled;
            const syncDiscoveryState: SyncDiscoveryState = syncEnabled
              ? state.syncMode === "automatic"
                ? "searching"
                : "paused"
              : "paused";
            const syncActivity = prependSyncActivity(state.syncActivity, {
              activityId: `sync-toggle-${Date.now()}`,
              type: "trust",
              status: syncEnabled ? "success" : "warning",
              title: syncEnabled ? "Mobile sync enabled" : "Mobile sync paused",
              detail: syncEnabled
                ? "Nearby discovery and trusted device routing are active again."
                : "Automatic discovery and manual handoff are paused on this phone.",
              occurredAt: new Date().toISOString(),
            });

            return {
              syncEnabled,
              syncDiscoveryState,
              syncActivity,
              syncStatusSummary: buildSyncStatusSummary({
                syncEnabled,
                syncMode: state.syncMode,
                syncDiscoveryState,
                nearbySyncDevices: state.nearbySyncDevices,
                trustedSyncDevices: state.trustedSyncDevices,
                syncActivity,
              }),
            };
          });
        },
        setSyncMode: (mode) => {
          set((state) => {
            const trustedSyncDevices = state.trustedSyncDevices.map((device) => ({
              ...device,
              autoSyncEnabled: mode === "automatic",
            }));
            const syncDiscoveryState: SyncDiscoveryState =
              state.syncEnabled && mode === "automatic"
                ? state.syncDiscoveryState === "paused"
                  ? "searching"
                  : state.syncDiscoveryState
                : "paused";
            const syncActivity = prependSyncActivity(state.syncActivity, {
              activityId: `sync-mode-${mode}-${Date.now()}`,
              type: "sync",
              status: "success",
              title:
                mode === "automatic"
                  ? "Automatic sync mode armed"
                  : "Manual sync mode selected",
              detail:
                mode === "automatic"
                  ? "Trusted devices can sync in the background when discovery sees them."
                  : "Sync will only run when triggered manually from this phone.",
              occurredAt: new Date().toISOString(),
            });

            return {
              syncMode: mode,
              trustedSyncDevices,
              syncDiscoveryState,
              syncActivity,
              syncStatusSummary: buildSyncStatusSummary({
                syncEnabled: state.syncEnabled,
                syncMode: mode,
                syncDiscoveryState,
                nearbySyncDevices: state.nearbySyncDevices,
                trustedSyncDevices,
                syncActivity,
              }),
            };
          });
        },
        startSyncDiscovery: () => {
          set((state) => {
            if (!state.syncEnabled) {
              return state;
            }

            const syncDiscoveryState: SyncDiscoveryState = "searching";
            const syncActivity = prependSyncActivity(state.syncActivity, {
              activityId: `sync-discovery-start-${Date.now()}`,
              type: "discovery",
              status: "pending",
              title: "Nearby scan active",
              detail: "Listening for desktop review routes on the same network.",
              occurredAt: new Date().toISOString(),
            });

            return {
              syncDiscoveryState,
              syncActivity,
              syncStatusSummary: buildSyncStatusSummary({
                syncEnabled: state.syncEnabled,
                syncMode: state.syncMode,
                syncDiscoveryState,
                nearbySyncDevices: state.nearbySyncDevices,
                trustedSyncDevices: state.trustedSyncDevices,
                syncActivity,
              }),
            };
          });
        },
        stopSyncDiscovery: () => {
          set((state) => {
            const syncDiscoveryState: SyncDiscoveryState = "paused";
            const syncActivity = prependSyncActivity(state.syncActivity, {
              activityId: `sync-discovery-stop-${Date.now()}`,
              type: "discovery",
              status: "warning",
              title: "Nearby scan paused",
              detail: "The phone stopped looking for local desktop authorities until discovery resumes.",
              occurredAt: new Date().toISOString(),
            });

            return {
              syncDiscoveryState,
              syncActivity,
              syncStatusSummary: buildSyncStatusSummary({
                syncEnabled: state.syncEnabled,
                syncMode: state.syncMode,
                syncDiscoveryState,
                nearbySyncDevices: state.nearbySyncDevices,
                trustedSyncDevices: state.trustedSyncDevices,
                syncActivity,
              }),
            };
          });
        },
        setParserWorkspaceAuthorityState: (parserWorkspaceAuthorityState) => {
          const nextState = cloneParserWorkspaceAuthorityState(
            parserWorkspaceAuthorityState,
          );
          set({
            hasInitialized: true,
            parserWorkspaceAuthorityState: nextState,
          });
          return nextState;
        },
        clearParserWorkspaceAuthorityState: () => {
          set({ parserWorkspaceAuthorityState: null });
        },
        setSecurityPreferences: (securityPreferences) => {
          const nextState = cloneSecurityPreferences(securityPreferences);
          set({ securityPreferences: nextState });
          return nextState;
        },
        clearSecurityPreferences: () => {
          set({ securityPreferences: null });
        },
        updatePairingCodeInput: (value) => {
          set((state) => ({
            pairingCodeState: {
              ...state.pairingCodeState,
              pendingCodeInput: value.replace(/\D/g, "").slice(0, 6),
              errorMessage: null,
            },
          }));
        },
        pairNearbyDevice: (deviceId, pairedAt = new Date().toISOString()) => {
          const state = get();
          const nearbyDevice = state.nearbySyncDevices.find(
            (device) => device.deviceId === deviceId,
          );

          if (!nearbyDevice) {
            return null;
          }

          const isPrimary =
            !state.trustedSyncDevices.some((device) => device.isPrimary);
          const trustedDevice = buildTrustedDeviceFromNearby(
            nearbyDevice,
            pairedAt,
            isPrimary,
            state.syncMode,
          );
          const trustedSyncDevices = [
            ...state.trustedSyncDevices.filter(
              (device) => device.deviceId !== trustedDevice.deviceId,
            ),
            trustedDevice,
          ];
          const nearbySyncDevices = state.nearbySyncDevices.filter(
            (device) => device.deviceId !== deviceId,
          );
          const syncActivity = prependSyncActivity(state.syncActivity, {
            activityId: `sync-pair-nearby-${deviceId}-${pairedAt}`,
            type: "pairing",
            status: "success",
            title: `${nearbyDevice.displayName} trusted`,
            detail: `${formatPlatformLabel(
              nearbyDevice.platform,
            )} device moved from nearby discovery into the trusted sync route.`,
            occurredAt: pairedAt,
          });

          set({
            nearbySyncDevices,
            trustedSyncDevices,
            syncActivity,
            syncStatusSummary: buildSyncStatusSummary({
              syncEnabled: state.syncEnabled,
              syncMode: state.syncMode,
              syncDiscoveryState: state.syncDiscoveryState,
              nearbySyncDevices,
              trustedSyncDevices,
              syncActivity,
            }),
          });

          return trustedDevice;
        },
        submitPairingCode: (submittedAt = new Date().toISOString()) => {
          const state = get();
          const submittedCode = state.pairingCodeState.pendingCodeInput;
          const expiresAt = new Date(state.pairingCodeState.expiresAt).getTime();

          if (submittedCode.length !== 6) {
            set({
              pairingCodeState: {
                ...state.pairingCodeState,
                errorMessage: "Enter a full 6-digit pairing code.",
              },
            });
            return null;
          }

          if (Number.isFinite(expiresAt) && expiresAt <= new Date(submittedAt).getTime()) {
            set({
              pairingCodeState: {
                ...state.pairingCodeState,
                lastSubmittedCode: submittedCode,
                errorMessage: "That pairing code expired. Generate a fresh code from the source device.",
              },
              syncActivity: prependSyncActivity(state.syncActivity, {
                activityId: `sync-pair-code-expired-${submittedCode}-${submittedAt}`,
                type: "pairing",
                status: "warning",
                title: "Pairing code expired",
                detail: "The submitted 6-digit code was already outside its active pairing window.",
                occurredAt: submittedAt,
              }),
            });
            return null;
          }

          const nearbyMatch = state.nearbySyncDevices.find(
            (device) => device.pairingCodeHint === submittedCode,
          );

          if (nearbyMatch) {
            const trustedDevice = get().pairNearbyDevice(
              nearbyMatch.deviceId,
              submittedAt,
            );

            set((currentState) => ({
              pairingCodeState: {
                ...currentState.pairingCodeState,
                pendingCodeInput: "",
                lastSubmittedCode: submittedCode,
                errorMessage: null,
              },
            }));

            return trustedDevice;
          }

          if (submittedCode !== state.pairingCodeState.generatedCode) {
            set({
              pairingCodeState: {
                ...state.pairingCodeState,
                lastSubmittedCode: submittedCode,
                errorMessage: "That code is not available on this device yet.",
              },
              syncActivity: prependSyncActivity(state.syncActivity, {
                activityId: `sync-pair-code-failed-${submittedCode}-${submittedAt}`,
                type: "pairing",
                status: "warning",
                title: "Pairing code rejected",
                detail: "The submitted 6-digit code did not match a nearby device or this phone's generated handoff code.",
                occurredAt: submittedAt,
              }),
            });
            return null;
          }

          const trustedDevice = createCodePairedDevice(
            submittedCode,
            submittedAt,
            !state.trustedSyncDevices.some((device) => device.isPrimary),
            state.syncMode,
          );
          const trustedSyncDevices = [
            ...state.trustedSyncDevices.filter(
              (device) => device.deviceId !== trustedDevice.deviceId,
            ),
            trustedDevice,
          ];
          const syncActivity = prependSyncActivity(state.syncActivity, {
            activityId: `sync-pair-code-${submittedCode}-${submittedAt}`,
            type: "pairing",
            status: "success",
            title: "Local preview route established",
            detail: `${trustedDevice.displayName} is available in this build as a local trusted preview route.`,
            occurredAt: submittedAt,
          });

          set({
            trustedSyncDevices,
            syncActivity,
            pairingCodeState: {
              generatedCode: state.pairingCodeState.generatedCode,
              expiresAt: state.pairingCodeState.expiresAt,
              pendingCodeInput: "",
              lastSubmittedCode: submittedCode,
              errorMessage: null,
            },
            syncStatusSummary: buildSyncStatusSummary({
              syncEnabled: state.syncEnabled,
              syncMode: state.syncMode,
              syncDiscoveryState: state.syncDiscoveryState,
              nearbySyncDevices: state.nearbySyncDevices,
              trustedSyncDevices,
              syncActivity,
            }),
          });

          return trustedDevice;
        },
        markTrustedDeviceAsPrimary: (deviceId) => {
          set((state) => {
            const trustedSyncDevices = state.trustedSyncDevices.map((device) => ({
              ...device,
              isPrimary: device.deviceId === deviceId,
            }));
            const promotedDevice = trustedSyncDevices.find(
              (device) => device.deviceId === deviceId,
            );
            const syncActivity = prependSyncActivity(state.syncActivity, {
              activityId: `sync-primary-${deviceId}-${Date.now()}`,
              type: "trust",
              status: "success",
              title: promotedDevice
                ? `${promotedDevice.displayName} set as primary`
                : "Primary sync route updated",
              detail: "Automatic and manual sync flows will prefer this route first.",
              occurredAt: new Date().toISOString(),
            });

            return {
              trustedSyncDevices,
              syncActivity,
              syncStatusSummary: buildSyncStatusSummary({
                syncEnabled: state.syncEnabled,
                syncMode: state.syncMode,
                syncDiscoveryState: state.syncDiscoveryState,
                nearbySyncDevices: state.nearbySyncDevices,
                trustedSyncDevices,
                syncActivity,
              }),
            };
          });
        },
        removeTrustedDevice: (deviceId) => {
          set((state) => {
            const removedDevice = state.trustedSyncDevices.find(
              (device) => device.deviceId === deviceId,
            );
            let trustedSyncDevices = state.trustedSyncDevices.filter(
              (device) => device.deviceId !== deviceId,
            );

            if (
              removedDevice?.isPrimary &&
              trustedSyncDevices.length > 0 &&
              !trustedSyncDevices.some((device) => device.isPrimary)
            ) {
              trustedSyncDevices = trustedSyncDevices.map((device, index) => ({
                ...device,
                isPrimary: index === 0,
              }));
            }

            const syncActivity = prependSyncActivity(state.syncActivity, {
              activityId: `sync-remove-${deviceId}-${Date.now()}`,
              type: "trust",
              status: "warning",
              title: removedDevice
                ? `${removedDevice.displayName} removed`
                : "Trusted device removed",
              detail: "The device is no longer available for automatic or manual sync from this phone.",
              occurredAt: new Date().toISOString(),
            });

            return {
              trustedSyncDevices,
              syncActivity,
              syncStatusSummary: buildSyncStatusSummary({
                syncEnabled: state.syncEnabled,
                syncMode: state.syncMode,
                syncDiscoveryState: state.syncDiscoveryState,
                nearbySyncDevices: state.nearbySyncDevices,
                trustedSyncDevices,
                syncActivity,
              }),
            };
          });
        },
        triggerManualSync: (triggeredAt = new Date().toISOString()) => {
          set((state) => {
            if (!state.syncEnabled) {
              const syncActivity = prependSyncActivity(state.syncActivity, {
                activityId: `sync-manual-blocked-${triggeredAt}`,
                type: "sync",
                status: "warning",
                title: "Manual sync blocked",
                detail: "Turn sync back on before requesting a manual handoff.",
                occurredAt: triggeredAt,
              });

              return {
                syncActivity,
                syncStatusSummary: buildSyncStatusSummary({
                  syncEnabled: state.syncEnabled,
                  syncMode: state.syncMode,
                  syncDiscoveryState: state.syncDiscoveryState,
                  nearbySyncDevices: state.nearbySyncDevices,
                  trustedSyncDevices: state.trustedSyncDevices,
                  syncActivity,
                }),
              };
            }

            if (state.trustedSyncDevices.length === 0) {
              const syncActivity = prependSyncActivity(state.syncActivity, {
                activityId: `sync-manual-no-target-${triggeredAt}`,
                type: "sync",
                status: "warning",
                title: "No trusted device available",
                detail: "Pair a nearby desktop or submit a 6-digit code before running manual sync.",
                occurredAt: triggeredAt,
              });

              return {
                syncActivity,
                syncStatusSummary: buildSyncStatusSummary({
                  syncEnabled: state.syncEnabled,
                  syncMode: state.syncMode,
                  syncDiscoveryState: state.syncDiscoveryState,
                  nearbySyncDevices: state.nearbySyncDevices,
                  trustedSyncDevices: state.trustedSyncDevices,
                  syncActivity,
                }),
              };
            }

            const primaryDevice =
              state.trustedSyncDevices.find((device) => device.isPrimary) ??
              state.trustedSyncDevices[0];
            const trustedSyncDevices: TrustedSyncDevice[] =
              state.trustedSyncDevices.map((device) =>
                device.deviceId === primaryDevice?.deviceId
                  ? {
                      ...device,
                      lastSyncedAt: triggeredAt,
                      health: "healthy" as const,
                    }
                  : device,
              );
            const syncActivity = prependSyncActivity(state.syncActivity, {
              activityId: `sync-manual-success-${triggeredAt}`,
              type: "sync",
              status: "success",
              title: "Manual sync completed",
              detail: primaryDevice
                ? `Approved finance data prepared for ${primaryDevice.displayName}.`
                : "Approved finance data prepared for the trusted route.",
              occurredAt: triggeredAt,
            });

            return {
              trustedSyncDevices,
              syncActivity,
              syncStatusSummary: buildSyncStatusSummary({
                syncEnabled: state.syncEnabled,
                syncMode: state.syncMode,
                syncDiscoveryState: state.syncDiscoveryState,
                nearbySyncDevices: state.nearbySyncDevices,
                trustedSyncDevices,
                syncActivity,
              }),
            };
          });
        },
        openTransactionEditor: (queueEntryId) => {
          set({ activeQueueEntryId: queueEntryId, activeApprovedTransactionId: null });
        },
        openApprovedTransactionEditor: (transactionId) => {
          set({ activeApprovedTransactionId: transactionId, activeQueueEntryId: null });
        },
        closeTransactionEditor: () => {
          set({ activeQueueEntryId: null, activeApprovedTransactionId: null });
        },
        editApprovalQueueItem: (queueEntryId, updates) => {
          const normalizedUpdates = normalizeTransactionReviewUpdates(updates);
          set((state) => ({
            approvalQueue: state.approvalQueue.map((queueItem) =>
              queueItem.queueEntryId === queueEntryId
                ? { ...queueItem, ...normalizedUpdates }
                : queueItem,
            ),
          }));
        },
        editApprovedTransaction: (transactionId, updates) => {
          const normalizedUpdates = normalizeTransactionReviewUpdates(updates);
          set((state) => {
            const approvedTransactions = state.approvedTransactions.map((transaction) =>
              transaction.transactionId === transactionId
                ? { ...transaction, ...normalizedUpdates }
                : transaction,
            );

            return {
              approvedTransactions,
              budgetSummaries: buildBudgetSummaries(approvedTransactions),
            };
          });
        },
        approveQueueItem: (queueEntryId, approvedAt = new Date().toISOString()) => {
          const state = get();
          const queueItem = state.approvalQueue.find(
            (candidate) => candidate.queueEntryId === queueEntryId,
          );

          if (!queueItem) {
            return null;
          }

          const approvedTransaction: ApprovedTransaction = {
            ...queueItem,
            transactionId: `tx-${queueItem.queueEntryId}`,
            approvedAt,
            approvalStatus: "approved",
          };

          const approvedTransactions = [
            approvedTransaction,
            ...state.approvedTransactions,
          ];

          set({
            approvalQueue: state.approvalQueue.filter(
              (candidate) => candidate.queueEntryId !== queueEntryId,
            ),
            approvedTransactions,
            accountSummaries: syncAccountSummariesWithDraft(
              state.accountSummaries,
              approvedTransaction,
            ),
            budgetSummaries: buildBudgetSummaries(approvedTransactions),
            activeQueueEntryId: null,
            activeApprovedTransactionId: null,
          });

          return approvedTransaction;
        },
        rejectQueueItem: (queueEntryId) => {
          set((state) => ({
            approvalQueue: state.approvalQueue.filter(
              (queueItem) => queueItem.queueEntryId !== queueEntryId,
            ),
            activeQueueEntryId:
              state.activeQueueEntryId === queueEntryId
                ? null
                : state.activeQueueEntryId,
            activeApprovedTransactionId: state.activeApprovedTransactionId,
          }));
        },
        dismissUnmatchedSms: (unmatchedEntryId) => {
          set((state) => ({
            unmatchedMessages: state.unmatchedMessages.filter(
              (message) => message.unmatchedEntryId !== unmatchedEntryId,
            ),
          }));
        },
        clearAllData: (clearedAt = new Date().toISOString()) => {
          const financeSnapshot = buildFinanceSnapshotFromState(get());
          const smsCaptureSettings = createDefaultSmsCaptureSettings();
          const smsCaptureQueue: SmsCaptureQueueItem[] = [];
          const smsCaptureDiagnostics = createDefaultSmsCaptureDiagnostics();
          const smsCaptureBackfillRequest =
            createDefaultSmsCaptureBackfillRequest();

          set((state) => ({
            hasInitialized: true,
            approvalQueue: [],
            approvedTransactions: [],
            unmatchedMessages: [],
            smsCaptureSettings,
            smsCaptureQueue,
            smsCaptureQueueSummary: buildSmsCaptureQueueSummary(smsCaptureQueue),
            smsCaptureDiagnostics,
            smsCaptureBackfillRequest,
            accountSummaries: [],
            customAccounts: [],
            accountVisibilityOverrides: [],
            budgetSummaries: [],
            syncEnabled: false,
            syncMode: "manual",
            syncDiscoveryState: "paused",
            syncStatusSummary: buildSyncStatusSummary({
              syncEnabled: false,
              syncMode: "manual",
              syncDiscoveryState: "paused",
              nearbySyncDevices: [],
              trustedSyncDevices: [],
              syncActivity: [],
            }),
            nearbySyncDevices: [],
            trustedSyncDevices: [],
            syncActivity: [],
            systemLogs: prependSystemLog(
              state.systemLogs,
              createSystemLogEntry({
                eventKind: "clear_local_data",
                tone: "warning",
                title: "Local finance data cleared",
                detail:
                  "Removed local preview finance data while keeping the operational log trail available.",
                occurredAt: clearedAt,
                metrics: buildFinanceSnapshotMetrics(financeSnapshot),
                templateUsage: [],
              }),
            ),
            pairingCodeState: {
              generatedCode: "284913",
              expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
              pendingCodeInput: "",
              lastSubmittedCode: null,
              errorMessage: null,
            },
            parserWorkspaceAuthorityState: null,
            activeQueueEntryId: null,
            activeApprovedTransactionId: null,
          }));
        },
      }),
      {
        name: options.persistName ?? "omni-sync-storage",
        storage: resolvePersistStorage(options),
        partialize: (state) => buildPersistedTransactionStoreStateFromState(state),
        merge: (persistedState, currentState) =>
          mergePersistedTransactionStoreState(persistedState, currentState),
      },
    ),
  );

  if (transactionStoreApi.persist.hasHydrated()) {
    transactionStoreApi.setState({ hasHydrated: true });
  } else {
    const unsubscribe = transactionStoreApi.persist.onFinishHydration(() => {
      transactionStoreApi.setState({ hasHydrated: true });
      unsubscribe();
    });
  }

  return transactionStoreApi;
}

let configuredTransactionStoreOptions: TransactionStoreOptions = {};
let singletonTransactionStore: TransactionStoreApi | null = null;

function getTransactionStore(): TransactionStoreApi {
  if (!singletonTransactionStore) {
    singletonTransactionStore = createTransactionStore(
      configuredTransactionStoreOptions,
    );
  }

  return singletonTransactionStore;
}

export function configureTransactionStore(
  options: TransactionStoreOptions,
): void {
  if (singletonTransactionStore) {
    throw new Error(
      "configureTransactionStore must run before the singleton transaction store is used.",
    );
  }

  configuredTransactionStoreOptions = {
    ...configuredTransactionStoreOptions,
    ...options,
  };
}

const transactionStore = new Proxy({} as TransactionStoreApi, {
  get(_target, property, receiver) {
    const store = getTransactionStore();
    const value = Reflect.get(store as object, property, receiver);
    return typeof value === "function" ? value.bind(store) : value;
  },
}) as TransactionStoreApi;

export function useTransactionStore<T>(
  selector: (state: TransactionStoreState) => T,
): T {
  return useStore(getTransactionStore(), selector);
}

export { selectManagedAccounts, selectVisibleManagedAccounts };
export { transactionStore };
