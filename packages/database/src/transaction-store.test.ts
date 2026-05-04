import { afterEach, describe, expect, it, vi } from "vitest";

import { parseSmsMessage } from "../../core/src/parser";
import {
  createDefaultParserTemplateWorkspace,
  resolveParserTemplateWorkspace,
} from "../../core/src/parserWorkspace";
import type {
  AccountSummary,
  ApprovalQueueItem,
  ApprovedTransaction,
  AuthorityMode,
  CapturedSmsEnvelope,
  ParsedTransactionDraft,
  ParserTemplateDefinition,
  RawSmsMessage,
  ReconciliationItem,
  SmsCaptureRuntimeSnapshot,
  SmsCaptureQueueItem,
  SmsSenderRule,
} from "../../core/src/types";
import type {
  BackupPackage,
  HistoricalImportPackage,
} from "../../core/src/storage";
import {
  __setHistoricalImportServiceLoaderForTests,
  buildDashboardSnapshot,
  createTransactionStore,
  selectManagedAccounts,
  selectSmsCaptureRoutingSummary,
  selectVisibleManagedAccounts,
} from "./transaction-store";
import {
  createCapturedSmsEnvelope,
  createSmsCaptureQueueItem,
} from "./sms-capture-management";
import {
  createMemorySqliteBinaryStorage,
  createSQLiteStateStorage,
} from "./sqlite/state-storage";

afterEach(() => {
  __setHistoricalImportServiceLoaderForTests();
});

function buildHistoricalDraft(
  overrides: Partial<ParsedTransactionDraft> = {},
): ParsedTransactionDraft {
  return {
    draftId: "historical-draft-001",
    rawMessageId: "historical-raw-001",
    senderLabel: "CBE",
    rawBody: "Imported historical entry",
    financialInstitution: "cbe",
    transactionDirection: "debit",
    amountMinor: 12500,
    feeMinor: 0,
    runningBalanceMinor: 985700,
    reportedBalanceMinor: 985700,
    currencyCode: "ETB",
    title: "Historical Grocery",
    merchantName: "Historical Grocery",
    category: "food",
    parserTemplateId: "historical_import",
    confidence: 100,
    occurredAt: "2026-04-10T09:00:00.000Z",
    accountReference: "4920",
    accountChannel: "bank",
    note: "",
    ...overrides,
  };
}

function buildApprovedTransaction(
  draft: ParsedTransactionDraft,
  approvedAt = "2026-05-01T10:00:00.000Z",
): ApprovedTransaction {
  return {
    ...draft,
    transactionId: `tx-${draft.draftId}`,
    approvedAt,
    approvalStatus: "approved",
    note: draft.note ?? "",
  };
}

function buildApprovalQueueItem(
  draft: ParsedTransactionDraft,
  queuedAt = "2026-05-01T10:00:00.000Z",
): ApprovalQueueItem {
  return {
    ...draft,
    queueEntryId: `queue-${draft.draftId}`,
    queuedAt,
    approvalStatus: "pending_approval",
    note: draft.note ?? "",
  };
}

function buildAccountSummaryFromDraft(
  draft: ParsedTransactionDraft,
): AccountSummary {
  const accountReference = draft.accountReference?.trim();
  const stableReference = accountReference || draft.accountChannel;

  return {
    accountId: `acct-${draft.financialInstitution}-${stableReference}`,
    institutionName:
      draft.financialInstitution === "telebirr"
        ? "Telebirr"
        : draft.financialInstitution.toUpperCase(),
    maskedAccountNumber: accountReference
      ? `**** ${accountReference.slice(-4)}`
      : draft.accountChannel === "cash"
        ? "Pocket cash"
        : "Unknown account",
    fullAccountNumber: accountReference,
    balanceMinor: draft.reportedBalanceMinor ?? draft.runningBalanceMinor,
    currencyCode: draft.currencyCode,
    channel: draft.accountChannel,
    iconName: draft.accountChannel === "mobile_money" ? "phone_iphone" : "payments",
    tone:
      draft.accountChannel === "mobile_money"
        ? "secondary"
        : draft.accountChannel === "cash"
          ? "surface"
          : "primary",
  };
}

function buildRawSmsMessage(
  overrides: Partial<RawSmsMessage> = {},
): RawSmsMessage {
  return {
    messageId: "sms-cbe-capture-001",
    senderLabel: "CBE",
    smsBody:
      "CBE ALERT: Your account 4920 was debited with ETB 320.00 on 2026-04-30 at CITY MARKET. Bal ETB 8130.00",
    receivedAt: "2026-04-30T09:10:00.000Z",
    ...overrides,
  };
}

function enableSmsCaptureWithRule(
  transactionStore: ReturnType<typeof createTransactionStore>,
  senderLabel = "CBE",
): SmsSenderRule {
  transactionStore.getState().updateSmsCaptureSettings({
    captureEnabled: true,
  });

  return transactionStore.getState().addSmsSenderRule(
    senderLabel,
    "2026-05-02T07:00:00.000Z",
  );
}

function buildSmsCaptureRuntimeSnapshot(
  overrides: Partial<SmsCaptureRuntimeSnapshot> = {},
): SmsCaptureRuntimeSnapshot {
  const queue =
    overrides.queue ??
    [
      createSmsCaptureQueueItem(
        createCapturedSmsEnvelope(buildRawSmsMessage(), {
          capturedAt: "2026-04-30T09:11:00.000Z",
        }),
      ),
    ];

  return {
    captureEnabled: true,
    buildMode: "native_capture",
    queue,
    diagnostics: {
      permissionState: "granted",
      nativeCaptureAvailable: true,
      captureSupported: true,
      historyCaptureSupported: false,
      duplicateSuppressedCount: 0,
      filteredOutCount: 0,
      lastCapturedAt: "2026-04-30T09:11:00.000Z",
      lastCapturedSenderLabel: "CBE",
      lastParserHandoffAt: null,
      lastParserOutcome: "idle",
      lastFailureReason: null,
    },
    ...overrides,
  };
}

function buildHistoricalImportPackage(
  drafts: readonly ParsedTransactionDraft[],
  unmatchedEntries: readonly {
    unmatchedEntryId: string;
    rawMessageId: string;
    senderLabel: string;
    smsBody: string;
    receivedAt: string;
    capturedAt: string;
    failureReason: "no_template_match";
  }[] = [],
): HistoricalImportPackage {
  return {
    kind: "trackwallet-historical-import",
    version: 1,
    createdAt: "2026-05-02T10:00:00.000Z",
    drafts: drafts.map((draft) => ({ ...draft })),
    unmatchedEntries: unmatchedEntries.map((entry) => ({ ...entry })),
  };
}

function buildParserTemplate(
  overrides: Partial<ParserTemplateDefinition> = {},
): ParserTemplateDefinition {
  return {
    id: "historical_import",
    financialInstitution: "cbe",
    institutionKey: "CBE",
    institutionLabel: "Commercial Bank of Ethiopia",
    institutionIcon: "account_balance",
    senderAliases: ["CBE"],
    accountIdentifiers: [],
    identityTextFragments: [],
    name: "Historical Import Template",
    version: "v1.0.0",
    updated: "Runtime template",
    status: "active",
    regex: "Imported historical entry",
    note: "Runtime template",
    healthScore: 100,
    sourceType: "core",
    templateKind: "builtin",
    engineEditable: false,
    userProfile: {
      senderAliases: ["CBE"],
      accountIdentifiers: [],
      identityTextFragments: [],
    },
    direction: "debit",
    amountKey: "amount",
    merchantKey: "merchant",
    balanceKey: "balance",
    accountKey: "account",
    dateKey: "date",
    dateMode: "message_date",
    ...overrides,
  };
}

