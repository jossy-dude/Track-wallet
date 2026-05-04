import { describe, expect, it } from "vitest";

import type { ReconciliationItem } from "@omni-sync/core";

import { createMemorySqliteBinaryStorage } from "../sqlite/state-storage";
import { createNativeSqliteAuthorityAdapter } from "./native-sqlite-adapter";

function buildReconciliationItem(): ReconciliationItem {
  return {
    reconciliationItemId: "recon-001",
    accountId: "acct-cbe-4920",
    triggerTransactionId: "txn-001",
    triggerRawMessageId: "raw-001",
    expectedBalanceMinor: 985400,
    reportedBalanceMinor: 985700,
    deltaMinor: 300,
    status: "pending",
    resolutionKind: "bank_fee",
    createdAt: "2026-05-02T08:00:00.000Z",
    note: "Bank fee mismatch",
  };
}

describe("createNativeSqliteAuthorityAdapter", () => {
  it("bootstraps seeded reconciliation data into SQLite and can reset it", async () => {
    const binaryStorage = createMemorySqliteBinaryStorage();
    const seededItem = buildReconciliationItem();
    const adapter = createNativeSqliteAuthorityAdapter({
      mode: "real",
      reconciliationItems: [seededItem],
      binaryStorage,
    });

    const bootstrapResult = await adapter.bootstrap();

    expect(bootstrapResult.descriptor.bootstrapState).toBe("ready");
    expect(bootstrapResult.descriptor.capabilities.persistent).toBe(true);
    expect(bootstrapResult.descriptor.capabilities.supportsTransactions).toBe(true);
    expect(bootstrapResult.reconciliationItems).toEqual([seededItem]);

    const restartedAdapter = createNativeSqliteAuthorityAdapter({
      mode: "real",
      binaryStorage,
    });
    await restartedAdapter.bootstrap();

    expect(await restartedAdapter.listReconciliationItems()).toEqual([seededItem]);

    await restartedAdapter.reset();

    expect(await restartedAdapter.listReconciliationItems()).toEqual([]);
  });
});
