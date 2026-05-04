import type {
  AccountSummary,
  AccountVisibilityOverride,
  ApprovalQueueItem,
  ApprovedTransaction,
  CustomParserTemplateDefinition,
  PairingCodeState,
  CustomAccountRecord,
  FinancialInstitution,
  HistoricalImportDuplicateMode,
  HistoricalImportMode,
  NearbySyncDevice,
  ParsedTransactionDraft,
  ParserAccountBinding,
  ParserBuiltInTemplateOverride,
  ParserTemplateEngineDefinition,
  ParserTemplateDefinition,
  ParserTemplateUserProfile,
  ParserTemplateWorkspace,
  ParserWorkspaceAuthorityState,
  ParserTemplateStatus,
  SmsCaptureBackfillRequest,
  SmsCaptureDiagnostics,
  SmsCaptureQueueItem,
  SmsCaptureSettings,
  SyncActivityEntry,
  SyncDiscoveryState,
  SyncMode,
  TrustedSyncDevice,
  UnmatchedSmsEntry,
} from "./types";

export interface FinanceSnapshot {
  approvedTransactions: ApprovedTransaction[];
  approvalQueue: ApprovalQueueItem[];
  unmatchedMessages: UnmatchedSmsEntry[];
  accountSummaries: AccountSummary[];
}

export interface AuthorityDataSnapshot extends FinanceSnapshot {
  smsCaptureSettings: SmsCaptureSettings;
  smsCaptureQueue: SmsCaptureQueueItem[];
  smsCaptureDiagnostics: SmsCaptureDiagnostics;
  smsCaptureBackfillRequest: SmsCaptureBackfillRequest;
  customAccounts: CustomAccountRecord[];
  accountVisibilityOverrides: AccountVisibilityOverride[];
  syncEnabled: boolean;
  syncMode: SyncMode;
  syncDiscoveryState: SyncDiscoveryState;
  nearbySyncDevices: NearbySyncDevice[];
  trustedSyncDevices: TrustedSyncDevice[];
  syncActivity: SyncActivityEntry[];
  systemLogs: SystemLogEntry[];
  pairingCodeState: PairingCodeState;
  parserWorkspaceAuthorityState: ParserWorkspaceAuthorityState | null;
}

export interface HistoricalImportDefaults {
  importMode: HistoricalImportMode;
  duplicateMode: HistoricalImportDuplicateMode;
  reviewWindowDays: number;
}

export interface HistoricalImportPackage {
  kind: "trackwallet-historical-import";
  version: 1;
  createdAt: string;
  drafts: ParsedTransactionDraft[];
  unmatchedEntries: UnmatchedSmsEntry[];
}

export interface DataExportPackage extends FinanceSnapshot {
  kind: "trackwallet-data-export";
  version: 1;
  createdAt: string;
  authorityState?: AuthorityDataSnapshot;
}

export interface BackupPackage {
  kind: "trackwallet-authority-backup";
  version: 1;
  createdAt: string;
  finance: FinanceSnapshot;
  authorityState?: AuthorityDataSnapshot;
  defaults: HistoricalImportDefaults;
}

export type SystemLogEventKind =
  | "export"
  | "backup"
  | "restore"
  | "import_staged"
  | "import_applied"
  | "import_failed"
  | "clear_local_data";

export type SystemLogTone = "success" | "warning" | "error" | "neutral";

export interface SystemLogMetric {
  label: string;
  value: string;
}

export interface HistoricalImportTemplateUsage {
  templateId: string;
  financialInstitution: FinancialInstitution;
  templateName: string | null;
  templateStatus: ParserTemplateStatus | "unknown";
  sourceType: ParserTemplateDefinition["sourceType"] | "unknown";
  draftCount: number;
}

