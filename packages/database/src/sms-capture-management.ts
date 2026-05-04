import type {
  SmsCaptureBackfillCapability,
  SmsCaptureBackfillRequest,
  CapturedSmsEnvelope,
  RawSmsMessage,
  SmsCaptureDiagnostics,
  SmsCaptureEnqueueOptions,
  SmsCaptureQueueItem,
  SmsCaptureQueueMergeResult,
  SmsCaptureQueueSummary,
  SmsCaptureRoutingSummary,
  SmsCaptureSettings,
  SmsCaptureSource,
  SmsSenderRule,
} from "@omni-sync/core";

function compactText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function normalizeSmsSenderLabel(senderLabel: string): string {
  return senderLabel.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function createDefaultSmsCaptureSettings(): SmsCaptureSettings {
  return {
    captureEnabled: false,
    buildMode: "manual_only",
    autoRouteToParserWhenAppOpen: true,
    preserveRawSmsUntilReviewed: true,
    retentionDays: 30,
    senderRules: [],
  };
}

export function createDefaultSmsCaptureDiagnostics(): SmsCaptureDiagnostics {
  return {
    permissionState: "unknown",
    nativeCaptureAvailable: false,
    captureSupported: false,
    historyCaptureSupported: false,
    duplicateSuppressedCount: 0,
    filteredOutCount: 0,
    lastCapturedAt: null,
    lastCapturedSenderLabel: null,
    lastParserHandoffAt: null,
    lastParserOutcome: "idle",
    lastFailureReason: null,
  };
}

export function createDefaultSmsCaptureBackfillRequest(): SmsCaptureBackfillRequest {
  return {
    lookbackDays: null,
    status: "idle",
    requestedAt: null,
  };
}

function sanitizeSmsCaptureBackfillLookbackDays(
  lookbackDays: number | null,
): number | null {
  if (lookbackDays === null || !Number.isFinite(lookbackDays)) {
    return null;
  }

  const normalizedLookbackDays = Math.floor(lookbackDays);
  return normalizedLookbackDays > 0 ? normalizedLookbackDays : null;
}

export function createSmsCaptureBackfillRequest(
  lookbackDays: number | null,
  requestedAt = new Date().toISOString(),
): SmsCaptureBackfillRequest {
  const normalizedLookbackDays =
    sanitizeSmsCaptureBackfillLookbackDays(lookbackDays);

  return {
    lookbackDays: normalizedLookbackDays,
    status: normalizedLookbackDays === null ? "idle" : "requested",
    requestedAt: normalizedLookbackDays === null ? null : requestedAt,
  };
}

export function createSmsSenderRule(
  senderLabel: string,
  createdAt = new Date().toISOString(),
): SmsSenderRule {
  const trimmed = compactText(senderLabel);
  if (trimmed.length === 0) {
    throw new Error("Sender label is required.");
  }

  return {
    ruleId: `sms-rule-${normalizeSmsSenderLabel(trimmed) || "sender"}-${createdAt.replace(/\D/g, "").slice(0, 14)}`,
    senderLabel: trimmed,
    normalizedSenderLabel: normalizeSmsSenderLabel(trimmed),
    matchMode: "exact",
    isEnabled: true,
    createdAt,
    updatedAt: createdAt,
  };
}

export function updateSmsSenderRule(
  rule: SmsSenderRule,
  updates: Partial<Pick<SmsSenderRule, "senderLabel" | "isEnabled">>,
  updatedAt = new Date().toISOString(),
): SmsSenderRule {
  const senderLabel =
    updates.senderLabel === undefined ? rule.senderLabel : compactText(updates.senderLabel);

  if (senderLabel.length === 0) {
    throw new Error("Sender label is required.");
  }

  return {
    ...rule,
    senderLabel,
    normalizedSenderLabel: normalizeSmsSenderLabel(senderLabel),
    isEnabled: updates.isEnabled ?? rule.isEnabled,
    updatedAt,
  };
}

function buildSmsCaptureHash(
  senderLabel: string,
  smsBody: string,
  receivedAt: string,
): string {
  return [
    normalizeSmsSenderLabel(senderLabel),
    compactText(smsBody).toLowerCase(),
    receivedAt,
  ].join("::");
}

export function createCapturedSmsEnvelope(
  rawSmsMessage: RawSmsMessage,
  options: SmsCaptureEnqueueOptions = {},
): CapturedSmsEnvelope {
  const capturedAt = options.capturedAt ?? new Date().toISOString();

  return {
    captureId: `capture-${rawSmsMessage.messageId}-${capturedAt.replace(/\D/g, "").slice(0, 17)}`,
    messageId: rawSmsMessage.messageId,
    senderLabel: compactText(rawSmsMessage.senderLabel),
    smsBody: compactText(rawSmsMessage.smsBody),
    receivedAt: rawSmsMessage.receivedAt,
    capturedAt,
    source: options.source ?? "android_sms_receiver",
    hash: buildSmsCaptureHash(
      rawSmsMessage.senderLabel,
      rawSmsMessage.smsBody,
      rawSmsMessage.receivedAt,
    ),
    subscriptionId: options.subscriptionId,
    subscriptionSlot: options.subscriptionSlot,
  };
}

export function shouldCaptureSmsFromSender(
  senderLabel: string,
  senderRules: readonly SmsSenderRule[],
): boolean {
  const enabledRules = senderRules.filter((rule) => rule.isEnabled);
  if (enabledRules.length === 0) {
    return false;
  }

  const normalizedSender = normalizeSmsSenderLabel(senderLabel);
  return enabledRules.some(
    (rule) => rule.normalizedSenderLabel === normalizedSender,
  );
}

export function createSmsCaptureQueueItem(
  envelope: CapturedSmsEnvelope,
  autoRouteToParserWhenAppOpen = true,
): SmsCaptureQueueItem {
  return {
    ...envelope,
    status: autoRouteToParserWhenAppOpen ? "queued_for_parse" : "captured",
    parseAttemptCount: 0,
  };
}

function getSmsCaptureDedupKey(
  item: Pick<CapturedSmsEnvelope, "hash" | "messageId" | "receivedAt">,
): string {
  return item.hash || `${item.messageId}::${item.receivedAt}`;
}

function getSmsCaptureQueueStatusPriority(status: SmsCaptureQueueItem["status"]): number {
  switch (status) {
    case "parsed":
      return 5;
    case "unmatched":
      return 4;
    case "failed":
      return 3;
    case "parsing":
      return 2;
    case "queued_for_parse":
      return 1;
    case "captured":
    default:
      return 0;
  }
}

function choosePreferredSmsCaptureQueueItem(
  left: SmsCaptureQueueItem,
  right: SmsCaptureQueueItem,
): SmsCaptureQueueItem {
  if (left.parseAttemptCount !== right.parseAttemptCount) {
    return left.parseAttemptCount > right.parseAttemptCount ? left : right;
  }

  const statusPriorityDelta =
    getSmsCaptureQueueStatusPriority(left.status) -
    getSmsCaptureQueueStatusPriority(right.status);
  if (statusPriorityDelta !== 0) {
    return statusPriorityDelta > 0 ? left : right;
  }

  return new Date(left.capturedAt).getTime() <= new Date(right.capturedAt).getTime()
    ? left
    : right;
}

function sortSmsCaptureQueueItems(
  queue: readonly SmsCaptureQueueItem[],
): SmsCaptureQueueItem[] {
  return [...queue].sort((left, right) => {
    const capturedDelta =
      new Date(left.capturedAt).getTime() - new Date(right.capturedAt).getTime();
    if (capturedDelta !== 0) {
      return capturedDelta;
    }

    return left.captureId.localeCompare(right.captureId);
  });
}

export function findSmsCaptureQueueDuplicate(
  currentQueue: readonly SmsCaptureQueueItem[],
  candidate: Pick<CapturedSmsEnvelope, "hash" | "messageId" | "receivedAt">,
): SmsCaptureQueueItem | undefined {
  const candidateKey = getSmsCaptureDedupKey(candidate);

  return currentQueue.find(
    (item) => getSmsCaptureDedupKey(item) === candidateKey,
  );
}

export function mergeSmsCaptureQueueItems(
  currentQueue: readonly SmsCaptureQueueItem[],
  incomingItems: readonly SmsCaptureQueueItem[],
): {
  queue: SmsCaptureQueueItem[];
  mergeResult: SmsCaptureQueueMergeResult;
} {
  const nextByDedupKey = new Map<string, SmsCaptureQueueItem>();
  let duplicateCount = 0;

  for (const item of currentQueue) {
    nextByDedupKey.set(getSmsCaptureDedupKey(item), item);
  }

  for (const item of incomingItems) {
    const dedupKey = getSmsCaptureDedupKey(item);
    const existing = nextByDedupKey.get(dedupKey);
    if (!existing) {
      nextByDedupKey.set(dedupKey, item);
      continue;
    }

    duplicateCount += 1;
    nextByDedupKey.set(
      dedupKey,
      choosePreferredSmsCaptureQueueItem(existing, item),
    );
  }

  return {
    queue: sortSmsCaptureQueueItems([...nextByDedupKey.values()]),
    mergeResult: {
      addedCount: incomingItems.length - duplicateCount,
      duplicateCount,
      filteredOutCount: 0,
    },
  };
}

export function upsertSmsCaptureQueueItem(
  currentQueue: readonly SmsCaptureQueueItem[],
  nextItem: SmsCaptureQueueItem,
): SmsCaptureQueueItem[] {
  return mergeSmsCaptureQueueItems(currentQueue, [nextItem]).queue;
}

function clearProcessedOutcomeFields(
  item: SmsCaptureQueueItem,
): Omit<SmsCaptureQueueItem, "status"> {
  const {
    status: _status,
    parsedAt: _parsedAt,
    failedAt: _failedAt,
    parserQueueEntryId: _parserQueueEntryId,
    unmatchedEntryId: _unmatchedEntryId,
    failureReason: _failureReason,
    ...rest
  } = item;

  return rest;
}

export function markSmsCaptureQueueItemQueuedForParse(
  item: SmsCaptureQueueItem,
): SmsCaptureQueueItem {
  return {
    ...clearProcessedOutcomeFields(item),
    status: "queued_for_parse",
    parseAttemptCount: item.parseAttemptCount,
  };
}

export function markSmsCaptureQueueItemParsing(
  item: SmsCaptureQueueItem,
): SmsCaptureQueueItem {
  return {
    ...clearProcessedOutcomeFields(item),
    status: "parsing",
    parseAttemptCount: item.parseAttemptCount + 1,
  };
}

export function markSmsCaptureQueueItemParsed(
  item: SmsCaptureQueueItem,
  parserQueueEntryId: string,
  parsedAt: string,
): SmsCaptureQueueItem {
  return {
    ...clearProcessedOutcomeFields(item),
    status: "parsed",
    parseAttemptCount: item.parseAttemptCount,
    parserQueueEntryId,
    parsedAt,
  };
}

export function markSmsCaptureQueueItemUnmatched(
  item: SmsCaptureQueueItem,
  unmatchedEntryId: string,
  parsedAt: string,
  failureReason: string,
): SmsCaptureQueueItem {
  return {
    ...clearProcessedOutcomeFields(item),
    status: "unmatched",
    parseAttemptCount: item.parseAttemptCount,
    unmatchedEntryId,
    parsedAt,
    failureReason,
  };
}

export function markSmsCaptureQueueItemFailed(
  item: SmsCaptureQueueItem,
  failureReason: string,
  failedAt: string,
): SmsCaptureQueueItem {
  return {
    ...clearProcessedOutcomeFields(item),
    status: "failed",
    parseAttemptCount: item.parseAttemptCount,
    failedAt,
    failureReason,
  };
}

export function buildSmsCaptureQueueSummary(
  queue: readonly SmsCaptureQueueItem[],
): SmsCaptureQueueSummary {
  const summary: SmsCaptureQueueSummary = {
    pendingCount: 0,
    parsingCount: 0,
    parsedCount: 0,
    unmatchedCount: 0,
    failedCount: 0,
    lastCapturedAt: null,
    lastProcessedAt: null,
  };

  for (const item of queue) {
    if (
      summary.lastCapturedAt === null ||
      new Date(item.capturedAt).getTime() > new Date(summary.lastCapturedAt).getTime()
    ) {
      summary.lastCapturedAt = item.capturedAt;
    }

    if (item.parsedAt) {
      if (
        summary.lastProcessedAt === null ||
        new Date(item.parsedAt).getTime() >
          new Date(summary.lastProcessedAt).getTime()
      ) {
        summary.lastProcessedAt = item.parsedAt;
      }
    }

    if (item.failedAt) {
      if (
        summary.lastProcessedAt === null ||
        new Date(item.failedAt).getTime() >
          new Date(summary.lastProcessedAt).getTime()
      ) {
        summary.lastProcessedAt = item.failedAt;
      }
    }

    switch (item.status) {
      case "captured":
      case "queued_for_parse":
        summary.pendingCount += 1;
        break;
      case "parsing":
        summary.parsingCount += 1;
        break;
      case "parsed":
        summary.parsedCount += 1;
        break;
      case "unmatched":
        summary.unmatchedCount += 1;
        break;
      case "failed":
        summary.failedCount += 1;
        break;
    }
  }

  return summary;
}

function pickLatestTimestamp(
  currentValue: string | null,
  candidateValue: string | undefined,
): string | null {
  if (!candidateValue) {
    return currentValue;
  }

  if (
    currentValue === null ||
    new Date(candidateValue).getTime() > new Date(currentValue).getTime()
  ) {
    return candidateValue;
  }

  return currentValue;
}

export function deriveSmsCaptureBackfillCapability(
  settings: Pick<SmsCaptureSettings, "buildMode">,
  diagnostics: Pick<
    SmsCaptureDiagnostics,
    "nativeCaptureAvailable" | "captureSupported" | "historyCaptureSupported"
  >,
): SmsCaptureBackfillCapability {
  if (diagnostics.historyCaptureSupported === true) {
    return "available";
  }

  if (
    settings.buildMode === "native_capture" &&
    diagnostics.nativeCaptureAvailable &&
    diagnostics.captureSupported
  ) {
    return "native_follow_up_required";
  }

  return "unsupported";
}

export function deriveSmsCaptureRuntimeStatus(
  settings: Pick<SmsCaptureSettings, "buildMode" | "captureEnabled">,
  diagnostics: Pick<
    SmsCaptureDiagnostics,
    "nativeCaptureAvailable" | "captureSupported" | "permissionState"
  >,
): SmsCaptureRoutingSummary["runtimeStatus"] {
  if (
    settings.buildMode === "manual_only" ||
    !diagnostics.nativeCaptureAvailable ||
    !diagnostics.captureSupported
  ) {
    return "manual_only";
  }

  if (diagnostics.permissionState === "denied") {
    return "blocked";
  }

  if (
    diagnostics.permissionState === "prompt" ||
    diagnostics.permissionState === "unknown"
  ) {
    return "permission_required";
  }

  return settings.captureEnabled ? "capturing" : "native_available";
}

export function buildSmsCaptureRoutingSummary({
  settings,
  queue,
  queueSummary,
  diagnostics,
  backfillRequest,
}: {
  settings: SmsCaptureSettings;
  queue: readonly SmsCaptureQueueItem[];
  queueSummary: SmsCaptureQueueSummary;
  diagnostics: SmsCaptureDiagnostics;
  backfillRequest: SmsCaptureBackfillRequest;
}): SmsCaptureRoutingSummary {
  const enabledSenderRuleCount = settings.senderRules.filter(
    (rule) => rule.isEnabled,
  ).length;
  const oldestPendingItem =
    queue.find(
      (item) =>
        item.status === "captured" || item.status === "queued_for_parse",
    ) ?? null;

  let lastParsedAt: string | null = null;
  let lastUnmatchedAt: string | null = null;
  let lastFailedAt: string | null = null;
  let lastFailedReason: string | null = null;

  for (const item of queue) {
    if (item.status === "parsed") {
      lastParsedAt = pickLatestTimestamp(lastParsedAt, item.parsedAt);
    }

    if (item.status === "unmatched") {
      lastUnmatchedAt = pickLatestTimestamp(lastUnmatchedAt, item.parsedAt);
    }

    if (item.status === "failed") {
      const nextFailedAt = pickLatestTimestamp(lastFailedAt, item.failedAt);
      if (nextFailedAt !== lastFailedAt) {
        lastFailedAt = nextFailedAt;
        lastFailedReason = item.failureReason ?? null;
      }
    }
  }

  return {
    runtimeStatus: deriveSmsCaptureRuntimeStatus(settings, diagnostics),
    captureEnabled: settings.captureEnabled,
    buildMode: settings.buildMode,
    permissionState: diagnostics.permissionState,
    nativeCaptureAvailable: diagnostics.nativeCaptureAvailable,
    captureSupported: diagnostics.captureSupported,
    historyCaptureSupported: diagnostics.historyCaptureSupported === true,
    exactSenderRuleCount: settings.senderRules.length,
    enabledSenderRuleCount,
    disabledSenderRuleCount:
      settings.senderRules.length - enabledSenderRuleCount,
    hasSenderRules: enabledSenderRuleCount > 0,
    queueItemCount: queue.length,
    pendingCount: queueSummary.pendingCount,
    parsingCount: queueSummary.parsingCount,
    parsedCount: queueSummary.parsedCount,
    unmatchedCount: queueSummary.unmatchedCount,
    failedCount: queueSummary.failedCount,
    oldestPendingCaptureId: oldestPendingItem?.captureId ?? null,
    oldestPendingCapturedAt: oldestPendingItem?.capturedAt ?? null,
    lastCapturedAt: diagnostics.lastCapturedAt ?? queueSummary.lastCapturedAt,
    lastCapturedSenderLabel: diagnostics.lastCapturedSenderLabel,
    lastParsedAt,
    lastUnmatchedAt,
    lastFailedAt,
    lastFailedReason,
    lastParserHandoffAt: diagnostics.lastParserHandoffAt,
    duplicateSuppressedCount: diagnostics.duplicateSuppressedCount,
    filteredOutCount: diagnostics.filteredOutCount,
    backfillCapability: deriveSmsCaptureBackfillCapability(
      settings,
      diagnostics,
    ),
    backfillRequestedLookbackDays: backfillRequest.lookbackDays,
    backfillRequestStatus: backfillRequest.status,
    backfillRequestedAt: backfillRequest.requestedAt,
  };
}
