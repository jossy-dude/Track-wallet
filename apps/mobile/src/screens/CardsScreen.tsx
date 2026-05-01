import type { AccountSummary, ApprovedTransaction } from "@omni-sync/core";
import {
  MaterialSymbol,
  type AccountSummaryCardData,
  type AccountSurfaceTone,
  type BalanceBreakdownItem,
} from "@omni-sync/ui";

interface CardsScreenProps {
  topInstitutionHeadline: string;
  accountCount: number;
  topBalanceDisplay: string;
  visibleChannelCount: number;
  balanceBreakdownItems: readonly BalanceBreakdownItem[];
  totalBalanceDisplay: string;
  accountCards: readonly AccountSummaryCardData[];
  accountActivity: readonly unknown[];
  accountSummaries?: readonly AccountSummary[];
  approvedTransactions?: readonly ApprovedTransaction[];
}

const toneClassMap: Record<
  AccountSurfaceTone,
  {
    badge: string;
    icon: string;
  }
> = {
  primary: {
    badge: "bg-primary-container/30",
    icon: "text-primary",
  },
  tertiary: {
    badge: "bg-tertiary-container/30",
    icon: "text-tertiary",
  },
  secondary: {
    badge: "bg-secondary-container",
    icon: "text-secondary",
  },
  surface: {
    badge: "bg-surface-container-highest",
    icon: "text-on-surface-variant",
  },
};

function parseAmountDisplay(amountDisplay: string): number {
  const cleaned = amountDisplay.replace(/[^0-9.]/g, "");
  return cleaned.length > 0 ? Number(cleaned) : 0;
}

function getAccountGroupFromSummary(
  account: Pick<AccountSummary, "channel">,
): "Banks" | "Mobile Wallets" | "Cash" {
  if (account.channel === "mobile_money") {
    return "Mobile Wallets";
  }

  if (account.channel === "cash") {
    return "Cash";
  }

  return "Banks";
}