export interface HistoricalImportPackageSummary {
  draftCount: number;
  unmatchedCount: number;
  uniqueAccountCount: number;
  reportedBalanceDraftCount: number;
  institutions: FinancialInstitution[];
  templateUsage: HistoricalImportTemplateUsage[];
  unknownTemplateIds: string[];
  disabledTemplateIds: string[];
  draftTemplateIds: string[];
}

export interface SystemLogEntry {
  logId: string;
  eventKind: SystemLogEventKind;
  tone: SystemLogTone;
  title: string;
  detail: string;
  occurredAt: string;
  metrics: SystemLogMetric[];
  templateUsage: HistoricalImportTemplateUsage[];
}

export const DEFAULT_HISTORICAL_IMPORT_DEFAULTS: HistoricalImportDefaults = {
  importMode: "backup_then_replace",
  duplicateMode: "skip",
  reviewWindowDays: 20,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeOptionalText(value: string | undefined): string | null {
  const normalized = value?.trim().toLowerCase();
  return normalized ? normalized : null;
}

export function buildHistoricalImportAccountKey(
  draft: Pick<
    ParsedTransactionDraft,
    "financialInstitution" | "accountChannel" | "accountReference" | "reference"
  >,
): string {
  const stableReference =
    normalizeOptionalText(draft.accountReference) ??
    normalizeOptionalText(draft.reference) ??
    draft.accountChannel;

  return [
    draft.financialInstitution,
    draft.accountChannel,
    stableReference,
  ].join("|");
}

export function isValidDateString(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    !Number.isNaN(new Date(value).getTime())
  );
}

export function sanitizeCreatedAt(
  value: unknown,
  fallback = new Date().toISOString(),
): string {
  return isValidDateString(value) ? value : fallback;
}

export function isHistoricalImportMode(
  value: unknown,
): value is HistoricalImportMode {
  return (
    value === "merge" ||
    value === "replace" ||
    value === "backup_then_replace"
  );
}

export function isHistoricalImportDuplicateMode(
  value: unknown,
): value is HistoricalImportDuplicateMode {
  return value === "skip" || value === "review";
}

export function sanitizeHistoricalImportDefaults(
  value: unknown,
  fallback: HistoricalImportDefaults = DEFAULT_HISTORICAL_IMPORT_DEFAULTS,
): HistoricalImportDefaults {
  if (!isRecord(value)) {
    return { ...fallback };
  }

  const rawReviewWindowDays =
    typeof value.reviewWindowDays === "number"
      ? value.reviewWindowDays
      : fallback.reviewWindowDays;

  return {
    importMode: isHistoricalImportMode(value.importMode)
      ? value.importMode
      : fallback.importMode,
    duplicateMode: isHistoricalImportDuplicateMode(value.duplicateMode)
      ? value.duplicateMode
      : fallback.duplicateMode,
    reviewWindowDays: Math.max(0, Math.round(rawReviewWindowDays)),
  };
}

export function isParsedTransactionDraft(
  value: unknown,
): value is ParsedTransactionDraft {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.draftId === "string" &&
    typeof value.rawMessageId === "string" &&
    typeof value.senderLabel === "string" &&
    typeof value.rawBody === "string" &&
    typeof value.financialInstitution === "string" &&
    typeof value.transactionDirection === "string" &&
    typeof value.amountMinor === "number" &&
    typeof value.feeMinor === "number" &&
    typeof value.runningBalanceMinor === "number" &&
    typeof value.currencyCode === "string" &&
    typeof value.title === "string" &&
    typeof value.merchantName === "string" &&
    typeof value.category === "string" &&
    typeof value.parserTemplateId === "string" &&
    typeof value.confidence === "number" &&
    isValidDateString(value.occurredAt) &&
    typeof value.accountChannel === "string"
  );
}

export function isUnmatchedSmsEntry(value: unknown): value is UnmatchedSmsEntry {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.unmatchedEntryId === "string" &&
    typeof value.rawMessageId === "string" &&
    typeof value.senderLabel === "string" &&
    typeof value.smsBody === "string" &&
    isValidDateString(value.receivedAt) &&
    isValidDateString(value.capturedAt) &&
    typeof value.failureReason === "string"
  );
}

