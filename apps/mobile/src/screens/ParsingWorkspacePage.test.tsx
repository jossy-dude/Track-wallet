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

import { ParsingWorkspacePage } from "./ParsingWorkspacePage";

function resetTransactionStore() {
  window.localStorage.clear();
  const freshStore = createTransactionStore();
  const freshState = freshStore.getState();

  transactionStore.getState().clearAllData();
  transactionStore.setState(
    {
      approvalQueue: freshState.approvalQueue,
      approvedTransactions: freshState.approvedTransactions,
      unmatchedMessages: freshState.unmatchedMessages,
      smsCaptureSettings: freshState.smsCaptureSettings,
      smsCaptureQueue: freshState.smsCaptureQueue,
      smsCaptureQueueSummary: freshState.smsCaptureQueueSummary,
      smsCaptureDiagnostics: freshState.smsCaptureDiagnostics,
      accountSummaries: freshState.accountSummaries,
      customAccounts: freshState.customAccounts,
      parserWorkspaceAuthorityState: freshState.parserWorkspaceAuthorityState,
    },
    false,
  );
}

describe("ParsingWorkspacePage", () => {
  beforeEach(() => {
    Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true);
    resetTransactionStore();
  });

  afterEach(() => {
    document.body.innerHTML = "";
    Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
    mockUseSmsCaptureRuntime.mockClear();
  });

  it("marks preview and diagnostics as coming soon on first run", () => {
    document.body.innerHTML = '<div id="root"></div>';
    const container = document.getElementById("root");

    if (!container) {
      throw new Error("Expected test root container to exist");
    }

    const root = createRoot(container);

    act(() => {
      root.render(<ParsingWorkspacePage />);
    });

    expect(container.textContent).toContain("Create an account first");
    expect(container.textContent).toContain("Preview coming soon");
    expect(container.textContent).toContain("Checks coming soon");
    expect(container.textContent).not.toContain("Live parser workspace");

    act(() => {
      root.unmount();
    });
  });
});
