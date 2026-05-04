import {
  FINANCIAL_INSTITUTION_LABELS,
  buildHistoricalImportAccountKey,
  type AccountSummary,
  type ApprovalQueueItem,
  type ApprovedTransaction,
  type HistoricalImportDuplicateMode,
  type HistoricalImportMode,
  type ParsedTransactionDraft,
  type UnmatchedSmsEntry,
  type UiTone,
} from "@omni-sync/core";

export { buildHistoricalImportAccountKey } from "@omni-sync/core";

export interface HistoricalImportSnapshot {
  approvedTransactions: ApprovedTransaction[];
  approvalQueue: ApprovalQueueItem[];
  accountSummaries: AccountSummary[];
  unmatchedEntries: UnmatchedSmsEntry[];
}

export interface HistoricalImportDuplicate {
  draft: ParsedTransactionDraft;
  importAccountKey: string;
  matchedExistingId: string;
  matchedExistingKind: "approved" | "queue" | "import_batch";
}

export interface HistoricalImportOptions {
  mode: HistoricalImportMode;
  duplicateMode: HistoricalImportDuplicateMode;
  defaultRecentReviewDays: number;
  recentReviewDaysByAccountKey?: Record<string, number>;
  processedAt?: string;
}

export interface HistoricalImportInput {
  existingApprovedTransactions: readonly ApprovedTransaction[];
  existingApprovalQueue: readonly ApprovalQueueItem[];
  existingAccountSummaries: readonly AccountSummary[];
  existingUnmatchedEntries: readonly UnmatchedSmsEntry[];
  importedDrafts: readonly ParsedTransactionDraft[];
  importedUnmatchedEntries: readonly UnmatchedSmsEntry[];
  options: HistoricalImportOptions;
}

export interface HistoricalImportResult extends HistoricalImportSnapshot {
  mode: HistoricalImportMode;
  duplicateMode: HistoricalImportDuplicateMode;
  processedAt: string;
  duplicates: HistoricalImportDuplicate[];
  skippedDuplicateCount: number;
  inferredAccounts: AccountSummary[];
  backupSnapshot?: HistoricalImportSnapshot;
}

const DAY_IN_MS = 24 * 60 * 60 * 1000;

const accountToneByInstitution = {
  cbe: "primary",
  boa: "surface",
  telebirr: "secondary",
  cbebirr: "secondary",
  dashen: "tertiary",
  bunna: "surface",
  unknown: "surface",
} satisfies Record<ParsedTransactionDraft["financialInstitution"], UiTone>;

const accountIconByInstitution = {
  cbe: "account_balance",
  boa: "shield",
  telebirr: "phone_iphone",
  cbebirr: "payments",
  dashen: "diamond",
  bunna: "account_balance_wallet",
  unknown: "payments",
} satisfies Record<ParsedTransactionDraft["financialInstitution"], string>;

interface DuplicateTrackerEntry {
  id: string;
  kind: "approved" | "queue" | "import_batch";
}

