import { describe, expect, it } from "vitest";

import {
  buildPendingReconciliationItem,
  calculateExpectedEndingBalanceMinor,
  calculateFeeTotalMinor,
  calculateLedgerDeltaMinor,
} from "./reconciliation-service";

describe("reconciliation-service", () => {
  it("treats debit and transfer transactions as outgoing balance changes", () => {
    expect(
      calculateLedgerDeltaMinor({
        direction: "debit",
        amountMinor: 12500,
        feeMinor: 300,
      }),
    ).toBe(-12800);

    expect(
      calculateLedgerDeltaMinor({
        direction: "transfer",
        amountMinor: 12500,
        feeMinor: 300,
      }),
    ).toBe(-12800);
  });

  it("prefers a detailed fee breakdown when one exists", () => {
    expect(
      calculateFeeTotalMinor({
        feeMinor: 575,
        serviceFeeMinor: 500,
        vatMinor: 75,
      }),
    ).toBe(575);
  });

  it("computes an expected ending balance from the previous known balance", () => {
    expect(
      calculateExpectedEndingBalanceMinor({
        expectedStartingBalanceMinor: 100000,
        direction: "debit",
        amountMinor: 12500,
        feeMinor: 300,
      }),
    ).toBe(87200);
  });

  it("creates a pending reconciliation item when the bank-reported total does not match", () => {
    const result = buildPendingReconciliationItem({
      reconciliationItemId: "recon-001",
      accountId: "acct-cbe-4920",
      transactionId: "txn-001",
      rawMessageId: "raw-001",
      occurredAt: "2026-05-01T10:00:00.000Z",
      expectedStartingBalanceMinor: 100000,
      reportedBalanceMinor: 87500,
      direction: "debit",
      amountMinor: 12500,
      feeMinor: 300,
    });

    expect(result.expectedEndingBalanceMinor).toBe(87200);
    expect(result.reconciliationItem).toMatchObject({
      accountId: "acct-cbe-4920",
      expectedBalanceMinor: 87200,
      reportedBalanceMinor: 87500,
      deltaMinor: 300,
      status: "pending",
    });
  });
});
