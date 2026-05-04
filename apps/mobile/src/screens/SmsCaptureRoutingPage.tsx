import { useMemo, useState } from "react";

import {
  selectSmsCaptureRoutingSummary,
  useTransactionStore,
} from "@omni-sync/database";
import { MaterialSymbol } from "@omni-sync/ui";

import {
  MotionPanel,
  StatusChip,
  pressableClass,
} from "../components/settingsMotionPrimitives";
import { useSmsCaptureRuntime } from "../sms";

function joinClasses(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "Not yet";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatPermissionLabel(value: string) {
  switch (value) {
    case "granted":
      return "Granted";
    case "denied":
      return "Denied";
    case "prompt":
      return "Needs prompt";
    case "unavailable":
      return "Unavailable";
    default:
      return "Unknown";
  }
}

function formatRuntimeStatusLabel(value: string) {
  switch (value) {
    case "capturing":
      return "Capturing live SMS";
    case "native_available":
      return "Native capture ready";
    case "permission_required":
      return "SMS permission needed";
    case "blocked":
      return "Permission blocked";
    default:
      return "Manual-only runtime";
  }
}

function describeRuntimeStatus(value: string) {
  switch (value) {
    case "capturing":
      return "The Android bridge is live and new SMS can enter the durable capture queue.";
    case "native_available":
      return "The Android bridge is present, but live capture is paused until you enable it.";
    case "permission_required":
      return "This Android host can capture SMS after you approve the system permission prompt.";
    case "blocked":
      return "Android capture is installed, but SMS permission is blocked at the OS level.";
    default:
      return "This build can still review queue state, sender rules, and parser handoff, but native SMS capture is not active here.";
  }
}

function formatBackfillCapabilityLabel(value: string) {
  switch (value) {
    case "available":
      return "Native backfill available";
    case "native_follow_up_required":
      return "Native follow-up required";
    default:
      return "Not implemented yet";
  }
}

function describeBackfillCapability(value: string) {
  switch (value) {
    case "available":
      return "Historical SMS ingestion is exposed by the current native host.";
    case "native_follow_up_required":
      return "The request can be recorded now, but the Android host still needs historical SMS ingestion work.";
    default:
      return "This build does not implement historical SMS ingestion yet. Only the request/intention is recorded.";
  }
}

function formatOutcomeLabel(value: string) {
  switch (value) {
    case "queued":
      return "Queued to inbox";
    case "unmatched":
      return "Stayed unmatched";
    case "failed":
      return "Failed";
    default:
      return "Idle";
  }
}

export function SmsCaptureRoutingPage() {
  const smsCaptureSettings = useTransactionStore((state) => state.smsCaptureSettings);
  const smsCaptureQueue = useTransactionStore((state) => state.smsCaptureQueue);
  const smsCaptureRoutingSummary = useTransactionStore((state) =>
    selectSmsCaptureRoutingSummary(state),
  );
  const smsCaptureQueueSummary = useTransactionStore(
    (state) => state.smsCaptureQueueSummary,
  );
  const smsCaptureDiagnostics = useTransactionStore(
    (state) => state.smsCaptureDiagnostics,
  );
  const updateSmsCaptureSettings = useTransactionStore(
    (state) => state.updateSmsCaptureSettings,
  );
  const setSmsCaptureBackfillRequest = useTransactionStore(
    (state) => state.setSmsCaptureBackfillRequest,
  );
  const addSmsSenderRule = useTransactionStore((state) => state.addSmsSenderRule);
  const updateSmsSenderRule = useTransactionStore((state) => state.updateSmsSenderRule);
  const removeSmsSenderRule = useTransactionStore((state) => state.removeSmsSenderRule);
  const processNextSmsCaptureQueueItem = useTransactionStore(
    (state) => state.processNextSmsCaptureQueueItem,
  );
  const {
    isSyncing,
    refreshRuntime,
    requestPermissions,
    setCaptureEnabled,
    syncError,
  } = useSmsCaptureRuntime({
    autoDrainQueue: true,
  });
  const [newSenderLabel, setNewSenderLabel] = useState("");
  const [statusMessage, setStatusMessage] = useState<{
    tone: "neutral" | "success" | "warning";
    message: string;
  } | null>(null);
  const recentQueue = useMemo(
    () =>
      [...smsCaptureQueue]
        .sort(
          (left, right) =>
            new Date(right.capturedAt).getTime() - new Date(left.capturedAt).getTime(),
        )
        .slice(0, 6),
    [smsCaptureQueue],
  );
  const isFirstRunCapture =
    smsCaptureSettings.senderRules.length === 0 &&
    smsCaptureQueueSummary.pendingCount === 0 &&
    smsCaptureQueueSummary.parsedCount === 0 &&
    smsCaptureQueueSummary.unmatchedCount === 0 &&
    smsCaptureQueueSummary.failedCount === 0 &&
    !smsCaptureDiagnostics.lastCapturedAt;

  function handleAddSenderRule() {
    if (!newSenderLabel.trim()) {
      setStatusMessage({
        tone: "warning",
        message: "Enter a sender label before adding a capture rule.",
      });
      return;
    }

    addSmsSenderRule(newSenderLabel.trim());
    setNewSenderLabel("");
    setStatusMessage({
      tone: "success",
      message: "Sender rule added to the live capture settings.",
    });
  }

  async function handleRefreshRuntime() {
    try {
      await refreshRuntime();
      setStatusMessage({
        tone: "success",
        message: "SMS runtime refreshed from the current device bridge.",
      });
    } catch (error) {
      setStatusMessage({
        tone: "warning",
        message:
          error instanceof Error ? error.message : "SMS runtime refresh failed.",
      });
    }
  }

  async function handleRequestPermissions() {
    try {
      await requestPermissions();
      setStatusMessage({
        tone: "success",
        message: "SMS permission request completed. Runtime status is now refreshed.",
      });
    } catch (error) {
      setStatusMessage({
        tone: "warning",
        message:
          error instanceof Error ? error.message : "SMS permission request failed.",
      });
    }
  }

  async function handleCaptureToggle() {
    if (smsCaptureRoutingSummary.runtimeStatus === "manual_only") {
      setStatusMessage({
        tone: "warning",
        message:
          "Native SMS capture is not active on this build/device yet. The queue and parser views remain real, but capture cannot be enabled here.",
      });
      return;
    }

    if (
      smsCaptureRoutingSummary.runtimeStatus === "permission_required" ||
      smsCaptureRoutingSummary.runtimeStatus === "blocked"
    ) {
      await handleRequestPermissions();
      return;
    }

    try {
      await setCaptureEnabled(!smsCaptureRoutingSummary.captureEnabled);
      setStatusMessage({
        tone: "success",
        message: smsCaptureRoutingSummary.captureEnabled
          ? "Live SMS capture paused on the current Android host."
          : "Live SMS capture enabled on the current Android host.",
      });
    } catch (error) {
      setStatusMessage({
        tone: "warning",
        message:
          error instanceof Error ? error.message : "Unable to change capture state.",
      });
    }
  }

  function handleBackfillRequest() {
    const request = setSmsCaptureBackfillRequest(smsCaptureSettings.retentionDays);
    const capability = smsCaptureRoutingSummary.backfillCapability;

    setStatusMessage({
      tone: capability === "available" ? "success" : "warning",
      message:
        capability === "available"
          ? `Historical SMS request recorded for ${request.lookbackDays} days.`
          : capability === "native_follow_up_required"
            ? `Recorded a ${request.lookbackDays}-day history request, but Android host work is still required before it can run.`
            : `Recorded a ${request.lookbackDays}-day history request. This build does not implement historical SMS ingestion yet.`,
    });
  }

  function handleClearBackfillRequest() {
    setSmsCaptureBackfillRequest(null);
    setStatusMessage({
      tone: "neutral",
      message: "Cleared the pending historical SMS request.",
    });
  }

  function handleProcessQueue() {
    const result = processNextSmsCaptureQueueItem({
      processedAt: new Date().toISOString(),
    });
    if (!result) {
      setStatusMessage({
        tone: "warning",
        message: "There is no queued SMS waiting for parser routing.",
      });
      return;
    }

    if (result.status === "queued") {
      setStatusMessage({
        tone: "success",
        message: "Queued SMS routed into Inbox through the live parser pipeline.",
      });
      return;
    }

    if (result.status === "unmatched") {
      setStatusMessage({
        tone: "warning",
        message: "Queued SMS reached the parser but still needs template review.",
      });
      return;
    }

    setStatusMessage({
      tone: "warning",
      message: result.failureReason,
    });
  }

  return (
    <section className="space-y-5">
      <MotionPanel className="rounded-[28px] border border-outline-variant/35 bg-surface px-5 py-5 shadow-[0_18px_44px_rgba(46,50,48,0.12)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <StatusChip
                icon="sms"
                tone={
                  smsCaptureRoutingSummary.runtimeStatus === "capturing"
                    ? "success"
                    : smsCaptureRoutingSummary.runtimeStatus === "manual_only"
                      ? "neutral"
                      : "warning"
                }
              >
                {formatRuntimeStatusLabel(smsCaptureRoutingSummary.runtimeStatus)}
              </StatusChip>
              <StatusChip icon="hub" tone="neutral">
                {smsCaptureRoutingSummary.buildMode === "native_capture"
                  ? "Native capture runtime"
                  : "Manual-only runtime"}
              </StatusChip>
              <StatusChip
                icon="shield_lock"
                tone={smsCaptureDiagnostics.permissionState === "granted" ? "success" : "warning"}
              >
                Permission {formatPermissionLabel(smsCaptureDiagnostics.permissionState)}
              </StatusChip>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-on-surface-variant/75">
                Capture pipeline
              </p>
              <h1 className="text-2xl font-semibold tracking-[-0.02em] text-on-surface">
                SMS Capture &amp; Routing
              </h1>
            </div>
            <p className="max-w-3xl text-sm text-on-surface-variant">
              {smsCaptureRoutingSummary.runtimeStatus === "manual_only"
                ? "Automatic capture is coming soon on this phone. Add your sender names now and use manual transactions until the Android bridge is ready."
                : "Manage runtime, sender rules, queue state, backfill request, and diagnostics."}
            </p>
          </div>
          <div className="space-y-3">
            <div className="flex flex-wrap justify-end gap-2">
              {!isFirstRunCapture || smsCaptureRoutingSummary.runtimeStatus !== "manual_only" ? (
                <button
                  className={joinClasses(
                    pressableClass,
                    "rounded-full border border-outline-variant/30 bg-background px-4 py-2 text-sm font-semibold text-on-surface",
                    isSyncing && "cursor-wait opacity-70",
                  )}
                  disabled={isSyncing}
                  onClick={() => {
                    void handleRefreshRuntime();
                  }}
                  type="button"
                >
                  {isSyncing ? "Refreshing..." : "Refresh runtime"}
                </button>
              ) : null}
              {smsCaptureRoutingSummary.runtimeStatus === "permission_required" ||
              smsCaptureRoutingSummary.runtimeStatus === "blocked" ? (
                <button
                  className={joinClasses(
                    pressableClass,
                    "rounded-full bg-primary px-4 py-2 text-sm font-semibold text-on-primary",
                    isSyncing && "cursor-wait opacity-70",
                  )}
                  disabled={isSyncing}
                  onClick={() => {
                    void handleRequestPermissions();
                  }}
                  type="button"
                >
                  Request SMS permission
                </button>
              ) : null}
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <MetricPill label="Senders" value={smsCaptureSettings.senderRules.length} />
            <MetricPill label="Pending" value={smsCaptureQueueSummary.pendingCount} />
            <MetricPill label="Parsed" value={smsCaptureQueueSummary.parsedCount} />
            <MetricPill label="Unmatched" value={smsCaptureQueueSummary.unmatchedCount} />
            </div>
          </div>
        </div>
      </MotionPanel>

      {statusMessage ? (
        <MotionPanel
          className={joinClasses(
            "rounded-2xl border px-4 py-3",
            statusMessage.tone === "success"
              ? "border-primary/20 bg-primary-container/40 text-primary"
              : statusMessage.tone === "warning"
                ? "border-tertiary/20 bg-tertiary-container/35 text-on-tertiary-container"
                : "border-outline-variant/30 bg-surface-container text-on-surface",
          )}
          variant="toast"
        >
          <div className="flex items-start gap-2">
            <MaterialSymbol
              className="mt-0.5 text-base"
              name={
                statusMessage.tone === "success"
                  ? "check_circle"
                  : statusMessage.tone === "warning"
                    ? "warning"
                    : "info"
              }
            />
            <p className="text-sm font-medium">{statusMessage.message}</p>
          </div>
        </MotionPanel>
      ) : null}

      {syncError ? (
        <MotionPanel className="rounded-2xl border border-tertiary/20 bg-tertiary-container/30 px-4 py-3">
          <div className="flex items-start gap-2 text-on-tertiary-container">
            <MaterialSymbol className="mt-0.5 text-base" name="warning" />
            <p className="text-sm font-medium">{syncError}</p>
          </div>
        </MotionPanel>
      ) : null}

      <MotionPanel
        className="rounded-2xl border border-tertiary/20 bg-tertiary-container/24 px-4 py-3"
        variant="toast"
      >
        <div className="flex items-start gap-2 text-on-tertiary-container">
          <MaterialSymbol className="mt-0.5 text-base" name="warning" />
          <p className="text-sm font-medium">
            Automatic collection still depends on the Android bridge. Manual
            mode keeps sender names and review tools ready, but not automatic
            SMS imports.
          </p>
        </div>
      </MotionPanel>

      <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <MotionPanel className="space-y-4 rounded-[28px] border border-outline-variant/30 bg-surface p-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-on-surface-variant/70">
              Capture status
            </p>
            <h2 className="text-lg font-semibold text-on-surface">Collection controls</h2>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-[22px] border border-outline-variant/25 bg-background px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-on-surface">Live capture runtime</p>
                  <p className="mt-2 text-sm text-on-surface-variant">
                    {describeRuntimeStatus(smsCaptureRoutingSummary.runtimeStatus)}
                  </p>
                </div>
                <StatusChip
                  tone={
                    smsCaptureRoutingSummary.runtimeStatus === "capturing"
                      ? "success"
                      : smsCaptureRoutingSummary.runtimeStatus === "manual_only"
                        ? "neutral"
                        : "warning"
                  }
                >
                  {smsCaptureRoutingSummary.captureEnabled ? "On" : "Off"}
                </StatusChip>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  className={joinClasses(
                    pressableClass,
                    "rounded-full bg-primary px-4 py-2 text-sm font-semibold text-on-primary",
                    (isSyncing || smsCaptureRoutingSummary.runtimeStatus === "manual_only") &&
                      "cursor-not-allowed opacity-70",
                  )}
                  disabled={isSyncing || smsCaptureRoutingSummary.runtimeStatus === "manual_only"}
                  onClick={() => {
                    void handleCaptureToggle();
                  }}
                  type="button"
                >
                  {smsCaptureRoutingSummary.runtimeStatus === "manual_only"
                    ? "Coming soon on this phone"
                    : smsCaptureRoutingSummary.captureEnabled
                      ? "Pause live capture"
                      : "Enable live capture"}
                </button>
                {smsCaptureRoutingSummary.runtimeStatus === "permission_required" ||
                smsCaptureRoutingSummary.runtimeStatus === "blocked" ? (
                  <button
                    className={joinClasses(
                      pressableClass,
                      "rounded-full border border-outline-variant/30 bg-surface px-4 py-2 text-sm font-semibold text-on-surface",
                      isSyncing && "cursor-wait opacity-70",
                    )}
                    disabled={isSyncing}
                    onClick={() => {
                      void handleRequestPermissions();
                    }}
                    type="button"
                  >
                    Request permission
                  </button>
                ) : null}
              </div>
            </div>
            <ToggleTile
              checked={smsCaptureSettings.autoRouteToParserWhenAppOpen}
              description="Send captured SMS straight to parser while the app is open."
              label="Auto route to parser"
              onClick={() =>
                updateSmsCaptureSettings({
                  autoRouteToParserWhenAppOpen:
                    !smsCaptureSettings.autoRouteToParserWhenAppOpen,
                })
              }
            />
            <ToggleTile
              checked={smsCaptureSettings.preserveRawSmsUntilReviewed}
              description="Keep raw SMS until review is done."
              label="Preserve raw SMS"
              onClick={() =>
                updateSmsCaptureSettings({
                  preserveRawSmsUntilReviewed:
                    !smsCaptureSettings.preserveRawSmsUntilReviewed,
                })
              }
            />
            <div className="rounded-[22px] border border-outline-variant/25 bg-background px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-on-surface-variant/70">
                Capture mode
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <StatusChip tone="neutral">
                  {smsCaptureRoutingSummary.buildMode === "native_capture"
                    ? "Native capture"
                    : "Manual only"}
                </StatusChip>
                <StatusChip
                  tone={
                    smsCaptureRoutingSummary.nativeCaptureAvailable
                      ? "success"
                      : "neutral"
                  }
                >
                  {smsCaptureRoutingSummary.nativeCaptureAvailable
                    ? "Bridge connected"
                    : "Bridge unavailable"}
                </StatusChip>
              </div>
              <p className="mt-3 text-sm text-on-surface-variant">
                Reported by the current bridge snapshot.
              </p>
            </div>
          </div>
        </MotionPanel>

        <MotionPanel className="space-y-4 rounded-[28px] border border-outline-variant/30 bg-surface p-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-on-surface-variant/70">
              Sender rules
            </p>
            <h2 className="text-lg font-semibold text-on-surface">Allow senders into capture</h2>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              aria-label="New sender label"
              className="min-w-0 flex-1 rounded-2xl border border-outline-variant/25 bg-background px-4 py-3 text-sm text-on-surface outline-none"
              onChange={(event) => setNewSenderLabel(event.target.value)}
              placeholder="Add sender label like CBE or DashenBank"
              type="text"
              value={newSenderLabel}
            />
            <button
              className={joinClasses(
                pressableClass,
                "rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-on-primary",
              )}
              onClick={handleAddSenderRule}
              type="button"
            >
              Add sender
            </button>
          </div>

          <div className="space-y-2">
            {smsCaptureSettings.senderRules.length === 0 ? (
              <div className="rounded-[22px] border border-dashed border-outline-variant/30 bg-background px-4 py-4 text-sm text-on-surface-variant">
                No bank or wallet senders added yet. Add the sender name shown
                in your SMS, like CBE or DashenBank.
              </div>
            ) : (
              smsCaptureSettings.senderRules.map((rule) => (
                <div
                  key={rule.ruleId}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-[22px] border border-outline-variant/25 bg-background px-4 py-3"
                >
                  <div>
                    <p className="font-semibold text-on-surface">{rule.senderLabel}</p>
                    <p className="text-sm text-on-surface-variant">
                      Exact sender match - updated {formatDateTime(rule.updatedAt)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      className={joinClasses(
                        pressableClass,
                        "rounded-full px-3 py-2 text-xs font-semibold",
                        rule.isEnabled
                          ? "bg-primary-container/45 text-primary"
                          : "bg-surface-container text-on-surface-variant",
                      )}
                      onClick={() =>
                        updateSmsSenderRule(rule.ruleId, {
                          isEnabled: !rule.isEnabled,
                        })
                      }
                      type="button"
                    >
                      {rule.isEnabled ? "Enabled" : "Disabled"}
                    </button>
                    <button
                      className={joinClasses(
                        pressableClass,
                        "rounded-full border border-error/20 bg-error/10 px-3 py-2 text-xs font-semibold text-error",
                      )}
                      onClick={() => removeSmsSenderRule(rule.ruleId)}
                      type="button"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </MotionPanel>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <MotionPanel className="space-y-4 rounded-[28px] border border-outline-variant/30 bg-surface p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-on-surface-variant/70">
                Routing to parser
              </p>
              <h2 className="text-lg font-semibold text-on-surface">Queue summary</h2>
            </div>
            <button
              className={joinClasses(
                pressableClass,
                "rounded-full bg-primary px-4 py-2 text-sm font-semibold text-on-primary",
              )}
              onClick={handleProcessQueue}
              type="button"
            >
              Process next queued SMS
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <MetricCard label="Pending" value={smsCaptureQueueSummary.pendingCount} />
            <MetricCard label="Parsing" value={smsCaptureQueueSummary.parsingCount} />
            <MetricCard label="Parsed" value={smsCaptureQueueSummary.parsedCount} />
            <MetricCard label="Unmatched" value={smsCaptureQueueSummary.unmatchedCount} />
            <MetricCard label="Failed" value={smsCaptureQueueSummary.failedCount} />
            <MetricCard label="Last processed" value={formatDateTime(smsCaptureQueueSummary.lastProcessedAt)} />
          </div>

          <div className="rounded-[24px] border border-outline-variant/20 bg-background p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-on-surface">Historical SMS request</p>
                <p className="mt-1 text-sm text-on-surface-variant">
                  {describeBackfillCapability(
                    smsCaptureRoutingSummary.backfillCapability,
                  )}
                </p>
              </div>
              <StatusChip
                tone={
                  smsCaptureRoutingSummary.backfillCapability === "available"
                    ? "success"
                    : "warning"
                }
              >
                {formatBackfillCapabilityLabel(
                  smsCaptureRoutingSummary.backfillCapability,
                )}
              </StatusChip>
            </div>
            <p className="mt-1 text-sm text-on-surface-variant">
              Request only until native backfill is live.
            </p>
            <div className="mt-3 flex items-center gap-3">
              <input
                className="w-24 rounded-2xl border border-outline-variant/25 bg-surface px-3 py-2 text-sm text-on-surface outline-none"
                min={1}
                onChange={(event) =>
                  updateSmsCaptureSettings({
                    retentionDays: Math.max(
                      1,
                      Math.min(365, Number.parseInt(event.target.value || "30", 10)),
                    ),
                  })
                }
                type="number"
                value={smsCaptureSettings.retentionDays}
              />
              <span className="text-sm text-on-surface-variant">days</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                className={joinClasses(
                  pressableClass,
                  "rounded-full bg-primary px-4 py-2 text-sm font-semibold text-on-primary",
                )}
                onClick={handleBackfillRequest}
                type="button"
              >
                Record history request
              </button>
              {smsCaptureRoutingSummary.backfillRequestStatus === "requested" ? (
                <button
                  className={joinClasses(
                    pressableClass,
                    "rounded-full border border-outline-variant/30 bg-surface px-4 py-2 text-sm font-semibold text-on-surface",
                  )}
                  onClick={handleClearBackfillRequest}
                  type="button"
                >
                  Clear request
                </button>
              ) : null}
            </div>
            {smsCaptureRoutingSummary.backfillRequestStatus === "requested" ? (
              <p className="mt-3 text-sm text-on-surface-variant">
                Pending request: {smsCaptureRoutingSummary.backfillRequestedLookbackDays} days,
                recorded {formatDateTime(smsCaptureRoutingSummary.backfillRequestedAt)}.
              </p>
            ) : null}
          </div>
        </MotionPanel>

        <MotionPanel className="space-y-4 rounded-[28px] border border-outline-variant/30 bg-surface p-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-on-surface-variant/70">
              Diagnostics
            </p>
            <h2 className="text-lg font-semibold text-on-surface">Runtime details</h2>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <InfoRow label="Capture supported" value={smsCaptureDiagnostics.captureSupported ? "Yes" : "No"} />
            <InfoRow label="Native bridge available" value={smsCaptureDiagnostics.nativeCaptureAvailable ? "Yes" : "No"} />
            <InfoRow label="Runtime status" value={formatRuntimeStatusLabel(smsCaptureRoutingSummary.runtimeStatus)} />
            <InfoRow label="Last captured sender" value={smsCaptureDiagnostics.lastCapturedSenderLabel ?? "None"} />
            <InfoRow label="Last captured time" value={formatDateTime(smsCaptureDiagnostics.lastCapturedAt)} />
            <InfoRow label="Parser handoff" value={formatDateTime(smsCaptureDiagnostics.lastParserHandoffAt)} />
            <InfoRow label="Parser outcome" value={formatOutcomeLabel(smsCaptureDiagnostics.lastParserOutcome)} />
            <InfoRow label="Duplicates suppressed" value={String(smsCaptureDiagnostics.duplicateSuppressedCount)} />
            <InfoRow label="Filtered out" value={String(smsCaptureDiagnostics.filteredOutCount)} />
            <InfoRow
              label="History capture"
              value={
                smsCaptureRoutingSummary.historyCaptureSupported
                  ? "Implemented"
                  : "Request only"
              }
            />
          </div>

          <div className="rounded-[24px] border border-outline-variant/20 bg-background p-4">
            <p className="text-sm font-semibold text-on-surface">Recent queue items</p>
            <div className="mt-3 space-y-2">
              {recentQueue.length === 0 ? (
                <p className="text-sm text-on-surface-variant">
                  No captured SMS are in the queue yet.
                </p>
              ) : (
                recentQueue.map((item) => (
                  <div
                    key={item.captureId}
                    className="rounded-[20px] border border-outline-variant/15 bg-surface px-3 py-3"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusChip tone="neutral">{item.senderLabel}</StatusChip>
                      <StatusChip
                        tone={
                          item.status === "parsed"
                            ? "success"
                            : item.status === "unmatched" || item.status === "failed"
                              ? "warning"
                              : "neutral"
                        }
                      >
                        {item.status}
                      </StatusChip>
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm text-on-surface">
                      {item.smsBody}
                    </p>
                    <p className="mt-1 text-xs text-on-surface-variant">
                      {formatDateTime(item.capturedAt)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </MotionPanel>
      </div>
    </section>
  );
}

function MetricPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[20px] border border-outline-variant/25 bg-background px-3 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-on-surface-variant/65">
        {label}
      </p>
      <p className="mt-1 text-base font-semibold text-on-surface">{value}</p>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-[24px] border border-outline-variant/20 bg-background px-4 py-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-on-surface-variant/65">
        {label}
      </p>
      <p className="mt-2 text-lg font-semibold text-on-surface">{value}</p>
    </div>
  );
}

function ToggleTile({
  checked,
  description,
  label,
  onClick,
}: {
  checked: boolean;
  description: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={joinClasses(
        pressableClass,
        "rounded-[22px] border px-4 py-3 text-left",
        checked ? "border-primary/25 bg-primary-container/25" : "border-outline-variant/25 bg-background",
      )}
      onClick={onClick}
      type="button"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="font-semibold text-on-surface">{label}</p>
        <StatusChip tone={checked ? "success" : "neutral"}>{checked ? "On" : "Off"}</StatusChip>
      </div>
      <p className="mt-2 text-sm text-on-surface-variant">{description}</p>
    </button>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[22px] border border-outline-variant/20 bg-background px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-on-surface-variant/65">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium text-on-surface">{value}</p>
    </div>
  );
}
