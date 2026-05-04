import type { PermissionState, PluginListenerHandle } from "@capacitor/core";
import type {
  SmsCaptureBuildMode,
  SmsCaptureDiagnostics,
  SmsCaptureQueueItem,
  SmsCaptureQueueSummary,
} from "@omni-sync/core";

export interface NativeSmsCaptureSnapshot {
  captureEnabled: boolean;
  buildMode: SmsCaptureBuildMode;
  queue: SmsCaptureQueueItem[];
  summary: SmsCaptureQueueSummary;
  diagnostics: SmsCaptureDiagnostics;
}

export interface SmsCapturePermissionStatus {
  receiveSms: PermissionState;
}

export interface SetCaptureEnabledOptions {
  enabled: boolean;
}

export interface AcknowledgeMessagesOptions {
  captureIds: string[];
}

export interface SmsCaptureEventPayload {
  item: SmsCaptureQueueItem;
  snapshot: NativeSmsCaptureSnapshot;
}

export interface SmsCapturePlugin {
  checkPermissions(): Promise<SmsCapturePermissionStatus>;
  requestPermissions(): Promise<SmsCapturePermissionStatus>;
  getSnapshot(): Promise<NativeSmsCaptureSnapshot>;
  clearRuntimeState(): Promise<NativeSmsCaptureSnapshot>;
  setCaptureEnabled(
    options: SetCaptureEnabledOptions,
  ): Promise<NativeSmsCaptureSnapshot>;
  acknowledgeMessages(
    options: AcknowledgeMessagesOptions,
  ): Promise<NativeSmsCaptureSnapshot>;
  addListener(
    eventName: "smsCaptured",
    listenerFunc: (event: SmsCaptureEventPayload) => void,
  ): Promise<PluginListenerHandle>;
  removeAllListeners(): Promise<void>;
}
