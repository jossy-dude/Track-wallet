import { useEffect, useRef, useState } from "react";

import {
  buildParserRuntimeOptionsFromWorkspace,
  type ParserRuntimeOptions,
} from "@omni-sync/core";
import { transactionStore } from "@omni-sync/database";
import type { NativeSmsCaptureSnapshot } from "@omni-sync/mobile-sms-capture";

import {
  smsCaptureBridge,
  type SmsCaptureBridge,
} from "./smsCaptureBridge";
import { readParserWorkspacePreferences } from "../preferences/parserPreferences";

export interface UseSmsCaptureRuntimeOptions {
  bridge?: SmsCaptureBridge;
  autoDrainQueue?: boolean;
  attachLifecycle?: boolean;
  runtime?: ParserRuntimeOptions;
}

export interface UseSmsCaptureRuntimeResult {
  isSyncing: boolean;
  syncError: string | null;
  refreshRuntime: () => Promise<NativeSmsCaptureSnapshot>;
  requestPermissions: () => Promise<NativeSmsCaptureSnapshot>;
  setCaptureEnabled: (enabled: boolean) => Promise<NativeSmsCaptureSnapshot>;
}

let hasAttachedRuntimeLifecycle = false;

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return "SMS runtime sync failed.";
}

function resolveRuntimeOptions(
  runtime: ParserRuntimeOptions | undefined,
): ParserRuntimeOptions | undefined {
  if (runtime) {
    return runtime;
  }

  const parserWorkspace = readParserWorkspacePreferences();
  if (!parserWorkspace) {
    return undefined;
  }

  return buildParserRuntimeOptionsFromWorkspace(parserWorkspace.templateWorkspace, {
    preferredTemplateId: parserWorkspace.selectedTemplateId,
    includeDraftTemplates: true,
  });
}

export function useSmsCaptureRuntime(
  options: UseSmsCaptureRuntimeOptions = {},
): UseSmsCaptureRuntimeResult {
  const bridge = options.bridge ?? smsCaptureBridge;
  const autoDrainQueueRef = useRef(options.autoDrainQueue ?? true);
  const runtimeRef = useRef<ParserRuntimeOptions | undefined>(options.runtime);
  const mountedRef = useRef(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  autoDrainQueueRef.current = options.autoDrainQueue ?? true;
  runtimeRef.current = resolveRuntimeOptions(options.runtime);

  function getResolvedRuntimeOptions() {
    const resolvedRuntime = options.runtime ?? resolveRuntimeOptions(options.runtime);
    runtimeRef.current = resolvedRuntime;
    return resolvedRuntime;
  }

  function setErrorState(message: string | null) {
    if (!mountedRef.current) {
      return;
    }

    setSyncError(message);
  }

  function setSyncingState(nextValue: boolean) {
    if (!mountedRef.current) {
      return;
    }

    setIsSyncing(nextValue);
  }

  function drainParserQueue() {
    if (!autoDrainQueueRef.current) {
      return;
    }

    const runtime = getResolvedRuntimeOptions();
    let processedCount = 0;
    while (
      transactionStore.getState().smsCaptureSettings.autoRouteToParserWhenAppOpen &&
      processedCount < 100
    ) {
      const result = transactionStore.getState().processNextSmsCaptureQueueItem({
        runtime,
      });
      if (!result) {
        break;
      }

      processedCount += 1;
    }
  }

  async function applySnapshot(snapshot: NativeSmsCaptureSnapshot) {
    transactionStore.getState().applySmsCaptureRuntimeSnapshot(snapshot);

    const captureIds = snapshot.queue
      .map((item) => item.captureId)
      .filter((captureId): captureId is string => captureId.trim().length > 0);

    try {
      if (captureIds.length > 0) {
        const acknowledgedSnapshot = await bridge.acknowledgeMessages(captureIds);
        transactionStore
          .getState()
          .applySmsCaptureRuntimeSnapshot(acknowledgedSnapshot);
      }

      drainParserQueue();
      setErrorState(null);
    } catch (error) {
      drainParserQueue();
      setErrorState(getErrorMessage(error));
    }

    return snapshot;
  }

  async function refreshRuntime() {
    setSyncingState(true);

    try {
      const snapshot = await bridge.getSnapshot();
      await applySnapshot(snapshot);
      return snapshot;
    } catch (error) {
      const message = getErrorMessage(error);
      setErrorState(message);
      throw error;
    } finally {
      setSyncingState(false);
    }
  }

  async function requestPermissions() {
    setSyncingState(true);

    try {
      const snapshot = await bridge.requestPermissions();
      await applySnapshot(snapshot);
      return snapshot;
    } catch (error) {
      const message = getErrorMessage(error);
      setErrorState(message);
      throw error;
    } finally {
      setSyncingState(false);
    }
  }

  async function setCaptureEnabled(enabled: boolean) {
    setSyncingState(true);

    try {
      const snapshot = await bridge.setCaptureEnabled(enabled);
      await applySnapshot(snapshot);
      return snapshot;
    } catch (error) {
      const message = getErrorMessage(error);
      setErrorState(message);
      throw error;
    } finally {
      setSyncingState(false);
    }
  }

  useEffect(() => {
    mountedRef.current = true;
    let disposed = false;
    let removeListener: (() => Promise<void>) | null = null;
    let ownsLifecycle = false;

    if (options.attachLifecycle !== false && !hasAttachedRuntimeLifecycle) {
      hasAttachedRuntimeLifecycle = true;
      ownsLifecycle = true;

      void refreshRuntime().catch(() => undefined);

      void bridge
        .addListener((event) => {
          void applySnapshot(event.snapshot).catch((error) => {
            setErrorState(getErrorMessage(error));
          });
        })
        .then((handle) => {
          if (disposed) {
            void handle.remove();
            return;
          }

          removeListener = handle.remove;
        })
        .catch((error) => {
          setErrorState(getErrorMessage(error));
        });
    }

    return () => {
      disposed = true;
      mountedRef.current = false;
      if (removeListener) {
        void removeListener();
      }
      if (ownsLifecycle) {
        hasAttachedRuntimeLifecycle = false;
      }
    };
  }, [bridge, options.attachLifecycle]);

  return {
    isSyncing,
    syncError,
    refreshRuntime,
    requestPermissions,
    setCaptureEnabled,
  };
}
