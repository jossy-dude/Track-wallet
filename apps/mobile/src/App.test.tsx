import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Capacitor } from "@capacitor/core";
import {
  createTransactionStore,
  transactionStore,
} from "@omni-sync/database";
import type { NativeSmsCaptureSnapshot } from "@omni-sync/mobile-sms-capture";
import type { UseSmsCaptureRuntimeResult } from "./sms";

const { mockUseSmsCaptureRuntime } = vi.hoisted(() => ({
  mockUseSmsCaptureRuntime: vi.fn(
    (): UseSmsCaptureRuntimeResult => ({
      isSyncing: false,
      syncError: null,
      refreshRuntime: vi.fn(),
      requestPermissions: vi.fn(),
      setCaptureEnabled: vi.fn(),
    }),
  ),
}));

vi.mock("./sms", () => ({
  useSmsCaptureRuntime: mockUseSmsCaptureRuntime,
}));

import App from "./App";

const ONBOARDING_COMPLETED_KEY = "trackwallet.mobile.onboarding-complete-v2";
const DEMO_MODE_KEY = "trackwallet.mobile.demo-mode-v1";

function buildSmsRuntimeHookResult(
  overrides: Partial<UseSmsCaptureRuntimeResult> = {},
): UseSmsCaptureRuntimeResult {
  return {
    isSyncing: false,
    syncError: null,
    refreshRuntime: vi.fn(),
    requestPermissions: vi.fn(),
    setCaptureEnabled: vi.fn(),
    ...overrides,
  };
}

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
    },
    false,
  );
}

async function flushAsyncWork() {
  await Promise.resolve();
  await Promise.resolve();
}

function buildNativeSnapshot(
  overrides: Partial<NativeSmsCaptureSnapshot> = {},
): NativeSmsCaptureSnapshot {
  return {
    captureEnabled: true,
    buildMode: "native_capture",
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
    ...overrides,
  };
}

