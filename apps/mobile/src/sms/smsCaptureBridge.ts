import { Capacitor, type PermissionState, type PluginListenerHandle } from "@capacitor/core";
import type { SmsCapturePermissionState } from "@omni-sync/core";
import {
  MobileSmsCapture,
  type NativeSmsCaptureSnapshot,
  type SmsCaptureEventPayload,
  type SmsCapturePlugin,
} from "@omni-sync/mobile-sms-capture";

export interface SmsCaptureBridgeOptions {
  plugin?: SmsCapturePlugin;
  isNativePlatform?: () => boolean;
}

export interface SmsCaptureBridge {
  getSnapshot(): Promise<NativeSmsCaptureSnapshot>;
  checkPermissionState(): Promise<SmsCapturePermissionState>;
  requestPermissions(): Promise<NativeSmsCaptureSnapshot>;
  clearRuntimeState(): Promise<NativeSmsCaptureSnapshot>;
  setCaptureEnabled(enabled: boolean): Promise<NativeSmsCaptureSnapshot>;
  acknowledgeMessages(
    captureIds: readonly string[],
  ): Promise<NativeSmsCaptureSnapshot>;
  addListener(
    listener: (event: SmsCaptureEventPayload) => void,
  ): Promise<PluginListenerHandle>;
}

function createManualOnlySnapshot(
  permissionState: SmsCapturePermissionState = "unavailable",
): NativeSmsCaptureSnapshot {
  return {
    captureEnabled: false,
    buildMode: "manual_only",
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
      permissionState,
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
    },
  };
}

function mapPermissionState(
  permissionState: PermissionState | undefined,
): SmsCapturePermissionState {
  switch (permissionState) {
    case "granted":
      return "granted";
    case "denied":
      return "denied";
    case "prompt":
    case "prompt-with-rationale":
      return "prompt";
    default:
      return "unknown";
  }
}

function isUnavailablePluginError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return error.message.includes("not implemented") || error.message.includes("not available");
}

export function createSmsCaptureBridge(
  options: SmsCaptureBridgeOptions = {},
): SmsCaptureBridge {
  const plugin = options.plugin ?? MobileSmsCapture;
  const isNativePlatform =
    options.isNativePlatform ?? (() => Capacitor.isNativePlatform());

  async function getNativeSnapshot(): Promise<NativeSmsCaptureSnapshot> {
    if (!isNativePlatform()) {
      return createManualOnlySnapshot();
    }

    try {
      return await plugin.getSnapshot();
    } catch (error) {
      if (isUnavailablePluginError(error)) {
        return createManualOnlySnapshot();
      }

      throw error;
    }
  }

  return {
    async getSnapshot() {
      return getNativeSnapshot();
    },
    async checkPermissionState() {
      if (!isNativePlatform()) {
        return "unavailable";
      }

      try {
        const permissionStatus = await plugin.checkPermissions();
        return mapPermissionState(permissionStatus.receiveSms);
      } catch (error) {
        if (isUnavailablePluginError(error)) {
          return "unavailable";
        }

        throw error;
      }
    },
    async requestPermissions() {
      if (!isNativePlatform()) {
        return createManualOnlySnapshot();
      }

      try {
        await plugin.requestPermissions();
        return await plugin.getSnapshot();
      } catch (error) {
        if (isUnavailablePluginError(error)) {
          return createManualOnlySnapshot();
        }

        throw error;
      }
    },
    async clearRuntimeState() {
      if (!isNativePlatform()) {
        return createManualOnlySnapshot();
      }

      try {
        return await plugin.clearRuntimeState();
      } catch (error) {
        if (isUnavailablePluginError(error)) {
          return createManualOnlySnapshot();
        }

        throw error;
      }
    },
    async setCaptureEnabled(enabled) {
      if (!isNativePlatform()) {
        return createManualOnlySnapshot();
      }

      try {
        return await plugin.setCaptureEnabled({ enabled });
      } catch (error) {
        if (isUnavailablePluginError(error)) {
          return createManualOnlySnapshot();
        }

        throw error;
      }
    },
    async acknowledgeMessages(captureIds) {
      if (!isNativePlatform()) {
        return createManualOnlySnapshot();
      }

      try {
        return await plugin.acknowledgeMessages({
          captureIds: [...captureIds],
        });
      } catch (error) {
        if (isUnavailablePluginError(error)) {
          return createManualOnlySnapshot();
        }

        throw error;
      }
    },
    async addListener(listener) {
      if (!isNativePlatform()) {
        return {
          remove: async () => undefined,
        };
      }

      try {
        return await plugin.addListener("smsCaptured", listener);
      } catch (error) {
        if (isUnavailablePluginError(error)) {
          return {
            remove: async () => undefined,
          };
        }

        throw error;
      }
    },
  };
}

export const smsCaptureBridge = createSmsCaptureBridge();