export function importHistoricalTransactions(
  input: HistoricalImportInput,
): HistoricalImportResult {
  const processedAt = input.options.processedAt ?? new Date().toISOString();
  const baseSnapshot =
    input.options.mode === "merge"
      ? {
          approvedTransactions: cloneApprovedTransactions(
            input.existingApprovedTransactions,
          ),
          approvalQueue: cloneApprovalQueue(input.existingApprovalQueue),
          accountSummaries: cloneAccountSummaries(input.existingAccountSummaries),
          unmatchedEntries: cloneUnmatchedEntries(input.existingUnmatchedEntries),
        }
      : {
          approvedTransactions: [] as ApprovedTransaction[],
          approvalQueue: [] as ApprovalQueueItem[],
          accountSummaries: [] as AccountSummary[],
          unmatchedEntries: [] as UnmatchedSmsEntry[],
        };

  const backupSnapshot =
    input.options.mode === "backup_then_replace"
      ? {
          approvedTransactions: cloneApprovedTransactions(
            input.existingApprovedTransactions,
          ),
          approvalQueue: cloneApprovalQueue(input.existingApprovalQueue),
          accountSummaries: cloneAccountSummaries(input.existingAccountSummaries),
          unmatchedEntries: cloneUnmatchedEntries(input.existingUnmatchedEntries),
        }
      : undefined;

  const duplicates: HistoricalImportDuplicate[] = [];
  const inferredAccounts: AccountSummary[] = [];
  const duplicateTracker = new Map<string, DuplicateTrackerEntry>();
  if (input.options.mode === "merge") {
    seedDuplicateTracker(
      duplicateTracker,
      input.existingApprovedTransactions,
      "approved",
      (item) => item.transactionId,
    );
    seedDuplicateTracker(
      duplicateTracker,
      input.existingApprovalQueue,
      "queue",
      (item) => item.queueEntryId,
    );
  }
  seedDuplicateTracker(
    duplicateTracker,
    baseSnapshot.approvedTransactions,
    "approved",
    (item) => item.transactionId,
  );
  seedDuplicateTracker(
    duplicateTracker,
    baseSnapshot.approvalQueue,
    "queue",
    (item) => item.queueEntryId,
  );

  const draftsByOccurredAt = [...input.importedDrafts].sort((left, right) =>
    compareAscending(left.occurredAt, right.occurredAt),
  );

  for (const draft of draftsByOccurredAt) {
    const duplicateEntry = findDuplicateEntry(duplicateTracker, draft);
    if (duplicateEntry) {
      duplicates.push({
        draft: { ...draft },
        importAccountKey: buildHistoricalImportAccountKey(draft),
        matchedExistingId: duplicateEntry.id,
        matchedExistingKind: duplicateEntry.kind,
      });
      continue;
    }

    const accountMatch = ensureAccountSummary(
      baseSnapshot.accountSummaries,
      draft,
      inferredAccounts,
    );
    const recentReviewDays =
      input.options.recentReviewDaysByAccountKey?.[
        buildHistoricalImportAccountKey(draft)
      ] ?? input.options.defaultRecentReviewDays;

    if (shouldRouteToApprovalQueue(draft.occurredAt, processedAt, recentReviewDays)) {
      const queueItem = createApprovalQueueItem(draft, processedAt, accountMatch.accountId);
      baseSnapshot.approvalQueue.push(queueItem);
      registerDuplicateCandidate(duplicateTracker, queueItem, {
        id: queueItem.queueEntryId,
        kind: "import_batch",
      });
      continue;
    }

    const approvedTransaction = createApprovedTransaction(
      draft,
      processedAt,
      accountMatch.accountId,
    );
    baseSnapshot.approvedTransactions.push(approvedTransaction);
    registerDuplicateCandidate(duplicateTracker, approvedTransaction, {
      id: approvedTransaction.transactionId,
      kind: "import_batch",
    });
  }

  baseSnapshot.unmatchedEntries.push(
    ...input.importedUnmatchedEntries.map((entry) => ({ ...entry })),
  );

  return {
    mode: input.options.mode,
    duplicateMode: input.options.duplicateMode,
    processedAt,
    approvedTransactions: sortApprovedTransactions(baseSnapshot.approvedTransactions),
    approvalQueue: sortApprovalQueue(baseSnapshot.approvalQueue),
    accountSummaries: sortAccountSummaries(baseSnapshot.accountSummaries),
    unmatchedEntries: sortUnmatchedEntries(baseSnapshot.unmatchedEntries),
    duplicates,
    skippedDuplicateCount:
      input.options.duplicateMode === "skip" ? duplicates.length : 0,
    inferredAccounts: sortAccountSummaries(inferredAccounts),
    backupSnapshot,
  };
}

function cloneApprovalQueue(
  queue: readonly ApprovalQueueItem[],
): ApprovalQueueItem[] {
  return queue.map((item) => ({ ...item }));
}

function cloneApprovedTransactions(
  transactions: readonly ApprovedTransaction[],
): ApprovedTransaction[] {
  return transactions.map((item) => ({ ...item }));
}

function cloneAccountSummaries(
  summaries: readonly AccountSummary[],
): AccountSummary[] {
  return summaries.map((item) => ({ ...item }));
}

function cloneUnmatchedEntries(
  entries: readonly UnmatchedSmsEntry[],
): UnmatchedSmsEntry[] {
  return entries.map((item) => ({ ...item }));
}

function compareAscending(left: string, right: string): number {
  return toTimestamp(left) - toTimestamp(right);
}

function compareDescending(left: string, right: string): number {
  return toTimestamp(right) - toTimestamp(left);
}

