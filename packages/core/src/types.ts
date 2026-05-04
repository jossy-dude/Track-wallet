export const TRANSACTION_CATEGORIES = [
  "food",
  "transport",
  "housing",
  "income",
  "entertainment",
  "misc",
] as const;

export type TransactionCategory = (typeof TRANSACTION_CATEGORIES)[number];

export const TRANSACTION_CATEGORY_LABELS: Record<TransactionCategory, string> = {
  food: "Food",
  transport: "Transport",
  housing: "Housing",
  income: "Income",
  entertainment: "Entertainment",
  misc: "Misc",
};

export const FINANCIAL_INSTITUTIONS = [
  "cbe",
  "boa",
  "telebirr",
  "cbebirr",
  "dashen",
  "bunna",
  "unknown",
] as const;

export type FinancialInstitution = (typeof FINANCIAL_INSTITUTIONS)[number];

export const FINANCIAL_INSTITUTION_LABELS: Record<FinancialInstitution, string> = {
  cbe: "CBE",
  boa: "BOA",
  telebirr: "Telebirr",
  cbebirr: "CBEBirr",
  dashen: "Dashen Bank",
  bunna: "Bunna Bank",
  unknown: "Unknown",
};

export type TransactionDirection = "credit" | "debit" | "transfer";
export type AccountChannel = "bank" | "mobile_money" | "cash";
export type UiTone = "primary" | "tertiary" | "secondary" | "surface";
export type AuthorityMode = "real" | "demo";
export type AuthorityRuntime = "web" | "memory" | "native_mobile";

export interface SecurityPreferences {
  biometricsEnabled: boolean;
  requireBiometricOnOpen: boolean;
  requireBiometricOnApprove: boolean;
  requireBiometricOnDelete: boolean;
  requireBiometricOnForwarding: boolean;
  twoFactorEnabled: boolean;
}

export const DEFAULT_SECURITY_PREFERENCES: SecurityPreferences = {
  biometricsEnabled: true,
  requireBiometricOnOpen: true,
  requireBiometricOnApprove: true,
  requireBiometricOnDelete: true,
  requireBiometricOnForwarding: false,
  twoFactorEnabled: true,
};

export type StorageBootstrapState =
  | "idle"
  | "hydrating"
  | "importing_legacy"
  | "ready"
  | "failed";
export type SyncMode = "automatic" | "manual";
export type SyncDiscoveryState = "searching" | "paused";
export type SyncStatusTone = "ready" | "active" | "attention" | "offline";
export type SyncDevicePlatform = "desktop" | "mobile" | "tablet";
export type TrustedDeviceSyncHealth = "healthy" | "attention" | "stale";
export type SyncActivityType = "discovery" | "pairing" | "sync" | "trust";
export type SyncActivityStatus = "success" | "pending" | "warning";
export type ReconciliationStatus = "pending" | "resolved" | "ignored";
export type ReconciliationResolutionKind =
  | "interest"
  | "bank_fee"
  | "vat_or_tax"
  | "balance_correction"
  | "missing_history"
  | "unclassified";
export type HistoricalImportMode = "merge" | "replace" | "backup_then_replace";
export type HistoricalImportDuplicateMode = "skip" | "review";
export type SmsCaptureBuildMode = "manual_only" | "native_capture";
export type SmsCapturePermissionState =
  | "unknown"
  | "prompt"
  | "granted"
  | "denied"
  | "unavailable";
export type SmsCaptureRuntimeStatus =
  | "manual_only"
  | "permission_required"
  | "blocked"
  | "native_available"
  | "capturing";
export type SmsCaptureSource =
  | "android_sms_receiver"
  | "manual_debug"
  | "forwarded"
  | "history_import";
export type SmsSenderRuleMatchMode = "exact";
export type SmsCaptureBackfillCapability =
  | "unsupported"
  | "native_follow_up_required"
  | "available";
