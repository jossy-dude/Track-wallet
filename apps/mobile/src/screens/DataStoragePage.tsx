import { useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react";

import {
  buildBackupPackage,
  buildHistoricalImportAccountKey,
  cloneDefaultParserTemplates,
  FINANCIAL_INSTITUTION_LABELS,
  isBackupPackage,
  isHistoricalImportPackage,
  resolveParserTemplateWorkspace,
  sanitizeCreatedAt,
  sanitizeHistoricalImportDefaults,
  type BackupPackage,
  type DataExportPackage,
  type FinanceSnapshot,
  type HistoricalImportDefaults,
  type HistoricalImportDuplicateMode,
  type HistoricalImportPackage,
  type HistoricalImportMode,
  type SystemLogEntry,
  type ParsedTransactionDraft,
} from "@omni-sync/core";
import { useTransactionStore } from "@omni-sync/database";
import { MaterialSymbol } from "@omni-sync/ui";

import {
  MotionPanel,
  StatusChip,
  pressableClass,
} from "../components/settingsMotionPrimitives";
import { clearLocalFinanceWorkspace } from "../clearLocalFinanceWorkspace";
import {
  persistImportDuplicateModePreference,
  persistImportModePreference,
  persistImportReviewDaysPreference,
  readImportDuplicateModePreference,
  readImportModePreference,
  readImportReviewDaysPreference,
} from "../preferences/storagePreferences";
import { readParserWorkspacePreferences } from "../preferences/parserPreferences";

type StatusTone = "success" | "warning" | "error";
type ActionState = "idle" | "working" | "done";

interface PendingImportPackage {
  fileName: string;
  createdAt: string;
  drafts: ParsedTransactionDraft[];
  unmatchedEntries: HistoricalImportPackage["unmatchedEntries"];
}

interface PendingRestorePackage {
  fileName: string;
  createdAt: string;
  finance: FinanceSnapshot;
  authorityState?: BackupPackage["authorityState"];
  defaults?: HistoricalImportDefaults;
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
    detail: "Best for full resets.",
  },
  {
    value: "merge",
    label: "Merge",
    detail: "Keep current data and append new history.",
  },
  {
    value: "replace",
    label: "Replace",
    detail: "Erase current finance data before import.",
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
    detail: "Best until duplicate review is live.",
  },
  {
    value: "review",
    label: "Review duplicates",
    detail: "Flag only. Review inbox is not live yet.",
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

async function readJsonFileText(file: File) {
  if (typeof file.text === "function") {
    return file.text();
  }

  return new Response(file).text();
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
        <MaterialSymbol
          className={danger ? "text-error" : "text-primary"}
          filled
          name="check_circle"
        />
      ) : (
        <MaterialSymbol
          className={danger ? "text-error" : "text-on-surface-variant"}
          name={danger ? "warning" : "chevron_right"}
        />
      )}
    </button>
  );
}

function SectionHeader({
  eyebrow,
  title,
  detail,
}: {
  eyebrow?: string;
  title: string;
  detail?: string;
}) {
  return (
    <div>
      {eyebrow ? (
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-on-surface-variant">
          {eyebrow}
        </p>
      ) : null}
      <h3 className="mt-2 font-headline text-2xl font-semibold text-on-surface">
        {title}
      </h3>
      {detail ? (
        <p className="mt-2 text-sm leading-6 text-on-surface-variant">{detail}</p>
      ) : null}
    </div>
  );
}

function CompactMetricCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper?: string;
}) {
  return (
    <div className="rounded-[22px] border border-outline-variant/18 bg-surface px-4 py-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-on-surface-variant">
        {label}
      </p>
      <p className="mt-2 font-headline text-2xl font-semibold text-on-surface">
        {value}
      </p>
      {helper ? (
        <p className="mt-1 text-xs leading-5 text-on-surface-variant">{helper}</p>
      ) : null}
    </div>
  );
}

