import { useEffect, useMemo, useState } from "react";

import {
  FINANCIAL_INSTITUTION_LABELS,
  TRANSACTION_CATEGORY_LABELS,
  type AccountChannel,
  type ApprovedTransaction,
  type FinancialInstitution,
  type TransactionCategory,
} from "@omni-sync/core";
import { MaterialSymbol } from "@omni-sync/ui";

import {
  MotionPage,
  MotionPanel,
  MotionStagger,
} from "../components/settingsMotionPrimitives";

interface LedgerScreenProps {
  netFlowDisplay: string;
  incomeDisplay: string;
  outflowDisplay: string;
  totalBalanceDisplay: string;
  showFirstUseGuidance?: boolean;
  approvedTransactions?: readonly ApprovedTransaction[];
  onEditApprovedTransaction?: (transactionId: string) => void;
}

type LedgerFilter = "all" | "credits" | "debits";
type LedgerRange = "1m" | "3m" | "6m" | "1y";
type LedgerViewMode = "list" | "calendar";

interface AdvancedLedgerFilters {
  searchQuery: string;
  category: "all" | TransactionCategory;
  institution: "all" | FinancialInstitution;
  channel: "all" | AccountChannel;
  minAmountBirr: string;
  maxAmountBirr: string;
}

interface CalendarDayCell {
  dateKey: string;
  dayNumber: number;
  label: string;
  transactionCount: number;
}

const categoryIconMap: Record<ApprovedTransaction["category"], string> = {
  food: "restaurant",
  transport: "directions_car",
  housing: "home",
  income: "payments",
  entertainment: "theater_comedy",
  misc: "category",
};

const rangeOptions: readonly { id: LedgerRange; label: string; months: number }[] = [
  { id: "1m", label: "1M", months: 1 },
  { id: "3m", label: "3M", months: 3 },
  { id: "6m", label: "6M", months: 6 },
  { id: "1y", label: "1Y", months: 12 },
];

const weekdayLabels = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"] as const;

const emptyAdvancedFilters: AdvancedLedgerFilters = {
  searchQuery: "",
  category: "all",
  institution: "all",
  channel: "all",
  minAmountBirr: "",
  maxAmountBirr: "",
};

function parseBirrToMinor(value: string): number | null {
  if (value.trim().length === 0) {
    return null;
  }

  const parsed = Number.parseFloat(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }

  return Math.round(parsed * 100);
}

function getRangeStart(range: LedgerRange): Date {
  const rangeConfig = rangeOptions.find((option) => option.id === range);
  const now = new Date();
  const start = new Date(now);

  if (!rangeConfig) {
    return start;
  }

  start.setMonth(start.getMonth() - rangeConfig.months);

  if (rangeConfig.months < 12 && start.getFullYear() < now.getFullYear()) {
    return new Date(now.getFullYear(), 0, 1);
  }

  return start;
}

function getAdvancedFilterCount(filters: AdvancedLedgerFilters): number {
  return [
    filters.searchQuery.trim().length > 0,
    filters.category !== "all",
    filters.institution !== "all",
    filters.channel !== "all",
    filters.minAmountBirr.trim().length > 0,
    filters.maxAmountBirr.trim().length > 0,
  ].filter(Boolean).length;
}

function getTransactionSignedMinor(transaction: ApprovedTransaction): number {
  return transaction.transactionDirection === "credit"
    ? transaction.amountMinor
    : -1 * (transaction.amountMinor + transaction.feeMinor);
}

function getTransactionFilterAmountMinor(transaction: ApprovedTransaction): number {
  return transaction.transactionDirection === "credit"
    ? transaction.amountMinor
    : transaction.amountMinor + transaction.feeMinor;
}

function formatTransactionAmount(transaction: ApprovedTransaction) {
  const signedMinor = getTransactionSignedMinor(transaction);
  const sign = signedMinor >= 0 ? "+" : "-";

  return {
    prefix: sign,
    value: Math.abs(signedMinor / 100).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }),
    suffix: transaction.currencyCode,
  };
}

function getDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getTransactionDateKey(transaction: ApprovedTransaction): string {
  return getDateKey(new Date(transaction.approvedAt));
}

function parseDateKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function getMonthStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function formatMonthLabel(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function formatCalendarButtonLabel(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatSelectedDayLabel(dateKey: string): string {
  return parseDateKey(dateKey).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatApprovedLabel(transaction: ApprovedTransaction): string {
  return new Date(transaction.approvedAt).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatChannelLabel(channel: AccountChannel): string {
  if (channel === "mobile_money") {
    return "Mobile money";
  }

  return channel.charAt(0).toUpperCase() + channel.slice(1);
}

function buildMonthGrid(
  monthStart: Date,
  transactionCountByDate: Map<string, number>,
): readonly (CalendarDayCell | null)[] {
  const firstDayOfMonth = new Date(monthStart.getFullYear(), monthStart.getMonth(), 1);
  const leadingBlankCount = (firstDayOfMonth.getDay() + 6) % 7;
  const daysInMonth = new Date(
    monthStart.getFullYear(),
    monthStart.getMonth() + 1,
    0,
  ).getDate();
  const cells: (CalendarDayCell | null)[] = Array.from(
    { length: leadingBlankCount },
    () => null,
  );

  for (let day = 1; day <= daysInMonth; day += 1) {
    const currentDate = new Date(monthStart.getFullYear(), monthStart.getMonth(), day);
    const dateKey = getDateKey(currentDate);

    cells.push({
      dateKey,
      dayNumber: day,
      label: formatCalendarButtonLabel(currentDate),
      transactionCount: transactionCountByDate.get(dateKey) ?? 0,
    });
  }

  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  return cells;
}

function LedgerSummaryCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <article className="rounded-[20px] bg-surface px-3 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
        {label}
      </p>
      <p className="mt-2 font-headline text-xl font-semibold tracking-tight text-on-surface">
        {value}
      </p>
    </article>
  );
}

function LedgerTransactionCard({
  transaction,
  onEditApprovedTransaction,
}: {
  transaction: ApprovedTransaction;
  onEditApprovedTransaction?: (transactionId: string) => void;
}) {
  const amount = formatTransactionAmount(transaction);

  return (
    <article
      className="rounded-2xl border border-outline-variant/20 bg-surface p-4"
      key={transaction.transactionId}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          {onEditApprovedTransaction ? (
            <button
              aria-label={`Edit ${transaction.title}`}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-container text-primary transition active:scale-[0.96]"
              onClick={() => onEditApprovedTransaction(transaction.transactionId)}
              type="button"
            >
              <MaterialSymbol filled name={categoryIconMap[transaction.category]} />
            </button>
          ) : (
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-container text-primary">
              <MaterialSymbol filled name={categoryIconMap[transaction.category]} />
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate font-semibold text-on-surface">
              {transaction.title}
            </p>
            <p className="mt-1 text-xs text-on-surface-variant">
              {FINANCIAL_INSTITUTION_LABELS[transaction.financialInstitution]} •{" "}
              {transaction.accountReference ?? "Unknown account"} •{" "}
              {formatChannelLabel(transaction.accountChannel)}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="rounded-full bg-surface-container px-2 py-1 text-[11px] font-semibold text-on-surface-variant">
                {TRANSACTION_CATEGORY_LABELS[transaction.category]}
              </span>
              <span className="rounded-full bg-surface-container px-2 py-1 text-[11px] font-semibold text-on-surface-variant">
                {transaction.senderLabel}
              </span>
              {transaction.note ? (
                <span className="rounded-full bg-surface-container px-2 py-1 text-[11px] font-semibold text-on-surface-variant">
                  {transaction.note}
                </span>
              ) : null}
            </div>
            <p className="mt-2 text-xs text-on-surface-variant">
              Approved {formatApprovedLabel(transaction)}
            </p>
          </div>
        </div>

        <div className="shrink-0 text-right">
          <p
            className={`inline-flex items-start gap-1 font-semibold ${
              transaction.transactionDirection === "credit"
                ? "text-primary"
                : "text-on-surface"
            }`}
          >
              <span className="relative top-[0.18em] text-[11px] font-semibold uppercase tracking-[0.1em]">
                {amount.prefix}
              </span>
              <span className="font-headline text-[1.35rem] leading-none tracking-tight tabular-nums">
                {amount.value}
              </span>
              <span className="relative top-[0.42em] text-[9px] font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
                {amount.suffix}
              </span>
            </p>
          </div>
        </div>
    </article>
  );
}

function renderTransactionList(
  transactions: readonly ApprovedTransaction[],
  emptyState: string,
  onEditApprovedTransaction?: (transactionId: string) => void,
) {
  if (transactions.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-outline-variant bg-surface-container-low p-4 text-sm text-on-surface-variant">
        {emptyState}
      </div>
    );
  }

  return transactions.map((transaction) => (
    <LedgerTransactionCard
      key={transaction.transactionId}
      onEditApprovedTransaction={onEditApprovedTransaction}
      transaction={transaction}
    />
  ));
}

export function LedgerScreen({
  netFlowDisplay,
  incomeDisplay,
  outflowDisplay,
  totalBalanceDisplay,
  showFirstUseGuidance = false,
  approvedTransactions = [],
  onEditApprovedTransaction,
}: LedgerScreenProps) {
  const [activeFilter, setActiveFilter] = useState<LedgerFilter>("all");
  const [activeRange, setActiveRange] = useState<LedgerRange>("1m");
  const [viewMode, setViewMode] = useState<LedgerViewMode>("list");
  const [isAdvancedFiltersOpen, setIsAdvancedFiltersOpen] = useState(false);
  const [advancedFilters, setAdvancedFilters] =
    useState<AdvancedLedgerFilters>(emptyAdvancedFilters);
  const [draftAdvancedFilters, setDraftAdvancedFilters] =
    useState<AdvancedLedgerFilters>(emptyAdvancedFilters);
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);

  const advancedFilterCount = useMemo(
    () => getAdvancedFilterCount(advancedFilters),
    [advancedFilters],
  );

  const filteredTransactions = useMemo(() => {
    const rangeStart = getRangeStart(activeRange).getTime();
    const minAmountMinor = parseBirrToMinor(advancedFilters.minAmountBirr);
    const maxAmountMinor = parseBirrToMinor(advancedFilters.maxAmountBirr);
    const normalizedSearch = advancedFilters.searchQuery.trim().toLowerCase();

    return approvedTransactions
      .slice()
      .sort(
        (left, right) =>
          new Date(right.approvedAt).getTime() - new Date(left.approvedAt).getTime(),
      )
      .filter((transaction) => new Date(transaction.approvedAt).getTime() >= rangeStart)
      .filter((transaction) => {
        if (activeFilter === "credits") {
          return transaction.transactionDirection === "credit";
        }

        if (activeFilter === "debits") {
          return transaction.transactionDirection !== "credit";
        }

        return true;
      })
      .filter((transaction) => {
        if (
          advancedFilters.category !== "all" &&
          transaction.category !== advancedFilters.category
        ) {
          return false;
        }

        if (
          advancedFilters.institution !== "all" &&
          transaction.financialInstitution !== advancedFilters.institution
        ) {
          return false;
        }

        if (
          advancedFilters.channel !== "all" &&
          transaction.accountChannel !== advancedFilters.channel
        ) {
          return false;
        }

        const totalAmountMinor = getTransactionFilterAmountMinor(transaction);

        if (minAmountMinor !== null && totalAmountMinor < minAmountMinor) {
          return false;
        }

        if (maxAmountMinor !== null && totalAmountMinor > maxAmountMinor) {
          return false;
        }

        if (normalizedSearch.length === 0) {
          return true;
        }

        const haystack = [
          transaction.title,
          transaction.merchantName,
          transaction.senderLabel,
          transaction.accountReference ?? "",
          transaction.note ?? "",
          transaction.rawBody,
        ]
          .join(" ")
          .toLowerCase();

        return haystack.includes(normalizedSearch);
      });
  }, [activeFilter, activeRange, advancedFilters, approvedTransactions]);

  const transactionsByDate = useMemo(() => {
    const nextMap = new Map<string, ApprovedTransaction[]>();

    filteredTransactions.forEach((transaction) => {
      const dateKey = getTransactionDateKey(transaction);
      const currentBucket = nextMap.get(dateKey);

      if (currentBucket) {
        currentBucket.push(transaction);
        return;
      }

      nextMap.set(dateKey, [transaction]);
    });

    return nextMap;
  }, [filteredTransactions]);

  const transactionCountByDate = useMemo(
    () =>
      new Map(
        Array.from(transactionsByDate.entries()).map(([dateKey, transactions]) => [
          dateKey,
          transactions.length,
        ]),
      ),
    [transactionsByDate],
  );

  useEffect(() => {
    if (filteredTransactions.length === 0) {
      setSelectedDateKey(null);
      return;
    }

    setSelectedDateKey(getTransactionDateKey(filteredTransactions[0]));
  }, [filteredTransactions]);

  const visibleMonth = useMemo(() => {
    if (selectedDateKey) {
      return getMonthStart(parseDateKey(selectedDateKey));
    }

    if (filteredTransactions.length > 0) {
      return getMonthStart(new Date(filteredTransactions[0].approvedAt));
    }

    return getMonthStart(new Date());
  }, [filteredTransactions, selectedDateKey]);

  const monthGrid = useMemo(
    () => buildMonthGrid(visibleMonth, transactionCountByDate),
    [transactionCountByDate, visibleMonth],
  );

  const selectedDayTransactions = selectedDateKey
    ? transactionsByDate.get(selectedDateKey) ?? []
    : [];

  function handleAdvancedFilterToggle() {
    if (isAdvancedFiltersOpen) {
      setDraftAdvancedFilters(advancedFilters);
      setIsAdvancedFiltersOpen(false);
      return;
    }

    setDraftAdvancedFilters(advancedFilters);
    setIsAdvancedFiltersOpen(true);
  }

  function handleAdvancedFilterApply() {
    setAdvancedFilters(draftAdvancedFilters);
    setIsAdvancedFiltersOpen(false);
  }

  function handleAdvancedFilterClear() {
    setDraftAdvancedFilters(emptyAdvancedFilters);
    setAdvancedFilters(emptyAdvancedFilters);
    setIsAdvancedFiltersOpen(false);
  }

  return (
    <MotionPage includeStyles className="space-y-6">
      <section className="space-y-6">
        <MotionPanel
          className="rounded-[24px] bg-surface-container-low px-5 py-5 shadow-[0_4px_20px_rgba(46,50,48,0.06)]"
          variant="hero"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-on-surface-variant">
                Ledger view
              </p>
              <h2 className="font-headline text-[1.75rem] font-semibold tracking-tight text-on-surface">
                Approved transactions
              </h2>
              <p className="max-w-xl text-sm text-on-surface-variant">
                Switch between list and calendar. Open advanced filters only
                when needed.
              </p>
            </div>
            <div className="rounded-full bg-primary-container/30 p-3 text-primary">
              <MaterialSymbol className="text-[22px]" filled name="receipt_long" />
            </div>
          </div>

          <MotionStagger className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-4" step={28}>
            <LedgerSummaryCard label="Net flow" value={netFlowDisplay} />
            <LedgerSummaryCard label="Income" value={incomeDisplay} />
            <LedgerSummaryCard label="Outflow" value={outflowDisplay} />
            <LedgerSummaryCard label="Balance" value={totalBalanceDisplay} />
          </MotionStagger>
        </MotionPanel>

        <MotionPanel
          className="rounded-[24px] border border-outline-variant/20 bg-surface-container-lowest p-5 shadow-[0_4px_20px_rgba(46,50,48,0.06)]"
          delay={80}
        >
          {showFirstUseGuidance ? (
            <div className="mb-5 rounded-[24px] border border-outline-variant/18 bg-surface px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-on-surface-variant">
                First approvals
              </p>
              <h3 className="mt-2 font-headline text-2xl font-semibold text-on-surface">
                Nothing approved yet
              </h3>
              <p className="mt-3 text-sm leading-6 text-on-surface-variant">
                Approved items land here after you review them in Inbox. Queue a
                manual entry or wait for SMS capture, then approve it to start
                your ledger history.
              </p>
            </div>
          ) : null}

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-headline text-[1.6rem] font-semibold text-on-surface">
                    Ledger filters
                  </h3>
                  <span className="rounded-full bg-surface px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-on-surface-variant">
                    {filteredTransactions.length} in view
                  </span>
                </div>
                <p className="max-w-xl text-sm text-on-surface-variant">
                  Quick filters first. Open the deeper stack only when needed.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="inline-flex rounded-full bg-surface p-1">
                  {([
                    { id: "list", label: "List", icon: "view_list" },
                    { id: "calendar", label: "Calendar", icon: "calendar_month" },
                  ] as const).map((option) => (
                    <button
                      className={`inline-flex min-h-10 items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold active:scale-95 ${
                        viewMode === option.id
                          ? "bg-primary text-on-primary"
                          : "text-on-surface-variant"
                      }`}
                      key={option.id}
                      onClick={() => setViewMode(option.id)}
                      type="button"
                    >
                      <MaterialSymbol className="text-[18px]" name={option.icon} />
                      {option.label}
                    </button>
                  ))}
                </div>

                <div className="relative">
                  <button
                    aria-controls="ledger-advanced-filters"
                    aria-expanded={isAdvancedFiltersOpen}
                    aria-haspopup="dialog"
                    aria-label="Advanced filters"
                    className={`relative inline-flex h-11 w-11 items-center justify-center rounded-full transition active:scale-95 ${
                      isAdvancedFiltersOpen || advancedFilterCount > 0
                        ? "bg-primary text-on-primary"
                        : "bg-surface text-on-surface-variant"
                    }`}
                    onClick={handleAdvancedFilterToggle}
                    type="button"
                  >
                    <MaterialSymbol className="text-[20px]" name="tune" />
                    {advancedFilterCount > 0 ? (
                      <span className="absolute -right-1 -top-1 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-tertiary px-1 text-[10px] font-semibold text-on-tertiary">
                        {advancedFilterCount}
                      </span>
                    ) : null}
                  </button>

                {isAdvancedFiltersOpen ? (
                    <div
                      aria-label="Advanced filters"
                      className="tw-motion-node tw-settings-toast-in fixed inset-x-4 bottom-24 z-20 rounded-[24px] border border-outline-variant/20 bg-surface p-4 shadow-[0_20px_40px_rgba(46,50,48,0.18)] md:absolute md:inset-x-auto md:bottom-auto md:right-0 md:top-[calc(100%+12px)] md:w-[22rem]"
                      id="ledger-advanced-filters"
                      role="dialog"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
                            Advanced filters
                          </p>
                          <p className="mt-1 text-sm text-on-surface-variant">
                            Search, category, institution, channel, and amount bounds.
                          </p>
                        </div>
                        {advancedFilterCount > 0 ? (
                          <span className="rounded-full bg-primary-container/40 px-3 py-1 text-[11px] font-semibold text-primary">
                            {advancedFilterCount} applied
                          </span>
                        ) : null}
                      </div>

                      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <label className="flex min-w-0 flex-col gap-2 sm:col-span-2">
                          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
                            Search
                          </span>
                          <input
                            className="min-h-11 rounded-2xl border border-outline-variant/20 bg-surface-container-low px-3 text-sm text-on-surface outline-none"
                            onInput={(event) => {
                              const { value } = event.currentTarget;
                              setDraftAdvancedFilters((current) => ({
                                ...current,
                                searchQuery: value,
                              }));
                            }}
                            placeholder="Search merchant, note, sender, or account"
                            type="text"
                            value={draftAdvancedFilters.searchQuery}
                          />
                        </label>

                      <label className="flex min-w-0 flex-col gap-2">
                        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
                          Category
                        </span>
                        <select
                          aria-label="Filter by category"
                          className="min-h-11 rounded-2xl border border-outline-variant/20 bg-surface-container-low px-3 text-sm text-on-surface outline-none"
                          onChange={(event) => {
                            const value =
                              event.currentTarget.value as AdvancedLedgerFilters["category"];
                            setDraftAdvancedFilters((current) => ({
                              ...current,
                              category: value,
                            }));
                          }}
                          value={draftAdvancedFilters.category}
                        >
                          <option value="all">All categories</option>
                          {Object.entries(TRANSACTION_CATEGORY_LABELS).map(
                            ([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ),
                          )}
                        </select>
                      </label>

                      <label className="flex min-w-0 flex-col gap-2">
                        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
                          Institution
                        </span>
                        <select
                          aria-label="Filter by institution"
                          className="min-h-11 rounded-2xl border border-outline-variant/20 bg-surface-container-low px-3 text-sm text-on-surface outline-none"
                          onChange={(event) => {
                            const value =
                              event.currentTarget.value as AdvancedLedgerFilters["institution"];
                            setDraftAdvancedFilters((current) => ({
                              ...current,
                              institution: value,
                            }));
                          }}
                          value={draftAdvancedFilters.institution}
                        >
                          <option value="all">All institutions</option>
                          {Object.entries(FINANCIAL_INSTITUTION_LABELS).map(
                            ([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ),
                          )}
                        </select>
                      </label>

                      <label className="flex min-w-0 flex-col gap-2">
                        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
                          Channel
                        </span>
                        <select
                          className="min-h-11 rounded-2xl border border-outline-variant/20 bg-surface-container-low px-3 text-sm text-on-surface outline-none"
                          onChange={(event) => {
                            const value =
                              event.currentTarget.value as AdvancedLedgerFilters["channel"];
                            setDraftAdvancedFilters((current) => ({
                              ...current,
                              channel: value,
                            }));
                          }}
                          value={draftAdvancedFilters.channel}
                        >
                          <option value="all">All channels</option>
                          <option value="bank">Bank</option>
                          <option value="mobile_money">Mobile money</option>
                          <option value="cash">Cash</option>
                        </select>
                      </label>

                      <label className="flex min-w-0 flex-col gap-2">
                        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
                          Min amount
                        </span>
                        <input
                          className="min-h-11 rounded-2xl border border-outline-variant/20 bg-surface-container-low px-3 text-sm text-on-surface outline-none"
                          inputMode="decimal"
                          onInput={(event) => {
                            const { value } = event.currentTarget;
                            setDraftAdvancedFilters((current) => ({
                              ...current,
                              minAmountBirr: value,
                            }));
                          }}
                          placeholder="ETB 0"
                          type="number"
                          value={draftAdvancedFilters.minAmountBirr}
                        />
                      </label>

                      <label className="flex min-w-0 flex-col gap-2">
                        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
                          Max amount
                        </span>
                        <input
                          className="min-h-11 rounded-2xl border border-outline-variant/20 bg-surface-container-low px-3 text-sm text-on-surface outline-none"
                          inputMode="decimal"
                          onInput={(event) => {
                            const { value } = event.currentTarget;
                            setDraftAdvancedFilters((current) => ({
                              ...current,
                              maxAmountBirr: value,
                            }));
                          }}
                          placeholder="ETB 999999"
                          type="number"
                          value={draftAdvancedFilters.maxAmountBirr}
                        />
                      </label>
                      </div>

                      <div className="mt-4 flex items-center justify-between gap-3">
                        <button
                          className="inline-flex min-h-10 items-center gap-2 rounded-full bg-surface-container px-4 py-2 text-sm font-semibold text-on-surface-variant active:scale-95"
                          onClick={handleAdvancedFilterClear}
                          type="button"
                        >
                          Clear
                        </button>
                        <button
                          className="inline-flex min-h-10 items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-on-primary active:scale-95"
                          onClick={handleAdvancedFilterApply}
                          type="button"
                        >
                          Apply
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
                Approved range
              </p>
              <div className="flex flex-wrap gap-2">
                {rangeOptions.map((option) => (
                  <button
                    className={`rounded-full px-4 py-2 text-sm font-semibold active:scale-95 ${
                      activeRange === option.id
                        ? "bg-primary text-on-primary"
                        : "bg-surface text-on-surface-variant"
                    }`}
                    key={option.id}
                    onClick={() => setActiveRange(option.id)}
                    type="button"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
                Direction
              </p>
              <div className="flex flex-wrap gap-2">
                {([
                  { id: "all", label: "All" },
                  { id: "credits", label: "Credits" },
                  { id: "debits", label: "Debits" },
                ] as const).map((option) => (
                  <button
                    className={`rounded-full px-4 py-2 text-sm font-semibold active:scale-95 ${
                      activeFilter === option.id
                        ? "bg-primary-container/40 text-primary"
                        : "bg-surface text-on-surface-variant"
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
          </div>

          <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-surface px-4 py-3 text-xs font-semibold text-on-surface-variant">
            <span className="rounded-full bg-surface-container px-3 py-1">
              {filteredTransactions.length} approved entries
            </span>
            <span className="rounded-full bg-surface-container px-3 py-1">
              Range {rangeOptions.find((option) => option.id === activeRange)?.label}
            </span>
            <span className="rounded-full bg-surface-container px-3 py-1">
              {activeFilter === "all"
                ? "All directions"
                : activeFilter === "credits"
                  ? "Credits only"
                  : "Debits only"}
            </span>
            <span
              className={`rounded-full px-3 py-1 ${
                advancedFilterCount > 0
                  ? "bg-primary-container/40 text-primary"
                  : "bg-surface-container"
              }`}
            >
              {advancedFilterCount > 0
                ? `${advancedFilterCount} filters applied`
                : "No advanced filters"}
            </span>
            <span className="rounded-full bg-surface-container px-3 py-1">
              {viewMode === "list" ? "List mode" : "Calendar mode"}
            </span>
          </div>

        {viewMode === "list" ? (
          <div className="mt-5 space-y-3">
            {renderTransactionList(
              filteredTransactions,
              "No approved entries match this filter stack yet.",
              onEditApprovedTransaction,
            )}
          </div>
        ) : (
          <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
            <section className="rounded-[22px] border border-outline-variant/20 bg-surface p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
                    Calendar mode
                  </p>
                  <h4 className="mt-1 font-headline text-xl font-semibold text-on-surface">
                    {formatMonthLabel(visibleMonth)}
                  </h4>
                </div>
                <span className="rounded-full bg-surface-container px-3 py-1 text-[11px] font-semibold text-on-surface-variant">
                  Tap a day
                </span>
              </div>

              <div className="mt-4 grid grid-cols-7 gap-2">
                {weekdayLabels.map((label) => (
                  <span
                    className="text-center text-[11px] font-semibold uppercase tracking-[0.08em] text-on-surface-variant"
                    key={label}
                  >
                    {label}
                  </span>
                ))}

                {monthGrid.map((day, index) =>
                  day ? (
                    <button
                      aria-label={`Show transactions for ${day.label}`}
                      className={`flex min-h-[68px] flex-col items-start justify-between rounded-2xl border px-3 py-2 text-left transition active:scale-[0.98] ${
                        selectedDateKey === day.dateKey
                          ? "border-primary bg-primary-container/25 text-primary"
                          : day.transactionCount > 0
                            ? "border-outline-variant/20 bg-surface-container-low text-on-surface"
                            : "border-outline-variant/15 bg-surface-container-lowest text-on-surface-variant"
                      }`}
                      key={day.dateKey}
                      onClick={() => setSelectedDateKey(day.dateKey)}
                      type="button"
                    >
                      <span className="text-sm font-semibold">{day.dayNumber}</span>
                      <span
                        className={`inline-flex min-h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-semibold ${
                          day.transactionCount > 0
                            ? selectedDateKey === day.dateKey
                              ? "bg-primary text-on-primary"
                              : "bg-surface text-on-surface-variant"
                            : "bg-transparent text-transparent"
                        }`}
                      >
                        {day.transactionCount > 0 ? day.transactionCount : "0"}
                      </span>
                    </button>
                  ) : (
                    <div
                      className="min-h-[68px] rounded-2xl bg-surface-container-lowest/70"
                      key={`blank-${index}`}
                    />
                  ),
                )}
              </div>
            </section>

            <section className="space-y-3">
              <div className="rounded-[22px] border border-outline-variant/20 bg-surface px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
                  Selected day
                </p>
                <h4 className="mt-1 font-headline text-xl font-semibold text-on-surface">
                  {selectedDateKey ? formatSelectedDayLabel(selectedDateKey) : "No day selected"}
                </h4>
                <p className="mt-2 text-sm text-on-surface-variant">
                  {selectedDateKey
                    ? "Only transactions approved on this day stay in view."
                    : "Choose a day to inspect the matching approvals."}
                </p>
              </div>

              <div className="space-y-3">
                {renderTransactionList(
                  selectedDayTransactions,
                  "No approved entries landed on this day.",
                  onEditApprovedTransaction,
                )}
              </div>
            </section>
          </div>
        )}
        </MotionPanel>
      </section>
    </MotionPage>
  );
}