export type SmsCaptureBackfillRequestStatus = "idle" | "requested";
export type SmsCaptureStatus =
  | "captured"
  | "queued_for_parse"
  | "parsing"
  | "parsed"
  | "unmatched"
  | "failed";
export type SmsCaptureLastParserOutcome =
  | "queued"
  | "unmatched"
  | "failed"
  | "idle";

export interface RawSmsMessage {
  messageId: string;
  senderLabel: string;
  smsBody: string;
  receivedAt: string;
}

export interface SmsSenderRule {
  ruleId: string;
  senderLabel: string;
  normalizedSenderLabel: string;
  matchMode: SmsSenderRuleMatchMode;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SmsCaptureSettings {
  captureEnabled: boolean;
  buildMode: SmsCaptureBuildMode;
  autoRouteToParserWhenAppOpen: boolean;
  preserveRawSmsUntilReviewed: boolean;
  retentionDays: number;
  senderRules: SmsSenderRule[];
}

export interface CapturedSmsEnvelope {
  captureId: string;
  messageId: string;
  senderLabel: string;
  smsBody: string;
  receivedAt: string;
  capturedAt: string;
  source: SmsCaptureSource;
  hash: string;
  subscriptionId?: string;
  subscriptionSlot?: number;
}

export interface SmsCaptureQueueItem extends CapturedSmsEnvelope {
  status: SmsCaptureStatus;
  parseAttemptCount: number;
  parsedAt?: string;
  failedAt?: string;
  parserQueueEntryId?: string;
  unmatchedEntryId?: string;
  failureReason?: string;
}

export interface SmsCaptureQueueSummary {
  pendingCount: number;
  parsingCount: number;
  parsedCount: number;
  unmatchedCount: number;
  failedCount: number;
  lastCapturedAt: string | null;
  lastProcessedAt: string | null;
}

export interface SmsCaptureDiagnostics {
  permissionState: SmsCapturePermissionState;
  nativeCaptureAvailable: boolean;
  captureSupported: boolean;
  historyCaptureSupported?: boolean;
  duplicateSuppressedCount: number;
  filteredOutCount: number;
  lastCapturedAt: string | null;
  lastCapturedSenderLabel: string | null;
  lastParserHandoffAt: string | null;
  lastParserOutcome: SmsCaptureLastParserOutcome;
  lastFailureReason: string | null;
}

export interface SmsCaptureBackfillRequest {
  lookbackDays: number | null;
  status: SmsCaptureBackfillRequestStatus;
  requestedAt: string | null;
}

export interface SmsCaptureRuntimeSnapshot {
  captureEnabled: boolean;
  buildMode: SmsCaptureBuildMode;
  queue: SmsCaptureQueueItem[];
  diagnostics: SmsCaptureDiagnostics;
}

export interface SmsCaptureRoutingSummary {
  runtimeStatus: SmsCaptureRuntimeStatus;
  captureEnabled: boolean;
  buildMode: SmsCaptureBuildMode;
  permissionState: SmsCapturePermissionState;
  nativeCaptureAvailable: boolean;
  captureSupported: boolean;
  historyCaptureSupported: boolean;
  exactSenderRuleCount: number;
  enabledSenderRuleCount: number;
  disabledSenderRuleCount: number;
  hasSenderRules: boolean;
  queueItemCount: number;
  pendingCount: number;
  parsingCount: number;
  parsedCount: number;
  unmatchedCount: number;
  failedCount: number;
  oldestPendingCaptureId: string | null;
  oldestPendingCapturedAt: string | null;
  lastCapturedAt: string | null;
  lastCapturedSenderLabel: string | null;
  lastParsedAt: string | null;
  lastUnmatchedAt: string | null;
  lastFailedAt: string | null;
  lastFailedReason: string | null;
  lastParserHandoffAt: string | null;
  duplicateSuppressedCount: number;
  filteredOutCount: number;
  backfillCapability: SmsCaptureBackfillCapability;
  backfillRequestedLookbackDays: number | null;
  backfillRequestStatus: SmsCaptureBackfillRequestStatus;
  backfillRequestedAt: string | null;
}

export interface SmsCaptureEnqueueOptions {
  capturedAt?: string;
  source?: SmsCaptureSource;
  subscriptionId?: string;
  subscriptionSlot?: number;
}

export type SmsCaptureEnqueueResult =
  | {
      status: "queued";
      queueItem: SmsCaptureQueueItem;
    }
  | {
      status: "filtered_out";
      senderLabel: string;
    }
  | {
      status: "duplicate_suppressed";
      existingItem: SmsCaptureQueueItem;
    };

export interface SmsCaptureQueueMergeResult {
  addedCount: number;
  duplicateCount: number;
  filteredOutCount: number;
}

export type SmsCaptureProcessResult =
  | {
      status: "queued";
      queueItem: SmsCaptureQueueItem;
      parserQueueEntryId: string;
    }
  | {
      status: "unmatched";
      queueItem: SmsCaptureQueueItem;
      unmatchedEntryId: string;
    }
  | {
      status: "failed";
      queueItem: SmsCaptureQueueItem;
      failureReason: string;
    };

export interface ParsedTransactionDraft {
  draftId: string;
  rawMessageId: string;
  senderLabel: string;
  rawBody: string;
  financialInstitution: FinancialInstitution;
  transactionDirection: TransactionDirection;
  amountMinor: number;
  feeMinor: number;
  runningBalanceMinor: number;
  reportedBalanceMinor?: number;
  currencyCode: "ETB";
  title: string;
  merchantName: string;
  category: TransactionCategory;
  parserTemplateId: string;
  confidence: number;
  occurredAt: string;
  accountReference?: string;
  reference?: string;
  accountChannel: AccountChannel;
  note?: string;
}

export type ParserTemplateStatus =
  | "active"
  | "draft"
  | "fallback"
  | "disabled";

export type ParserTemplateDateMode = "message_date" | "captured_at";

export interface ParserTemplateUserProfile {
  senderAliases: string[];
  accountIdentifiers: string[];
  identityTextFragments: string[];
}

export interface ParserTemplateEngineDefinition {
  regex: string;
  direction: TransactionDirection;
  amountKey: string;
  merchantKey?: string;
  balanceKey?: string;
  feeKey?: string;
  vatKey?: string;
  extraFeeKey?: string;
  totalKey?: string;
  accountKey?: string;
  referenceKey?: string;
  titleKey?: string;
  dateKey?: string;
  timeKey?: string;
  meridiemKey?: string;
  dateMode: ParserTemplateDateMode;
  accountChannel?: AccountChannel;
  category?: TransactionCategory;
  preserveTitleCase?: boolean;
}

export interface BuiltInParserTemplateDefinition {
  id: string;
  financialInstitution: FinancialInstitution;
  institutionKey: string;
  institutionLabel: string;
  institutionIcon: string;
  name: string;
  version: string;
  updated: string;
  defaultStatus: Exclude<ParserTemplateStatus, "disabled">;
  note: string;
  healthScore: number | null;
  engine: ParserTemplateEngineDefinition;
  defaultUserProfile: ParserTemplateUserProfile;
}

export interface ParserBuiltInTemplateOverride {
  templateId: string;
  status: ParserTemplateStatus;
  userProfile: ParserTemplateUserProfile;
}

export interface ParserTemplateFamilyDefinition {
  institutionKey: string;
  financialInstitution: FinancialInstitution;
  institutionLabel: string;
  institutionIcon: string;
  defaultSenderAliases: string[];
  templateIds: string[];
  templateCount: number;
}

export interface ParserAccountBinding {
  accountId: string;
  accountLabel: string;
  accountChannel: AccountChannel;
  financialInstitution: FinancialInstitution;
  institutionKey: string;
  status: ParserTemplateStatus;
  userProfile: ParserTemplateUserProfile;
}

export interface CustomParserTemplateDefinition {
  id: string;
  financialInstitution: FinancialInstitution;
  institutionKey: string;
  institutionLabel: string;
  institutionIcon: string;
  name: string;
  version: string;
  updated: string;
  status: ParserTemplateStatus;
  note: string;
  healthScore: number | null;
  sourceType: "local";
  builtInTemplateId?: string;
  userProfile: ParserTemplateUserProfile;
  engine: ParserTemplateEngineDefinition;
  linkedAccountId?: string;
  linkedAccountLabel?: string;
}

export interface ParserTemplateWorkspace {
  version: 3;
  builtInOverrides: ParserBuiltInTemplateOverride[];
  accountBindings: ParserAccountBinding[];
  customTemplates: CustomParserTemplateDefinition[];
}

export interface ParserWorkspaceAuthorityState {
  version: 1;
  templateWorkspace: ParserTemplateWorkspace;
  selectedTemplateId: string;
  senderLabel: string;
  strictSchemaParsing: boolean;
  preserveRawSms: boolean;
  autoReconciliation: boolean;
  verboseLogging: boolean;
}

export type ParserTemplateKind = "builtin" | "custom";

export interface ParserTemplateInspectionBinding {
  field:
    | "amount"
    | "merchant"
    | "balance"
    | "fee"
    | "vat"
    | "extra_fee"
    | "total"
    | "account"
    | "reference"
    | "title"
    | "date"
    | "time"
    | "meridiem";
  captureKey: string | null;
  required: boolean;
}

export interface ParserTemplateInspection {
  templateId: string;
  templateKind: ParserTemplateKind;
  templateName: string;
  engineEditable: boolean;
  builtInTemplateId: string | null;
  financialInstitution: FinancialInstitution;
  linkedAccountId: string | null;
  linkedAccountLabel: string | null;
  regex: string;
  direction: TransactionDirection;
  dateMode: ParserTemplateDateMode;
  accountChannel: AccountChannel;
  category: TransactionCategory | null;
  preserveTitleCase: boolean;
  userProfile: ParserTemplateUserProfile;
  bindings: ParserTemplateInspectionBinding[];
}

export interface ParserTemplateDefinition {
  id: string;
  financialInstitution: FinancialInstitution;
  institutionKey: string;
  institutionLabel: string;
  institutionIcon: string;
  senderAliases: string[];
  accountIdentifiers: string[];
  identityTextFragments: string[];
  name: string;
  version: string;
  updated: string;
  status: ParserTemplateStatus;
  regex: string;
  note: string;
  healthScore: number | null;
  sourceType: "core" | "local";
  templateKind: ParserTemplateKind;
  builtInTemplateId?: string;
  linkedAccountId?: string;
  linkedAccountLabel?: string;
  engineEditable: boolean;
  userProfile: ParserTemplateUserProfile;
  direction: TransactionDirection;
  amountKey: string;
  merchantKey?: string;
  balanceKey?: string;
  feeKey?: string;
  vatKey?: string;
  extraFeeKey?: string;
  totalKey?: string;
  accountKey?: string;
  referenceKey?: string;
  titleKey?: string;
  dateKey?: string;
  timeKey?: string;
  meridiemKey?: string;
  dateMode: ParserTemplateDateMode;
  accountChannel?: AccountChannel;
  category?: TransactionCategory;
  preserveTitleCase?: boolean;
}

export interface ParserRuntimeOptions {
  templates?: readonly ParserTemplateDefinition[];
  preferredTemplateId?: string;
  includeDraftTemplates?: boolean;
}

export type ParserMatchResult =
  | {
      status: "matched";
      draft: ParsedTransactionDraft;
    }
  | {
      status: "unmatched";
      failureReason: "no_template_match";
      rawMessageId: string;
      senderLabel: string;
      smsBody: string;
    };

export interface UnmatchedSmsEntry {
  unmatchedEntryId: string;
  rawMessageId: string;
  senderLabel: string;
  smsBody: string;
  receivedAt: string;
  capturedAt: string;
  failureReason: "no_template_match";
}

export interface ApprovalQueueItem extends ParsedTransactionDraft {
  queueEntryId: string;
  queuedAt: string;
  approvalStatus: "pending_approval";
  note: string;
}

export interface ApprovedTransaction extends ParsedTransactionDraft {
  transactionId: string;
  approvedAt: string;
  approvalStatus: "approved";
  note: string;
}

export interface ReconciliationItem {
  reconciliationItemId: string;
  accountId: string;
  triggerTransactionId?: string;
  triggerRawMessageId?: string;
  expectedBalanceMinor: number;
  reportedBalanceMinor: number;
  deltaMinor: number;
  status: ReconciliationStatus;
  resolutionKind?: ReconciliationResolutionKind;
  resolvedByTransactionId?: string;
  createdAt: string;
  resolvedAt?: string;
  note?: string;
}

export interface HistoricalImportReviewPolicy {
  defaultRecentReviewDays: number;
  recentReviewDaysByAccountKey?: Record<string, number>;
}

export interface HistoricalImportAccountSelection {
  importAccountKey: string;
  existingAccountId?: string;
  createAccountId?: string;
  displayName?: string;
  maskedAccountNumber?: string;
  fullAccountNumber?: string;
}

export interface AccountSummary {
  accountId: string;
  institutionName: string;
  maskedAccountNumber: string;
  fullAccountNumber?: string;
  balanceMinor: number;
  currencyCode: "ETB";
  channel: AccountChannel;
  iconName: string;
  tone: UiTone;
}

export interface CreateCustomAccountInput {
  institutionName: string;
  accountReference?: string;
  balanceMinor: number;
  channel: AccountChannel;
  note?: string;
}

export interface UpdateCustomAccountInput {
  institutionName?: string;
  accountReference?: string | null;
  balanceMinor?: number;
  channel?: AccountChannel;
  note?: string;
}

export interface CustomAccountRecord extends AccountSummary {
  note: string;
  createdAt: string;
  updatedAt: string;
}

export interface AccountVisibilityOverride {
  accountId: string;
  isHidden: boolean;
  updatedAt: string;
}

export type ManagedAccountSource = "derived" | "custom";

export interface ManagedAccount extends AccountSummary {
  source: ManagedAccountSource;
  isHidden: boolean;
  note?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface BudgetSummary {
  budgetId: string;
  category: TransactionCategory;
  label: string;
  spentMinor: number;
  limitMinor: number;
  progressPercent: number;
  iconName: string;
  tone: Extract<UiTone, "primary" | "tertiary" | "secondary">;
}

export interface DashboardSnapshot {
  totalBalanceMinor: number;
  pendingApprovalCount: number;
  approvedTransactionCount: number;
  balanceByChannel: Record<AccountChannel, number>;
}

export interface SyncStatusSummary {
  tone: SyncStatusTone;
  headline: string;
  detail: string;
  nearbyReadyCount: number;
  trustedDeviceCount: number;
  lastSyncAt: string | null;
}

export interface NearbySyncDevice {
  deviceId: string;
  displayName: string;
  platform: SyncDevicePlatform;
  signalStrength: number;
  statusLabel: string;
  discoveredAt: string;
  pairingCodeHint: string;
}

export interface TrustedSyncDevice {
  deviceId: string;
  displayName: string;
  platform: SyncDevicePlatform;
  connectedAt: string;
  lastSyncedAt: string | null;
  health: TrustedDeviceSyncHealth;
  isPrimary: boolean;
  autoSyncEnabled: boolean;
}

export interface SyncActivityEntry {
  activityId: string;
  type: SyncActivityType;
  status: SyncActivityStatus;
  title: string;
  detail: string;
  occurredAt: string;
}

export interface PairingCodeState {
  generatedCode: string;
  expiresAt: string;
  pendingCodeInput: string;
  lastSubmittedCode: string | null;
  errorMessage: string | null;
}