export function DataStoragePage() {
  const approvedTransactions = useTransactionStore((state) => state.approvedTransactions);
  const approvalQueue = useTransactionStore((state) => state.approvalQueue);
  const unmatchedMessages = useTransactionStore((state) => state.unmatchedMessages);
  const accountSummaries = useTransactionStore((state) => state.accountSummaries);
  const importHistoricalData = useTransactionStore((state) => state.importHistoricalData);
  const stageHistoricalImportPackage = useTransactionStore(
    (state) => state.stageHistoricalImportPackage,
  );
  const createDataExportPackage = useTransactionStore(
    (state) => state.createDataExportPackage,
  );
  const createBackupPackage = useTransactionStore((state) => state.createBackupPackage);
  const restoreBackupPackage = useTransactionStore(
    (state) => state.restoreBackupPackage,
  );
  const systemLogEntries = useTransactionStore((state) => state.systemLogs);

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
  const [isSystemLogsOpen, setIsSystemLogsOpen] = useState(false);
  const [showAdvancedStorageTools, setShowAdvancedStorageTools] = useState(false);
  const financeSnapshot = useMemo<FinanceSnapshot>(
    () => ({
      approvedTransactions: approvedTransactions.map((item) => ({ ...item })),
      approvalQueue: approvalQueue.map((item) => ({ ...item })),
      unmatchedMessages: unmatchedMessages.map((item) => ({ ...item })),
      accountSummaries: accountSummaries.map((item) => ({ ...item })),
    }),
    [accountSummaries, approvalQueue, approvedTransactions, unmatchedMessages],
  );

  const storageSnapshotSize = useMemo(() => {
    return JSON.stringify(financeSnapshot).length;
  }, [financeSnapshot]);

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

    const groups = new Map<string, { draft: ParsedTransactionDraft; count: number }>();

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
        defaultReviewDays: reviewWindowDaysByAccountKey[key] ?? reviewWindowDays,
      };
    });
  }, [pendingImportPackage, reviewWindowDays, reviewWindowDaysByAccountKey]);

  const importWorkspaceMetrics = useMemo(
    () =>
      pendingImportPackage
        ? [
            {
              label: "Detected account lanes",
              value: String(pendingImportAccounts.length),
              helper: "Per-account review overrides stay local for now.",
            },
            {
              label: "Draft rows",
              value: String(pendingImportPackage.drafts.length),
              helper: "Ready to merge into phone state.",
            },
            {
              label: "Unmatched rows",
              value: String(pendingImportPackage.unmatchedEntries.length),
              helper: "Held for parser cleanup later.",
            },
            {
              label: "Import mode",
              value:
                importMode === "backup_then_replace"
                  ? "Backup + replace"
                  : importMode === "replace"
                    ? "Replace"
                    : "Merge",
              helper:
                duplicateMode === "skip"
                  ? "Duplicates skipped."
                  : "Review path staged only.",
            },
          ]
        : [],
    [duplicateMode, importMode, pendingImportAccounts.length, pendingImportPackage],
  );

  function showStatus(message: string, tone: StatusTone) {
    setStatusToast({ message, tone });
    window.setTimeout(() => setStatusToast(null), 2600);
  }

  function completeActionState(setter: (value: ActionState) => void) {
    setter("done");
    window.setTimeout(() => setter("idle"), 1200);
  }

  function getImportParserTemplateCatalog() {
    const parserWorkspace = readParserWorkspacePreferences();

    if (!parserWorkspace) {
      return cloneDefaultParserTemplates();
    }

    return resolveParserTemplateWorkspace(parserWorkspace.templateWorkspace);
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
      const timestamp = new Date().toISOString();
      const payload: DataExportPackage = createDataExportPackage(timestamp);

      triggerJsonDownload(
        `trackwallet-data-export-${timestamp.slice(0, 10)}.json`,
        payload,
      );
      completeActionState(setExportState);
      showStatus("Finance export was downloaded for this local preview.", "success");
    }, 260);
  }

  function exportBackupSnapshot() {
    setBackupState("working");

    window.setTimeout(() => {
      const timestamp = new Date().toISOString();
      const payload: BackupPackage = createBackupPackage(
        {
          importMode,
          duplicateMode,
          reviewWindowDays,
        },
        timestamp,
      );

      triggerJsonDownload(
        `trackwallet-backup-${timestamp.slice(0, 10)}.json`,
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
      const text = await readJsonFileText(file);
      const parsed = JSON.parse(text) as unknown;

      if (!isHistoricalImportPackage(parsed)) {
        throw new Error("Unsupported historical import package.");
      }

      setPendingImportPackage({
        fileName: file.name,
        createdAt: sanitizeCreatedAt(parsed.createdAt),
        drafts: parsed.drafts,
        unmatchedEntries: parsed.unmatchedEntries,
      });
      setReviewWindowDaysByAccountKey({});
      setImportSummary(null);
      stageHistoricalImportPackage(parsed, {
        availableParserTemplates: getImportParserTemplateCatalog(),
        sourceLabel: file.name,
      });
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
      const text = await readJsonFileText(file);
      const parsed = JSON.parse(text) as unknown;

      if (!isBackupPackage(parsed)) {
        throw new Error("Unsupported backup package.");
      }

      setPendingRestorePackage({
        fileName: file.name,
        createdAt: sanitizeCreatedAt(parsed.createdAt),
        finance: parsed.finance,
        authorityState: parsed.authorityState,
        defaults: sanitizeHistoricalImportDefaults(parsed.defaults),
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
        availableParserTemplates: getImportParserTemplateCatalog(),
        sourceLabel: pendingImportPackage.fileName,
      });

      if (result.backupSnapshot) {
        const backupPayload: BackupPackage = buildBackupPackage(
          {
            approvedTransactions: result.backupSnapshot.approvedTransactions,
            approvalQueue: result.backupSnapshot.approvalQueue,
            unmatchedMessages: result.backupSnapshot.unmatchedEntries,
            accountSummaries: result.backupSnapshot.accountSummaries,
          },
          {
            importMode,
            duplicateMode,
            reviewWindowDays,
          },
          result.processedAt,
        );

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
      showStatus("Historical import finished in the local preview authority.", "success");
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
      restoreBackupPackage({
        kind: "trackwallet-authority-backup",
        version: 1,
        createdAt: pendingRestorePackage.createdAt,
        finance: pendingRestorePackage.finance,
        authorityState: pendingRestorePackage.authorityState,
        defaults:
          pendingRestorePackage.defaults ??
          sanitizeHistoricalImportDefaults(undefined),
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

    window.setTimeout(async () => {
      const { nativeRuntimeCleared } = await clearLocalFinanceWorkspace();
      completeActionState(setClearState);
      showStatus(
        nativeRuntimeCleared
          ? "Local finance data and parser workspace were cleared from this phone. Native SMS runtime was reset."
          : "Local finance data and parser workspace were cleared from this phone. Native SMS runtime could not be reset here.",
        "warning",
      );
    }, 320);
  }

  if (isSystemLogsOpen) {
    return (
      <section className="space-y-6">
        {statusToast ? (
          <StatusToast message={statusToast.message} tone={statusToast.tone} />
        ) : null}

        <MotionPanel
          className="space-y-5 rounded-[28px] border border-outline-variant/20 bg-surface-container p-6 shadow-[0_6px_24px_rgba(46,50,48,0.06)]"
          delay={80}
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <button
                className={`inline-flex items-center gap-2 rounded-full border border-outline-variant/20 bg-surface px-3 py-2 text-sm font-semibold text-on-surface ${pressableClass}`}
                onClick={() => setIsSystemLogsOpen(false)}
                type="button"
              >
                <MaterialSymbol name="arrow_back" />
                Back
              </button>
              <SectionHeader
                eyebrow="System Logs"
                title="System Logs"
                detail="Preview event logs from this phone."
              />
            </div>
            <div className="grid min-w-[220px] gap-3 sm:grid-cols-2">
              <CompactMetricCard
                helper="Preview-level entries only."
                label="Import events"
                value={String(systemLogEntries.length)}
              />
              <CompactMetricCard
                helper="Approximate serialized snapshot."
                label="Storage size"
                value={formatApproxSize(storageSnapshotSize)}
              />
            </div>
          </div>

          <div className="rounded-[24px] border border-outline-variant/18 bg-surface p-4">
            <p className="text-sm font-semibold text-on-surface">Import events</p>
            <div className="mt-4 space-y-3">
              {systemLogEntries.length > 0 ? systemLogEntries.map((entry) => {
                const toneClass =
                  entry.tone === "success"
                    ? "border-primary/20 bg-primary-container/24"
                    : entry.tone === "warning"
                      ? "border-tertiary/24 bg-tertiary-container/18"
                      : entry.tone === "error"
                        ? "border-error/24 bg-error-container/20"
                        : "border-outline-variant/16 bg-surface-container-low";

                return (
                  <div
                    className={`rounded-[20px] border px-4 py-4 ${toneClass}`}
                    key={entry.logId}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-on-surface">{entry.title}</p>
                      <p className="text-xs text-on-surface-variant">
                        {formatTimestamp(entry.occurredAt)}
                      </p>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-on-surface-variant">
                      {entry.detail}
                    </p>
                    {entry.metrics.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {entry.metrics.map((metric) => (
                          <span
                            className="rounded-full bg-surface px-3 py-1 text-[11px] font-semibold text-on-surface-variant"
                            key={`${entry.logId}-${metric.label}`}
                          >
                            {metric.label}: {metric.value}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    {entry.templateUsage.length > 0 ? (
                      <p className="mt-3 text-xs leading-5 text-on-surface-variant">
                        Templates:{" "}
                        {entry.templateUsage
                          .map((usage) => `${usage.templateId} (${usage.templateStatus})`)
                          .join(", ")}
                      </p>
                    ) : null}
                  </div>
                );
              }) : (
                <div className="rounded-[20px] border border-dashed border-outline-variant/24 px-4 py-4 text-sm text-on-surface-variant">
                  No operational storage events have been recorded yet.
                </div>
              )}
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-[24px] border border-outline-variant/18 bg-surface p-4">
              <p className="text-sm font-semibold text-on-surface">Working now</p>
              <p className="mt-2 text-sm leading-6 text-on-surface-variant">
                Import, restore staging, and local clearing are live.
              </p>
            </div>
            <div className="rounded-[24px] border border-outline-variant/18 bg-surface p-4">
              <p className="text-sm font-semibold text-on-surface">
                Still missing
              </p>
              <p className="mt-2 text-sm leading-6 text-on-surface-variant">
                Import trace IDs, duplicate review, and reconciliation history.
              </p>
            </div>
          </div>
        </MotionPanel>
      </section>
    );
  }

  return (
    <section className="space-y-6">
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

      <MotionPanel
        className="rounded-[32px] border border-outline-variant/18 bg-[linear-gradient(140deg,rgba(247,243,235,0.96),rgba(255,255,255,0.94))] p-6 shadow-[0_10px_32px_rgba(46,50,48,0.08)]"
        delay={80}
      >
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-on-surface-variant">
              Launch readiness
            </p>
            <h2 className="mt-2 font-headline text-3xl font-semibold text-on-surface">
              Data &amp; Storage
            </h2>
            <p className="mt-3 text-sm leading-6 text-on-surface-variant">
              Import, backup, restore, and cleanup in one flow.
            </p>
          </div>

          <div className="grid flex-1 gap-3 sm:grid-cols-3 xl:max-w-[520px]">
            <CompactMetricCard
              helper="Drops if queue or unmatched items pile up."
              label="Storage health"
              value={String(storageHealthScore)}
            />
            <CompactMetricCard
              helper="Approximate JSON footprint."
              label="Snapshot size"
              value={formatApproxSize(storageSnapshotSize)}
            />
            <CompactMetricCard
              helper="Detected from current local state."
              label="Accounts tracked"
              value={String(accountSummaries.length)}
            />
          </div>
        </div>
      </MotionPanel>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <MotionPanel
          className="space-y-5 rounded-[28px] border border-outline-variant/20 bg-surface-container p-6 shadow-[0_4px_20px_rgba(46,50,48,0.06)]"
          delay={130}
        >
          <SectionHeader
            detail="Restore stages before replace."
            eyebrow="Import & Export"
            title="Import & Export"
          />

          <div className="grid gap-3">
            <StorageActionRow
              detail="Ledger, queue, unmatched, and inferred accounts."
              icon="download"
              onClick={exportFinanceData}
              state={exportState}
              title="Export finance data"
            />
            <StorageActionRow
              detail="Full backup with current defaults."
              icon="archive"
              onClick={exportBackupSnapshot}
              state={backupState}
              title="Export JSON backup"
            />
            <StorageActionRow
              detail="Stage a backup before replace."
              icon="restore"
              onClick={() => restoreInputRef.current?.click()}
              state={restoreState}
              title="Restore backup package"
            />
            <StorageActionRow
              detail="Load a history package into the workspace below."
              icon="upload_file"
              onClick={() => importInputRef.current?.click()}
              state={importState}
              title="Import history package"
            />
            <StorageActionRow
              detail="Open preview event logs."
              icon="terminal"
              onClick={() => setIsSystemLogsOpen(true)}
              title="View System Logs"
            />
          </div>

          <div className="rounded-[24px] border border-outline-variant/18 bg-surface-container-low p-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold text-on-surface">
                  Advanced storage tools stay hidden
                </p>
                <p className="mt-2 text-sm leading-6 text-on-surface-variant">
                  Clear-local actions are hidden for first-use safety. The real
                  export, backup, and restore flows stay live above.
                </p>
              </div>
              <button
                className={`inline-flex min-h-11 items-center justify-center rounded-2xl border border-outline-variant/20 bg-surface px-4 py-2 text-sm font-semibold text-on-surface ${pressableClass}`}
                onClick={() =>
                  setShowAdvancedStorageTools((current) => !current)
                }
                type="button"
              >
                {showAdvancedStorageTools ? "Hide advanced tools" : "Show advanced tools"}
              </button>
            </div>
          </div>

          {pendingRestorePackage ? (
            <div className="rounded-[24px] border border-tertiary/18 bg-tertiary-container/20 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-semibold text-on-surface">
                    {pendingRestorePackage.fileName}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-on-surface-variant">
                    Created {formatTimestamp(pendingRestorePackage.createdAt)} •{" "}
                    {pendingRestorePackage.finance.approvedTransactions.length} approved rows.
                  </p>
                </div>
                <StatusChip icon="warning" tone="warning">
                  Replaces current preview data
                </StatusChip>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <CompactMetricCard
                  label="Approved"
                  value={String(pendingRestorePackage.finance.approvedTransactions.length)}
                />
                <CompactMetricCard
                  label="Queue"
                  value={String(pendingRestorePackage.finance.approvalQueue.length)}
                />
                <CompactMetricCard
                  label="Unmatched"
                  value={String(pendingRestorePackage.finance.unmatchedMessages.length)}
                />
                <CompactMetricCard
                  helper="Import defaults bundled or not."
                  label="Defaults"
                  value={pendingRestorePackage.defaults ? "Included" : "Missing"}
                />
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                <ActionStatusButton
                  actionState={restoreState}
                  className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-primary px-5 py-3 font-semibold text-on-primary shadow-[0_4px_20px_rgba(46,50,48,0.08)]"
                  doneLabel="Restored"
                  idleLabel="Apply restore"
                  onClick={applyRestoreBackup}
                  workingLabel="Restoring..."
                />
                <button
                  className={`inline-flex min-h-12 items-center gap-2 rounded-2xl border border-outline-variant/20 bg-surface px-5 py-3 text-sm font-semibold text-on-surface ${pressableClass}`}
                  onClick={() => setPendingRestorePackage(null)}
                  type="button"
                >
                  Clear staged restore
                </button>
              </div>
            </div>
          ) : null}
        </MotionPanel>

        <MotionPanel
          className="space-y-5 rounded-[28px] border border-outline-variant/20 bg-surface-container p-6 shadow-[0_4px_20px_rgba(46,50,48,0.06)]"
          delay={180}
        >
          <SectionHeader
            detail="Saved with imports created on this phone."
            eyebrow="Review defaults"
            title="Review defaults"
          />

          <div className="space-y-3">
            <p className="text-sm font-semibold text-on-surface">Import mode</p>
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
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-on-surface">Duplicate handling</p>
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
            <p className="text-sm font-semibold text-on-surface">Review window</p>
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
      </div>

      <MotionPanel
        className="space-y-5 rounded-[28px] border border-outline-variant/20 bg-surface-container-low p-6 shadow-[0_4px_20px_rgba(46,50,48,0.06)]"
        delay={220}
      >
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <SectionHeader
            detail={
              pendingImportPackage
                ? "This package now owns its import decisions here."
                : "Load a history package to review import mode, duplicates, and review window here."
            }
            eyebrow={pendingImportPackage ? "Import workspace" : undefined}
            title="Import workspace"
          />
          <button
            className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-outline-variant/20 bg-surface px-5 py-3 text-sm font-semibold text-on-surface ${pressableClass}`}
            onClick={() => importInputRef.current?.click()}
            type="button"
          >
            <MaterialSymbol name="upload_file" />
            {pendingImportPackage ? "Replace loaded package" : "Choose history package"}
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
              {importWorkspaceMetrics.map((item) => (
                <CompactMetricCard
                  helper={item.helper}
                  key={item.label}
                  label={item.label}
                  value={item.value}
                />
              ))}
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
              <div className="rounded-[24px] border border-outline-variant/18 bg-surface p-4">
                <p className="text-sm font-semibold text-on-surface">Import mode</p>
                <div className="mt-4 space-y-3">
                  {importModeOptions.map((option) => (
                    <ChoiceChip
                      active={importMode === option.value}
                      detail={option.detail}
                      key={`workspace-${option.value}`}
                      onClick={() => setImportMode(option.value)}
                      title={option.label}
                    />
                  ))}
                </div>
              </div>

              <div className="rounded-[24px] border border-outline-variant/18 bg-surface p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-on-surface">Duplicate handling</p>
                  {duplicateMode === "review" ? (
                    <StatusChip icon="schedule" tone="warning">
                      Coming soon
                    </StatusChip>
                  ) : null}
                </div>
                <div className="mt-4 space-y-3">
                  {duplicateModeOptions.map((option) => (
                    <ChoiceChip
                      active={duplicateMode === option.value}
                      detail={option.detail}
                      disabled={option.comingSoon}
                      key={`duplicate-${option.value}`}
                      onClick={() => setDuplicateMode(option.value)}
                      title={option.label}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-[24px] border border-outline-variant/18 bg-surface p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-semibold text-on-surface">Review window</p>
                  <p className="mt-1 text-xs leading-5 text-on-surface-variant">
                    Default review hold plus per-account overrides.
                  </p>
                </div>
                <p className="text-sm text-on-surface-variant">
                  {normalizeReviewDaysLabel(reviewWindowDays)}
                </p>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {reviewDayOptions.map((dayCount) => {
                  const isActive = reviewWindowDays === dayCount;
                  return (
                    <button
                      className={`rounded-full px-3 py-2 text-xs font-semibold transition ${pressableClass} ${
                        isActive
                          ? "bg-primary text-on-primary"
                          : "bg-surface-container-low text-on-surface-variant"
                      }`}
                      key={`workspace-day-${dayCount}`}
                      onClick={() => setReviewWindowDays(dayCount)}
                      type="button"
                    >
                      {dayCount === 0 ? "Straight to ledger" : `${dayCount} days`}
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 space-y-3">
                {pendingImportAccounts.map((account) => (
                  <div
                    className="rounded-[20px] border border-outline-variant/16 bg-surface-container-low p-4"
                    key={account.key}
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-on-surface">
                          {account.label}
                        </p>
                        <p className="mt-1 text-xs leading-5 text-on-surface-variant">
                          {account.draftCount} imported rows. New keys create inferred local accounts.
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
                        value={
                          reviewWindowDaysByAccountKey[account.key] ??
                          account.defaultReviewDays
                        }
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
                actionState={saveDefaultsState}
                className="inline-flex min-h-12 items-center gap-2 rounded-2xl border border-outline-variant/20 bg-surface px-5 py-3 font-semibold text-on-surface"
                doneLabel="Saved"
                idleLabel="Save as defaults"
                onClick={persistDefaults}
                workingLabel="Saving..."
              />
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
          <div className="rounded-[24px] border border-dashed border-outline-variant/24 bg-surface-container p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold text-on-surface">No package attached</p>
                <p className="mt-2 text-sm leading-6 text-on-surface-variant">
                  Attach a desktop history export to open the active import workspace.
                </p>
              </div>
              <StatusChip icon="schedule" tone="neutral">
                Waiting for file
              </StatusChip>
            </div>
          </div>
        )}

        {importSummary ? (
          <div className="rounded-[24px] border border-primary/18 bg-primary-container/28 p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold text-on-surface">Last import summary</p>
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
                { label: "Sent to ledger", value: importSummary.approvedCount },
                { label: "Queued for review", value: importSummary.reviewCount },
                { label: "Duplicates found", value: importSummary.duplicateCount },
                { label: "Inferred accounts", value: importSummary.inferredAccountCount },
                { label: "Unmatched rows", value: importSummary.unmatchedCount },
              ].map(({ label, value }) => (
                <CompactMetricCard key={label} label={label} value={String(value)} />
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
          <SectionHeader
            detail="Stored now. Reconciliation queue is not live yet."
            eyebrow="Balance checks"
            title="Reported balance detection"
          />
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
            detail="Mismatch review is not live yet."
            title="Mismatch review and reconciliation queue"
          />
        </MotionPanel>

        <MotionPanel
          className="space-y-4 rounded-[28px] border border-outline-variant/20 bg-surface-container-low p-6 shadow-[0_4px_20px_rgba(46,50,48,0.06)]"
          delay={330}
        >
          <SectionHeader
            detail="Duplicate review and deeper audit are not live yet."
            eyebrow="Advanced"
            title="Runtime boundary"
          />
          <ComingSoonCard
            detail="Policy can be staged, but the review inbox is not live yet."
            title="Duplicate review flow"
          />
          <ComingSoonCard
            detail="Full native authority ownership and audit are not complete."
            title="Local-first authority"
          />
        </MotionPanel>
      </div>

      {showAdvancedStorageTools ? (
        <MotionPanel
          className="space-y-4 rounded-[28px] border border-error/18 bg-error-container/14 p-6 shadow-[0_4px_20px_rgba(46,50,48,0.04)]"
          delay={380}
        >
          <SectionHeader
            detail="Clears finance data and linked preferences on this phone. Export a backup first if you want a way back."
            eyebrow="Advanced safety boundary"
            title="Clear local finance data"
          />
          <ActionStatusButton
            actionState={clearState}
            className="inline-flex min-h-12 items-center gap-2 rounded-2xl border border-error/24 bg-error/10 px-5 py-3 font-semibold text-error"
            doneLabel="Cleared"
            idleLabel="Clear local data"
            onClick={clearLocalFinanceData}
            workingLabel="Clearing..."
          />
        </MotionPanel>
      ) : null}
    </section>
  );
}