export function isApprovalQueueItem(value: unknown): value is ApprovalQueueItem {
  return (
    isParsedTransactionDraft(value) &&
    isRecord(value) &&
    typeof value.queueEntryId === "string" &&
    isValidDateString(value.queuedAt) &&
    typeof value.note === "string"
  );
}

export function isApprovedTransaction(
  value: unknown,
): value is ApprovedTransaction {
  return (
    isParsedTransactionDraft(value) &&
    isRecord(value) &&
    typeof value.transactionId === "string" &&
    isValidDateString(value.approvedAt) &&
    typeof value.note === "string"
  );
}

export function isAccountSummary(value: unknown): value is AccountSummary {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.accountId === "string" &&
    typeof value.institutionName === "string" &&
    typeof value.maskedAccountNumber === "string" &&
    typeof value.balanceMinor === "number" &&
    typeof value.currencyCode === "string" &&
    typeof value.channel === "string" &&
    typeof value.iconName === "string" &&
    typeof value.tone === "string"
  );
}

function isSmsSenderRule(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.ruleId === "string" &&
    typeof value.senderLabel === "string" &&
    typeof value.normalizedSenderLabel === "string" &&
    typeof value.matchMode === "string" &&
    typeof value.isEnabled === "boolean" &&
    isValidDateString(value.createdAt) &&
    isValidDateString(value.updatedAt)
  );
}

function isSmsCaptureSettings(value: unknown): value is SmsCaptureSettings {
  return (
    isRecord(value) &&
    typeof value.captureEnabled === "boolean" &&
    typeof value.buildMode === "string" &&
    typeof value.autoRouteToParserWhenAppOpen === "boolean" &&
    typeof value.preserveRawSmsUntilReviewed === "boolean" &&
    typeof value.retentionDays === "number" &&
    Array.isArray(value.senderRules) &&
    value.senderRules.every(isSmsSenderRule)
  );
}

function isSmsCaptureQueueItem(value: unknown): value is SmsCaptureQueueItem {
  return (
    isRecord(value) &&
    typeof value.captureId === "string" &&
    typeof value.messageId === "string" &&
    typeof value.senderLabel === "string" &&
    typeof value.smsBody === "string" &&
    isValidDateString(value.receivedAt) &&
    isValidDateString(value.capturedAt) &&
    typeof value.source === "string" &&
    typeof value.hash === "string" &&
    typeof value.status === "string" &&
    typeof value.parseAttemptCount === "number"
  );
}

function isSmsCaptureDiagnostics(value: unknown): value is SmsCaptureDiagnostics {
  return (
    isRecord(value) &&
    typeof value.permissionState === "string" &&
    typeof value.nativeCaptureAvailable === "boolean" &&
    typeof value.captureSupported === "boolean" &&
    typeof value.duplicateSuppressedCount === "number" &&
    typeof value.filteredOutCount === "number" &&
    (value.lastCapturedAt === null || isValidDateString(value.lastCapturedAt)) &&
    (value.lastCapturedSenderLabel === null ||
      typeof value.lastCapturedSenderLabel === "string") &&
    (value.lastParserHandoffAt === null ||
      isValidDateString(value.lastParserHandoffAt)) &&
    typeof value.lastParserOutcome === "string" &&
    (value.lastFailureReason === null || typeof value.lastFailureReason === "string")
  );
}

function isSmsCaptureBackfillRequest(
  value: unknown,
): value is SmsCaptureBackfillRequest {
  return (
    isRecord(value) &&
    (value.lookbackDays === null || typeof value.lookbackDays === "number") &&
    typeof value.status === "string" &&
    (value.requestedAt === null || isValidDateString(value.requestedAt))
  );
}

