import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ApprovedTransaction } from "@omni-sync/core";

import { LedgerScreen } from "./LedgerScreen";

const approvedTransactions: ApprovedTransaction[] = [
  {
    transactionId: "tx-income",
    approvedAt: "2026-04-18T09:00:00.000Z",
    draftId: "draft-income",
    rawMessageId: "raw-income",
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
    transactionId: "tx-food",
    approvedAt: "2026-04-19T09:00:00.000Z",
    draftId: "draft-food",
    rawMessageId: "raw-food",
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
  {
    transactionId: "tx-transport",
    approvedAt: "2026-04-20T09:00:00.000Z",
    draftId: "draft-transport",
    rawMessageId: "raw-transport",
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
    accountReference: "1104",
    accountChannel: "bank",
    note: "Vehicle fuel",
    approvalStatus: "approved",
  },
  {
    transactionId: "tx-rent",
    approvedAt: "2026-01-11T09:00:00.000Z",
    draftId: "draft-rent",
    rawMessageId: "raw-rent",
    senderLabel: "Dashen",
    rawBody: "January rent paid",
    financialInstitution: "dashen",
    transactionDirection: "debit",
    amountMinor: 180000,
    feeMinor: 0,
    runningBalanceMinor: 521000,
    currencyCode: "ETB",
    title: "Rent",
    merchantName: "CITY TOWER",
    category: "housing",
    parserTemplateId: "seed-rent",
    confidence: 100,
    occurredAt: "2026-01-11T00:00:00.000Z",
    accountReference: "7788",
    accountChannel: "bank",
    note: "Apartment rent",
    approvalStatus: "approved",
  },
  {
    transactionId: "tx-bonus",
    approvedAt: "2025-11-18T09:00:00.000Z",
    draftId: "draft-bonus",
    rawMessageId: "raw-bonus",
    senderLabel: "BOA",
    rawBody: "Quarterly bonus",
    financialInstitution: "boa",
    transactionDirection: "credit",
    amountMinor: 90000,
    feeMinor: 0,
    runningBalanceMinor: 790000,
    currencyCode: "ETB",
    title: "Quarterly Bonus",
    merchantName: "ACME PLC",
    category: "income",
    parserTemplateId: "seed-bonus",
    confidence: 100,
    occurredAt: "2025-11-18T00:00:00.000Z",
    accountReference: "9912",
    accountChannel: "bank",
    note: "Legacy bonus",
    approvalStatus: "approved",
  },
];

describe("LedgerScreen", () => {
  beforeEach(() => {
    Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true);
  });

  afterEach(() => {
    vi.useRealTimers();
    Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
    document.body.innerHTML = "";
  });

  function renderLedgerScreen() {
    document.body.innerHTML = "<div id=\"root\"></div>";
    const container = document.getElementById("root");

    if (!container) {
      throw new Error("Expected test root container to exist");
    }

    const root = createRoot(container);
    const props = {
      incomeDisplay: "ETB 2.5K",
      netFlowDisplay: "+ETB 1.9K",
      outflowDisplay: "ETB 970.00",
      totalBalanceDisplay: "ETB 15.8K",
      approvedTransactions,
    };

    act(() => {
      root.render(<LedgerScreen {...props} />);
    });

    return { container, root };
  }

  function findButtonByText(container: HTMLElement, text: string) {
    return Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes(text),
    );
  }

  function findButtonByAriaLabel(container: HTMLElement, label: string) {
    return Array.from(container.querySelectorAll("button")).find(
      (button) => button.getAttribute("aria-label") === label,
    );
  }

  it("applies and clears staged advanced filters from the compact popover", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-01T12:00:00.000Z"));

    const { container, root } = renderLedgerScreen();

    expect(container.textContent).toContain("Ledger filters");
    expect(container.textContent).toContain("Coffee Shop");
    expect(container.textContent).toContain("Fuel Station");
    expect(container.textContent).toContain("Salary");
    expect(container.textContent).not.toContain("Rent");
    expect(container.textContent).not.toContain("Quarterly Bonus");
    expect(container.textContent).not.toContain("Recent Transactions");

    const sixMonthButton = findButtonByText(container, "6M");

    expect(sixMonthButton).toBeDefined();

    act(() => {
      sixMonthButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("Rent");
    expect(container.textContent).not.toContain("Quarterly Bonus");

    const debitButton = findButtonByText(container, "Debits");

    expect(debitButton).toBeDefined();

    act(() => {
      debitButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("Rent");
    expect(container.textContent).toContain("Coffee Shop");
    expect(container.textContent).not.toContain("Salary");

    const advancedFiltersButton = findButtonByAriaLabel(
      container,
      "Advanced filters",
    );

    expect(advancedFiltersButton).toBeDefined();

    act(() => {
      advancedFiltersButton?.dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });

    const advancedFilterPopover = container.querySelector(
      '[role="dialog"][aria-label="Advanced filters"]',
    );
    const searchInput = container.querySelector(
      'input[placeholder*="merchant"]',
    ) as HTMLInputElement | null;
    const categorySelect = container.querySelector(
      'select[aria-label="Filter by category"]',
    ) as HTMLSelectElement | null;
    const institutionSelect = container.querySelector(
      'select[aria-label="Filter by institution"]',
    ) as HTMLSelectElement | null;

    expect(advancedFilterPopover).not.toBeNull();
    expect(searchInput).not.toBeNull();
    expect(categorySelect).not.toBeNull();
    expect(institutionSelect).not.toBeNull();

    act(() => {
      if (searchInput) {
        searchInput.value = "rent";
        searchInput.dispatchEvent(new Event("input", { bubbles: true }));
        searchInput.dispatchEvent(new Event("change", { bubbles: true }));
      }
      if (categorySelect) {
        categorySelect.value = "housing";
        categorySelect.dispatchEvent(new Event("change", { bubbles: true }));
      }
      if (institutionSelect) {
        institutionSelect.value = "dashen";
        institutionSelect.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });

    expect(container.textContent).toContain("Rent");
    expect(container.textContent).toContain("Coffee Shop");
    expect(container.textContent).toContain("Fuel Station");

    const applyButton = findButtonByText(container, "Apply");

    expect(applyButton).toBeDefined();

    act(() => {
      applyButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("Rent");
    expect(container.textContent).not.toContain("Coffee Shop");
    expect(container.textContent).not.toContain("Fuel Station");
    expect(container.textContent).toContain("3 filters applied");

    act(() => {
      advancedFiltersButton?.dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });

    const clearFiltersButton = findButtonByText(container, "Clear");

    expect(clearFiltersButton).toBeDefined();

    act(() => {
      clearFiltersButton?.dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });

    expect(container.textContent).toContain("Rent");
    expect(container.textContent).toContain("Coffee Shop");
    expect(container.textContent).toContain("Fuel Station");
    expect(container.textContent).not.toContain("3 filters applied");

    act(() => {
      root.unmount();
    });
  });

  it("switches between list and calendar mode and shows the selected day activity", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-01T12:00:00.000Z"));

    const { container, root } = renderLedgerScreen();

    const calendarButton = findButtonByText(container, "Calendar");

    expect(calendarButton).toBeDefined();

    act(() => {
      calendarButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("April 2026");
    expect(container.textContent).toContain("Selected day");
    expect(container.textContent).toContain("Fuel Station");
    expect(container.textContent).not.toContain("Coffee Shop");

    const aprilNineteenButton = findButtonByAriaLabel(
      container,
      "Show transactions for April 19, 2026",
    );

    expect(aprilNineteenButton).toBeDefined();

    act(() => {
      aprilNineteenButton?.dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });

    expect(container.textContent).toContain("Coffee Shop");
    expect(container.textContent).not.toContain("Fuel Station");

    const listButton = findButtonByText(container, "List");

    expect(listButton).toBeDefined();

    act(() => {
      listButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("Coffee Shop");
    expect(container.textContent).toContain("Fuel Station");
    expect(container.textContent).toContain("Salary");

    act(() => {
      root.unmount();
    });
  });
});