function toTimestamp(value: string): number {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function normalizeOptionalText(value: string | undefined): string | null {
  const normalized = value?.trim().toLowerCase();
  return normalized ? normalized : null;
}

function buildInferredAccountId(
  draft: Pick<
    ParsedTransactionDraft,
    "financialInstitution" | "accountChannel" | "accountReference" | "reference"
  >,
): string {
  const stableReference =
    normalizeOptionalText(draft.accountReference) ??
    normalizeOptionalText(draft.reference) ??
    draft.accountChannel;

  return `acct-${draft.financialInstitution}-${stableReference}`;
}

function formatMaskedAccountNumber(
  accountReference: string | undefined,
  accountChannel: ParsedTransactionDraft["accountChannel"],
): string {
  if (!accountReference) {
    return accountChannel === "cash" ? "Pocket cash" : "Unknown account";
  }

  return `**** ${accountReference.slice(-4)}`;
}

function createInferredAccountSummary(
  draft: ParsedTransactionDraft,
): AccountSummary {
  const preferredBalanceMinor =
    draft.reportedBalanceMinor ?? draft.runningBalanceMinor ?? 0;
  const accountReference = draft.accountReference?.trim();

  return {
    accountId: buildInferredAccountId(draft),
    institutionName: FINANCIAL_INSTITUTION_LABELS[draft.financialInstitution],
    maskedAccountNumber: formatMaskedAccountNumber(
      accountReference,
      draft.accountChannel,
    ),
    fullAccountNumber: accountReference,
    balanceMinor: preferredBalanceMinor,
    currencyCode: draft.currencyCode,
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

function findExistingAccountIndex(
  summaries: readonly AccountSummary[],
  draft: ParsedTransactionDraft,
): number {
  const inferredAccountId = buildInferredAccountId(draft);
  const normalizedInstitutionName =
    FINANCIAL_INSTITUTION_LABELS[draft.financialInstitution].toLowerCase();
  const normalizedAccountReference =
    normalizeOptionalText(draft.accountReference) ??
    normalizeOptionalText(draft.reference);

  return summaries.findIndex((summary) => {
    if (summary.accountId === inferredAccountId) {
      return true;
    }

    if (
      summary.channel !== draft.accountChannel ||
      summary.institutionName.trim().toLowerCase() !== normalizedInstitutionName
    ) {
      return false;
    }

    if (!normalizedAccountReference) {
      return !summary.fullAccountNumber;
    }

    return normalizeOptionalText(summary.fullAccountNumber) === normalizedAccountReference;
  });
}

function ensureAccountSummary(
  summaries: AccountSummary[],
  draft: ParsedTransactionDraft,
  inferredAccounts: AccountSummary[],
): AccountSummary {
  const inferredSummary = createInferredAccountSummary(draft);
  const existingIndex = findExistingAccountIndex(summaries, draft);

  if (existingIndex === -1) {
    summaries.push(inferredSummary);
    inferredAccounts.push({ ...inferredSummary });
    return inferredSummary;
  }

  const existingSummary = summaries[existingIndex];
  const mergedSummary: AccountSummary = {
    ...existingSummary,
    accountId: existingSummary.accountId || inferredSummary.accountId,
    institutionName: existingSummary.institutionName || inferredSummary.institutionName,
    maskedAccountNumber:
      existingSummary.maskedAccountNumber || inferredSummary.maskedAccountNumber,
    fullAccountNumber:
      existingSummary.fullAccountNumber ?? inferredSummary.fullAccountNumber,
    balanceMinor: inferredSummary.balanceMinor,
    currencyCode: inferredSummary.currencyCode,
    channel: existingSummary.channel,
    iconName: existingSummary.iconName || inferredSummary.iconName,
    tone: existingSummary.tone || inferredSummary.tone,
  };

  summaries[existingIndex] = mergedSummary;
  return mergedSummary;
}

function shouldRouteToApprovalQueue(
  occurredAt: string,
  processedAt: string,
  recentReviewDays: number,
): boolean {
  if (recentReviewDays <= 0) {
    return false;
  }

  return toTimestamp(occurredAt) >= toTimestamp(processedAt) - recentReviewDays * DAY_IN_MS;
}

function buildImportIdSuffix(draft: ParsedTransactionDraft): string {
  return normalizeOptionalText(draft.draftId)?.replace(/[^a-z0-9]+/g, "-") ?? "draft";
}

function createApprovalQueueItem(
  draft: ParsedTransactionDraft,
  queuedAt: string,
  accountId: string,
): ApprovalQueueItem {
  return {
    ...draft,
    note: draft.note ?? "",
    queueEntryId: `queue-import-${accountId}-${buildImportIdSuffix(draft)}`,
    queuedAt,
    approvalStatus: "pending_approval",
  };
}

function createApprovedTransaction(
  draft: ParsedTransactionDraft,
  approvedAt: string,
  accountId: string,
): ApprovedTransaction {
  return {
    ...draft,
    note: draft.note ?? "",
    transactionId: `tx-import-${accountId}-${buildImportIdSuffix(draft)}`,
    approvedAt,
    approvalStatus: "approved",
  };
}

function buildRawMessageDuplicateKey(
  draft: Pick<
    ParsedTransactionDraft,
    "rawMessageId" | "financialInstitution" | "accountChannel" | "accountReference" | "reference"
  >,
): string {
  return [
    "raw",
    draft.rawMessageId.trim().toLowerCase(),
    buildHistoricalImportAccountKey(draft),
  ].join("|");
}

function buildBusinessDuplicateKey(
  draft: Pick<
    ParsedTransactionDraft,
    | "financialInstitution"
    | "accountChannel"
    | "accountReference"
    | "reference"
    | "transactionDirection"
    | "amountMinor"
    | "feeMinor"
    | "occurredAt"
  >,
): string {
  return [
    "business",
    buildHistoricalImportAccountKey(draft),
    draft.transactionDirection,
    draft.amountMinor,
    draft.feeMinor,
    normalizeOptionalText(draft.reference) ?? "",
    draft.occurredAt,
  ].join("|");
}

function buildDuplicateKeys(
  draft: Pick<
    ParsedTransactionDraft,
    | "rawMessageId"
    | "financialInstitution"
    | "accountChannel"
    | "accountReference"
    | "reference"
    | "transactionDirection"
    | "amountMinor"
    | "feeMinor"
    | "occurredAt"
  >,
): string[] {
  return [buildRawMessageDuplicateKey(draft), buildBusinessDuplicateKey(draft)];
}

function seedDuplicateTracker<T extends ParsedTransactionDraft>(
  tracker: Map<string, DuplicateTrackerEntry>,
  entries: readonly T[],
  kind: DuplicateTrackerEntry["kind"],
  getId: (entry: T) => string,
): void {
  for (const entry of entries) {
    registerDuplicateCandidate(tracker, entry, {
      id: getId(entry),
      kind,
    });
  }
}

function registerDuplicateCandidate(
  tracker: Map<string, DuplicateTrackerEntry>,
  draft: Pick<
    ParsedTransactionDraft,
    | "rawMessageId"
    | "financialInstitution"
    | "accountChannel"
    | "accountReference"
    | "reference"
    | "transactionDirection"
    | "amountMinor"
    | "feeMinor"
    | "occurredAt"
  >,
  entry: DuplicateTrackerEntry,
): void {
  for (const key of buildDuplicateKeys(draft)) {
    if (!tracker.has(key)) {
      tracker.set(key, entry);
    }
  }
}

function findDuplicateEntry(
  tracker: Map<string, DuplicateTrackerEntry>,
  draft: ParsedTransactionDraft,
): DuplicateTrackerEntry | null {
  for (const key of buildDuplicateKeys(draft)) {
    const match = tracker.get(key);
    if (match) {
      return match;
    }
  }

  return null;
}

function sortApprovedTransactions(
  transactions: readonly ApprovedTransaction[],
): ApprovedTransaction[] {
  return [...transactions].sort((left, right) =>
    compareDescending(left.occurredAt, right.occurredAt),
  );
}

function sortApprovalQueue(
  queue: readonly ApprovalQueueItem[],
): ApprovalQueueItem[] {
  return [...queue].sort((left, right) =>
    compareDescending(left.occurredAt, right.occurredAt),
  );
}

function sortAccountSummaries(
  summaries: readonly AccountSummary[],
): AccountSummary[] {
  return [...summaries].sort((left, right) =>
    left.accountId.localeCompare(right.accountId),
  );
}

function sortUnmatchedEntries(
  entries: readonly UnmatchedSmsEntry[],
): UnmatchedSmsEntry[] {
  return [...entries].sort((left, right) =>
    compareDescending(left.receivedAt, right.receivedAt),
  );
}
