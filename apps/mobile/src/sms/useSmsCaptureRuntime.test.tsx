import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createDefaultParserTemplateWorkspace,
  migrateResolvedTemplatesToWorkspace,
  resolveParserTemplateWorkspace,
} from "@omni-sync/core";
import {
  createCapturedSmsEnvelope,
  createSmsCaptureQueueItem,
  createTransactionStore,
  transactionStore,
} from "@omni-sync/database";
import type {
  NativeSmsCaptureSnapshot,
  SmsCaptureEventPayload,
} from "@omni-sync/mobile-sms-capture";

import type { SmsCaptureBridge } from "./smsCaptureBridge";
import { useSmsCaptureRuntime } from "./useSmsCaptureRuntime";

function resetTransactionStore() {
  window.localStorage.clear();
  const freshStore = createTransactionStore();
  const freshState = freshStore.getState();

  transactionStore.getState().clearAllData();
  transactionStore.setState(
    {
      hasInitialized: false,
      approvalQueue: freshState.approvalQueue,
      approvedTransactions: freshState.approvedTransactions,
      unmatchedMessages: freshState.unmatchedMessages,
      smsCaptureSettings: freshState.smsCaptureSettings,
      smsCaptureQueue: freshState.smsCaptureQueue,
      smsCaptureQueueSummary: freshState.smsCaptureQueueSummary,
      smsCaptureDiagnostics: freshState.smsCaptureDiagnostics,
      smsCaptureBackfillRequest: freshState.smsCaptureBackfillRequest,
      accountSummaries: freshState.accountSummaries,
      customAccounts: freshState.customAccounts,
      accountVisibilityOverrides: freshState.accountVisibilityOverrides,
      budgetSummaries: freshState.budgetSummaries,
      syncEnabled: freshState.syncEnabled,
      syncMode: freshState.syncMode,
      syncDiscoveryState: freshState.syncDiscoveryState,
      syncStatusSummary: freshState.syncStatusSummary,
      nearbySyncDevices: freshState.nearbySyncDevices,
      trustedSyncDevices: freshState.trustedSyncDevices,
      syncActivity: freshState.syncActivity,
      systemLogs: freshState.systemLogs,
      pairingCodeState: freshState.pairingCodeState,
      activeQueueEntryId: freshState.activeQueueEntryId,
      activeApprovedTransactionId: freshState.activeApprovedTransactionId,
    },
    false,
  );
}

function buildNativeSnapshot(
  overrides: Partial<NativeSmsCaptureSnapshot> = {},
): NativeSmsCaptureSnapshot {
  const queue =
    overrides.queue ??
    [
      createSmsCaptureQueueItem(
        createCapturedSmsEnvelope(
          {
            messageId: "sms-cbe-live-001",
            senderLabel: "CBE",
            smsBody:
              "CBE ALERT: Your account 4920 was debited with ETB 320.00 on 2026-04-30 at CITY MARKET. Bal ETB 8130.00",
            receivedAt: "2026-05-02T09:10:00.000Z",
          },
          {
            capturedAt: "2026-05-02T09:11:00.000Z",
          },
        ),
        false,
      ),
    ];

  return {
    captureEnabled: true,
    buildMode: "native_capture",
    queue,
    summary: {
      pendingCount: queue.length,
      parsingCount: 0,
      parsedCount: 0,
      unmatchedCount: 0,
      failedCount: 0,
      lastCapturedAt: queue[0]?.capturedAt ?? null,
      lastProcessedAt: null,
    },
    diagnostics: {
      permissionState: "granted",
      nativeCaptureAvailable: true,
      captureSupported: true,
      historyCaptureSupported: false,
      duplicateSuppressedCount: 0,
      filteredOutCount: 0,
      lastCapturedAt: queue[0]?.capturedAt ?? null,
      lastCapturedSenderLabel: queue[0]?.senderLabel ?? null,
      lastParserHandoffAt: null,
      lastParserOutcome: "idle",
      lastFailureReason: null,
    },
    ...overrides,
  };
}

function createBridgeMock(
  snapshot = buildNativeSnapshot(),
): SmsCaptureBridge & {
  acknowledgeMessages: ReturnType<typeof vi.fn>;
  addListener: ReturnType<typeof vi.fn>;
  getSnapshot: ReturnType<typeof vi.fn>;
} {
  return {
    getSnapshot: vi.fn().mockResolvedValue(snapshot),
    checkPermissionState: vi.fn().mockResolvedValue("granted"),
    requestPermissions: vi.fn().mockResolvedValue(snapshot),
    setCaptureEnabled: vi.fn().mockResolvedValue(snapshot),
    acknowledgeMessages: vi.fn().mockResolvedValue({
      ...snapshot,
      queue: [],
      summary: {
        ...snapshot.summary,
        pendingCount: 0,
      },
    }),
    clearRuntimeState: vi.fn().mockResolvedValue(undefined),
    addListener: vi.fn().mockResolvedValue({
      remove: vi.fn(),
    }),
  };
}

async function flushAsyncWork() {
  await Promise.resolve();
  await Promise.resolve();
}

function renderHarness(bridge: SmsCaptureBridge) {
  document.body.innerHTML = "<div id=\"root\"></div>";
  const container = document.getElementById("root");

  if (!container) {
    throw new Error("Expected test root container to exist");
  }

  const root = createRoot(container);

  function Harness() {
    useSmsCaptureRuntime({
      bridge,
      autoDrainQueue: true,
    });

    return null;
  }

  return {
    async render() {
      await act(async () => {
        root.render(<Harness />);
        await flushAsyncWork();
      });
    },
    async settle() {
      await act(async () => {
        await flushAsyncWork();
      });
    },
    unmount() {
      act(() => {
        root.unmount();
      });
    },
  };
}

