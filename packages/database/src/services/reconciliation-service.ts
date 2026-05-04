import type {
  ReconciliationItem,
  TransactionDirection,
} from "@omni-sync/core";

export interface ReconciliationComputationInput {
  reconciliationItemId: string;
  accountId: string;
  occurredAt: string;
  expectedStartingBalanceMinor: number | null;
  reportedBalanceMinor?: number | null;
  transactionId?: string;
  rawMessageId?: string;
  direction: TransactionDirection;
  amountMinor: number;
  feeMinor?: number;
  vatMinor?: number;
  serviceFeeMinor?: number;
  otherFeesMinor?: number;
  note?: string;
}

export interface ReconciliationComputationResult {
  expectedEndingBalanceMinor: number | null;
  ledgerDeltaMinor: number;
  feeTotalMinor: number;
  reconciliationItem: ReconciliationItem | null;
}

export function calculateFeeTotalMinor(
  input: Pick<
    ReconciliationComputationInput,
    "feeMinor" | "vatMinor" | "serviceFeeMinor" | "otherFeesMinor"
  >,
): number {
  const feeMinor = input.feeMinor ?? 0;
  const breakdownMinor =
    (input.vatMinor ?? 0) +
    (input.serviceFeeMinor ?? 0) +
    (input.otherFeesMinor ?? 0);

  return breakdownMinor > 0 ? breakdownMinor : feeMinor;
}

export function calculateLedgerDeltaMinor(
  input: Pick<
    ReconciliationComputationInput,
    "direction" | "amountMinor" | "feeMinor" | "vatMinor" | "serviceFeeMinor" | "otherFeesMinor"
  >,
): number {
  const feeTotalMinor = calculateFeeTotalMinor(input);

  if (input.direction === "credit") {
    return input.amountMinor;
  }

  return -1 * (input.amountMinor + feeTotalMinor);
}

export function calculateExpectedEndingBalanceMinor(
  input: Pick<
    ReconciliationComputationInput,
    | "expectedStartingBalanceMinor"
    | "direction"
    | "amountMinor"
    | "feeMinor"
    | "vatMinor"
    | "serviceFeeMinor"
    | "otherFeesMinor"
  >,
): number | null {
  if (input.expectedStartingBalanceMinor === null) {
    return null;
  }

  return (
    input.expectedStartingBalanceMinor + calculateLedgerDeltaMinor(input)
  );
}

export function buildPendingReconciliationItem(
  input: ReconciliationComputationInput,
): ReconciliationComputationResult {
  const feeTotalMinor = calculateFeeTotalMinor(input);
  const ledgerDeltaMinor = calculateLedgerDeltaMinor(input);
  const expectedEndingBalanceMinor = calculateExpectedEndingBalanceMinor(input);

  if (
    expectedEndingBalanceMinor === null ||
    input.reportedBalanceMinor === null ||
    input.reportedBalanceMinor === undefined
  ) {
    return {
      expectedEndingBalanceMinor,
      ledgerDeltaMinor,
      feeTotalMinor,
      reconciliationItem: null,
    };
  }

  if (expectedEndingBalanceMinor === input.reportedBalanceMinor) {
    return {
      expectedEndingBalanceMinor,
      ledgerDeltaMinor,
      feeTotalMinor,
      reconciliationItem: null,
    };
  }

  const deltaMinor = input.reportedBalanceMinor - expectedEndingBalanceMinor;

  return {
    expectedEndingBalanceMinor,
    ledgerDeltaMinor,
    feeTotalMinor,
    reconciliationItem: {
      reconciliationItemId: input.reconciliationItemId,
      accountId: input.accountId,
      triggerTransactionId: input.transactionId,
      triggerRawMessageId: input.rawMessageId,
      expectedBalanceMinor: expectedEndingBalanceMinor,
      reportedBalanceMinor: input.reportedBalanceMinor,
      deltaMinor,
      status: "pending",
      createdAt: input.occurredAt,
      note:
        input.note ??
        `Expected ${expectedEndingBalanceMinor} but bank reported ${input.reportedBalanceMinor}.`,
    },
  };
}