function isCustomAccountRecord(value: unknown): value is CustomAccountRecord {
  return (
    isAccountSummary(value) &&
    isRecord(value) &&
    typeof value.note === "string" &&
    isValidDateString(value.createdAt) &&
    isValidDateString(value.updatedAt)
  );
}

function isAccountVisibilityOverride(
  value: unknown,
): value is AccountVisibilityOverride {
  return (
    isRecord(value) &&
    typeof value.accountId === "string" &&
    typeof value.isHidden === "boolean" &&
    isValidDateString(value.updatedAt)
  );
}

function isNearbySyncDevice(value: unknown): value is NearbySyncDevice {
  return (
    isRecord(value) &&
    typeof value.deviceId === "string" &&
    typeof value.displayName === "string" &&
    typeof value.platform === "string" &&
    typeof value.signalStrength === "number" &&
    typeof value.statusLabel === "string" &&
    isValidDateString(value.discoveredAt) &&
    typeof value.pairingCodeHint === "string"
  );
}

function isTrustedSyncDevice(value: unknown): value is TrustedSyncDevice {
  return (
    isRecord(value) &&
    typeof value.deviceId === "string" &&
    typeof value.displayName === "string" &&
    typeof value.platform === "string" &&
    isValidDateString(value.connectedAt) &&
    (value.lastSyncedAt === null || isValidDateString(value.lastSyncedAt)) &&
    typeof value.health === "string" &&
    typeof value.isPrimary === "boolean" &&
    typeof value.autoSyncEnabled === "boolean"
  );
}

function isSyncActivityEntry(value: unknown): value is SyncActivityEntry {
  return (
    isRecord(value) &&
    typeof value.activityId === "string" &&
    typeof value.type === "string" &&
    typeof value.status === "string" &&
    typeof value.title === "string" &&
    typeof value.detail === "string" &&
    isValidDateString(value.occurredAt)
  );
}

function isSystemLogMetric(value: unknown): value is SystemLogMetric {
  return (
    isRecord(value) &&
    typeof value.label === "string" &&
    typeof value.value === "string"
  );
}

function isHistoricalImportTemplateUsage(
  value: unknown,
): value is HistoricalImportTemplateUsage {
  return (
    isRecord(value) &&
    typeof value.templateId === "string" &&
    typeof value.financialInstitution === "string" &&
    (value.templateName === null || typeof value.templateName === "string") &&
    typeof value.templateStatus === "string" &&
    typeof value.sourceType === "string" &&
    typeof value.draftCount === "number"
  );
}

function isSystemLogEntry(value: unknown): value is SystemLogEntry {
  return (
    isRecord(value) &&
    typeof value.logId === "string" &&
    typeof value.eventKind === "string" &&
    typeof value.tone === "string" &&
    typeof value.title === "string" &&
    typeof value.detail === "string" &&
    isValidDateString(value.occurredAt) &&
    Array.isArray(value.metrics) &&
    value.metrics.every(isSystemLogMetric) &&
    Array.isArray(value.templateUsage) &&
    value.templateUsage.every(isHistoricalImportTemplateUsage)
  );
}

function isPairingCodeState(value: unknown): value is PairingCodeState {
  return (
    isRecord(value) &&
    typeof value.generatedCode === "string" &&
    isValidDateString(value.expiresAt) &&
    typeof value.pendingCodeInput === "string" &&
    (value.lastSubmittedCode === null || typeof value.lastSubmittedCode === "string") &&
    (value.errorMessage === null || typeof value.errorMessage === "string")
  );
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === "string";
}

function isTemplateStatus(value: unknown): value is ParserTemplateStatus {
  return (
    value === "active" ||
    value === "draft" ||
    value === "fallback" ||
    value === "disabled"
  );
}

function isParserTemplateUserProfile(
  value: unknown,
): value is ParserTemplateUserProfile {
  return (
    isRecord(value) &&
    isStringArray(value.senderAliases) &&
    isStringArray(value.accountIdentifiers) &&
    isStringArray(value.identityTextFragments)
  );
}

