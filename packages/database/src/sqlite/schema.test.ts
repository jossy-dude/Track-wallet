import { describe, expect, it } from "vitest";

import { selectSQLiteMode } from "./mode";
import {
  rawMessages,
  transactions,
  reconciliationItems,
  sqliteSchema,
} from "./schema";

describe("sqlite schema scaffold", () => {
  it("exposes the authority tables needed for reconciliation-first finance", () => {
    expect(Object.keys(sqliteSchema)).toEqual([
      "rawMessages",
      "inboxDrafts",
      "accounts",
      "transactions",
      "reconciliationItems",
      "budgetRules",
      "trustedDevices",
      "syncActivity",
    ]);
  });

  it("keeps reported balances available on ledger and reconciliation records", () => {
    expect(rawMessages.rawMessageId.name).toBe("raw_message_id");
    expect(transactions.reportedBalanceMinor.name).toBe("reported_balance_minor");
    expect(reconciliationItems.reportedBalanceMinor.name).toBe(
      "reported_balance_minor",
    );
  });

  it("defaults unknown mode selection to demo for safe local preview", () => {
    expect(selectSQLiteMode()).toBe("demo");
    expect(selectSQLiteMode({ mode: "real", allowReal: true })).toBe("real");
  });
});