describe("useSmsCaptureRuntime", () => {
  beforeEach(() => {
    Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true);
    resetTransactionStore();
    transactionStore.getState().addSmsSenderRule(
      "CBE",
      "2026-05-02T07:00:00.000Z",
    );
  });

  afterEach(() => {
    document.body.innerHTML = "";
    Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
  });

  it("hydrates from the runtime snapshot, acknowledges native deliveries, and drains matched captures into inbox", async () => {
    const bridge = createBridgeMock();
    const screen = renderHarness(bridge);

    await screen.render();

    expect(bridge.getSnapshot).toHaveBeenCalledTimes(1);
    expect(bridge.acknowledgeMessages).toHaveBeenCalledWith([
      "capture-sms-cbe-live-001-20260502091100000",
    ]);
    expect(transactionStore.getState().approvalQueue).toHaveLength(1);
    expect(transactionStore.getState().approvalQueue[0]).toMatchObject({
      rawMessageId: "sms-cbe-live-001",
      title: "City Market",
    });
    expect(transactionStore.getState().smsCaptureQueue[0]).toMatchObject({
      status: "parsed",
      parseAttemptCount: 1,
    });

    screen.unmount();
  });

  it("ingests live smsCaptured bridge events after the initial snapshot", async () => {
    let listener: ((event: SmsCaptureEventPayload) => void) | undefined;
    const bridge = createBridgeMock(
      buildNativeSnapshot({
        queue: [],
        summary: {
          pendingCount: 0,
          parsingCount: 0,
          parsedCount: 0,
          unmatchedCount: 0,
          failedCount: 0,
          lastCapturedAt: null,
          lastProcessedAt: null,
        },
        diagnostics: {
          permissionState: "granted",
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
    bridge.addListener.mockImplementation(async (nextListener) => {
      listener = nextListener;
      return {
        remove: vi.fn(),
      };
    });
    const screen = renderHarness(bridge);

    await screen.render();

    const eventSnapshot = buildNativeSnapshot();

    await act(async () => {
      listener?.({
        item: eventSnapshot.queue[0]!,
        snapshot: eventSnapshot,
      });
      await flushAsyncWork();
    });

    expect(transactionStore.getState().approvalQueue).toHaveLength(1);
    expect(transactionStore.getState().smsCaptureDiagnostics).toMatchObject({
      lastCapturedSenderLabel: "CBE",
      lastParserOutcome: "queued",
    });
    expect(bridge.acknowledgeMessages).toHaveBeenLastCalledWith([
      "capture-sms-cbe-live-001-20260502091100000",
    ]);

    screen.unmount();
  });

  it("attaches the runtime lifecycle only once when multiple hooks mount in the same tree", async () => {
    const bridge = createBridgeMock();
    document.body.innerHTML = "<div id=\"root\"></div>";
    const container = document.getElementById("root");

    if (!container) {
      throw new Error("Expected test root container to exist");
    }

    const root = createRoot(container);

    function HookHarness() {
      useSmsCaptureRuntime({
        bridge,
        autoDrainQueue: true,
      });

      return null;
    }

    await act(async () => {
      root.render(
        <>
          <HookHarness />
          <HookHarness />
        </>,
      );
      await flushAsyncWork();
    });

    expect(bridge.getSnapshot).toHaveBeenCalledTimes(1);
    expect(bridge.addListener).toHaveBeenCalledTimes(1);

    act(() => {
      root.unmount();
    });
  });

  it("uses parser workspace authority state when no explicit runtime is provided", async () => {
    const authorityTemplateSeed =
      resolveParserTemplateWorkspace(createDefaultParserTemplateWorkspace())[0];

    if (!authorityTemplateSeed) {
      throw new Error("Expected a default parser template seed");
    }

    const authorityTemplate = {
      ...authorityTemplateSeed,
      id: "authority-cbe-custom",
      templateKind: "custom" as const,
      sourceType: "local" as const,
      engineEditable: true,
      senderAliases: ["AUTH"],
      userProfile: {
        ...authorityTemplateSeed.userProfile,
        senderAliases: ["AUTH"],
      },
    };
    const authorityWorkspace = migrateResolvedTemplatesToWorkspace([
      authorityTemplate,
    ]);

    transactionStore.getState().addSmsSenderRule(
      "AUTH",
      "2026-05-02T07:05:00.000Z",
    );
    transactionStore.getState().setParserWorkspaceAuthorityState({
      version: 1,
      templateWorkspace: authorityWorkspace,
      selectedTemplateId: authorityTemplate.id,
      senderLabel: "AUTH",
      strictSchemaParsing: true,
      preserveRawSms: true,
      autoReconciliation: true,
      verboseLogging: false,
    });

    const authSnapshot = buildNativeSnapshot({
      queue: [
        createSmsCaptureQueueItem(
          createCapturedSmsEnvelope(
            {
              messageId: "sms-auth-live-001",
              senderLabel: "AUTH",
              smsBody:
                "CBE ALERT: Your account 4920 was debited with ETB 320.00 on 2026-04-30 at CITY MARKET. Bal ETB 8130.00",
              receivedAt: "2026-05-02T09:10:00.000Z",
            },
            {
              capturedAt: "2026-05-02T09:11:00.000Z",
            },
          ),
          false,
        ),
      ],
    });
    const bridge = createBridgeMock(authSnapshot);
    const screen = renderHarness(bridge);

    await screen.render();

    expect(transactionStore.getState().approvalQueue).toHaveLength(1);
    expect(transactionStore.getState().approvalQueue[0]).toMatchObject({
      senderLabel: "AUTH",
      parserTemplateId: "authority-cbe-custom",
      title: "City Market",
    });

    screen.unmount();
  });
});
