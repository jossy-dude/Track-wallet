import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AccountSummary, ApprovedTransaction } from "@omni-sync/core";
import { transactionStore } from "@omni-sync/database";
import type { BalanceBreakdownItem } from "@omni-sync/ui";

import { CardsScreen } from "./CardsScreen";

const accountSummaries: AccountSummary[] = [
  {
    accountId: "acct-cbe",
    institutionName: "Commercial Bank of Ethiopia",
    maskedAccountNumber: "**** 4920",
    balanceMinor: 1245000,
    currencyCode: "ETB",
    channel: "bank",
    iconName: "account_balance",
    tone: "primary",
  },
  {
    accountId: "acct-dashen",
    institutionName: "Dashen Bank",
    maskedAccountNumber: "**** 7788",
    balanceMinor: 865000,
    currencyCode: "ETB",
    channel: "bank",
    iconName: "savings",
    tone: "tertiary",
  },
  {
    accountId: "acct-telebirr",
    institutionName: "Telebirr",
    maskedAccountNumber: "**** 0172",
    balanceMinor: 332000,
    currencyCode: "ETB",
    channel: "mobile_money",
    iconName: "account_balance_wallet",
    tone: "secondary",
  },
  {
    accountId: "acct-cash",
    institutionName: "House Cash",
    maskedAccountNumber: "Manual cash reserve",
    balanceMinor: 118000,
    currencyCode: "ETB",
    channel: "cash",
    iconName: "payments",
    tone: "secondary",
  },
];

const accountCards = accountSummaries.map((account) => ({
  id: account.accountId,
  institutionName: account.institutionName,
  balanceDisplay: `ETB ${(account.balanceMinor / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`,
  maskedAccountNumber: account.maskedAccountNumber,
  icon: account.iconName,
  tone: account.tone,
}));

const balanceBreakdownItems: BalanceBreakdownItem[] = [
  {
    id: "bank",
    label: "Banks",
    amountDisplay: "ETB 21,100.00",
    icon: "account_balance",
    tone: "primary",
  },
  {
    id: "mobile-money",
    label: "Mobile",
    amountDisplay: "ETB 3,320.00",
    icon: "phone_iphone",
    tone: "tertiary",
  },
  {
    id: "cash",
    label: "Cash",
    amountDisplay: "ETB 1,180.00",
    icon: "payments",
    tone: "secondary",
  },
];

const approvedTransactions: ApprovedTransaction[] = [
  {
    transactionId: "tx-salary",
    approvedAt: "2026-04-18T09:00:00.000Z",
    draftId: "draft-salary",
    rawMessageId: "raw-salary",
    senderLabel: "CBE",
    rawBody: "Salary alert",
    financialInstitution: "cbe",
    transactionDirection: "credit",
    amountMinor: 250000,
    feeMinor: 0,
    runningBalanceMinor: 1040000,
    currencyCode: "ETB",
    title: "Salary",
    merchantName: "ACME PLC",
    category: "income",
    parserTemplateId: "seed-income",
    confidence: 100,
    occurredAt: "2026-04-18T00:00:00.000Z",
    accountReference: "4920",
    accountChannel: "bank",
    note: "Payroll",
    approvalStatus: "approved",
  },
  {
    transactionId: "tx-fuel",
    approvedAt: "2026-04-20T09:00:00.000Z",
    draftId: "draft-fuel",
    rawMessageId: "raw-fuel",
    senderLabel: "Dashen",
    rawBody: "Fuel payment",
    financialInstitution: "dashen",
    transactionDirection: "debit",
    amountMinor: 65000,
    feeMinor: 0,
    runningBalanceMinor: 351000,
    currencyCode: "ETB",
    title: "Fuel Station",
    merchantName: "FUEL STATION",
    category: "transport",
    parserTemplateId: "seed-transport",
    confidence: 100,
    occurredAt: "2026-04-20T00:00:00.000Z",
    accountReference: "7788",
    accountChannel: "bank",
    note: "Vehicle fuel",
    approvalStatus: "approved",
  },
  {
    transactionId: "tx-coffee",
    approvedAt: "2026-04-19T09:00:00.000Z",
    draftId: "draft-coffee",
    rawMessageId: "raw-coffee",
    senderLabel: "Telebirr",
    rawBody: "Cafe payment",
    financialInstitution: "telebirr",
    transactionDirection: "debit",
    amountMinor: 32000,
    feeMinor: 0,
    runningBalanceMinor: 188000,
    currencyCode: "ETB",
    title: "Coffee Shop",
    merchantName: "COFFEE SHOP",
    category: "food",
    parserTemplateId: "seed-food",
    confidence: 100,
    occurredAt: "2026-04-19T00:00:00.000Z",
    accountReference: "0172",
    accountChannel: "mobile_money",
    note: "Morning spend",
    approvalStatus: "approved",
  },
];