function isParserTemplateEngineDefinition(
  value: unknown,
): value is ParserTemplateEngineDefinition {
  return (
    isRecord(value) &&
    typeof value.regex === "string" &&
    typeof value.direction === "string" &&
    typeof value.amountKey === "string" &&
    isOptionalString(value.merchantKey) &&
    isOptionalString(value.balanceKey) &&
    isOptionalString(value.feeKey) &&
    isOptionalString(value.vatKey) &&
    isOptionalString(value.extraFeeKey) &&
    isOptionalString(value.totalKey) &&
    isOptionalString(value.accountKey) &&
    isOptionalString(value.referenceKey) &&
    isOptionalString(value.titleKey) &&
    isOptionalString(value.dateKey) &&
    isOptionalString(value.timeKey) &&
    isOptionalString(value.meridiemKey) &&
    typeof value.dateMode === "string" &&
    (value.accountChannel === undefined || typeof value.accountChannel === "string") &&
    (value.category === undefined || typeof value.category === "string") &&
    (value.preserveTitleCase === undefined ||
      typeof value.preserveTitleCase === "boolean")
  );
}

function isParserBuiltInTemplateOverride(
  value: unknown,
): value is ParserBuiltInTemplateOverride {
  return (
    isRecord(value) &&
    typeof value.templateId === "string" &&
    isTemplateStatus(value.status) &&
    isParserTemplateUserProfile(value.userProfile)
  );
}

function isParserAccountBinding(value: unknown): value is ParserAccountBinding {
  return (
    isRecord(value) &&
    typeof value.accountId === "string" &&
    typeof value.accountLabel === "string" &&
    typeof value.accountChannel === "string" &&
    typeof value.financialInstitution === "string" &&
    typeof value.institutionKey === "string" &&
    isTemplateStatus(value.status) &&
    isParserTemplateUserProfile(value.userProfile)
  );
}

function isCustomParserTemplateDefinition(
  value: unknown,
): value is CustomParserTemplateDefinition {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.financialInstitution === "string" &&
    typeof value.institutionKey === "string" &&
    typeof value.institutionLabel === "string" &&
    typeof value.institutionIcon === "string" &&
    typeof value.name === "string" &&
    typeof value.version === "string" &&
    typeof value.updated === "string" &&
    isTemplateStatus(value.status) &&
    typeof value.note === "string" &&
    (typeof value.healthScore === "number" || value.healthScore === null) &&
    value.sourceType === "local" &&
    (value.builtInTemplateId === undefined ||
      typeof value.builtInTemplateId === "string") &&
    isParserTemplateUserProfile(value.userProfile) &&
    isParserTemplateEngineDefinition(value.engine) &&
    (value.linkedAccountId === undefined ||
      typeof value.linkedAccountId === "string") &&
    (value.linkedAccountLabel === undefined ||
      typeof value.linkedAccountLabel === "string")
  );
}

function isParserTemplateWorkspace(
  value: unknown,
): value is ParserTemplateWorkspace {
  return (
    isRecord(value) &&
    value.version === 3 &&
    Array.isArray(value.builtInOverrides) &&
    value.builtInOverrides.every(isParserBuiltInTemplateOverride) &&
    Array.isArray(value.accountBindings) &&
    value.accountBindings.every(isParserAccountBinding) &&
    Array.isArray(value.customTemplates) &&
    value.customTemplates.every(isCustomParserTemplateDefinition)
  );
}

export function isParserWorkspaceAuthorityState(
  value: unknown,
): value is ParserWorkspaceAuthorityState {
  return (
    isRecord(value) &&
    value.version === 1 &&
    isParserTemplateWorkspace(value.templateWorkspace) &&
    typeof value.selectedTemplateId === "string" &&
    typeof value.senderLabel === "string" &&
    typeof value.strictSchemaParsing === "boolean" &&
    typeof value.preserveRawSms === "boolean" &&
    typeof value.autoReconciliation === "boolean" &&
    typeof value.verboseLogging === "boolean"
  );
}

