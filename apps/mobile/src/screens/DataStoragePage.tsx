import { useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react";

import {
  FINANCIAL_INSTITUTION_LABELS,
  type AccountSummary,
  type ApprovalQueueItem,
  type ApprovedTransaction,
  type HistoricalImportDuplicateMode,
  type HistoricalImportMode,
  type ParsedTransactionDraft,
  type UnmatchedSmsEntry,
} from "@omni-sync/core";
import {
  buildBudgetSummaries,
  buildHistoricalImportAccountKey,
  transactionStore,
  useTransactionStore,
} from "@omni-sync/database";
import { MaterialSymbol } from "@omni-sync/ui";

import {
  MotionPanel,
  StatusChip,
  pressableClass,
} from "../components/settingsMotionPrimitives";
import {
  persistImportDuplicateModePreference,
  persistImportModePreference,
  persistImportReviewDaysPreference,
  readImportDuplicateModePreference,
  readImportModePreference,
  readImportReviewDaysPreference,
} from "../preferences/storagePreferences";

type StatusTone = "success" | "warning" | "error";
type ActionState = "idle" | "working" | "done";

interface FinanceSnapshot {
  approvedTransactions: ApprovedTransaction[];
  approvalQueue: ApprovalQueueItem[];
  unmatchedMessages: UnmatchedSmsEntry[];
  accountSummaries: AccountSummary[];
}

interface HistoricalImportPackage {
  kind: "trackwallet-historical-import";
  version: 1;
  createdAt: string;
  drafts: ParsedTransactionDraft[];
  unmatchedEntries: UnmatchedSmsEntry[];
}

interface DataExportPackage extends FinanceSnapshot {
  kind: "trackwallet-data-export";
  version: 1;
  createdAt: string;
}

interface BackupPackage {
  kind: "trackwallet-authority-backup";
  version: 1;
  createdAt: string;
  finance: FinanceSnapshot;
  defaults: {
    importMode: HistoricalImportMode;
    duplicateMode: HistoricalImportDuplicateMode;
    reviewWindowDays: number;
  };
}

interface PendingImportPackage {
  fileName: string;
  createdAt: string;
  drafts: ParsedTransactionDraft[];
  unmatchedEntries: UnmatchedSmsEntry[];
}

interface PendingRestorePackage {
  fileName: string;
  createdAt: string;
  finance: FinanceSnapshot;
  defaults?: BackupPackage["defaults"];
}

interface ImportPreviewAccount {
  key: string;
  label: string;
  draftCount: number;
  defaultReviewDays: number;
}

interface ImportSummary {
  approvedCount: number;
  reviewCount: number;
  duplicateCount: number;
  inferredAccountCount: number;
  unmatchedCount: number;
  processedAt: string;
  backupCreated: boolean;
}

const importModeOptions: Array<{
  value: HistoricalImportMode;
  label: string;
  detail: string;
}> = [
  {
    value: "backup_then_replace",
    label: "Back up, then replace",
    detail: "Recommended for full history resets.",
  },
  {
    value: "merge",
    label: "Merge",
    detail: "Keep existing data and append new history.",
  },
  {
    value: "replace",
    label: "Replace",
    detail: "Delete current finance data before importing.",
  },
];

const duplicateModeOptions: Array<{
  value: HistoricalImportDuplicateMode;
  label: string;
  detail: string;
  comingSoon?: boolean;
}> = [
  {
    value: "skip",
    label: "Skip duplicates",
    detail: "Recommended until duplicate review is built.",
  },
  {
    value: "review",
    label: "Review duplicates",
    detail: "The mode flag exists, but the review inbox is still coming.",
    comingSoon: true,
  },
];

const reviewDayOptions = [0, 10, 20, 30, 45] as const;

function formatTimestamp(value: string) {
  const timestamp = new Date(value);

  if (Number.isNaN(timestamp.getTime())) {
    return "Unknown time";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(timestamp);
}

function formatApproxSize(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isValidDateString(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    !Number.isNaN(new Date(value).getTime())
  );
}

function sanitizeCreatedAt(value: unknown): string {
  return isValidDateString(value) ? value : new Date().toISOString();
}

function isParsedTransactionDraft(value: unknown): value is ParsedTransactionDraft {
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

function isUnmatchedSmsEntry(value: unknown): value is UnmatchedSmsEntry {
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

function isApprovalQueueItem(value: unknown): value is ApprovalQueueItem {
  return (
    isParsedTransactionDraft(value) &&
    isRecord(value) &&
    typeof value.queueEntryId === "string" &&
    isValidDateString(value.queuedAt) &&
    typeof value.note === "string"
  );
}

function isApprovedTransaction(value: unknown): value is ApprovedTransaction {
  return (
    isParsedTransactionDraft(value) &&
    isRecord(value) &&
    typeof value.transactionId === "string" &&
    isValidDateString(value.approvedAt) &&
    typeof value.note === "string"
  );
}

function isAccountSummary(value: unknown): value is AccountSummary {
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

function isHistoricalImportPackage(value: unknown): value is HistoricalImportPackage {
  if (!isRecord(value)) {
    return false;
  }

  return (
    Array.isArray(value.drafts) &&
    value.drafts.every(isParsedTransactionDraft) &&
    (!Array.isArray(value.unmatchedEntries) ||
      value.unmatchedEntries.every(isUnmatchedSmsEntry))
  );
}

function isBackupPackage(value: unknown): value is BackupPackage {
  if (!isRecord(value) || !isRecord(value.finance)) {
    return false;
  }

  return (
    Array.isArray(value.finance.approvedTransactions) &&
    value.finance.approvedTransactions.every(isApprovedTransaction) &&
    Array.isArray(value.finance.approvalQueue) &&
    value.finance.approvalQueue.every(isApprovalQueueItem) &&
    Array.isArray(value.finance.unmatchedMessages) &&
    value.finance.unmatchedMessages.every(isUnmatchedSmsEntry) &&
    Array.isArray(value.finance.accountSummaries) &&
    value.finance.accountSummaries.every(isAccountSummary)
  );
}

function buildFinanceSnapshotFromStore(): FinanceSnapshot {
  const state = transactionStore.getState();

  return {
    approvedTransactions: [...state.approvedTransactions],
    approvalQueue: [...state.approvalQueue],
    unmatchedMessages: [...state.unmatchedMessages],
    accountSummaries: [...state.accountSummaries],
  };
}

function triggerJsonDownload(filename: string, payload: unknown) {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return;
  }

  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = filename;
  anchor.click();

  window.setTimeout(() => {
    window.URL.revokeObjectURL(url);
  }, 0);
}

function normalizeReviewDaysLabel(reviewDays: number) {
  if (reviewDays <= 0) {
    return "Send straight to ledger";
  }

  return `Queue last ${reviewDays} days for review`;
}

function StatusToast({
  message,
  tone,
}: {
  message: string;
  tone: StatusTone;
}) {
  const toneClass =
    tone === "success"
      ? "border-primary/20 bg-primary-container/70 text-on-primary-fixed"
      : tone === "warning"
        ? "border-tertiary/20 bg-tertiary-container/40 text-on-tertiary-container"
        : "border-error/20 bg-error-container/80 text-on-error-container";

  const icon =
    tone === "success" ? "check_circle" : tone === "warning" ? "error" : "warning";

  return (
    <MotionPanel className="sticky top-2 z-30 flex justify-start" variant="toast">
      <div
        className={`flex max-w-xl items-start gap-3 rounded-2xl border px-4 py-3 shadow-[0_8px_24px_rgba(46,50,48,0.08)] ${toneClass}`}
      >
        <MaterialSymbol className="mt-0.5 text-[18px]" filled name={icon} />
        <p className="text-sm leading-6">{message}</p>
      </div>
    </MotionPanel>
  );
}

function ActionStatusButton({
  actionState,
  idleLabel,
  workingLabel,
  doneLabel,
  className,
  onClick,
  disabled = false,
}: {
  actionState: ActionState;
  idleLabel: string;
  workingLabel: string;
  doneLabel: string;
  className: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      className={`${className} ${pressableClass} ${
        disabled ? "cursor-not-allowed opacity-45" : ""
      }`}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {actionState === "done" ? (
        <>
          <MaterialSymbol filled name="check" />
          {doneLabel}
        </>
      ) : actionState === "working" ? (
        <>
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" />
          {workingLabel}
        </>
      ) : (
        idleLabel
      )}
    </button>
  );
}

function ChoiceChip({
  active,
  title,
  detail,
  onClick,
  disabled = false,
  trailing,
}: {
  active: boolean;
  title: string;
  detail: string;
  onClick: () => void;
  disabled?: boolean;
  trailing?: ReactNode;
}) {
  return (
    <button
      className={`rounded-[22px] border px-4 py-3 text-left transition ${pressableClass} ${
        active
          ? "border-primary/30 bg-primary-container/55 text-on-primary-fixed"
          : "border-outline-variant/20 bg-surface text-on-surface"
      } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">{title}</div>
          <div className="mt-1 text-xs leading-5 text-on-surface-variant">
            {detail}
          </div>
        </div>
        {trailing}
      </div>
    </button>
  );
}

function ComingSoonCard({
  title,
  detail,
}: {
  title: string;
  detail: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-[24px] border border-outline-variant/18 bg-surface-container-low p-4">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(196,166,106,0.18),transparent_45%)]" />
      <div className="pointer-events-none absolute inset-0 backdrop-blur-[3px]" />
      <div className="relative z-10 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-on-surface">{title}</p>
          <p className="mt-1 text-xs leading-5 text-on-surface-variant">
            {detail}
          </p>
        </div>
        <StatusChip icon="schedule" tone="warning">
          Coming soon
        </StatusChip>
      </div>
    </div>
  );
}

function StorageActionRow({
  title,
  detail,
  icon,
  onClick,
  state = "idle",
  danger = false,
}: {
  title: string;
  detail: string;
  icon: string;
  onClick: () => void;
  state?: ActionState;
  danger?: boolean;
}) {
  const borderClass = danger
    ? "border-error/20 bg-error-container/20 hover:bg-error-container/40"
    : "border-outline-variant/20 bg-surface hover:border-primary/30";
  const iconWrapClass = danger
    ? "bg-error/10 text-error"
    : "bg-primary/10 text-primary";
  const titleClass = danger ? "text-error" : "text-on-surface";
  const detailClass = danger ? "text-on-error-container" : "text-on-surface-variant";

  return (
    <button
      className={`group flex w-full items-center justify-between rounded-lg border p-4 text-left transition-colors ${borderClass} ${pressableClass}`}
      onClick={onClick}
      type="button"
    >
      <div className="flex items-center gap-4">
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-full ${iconWrapClass}`}
        >
          <MaterialSymbol name={icon} />
        </div>
        <div>
          <p className={`font-bold ${titleClass}`}>{title}</p>
          <p className={`text-sm ${detailClass}`}>{detail}</p>
        </div>
      </div>
      {state === "working" ? (
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-current border-r-transparent text-on-surface-variant" />
      ) : state === "done" ? (
        <MaterialSymbol className={danger ? "text-error" : "text-primary"} filled name="check_circle" />
      ) : (
        <MaterialSymbol
          className={danger ? "text-error" : "text-on-surface-variant"}
          name={danger ? "warning" : "chevron_right"}
        />
      )}
    </button>
  );
}

export function DataStoragePage() {
  const approvedTransactions = useTransactionStore((state) => state.approvedTransactions);
  const approvalQueue = useTransactionStore((state) => state.approvalQueue);
  const unmatchedMessages = useTransactionStore((state) => state.unmatchedMessages);
  const accountSummaries = useTransactionStore((state) => state.accountSummaries);
  const importHistoricalData = useTransactionStore((state) => state.importHistoricalData);
  const clearAllData = useTransactionStore((state) => state.clearAllData);

  const importInputRef = useRef<HTMLInputElement | null>(null);
  const restoreInputRef = useRef<HTMLInputElement | null>(null);

  const [importMode, setImportMode] = useState<HistoricalImportMode>(() =>
    readImportModePreference(),
  );
  const [duplicateMode, setDuplicateMode] =
    useState<HistoricalImportDuplicateMode>(() =>
      readImportDuplicateModePreference(),
    );
  const [reviewWindowDays, setReviewWindowDays] = useState<number>(() =>
    readImportReviewDaysPreference(),
  );
  const [saveDefaultsState, setSaveDefaultsState] = useState<ActionState>("idle");
  const [exportState, setExportState] = useState<ActionState>("idle");
  const [backupState, setBackupState] = useState<ActionState>("idle");
  const [importState, setImportState] = useState<ActionState>("idle");
  const [restoreState, setRestoreState] = useState<ActionState>("idle");
  const [clearState, setClearState] = useState<ActionState>("idle");
  const [statusToast, setStatusToast] = useState<{
    tone: StatusTone;
    message: string;
  } | null>(null);
  const [pendingImportPackage, setPendingImportPackage] =
    useState<PendingImportPackage | null>(null);
  const [pendingRestorePackage, setPendingRestorePackage] =
    useState<PendingRestorePackage | null>(null);
  const [reviewWindowDaysByAccountKey, setReviewWindowDaysByAccountKey] =
    useState<Record<string, number>>({});
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);

  const storageSnapshotSize = useMemo(() => {
    const snapshot = buildFinanceSnapshotFromStore();
    return JSON.stringify(snapshot).length;
  }, [accountSummaries, approvalQueue, approvedTransactions, unmatchedMessages]);

  const accountsWithReportedBalanceCount = useMemo(
    () =>
      approvedTransactions.filter(
        (transaction) => typeof transaction.reportedBalanceMinor === "number",
      ).length,
    [approvedTransactions],
  );

  const storageHealthScore = useMemo(() => {
    const trackedItemCount =
      approvedTransactions.length + approvalQueue.length + unmatchedMessages.length;

    if (trackedItemCount <= 0) {
      return 92;
    }

    const penalty = Math.min(
      36,
      unmatchedMessages.length * 5 + Math.max(0, approvalQueue.length - 8),
    );

    return Math.max(58, 96 - penalty);
  }, [approvalQueue.length, approvedTransactions.length, unmatchedMessages.length]);

  const pendingImportAccounts = useMemo<ImportPreviewAccount[]>(() => {
    if (!pendingImportPackage) {
      return [];
    }

    const groups = new Map<
      string,
      { draft: ParsedTransactionDraft; count: number }
    >();

    for (const draft of pendingImportPackage.drafts) {
      const key = buildHistoricalImportAccountKey(draft);
      const current = groups.get(key);

      if (current) {
        current.count += 1;
      } else {
        groups.set(key, { draft, count: 1 });
      }
    }

    return [...groups.entries()].map(([key, value]) => {
      const accountHint =
        value.draft.accountReference ??
        value.draft.reference ??
        value.draft.accountChannel;
      const compactHint =
        accountHint.length > 10 ? accountHint.slice(-10) : accountHint;

      return {
        key,
        label: `${FINANCIAL_INSTITUTION_LABELS[value.draft.financialInstitution]} • ${compactHint}`,
        draftCount: value.count,
        defaultReviewDays:
          reviewWindowDaysByAccountKey[key] ?? reviewWindowDays,
      };
    });
  }, [pendingImportPackage, reviewWindowDays, reviewWindowDaysByAccountKey]);

  function showStatus(message: string, tone: StatusTone) {
    setStatusToast({ message, tone });
    window.setTimeout(() => setStatusToast(null), 2600);
  }

  function completeActionState(setter: (value: ActionState) => void) {
    setter("done");
    window.setTimeout(() => setter("idle"), 1200);
  }

  function persistDefaults() {
    setSaveDefaultsState("working");

    window.setTimeout(() => {
      persistImportModePreference(importMode);
      persistImportDuplicateModePreference(duplicateMode);
      persistImportReviewDaysPreference(reviewWindowDays);
      completeActionState(setSaveDefaultsState);
      showStatus("Import defaults were saved locally on this phone.", "success");
    }, 420);
  }

  function exportFinanceData() {
    setExportState("working");

    window.setTimeout(() => {
      const payload: DataExportPackage = {
        kind: "trackwallet-data-export",
        version: 1,
        createdAt: new Date().toISOString(),
        ...buildFinanceSnapshotFromStore(),
      };

      triggerJsonDownload(
        `trackwallet-data-export-${new Date().toISOString().slice(0, 10)}.json`,
        payload,
      );
      completeActionState(setExportState);
      showStatus("Finance export was downloaded for this local preview.", "success");
    }, 260);
  }

  function exportBackupSnapshot() {
    setBackupState("working");

    window.setTimeout(() => {
      const payload: BackupPackage = {
        kind: "trackwallet-authority-backup",
        version: 1,
        createdAt: new Date().toISOString(),
        finance: buildFinanceSnapshotFromStore(),
        defaults: {
          importMode,
          duplicateMode,
          reviewWindowDays,
        },
      };

      triggerJsonDownload(
        `trackwallet-backup-${new Date().toISOString().slice(0, 10)}.json`,
        payload,
      );
      completeActionState(setBackupState);
      showStatus("Backup snapshot was downloaded before any destructive change.", "success");
    }, 260);
  }

  async function handleHistoricalImportFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as unknown;

      if (!isHistoricalImportPackage(parsed)) {
        throw new Error("Unsupported historical import package.");
      }

      setPendingImportPackage({
        fileName: file.name,
        createdAt: sanitizeCreatedAt(parsed.createdAt),
        drafts: parsed.drafts,
        unmatchedEntries: Array.isArray(parsed.unmatchedEntries)
          ? parsed.unmatchedEntries
          : [],
      });
      setReviewWindowDaysByAccountKey({});
      setImportSummary(null);
      showStatus(
        `Loaded ${parsed.drafts.length} historical drafts from ${file.name}.`,
        "success",
      );
    } catch (error) {
      showStatus(
        error instanceof Error
          ? error.message
          : "Could not read this historical import file.",
        "error",
      );
    }
  }

  async function handleRestoreFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as unknown;

      if (!isBackupPackage(parsed)) {
        throw new Error("Unsupported backup package.");
      }

      setPendingRestorePackage({
        fileName: file.name,
        createdAt: sanitizeCreatedAt(parsed.createdAt),
        finance: parsed.finance,
        defaults: isRecord(parsed.defaults)
          ? {
              importMode:
                parsed.defaults.importMode === "merge" ||
                parsed.defaults.importMode === "replace" ||
                parsed.defaults.importMode === "backup_then_replace"
                  ? parsed.defaults.importMode
                  : "backup_then_replace",
              duplicateMode: "skip",
              reviewWindowDays:
                typeof parsed.defaults.reviewWindowDays === "number"
                  ? parsed.defaults.reviewWindowDays
                  : 20,
            }
          : undefined,
      });
      showStatus(`Loaded backup snapshot from ${file.name}.`, "success");
    } catch (error) {
      showStatus(
        error instanceof Error
          ? error.message
          : "Could not read this backup package.",
        "error",
      );
    }
  }

  async function applyHistoricalImport() {
    if (!pendingImportPackage) {
      return;
    }

    setImportState("working");

    try {
      const result = await importHistoricalData({
        drafts: pendingImportPackage.drafts,
        unmatchedEntries: pendingImportPackage.unmatchedEntries,
        mode: importMode,
        duplicateMode,
        reviewWindowDays,
        reviewWindowDaysByAccountKey,
        importedAt: pendingImportPackage.createdAt,
      });

      if (result.backupSnapshot) {
        const backupPayload: BackupPackage = {
          kind: "trackwallet-authority-backup",
          version: 1,
          createdAt: result.processedAt,
          finance: {
            approvedTransactions: result.backupSnapshot.approvedTransactions,
            approvalQueue: result.backupSnapshot.approvalQueue,
            unmatchedMessages: result.backupSnapshot.unmatchedEntries,
            accountSummaries: result.backupSnapshot.accountSummaries,
          },
          defaults: {
            importMode,
            duplicateMode,
            reviewWindowDays,
          },
        };

        triggerJsonDownload(
          `trackwallet-pre-import-backup-${result.processedAt.slice(0, 10)}.json`,
          backupPayload,
        );
      }

      const importedDraftIds = new Set(
        pendingImportPackage.drafts.map((draft) => draft.draftId),
      );

      setImportSummary({
        approvedCount: result.approvedTransactions.filter((transaction) =>
          importedDraftIds.has(transaction.draftId),
        ).length,
        reviewCount: result.approvalQueue.filter((queueItem) =>
          importedDraftIds.has(queueItem.draftId),
        ).length,
        duplicateCount: result.duplicates.length,
        inferredAccountCount: result.inferredAccounts.length,
        unmatchedCount: pendingImportPackage.unmatchedEntries.length,
        processedAt: result.processedAt,
        backupCreated: Boolean(result.backupSnapshot),
      });

      setPendingImportPackage(null);
      setReviewWindowDaysByAccountKey({});
      completeActionState(setImportState);
      showStatus(
        "Historical import finished in the local preview authority.",
        "success",
      );
    } catch (error) {
      setImportState("idle");
      showStatus(
        error instanceof Error
          ? error.message
          : "Historical import failed for this package.",
        "error",
      );
    }
  }

  function applyRestoreBackup() {
    if (!pendingRestorePackage) {
      return;
    }

    setRestoreState("working");

    window.setTimeout(() => {
      const finance = pendingRestorePackage.finance;

      transactionStore.setState({
        hasInitialized: true,
        approvedTransactions: [...finance.approvedTransactions],
        approvalQueue: [...finance.approvalQueue],
        unmatchedMessages: [...finance.unmatchedMessages],
        accountSummaries: [...finance.accountSummaries],
        budgetSummaries: buildBudgetSummaries(finance.approvedTransactions),
        activeQueueEntryId: null,
      });

      if (pendingRestorePackage.defaults) {
        persistImportModePreference(pendingRestorePackage.defaults.importMode);
        persistImportDuplicateModePreference(
          pendingRestorePackage.defaults.duplicateMode,
        );
        persistImportReviewDaysPreference(
          pendingRestorePackage.defaults.reviewWindowDays,
        );
        setImportMode(pendingRestorePackage.defaults.importMode);
        setDuplicateMode(pendingRestorePackage.defaults.duplicateMode);
        setReviewWindowDays(pendingRestorePackage.defaults.reviewWindowDays);
      }

      setPendingRestorePackage(null);
      completeActionState(setRestoreState);
      showStatus("Backup snapshot restored into the local preview authority.", "success");
    }, 320);
  }

  function clearLocalFinanceData() {
    setClearState("working");

    window.setTimeout(() => {
      clearAllData();
      completeActionState(setClearState);
      showStatus("Local finance data was cleared from this preview runtime.", "warning");
    }, 320);
  }

  return (
    <section className="space-y-8">
      {statusToast ? (
        <StatusToast message={statusToast.message} tone={statusToast.tone} />
      ) : null}

      <input
        accept=".json,application/json"
        className="hidden"
        onChange={handleHistoricalImportFile}
        ref={importInputRef}
        type="file"
      />
      <input
        accept=".json,application/json"
        className="hidden"
        onChange={handleRestoreFile}
        ref={restoreInputRef}
        type="file"
      />

      <MotionPanel className="space-y-2">
        <h2 className="font-headline text-3xl font-semibold text-on-surface">
          Data & Storage
        </h2>
        <p className="max-w-3xl text-sm leading-6 text-on-surface-variant">
          Configure how the local preview authority exports data, stages historical
          imports, preserves reported balances, and documents what still belongs to
          the native backend pass.
        </p>
      </MotionPanel>

      <div className="grid gap-6 lg:grid-cols-12">
        <MotionPanel
          className="space-y-5 rounded-[28px] border border-outline-variant/20 bg-surface-container p-6 shadow-[0_4px_20px_rgba(46,50,48,0.06)] lg:col-span-8"
          delay={60}
        >
          <div className="flex items-center gap-3">
            <MaterialSymbol className="text-3xl text-primary" name="database" />
            <div>
              <h3 className="font-headline text-2xl font-semibold text-on-surface">
                Database Management
              </h3>
              <p className="mt-1 text-sm leading-6 text-on-surface-variant">
                Keep the current phone-safe data tools obvious: export, backup,
                restore, historical import staging, and destructive reset.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <StorageActionRow
              detail="Create a portable JSON export of approved, queued, unmatched, and account state."
              icon="upload_file"
              onClick={exportFinanceData}
              state={exportState}
              title="Export JSON Backup"
            />
            <StorageActionRow
              detail="Package a restore-ready snapshot before any destructive import or cleanup."
              icon="inventory_2"
              onClick={exportBackupSnapshot}
              state={backupState}
              title="Create Backup Snapshot"
            />
            <StorageActionRow
              detail="Load a previously downloaded backup snapshot and prepare it for preview restore."
              icon="restore_page"
              onClick={() => restoreInputRef.current?.click()}
              title="Restore Backup Package"
            />
            <StorageActionRow
              detail="Choose a desktop history package and send it into the staged review flow below."
              icon="history"
              onClick={() => importInputRef.current?.click()}
              title="Import History Package"
            />
            <StorageActionRow
              danger
              detail="Clear the local preview runtime after you have already downloaded a recovery snapshot."
              icon="auto_delete"
              onClick={clearLocalFinanceData}
              state={clearState}
              title="Purge Local Cache"
            />
          </div>

          {pendingRestorePackage ? (
            <div className="rounded-[24px] border border-outline-variant/18 bg-surface p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-sm font-semibold text-on-surface">
                    Backup ready to restore
                  </p>
                  <p className="mt-1 text-xs leading-5 text-on-surface-variant">
                    {pendingRestorePackage.fileName} • created{" "}
                    {formatTimestamp(pendingRestorePackage.createdAt)}
                  </p>
                </div>
                <StatusChip icon="inventory_2" tone="neutral">
                  {pendingRestorePackage.finance.approvedTransactions.length} approved
                </StatusChip>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-[20px] border border-outline-variant/16 bg-surface-container-low px-4 py-3 text-sm text-on-surface-variant">
                  Queue: {pendingRestorePackage.finance.approvalQueue.length}
                </div>
                <div className="rounded-[20px] border border-outline-variant/16 bg-surface-container-low px-4 py-3 text-sm text-on-surface-variant">
                  Accounts: {pendingRestorePackage.finance.accountSummaries.length}
                </div>
              </div>
              <div className="mt-4 flex justify-end">
                <ActionStatusButton
                  actionState={restoreState}
                  className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-on-primary"
                  doneLabel="Restored"
                  idleLabel="Restore backup"
                  onClick={applyRestoreBackup}
                  workingLabel="Restoring..."
                />
              </div>
            </div>
          ) : null}
        </MotionPanel>

        <MotionPanel
          className="relative overflow-hidden rounded-[28px] bg-tertiary-container/55 p-6 shadow-[0_4px_20px_rgba(46,50,48,0.06)] lg:col-span-4"
          delay={110}
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.35),transparent_38%)]" />
          <div className="relative z-10 flex min-h-[280px] flex-col justify-between gap-5">
            <div className="space-y-3">
              <StatusChip icon="database" tone="success">
                Preview authority
              </StatusChip>
              <div>
                <p className="font-headline text-4xl font-semibold text-on-surface">
                  {storageHealthScore}% Health
                </p>
                <p className="mt-2 text-sm leading-6 text-on-surface-variant">
                  Snapshot size, queue load, unmatched rows, and approved storage
                  all still look stable in the local runtime.
                </p>
              </div>
            </div>
            <div className="space-y-4">
              <div className="h-2 overflow-hidden rounded-full bg-white/40">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${storageHealthScore}%` }}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                {[
                  ["Approx snapshot", formatApproxSize(storageSnapshotSize)],
                  ["Approved entries", String(approvedTransactions.length)],
                  ["In review", String(approvalQueue.length)],
                  ["Unmatched", String(unmatchedMessages.length)],
                ].map(([label, value]) => (
                  <div
                    className="rounded-[18px] border border-white/30 bg-white/45 px-4 py-3"
                    key={label}
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-on-surface-variant">
                      {label}
                    </p>
                    <p className="mt-2 font-headline text-2xl font-semibold text-on-surface">
                      {value}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </MotionPanel>

        <MotionPanel
          className="space-y-5 rounded-[28px] border border-outline-variant/20 bg-surface-container p-6 shadow-[0_4px_20px_rgba(46,50,48,0.06)] lg:col-span-6"
          delay={170}
        >
          <div className="flex items-center gap-3">
            <MaterialSymbol className="text-3xl text-primary" name="verified_user" />
            <div>
              <h3 className="font-headline text-2xl font-semibold text-on-surface">
                Data Integrity
              </h3>
              <p className="mt-1 text-sm leading-6 text-on-surface-variant">
                Choose how imported history merges, how duplicates are handled, and
                how many recent days should stop in review before reaching the ledger.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {importModeOptions.map((option) => (
              <ChoiceChip
                active={importMode === option.value}
                detail={option.detail}
                key={option.value}
                onClick={() => setImportMode(option.value)}
                title={option.label}
                trailing={
                  importMode === option.value ? (
                    <MaterialSymbol className="text-primary" filled name="check_circle" />
                  ) : null
                }
              />
            ))}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-on-surface">
                Duplicate handling
              </p>
              {duplicateMode === "review" ? (
                <StatusChip icon="schedule" tone="warning">
                  Coming soon
                </StatusChip>
              ) : null}
            </div>
            {duplicateModeOptions.map((option) => (
              <ChoiceChip
                active={duplicateMode === option.value}
                detail={option.detail}
                disabled={option.comingSoon}
                key={option.value}
                onClick={() => setDuplicateMode(option.value)}
                title={option.label}
              />
            ))}
          </div>

          <div>
            <p className="text-sm font-semibold text-on-surface">
              Review window
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {reviewDayOptions.map((dayCount) => {
                const isActive = reviewWindowDays === dayCount;
                return (
                  <button
                    className={`rounded-full px-3 py-2 text-xs font-semibold transition ${pressableClass} ${
                      isActive
                        ? "bg-primary text-on-primary"
                        : "bg-surface text-on-surface-variant"
                    }`}
                    key={dayCount}
                    onClick={() => setReviewWindowDays(dayCount)}
                    type="button"
                  >
                    {dayCount === 0 ? "Straight to ledger" : `${dayCount} days`}
                  </button>
                );
              })}
            </div>
            <p className="mt-3 text-sm text-on-surface-variant">
              {normalizeReviewDaysLabel(reviewWindowDays)}
            </p>
          </div>

          <ActionStatusButton
            actionState={saveDefaultsState}
            className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-primary px-5 py-3 font-semibold text-on-primary shadow-[0_4px_20px_rgba(46,50,48,0.08)]"
            doneLabel="Saved"
            idleLabel="Save import defaults"
            onClick={persistDefaults}
            workingLabel="Saving..."
          />
        </MotionPanel>

        <MotionPanel
          className="space-y-5 rounded-[28px] border border-outline-variant/20 bg-surface-container p-6 shadow-[0_4px_20px_rgba(46,50,48,0.06)] lg:col-span-6"
          delay={220}
        >
          <div className="flex items-center gap-3">
            <MaterialSymbol className="text-3xl text-primary" name="terminal" />
            <div>
              <h3 className="font-headline text-2xl font-semibold text-on-surface">
                Logging
              </h3>
              <p className="mt-1 text-sm leading-6 text-on-surface-variant">
                Make the current preview state readable without pretending the native
                audit and duplicate-review backends already exist.
              </p>
            </div>
          </div>

          <div className="rounded-[22px] border border-outline-variant/18 bg-surface px-4 py-4">
            <p className="text-sm font-semibold text-on-surface">System snapshot</p>
            <p className="mt-2 text-sm leading-6 text-on-surface-variant">
              Reported-balance events tracked: {accountsWithReportedBalanceCount}. Detected
              accounts: {accountSummaries.length}. This is still browser-preview storage,
              not native on-device SQLite.
            </p>
          </div>

          <ComingSoonCard
            detail="Granular runtime audit logs will be more honest once the native authority path owns storage and sync decisions."
            title="Verbose Debug Logging"
          />

          <button
            className={`group flex w-full items-center justify-between rounded-[22px] border border-outline-variant/18 bg-surface px-4 py-4 text-left transition ${pressableClass}`}
            onClick={() =>
              showStatus(
                "System log browsing is not wired into this preview runtime yet.",
                "warning",
              )
            }
            type="button"
          >
            <div>
              <p className="font-bold text-primary">View System Logs</p>
              <p className="mt-1 text-sm text-on-surface-variant">
                Open the parser, import, and authority event trail once the backing route exists.
              </p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <MaterialSymbol name="open_in_new" />
            </div>
          </button>
        </MotionPanel>
      </div>

      <MotionPanel
        className="space-y-5 rounded-[28px] border border-outline-variant/20 bg-surface-container-low p-6 shadow-[0_4px_20px_rgba(46,50,48,0.06)]"
        delay={220}
      >
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-on-surface-variant">
              Historical Import
            </p>
            <h3 className="mt-2 font-headline text-2xl font-semibold text-on-surface">
              Load desktop backfill
            </h3>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-on-surface-variant">
              Pick a JSON package from the desktop importer. Older history can go
              straight to the ledger, while the recent tail can be queued for
              review by day.
            </p>
          </div>
          <button
            className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-outline-variant/20 bg-surface px-5 py-3 text-sm font-semibold text-on-surface ${pressableClass}`}
            onClick={() => importInputRef.current?.click()}
            type="button"
          >
            <MaterialSymbol name="upload_file" />
            Choose history package
          </button>
        </div>

        {pendingImportPackage ? (
          <div className="space-y-5">
            <div className="rounded-[24px] border border-outline-variant/18 bg-surface p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-semibold text-on-surface">
                    {pendingImportPackage.fileName}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-on-surface-variant">
                    Loaded {formatTimestamp(pendingImportPackage.createdAt)} •{" "}
                    {pendingImportPackage.drafts.length} drafts •{" "}
                    {pendingImportPackage.unmatchedEntries.length} unmatched rows
                  </p>
                </div>
                <StatusChip icon="history" tone="success">
                  {normalizeReviewDaysLabel(reviewWindowDays)}
                </StatusChip>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {[
                {
                  label: "Detected account lanes",
                  value: String(pendingImportAccounts.length),
                },
                {
                  label: "Draft rows",
                  value: String(pendingImportPackage.drafts.length),
                },
                {
                  label: "Unmatched rows",
                  value: String(pendingImportPackage.unmatchedEntries.length),
                },
                {
                  label: "Mode",
                  value:
                    importMode === "backup_then_replace"
                      ? "Backup + replace"
                      : importMode === "replace"
                        ? "Replace"
                        : "Merge",
                },
              ].map((item) => (
                <div
                  className="rounded-[22px] border border-outline-variant/18 bg-surface px-4 py-4"
                  key={item.label}
                >
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-on-surface-variant">
                    {item.label}
                  </p>
                  <p className="mt-2 font-headline text-2xl font-semibold text-on-surface">
                    {item.value}
                  </p>
                </div>
              ))}
            </div>

            <div className="rounded-[24px] border border-outline-variant/18 bg-surface p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-on-surface">
                    Per-account review window
                  </p>
                  <p className="mt-1 text-xs leading-5 text-on-surface-variant">
                    Override the default review days for each detected account key.
                  </p>
                </div>
                <StatusChip icon="account_balance_wallet" tone="neutral">
                  Auto match or infer
                </StatusChip>
              </div>
              <div className="mt-4 space-y-3">
                {pendingImportAccounts.map((account) => (
                  <div
                    className="rounded-[20px] border border-outline-variant/16 bg-surface-container-low p-4"
                    key={account.key}
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-on-surface">
                          {account.label}
                        </p>
                        <p className="mt-1 text-xs leading-5 text-on-surface-variant">
                          {account.draftCount} imported rows. Unseen keys will create
                          inferred local accounts.
                        </p>
                      </div>
                      <select
                        className="rounded-xl border border-outline-variant/30 bg-surface px-3 py-2 text-sm text-on-surface"
                        onChange={(event) =>
                          setReviewWindowDaysByAccountKey((current) => ({
                            ...current,
                            [account.key]: Number(event.target.value),
                          }))
                        }
                        value={reviewWindowDaysByAccountKey[account.key] ?? account.defaultReviewDays}
                      >
                        {reviewDayOptions.map((dayCount) => (
                          <option key={dayCount} value={dayCount}>
                            {dayCount === 0 ? "Straight to ledger" : `${dayCount} days`}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <ActionStatusButton
                actionState={importState}
                className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-primary px-5 py-3 font-semibold text-on-primary shadow-[0_4px_20px_rgba(46,50,48,0.08)]"
                doneLabel="Imported"
                idleLabel="Apply historical import"
                onClick={applyHistoricalImport}
                workingLabel="Importing..."
              />
              <button
                className={`inline-flex min-h-12 items-center gap-2 rounded-2xl border border-outline-variant/20 bg-surface px-5 py-3 text-sm font-semibold text-on-surface ${pressableClass}`}
                onClick={() => {
                  setPendingImportPackage(null);
                  setReviewWindowDaysByAccountKey({});
                }}
                type="button"
              >
                Clear loaded package
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-[24px] border border-dashed border-outline-variant/24 bg-surface-container p-5 text-sm leading-6 text-on-surface-variant">
            No historical package loaded yet. The desktop pipeline should export
            JSON in a format this phone can stage and import.
          </div>
        )}

        {importSummary ? (
          <div className="rounded-[24px] border border-primary/18 bg-primary-container/28 p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold text-on-surface">
                  Last import summary
                </p>
                <p className="mt-1 text-xs leading-5 text-on-surface-variant">
                  Processed {formatTimestamp(importSummary.processedAt)}
                </p>
              </div>
              {importSummary.backupCreated ? (
                <StatusChip icon="download_done" tone="success">
                  Pre-import backup downloaded
                </StatusChip>
              ) : null}
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              {[
                ["Sent to ledger", importSummary.approvedCount],
                ["Queued for review", importSummary.reviewCount],
                ["Duplicates found", importSummary.duplicateCount],
                ["Inferred accounts", importSummary.inferredAccountCount],
                ["Unmatched rows", importSummary.unmatchedCount],
              ].map(([label, value]) => (
                <div
                  className="rounded-[20px] border border-outline-variant/16 bg-surface/80 px-4 py-4"
                  key={label}
                >
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-on-surface-variant">
                    {label}
                  </p>
                  <p className="mt-2 font-headline text-2xl font-semibold text-on-surface">
                    {value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </MotionPanel>

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <MotionPanel
          className="space-y-4 rounded-[28px] border border-outline-variant/20 bg-surface-container-low p-6 shadow-[0_4px_20px_rgba(46,50,48,0.06)]"
          delay={280}
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-on-surface-variant">
              Balance checks
            </p>
            <h3 className="mt-2 font-headline text-2xl font-semibold text-on-surface">
              Reported balance detection
            </h3>
            <p className="mt-2 text-sm leading-6 text-on-surface-variant">
              We already preserve bank-reported totals when the SMS provides them.
              The reconciliation queue that explains deltas is the next backend phase.
            </p>
          </div>
          <div className="rounded-[24px] border border-outline-variant/18 bg-surface p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-on-surface-variant">
              Reported balance events
            </p>
            <p className="mt-2 font-headline text-3xl font-semibold text-on-surface">
              {accountsWithReportedBalanceCount}
            </p>
            <p className="mt-2 text-sm text-on-surface-variant">
              Stored for later truth checks against computed balances.
            </p>
          </div>
          <ComingSoonCard
            detail="The model exists, but mismatch resolution still belongs to the repository-backed authority pass."
            title="Mismatch review and reconciliation queue"
          />
        </MotionPanel>

        <MotionPanel
          className="space-y-4 rounded-[28px] border border-outline-variant/20 bg-surface-container-low p-6 shadow-[0_4px_20px_rgba(46,50,48,0.06)]"
          delay={330}
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-on-surface-variant">
              Advanced
            </p>
            <h3 className="mt-2 font-headline text-2xl font-semibold text-on-surface">
              Native authority boundary
            </h3>
            <p className="mt-2 text-sm leading-6 text-on-surface-variant">
              This screen handles the local preview path. Native mobile SQLite and
              full duplicate-review tooling still need the backend authority pass.
            </p>
          </div>
          <ComingSoonCard
            detail="The mobile shell can stage the policy now, but the actual duplicate review inbox still needs dedicated UI."
            title="Duplicate review flow"
          />
          <ComingSoonCard
            detail="The adapter exists as a future target, but the native on-device SQLite authority is not wired into the mobile runtime yet."
            title="Native mobile database"
          />
        </MotionPanel>
      </div>

      <MotionPanel
        className="space-y-4 rounded-[28px] border border-error/18 bg-error-container/14 p-6 shadow-[0_4px_20px_rgba(46,50,48,0.04)]"
        delay={380}
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-error">
            Safety
          </p>
          <h3 className="mt-2 font-headline text-2xl font-semibold text-on-surface">
            Clear local finance data
          </h3>
          <p className="mt-2 text-sm leading-6 text-on-surface-variant">
            This wipes the local preview runtime on this phone. Use a backup
            snapshot first if you want a way back.
          </p>
        </div>
        <ActionStatusButton
          actionState={clearState}
          className="inline-flex min-h-12 items-center gap-2 rounded-2xl border border-error/24 bg-error/10 px-5 py-3 font-semibold text-error"
          doneLabel="Cleared"
          idleLabel="Clear local data"
          onClick={clearLocalFinanceData}
          workingLabel="Clearing..."
        />
      </MotionPanel>
    </section>
  );
}
