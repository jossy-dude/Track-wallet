import { useMemo, useState } from "react";

import type { ApprovedTransaction } from "@omni-sync/core";
import { MaterialSymbol, type BudgetCategorySnapshot } from "@omni-sync/ui";

interface LedgerScreenProps {
  netFlowDisplay: string;
  incomeDisplay: string;
  outflowDisplay: string;
  totalBalanceDisplay: string;
  budgetCards: readonly BudgetCategorySnapshot[];
  recentApprovedActivity: readonly unknown[];
  approvedTransactions?: readonly ApprovedTransaction[];
}

type LedgerFilter = "all" | "credits" | "debits";

const categoryIconMap: Record<ApprovedTransaction["category"], string> = {
  food: "restaurant",
  transport: "directions_car",
  housing: "home",
  income: "payments",
  entertainment: "theater_comedy",
  misc: "category",
};

function formatAmount(transaction: ApprovedTransaction): string {
  const signedMinor =
    transaction.transactionDirection === "credit"
      ? transaction.amountMinor
      : -1 * (transaction.amountMinor + transaction.feeMinor);
  const sign = signedMinor >= 0 ? "+" : "-";
  return `${sign}ETB ${Math.abs(signedMinor / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function LedgerScreen({
  netFlowDisplay,
  incomeDisplay,
  outflowDisplay,
  totalBalanceDisplay,
  approvedTransactions = [],
}: LedgerScreenProps) {
  const [activeFilter, setActiveFilter] = useState<LedgerFilter>("all");

  const filteredTransactions = useMemo(() => {
    const sorted = approvedTransactions
      .slice()
      .sort(
        (left, right) =>
          new Date(right.approvedAt).getTime() -
          new Date(left.approvedAt).getTime(),
      );

    if (activeFilter === "credits") {
      return sorted.filter(
        (transaction) => transaction.transactionDirection === "credit",
      );
    }

    if (activeFilter === "debits") {
      return sorted.filter(
        (transaction) => transaction.transactionDirection !== "credit",
      );
    }

    return sorted;
  }, [activeFilter, approvedTransactions]);

  return (
    <section className="space-y-8">
      <section className="rounded-[24px] bg-surface-container-low p-6 shadow-[0_4px_20px_rgba(46,50,48,0.06)]">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-on-surface-variant">
              Ledger view
            </p>
            <h2 className="font-headline text-3xl font-semibold tracking-tight text-on-surface">
              Approved transactions
            </h2>
            <p className="max-w-xl text-sm text-on-surface-variant">
              Browse the entries that already made it through Inbox approval and
              now shape balances, categories, and account history.
            </p>
          </div>
          <div className="rounded-full bg-primary-container/30 p-3 text-primary">
            <MaterialSymbol className="text-[24px]" filled name="receipt_long" />
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-2xl bg-surface px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
              Net flow
            </p>
            <p className="mt-2 font-headline text-2xl text-on-surface">
              {netFlowDisplay}
            </p>
          </article>
          <article className="rounded-2xl bg-surface px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
              Income
            </p>
            <p className="mt-2 font-headline text-2xl text-on-surface">
              {incomeDisplay}
            </p>
          </article>
          <article className="rounded-2xl bg-surface px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
              Outflow
            </p>
            <p className="mt-2 font-headline text-2xl text-on-surface">
              {outflowDisplay}
            </p>
          </article>
          <article className="rounded-2xl bg-surface px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
              Balance
            </p>
            <p className="mt-2 font-headline text-2xl text-on-surface">
              {totalBalanceDisplay}
            </p>
          </article>
        </div>
      </section>

      <section className="rounded-[24px] border border-outline-variant/20 bg-surface-container-lowest p-5 shadow-[0_4px_20px_rgba(46,50,48,0.06)]">
        <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="font-headline text-2xl font-semibold text-on-surface">
              Ledger filters
            </h3>
            <p className="mt-2 text-sm text-on-surface-variant">
              Narrow the feed by direction before drilling into the approved
              transaction trail.
            </p>
          </div>
          <div className="flex overflow-hidden rounded-2xl border border-outline-variant/20 bg-surface">
            {([
              { id: "all", label: "All" },
              { id: "credits", label: "Credits" },
              { id: "debits", label: "Debits" },
            ] as const).map((option) => (
              <button
                className={`px-4 py-3 text-sm font-semibold ${
                  activeFilter === option.id
                    ? "bg-primary-container/20 text-primary"
                    : "text-on-surface-variant"
                }`}
                key={option.id}
                onClick={() => setActiveFilter(option.id)}
                type="button"
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          {filteredTransactions.length > 0 ? (
            filteredTransactions.map((transaction) => (
              <article
                className="rounded-2xl border border-outline-variant/20 bg-surface p-4"
                key={transaction.transactionId}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-container text-primary">
                      <MaterialSymbol
                        filled
                        name={categoryIconMap[transaction.category]}
                      />
                    </div>
                    <div>
                      <p className="font-semibold text-on-surface">
                        {transaction.title}
                      </p>
                      <p className="mt-1 text-xs text-on-surface-variant">
                        {transaction.senderLabel} • {transaction.accountReference}
                      </p>
                      <p className="mt-2 text-xs text-on-surface-variant">
                        Approved{" "}
                        {new Date(transaction.approvedAt).toLocaleString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p
                      className={`font-semibold ${
                        transaction.transactionDirection === "credit"
                          ? "text-primary"
                          : "text-on-surface"
                      }`}
                    >
                      {formatAmount(transaction)}
                    </p>
                    <p className="mt-1 text-xs text-on-surface-variant">
                      {transaction.category}
                    </p>
                  </div>
                </div>
              </article>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-outline-variant bg-surface-container-low p-4 text-sm text-on-surface-variant">
              No approved entries match this filter yet.
            </div>
          )}
        </div>
      </section>
    </section>
  );
}