export function isFinanceSnapshot(value: unknown): value is FinanceSnapshot {
  if (!isRecord(value)) {
    return false;
  }

  return (
    Array.isArray(value.approvedTransactions) &&
    value.approvedTransactions.every(isApprovedTransaction) &&
    Array.isArray(value.approvalQueue) &&
    value.approvalQueue.every(isApprovalQueueItem) &&
    Array.isArray(value.unmatchedMessages) &&
    value.unmatchedMessages.every(isUnmatchedSmsEntry) &&
    Array.isArray(value.accountSummaries) &&
    value.accountSummaries.every(isAccountSummary)
  );
}

export function isAuthorityDataSnapshot(
  value: unknown,
): value is AuthorityDataSnapshot {
  return (
    isFinanceSnapshot(value) &&
    isRecord(value) &&
    isSmsCaptureSettings(value.smsCaptureSettings) &&
    Array.isArray(value.smsCaptureQueue) &&
    value.smsCaptureQueue.every(isSmsCaptureQueueItem) &&
    isSmsCaptureDiagnostics(value.smsCaptureDiagnostics) &&
    isSmsCaptureBackfillRequest(value.smsCaptureBackfillRequest) &&
    Array.isArray(value.customAccounts) &&
    value.customAccounts.every(isCustomAccountRecord) &&
    Array.isArray(value.accountVisibilityOverrides) &&
    value.accountVisibilityOverrides.every(isAccountVisibilityOverride) &&
    typeof value.syncEnabled === "boolean" &&
    typeof value.syncMode === "string" &&
    typeof value.syncDiscoveryState === "string" &&
    Array.isArray(value.nearbySyncDevices) &&
    value.nearbySyncDevices.every(isNearbySyncDevice) &&
    Array.isArray(value.trustedSyncDevices) &&
    value.trustedSyncDevices.every(isTrustedSyncDevice) &&
    Array.isArray(value.syncActivity) &&
    value.syncActivity.every(isSyncActivityEntry) &&
    Array.isArray(value.systemLogs) &&
    value.systemLogs.every(isSystemLogEntry) &&
    isPairingCodeState(value.pairingCodeState) &&
    (value.parserWorkspaceAuthorityState === undefined ||
      value.parserWorkspaceAuthorityState === null ||
      isParserWorkspaceAuthorityState(value.parserWorkspaceAuthorityState))
  );
}

export function isHistoricalImportPackage(
  value: unknown,
): value is HistoricalImportPackage {
  if (!isRecord(value)) {
    return false;
  }

  return (
    value.kind === "trackwallet-historical-import" &&
    value.version === 1 &&
    isValidDateString(value.createdAt) &&
    Array.isArray(value.drafts) &&
    value.drafts.every(isParsedTransactionDraft) &&
    Array.isArray(value.unmatchedEntries) &&
    value.unmatchedEntries.every(isUnmatchedSmsEntry)
  );
}

export function isDataExportPackage(value: unknown): value is DataExportPackage {
  return (
    isRecord(value) &&
    value.kind === "trackwallet-data-export" &&
    value.version === 1 &&
    isValidDateString(value.createdAt) &&
    isFinanceSnapshot(value) &&
    (value.authorityState === undefined ||
      isAuthorityDataSnapshot(value.authorityState))
  );
}

export function isBackupPackage(value: unknown): value is BackupPackage {
  return (
    isRecord(value) &&
    value.kind === "trackwallet-authority-backup" &&
    value.version === 1 &&
    isValidDateString(value.createdAt) &&
    isRecord(value.finance) &&
    isFinanceSnapshot(value.finance) &&
    (value.authorityState === undefined ||
      isAuthorityDataSnapshot(value.authorityState)) &&
    (value.defaults === undefined || isRecord(value.defaults))
  );
}