function setInputValue(
  element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
  value: string,
) {
  const prototype =
    element instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : element instanceof HTMLSelectElement
        ? HTMLSelectElement.prototype
        : HTMLInputElement.prototype;
  const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");

  descriptor?.set?.call(element, value);
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

describe("CardsScreen", () => {
  beforeEach(() => {
    transactionStore.getState().clearAllData();
    window.localStorage.clear();
  });

  afterEach(() => {
    Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("renders the redesigned account workspace with graph, account creation, parser setup, and account detail sheet", () => {
    Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true);
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-01T12:00:00.000Z"));

    document.body.innerHTML = "<div id=\"root\"></div>";
    const container = document.getElementById("root");

    if (!container) {
      throw new Error("Expected test root container to exist");
    }

    const root = createRoot(container);

    act(() => {
      root.render(
        <CardsScreen
          accountCards={accountCards}
          accountCount={accountSummaries.length}
          accountSummaries={accountSummaries}
          approvedTransactions={approvedTransactions}
          balanceBreakdownItems={balanceBreakdownItems}
          defaultAccountId="acct-cbe"
          onEditApprovedTransaction={() => undefined}
          onOpenCategoryWindow={() => undefined}
          topBalanceDisplay="ETB 12.5K"
          topInstitutionHeadline="Commercial Bank of Ethiopia leads your balances"
          totalBalanceDisplay="ETB 24,620.00"
          visibleChannelCount={3}
        />,
      );
    });

    expect(container.textContent).toContain("Account allocation");
    expect(container.textContent).toContain("Tap a share chip to filter the pocket cards.");
    expect(container.textContent).toContain("Cash flow");
    expect(container.textContent).toContain(
      "Graph-first view with advanced filtering kept behind one control.",
    );
    expect(container.textContent).toContain("Banks");
    expect(container.textContent).toContain("Mobile");
    expect(container.textContent).toContain("Cash");
    expect(container.textContent).toContain("Banks share");
    expect(container.textContent).toContain("Mobile share");
    expect(container.textContent).toContain("Cash share");
    expect(container.textContent).not.toContain("Balance ladder");
    expect(container.textContent).not.toContain("Account health snapshot");

    const bankSection = container.querySelector("#accounts-section-banks");
    const addButton = bankSection
      ? Array.from(bankSection.querySelectorAll("button")).find(
          (button) => button.textContent?.includes("Add"),
        )
      : null;

    act(() => {
      addButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("Create account");
    expect(container.textContent).toContain("Start with the basics");
    expect(container.textContent).toContain("SMS matching (optional)");
    expect(container.textContent).toContain("Advanced parser setup");
    expect(container.textContent).toContain(
      "You can create the account now and refine SMS matching later.",
    );

    const institutionInput = container.querySelector(
      'input[name="institutionName"]',
    ) as HTMLInputElement | null;
    const balanceInput = container.querySelector(
      'input[name="balance"]',
    ) as HTMLInputElement | null;
    const descriptionInput = container.querySelector(
      'textarea[name="description"]',
    ) as HTMLTextAreaElement | null;
    const accountReferenceInput = container.querySelector(
      'input[name="accountReference"]',
    ) as HTMLInputElement | null;

    expect(institutionInput).not.toBeNull();
    expect(balanceInput).not.toBeNull();
    expect(descriptionInput).not.toBeNull();
    expect(accountReferenceInput).not.toBeNull();

    act(() => {
      if (institutionInput) {
        setInputValue(institutionInput, "Commercial Bank of Ethiopia");
      }
      if (balanceInput) {
        setInputValue(balanceInput, "2450");
      }
      if (accountReferenceInput) {
        setInputValue(accountReferenceInput, "100023914920");
      }
      if (descriptionInput) {
        setInputValue(descriptionInput, "Emergency reserve");
      }
    });

    const createDraftButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("Create account"),
    );

    expect(createDraftButton).toBeDefined();

    act(() => {
      createDraftButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("Commercial Bank of Ethiopia");
    expect(container.textContent).toContain("Emergency reserve");
    expect(transactionStore.getState().customAccounts).toHaveLength(1);
    const createdAccount = transactionStore.getState().customAccounts[0];

    expect(createdAccount?.fullAccountNumber).toBe(
      "100023914920",
    );

    expect(
      transactionStore.getState().parserWorkspaceAuthorityState,
    ).toMatchObject({
      version: 1,
      selectedTemplateId: expect.any(String),
      senderLabel: "CBE",
      templateWorkspace: expect.objectContaining({
        accountBindings: expect.arrayContaining([
          expect.objectContaining({
            accountId: createdAccount?.accountId,
          }),
        ]),
      }),
    });
    expect(
      window.localStorage.getItem("trackwallet.mobile.parser-workspace"),
    ).toBeNull();

    const accountButton = Array.from(
      container.querySelectorAll<HTMLElement>('[role="button"]'),
    ).find(
      (button) =>
        button.textContent?.includes("Dashen Bank") &&
        button.textContent?.includes("Tracked account"),
    );

    expect(accountButton).toBeDefined();

    act(() => {
      accountButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("Balance history");
    expect(container.textContent).toContain("Transactions");
    expect(container.textContent).toContain("Fuel Station");
    expect(container.textContent).toContain("Touch a point");

    const chartSurface = container.querySelector(
      '[data-testid="accounts-line-chart-surface"]',
    ) as HTMLDivElement | null;

    expect(chartSurface).not.toBeNull();

    act(() => {
      chartSurface?.dispatchEvent(
        new MouseEvent("pointerdown", {
          bubbles: true,
          clientX: 240,
          clientY: 40,
        }),
      );
    });

    expect(container.textContent).toContain("Pinned");

    const debitFilterButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Debits",
    );

    expect(debitFilterButton).toBeDefined();

    act(() => {
      debitFilterButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("Fuel Station");
    expect(container.textContent).not.toContain("Salary");

    act(() => {
      root.unmount();
    });
  });

  it("replaces the graph-heavy empty analytics state with first-account guidance when there is no activity yet", () => {
    Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true);
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-01T12:00:00.000Z"));

    document.body.innerHTML = "<div id=\"root\"></div>";
    const container = document.getElementById("root");

    if (!container) {
      throw new Error("Expected test root container to exist");
    }

    const root = createRoot(container);

    act(() => {
      root.render(
        <CardsScreen
          accountCards={[]}
          accountCount={0}
          accountSummaries={[]}
          approvedTransactions={[]}
          balanceBreakdownItems={[]}
          defaultAccountId={null}
          onEditApprovedTransaction={() => undefined}
          onOpenCategoryWindow={() => undefined}
          topBalanceDisplay="ETB 0.00"
          topInstitutionHeadline="No accounts yet"
          totalBalanceDisplay="ETB 0.00"
          visibleChannelCount={0}
        />,
      );
    });

    expect(container.textContent).toContain("Build your account list first");
    expect(container.textContent).toContain("Add your first account");
    expect(container.textContent).not.toContain("Cash flow");
    expect(container.querySelector('[data-testid="accounts-line-chart-surface"]')).toBeNull();

    act(() => {
      root.unmount();
    });
  });
});
