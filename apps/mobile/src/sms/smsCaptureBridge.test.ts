import { describe, expect, it, vi } from "vitest";

import type {
  NativeSmsCaptureSnapshot,
  SmsCaptureEventPayload,
  SmsCapturePlugin,
} from "@omni-sync/mobile-sms-capture";

import { createSmsCaptureBridge } from "./smsCaptureBridge";

function buildNativeSnapshot(
  overrides: Partial<NativeSmsCaptureSnapshot> = {},
): NativeSmsCaptureSnapshot {
  return {
    captureEnabled: true,
    buildMode: "native_capture",
    queue: [
      {
        captureId: "capture-sms-001",
        messageId: "sms-001",
        senderLabel: "CBE",
        smsBody: "Your account has been debited by ETB 120.00",
        receivedAt: "2026-05-02T09:15:00.000Z",
        capturedAt: "2026-05-02T09:15:02.000Z",
        source: "android_sms_receiver",
        hash: "cbe::debit::2026-05-02T09:15:00.000Z",
        status: "captured",
        parseAttemptCount: 0,
      },
    ],
    summary: {
      pendingCount: 1,
      parsingCount: 0,
      parsedCount: 0,
      unmatchedCount: 0,
      failedCount: 0,
      lastCapturedAt: "2026-05-02T09:15:02.000Z",
      lastProcessedAt: null,
    },
    diagnostics: {
      permissionState: "granted",
      nativeCaptureAvailable: true,
      captureSupported: true,
      duplicateSuppressedCount: 0,
      filteredOutCount: 0,
      lastCapturedAt: "2026-05-02T09:15:02.000Z",
      lastCapturedSenderLabel: "CBE",
      lastParserHandoffAt: null,
      lastParserOutcome: "idle",
      lastFailureReason: null,
    },
    ...overrides,
  };
}

function createPluginMock(
  snapshot = buildNativeSnapshot(),
): SmsCapturePlugin {
  return {
    checkPermissions: vi.fn().mockResolvedValue({
      receiveSms: "granted",
    }),
    requestPermissions: vi.fn().mockResolvedValue({
      receiveSms: "granted",
    }),
    getSnapshot: vi.fn().mockResolvedValue(snapshot),
    setCaptureEnabled: vi.fn().mockResolvedValue(snapshot),
    acknowledgeMessages: vi.fn().mockResolvedValue({
      ...snapshot,
      queue: [],
      summary: {
        ...snapshot.summary,
        pendingCount: 0,
        lastCapturedAt: snapshot.summary.lastCapturedAt,
      },
    }),
    clearRuntimeState: vi.fn().mockResolvedValue(undefined),
    addListener: vi.fn(),
    removeAllListeners: vi.fn().mockResolvedValue(undefined),
  };
}

describe("createSmsCaptureBridge", () => {
  it("returns an honest manual-only snapshot when native capture is unavailable", async () => {
    const bridge = createSmsCaptureBridge({
      isNativePlatform: () => false,
      plugin: createPluginMock(),
    });

    const snapshot = await bridge.getSnapshot();

    expect(snapshot.buildMode).toBe("manual_only");
    expect(snapshot.captureEnabled).toBe(false);
    expect(snapshot.queue).toEqual([]);
    expect(snapshot.summary.pendingCount).toBe(0);
    expect(snapshot.diagnostics.permissionState).toBe("unavailable");
    expect(snapshot.diagnostics.nativeCaptureAvailable).toBe(false);
    expect(snapshot.diagnostics.captureSupported).toBe(false);
  });

  it("surfaces the native snapshot when the plugin is available", async () => {
    const plugin = createPluginMock();
    const bridge = createSmsCaptureBridge({
      isNativePlatform: () => true,
      plugin,
    });

    const snapshot = await bridge.getSnapshot();

    expect(plugin.getSnapshot).toHaveBeenCalledTimes(1);
    expect(snapshot.buildMode).toBe("native_capture");
    expect(snapshot.captureEnabled).toBe(true);
    expect(snapshot.queue[0]?.messageId).toBe("sms-001");
    expect(snapshot.diagnostics.permissionState).toBe("granted");
  });

  it("acknowledges captured queue items through the plugin", async () => {
    const plugin = createPluginMock();
    const bridge = createSmsCaptureBridge({
      isNativePlatform: () => true,
      plugin,
    });

    const snapshot = await bridge.acknowledgeMessages(["capture-sms-001"]);

    expect(plugin.acknowledgeMessages).toHaveBeenCalledWith({
      captureIds: ["capture-sms-001"],
    });
    expect(snapshot.queue).toEqual([]);
    expect(snapshot.summary.pendingCount).toBe(0);
  });

  it("forwards live native capture events to JS listeners", async () => {
    const plugin = createPluginMock();
    const remove = vi.fn();
    let listener: ((event: SmsCaptureEventPayload) => void) | undefined;
    vi.mocked(plugin.addListener).mockImplementation(async (_eventName, handler) => {
      listener = handler;
      return { remove };
    });
    const bridge = createSmsCaptureBridge({
      isNativePlatform: () => true,
      plugin,
    });
    const received: SmsCaptureEventPayload[] = [];

    const handle = await bridge.addListener((event) => {
      received.push(event);
    });
    listener?.({
      item: buildNativeSnapshot().queue[0],
      snapshot: buildNativeSnapshot(),
    });

    expect(plugin.addListener).toHaveBeenCalledWith(
      "smsCaptured",
      expect.any(Function),
    );
    expect(received).toHaveLength(1);
    expect(received[0]?.item.captureId).toBe("capture-sms-001");

    await handle.remove();
    expect(remove).toHaveBeenCalledTimes(1);
  });
});