export function cloneFinanceSnapshot(
  snapshot: FinanceSnapshot,
): FinanceSnapshot {
  return {
    approvedTransactions: snapshot.approvedTransactions.map((item) => ({ ...item })),
    approvalQueue: snapshot.approvalQueue.map((item) => ({ ...item })),
    unmatchedMessages: snapshot.unmatchedMessages.map((item) => ({ ...item })),
    accountSummaries: snapshot.accountSummaries.map((item) => ({ ...item })),
  };
}

function cloneParserTemplateUserProfile(
  userProfile: ParserTemplateUserProfile,
): ParserTemplateUserProfile {
  return {
    senderAliases: [...userProfile.senderAliases],
    accountIdentifiers: [...userProfile.accountIdentifiers],
    identityTextFragments: [...userProfile.identityTextFragments],
  };
}

function cloneParserTemplateEngineDefinition(
  engine: ParserTemplateEngineDefinition,
): ParserTemplateEngineDefinition {
  return { ...engine };
}

function cloneParserTemplateWorkspace(
  workspace: ParserTemplateWorkspace,
): ParserTemplateWorkspace {
  return {
    version: 3,
    builtInOverrides: workspace.builtInOverrides.map((entry) => ({
      ...entry,
      userProfile: cloneParserTemplateUserProfile(entry.userProfile),
    })),
    accountBindings: workspace.accountBindings.map((entry) => ({
      ...entry,
      userProfile: cloneParserTemplateUserProfile(entry.userProfile),
    })),
    customTemplates: workspace.customTemplates.map((entry) => ({
      ...entry,
      userProfile: cloneParserTemplateUserProfile(entry.userProfile),
      engine: cloneParserTemplateEngineDefinition(entry.engine),
    })),
  };
}

export function cloneParserWorkspaceAuthorityState(
  snapshot: ParserWorkspaceAuthorityState,
): ParserWorkspaceAuthorityState {
  return {
    version: 1,
    templateWorkspace: cloneParserTemplateWorkspace(snapshot.templateWorkspace),
    selectedTemplateId: snapshot.selectedTemplateId,
    senderLabel: snapshot.senderLabel,
    strictSchemaParsing: snapshot.strictSchemaParsing,
    preserveRawSms: snapshot.preserveRawSms,
    autoReconciliation: snapshot.autoReconciliation,
    verboseLogging: snapshot.verboseLogging,
  };
}

export function cloneAuthorityDataSnapshot(
  snapshot: AuthorityDataSnapshot,
): AuthorityDataSnapshot {
  return {
    ...cloneFinanceSnapshot(snapshot),
    smsCaptureSettings: {
      ...snapshot.smsCaptureSettings,
      senderRules: snapshot.smsCaptureSettings.senderRules.map((item) => ({
        ...item,
      })),
    },
    smsCaptureQueue: snapshot.smsCaptureQueue.map((item) => ({ ...item })),
    smsCaptureDiagnostics: { ...snapshot.smsCaptureDiagnostics },
    smsCaptureBackfillRequest: { ...snapshot.smsCaptureBackfillRequest },
    customAccounts: snapshot.customAccounts.map((item) => ({ ...item })),
    accountVisibilityOverrides: snapshot.accountVisibilityOverrides.map((item) => ({
      ...item,
    })),
    syncEnabled: snapshot.syncEnabled,
    syncMode: snapshot.syncMode,
    syncDiscoveryState: snapshot.syncDiscoveryState,
    nearbySyncDevices: snapshot.nearbySyncDevices.map((item) => ({ ...item })),
    trustedSyncDevices: snapshot.trustedSyncDevices.map((item) => ({ ...item })),
    syncActivity: snapshot.syncActivity.map((item) => ({ ...item })),
    systemLogs: snapshot.systemLogs.map((item) => ({
      ...item,
      metrics: item.metrics.map((metric) => ({ ...metric })),
      templateUsage: item.templateUsage.map((usage) => ({ ...usage })),
    })),
    pairingCodeState: { ...snapshot.pairingCodeState },
    parserWorkspaceAuthorityState:
      snapshot.parserWorkspaceAuthorityState == null
        ? null
        : cloneParserWorkspaceAuthorityState(snapshot.parserWorkspaceAuthorityState),
  };
}

