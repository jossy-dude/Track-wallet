import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { transactionStore } from "@omni-sync/database";

import { SettingsDetailScreen } from "./SettingsDetailScreen";

const LEGACY_SECURITY_PREFERENCES_STORAGE_KEY =
  "trackwallet.mobile.security-preferences";

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

function createJsonFile(name: string, payload: unknown) {
  const body = JSON.stringify(payload);
  const file = new File([body], name, {
    type: "application/json",
  });

  Object.defineProperty(file, "text", {
    configurable: true,
    value: () => Promise.resolve(body),
  });

  return file;
}

async function flushAsyncWork() {
  await Promise.resolve();
  await Promise.resolve();
}

beforeEach(() => {
  Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true);
  transactionStore.getState().clearAllData();
  transactionStore.getState().clearSecurityPreferences();
  window.localStorage.clear();
});

afterEach(() => {
  document.body.innerHTML = "";
  Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
  vi.useRealTimers();
});

describe("SettingsDetailScreen", () => {
  it("renders the appearance page content for the appearance destination", () => {
    const html = renderToStaticMarkup(
      <SettingsDetailScreen pageId="appearance" />,
    );

    expect(html).toContain("Theme");
    expect(html).toContain("Showcase mode");
    expect(html).toContain("Color Accent");
    expect(html).toContain("Layout Density");
    expect(html).toContain("Navigation dock");
    expect(html).toContain("Preview only in this alpha");
  });

  it("renders the parsing editor layout for the parsing destination", () => {
    const html = renderToStaticMarkup(
      <SettingsDetailScreen pageId="parsing" />,
    );

    expect(html).toContain("Parsing workspace");
    expect(html).toContain("Templates");
    expect(html).toContain("Preview");
    expect(html).toContain("Create an account first.");
    expect(html).toContain("Built-in parser family");
    expect(html).toContain("Template fields");
  });

  it("hydrates a saved parser workspace from local storage", () => {
    window.localStorage.setItem(
      "trackwallet.mobile.parser-workspace",
      JSON.stringify({
        version: 1,
        templates: [
          {
            id: "telebirr_local_v1",
            institutionKey: "127",
            institutionLabel: "Telebirr",
            institutionIcon: "account_balance_wallet",
            name: "Telebirr Local Draft",
            version: "v0.2.0",
            updated: "Updated just now",
            status: "draft",
            regex: "ETB\\\\s(?<amount>[\\\\d,]+\\\\.\\\\d{2})",
            note: "Locally persisted template draft.",
            healthScore: null,
            sourceType: "local",
          },
        ],
        selectedTemplateId: "telebirr_local_v1",
        senderLabel: "127",
        strictSchemaParsing: false,
        preserveRawSms: true,
        autoReconciliation: true,
        verboseLogging: true,
      }),
    );

    const html = renderToStaticMarkup(
      <SettingsDetailScreen pageId="parsing" />,
    );

    expect(html).toContain("Telebirr Local Draft");
    expect(
      transactionStore.getState().parserWorkspaceAuthorityState,
    ).toMatchObject({
      version: 1,
      selectedTemplateId: "telebirr_local_v1",
      senderLabel: "127",
      strictSchemaParsing: false,
      preserveRawSms: true,
      autoReconciliation: true,
      verboseLogging: true,
    });
    expect(window.localStorage.getItem("trackwallet.mobile.parser-workspace")).toBeNull();
  });

  it("renders the redesigned data and storage management surface", () => {
    const html = renderToStaticMarkup(
      <SettingsDetailScreen pageId="dataStorage" />,
    );

    expect(html).toContain("Data &amp; Storage");
    expect(html).toContain("Import &amp; Export");
    expect(html).toContain("View System Logs");
    expect(html).toContain("Advanced storage tools stay hidden");
    expect(html).toContain("Review defaults");
    expect(html).not.toContain("Purge local cache");
    expect(html).not.toContain("Clear local data");
  });

  it("moves import integrity controls into the active import workspace after a package is attached", async () => {
    document.body.innerHTML = "<div id=\"root\"></div>";
    const container = document.getElementById("root");

    if (!container) {
      throw new Error("Expected test root container to exist");
    }

    const root = createRoot(container);

    act(() => {
      root.render(<SettingsDetailScreen pageId="dataStorage" />);
    });

    const importInput = container.querySelector<HTMLInputElement>(
      'input[type="file"]',
    );

    expect(importInput).toBeDefined();
    if (!importInput) {
      throw new Error("Expected import input to exist");
    }
    expect(container.textContent).toContain("Review defaults");
    expect(container.textContent).toContain("No package attached");

    const historyFile = createJsonFile("history-import.json", {
      kind: "trackwallet-historical-import",
      version: 1,
      createdAt: "2026-05-02T10:00:00.000Z",
      drafts: [
        {
          draftId: "hist-001",
          rawMessageId: "raw-001",
          senderLabel: "CBE",
          rawBody: "Imported row",
          financialInstitution: "cbe",
          transactionDirection: "debit",
          amountMinor: 45000,
          feeMinor: 0,
          runningBalanceMinor: 845000,
          reportedBalanceMinor: 845000,
          currencyCode: "ETB",
          title: "Grocery Store",
          merchantName: "GROCERY STORE",
          category: "food",
          parserTemplateId: "cbe_seed_food_v1",
          confidence: 100,
          occurredAt: "2026-04-29T00:00:00.000Z",
          accountReference: "4920",
          accountChannel: "bank",
          note: "",
        },
      ],
      unmatchedEntries: [],
    });

    await act(async () => {
      Object.defineProperty(importInput, "files", {
        configurable: true,
        value: [historyFile],
      });
      importInput.dispatchEvent(new Event("change", { bubbles: true }));
      await Promise.resolve();
    });

    expect(container.textContent).toContain("Import workspace");
    expect(container.textContent).toContain("history-import.json");
    expect(container.textContent).toContain("Import mode");
    expect(container.textContent).toContain("Duplicate handling");
    expect(container.textContent).toContain("Review window");
    expect(container.textContent).not.toContain("Historical Import");

    act(() => {
      root.unmount();
    });
  });

  it("opens a dedicated system logs surface from data storage", () => {
    document.body.innerHTML = "<div id=\"root\"></div>";
    const container = document.getElementById("root");

    if (!container) {
      throw new Error("Expected test root container to exist");
    }

    const root = createRoot(container);

    act(() => {
      root.render(<SettingsDetailScreen pageId="dataStorage" />);
    });

    const logsButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("View System Logs"),
    );

    expect(logsButton).toBeDefined();

    act(() => {
      logsButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("System Logs");
    expect(container.textContent).toContain("Import events");
    expect(container.textContent).toContain("Working now");
    expect(container.textContent).toContain("Still missing");

    act(() => {
      root.unmount();
    });
  });

  it("restores duplicate review defaults from a backup package without collapsing them to skip", async () => {
    vi.useFakeTimers();
    document.body.innerHTML = "<div id=\"root\"></div>";
    const container = document.getElementById("root");

    if (!container) {
      throw new Error("Expected test root container to exist");
    }

    const root = createRoot(container);

    act(() => {
      root.render(<SettingsDetailScreen pageId="dataStorage" />);
    });

    const fileInputs = container.querySelectorAll<HTMLInputElement>('input[type="file"]');
    const restoreInput = fileInputs[1];

    if (!restoreInput) {
      throw new Error("Expected a restore file input");
    }

    const backupFile = createJsonFile("backup.json", {
      kind: "trackwallet-authority-backup",
      version: 1,
      createdAt: "2026-05-02T10:00:00.000Z",
      finance: {
        approvedTransactions: [],
        approvalQueue: [],
        unmatchedMessages: [],
        accountSummaries: [],
      },
      defaults: {
        importMode: "merge",
        duplicateMode: "review",
        reviewWindowDays: 45,
      },
    });

    await act(async () => {
      Object.defineProperty(restoreInput, "files", {
        configurable: true,
        value: [backupFile],
      });
      restoreInput.dispatchEvent(new Event("change", { bubbles: true }));
      await Promise.resolve();
    });

    const restoreButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Apply restore",
    );

    expect(restoreButton).toBeDefined();

    await act(async () => {
      restoreButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      vi.runAllTimers();
      await Promise.resolve();
    });

    expect(window.localStorage.getItem("trackwallet.mobile.import-duplicate-mode")).toBe(
      "review",
    );
    expect(container.textContent).toContain("Coming soon");

    act(() => {
      root.unmount();
    });
  });

  it("renders a dedicated local profile page with blocked privacy rows", () => {
    const html = renderToStaticMarkup(
      <SettingsDetailScreen pageId="account" />,
    );

    expect(html).toContain("Local profile");
    expect(html).toContain("Display name");
    expect(html).toContain("Description");
    expect(html).toContain("Profile photo");
    expect(html).toContain("Not live yet.");
    expect(html).toContain("App switcher balance masking");
    expect(html).toContain("Blocked");
    expect(html).toContain("Coming soon");
    expect(html).not.toContain("Choose profile image");
    expect(html).not.toContain("Workspace note");
    expect(html).not.toContain("Export personal data");
  });

  it("uses generic local profile defaults instead of personal residue", () => {
    const html = renderToStaticMarkup(
      <SettingsDetailScreen pageId="account" />,
    );

    expect(html).toContain("Device owner");
    expect(html).not.toContain("Jossy");
  });

  it("persists local profile identity fields and keeps non-enforced privacy controls read-only", () => {
    vi.useFakeTimers();
    document.body.innerHTML = "<div id=\"root\"></div>";
    const container = document.getElementById("root");

    if (!container) {
      throw new Error("Expected test root container to exist");
    }

    const root = createRoot(container);

    act(() => {
      root.render(<SettingsDetailScreen pageId="account" />);
    });

    const displayNameInput = container.querySelector<HTMLInputElement>(
      'input[type="text"]',
    );
    const descriptionInput = container.querySelector<HTMLTextAreaElement>(
      "textarea",
    );
    const saveButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Save local profile"),
    );

    expect(displayNameInput).toBeDefined();
    expect(descriptionInput).toBeDefined();
    expect(saveButton).toBeDefined();
    expect(container.textContent).toContain("App switcher balance masking");
    expect(
      container.querySelector(
        'button[aria-label="Hide balance figures in app switcher"]',
      ),
    ).toBeNull();

    act(() => {
      updateInputValue(displayNameInput!, "Worker Phone");
      updateInputValue(descriptionInput!, "Synced reviewer profile");
    });

    act(() => {
      saveButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      vi.advanceTimersByTime(800);
    });

    act(() => {
      root.unmount();
    });

    const reloadedRoot = createRoot(container);

    act(() => {
      reloadedRoot.render(<SettingsDetailScreen pageId="account" />);
    });

    expect(container.textContent).toContain("Worker Phone");
    expect(container.textContent).toContain("Synced reviewer profile");
    expect(
      container
        .querySelector<HTMLButtonElement>(
          'button[aria-label="Hide balance figures in app switcher"]',
        ),
    ).toBeNull();

    act(() => {
      reloadedRoot.unmount();
    });
  });

  it("expands featured help answers with app-specific Track Wallet guidance", () => {
    document.body.innerHTML = "<div id=\"root\"></div>";
    const container = document.getElementById("root");

    if (!container) {
      throw new Error("Expected test root container to exist");
    }

    const root = createRoot(container);

    act(() => {
      root.render(<SettingsDetailScreen pageId="help" />);
    });

    expect(container.textContent).toContain("Track Wallet Help Center");
    expect(container.textContent).toContain(
      "Why didn't my home total change after I received an SMS?",
    );
    expect(container.textContent).not.toContain(
      "Incoming messages become Inbox drafts first, so Home totals stay unchanged until you review and approve the entry.",
    );

    const buttons = Array.from(container.querySelectorAll("button"));
    const faqButton = buttons.find((button) =>
      button.textContent?.includes(
        "Why didn't my home total change after I received an SMS?",
      ),
    );

    expect(faqButton).toBeDefined();

    act(() => {
      faqButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain(
      "Incoming messages become Inbox drafts first, so Home totals stay unchanged until you review and approve the entry.",
    );

    act(() => {
      root.unmount();
    });
  });

  it("opens a category guide from the help documentation grid", () => {
    document.body.innerHTML = "<div id=\"root\"></div>";
    const container = document.getElementById("root");

    if (!container) {
      throw new Error("Expected test root container to exist");
    }

    const root = createRoot(container);

    act(() => {
      root.render(<SettingsDetailScreen pageId="help" />);
    });

    const categoryButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("Security & Devices"),
    );

    expect(categoryButton).toBeDefined();

    act(() => {
      categoryButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("Trusted device pairing");
    expect(container.textContent).toContain(
      "Use the 6-digit pairing code or nearby discovery to move a device into the trusted route list.",
    );
    expect(container.textContent).toContain("Coming soon");
    expect(container.textContent).toContain("Remote revocation timeline");

    act(() => {
      root.unmount();
    });
  });

  it("keeps sync pairing actions hidden until live transport exists", () => {
    const html = renderToStaticMarkup(
      <SettingsDetailScreen pageId="sync" />,
    );

    expect(html).toContain("Pairing stays hidden in this alpha");
    expect(html).toContain("Transport-backed sync is not active in this alpha");
    expect(html).not.toContain("Add Device");
    expect(html).not.toContain("Open pairing");
    expect(html).not.toContain("Pair now");
    expect(html).not.toContain("Refresh Status");
    expect(html).not.toContain("Discover nearby");
  });

  it("turns the direct connect-device route into an honest alpha boundary notice", () => {
    const html = renderToStaticMarkup(
      <SettingsDetailScreen pageId="connect-device" />,
    );

    expect(html).toContain("Device pairing is hidden in this alpha");
    expect(html).toContain("Back to Sync");
    expect(html).not.toContain("Scan QR Code");
  });

  it("opens a focused biometrics setup panel from security settings", () => {
    document.body.innerHTML = "<div id=\"root\"></div>";
    const container = document.getElementById("root");

    if (!container) {
      throw new Error("Expected test root container to exist");
    }

    const root = createRoot(container);

    act(() => {
      root.render(<SettingsDetailScreen pageId="security" />);
    });

    const buttons = Array.from(container.querySelectorAll("button"));
    const configureButton = buttons.find((button) =>
      button.textContent?.includes("Review protection status"),
    );

    expect(configureButton).toBeDefined();

    act(() => {
      configureButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("Protection status");
    expect(container.textContent).toContain(
      "Require biometrics to open Track Wallet",
    );
    expect(
      container.querySelector(
        'button[aria-label="Require biometrics to open Track Wallet"]',
      ),
    ).toBeNull();

    act(() => {
      root.unmount();
    });
  });

  it("migrates a legacy security plan into the shared store and clears the plain localStorage key", () => {
    window.localStorage.setItem(
      LEGACY_SECURITY_PREFERENCES_STORAGE_KEY,
      JSON.stringify({
        biometricsEnabled: false,
        requireBiometricOnOpen: false,
        requireBiometricOnApprove: true,
        requireBiometricOnDelete: false,
        requireBiometricOnForwarding: true,
        twoFactorEnabled: false,
      }),
    );

    const html = renderToStaticMarkup(
      <SettingsDetailScreen pageId="security" />,
    );

    expect(html).toContain("Read-only status");
    expect(transactionStore.getState().securityPreferences).toMatchObject({
      biometricsEnabled: false,
      requireBiometricOnOpen: false,
      requireBiometricOnApprove: true,
      requireBiometricOnDelete: false,
      requireBiometricOnForwarding: true,
      twoFactorEnabled: false,
    });
    expect(
      window.localStorage.getItem(LEGACY_SECURITY_PREFERENCES_STORAGE_KEY),
    ).toBeNull();
  });

  it("renders blocked security treatments instead of live-looking toggles", () => {
    document.body.innerHTML = "<div id=\"root\"></div>";
    const container = document.getElementById("root");

    if (!container) {
      throw new Error("Expected test root container to exist");
    }

    const root = createRoot(container);

    act(() => {
      root.render(<SettingsDetailScreen pageId="security" />);
    });

    expect(container.textContent).toContain("Blocked until native prompts");
    expect(container.textContent).toContain("Coming soon");
    expect(container.textContent).not.toContain("Sign out of all devices");
    expect(container.textContent).not.toContain("Revoke");
    expect(
      container
        .querySelector<HTMLButtonElement>('button[aria-label="Use biometric login"]'),
    ).toBeNull();
    expect(
      container
        .querySelector<HTMLButtonElement>(
          'button[aria-label="Require 2-step verification"]',
        ),
    ).toBeNull();

    act(() => {
      root.unmount();
    });
  });

  it("supports adding live sender rules from SMS capture settings", async () => {
    document.body.innerHTML = "<div id=\"root\"></div>";
    const container = document.getElementById("root");

    if (!container) {
      throw new Error("Expected test root container to exist");
    }

    const root = createRoot(container);

    await act(async () => {
      root.render(<SettingsDetailScreen pageId="forwarding" />);
      await flushAsyncWork();
    });

    const senderInput = container.querySelector<HTMLInputElement>(
      'input[aria-label="New sender label"]',
    );
    const addSenderButton = Array.from(
      container.querySelectorAll("button"),
    ).find((button) => button.textContent?.includes("Add sender"));

    expect(senderInput).toBeDefined();
    expect(addSenderButton).toBeDefined();
    expect(container.textContent).toContain("SMS Capture & Routing");

    act(() => {
      updateInputValue(senderInput!, "CBE");
    });

    act(() => {
      addSenderButton?.dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });

    expect(container.textContent).toContain("CBE");
    expect(container.textContent).toContain(
      "Sender rule added to the live capture settings.",
    );

    act(() => {
      root.unmount();
    });
  });

  it("records historical SMS intent instead of pretending native backfill already works", async () => {
    document.body.innerHTML = "<div id=\"root\"></div>";
    const container = document.getElementById("root");

    if (!container) {
      throw new Error("Expected test root container to exist");
    }

    const root = createRoot(container);

    await act(async () => {
      root.render(<SettingsDetailScreen pageId="forwarding" />);
      await flushAsyncWork();
    });

    const lookbackInput = container.querySelector<HTMLInputElement>(
      'input[type="number"]',
    );
    const recordRequestButton = Array.from(
      container.querySelectorAll("button"),
    ).find((button) => button.textContent?.includes("Record history request"));

    expect(lookbackInput).toBeDefined();
    expect(recordRequestButton).toBeDefined();
    expect(container.textContent).toContain("Historical SMS request");
    expect(container.textContent).toContain(
      "This build does not implement historical SMS ingestion yet.",
    );

    act(() => {
      updateInputValue(lookbackInput!, "90");
    });

    act(() => {
      recordRequestButton?.dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });

    expect(transactionStore.getState().smsCaptureBackfillRequest).toMatchObject({
      lookbackDays: 90,
      status: "requested",
    });
    expect(container.textContent).toContain(
      "Recorded a 90-day history request. This build does not implement historical SMS ingestion yet.",
    );

    act(() => {
      root.unmount();
    });
  });

  it("clears finance-linked local preferences, parser authority state, and the legacy parser workspace key", () => {
    vi.useFakeTimers();
    window.localStorage.setItem("trackwallet.mobile.default-account-id", "acct-demo");
    window.localStorage.setItem(
      "trackwallet.mobile.account-order",
      JSON.stringify(["acct-demo"]),
    );
    window.localStorage.setItem(
      "trackwallet.mobile.budget-workspace-v1",
      JSON.stringify({
        version: 1,
        visibleBudgetIds: ["budget-food"],
        limitOverrides: {
          "budget-food": 88000,
        },
      }),
    );
    window.localStorage.setItem(
      "trackwallet.mobile.parser-workspace",
      JSON.stringify({
        version: 3,
        templateWorkspace: {
          templates: [],
        },
        selectedTemplateId: "",
        senderLabel: "CBE",
        strictSchemaParsing: false,
        preserveRawSms: true,
        autoReconciliation: true,
        verboseLogging: false,
      }),
    );
    transactionStore.getState().setParserWorkspaceAuthorityState({
      version: 1,
      templateWorkspace: {
        version: 3,
        builtInOverrides: [],
        accountBindings: [],
        customTemplates: [],
      },
      selectedTemplateId: "parser-authority-template",
      senderLabel: "CBE",
      strictSchemaParsing: false,
      preserveRawSms: true,
      autoReconciliation: true,
      verboseLogging: false,
    });

    document.body.innerHTML = "<div id=\"root\"></div>";
    const container = document.getElementById("root");

    if (!container) {
      throw new Error("Expected test root container to exist");
    }

    const root = createRoot(container);

    act(() => {
      root.render(<SettingsDetailScreen pageId="dataStorage" />);
    });

    const revealButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Show advanced tools"),
    );

    expect(revealButton).toBeDefined();
    expect(container.textContent).not.toContain("Clear local data");

    act(() => {
      revealButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const clearButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Clear local data"),
    );

    expect(clearButton).toBeDefined();

    act(() => {
      clearButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      vi.advanceTimersByTime(400);
    });

    expect(window.localStorage.getItem("trackwallet.mobile.default-account-id")).toBeNull();
    expect(window.localStorage.getItem("trackwallet.mobile.account-order")).toBeNull();
    expect(window.localStorage.getItem("trackwallet.mobile.budget-workspace-v1")).toBeNull();
    expect(window.localStorage.getItem("trackwallet.mobile.parser-workspace")).toBeNull();
    expect(transactionStore.getState().parserWorkspaceAuthorityState).toBeNull();

    act(() => {
      root.unmount();
    });
  });

  it("opens the parsing preview workspace and routes a preview sample into Inbox", async () => {
    document.body.innerHTML = "<div id=\"root\"></div>";
    const container = document.getElementById("root");

    if (!container) {
      throw new Error("Expected test root container to exist");
    }

    transactionStore.getState().addSmsSenderRule("CBE");
    transactionStore.getState().enqueueCapturedSms({
      messageId: "capture-001",
      senderLabel: "CBE",
      smsBody:
        "CBE ALERT: Your account 4920 was debited with ETB 450.00 on 2026-04-29 at GROCERY STORE. Bal ETB 8450.00",
      receivedAt: "2026-05-02T10:00:00.000Z",
    });

    const root = createRoot(container);

    await act(async () => {
      root.render(<SettingsDetailScreen pageId="parsing" />);
      await flushAsyncWork();
    });

    const previewTabButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Preview"),
    );

    expect(previewTabButton).toBeDefined();

    await act(async () => {
      previewTabButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await flushAsyncWork();
    });

    expect(container.textContent).toContain("Latest captured SMS");
    expect(container.textContent).toContain("Matched template");
    expect(container.textContent).toContain("CBE Debit Alert");

    const queueButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Queue to Inbox"),
    );

    expect(queueButton).toBeDefined();

    await act(async () => {
      queueButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await flushAsyncWork();
    });

    expect(container.textContent).toContain(
      "Preview routed into Inbox as a reviewable draft.",
    );

    act(() => {
      root.unmount();
    });
  });

});