function renderApp() {
  document.body.innerHTML = '<div id="root"></div>';
  const container = document.getElementById("root");

  if (!container) {
    throw new Error("Expected test root container to exist");
  }

  const root = createRoot(container);

  return {
    container,
    async render() {
      await act(async () => {
        root.render(<App />);
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

async function startPrivateWallet(screen: ReturnType<typeof renderApp>) {
  await act(async () => {
    findButtonByText(screen.container, "Start private")?.dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    );
    await flushAsyncWork();
  });
}

function findButtonByText(container: HTMLElement, text: string) {
  return Array.from(container.querySelectorAll("button")).find((button) =>
    button.textContent?.includes(text),
  );
}

function findButtonByLabel(container: HTMLElement, label: string) {
  return container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
}

function updateInputValue(
  input: HTMLInputElement | HTMLTextAreaElement,
  value: string,
) {
  const prototype =
    input instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  const valueSetter = Object.getOwnPropertyDescriptor(
    prototype,
    "value",
  )?.set;

  valueSetter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

describe("App demo mode", () => {
  beforeEach(() => {
    Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true);
    window.scrollTo = vi.fn();
    resetTransactionStore();
    mockUseSmsCaptureRuntime.mockReturnValue(buildSmsRuntimeHookResult());
  });

  afterEach(() => {
    document.body.innerHTML = "";
    Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
    mockUseSmsCaptureRuntime.mockClear();
  });

  it("mounts the sms runtime from the app root before any settings pages are opened", async () => {
    window.localStorage.setItem(ONBOARDING_COMPLETED_KEY, "yes");
    window.localStorage.setItem(DEMO_MODE_KEY, "true");

    const screen = renderApp();
    await screen.render();

    expect(mockUseSmsCaptureRuntime).toHaveBeenCalled();

    screen.unmount();
  });

  it("shows a bootstrap loading state while hydration finishes the initial native runtime sync", async () => {
    window.localStorage.setItem(ONBOARDING_COMPLETED_KEY, "yes");
    window.localStorage.setItem(DEMO_MODE_KEY, "false");
    mockUseSmsCaptureRuntime.mockReturnValue(
      buildSmsRuntimeHookResult({
        isSyncing: true,
      }),
    );
    const nativeSpy = vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(true);

    const screen = renderApp();
    await screen.render();

    expect(screen.container.textContent).toContain("Loading your wallet");
    expect(screen.container.textContent).toContain("Syncing local data and SMS runtime");
    expect(screen.container.textContent).not.toContain("Finish your private wallet setup");

    nativeSpy.mockRestore();
    screen.unmount();
  });

  it("shows a bootstrap error state for the initial native runtime sync and lets the user continue anyway", async () => {
    window.localStorage.setItem(ONBOARDING_COMPLETED_KEY, "yes");
    window.localStorage.setItem(DEMO_MODE_KEY, "false");
    mockUseSmsCaptureRuntime.mockReturnValue(
      buildSmsRuntimeHookResult({
        syncError: "SMS bridge did not respond.",
      }),
    );
    const nativeSpy = vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(true);

    const screen = renderApp();
    await screen.render();

    expect(screen.container.textContent).toContain("SMS runtime needs attention");
    expect(screen.container.textContent).toContain("SMS bridge did not respond.");
    expect(findButtonByText(screen.container, "Retry runtime sync")).toBeDefined();
    expect(findButtonByText(screen.container, "Open app anyway")).toBeDefined();

    await act(async () => {
      findButtonByText(screen.container, "Open app anyway")?.dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
      await flushAsyncWork();
    });

    expect(screen.container.textContent).toContain("Finish your private wallet setup");

    nativeSpy.mockRestore();
    screen.unmount();
  });

  it("shows a showcase control beside settings while showcase mode is active and routes private-wallet users into setup instead of an empty dashboard", async () => {
    window.localStorage.setItem(ONBOARDING_COMPLETED_KEY, "yes");
    window.localStorage.setItem(DEMO_MODE_KEY, "true");

    const screen = renderApp();
    await screen.render();

    expect(transactionStore.getState().approvedTransactions).toHaveLength(3);
    expect(findButtonByLabel(screen.container, "Settings")).toBeDefined();
    expect(findButtonByText(screen.container, "Showcase")).toBeDefined();
    expect(screen.container.innerHTML).not.toContain("googleusercontent.com");

    act(() => {
      findButtonByText(screen.container, "Showcase")?.dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });

    expect(screen.container.textContent).toContain("Leave showcase mode?");

    await act(async () => {
      findButtonByText(screen.container, "Use private wallet")?.dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
      await flushAsyncWork();
    });

    expect(transactionStore.getState().approvedTransactions).toHaveLength(0);
    expect(transactionStore.getState().approvalQueue).toHaveLength(0);
    expect(findButtonByText(screen.container, "Showcase")).toBeUndefined();
    expect(screen.container.textContent).toContain("Finish your private wallet setup");
    expect(screen.container.textContent).toContain("Create your first account");
    expect(screen.container.textContent).toContain("Review SMS fallback");
    expect(findButtonByText(screen.container, "Review SMS options")).toBeDefined();
    expect(screen.container.textContent).not.toContain("Review showcase location");
    expect(screen.container.textContent).not.toContain("Open showcase location");

    screen.unmount();
  });

  it("offers a showcase reload entry in Settings > Appearance after showcase mode has been turned off", async () => {
    window.localStorage.setItem(ONBOARDING_COMPLETED_KEY, "yes");
    window.localStorage.setItem(DEMO_MODE_KEY, "false");

    const screen = renderApp();
    await screen.render();

    expect(findButtonByText(screen.container, "Showcase")).toBeUndefined();

    act(() => {
      findButtonByLabel(screen.container, "Settings")?.dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });

    act(() => {
      findButtonByText(screen.container, "Appearance")?.dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });

    expect(screen.container.textContent).toContain("Load showcase mode");

    act(() => {
      findButtonByText(screen.container, "Load showcase mode")?.dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });

    expect(screen.container.textContent).toContain("Load showcase mode again?");

    await act(async () => {
      findButtonByText(screen.container, "Load showcase now")?.dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
      await flushAsyncWork();
    });

    act(() => {
      findButtonByLabel(screen.container, "Back")?.dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });

    expect(transactionStore.getState().approvedTransactions).toHaveLength(3);
    expect(findButtonByText(screen.container, "Showcase")).toBeDefined();

    screen.unmount();
  });

  it("defaults the first run to the private path and keeps showcase as an explicit opt-in", async () => {
    const screen = renderApp();
    await screen.render();

    expect(transactionStore.getState().approvedTransactions).toHaveLength(0);
    expect(screen.container.textContent).toContain(
      "Choose how this phone should start",
    );
    expect(screen.container.textContent).toContain("Start private");
    expect(screen.container.textContent).toContain("Try showcase");
    expect(screen.container.textContent).toContain(
      "Showcase loads sample balances, budgets, and inbox drafts on this phone. Skip if you want to start private and empty.",
    );

    await act(async () => {
      findButtonByText(screen.container, "Start private")?.dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
      await flushAsyncWork();
    });

    expect(screen.container.textContent).not.toContain(
      "Choose how this phone should start",
    );
    expect(transactionStore.getState().approvedTransactions).toHaveLength(0);
    expect(findButtonByText(screen.container, "Showcase")).toBeUndefined();
    expect(screen.container.textContent).toContain("Finish your private wallet setup");
    expect(findButtonByText(screen.container, "Create account")).toBeDefined();
    expect(findButtonByText(screen.container, "Review SMS options")).toBeDefined();
    expect(screen.container.textContent).not.toContain("Review showcase location");

    screen.unmount();
  });

  it("opens the showcase flow only when the user chooses it from onboarding", async () => {
    const screen = renderApp();
    await screen.render();

    expect(transactionStore.getState().approvedTransactions).toHaveLength(0);

    await act(async () => {
      findButtonByText(screen.container, "Try showcase")?.dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
      await flushAsyncWork();
    });

    expect(screen.container.textContent).toContain(
      "Messages and manual entry share one lane",
    );

    await act(async () => {
      findButtonByText(screen.container, "Continue")?.dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
      findButtonByText(screen.container, "Continue")?.dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
      findButtonByText(screen.container, "Continue")?.dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
      await flushAsyncWork();
    });

    expect(findButtonByText(screen.container, "Enter showcase")).toBeDefined();

    await act(async () => {
      findButtonByText(screen.container, "Enter showcase")?.dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
      await flushAsyncWork();
    });

    expect(transactionStore.getState().approvedTransactions).toHaveLength(3);
    expect(findButtonByText(screen.container, "Showcase")).toBeDefined();

    screen.unmount();
  });

  it("uses step-aware setup actions and routes users to accounts first when no account exists", async () => {
    const screen = renderApp();
    await screen.render();

    await startPrivateWallet(screen);

    expect(screen.container.textContent).toContain("Finish your private wallet setup");
    expect(findButtonByText(screen.container, "Go to account setup")).toBeDefined();

    act(() => {
      findButtonByText(screen.container, "Go to account setup")?.dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });

    expect(screen.container.textContent).toContain("Account allocation");
    expect(screen.container.textContent).not.toContain("Home total");
    expect(transactionStore.getState().customAccounts).toHaveLength(0);

    screen.unmount();
  });

  it("explains why Add is blocked during private setup and routes directly to account setup", async () => {
    const screen = renderApp();
    await screen.render();

    await startPrivateWallet(screen);

    await act(async () => {
      findButtonByText(screen.container, "Add")?.dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
      await flushAsyncWork();
    });

    expect(screen.container.textContent).toContain("Add is locked for this wallet");
    expect(screen.container.textContent).toContain(
      "Create your first account before queueing manual entries or expecting Inbox drafts.",
    );
    expect(findButtonByText(screen.container, "Go to account setup")).toBeDefined();

    await act(async () => {
      findButtonByText(screen.container, "Go to account setup")?.dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
      await flushAsyncWork();
    });

    expect(screen.container.textContent).toContain("Account allocation");

    screen.unmount();
  });

  it("routes blocked Add directly into SMS capture when the account exists but live capture is still required", async () => {
    const screen = renderApp();
    await screen.render();

    await startPrivateWallet(screen);

    act(() => {
      transactionStore.getState().updateSmsCaptureSettings({
        buildMode: "native_capture",
        captureEnabled: false,
      });
      transactionStore.getState().applySmsCaptureRuntimeSnapshot(
        buildNativeSnapshot({
          captureEnabled: false,
        }),
      );
      transactionStore.getState().createCustomAccount({
        institutionName: "Awash Bank",
        accountReference: "20202450",
        balanceMinor: 245000,
        channel: "bank",
        note: "Emergency reserve",
      });
    });

    await act(async () => {
      await flushAsyncWork();
    });

    await act(async () => {
      findButtonByText(screen.container, "Add")?.dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
      await flushAsyncWork();
    });

    expect(screen.container.textContent).toContain("Add is locked for this wallet");
    expect(screen.container.textContent).toContain(
      "Enable live SMS capture and at least one trusted sender rule before this alpha opens Add on native Android.",
    );
    expect(findButtonByText(screen.container, "Open SMS capture")).toBeDefined();

    await act(async () => {
      findButtonByText(screen.container, "Open SMS capture")?.dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
      await flushAsyncWork();
    });

    expect(screen.container.textContent).toContain("SMS Capture & Routing");

    screen.unmount();
  });

  it("keeps inbox and ledger behind the setup gate until the private path is ready", async () => {
    const screen = renderApp();
    await screen.render();

    await startPrivateWallet(screen);

    act(() => {
      findButtonByText(screen.container, "Inbox")?.dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });

    expect(screen.container.textContent).toContain("Finish your private wallet setup");
    expect(screen.container.textContent).not.toContain("Review before it lands");

    act(() => {
      findButtonByText(screen.container, "Ledger")?.dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });

    expect(screen.container.textContent).toContain("Finish your private wallet setup");
    expect(screen.container.textContent).not.toContain("Approved transactions");

    act(() => {
      findButtonByText(screen.container, "Accounts")?.dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });

    expect(screen.container.textContent).toContain("Account allocation");

    screen.unmount();
  });

  it("routes native-capture builds into sms capture settings once an account exists but live capture is still missing", async () => {
    const screen = renderApp();
    await screen.render();

    await startPrivateWallet(screen);

    act(() => {
      transactionStore.getState().updateSmsCaptureSettings({
        buildMode: "native_capture",
        captureEnabled: false,
      });
      transactionStore.getState().applySmsCaptureRuntimeSnapshot(
        buildNativeSnapshot({
          captureEnabled: false,
        }),
      );
      transactionStore.getState().createCustomAccount({
        institutionName: "Awash Bank",
        accountReference: "20202450",
        balanceMinor: 245000,
        channel: "bank",
        note: "Emergency reserve",
      });
    });

    await act(async () => {
      await flushAsyncWork();
    });

    act(() => {
      findButtonByText(screen.container, "Open SMS capture")?.dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });

    expect(screen.container.textContent).toContain("SMS Capture & Routing");
    expect(screen.container.textContent).not.toContain("Finish your private wallet setup");

    screen.unmount();
  });

  it("lets manual-only builds open the wallet after account setup and explains the first inbox and ledger loop", async () => {
    const screen = renderApp();
    await screen.render();

    await startPrivateWallet(screen);

    act(() => {
      transactionStore.getState().createCustomAccount({
        institutionName: "Awash Bank",
        accountReference: "20202450",
        balanceMinor: 245000,
        channel: "bank",
        note: "Emergency reserve",
      });
    });

    await act(async () => {
      await flushAsyncWork();
    });

    act(() => {
      findButtonByText(screen.container, "Open wallet")?.dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });

    expect(screen.container.textContent).not.toContain("Finish your private wallet setup");
    expect(screen.container.textContent).toContain("Total balance");

    act(() => {
      findButtonByText(screen.container, "Inbox")?.dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });

    expect(screen.container.textContent).toContain("Start your first review loop");
    expect(screen.container.textContent).toContain(
      "Use manual entry to practice the review loop right away.",
    );

    act(() => {
      findButtonByText(screen.container, "Ledger")?.dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });

    expect(screen.container.textContent).toContain("Nothing approved yet");
    expect(screen.container.textContent).toContain(
      "Approved items land here after you review them in Inbox.",
    );

    screen.unmount();
  });

  it("dismisses the private checklist only when both account setup and live sms capture are ready on native capture builds", async () => {
    const screen = renderApp();
    await screen.render();

    await startPrivateWallet(screen);

    act(() => {
      transactionStore.getState().updateSmsCaptureSettings({
        buildMode: "native_capture",
        captureEnabled: true,
      });
      transactionStore.getState().createCustomAccount({
        institutionName: "Awash Bank",
        accountReference: "20202450",
        balanceMinor: 245000,
        channel: "bank",
        note: "Emergency reserve",
      });
      transactionStore.getState().addSmsSenderRule("CBE");
      transactionStore.getState().applySmsCaptureRuntimeSnapshot(
        buildNativeSnapshot(),
      );
    });

    await act(async () => {
      await flushAsyncWork();
    });

    act(() => {
      findButtonByText(screen.container, "Open wallet")?.dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });

    expect(screen.container.textContent).not.toContain("Finish your private wallet setup");
    expect(screen.container.textContent).toContain("Total balance");

    screen.unmount();
  });

  it("surfaces reject actions from the inbox review flow", async () => {
    window.localStorage.setItem(ONBOARDING_COMPLETED_KEY, "yes");
    window.localStorage.setItem(DEMO_MODE_KEY, "true");

    const screen = renderApp();
    await screen.render();

    act(() => {
      findButtonByText(screen.container, "Inbox")?.dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });

    expect(transactionStore.getState().approvalQueue).toHaveLength(3);
    expect(findButtonByText(screen.container, "Reject")).toBeDefined();

    act(() => {
      findButtonByText(screen.container, "Reject")?.dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });

    expect(transactionStore.getState().approvalQueue).toHaveLength(2);

    screen.unmount();
  });

  it("shows sender, account context, and parser confidence on sms-backed inbox review rows", async () => {
    window.localStorage.setItem(ONBOARDING_COMPLETED_KEY, "yes");
    window.localStorage.setItem(DEMO_MODE_KEY, "true");

    const screen = renderApp();
    await screen.render();

    act(() => {
      findButtonByText(screen.container, "Inbox")?.dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });

    const firstQueueItem = transactionStore.getState().approvalQueue[0];

    expect(firstQueueItem).toBeDefined();
    expect(screen.container.textContent).toContain(firstQueueItem!.senderLabel);
    expect(screen.container.textContent).toContain(
      `**** ${firstQueueItem!.accountReference?.slice(-4)}`,
    );
    expect(screen.container.textContent).toContain(
      `${Math.round(firstQueueItem!.confidence)}% confidence`,
    );

    screen.unmount();
  });

  it("shows raw sms evidence in the queue editor but does not show it for approved-transaction editing", async () => {
    window.localStorage.setItem(ONBOARDING_COMPLETED_KEY, "yes");
    window.localStorage.setItem(DEMO_MODE_KEY, "true");

    const screen = renderApp();
    await screen.render();

    act(() => {
      findButtonByText(screen.container, "Inbox")?.dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });

    act(() => {
      findButtonByText(screen.container, "Modify")?.dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });

    const queueItem = transactionStore.getState().approvalQueue[0];
    const queueDialog = screen.container.querySelector('[role="dialog"]');

    expect(queueItem).toBeDefined();
    expect(queueDialog?.textContent).toContain("Source message");
    expect(queueDialog?.textContent).toContain(queueItem!.senderLabel);
    expect(queueDialog?.textContent).toContain(
      `${Math.round(queueItem!.confidence)}% confidence`,
    );
    expect(queueDialog?.textContent).toContain(queueItem!.rawBody);

    act(() => {
      findButtonByLabel(screen.container, "Close edit transaction modal")?.dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });

    const approvedTransaction = transactionStore.getState().approvedTransactions[0];

    expect(approvedTransaction).toBeDefined();

    act(() => {
      transactionStore
        .getState()
        .openApprovedTransactionEditor(approvedTransaction!.transactionId);
    });

    const approvedDialog = screen.container.querySelector('[role="dialog"]');

    expect(approvedDialog?.textContent).toContain("Edit approved transaction");
    expect(approvedDialog?.textContent).not.toContain("Source message");
    expect(approvedDialog?.textContent).not.toContain("confidence");

    screen.unmount();
  });

  it("renders the home showcase cards without nested button warnings", async () => {
    window.localStorage.setItem(ONBOARDING_COMPLETED_KEY, "yes");
    window.localStorage.setItem(DEMO_MODE_KEY, "true");
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    const screen = renderApp();
    await screen.render();

    expect(
      consoleError.mock.calls.some((call) =>
        call.join(" ").includes(
          "<button> cannot appear as a descendant of <button>",
        ),
      ),
    ).toBe(false);

    consoleError.mockRestore();
    screen.unmount();
  });

  it("updates the top app bar profile initials after saving a local account display name", async () => {
    vi.useFakeTimers();
    window.localStorage.setItem(ONBOARDING_COMPLETED_KEY, "yes");
    window.localStorage.setItem(DEMO_MODE_KEY, "true");

    const screen = renderApp();
    await screen.render();

    act(() => {
      findButtonByLabel(screen.container, "Settings")?.dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });

    act(() => {
      findButtonByText(screen.container, "Open local profile")?.dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });

    const displayNameInput = screen.container.querySelector<HTMLInputElement>(
      'input[type="text"]',
    );
    const saveButton = findButtonByText(screen.container, "Save local profile");

    expect(displayNameInput).toBeDefined();
    expect(saveButton).toBeDefined();

    act(() => {
      updateInputValue(displayNameInput!, "Worker Phone");
    });

    act(() => {
      saveButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      vi.advanceTimersByTime(800);
    });

    const avatarInitials = screen.container.querySelector(
      'header [aria-label$="workspace profile"] span',
    );

    expect(avatarInitials?.textContent).toBe("WP");

    screen.unmount();
  });
});