function formatAmountMinor(amountMinor: number): string {
  return `ETB ${(amountMinor / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function CardsScreen({
  topInstitutionHeadline,
  accountCount,
  topBalanceDisplay,
  visibleChannelCount,
  balanceBreakdownItems,
  totalBalanceDisplay,
  accountCards,
  accountSummaries = [],
  approvedTransactions = [],
}: CardsScreenProps) {
  const totalAllocation = balanceBreakdownItems.reduce(
    (sum, item) => sum + parseAmountDisplay(item.amountDisplay),
    0,
  );

  const groupedAccounts = {
    Banks: accountSummaries.filter(
      (account) => getAccountGroupFromSummary(account) === "Banks",
    ),
    "Mobile Wallets": accountSummaries.filter(
      (account) => getAccountGroupFromSummary(account) === "Mobile Wallets",
    ),
    Cash: accountSummaries.filter(
      (account) => getAccountGroupFromSummary(account) === "Cash",
    ),
  } as const;

  const incomeByAccount = accountSummaries.map((account) => {
    const incomeMinor = approvedTransactions.reduce((sum, transaction) => {
      if (
        transaction.accountReference &&
        account.maskedAccountNumber.includes(
          transaction.accountReference.slice(-4),
        ) &&
        transaction.transactionDirection === "credit"
      ) {
        return sum + transaction.amountMinor;
      }

      return sum;
    }, 0);

    return {
      id: account.accountId,
      label: account.institutionName,
      value: incomeMinor,
    };
  });

  const maxIncomeMinor = Math.max(
    1,
    ...incomeByAccount.map((entry) => entry.value),
  );
  const maxBalanceMinor = Math.max(
    1,
    ...accountSummaries.map((account) => account.balanceMinor),
  );
  const latestActivityLabel =
    approvedTransactions.length > 0
      ? approvedTransactions
          .slice()
          .sort(
            (left, right) =>
              new Date(right.approvedAt).getTime() -
              new Date(left.approvedAt).getTime(),
          )[0]?.approvedAt ?? null
      : null;

  return (
    <section className="space-y-8">
      <header className="rounded-[28px] border border-outline-variant/30 bg-surface-container-lowest p-6 shadow-[0_4px_20px_rgba(46,50,48,0.06)]">
        <p className="text-sm font-medium text-on-surface-variant">
          Total tracked balance
        </p>
        <h1 className="mt-2 font-headline text-3xl font-semibold tracking-tight text-on-surface">
          {totalBalanceDisplay}
        </h1>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-on-surface-variant">
          <span className="inline-flex items-center gap-1 text-primary">
            <MaterialSymbol className="text-sm" filled name="trending_up" />
            Lead balance {topBalanceDisplay}
          </span>
          <span>{accountCount} accounts</span>
          <span>{visibleChannelCount} active channels</span>
        </div>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-on-surface-variant">
          {topInstitutionHeadline}
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="rounded-[28px] border border-outline-variant/20 bg-surface-container-low p-6 shadow-[0_4px_20px_rgba(46,50,48,0.06)]">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-on-surface-variant">
                Distribution
              </p>
              <h2 className="font-headline text-2xl font-semibold text-on-surface">
                Account mix
              </h2>
            </div>
            <p className="font-bold text-primary">100% Total</p>
          </div>

          <div className="mb-6 flex h-3 w-full gap-1 overflow-hidden rounded-full">
            {balanceBreakdownItems.map((item) => {
              const numericAmount = parseAmountDisplay(item.amountDisplay);
              const width =
                totalAllocation > 0 ? (numericAmount / totalAllocation) * 100 : 0;

              return (
                <div
                  className={
                    item.tone === "primary"
                      ? "bg-primary"
                      : item.tone === "tertiary"
                        ? "bg-tertiary"
                        : "bg-outline-variant"
                  }
                  key={item.id}
                  style={{ width: `${width}%` }}
                />
              );
            })}
          </div>

          <div className="space-y-4">
            {balanceBreakdownItems.map((item) => {
              const numericAmount = parseAmountDisplay(item.amountDisplay);
              const percent =
                totalAllocation > 0
                  ? Math.round((numericAmount / totalAllocation) * 100)
                  : 0;

              return (
                <div className="flex items-center justify-between" key={item.id}>
                  <div className="flex items-center gap-2">
                    <div
                      className={`h-3 w-3 rounded-full ${
                        item.tone === "primary"
                          ? "bg-primary"
                          : item.tone === "tertiary"
                            ? "bg-tertiary"
                            : "bg-outline-variant"
                      }`}
                    />
                    <span className="font-medium text-on-surface-variant">
                      {item.label === "Mobile" ? "Wallets" : item.label}
                    </span>
                  </div>
                  <span className="font-bold text-on-surface">{percent}%</span>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-[28px] border border-outline-variant/20 bg-surface-container-low p-6 shadow-[0_4px_20px_rgba(46,50,48,0.06)]">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-on-surface-variant">
                Depth view
              </p>
              <h2 className="font-headline text-2xl font-semibold text-on-surface">
                Balance ladder
              </h2>
            </div>
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              Tracked
            </span>
          </div>

          <div className="space-y-4">
            {accountCards.map((account, index) => (
              <article key={account.id}>
                <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                  <span className="font-semibold text-on-surface">
                    {index + 1}. {account.institutionName}
                  </span>
                  <span className="font-semibold text-on-surface">
                    {account.balanceDisplay}
                  </span>
                </div>
                <div className="h-3 rounded-full bg-surface">
                  <div
                    className="h-3 rounded-full bg-primary"
                    style={{
                      width: `${Math.max(
                        10,
                        (parseAmountDisplay(account.balanceDisplay) /
                          (maxBalanceMinor / 100)) *
                          100,
                      )}%`,
                    }}
                  />
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="rounded-[28px] border border-outline-variant/20 bg-surface-container-low p-6 shadow-[0_4px_20px_rgba(46,50,48,0.06)]">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-on-surface-variant">
                Cash flow
              </p>
              <h2 className="font-headline text-2xl font-semibold text-on-surface">
                Income pulse
              </h2>
            </div>
            <MaterialSymbol className="text-primary" filled name="monitoring" />
          </div>
          <div className="space-y-4">
            {incomeByAccount.map((entry) => (
              <article className="grid gap-2" key={entry.id}>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold text-on-surface">
                    {entry.label}
                  </span>
                  <span className="text-on-surface-variant">
                    {formatAmountMinor(entry.value)}
                  </span>
                </div>
                <div className="h-14 overflow-hidden rounded-2xl bg-surface px-4 py-3">
                  <div className="flex h-full items-end gap-1">
                    {Array.from({ length: 10 }).map((_, index) => {
                      const height = Math.max(
                        18,
                        ((entry.value || 1) / maxIncomeMinor) *
                          100 *
                          (0.45 + index / 18),
                      );

                      return (
                        <div
                          className="w-full rounded-t-full bg-tertiary/70"
                          key={`${entry.id}-${index}`}
                          style={{ height: `${Math.min(100, height)}%` }}
                        />
                      );
                    })}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-[28px] border border-outline-variant/20 bg-surface-container-low p-6 shadow-[0_4px_20px_rgba(46,50,48,0.06)]">
          <h2 className="font-headline text-2xl font-semibold text-on-surface">
            Last active
          </h2>
          <p className="mt-2 text-sm leading-6 text-on-surface-variant">
            {latestActivityLabel
              ? `Most recent approved account activity landed ${new Date(
                  latestActivityLabel,
                ).toLocaleString("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}.`
              : "No approved account activity is available yet."}
          </p>

          <div className="mt-6 space-y-4">
            {(Object.entries(groupedAccounts) as Array<
              [keyof typeof groupedAccounts, readonly AccountSummary[]]
            >).map(([groupLabel, accounts]) =>
              accounts.length > 0 ? (
                <article
                  className="rounded-2xl bg-surface p-4 shadow-sm"
                  key={groupLabel}
                >
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-sm font-semibold uppercase tracking-[0.14em] text-on-surface-variant">
                      {groupLabel}
                    </p>
                    <span className="text-xs font-medium text-on-surface-variant">
                      {accounts.length} visible
                    </span>
                  </div>
                  <div className="space-y-3">
                    {accounts.map((account) => {
                      const cardTone =
                        accountCards.find((card) => card.id === account.accountId)
                          ?.tone ?? "surface";
                      const toneClasses = toneClassMap[cardTone];

                      return (
                        <div
                          className="flex items-center justify-between gap-3 rounded-2xl border border-outline-variant/20 px-3 py-3"
                          key={account.accountId}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`flex h-10 w-10 items-center justify-center rounded-full ${toneClasses.badge}`}
                            >
                              <MaterialSymbol
                                className={toneClasses.icon}
                                name={
                                  accountCards.find(
                                    (card) => card.id === account.accountId,
                                  )?.icon ?? "account_balance"
                                }
                              />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-on-surface">
                                {account.institutionName}
                              </p>
                              <p className="text-xs text-on-surface-variant">
                                {account.maskedAccountNumber}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold text-on-surface">
                              {formatAmountMinor(account.balanceMinor)}
                            </p>
                            <p className="text-[11px] text-on-surface-variant">
                              Channel: {account.channel}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </article>
              ) : null,
            )}
          </div>
        </section>
      </div>
    </section>
  );
}