function buildParserWorkspaceAuthorityState() {
  const templateWorkspace = createDefaultParserTemplateWorkspace();
  const [selectedTemplate] = resolveParserTemplateWorkspace(templateWorkspace);

  return {
    version: 1 as const,
    templateWorkspace,
    selectedTemplateId: selectedTemplate?.id ?? "",
    senderLabel:
      selectedTemplate?.senderAliases[0] ?? selectedTemplate?.institutionKey ?? "CBE",
    strictSchemaParsing: true,
    preserveRawSms: true,
    autoReconciliation: true,
    verboseLogging: true,
  };
}

describe("createTransactionStore", () => {
  it("seeds demo data for the current mobile dashboard slice", () => {
    const transactionStore = createTransactionStore();

    transactionStore.getState().seedDemoData();

    const state = transactionStore.getState();
    const dashboardSnapshot = buildDashboardSnapshot(state);

    expect(state.approvalQueue).toHaveLength(3);
    expect(state.approvedTransactions).toHaveLength(3);
    expect(state.accountSummaries).toHaveLength(4);
    expect(state.budgetSummaries).toHaveLength(5);
    expect(state.syncEnabled).toBe(true);
    expect(state.syncMode).toBe("automatic");
    expect(state.syncDiscoveryState).toBe("searching");
    expect(state.nearbySyncDevices).toHaveLength(2);
    expect(state.trustedSyncDevices).toHaveLength(1);
    expect(dashboardSnapshot.totalBalanceMinor).toBe(1039000);
    expect(dashboardSnapshot.pendingApprovalCount).toBe(3);
    expect(dashboardSnapshot.approvedTransactionCount).toBe(3);
    expect(dashboardSnapshot.balanceByChannel).toEqual({
      bank: 925000,
      mobile_money: 96000,
      cash: 18000,
    });
  });

  it("can pair a nearby desktop and trigger a manual sync event", () => {
    const transactionStore = createTransactionStore();

    transactionStore.getState().seedDemoData();
    transactionStore.getState().pairNearbyDevice(
      "nearby-desktop-authority",
      "2026-04-30T14:10:00.000Z",
    );
    transactionStore
      .getState()
      .markTrustedDeviceAsPrimary("nearby-desktop-authority");
    transactionStore
      .getState()
      .setSyncMode("manual");
    transactionStore
      .getState()
      .triggerManualSync("2026-04-30T14:11:00.000Z");

    const state = transactionStore.getState();
    const pairedDevice = state.trustedSyncDevices.find(
      (device) => device.deviceId === "nearby-desktop-authority",
    );

    expect(state.nearbySyncDevices).toHaveLength(1);
    expect(state.trustedSyncDevices).toHaveLength(2);
    expect(pairedDevice).toMatchObject({
      isPrimary: true,
      autoSyncEnabled: false,
      lastSyncedAt: "2026-04-30T14:11:00.000Z",
      health: "healthy",
    });
    expect(state.syncStatusSummary.headline).toContain("Demo Desktop Authority");
    expect(state.syncActivity[0]).toMatchObject({
      type: "sync",
      status: "success",
      title: "Manual sync completed",
    });
  });

  it("accepts a valid 6-digit pairing code and can remove a trusted device", () => {
    const transactionStore = createTransactionStore();

    transactionStore.getState().seedDemoData();
    transactionStore.getState().updatePairingCodeInput("284913");
    transactionStore
      .getState()
      .submitPairingCode("2026-04-30T14:15:00.000Z");

    let state = transactionStore.getState();
    expect(
      state.trustedSyncDevices.some(
        (device) => device.deviceId === "nearby-desktop-authority",
      ),
    ).toBe(true);
    expect(state.pairingCodeState.pendingCodeInput).toBe("");
    expect(state.pairingCodeState.errorMessage).toBeNull();

    transactionStore.getState().removeTrustedDevice("nearby-desktop-authority");
    state = transactionStore.getState();

    expect(
      state.trustedSyncDevices.some(
        (device) => device.deviceId === "nearby-desktop-authority",
      ),
    ).toBe(false);
    expect(state.syncActivity[0]).toMatchObject({
      type: "trust",
      status: "warning",
    });
  });

  it("rejects an expired 6-digit pairing code in the store", () => {
    const transactionStore = createTransactionStore();

    transactionStore.getState().seedDemoData();
    transactionStore.setState((state) => ({
      pairingCodeState: {
        ...state.pairingCodeState,
        expiresAt: "2026-04-30T14:00:00.000Z",
      },
    }));
    transactionStore.getState().updatePairingCodeInput("284913");

    const trustedDevice = transactionStore
      .getState()
      .submitPairingCode("2026-04-30T14:15:00.000Z");
    const state = transactionStore.getState();

    expect(trustedDevice).toBeNull();
    expect(state.pairingCodeState.errorMessage).toContain("expired");
    expect(
      state.trustedSyncDevices.some(
        (device) => device.deviceId === "code-paired-284913",
      ),
    ).toBe(false);
    expect(state.syncActivity[0]).toMatchObject({
      type: "pairing",
      status: "warning",
      title: "Pairing code expired",
    });
  });

  it("queues a parsed SMS draft for manual review", () => {
    const rawSmsMessage: RawSmsMessage = {
      messageId: "sms-cbe-debit-queue-001",
      senderLabel: "CBE",
      smsBody:
        "CBE ALERT: Your account 4920 was debited with ETB 320.00 on 2026-04-30 at CITY MARKET. Bal ETB 8130.00",
      receivedAt: "2026-04-30T09:10:00.000Z",
    };

    const parseResult = parseSmsMessage(rawSmsMessage);
    if (parseResult.status !== "matched") {
      throw new Error("Expected parser to create a draft for queueing");
    }

    const transactionStore = createTransactionStore();
    const queuedDraft = transactionStore
      .getState()
      .queueParsedTransaction(parseResult.draft, "2026-04-30T09:10:30.000Z");

    const state = transactionStore.getState();

    expect(state.approvalQueue).toHaveLength(1);
    expect(state.approvalQueue[0]?.queueEntryId).toBe(queuedDraft.queueEntryId);
    expect(state.approvalQueue[0]?.approvalStatus).toBe("pending_approval");
    expect(state.approvalQueue[0]?.title).toBe("City Market");
    expect(state.approvalQueue[0]?.queuedAt).toBe("2026-04-30T09:10:30.000Z");
  });

  it("captures unmatched SMS into a raw review lane without polluting the approval queue", () => {
    const rawSmsMessage: RawSmsMessage = {
      messageId: "sms-unknown-raw-001",
      senderLabel: "Unknown Sender",
      smsBody: "Lunch tomorrow at 1pm?",
      receivedAt: "2026-04-30T13:30:00.000Z",
    };

    const parseResult = parseSmsMessage(rawSmsMessage);
    if (parseResult.status !== "unmatched") {
      throw new Error("Expected parser to leave this message unmatched");
    }

    const transactionStore = createTransactionStore();
    const unmatchedEntry = transactionStore
      .getState()
      .captureUnmatchedSms(rawSmsMessage, parseResult, "2026-04-30T13:30:30.000Z");

    const state = transactionStore.getState();

    expect(state.approvalQueue).toHaveLength(0);
    expect(state.unmatchedMessages).toHaveLength(1);
    expect(state.unmatchedMessages[0]?.unmatchedEntryId).toBe(
      unmatchedEntry.unmatchedEntryId,
    );
    expect(state.unmatchedMessages[0]).toMatchObject({
      rawMessageId: "sms-unknown-raw-001",
      senderLabel: "Unknown Sender",
      smsBody: "Lunch tomorrow at 1pm?",
      failureReason: "no_template_match",
      capturedAt: "2026-04-30T13:30:30.000Z",
    });
  });

  it("updates or creates account summaries only after approval", () => {
    const rawSmsMessage: RawSmsMessage = {
      messageId: "sms-telebirr-credit-queue-001",
      senderLabel: "127",
      smsBody:
        "You have received 250.00 ETB from MINT CAFE. Your current balance is ETB 1,500.00.",
      receivedAt: "2026-04-30T11:05:00.000Z",
    };

    const parseResult = parseSmsMessage(rawSmsMessage);
    if (parseResult.status !== "matched") {
      throw new Error("Expected parser to create a Telebirr draft for queueing");
    }

    const transactionStore = createTransactionStore();

    const queueEntry = transactionStore
      .getState()
      .queueParsedTransaction(parseResult.draft, "2026-04-30T11:05:30.000Z");

    expect(transactionStore.getState().accountSummaries).toHaveLength(0);

    transactionStore
      .getState()
      .approveQueueItem(queueEntry.queueEntryId, "2026-04-30T11:06:00.000Z");

    const state = transactionStore.getState();

    expect(state.accountSummaries).toHaveLength(1);
    expect(state.accountSummaries[0]).toMatchObject({
      institutionName: "Telebirr",
      maskedAccountNumber: "Unknown account",
      balanceMinor: 150000,
      channel: "mobile_money",
      iconName: "phone_iphone",
      tone: "secondary",
    });
  });

  it("enqueues captured SMS in captured-time order and tracks queue summary state", () => {
    const transactionStore = createTransactionStore();
    enableSmsCaptureWithRule(transactionStore, "CBE");
    transactionStore.getState().updateSmsCaptureSettings({
      autoRouteToParserWhenAppOpen: false,
    });

    transactionStore.getState().enqueueCapturedSms(
      buildRawSmsMessage({
        messageId: "sms-cbe-capture-002",
        receivedAt: "2026-04-30T09:30:00.000Z",
      }),
      {
        capturedAt: "2026-04-30T09:31:00.000Z",
      },
    );
    transactionStore.getState().enqueueCapturedSms(
      buildRawSmsMessage({
        messageId: "sms-cbe-capture-001",
        receivedAt: "2026-04-30T09:10:00.000Z",
      }),
      {
        capturedAt: "2026-04-30T09:11:00.000Z",
      },
    );

    const state = transactionStore.getState();

    expect(state.smsCaptureQueue).toHaveLength(2);
    expect(state.smsCaptureQueue.map((item) => item.messageId)).toEqual([
      "sms-cbe-capture-001",
      "sms-cbe-capture-002",
    ]);
    expect(state.smsCaptureQueue.map((item) => item.status)).toEqual([
      "captured",
      "captured",
    ]);
    expect(state.smsCaptureQueueSummary).toMatchObject({
      pendingCount: 2,
      parsingCount: 0,
      parsedCount: 0,
      unmatchedCount: 0,
      failedCount: 0,
      lastCapturedAt: "2026-04-30T09:31:00.000Z",
      lastProcessedAt: null,
    });
    expect(state.smsCaptureDiagnostics).toMatchObject({
      filteredOutCount: 0,
      duplicateSuppressedCount: 0,
      lastCapturedAt: "2026-04-30T09:31:00.000Z",
      lastCapturedSenderLabel: "CBE",
      lastParserOutcome: "idle",
    });
  });

  it("filters SMS from senders outside the exact allowlist", () => {
    const transactionStore = createTransactionStore();
    enableSmsCaptureWithRule(transactionStore, "CBE");

    const result = transactionStore.getState().enqueueCapturedSms(
      buildRawSmsMessage({
        messageId: "sms-dashen-capture-001",
        senderLabel: "Dashen",
      }),
      {
        capturedAt: "2026-04-30T10:00:00.000Z",
      },
    );
    const state = transactionStore.getState();

    expect(result).toMatchObject({
      status: "filtered_out",
      senderLabel: "Dashen",
    });
    expect(state.smsCaptureQueue).toHaveLength(0);
    expect(state.smsCaptureDiagnostics.filteredOutCount).toBe(1);
    expect(state.smsCaptureDiagnostics.lastCapturedAt).toBeNull();
  });

  it("dedupes queue items when a native snapshot contains already captured SMS", () => {
    const transactionStore = createTransactionStore();
    enableSmsCaptureWithRule(transactionStore, "CBE");

    const firstResult = transactionStore.getState().enqueueCapturedSms(
      buildRawSmsMessage(),
      {
        capturedAt: "2026-04-30T09:11:00.000Z",
      },
    );

    expect(firstResult.status).toBe("queued");

    const duplicateEnvelope: CapturedSmsEnvelope = createCapturedSmsEnvelope(
      buildRawSmsMessage(),
      {
        capturedAt: "2026-04-30T09:12:00.000Z",
      },
    );

    const uniqueEnvelope: CapturedSmsEnvelope = createCapturedSmsEnvelope(
      buildRawSmsMessage({
        messageId: "sms-cbe-capture-unique-001",
        receivedAt: "2026-04-30T09:15:00.000Z",
        smsBody:
          "CBE ALERT: Your account 4920 was debited with ETB 180.00 on 2026-04-30 at TAXI STOP. Bal ETB 7950.00",
      }),
      {
        capturedAt: "2026-04-30T09:16:00.000Z",
      },
    );

    const mergeResult = transactionStore
      .getState()
      .mergeNativeSmsCaptureQueueSnapshot([duplicateEnvelope, uniqueEnvelope]);
    const state = transactionStore.getState();

    expect(mergeResult).toMatchObject({
      addedCount: 1,
      duplicateCount: 1,
      filteredOutCount: 0,
    });
    expect(state.smsCaptureQueue).toHaveLength(2);
    expect(state.smsCaptureQueue.map((item) => item.messageId)).toEqual([
      "sms-cbe-capture-001",
      "sms-cbe-capture-unique-001",
    ]);
    expect(state.smsCaptureDiagnostics.duplicateSuppressedCount).toBe(1);
  });

  it("processes the next queued SMS through the parser and records an approval-queue handoff", () => {
    const transactionStore = createTransactionStore();
    enableSmsCaptureWithRule(transactionStore, "CBE");

    const enqueueResult = transactionStore.getState().enqueueCapturedSms(
      buildRawSmsMessage(),
      {
        capturedAt: "2026-04-30T09:11:00.000Z",
      },
    );

    if (enqueueResult.status !== "queued") {
      throw new Error("Expected enqueueCapturedSms to queue the raw SMS.");
    }

    const processResult = transactionStore
      .getState()
      .processNextSmsCaptureQueueItem({
        processedAt: "2026-04-30T09:12:00.000Z",
      });
    const state = transactionStore.getState();
    const processedItem = state.smsCaptureQueue.find(
      (item) => item.captureId === enqueueResult.queueItem.captureId,
    );

    expect(processResult).toMatchObject({
      status: "queued",
      parserQueueEntryId: expect.stringContaining("queue-draft-sms-cbe-capture-001"),
    });
    expect(processedItem).toMatchObject({
      status: "parsed",
      parseAttemptCount: 1,
      parsedAt: "2026-04-30T09:12:00.000Z",
    });
    expect(state.approvalQueue).toHaveLength(1);
    expect(state.approvalQueue[0]).toMatchObject({
      rawMessageId: "sms-cbe-capture-001",
      title: "City Market",
    });
    expect(state.smsCaptureDiagnostics).toMatchObject({
      lastParserOutcome: "queued",
      lastParserHandoffAt: "2026-04-30T09:12:00.000Z",
      lastFailureReason: null,
    });
  });

  it("records unmatched parser outcomes when a queued SMS does not match a template", () => {
    const transactionStore = createTransactionStore();
    enableSmsCaptureWithRule(transactionStore, "Unknown Sender");

    const enqueueResult = transactionStore.getState().enqueueCapturedSms(
      buildRawSmsMessage({
        messageId: "sms-unknown-capture-001",
        senderLabel: "Unknown Sender",
        smsBody: "Lunch tomorrow at 1pm?",
        receivedAt: "2026-04-30T13:30:00.000Z",
      }),
      {
        capturedAt: "2026-04-30T13:31:00.000Z",
      },
    );

    if (enqueueResult.status !== "queued") {
      throw new Error("Expected unmatched raw SMS to enter the durable queue.");
    }

    const processResult = transactionStore
      .getState()
      .processNextSmsCaptureQueueItem({
        processedAt: "2026-04-30T13:32:00.000Z",
      });
    const state = transactionStore.getState();
    const processedItem = state.smsCaptureQueue.find(
      (item) => item.captureId === enqueueResult.queueItem.captureId,
    );

    expect(processResult).toMatchObject({
      status: "unmatched",
      unmatchedEntryId: expect.stringContaining("unmatched-sms-unknown-capture-001"),
    });
    expect(processedItem).toMatchObject({
      status: "unmatched",
      parseAttemptCount: 1,
      parsedAt: "2026-04-30T13:32:00.000Z",
      failureReason: "no_template_match",
    });
    expect(state.unmatchedMessages).toHaveLength(1);
    expect(state.unmatchedMessages[0]).toMatchObject({
      rawMessageId: "sms-unknown-capture-001",
      senderLabel: "Unknown Sender",
    });
    expect(state.smsCaptureDiagnostics).toMatchObject({
      lastParserOutcome: "unmatched",
      lastParserHandoffAt: "2026-04-30T13:32:00.000Z",
      lastFailureReason: "no_template_match",
    });
  });

  it("stores direct sender entry and backfill intent for setup flows without fake local state", () => {
    const transactionStore = createTransactionStore();

    const firstRule = transactionStore
      .getState()
      .addSmsSenderRule("  CBE Payroll  ", "2026-05-02T08:00:00.000Z");
    const secondRule = transactionStore
      .getState()
      .addSmsSenderRule("cbe payroll", "2026-05-02T08:05:00.000Z");
    const backfillRequest = transactionStore
      .getState()
      .setSmsCaptureBackfillRequest(90, "2026-05-02T08:10:00.000Z");
    const state = transactionStore.getState();
    const summary = selectSmsCaptureRoutingSummary(state);

    expect(firstRule.senderLabel).toBe("CBE Payroll");
    expect(secondRule.ruleId).toBe(firstRule.ruleId);
    expect(state.smsCaptureSettings.senderRules).toHaveLength(1);
    expect(backfillRequest).toMatchObject({
      lookbackDays: 90,
      status: "requested",
      requestedAt: "2026-05-02T08:10:00.000Z",
    });
    expect(summary).toMatchObject({
      runtimeStatus: "manual_only",
      enabledSenderRuleCount: 1,
      disabledSenderRuleCount: 0,
      hasSenderRules: true,
      backfillCapability: "unsupported",
      backfillRequestedLookbackDays: 90,
      backfillRequestStatus: "requested",
      backfillRequestedAt: "2026-05-02T08:10:00.000Z",
    });
  });

  it("applies native runtime snapshots and exposes a capture-ready routing summary", () => {
    const transactionStore = createTransactionStore();
    enableSmsCaptureWithRule(transactionStore, "CBE");

    const allowedQueueItem = createSmsCaptureQueueItem(
      createCapturedSmsEnvelope(buildRawSmsMessage(), {
        capturedAt: "2026-05-02T09:01:00.000Z",
      }),
    );
    const filteredQueueItem = createSmsCaptureQueueItem(
      createCapturedSmsEnvelope(
        buildRawSmsMessage({
          messageId: "sms-dashen-native-001",
          senderLabel: "Dashen",
          receivedAt: "2026-05-02T09:02:00.000Z",
          smsBody:
            "Dashen alert: Your account was debited with ETB 100.00 at CAFE.",
        }),
        {
          capturedAt: "2026-05-02T09:02:30.000Z",
        },
      ),
    );

    const mergeResult = transactionStore
      .getState()
      .applySmsCaptureRuntimeSnapshot(
        buildSmsCaptureRuntimeSnapshot({
          captureEnabled: true,
          buildMode: "native_capture",
          queue: [allowedQueueItem, filteredQueueItem],
          diagnostics: {
            permissionState: "granted",
            nativeCaptureAvailable: true,
            captureSupported: true,
            historyCaptureSupported: false,
            duplicateSuppressedCount: 0,
            filteredOutCount: 0,
            lastCapturedAt: "2026-05-02T09:02:30.000Z",
            lastCapturedSenderLabel: "Dashen",
            lastParserHandoffAt: null,
            lastParserOutcome: "idle",
            lastFailureReason: null,
          },
        }),
      );

    const state = transactionStore.getState();
    const summary = selectSmsCaptureRoutingSummary(state);

    expect(mergeResult).toMatchObject({
      addedCount: 1,
      duplicateCount: 0,
      filteredOutCount: 1,
    });
    expect(state.smsCaptureSettings.captureEnabled).toBe(true);
    expect(state.smsCaptureSettings.buildMode).toBe("native_capture");
    expect(state.smsCaptureDiagnostics).toMatchObject({
      permissionState: "granted",
      nativeCaptureAvailable: true,
      captureSupported: true,
      historyCaptureSupported: false,
      filteredOutCount: 1,
    });
    expect(state.smsCaptureQueue).toHaveLength(1);
    expect(summary).toMatchObject({
      runtimeStatus: "capturing",
      pendingCount: 1,
      hasSenderRules: true,
      backfillCapability: "native_follow_up_required",
      lastCapturedSenderLabel: "CBE",
    });
    expect(summary.oldestPendingCaptureId).toBe(allowedQueueItem.captureId);
  });

  it("normalizes native captured items into parser-ready queue work when auto-routing is enabled", () => {
    const transactionStore = createTransactionStore();
    enableSmsCaptureWithRule(transactionStore, "CBE");

    const nativeCapturedItem = createSmsCaptureQueueItem(
      createCapturedSmsEnvelope(buildRawSmsMessage(), {
        capturedAt: "2026-05-02T09:05:00.000Z",
      }),
      false,
    );

    transactionStore.getState().applySmsCaptureRuntimeSnapshot(
      buildSmsCaptureRuntimeSnapshot({
        queue: [nativeCapturedItem],
      }),
    );

    const state = transactionStore.getState();

    expect(state.smsCaptureQueue).toHaveLength(1);
    expect(state.smsCaptureQueue[0]).toMatchObject({
      captureId: nativeCapturedItem.captureId,
      status: "queued_for_parse",
    });
    expect(state.smsCaptureQueueSummary.pendingCount).toBe(1);
  });

  it("exposes blocked native capture state when SMS permission is denied", () => {
    const transactionStore = createTransactionStore();

    transactionStore.getState().applySmsCaptureRuntimeSnapshot(
      buildSmsCaptureRuntimeSnapshot({
        captureEnabled: false,
        diagnostics: {
          permissionState: "denied",
          nativeCaptureAvailable: true,
          captureSupported: true,
          historyCaptureSupported: false,
          duplicateSuppressedCount: 0,
          filteredOutCount: 0,
          lastCapturedAt: null,
          lastCapturedSenderLabel: null,
          lastParserHandoffAt: null,
          lastParserOutcome: "idle",
          lastFailureReason: null,
        },
      }),
    );

    const summary = selectSmsCaptureRoutingSummary(transactionStore.getState());

    expect(summary).toMatchObject({
      runtimeStatus: "blocked",
      nativeCaptureAvailable: true,
      captureSupported: true,
      permissionState: "denied",
      backfillCapability: "native_follow_up_required",
    });
  });

  it("edits queued and approved transactions beyond title/category/note and keeps ledger math honest", () => {
    const transactionStore = createTransactionStore();

    transactionStore.getState().seedDemoData();
    const queueEntryId = transactionStore.getState().approvalQueue[0]?.queueEntryId;
    if (!queueEntryId) {
      throw new Error("Expected seeded demo data to include a queue entry");
    }

    transactionStore.getState().openTransactionEditor(queueEntryId);
    transactionStore.getState().editApprovalQueueItem(queueEntryId, {
      title: "Neighborhood Grocery",
      category: "food",
      note: "Weekend family shopping",
      amountMinor: 99000,
      occurredAt: "2026-04-30T09:45:00.000Z",
      accountReference: "7721",
      reference: "CBE-SETTLEMENT-77",
    });

    const approvedTransaction = transactionStore
      .getState()
      .approveQueueItem(queueEntryId, "2026-04-30T10:00:00.000Z");

    if (!approvedTransaction) {
      throw new Error("Expected queue item approval to return a transaction");
    }

    transactionStore.getState().editApprovedTransaction(
      approvedTransaction.transactionId,
      {
        amountMinor: 104500,
        occurredAt: "2026-04-30T10:05:00.000Z",
        note: "Corrected after review",
        reference: "CBE-SETTLEMENT-77A",
      },
    );

    const nextState = transactionStore.getState();
    const dashboardSnapshot = buildDashboardSnapshot(nextState);
    const correctedApproved = nextState.approvedTransactions.find(
      (transaction) => transaction.transactionId === approvedTransaction.transactionId,
    );

    expect(approvedTransaction.title).toBe("Neighborhood Grocery");
    expect(approvedTransaction.category).toBe("food");
    expect(approvedTransaction.note).toBe("Weekend family shopping");
    expect(approvedTransaction.amountMinor).toBe(99000);
    expect(approvedTransaction.occurredAt).toBe("2026-04-30T09:45:00.000Z");
    expect(approvedTransaction.accountReference).toBe("7721");
    expect(approvedTransaction.reference).toBe("CBE-SETTLEMENT-77");
    expect(correctedApproved).toMatchObject({
      amountMinor: 104500,
      occurredAt: "2026-04-30T10:05:00.000Z",
      note: "Corrected after review",
      reference: "CBE-SETTLEMENT-77A",
    });
    expect(nextState.approvalQueue).toHaveLength(2);
    expect(nextState.approvedTransactions).toHaveLength(4);
    expect(nextState.activeQueueEntryId).toBeNull();
    expect(dashboardSnapshot.pendingApprovalCount).toBe(2);
    expect(dashboardSnapshot.approvedTransactionCount).toBe(4);
    expect(
      nextState.budgetSummaries.find((summary) => summary.category === "food")
        ?.spentMinor,
    ).toBe(149500);
  });

  it("removes rejected queue items and closes the active editor state", () => {
    const transactionStore = createTransactionStore();

    transactionStore.getState().seedDemoData();
    const queueEntryId = transactionStore.getState().approvalQueue[0]?.queueEntryId;
    if (!queueEntryId) {
      throw new Error("Expected seeded demo data to include a queue entry");
    }

    transactionStore.getState().openTransactionEditor(queueEntryId);
    transactionStore.getState().rejectQueueItem(queueEntryId);

    expect(transactionStore.getState().approvalQueue).toHaveLength(2);
    expect(transactionStore.getState().activeQueueEntryId).toBeNull();
  });

  it("can clear persisted finance state so the browser can render a true empty view", () => {
    const transactionStore = createTransactionStore();

    transactionStore.getState().seedDemoData();
    transactionStore.getState().captureUnmatchedSms(
      {
        messageId: "sms-unknown-raw-002",
        senderLabel: "Unknown Sender",
        smsBody: "Lunch tomorrow at 1pm?",
        receivedAt: "2026-04-30T13:35:00.000Z",
      },
      {
        status: "unmatched",
        failureReason: "no_template_match",
        rawMessageId: "sms-unknown-raw-002",
        senderLabel: "Unknown Sender",
        smsBody: "Lunch tomorrow at 1pm?",
      },
      "2026-04-30T13:35:30.000Z",
    );
    transactionStore.getState().clearAllData();

    const state = transactionStore.getState();
    const dashboardSnapshot = buildDashboardSnapshot(state);

    expect(state.hasInitialized).toBe(true);
    expect(state.approvalQueue).toHaveLength(0);
    expect(state.approvedTransactions).toHaveLength(0);
    expect(state.accountSummaries).toHaveLength(0);
    expect(state.budgetSummaries).toHaveLength(0);
    expect(state.unmatchedMessages).toHaveLength(0);
    expect(state.activeQueueEntryId).toBeNull();
    expect(dashboardSnapshot.totalBalanceMinor).toBe(0);
    expect(dashboardSnapshot.pendingApprovalCount).toBe(0);
    expect(dashboardSnapshot.approvedTransactionCount).toBe(0);
  });

  it("imports historical drafts into approved transactions by default", async () => {
    const importedDrafts = [
      buildHistoricalDraft(),
      buildHistoricalDraft({
        draftId: "historical-draft-002",
        rawMessageId: "historical-raw-002",
        financialInstitution: "telebirr",
        senderLabel: "127",
        title: "Historical Salary",
        merchantName: "Employer Payroll",
        category: "income",
        transactionDirection: "credit",
        amountMinor: 350000,
        runningBalanceMinor: 1200000,
        reportedBalanceMinor: 1200000,
        occurredAt: "2026-03-25T08:15:00.000Z",
        accountReference: undefined,
        accountChannel: "mobile_money",
      }),
    ];
    const importHistoricalTransactions = vi.fn((input) => ({
      mode: "merge" as const,
      duplicateMode: "skip" as const,
      processedAt: "2026-05-01T10:30:00.000Z",
      approvedTransactions: input.importedDrafts.map((draft: ParsedTransactionDraft) =>
        buildApprovedTransaction(draft, "2026-05-01T10:30:00.000Z"),
      ),
      approvalQueue: [],
      accountSummaries: input.importedDrafts.map((draft: ParsedTransactionDraft) =>
        buildAccountSummaryFromDraft(draft),
      ),
      unmatchedEntries: [],
      duplicates: [],
      skippedDuplicateCount: 0,
      inferredAccounts: [],
    }));

    __setHistoricalImportServiceLoaderForTests(async () => ({
      importHistoricalTransactions,
    }));

    const transactionStore = createTransactionStore();
    await transactionStore.getState().importHistoricalData({
      drafts: importedDrafts,
      importedAt: "2026-05-01T10:30:00.000Z",
    });

    const state = transactionStore.getState();

    expect(importHistoricalTransactions).toHaveBeenCalledWith(
      expect.objectContaining({
        importedDrafts,
        existingApprovedTransactions: [],
        existingApprovalQueue: [],
        options: expect.objectContaining({
          mode: "merge",
          duplicateMode: "skip",
          processedAt: "2026-05-01T10:30:00.000Z",
        }),
      }),
    );
    expect(state.hasInitialized).toBe(true);
    expect(state.approvalQueue).toHaveLength(0);
    expect(state.approvedTransactions).toHaveLength(2);
    expect(state.accountSummaries).toHaveLength(2);
    expect(
      state.budgetSummaries.find((summary) => summary.category === "food")
        ?.spentMinor,
    ).toBe(12500);
    expect(
      state.budgetSummaries.find((summary) => summary.category === "income")
        ?.spentMinor,
    ).toBe(350000);
  });

  it("records parser-aware import staging and import application logs", async () => {
    const stagedDrafts = [
      buildHistoricalDraft({
        draftId: "historical-draft-stage-001",
        rawMessageId: "historical-raw-stage-001",
        parserTemplateId: "historical_import",
      }),
      buildHistoricalDraft({
        draftId: "historical-draft-stage-002",
        rawMessageId: "historical-raw-stage-002",
        parserTemplateId: "historical_unknown_v1",
        amountMinor: 9000,
      }),
    ];
    const importPackage = buildHistoricalImportPackage(stagedDrafts);
    const importHistoricalTransactions = vi.fn((input) => ({
      mode: "merge" as const,
      duplicateMode: "skip" as const,
      processedAt: "2026-05-02T10:30:00.000Z",
      approvedTransactions: input.importedDrafts.map((draft: ParsedTransactionDraft) =>
        buildApprovedTransaction(draft, "2026-05-02T10:30:00.000Z"),
      ),
      approvalQueue: [],
      accountSummaries: input.importedDrafts.map((draft: ParsedTransactionDraft) =>
        buildAccountSummaryFromDraft(draft),
      ),
      unmatchedEntries: [],
      duplicates: [],
      skippedDuplicateCount: 0,
      inferredAccounts: [],
    }));

    __setHistoricalImportServiceLoaderForTests(async () => ({
      importHistoricalTransactions,
    }));

    const transactionStore = createTransactionStore();
    const importSummary = transactionStore.getState().stageHistoricalImportPackage(
      importPackage,
      {
        availableParserTemplates: [
          buildParserTemplate(),
          buildParserTemplate({
            id: "historical_disabled_v1",
            status: "disabled",
          }),
        ],
        sourceLabel: "history-import.json",
      },
    );

    expect(importSummary.unknownTemplateIds).toEqual(["historical_unknown_v1"]);
    expect(transactionStore.getState().systemLogs[0]).toMatchObject({
      eventKind: "import_staged",
      tone: "warning",
    });

    await transactionStore.getState().importHistoricalData({
      drafts: stagedDrafts,
      importedAt: "2026-05-02T10:30:00.000Z",
      availableParserTemplates: [buildParserTemplate()],
      sourceLabel: "history-import.json",
    });

    expect(transactionStore.getState().systemLogs[0]).toMatchObject({
      eventKind: "import_applied",
      tone: "success",
    });
    expect(transactionStore.getState().systemLogs[0]?.templateUsage).toEqual([
      expect.objectContaining({
        templateId: "historical_import",
      }),
      expect.objectContaining({
        templateId: "historical_unknown_v1",
      }),
    ]);
  });

  it("records export, backup, restore, import failures, and clear-data operations in system logs", async () => {
    const transactionStore = createTransactionStore();
    transactionStore.getState().seedDemoData();

    const exportPackage = transactionStore
      .getState()
      .createDataExportPackage("2026-05-02T11:00:00.000Z");
    expect(exportPackage.kind).toBe("trackwallet-data-export");

    const backupPackage: BackupPackage = transactionStore
      .getState()
      .createBackupPackage(
        {
          importMode: "backup_then_replace",
          duplicateMode: "review",
          reviewWindowDays: 30,
        },
        "2026-05-02T11:05:00.000Z",
      );
    expect(backupPackage.defaults.duplicateMode).toBe("review");

    __setHistoricalImportServiceLoaderForTests(async () => {
      throw new Error("historical import loader unavailable");
    });

    await expect(
      transactionStore.getState().importHistoricalData({
        drafts: [buildHistoricalDraft()],
        importedAt: "2026-05-02T11:10:00.000Z",
        sourceLabel: "broken-history.json",
      }),
    ).rejects.toThrow("historical import loader unavailable");

    transactionStore
      .getState()
      .clearAllData("2026-05-02T11:15:00.000Z");
    transactionStore
      .getState()
      .restoreBackupPackage(backupPackage, "2026-05-02T11:20:00.000Z");

    expect(
      transactionStore.getState().systemLogs.map((entry) => entry.eventKind).slice(0, 5),
    ).toEqual([
      "restore",
      "export",
    ]);
    expect(transactionStore.getState().systemLogs[0]?.metrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "Duplicate mode", value: "review" }),
      ]),
    );
  });

  it("routes recent historical tail into the approval queue through the store action", async () => {
    const olderDraft = buildHistoricalDraft({
      draftId: "historical-draft-older",
      rawMessageId: "historical-raw-older",
      occurredAt: "2026-03-01T08:00:00.000Z",
    });
    const recentDraft = buildHistoricalDraft({
      draftId: "historical-draft-recent",
      rawMessageId: "historical-raw-recent",
      title: "Recent Fuel",
      merchantName: "Recent Fuel",
      category: "transport",
      amountMinor: 9000,
      occurredAt: "2026-04-29T18:30:00.000Z",
    });
    const importHistoricalTransactions = vi.fn((input) => {
      expect(input.options.defaultRecentReviewDays).toBe(7);
      expect(input.options.processedAt).toBe("2026-05-01T12:00:00.000Z");

      return {
        mode: "merge" as const,
        duplicateMode: "skip" as const,
        processedAt: "2026-05-01T12:00:00.000Z",
        approvedTransactions: [buildApprovedTransaction(olderDraft)],
        approvalQueue: [
          buildApprovalQueueItem(recentDraft, "2026-05-01T12:00:00.000Z"),
        ],
        accountSummaries: [
          buildAccountSummaryFromDraft(olderDraft),
          buildAccountSummaryFromDraft(recentDraft),
        ],
        unmatchedEntries: [],
        duplicates: [],
        skippedDuplicateCount: 0,
        inferredAccounts: [],
      };
    });

    __setHistoricalImportServiceLoaderForTests(async () => ({
      importHistoricalTransactions,
    }));

    const transactionStore = createTransactionStore();
    await transactionStore.getState().importHistoricalData({
      drafts: [olderDraft, recentDraft],
      reviewWindowDays: 7,
      importedAt: "2026-05-01T12:00:00.000Z",
    });

    const state = transactionStore.getState();

    expect(state.approvedTransactions).toHaveLength(1);
    expect(state.approvalQueue).toHaveLength(1);
    expect(state.approvalQueue[0]).toMatchObject({
      draftId: "historical-draft-recent",
      title: "Recent Fuel",
      approvalStatus: "pending_approval",
      queuedAt: "2026-05-01T12:00:00.000Z",
    });
  });

  it("replace mode clears old finance slices while preserving sync state", async () => {
    const importedDraft = buildHistoricalDraft({
      draftId: "historical-draft-replace",
      rawMessageId: "historical-raw-replace",
      title: "Replacement Ledger Entry",
      merchantName: "Replacement Ledger Entry",
      amountMinor: 7800,
      occurredAt: "2026-02-10T11:45:00.000Z",
    });
    const importHistoricalTransactions = vi.fn((input) => {
      expect(input.options.mode).toBe("replace");
      expect(input.existingApprovedTransactions).toHaveLength(3);
      expect(input.existingApprovalQueue).toHaveLength(3);

      return {
        mode: "replace" as const,
        duplicateMode: "skip" as const,
        processedAt: "2026-05-01T09:05:00.000Z",
        approvedTransactions: [buildApprovedTransaction(importedDraft)],
        approvalQueue: [],
        accountSummaries: [buildAccountSummaryFromDraft(importedDraft)],
        unmatchedEntries: [],
        duplicates: [],
        skippedDuplicateCount: 0,
        inferredAccounts: [],
      };
    });

    __setHistoricalImportServiceLoaderForTests(async () => ({
      importHistoricalTransactions,
    }));

    const transactionStore = createTransactionStore();

    transactionStore.getState().seedDemoData();
    transactionStore.getState().setSyncMode("manual");
    transactionStore
      .getState()
      .triggerManualSync("2026-05-01T09:00:00.000Z");
    transactionStore
      .getState()
      .openTransactionEditor(
        transactionStore.getState().approvalQueue[0]?.queueEntryId ??
          "queue-missing",
      );

    const stateBeforeImport = transactionStore.getState();
    const syncSnapshot = {
      syncEnabled: stateBeforeImport.syncEnabled,
      syncMode: stateBeforeImport.syncMode,
      syncDiscoveryState: stateBeforeImport.syncDiscoveryState,
      syncStatusSummary: stateBeforeImport.syncStatusSummary,
      nearbySyncDevices: stateBeforeImport.nearbySyncDevices,
      trustedSyncDevices: stateBeforeImport.trustedSyncDevices,
      syncActivity: stateBeforeImport.syncActivity,
      pairingCodeState: stateBeforeImport.pairingCodeState,
    };

    await transactionStore.getState().importHistoricalData({
      drafts: [importedDraft],
      mode: "replace",
      importedAt: "2026-05-01T09:05:00.000Z",
    });

    const state = transactionStore.getState();

    expect(state.hasInitialized).toBe(true);
    expect(state.approvalQueue).toHaveLength(0);
    expect(state.approvedTransactions).toHaveLength(1);
    expect(state.accountSummaries).toHaveLength(1);
    expect(state.activeQueueEntryId).toBeNull();
    expect(
      state.budgetSummaries.find((summary) => summary.category === "food")
        ?.spentMinor,
    ).toBe(7800);
    expect(state.syncEnabled).toBe(syncSnapshot.syncEnabled);
    expect(state.syncMode).toBe(syncSnapshot.syncMode);
    expect(state.syncDiscoveryState).toBe(syncSnapshot.syncDiscoveryState);
    expect(state.syncStatusSummary).toEqual(syncSnapshot.syncStatusSummary);
    expect(state.nearbySyncDevices).toEqual(syncSnapshot.nearbySyncDevices);
    expect(state.trustedSyncDevices).toEqual(syncSnapshot.trustedSyncDevices);
    expect(state.syncActivity).toEqual(syncSnapshot.syncActivity);
    expect(state.pairingCodeState).toEqual(syncSnapshot.pairingCodeState);
  });

  it("creates custom accounts and exposes them through the managed-account selectors", () => {
    const transactionStore = createTransactionStore();

    const createdAccount = transactionStore.getState().createCustomAccount(
      {
        institutionName: "Awash Bank",
        accountReference: "20202450",
        balanceMinor: 245000,
        channel: "bank",
        note: "Emergency reserve",
      },
      "2026-05-02T08:30:00.000Z",
    );

    const state = transactionStore.getState();
    const managedAccounts = selectManagedAccounts(state);
    const visibleManagedAccounts = selectVisibleManagedAccounts(state);
    const managedAccount = managedAccounts.find(
      (account) => account.accountId === createdAccount.accountId,
    );

    expect(state.customAccounts).toHaveLength(1);
    expect(state.customAccounts[0]).toMatchObject({
      accountId: createdAccount.accountId,
      institutionName: "Awash Bank",
      maskedAccountNumber: "**** 2450",
      fullAccountNumber: "20202450",
      balanceMinor: 245000,
      channel: "bank",
      note: "Emergency reserve",
      createdAt: "2026-05-02T08:30:00.000Z",
      updatedAt: "2026-05-02T08:30:00.000Z",
    });
    expect(managedAccount).toMatchObject({
      source: "custom",
      isHidden: false,
      institutionName: "Awash Bank",
      maskedAccountNumber: "**** 2450",
      note: "Emergency reserve",
    });
    expect(
      visibleManagedAccounts.some(
        (account) => account.accountId === createdAccount.accountId,
      ),
    ).toBe(true);
  });

  it("updates custom accounts and hides managed accounts without mutating parser summaries", () => {
    const transactionStore = createTransactionStore();

    transactionStore.getState().seedDemoData();
    const createdAccount = transactionStore.getState().createCustomAccount(
      {
        institutionName: "Daily Cash",
        balanceMinor: 68000,
        channel: "cash",
        note: "Drawer float",
      },
      "2026-05-02T09:00:00.000Z",
    );

    transactionStore.getState().updateCustomAccount(
      createdAccount.accountId,
      {
        institutionName: "Daily Cash Drawer",
        balanceMinor: 72000,
        note: "Front counter float",
      },
      "2026-05-02T09:30:00.000Z",
    );
    transactionStore
      .getState()
      .setAccountHidden("acct-cbe-2401", true, "2026-05-02T09:45:00.000Z");
    transactionStore
      .getState()
      .setAccountHidden(createdAccount.accountId, true, "2026-05-02T09:46:00.000Z");

    const state = transactionStore.getState();
    const managedAccounts = selectManagedAccounts(state);
    const visibleManagedAccounts = selectVisibleManagedAccounts(state);
    const hiddenImportedAccount = managedAccounts.find(
      (account) => account.accountId === "acct-cbe-2401",
    );
    const hiddenCustomAccount = managedAccounts.find(
      (account) => account.accountId === createdAccount.accountId,
    );

    expect(state.accountSummaries.find((account) => account.accountId === "acct-cbe-2401"))
      .toMatchObject({
        institutionName: "CBE",
        balanceMinor: 640000,
      });
    expect(hiddenImportedAccount).toMatchObject({
      accountId: "acct-cbe-2401",
      source: "derived",
      isHidden: true,
    });
    expect(hiddenCustomAccount).toMatchObject({
      accountId: createdAccount.accountId,
      source: "custom",
      institutionName: "Daily Cash Drawer",
      balanceMinor: 72000,
      note: "Front counter float",
      isHidden: true,
      updatedAt: "2026-05-02T09:30:00.000Z",
    });
    expect(
      visibleManagedAccounts.some((account) => account.accountId === "acct-cbe-2401"),
    ).toBe(false);
    expect(
      visibleManagedAccounts.some(
        (account) => account.accountId === createdAccount.accountId,
      ),
    ).toBe(false);
    expect(state.accountVisibilityOverrides).toEqual([
      {
        accountId: "acct-cbe-2401",
        isHidden: true,
        updatedAt: "2026-05-02T09:45:00.000Z",
      },
      {
        accountId: createdAccount.accountId,
        isHidden: true,
        updatedAt: "2026-05-02T09:46:00.000Z",
      },
    ]);
  });

  it("migrates legacy browser state into native SQLite and reloads it without localStorage", async () => {
    const persistName = "native-authority-migration-test";
    const legacyPreviewStorage = (() => {
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
    })();

    const legacyStore = createTransactionStore({
      persistName,
      previewStateStorage: legacyPreviewStorage,
    });
    legacyStore.getState().seedDemoData();
    const createdAccount = legacyStore.getState().createCustomAccount(
      {
        institutionName: "Awash Bank",
        accountReference: "20202450",
        balanceMinor: 245000,
        channel: "bank",
        note: "Emergency reserve",
      },
      "2026-05-02T08:30:00.000Z",
    );
    legacyStore
      .getState()
      .setAccountHidden("acct-cbe-2401", true, "2026-05-02T09:45:00.000Z");

    expect(legacyPreviewStorage.getItem(persistName)).not.toBeNull();

    const sqliteStateStorage = createSQLiteStateStorage({
      binaryStorage: createMemorySqliteBinaryStorage(),
      legacyStorage: legacyPreviewStorage,
    });
    const nativeStore = createTransactionStore({
      runtime: "native_mobile",
      persistName,
      sqliteStateStorage,
    });

    await nativeStore.persist.rehydrate();
    await sqliteStateStorage.flush();

    expect(nativeStore.getState().approvedTransactions).toHaveLength(3);
    expect(nativeStore.getState().customAccounts[0]?.accountId).toBe(
      createdAccount.accountId,
    );
    expect(nativeStore.getState().accountVisibilityOverrides).toContainEqual(
      expect.objectContaining({
        accountId: "acct-cbe-2401",
        isHidden: true,
      }),
    );

    legacyPreviewStorage.removeItem(persistName);

    const restartedNativeStore = createTransactionStore({
      runtime: "native_mobile",
      persistName,
      sqliteStateStorage,
    });
    await restartedNativeStore.persist.rehydrate();

    expect(legacyPreviewStorage.getItem(persistName)).toBeNull();
    expect(restartedNativeStore.getState().approvedTransactions).toHaveLength(3);
    expect(restartedNativeStore.getState().customAccounts[0]?.accountId).toBe(
      createdAccount.accountId,
    );
  });

  it("persists device security preferences through store rehydration without pretending finance data exists", async () => {
    const persistName = "security-preferences-persist-test";
    const previewStateStorage = (() => {
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
    })();
    const securityPreferences = {
      biometricsEnabled: false,
      requireBiometricOnOpen: false,
      requireBiometricOnApprove: true,
      requireBiometricOnDelete: false,
      requireBiometricOnForwarding: true,
      twoFactorEnabled: false,
    };

    const transactionStore = createTransactionStore({
      persistName,
      previewStateStorage,
    });

    expect(transactionStore.getState().hasInitialized).toBe(false);
    transactionStore.getState().setSecurityPreferences(securityPreferences);
    expect(transactionStore.getState().hasInitialized).toBe(false);

    const restartedStore = createTransactionStore({
      persistName,
      previewStateStorage,
    });
    await restartedStore.persist.rehydrate();

    expect(restartedStore.getState().securityPreferences).toEqual(
      securityPreferences,
    );
  });

  it("keeps the saved device security plan when finance data is cleared", () => {
    const transactionStore = createTransactionStore();
    const securityPreferences = {
      biometricsEnabled: false,
      requireBiometricOnOpen: false,
      requireBiometricOnApprove: true,
      requireBiometricOnDelete: false,
      requireBiometricOnForwarding: true,
      twoFactorEnabled: false,
    };

    transactionStore.getState().setSecurityPreferences(securityPreferences);
    transactionStore.getState().seedDemoData();
    transactionStore.getState().clearAllData("2026-05-02T11:15:00.000Z");

    expect(transactionStore.getState().approvedTransactions).toHaveLength(0);
    expect(transactionStore.getState().securityPreferences).toEqual(
      securityPreferences,
    );
  });

  it("persists parser workspace authority state through explicit store actions and rehydration", async () => {
    const persistName = "parser-workspace-authority-persist-test";
    const previewStateStorage = (() => {
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
    })();
    const parserWorkspaceAuthorityState = buildParserWorkspaceAuthorityState();

    const transactionStore = createTransactionStore({
      persistName,
      previewStateStorage,
    });
    const { setParserWorkspaceAuthorityState } = transactionStore.getState();

    setParserWorkspaceAuthorityState(parserWorkspaceAuthorityState);
    expect(transactionStore.getState().parserWorkspaceAuthorityState).toEqual(
      parserWorkspaceAuthorityState,
    );

    const restartedStore = createTransactionStore({
      persistName,
      previewStateStorage,
    });
    await restartedStore.persist.rehydrate();

    expect(restartedStore.getState().parserWorkspaceAuthorityState).toEqual(
      parserWorkspaceAuthorityState,
    );

    restartedStore.getState().clearParserWorkspaceAuthorityState();
    expect(restartedStore.getState().parserWorkspaceAuthorityState).toBeNull();
  });

  it("includes alpha authority slices in export, backup, and restore", () => {
    const transactionStore = createTransactionStore();
    const parserWorkspaceAuthorityState = buildParserWorkspaceAuthorityState();

    transactionStore.getState().seedDemoData();
    const createdAccount = transactionStore.getState().createCustomAccount(
      {
        institutionName: "Awash Bank",
        accountReference: "20202450",
        balanceMinor: 245000,
        channel: "bank",
        note: "Emergency reserve",
      },
      "2026-05-02T08:30:00.000Z",
    );
    transactionStore
      .getState()
      .setAccountHidden("acct-cbe-2401", true, "2026-05-02T09:45:00.000Z");
    enableSmsCaptureWithRule(transactionStore, "CBE");
    transactionStore.getState().enqueueCapturedSms(buildRawSmsMessage(), {
      capturedAt: "2026-04-30T09:11:00.000Z",
    });
    transactionStore
      .getState()
      .setParserWorkspaceAuthorityState(parserWorkspaceAuthorityState);

    const exportPackage = transactionStore
      .getState()
      .createDataExportPackage("2026-05-02T11:00:00.000Z");
    const backupPackage = transactionStore
      .getState()
      .createBackupPackage(
        {
          importMode: "backup_then_replace",
          duplicateMode: "review",
          reviewWindowDays: 30,
        },
        "2026-05-02T11:05:00.000Z",
      );

    expect(exportPackage.authorityState).toMatchObject({
      customAccounts: [
        expect.objectContaining({
          accountId: createdAccount.accountId,
        }),
      ],
      accountVisibilityOverrides: [
        expect.objectContaining({
          accountId: "acct-cbe-2401",
          isHidden: true,
        }),
      ],
      smsCaptureQueue: [
        expect.objectContaining({
          messageId: "sms-cbe-capture-001",
        }),
      ],
      parserWorkspaceAuthorityState: expect.objectContaining({
        version: 1,
        selectedTemplateId: parserWorkspaceAuthorityState.selectedTemplateId,
      }),
    });
    expect(backupPackage.authorityState).toMatchObject({
      customAccounts: [
        expect.objectContaining({
          accountId: createdAccount.accountId,
        }),
      ],
      accountVisibilityOverrides: [
        expect.objectContaining({
          accountId: "acct-cbe-2401",
          isHidden: true,
        }),
      ],
      smsCaptureSettings: expect.objectContaining({
        captureEnabled: true,
        senderRules: [
          expect.objectContaining({
            senderLabel: "CBE",
          }),
        ],
      }),
      smsCaptureQueue: [
        expect.objectContaining({
          messageId: "sms-cbe-capture-001",
        }),
      ],
      parserWorkspaceAuthorityState: expect.objectContaining({
        version: 1,
        selectedTemplateId: parserWorkspaceAuthorityState.selectedTemplateId,
      }),
    });

    transactionStore
      .getState()
      .clearAllData("2026-05-02T11:15:00.000Z");
    transactionStore
      .getState()
      .restoreBackupPackage(backupPackage, "2026-05-02T11:20:00.000Z");

    expect(transactionStore.getState().customAccounts).toEqual(
      backupPackage.authorityState?.customAccounts ?? [],
    );
    expect(transactionStore.getState().accountVisibilityOverrides).toEqual(
      backupPackage.authorityState?.accountVisibilityOverrides ?? [],
    );
    expect(transactionStore.getState().smsCaptureQueue).toEqual(
      backupPackage.authorityState?.smsCaptureQueue ?? [],
    );
    expect(transactionStore.getState().smsCaptureSettings).toEqual(
      backupPackage.authorityState?.smsCaptureSettings,
    );
    expect(transactionStore.getState().parserWorkspaceAuthorityState).toEqual(
      backupPackage.authorityState?.parserWorkspaceAuthorityState ?? null,
    );
    expect(transactionStore.getState().systemLogs[0]).toMatchObject({
      eventKind: "restore",
    });
  });

  it("exposes reconciliation-ready shared finance types", () => {
    const authorityMode: AuthorityMode = "real";

    const approvedTransaction: ApprovedTransaction = {
      draftId: "draft-001",
      rawMessageId: "raw-001",
      senderLabel: "CBE",
      rawBody: "CBE ALERT",
      financialInstitution: "cbe",
      transactionDirection: "debit",
      amountMinor: 12500,
      feeMinor: 300,
      runningBalanceMinor: 985700,
      reportedBalanceMinor: 985700,
      currencyCode: "ETB",
      title: "Neighborhood Grocery",
      merchantName: "Neighborhood Grocery",
      category: "food",
      parserTemplateId: "cbe_v1",
      confidence: 100,
      occurredAt: "2026-05-01T08:00:00.000Z",
      accountReference: "4920",
      accountChannel: "bank",
      transactionId: "txn-001",
      approvedAt: "2026-05-01T08:01:00.000Z",
      approvalStatus: "approved",
      note: "",
    };

    const reconciliationItem: ReconciliationItem = {
      reconciliationItemId: "recon-001",
      accountId: "acct-cbe-4920",
      triggerTransactionId: approvedTransaction.transactionId,
      triggerRawMessageId: approvedTransaction.rawMessageId,
      expectedBalanceMinor: 985400,
      reportedBalanceMinor: 985700,
      deltaMinor: 300,
      status: "pending",
      resolutionKind: "bank_fee",
      createdAt: "2026-05-01T08:01:00.000Z",
      note: "Reported balance differs by service fee amount.",
    };

    expect(authorityMode).toBe("real");
    expect(approvedTransaction.reportedBalanceMinor).toBe(985700);
    expect(reconciliationItem.deltaMinor).toBe(300);
    expect(reconciliationItem.resolutionKind).toBe("bank_fee");
  });
});
