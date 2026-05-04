import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createTransactionStore, transactionStore } from "@omni-sync/database";
import type { UseSmsCaptureRuntimeResult } from "../sms";

const { mockUseSmsCaptureRuntime } = vi.hoisted(() => ({
  mockUseSmsCaptureRuntime: vi.fn(
    (): UseSmsCaptureRuntimeResult => ({
      isSyncing: false,
      refreshRuntime: vi.fn(),
      requestPermissions: vi.fn(),
      setCaptureEnabled: vi.fn(),
      syncError: null,
    }),
  ),
}));

vi.mock("../sms", () => ({
  useSmsCaptureRuntime: mockUseSmsCaptureRuntime,
}));

import { SmsCaptureRoutingPage } from "./SmsCaptureRoutingPage";

function resetTransactionStore() {
  window.localStorage.clear();
  const freshStore = createTransactionStore();
  const freshState = freshStore.getState();

  transactionStore.getState().clearAllData();
  transactionStore.setState(
    {
      smsCaptureSettings: {
        ...freshState.smsCaptureSettings,
        buildMode: "manual_only",
      },
      smsCaptureQueue: freshState.smsCaptureQueue,
      smsCaptureQueueSummary: freshState.smsCaptureQueueSummary,
      smsCaptureDiagnostics: freshState.smsCaptureDiagnostics,
    },
    false,
  );
}

describe("SmsCaptureRoutingPage", () => {
  beforeEach(() => {
    Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true);
    resetTransactionStore();
  });

  afterEach(() => {
    document.body.innerHTML = "";
    Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
    mockUseSmsCaptureRuntime.mockClear();
  });

  it("treats automatic capture as coming soon when the phone is still manual only", () => {
    document.body.innerHTML = '<div id="root"></div>';
    const container = document.getElementById("root");

    if (!container) {
      throw new Error("Expected test root container to exist");
    }

    const root = createRoot(container);

    act(() => {
      root.render(<SmsCaptureRoutingPage />);
    });

    expect(container.textContent).toContain("Automatic capture is coming soon on this phone");
    expect(container.textContent).toContain("No bank or wallet senders added yet");
    expect(container.textContent).toContain("Coming soon on this phone");
    expect(container.textContent).not.toContain(
      "Manage runtime, sender rules, queue state, backfill request, and diagnostics.",
    );

    act(() => {
      root.unmount();
    });
  });

  it("records historical import intent when backfill is unsupported", () => {
    transactionStore.setState(
      (state) => ({
        smsCaptureSettings: {
          ...state.smsCaptureSettings,
          retentionDays: 45,
        },
      }),
      false,
    );

    document.body.innerHTML = '<div id="root"></div>';
    const container = document.getElementById("root");

    if (!container) {
      throw new Error("Expected test root container to exist");
    }

    const root = createRoot(container);

    act(() => {
      root.render(<SmsCaptureRoutingPage />);
    });

    const historyImportButton = Array.from(
      container.querySelectorAll("button"),
    ).find((button) => button.textContent?.includes("Record history request"));

    expect(historyImportButton).toBeDefined();
    expect(container.textContent).toContain(
      "This build does not implement historical SMS ingestion yet.",
    );

    act(() => {
      historyImportButton?.dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });

    expect(container.textContent).toContain(
      "Recorded a 45-day history request. This build does not implement historical SMS ingestion yet.",
    );

    act(() => {
      root.unmount();
    });
  });
});
