import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { transactionStore } from "@omni-sync/database";

import { SettingsDetailScreen } from "./SettingsDetailScreen";

function updateInputValue(input: HTMLInputElement, value: string) {
  const valueSetter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )?.set;

  valueSetter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

beforeEach(() => {
  Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true);
  transactionStore.getState().clearAllData();
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
    expect(html).toContain("Color Accent");
    expect(html).toContain("Layout Density");
    expect(html).toContain("Navigation dock");
  });

  it("renders the parsing editor layout for the parsing destination", () => {
    const html = renderToStaticMarkup(
      <SettingsDetailScreen pageId="parsing" />,
    );

    expect(html).toContain("SMS Parsing Logic");
    expect(html).toContain("Templates");
    expect(html).toContain("Sandbox");
    expect(html).toContain("Diagnostics");
    expect(html).toContain("Regex Templates");
    expect(html).toContain("Extraction Function");
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
  });

  it("renders the redesigned data and storage management surface", () => {
    const html = renderToStaticMarkup(
      <SettingsDetailScreen pageId="dataStorage" />,
    );

    expect(html).toContain("Data &amp; Storage");
    expect(html).toContain("Database Management");
    expect(html).toContain("Export JSON Backup");
    expect(html).toContain("Data Integrity");
    expect(html).toContain("Logging");
    expect(html).toContain("Historical Import");
  });

  it("renders a dedicated account settings page", () => {
    const html = renderToStaticMarkup(
      <SettingsDetailScreen pageId="account" />,
    );

    expect(html).toContain("Manage Account");
    expect(html).toContain("Display name");
    expect(html).toContain("Description");
    expect(html).not.toContain("Workspace note");
    expect(html).toContain("Export personal data");
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
      button.textContent?.includes("Configure Biometrics"),
    );

    expect(configureButton).toBeDefined();

    act(() => {
      configureButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("Biometric unlock setup");
    expect(container.textContent).toContain(
      "Require biometrics to open Track Wallet",
    );

    act(() => {
      root.unmount();
    });
  });

  it("supports adding multiple peer recipients from forwarding settings", () => {
    document.body.innerHTML = "<div id=\"root\"></div>";
    const container = document.getElementById("root");

    if (!container) {
      throw new Error("Expected test root container to exist");
    }

    const root = createRoot(container);

    act(() => {
      root.render(<SettingsDetailScreen pageId="forwarding" />);
    });

    const recipientNameInput = container.querySelector<HTMLInputElement>(
      'input[aria-label="Recipient name"]',
    );
    const recipientPhoneInput = container.querySelector<HTMLInputElement>(
      'input[aria-label="Recipient phone"]',
    );
    const addRecipientButton = Array.from(
      container.querySelectorAll("button"),
    ).find((button) => button.textContent?.includes("Add recipient"));

    expect(recipientNameInput).toBeDefined();
    expect(recipientPhoneInput).toBeDefined();
    expect(addRecipientButton).toBeDefined();

    act(() => {
      updateInputValue(recipientNameInput!, "Finance partner");
      updateInputValue(recipientPhoneInput!, "+251911223344");
    });

    act(() => {
      addRecipientButton?.dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });

    expect(container.textContent).toContain("Finance partner");
    expect(container.textContent).toContain("+251911223344");

    act(() => {
      root.unmount();
    });
  });

  it("shows a focused parser editor and queueing state from parsing settings", () => {
    vi.useFakeTimers();
    document.body.innerHTML = "<div id=\"root\"></div>";
    const container = document.getElementById("root");

    if (!container) {
      throw new Error("Expected test root container to exist");
    }

    const root = createRoot(container);

    act(() => {
      root.render(<SettingsDetailScreen pageId="parsing" />);
    });

    const focusEditorButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Focus editor"),
    );
    const sandboxTabButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Sandbox"),
    );

    expect(focusEditorButton).toBeDefined();
    expect(sandboxTabButton).toBeDefined();

    act(() => {
      focusEditorButton?.dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });

    expect(
      container.querySelector('button[aria-label="Close panel"]'),
    ).toBeDefined();

    act(() => {
      container
        .querySelector<HTMLButtonElement>('button[aria-label="Close panel"]')
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    act(() => {
      sandboxTabButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const queueButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Queue to Inbox"),
    );

    expect(queueButton).toBeDefined();

    act(() => {
      queueButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("Queueing...");

    act(() => {
      vi.advanceTimersByTime(900);
    });

    expect(container.textContent).toContain(
      "Queued the parsed SMS and opened it in Inbox for review.",
    );

    act(() => {
      root.unmount();
    });
  });

  it("animates code-based device pairing and routes back to sync on success", () => {
    vi.useFakeTimers();
    document.body.innerHTML = "<div id=\"root\"></div>";
    const container = document.getElementById("root");

    if (!container) {
      throw new Error("Expected test root container to exist");
    }

    const root = createRoot(container);
    const onOpenPage = vi.fn();

    act(() => {
      root.render(
        <SettingsDetailScreen onOpenPage={onOpenPage} pageId="connect-device" />,
      );
    });

    const digits = ["2", "8", "4", "9", "1", "3"];
    const inputs = Array.from(
      container.querySelectorAll<HTMLInputElement>('input[aria-label^="Pairing digit"]'),
    );

    expect(inputs).toHaveLength(6);

    act(() => {
      inputs.forEach((input, index) => {
        updateInputValue(input, digits[index] ?? "");
      });
    });

    const connectButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("Connect"),
    );

    expect(connectButton).toBeDefined();

    act(() => {
      connectButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("Connecting...");

    act(() => {
      vi.advanceTimersByTime(700);
    });

    expect(container.textContent).toContain(
      "is now available as a local preview route in Sync.",
    );

    act(() => {
      vi.advanceTimersByTime(850);
    });

    expect(onOpenPage).toHaveBeenCalledWith("sync");

    act(() => {
      root.unmount();
    });
  });
});