export function buildDataExportPackage(
  snapshot: FinanceSnapshot,
  createdAt = new Date().toISOString(),
  authorityState?: AuthorityDataSnapshot,
): DataExportPackage {
  return {
    kind: "trackwallet-data-export",
    version: 1,
    createdAt,
    ...cloneFinanceSnapshot(snapshot),
    ...(authorityState
      ? { authorityState: cloneAuthorityDataSnapshot(authorityState) }
      : {}),
  };
}

export function buildBackupPackage(
  snapshot: FinanceSnapshot,
  defaults: HistoricalImportDefaults,
  createdAt = new Date().toISOString(),
  authorityState?: AuthorityDataSnapshot,
): BackupPackage {
  return {
    kind: "trackwallet-authority-backup",
    version: 1,
    createdAt,
    finance: cloneFinanceSnapshot(snapshot),
    ...(authorityState
      ? { authorityState: cloneAuthorityDataSnapshot(authorityState) }
      : {}),
    defaults: sanitizeHistoricalImportDefaults(defaults),
  };
}

export function summarizeHistoricalImportPackage(
  historicalImportPackage: Pick<
    HistoricalImportPackage,
    "drafts" | "unmatchedEntries"
  >,
  availableTemplates: readonly ParserTemplateDefinition[] = [],
): HistoricalImportPackageSummary {
  const templateById = new Map(
    availableTemplates.map((template) => [template.id, template]),
  );
  const templateCountById = new Map<string, number>();
  const institutionByTemplateId = new Map<string, FinancialInstitution>();
  const uniqueInstitutions = new Set<FinancialInstitution>();
  const uniqueAccountKeys = new Set<string>();
  let reportedBalanceDraftCount = 0;

  for (const draft of historicalImportPackage.drafts) {
    templateCountById.set(
      draft.parserTemplateId,
      (templateCountById.get(draft.parserTemplateId) ?? 0) + 1,
    );
    institutionByTemplateId.set(draft.parserTemplateId, draft.financialInstitution);
    uniqueInstitutions.add(draft.financialInstitution);
    uniqueAccountKeys.add(buildHistoricalImportAccountKey(draft));
    if (typeof draft.reportedBalanceMinor === "number") {
      reportedBalanceDraftCount += 1;
    }
  }

  const templateUsage = [...templateCountById.entries()]
    .map(([templateId, draftCount]) => {
      const template = templateById.get(templateId);
      return {
        templateId,
        financialInstitution:
          template?.financialInstitution ??
          institutionByTemplateId.get(templateId) ??
          "unknown",
        templateName: template?.name ?? null,
        templateStatus: template?.status ?? "unknown",
        sourceType: template?.sourceType ?? "unknown",
        draftCount,
      } satisfies HistoricalImportTemplateUsage;
    })
    .sort((left, right) => left.templateId.localeCompare(right.templateId));

  return {
    draftCount: historicalImportPackage.drafts.length,
    unmatchedCount: historicalImportPackage.unmatchedEntries.length,
    uniqueAccountCount: uniqueAccountKeys.size,
    reportedBalanceDraftCount,
    institutions: [...uniqueInstitutions].sort((left, right) =>
      left.localeCompare(right),
    ),
    templateUsage,
    unknownTemplateIds: templateUsage
      .filter((entry) => entry.templateStatus === "unknown")
      .map((entry) => entry.templateId),
    disabledTemplateIds: templateUsage
      .filter((entry) => entry.templateStatus === "disabled")
      .map((entry) => entry.templateId),
    draftTemplateIds: templateUsage
      .filter((entry) => entry.templateStatus === "draft")
      .map((entry) => entry.templateId),
  };
}
