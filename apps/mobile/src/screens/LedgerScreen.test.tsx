import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";

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
];

describe("LedgerScreen", () => {
  it("filters the transaction ledger without falling back to the home activity feed", () => {
    document.body.innerHTML = "<div id=\"root\"></div>";
    const container = document.getElementById("root");

    if (!container) {
      throw new Error("Expected test root container to exist");
    }

    const root = createRoot(container);
    const props: any = {
      budgetCards: [],
      incomeDisplay: "ETB 2.5K",
      netFlowDisplay: "+ETB 1.9K",
      outflowDisplay: "ETB 970.00",
      recentApprovedActivity: [],
      totalBalanceDisplay: "ETB 15.8K",
      approvedTransactions,
    };

    act(() => {
      root.render(<LedgerScreen {...props} />);
    });

    expect(container.textContent).toContain("Ledger filters");
    expect(container.textContent).toContain("Coffee Shop");
    expect(container.textContent).toContain("Fuel Station");
    expect(container.textContent).toContain("Salary");
    expect(container.textContent).not.toContain("Recent Transactions");

    const creditButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("Credits"),
    );

    expect(creditButton).toBeDefined();

    act(() => {
      creditButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("Salary");
    expect(container.textContent).not.toContain("Coffee Shop");
    expect(container.textContent).not.toContain("Fuel Station");

    act(() => {
      root.unmount();
    });
  });
});
