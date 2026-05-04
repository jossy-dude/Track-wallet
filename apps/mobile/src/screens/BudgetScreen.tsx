import { useMemo, useState } from "react";

import { MaterialSymbol } from "@omni-sync/ui";

import { LiquidMeter } from "../components/LiquidMeter";
import {
  MotionPage,
  MotionPanel,
  MotionStagger,
} from "../components/settingsMotionPrimitives";

export interface BudgetCategoryPlan {
  budgetId: string;
  category: string;
  label: string;
  spentMinor: number;
  limitMinor: number;
  progressPercent: number;
  iconName: string;
  tone: "primary" | "tertiary" | "secondary";
}

interface BudgetScreenProps {
  activeBudgets: readonly BudgetCategoryPlan[];
  availableBudgets: readonly BudgetCategoryPlan[];
  onAddBudget: (budgetId: string, limitMinor: number) => void;
  onRemoveBudget: (budgetId: string) => void;
  onUpdateBudgetLimit: (budgetId: string, limitMinor: number) => void;
}

function formatAmountMinor(amountMinor: number): string {
  return `ETB ${(amountMinor / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function progressTone(progressPercent: number): string {
  if (progressPercent > 100) {
    return "bg-[#7d1d1d]";
  }

  if (progressPercent >= 85) {
    return "bg-[#b85a4a]";
  }

  if (progressPercent >= 65) {
    return "bg-tertiary";
  }

  return "bg-primary";
}

export function BudgetScreen({
  activeBudgets,
  availableBudgets,
  onAddBudget,
  onRemoveBudget,
  onUpdateBudgetLimit,
}: BudgetScreenProps) {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [managedBudgetId, setManagedBudgetId] = useState<string | null>(null);
  const [selectedBudgetId, setSelectedBudgetId] = useState<string>(
    availableBudgets[0]?.budgetId ?? "",
  );
  const [limitInput, setLimitInput] = useState("");

  const healthiestBudget = useMemo(
    () =>
      activeBudgets
        .slice()
        .sort((left, right) => left.progressPercent - right.progressPercent)[0] ??
      null,
    [activeBudgets],
  );

  const overspentCount = activeBudgets.filter(
    (budget) => budget.progressPercent > 100,
  ).length;

  function createBudget() {
    const sourceBudget = availableBudgets.find(
      (budget) => budget.budgetId === selectedBudgetId,
    );

    if (!sourceBudget) {
      return;
    }

    const nextLimitMinor =
      limitInput.trim().length > 0
        ? Math.round(Number(limitInput || "0") * 100)
        : sourceBudget.limitMinor;

    if (nextLimitMinor <= 0) {
      return;
    }

    onAddBudget(sourceBudget.budgetId, nextLimitMinor);
    setLimitInput("");
    setSelectedBudgetId(availableBudgets[1]?.budgetId ?? "");
    setIsAddOpen(false);
  }

  function resolveLiquidTone(progressPercent: number): "primary" | "tertiary" | "danger" {
    if (progressPercent > 100) {
      return "danger";
    }

    return progressPercent >= 65 ? "tertiary" : "primary";
  }

  return (
    <MotionPage includeStyles className="space-y-6">
      <section className="space-y-6">
      <MotionPanel
        className="overflow-hidden rounded-[30px] border border-outline-variant/20 bg-[linear-gradient(140deg,rgba(245,241,234,0.98),rgba(255,255,255,0.92))] p-5 shadow-[0_6px_24px_rgba(46,50,48,0.06)]"
        variant="hero"
      >
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-on-surface-variant">
              Budget workspace
            </p>
            <h1 className="font-headline text-3xl font-semibold tracking-tight text-on-surface">
              Category budgets
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-on-surface-variant">
              Set limits, spot pressure early, and keep overspent categories obvious.
            </p>
          </div>
          <button
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-outline-variant/20 bg-surface text-primary transition active:scale-[0.97]"
            onClick={() => setIsAddOpen(true)}
            type="button"
          >
            <MaterialSymbol filled name="add" />
          </button>
        </div>

        {activeBudgets.length > 0 ? (
          <div className="mt-5 rounded-[26px] bg-white/72 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
            <div className="mb-4 flex flex-wrap gap-2">
              {activeBudgets.map((budget) => (
                <span
                  className="inline-flex items-center gap-2 rounded-full bg-surface px-3 py-2 text-xs font-semibold text-on-surface"
                  key={`pill-${budget.budgetId}`}
                >
                  <span className={`h-2.5 w-2.5 rounded-full ${progressTone(budget.progressPercent)}`} />
                  {budget.label}
                </span>
              ))}
            </div>
            <MotionStagger
              className="grid gap-3"
              step={32}
              style={{ gridTemplateColumns: "repeat(auto-fit, minmax(132px, 1fr))" }}
            >
              {activeBudgets.map((budget) => (
                <div
                  className="flex min-w-0 flex-col gap-2 rounded-[20px] bg-white/55 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.62)]"
                  key={`hero-${budget.budgetId}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="min-w-0 truncate text-[10px] font-semibold uppercase tracking-[0.08em] text-on-surface-variant">
                      {budget.label}
                    </p>
                    <p className="rounded-full bg-white/78 px-2 py-0.5 text-[10px] font-semibold text-on-surface shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
                      {budget.progressPercent}%
                    </p>
                  </div>
                  <div className="rounded-full bg-[#eef1f5] p-[6px]">
                    <LiquidMeter
                      className="h-[88px] w-full rounded-full"
                      orientation="vertical"
                      progressPercent={budget.progressPercent}
                      tone={resolveLiquidTone(budget.progressPercent)}
                    />
                  </div>
                  <p className="truncate text-[10px] font-semibold text-on-surface-variant">
                    {formatAmountMinor(budget.spentMinor)} used
                  </p>
                </div>
              ))}
            </MotionStagger>
          </div>
        ) : null}
      </MotionPanel>

      <MotionStagger className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" delay={70} step={35}>
        <article className="rounded-[24px] border border-outline-variant/20 bg-surface-container-low p-5 shadow-[0_4px_20px_rgba(46,50,48,0.06)]">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-on-surface-variant">
            Active limits
          </p>
          <p className="mt-3 font-headline text-3xl font-semibold text-on-surface">
            {activeBudgets.length}
          </p>
          <p className="mt-2 text-sm text-on-surface-variant">Shown on Home.</p>
        </article>
        <article className="rounded-[24px] border border-outline-variant/20 bg-surface-container-low p-5 shadow-[0_4px_20px_rgba(46,50,48,0.06)]">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-on-surface-variant">
            Overspent
          </p>
          <p className="mt-3 font-headline text-3xl font-semibold text-on-surface">
            {overspentCount}
          </p>
          <p className="mt-2 text-sm text-on-surface-variant">Already over limit.</p>
        </article>
        <article className="rounded-[24px] border border-outline-variant/20 bg-surface-container-low p-5 shadow-[0_4px_20px_rgba(46,50,48,0.06)]">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-on-surface-variant">
            Healthiest
          </p>
          <p className="mt-3 font-headline text-2xl font-semibold text-on-surface">
            {healthiestBudget?.label ?? "No data"}
          </p>
          <p className="mt-2 text-sm text-on-surface-variant">
            {healthiestBudget
              ? `${healthiestBudget.progressPercent}% used`
              : "Waiting for approved activity."}
          </p>
        </article>
      </MotionStagger>

      <MotionPanel
        className="overflow-hidden rounded-[28px] border border-outline-variant/20 bg-surface-container-low p-4 shadow-[0_4px_20px_rgba(46,50,48,0.06)] sm:p-6"
        delay={130}
      >
        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-headline text-2xl font-semibold text-on-surface">
              Budget limits
            </h2>
            <p className="mt-2 text-sm text-on-surface-variant">
              Dense category controls with quick per-budget adjustments.
            </p>
          </div>
          <button
            className="inline-flex items-center gap-2 rounded-full border border-outline-variant/20 bg-surface px-3 py-2 text-sm font-semibold text-primary transition active:scale-[0.97]"
            onClick={() => setIsAddOpen(true)}
            type="button"
          >
            <MaterialSymbol className="text-[18px]" filled name="add" />
            Add
          </button>
        </div>

        <MotionStagger className="space-y-4" step={32}>
          {activeBudgets.map((budget) => (
            <article
              className="min-w-0 rounded-[24px] border border-outline-variant/20 bg-surface px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]"
              key={budget.budgetId}
            >
              <div className="mb-2 flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-container text-primary">
                    <MaterialSymbol filled name={budget.iconName} />
                  </div>
                  <div className="min-w-0 leading-tight">
                    <p className="truncate font-semibold text-on-surface">{budget.label}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-semibold ${
                      budget.progressPercent > 100
                        ? "bg-error-container text-error"
                        : "bg-surface-container-high text-on-surface-variant"
                    }`}
                  >
                    {budget.progressPercent}%
                  </span>
                  <button
                    aria-label={`Manage ${budget.label} budget`}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-surface-container text-primary transition active:scale-[0.96]"
                    onClick={() =>
                      setManagedBudgetId((current) =>
                        current === budget.budgetId ? null : budget.budgetId,
                      )
                    }
                    type="button"
                  >
                    <MaterialSymbol filled name="tune" />
                  </button>
                </div>
              </div>

              <LiquidMeter
                className="h-3 rounded-full"
                progressPercent={budget.progressPercent}
                tone={resolveLiquidTone(budget.progressPercent)}
              />

              <div className="mt-2 grid grid-cols-3 gap-2 text-[11px] font-medium text-on-surface-variant">
                <div className="rounded-[16px] bg-surface-container-low px-2.5 py-1.5">
                  <span className="uppercase tracking-[0.12em]">Spent</span>
                  <p className="mt-0.5 truncate text-xs font-semibold text-on-surface">
                    {formatAmountMinor(budget.spentMinor)}
                  </p>
                </div>
                <div className="rounded-[16px] bg-surface-container-low px-2.5 py-1.5">
                  <span className="uppercase tracking-[0.12em]">Limit</span>
                  <p className="mt-0.5 truncate text-xs font-semibold text-on-surface">
                    {formatAmountMinor(budget.limitMinor)}
                  </p>
                </div>
                <div className="rounded-[16px] bg-surface-container-low px-2.5 py-1.5">
                  <span className="uppercase tracking-[0.12em]">Left</span>
                  <p className="mt-0.5 truncate text-xs font-semibold text-on-surface">
                    {formatAmountMinor(Math.max(0, budget.limitMinor - budget.spentMinor))}
                  </p>
                </div>
              </div>

              {managedBudgetId === budget.budgetId ? (
                <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                  <label className="flex flex-col gap-2 text-sm text-on-surface-variant sm:flex-row sm:items-center sm:gap-3">
                    <span className="font-semibold text-on-surface">Limit</span>
                    <input
                      className="w-full rounded-full border border-outline-variant/20 bg-surface-container-low px-3 py-2 text-sm text-on-surface focus:border-primary focus:ring-1 focus:ring-primary sm:w-32"
                      defaultValue={(budget.limitMinor / 100).toFixed(0)}
                      onBlur={(event) => {
                        const nextLimitMinor = Math.round(
                          Number(event.target.value || "0") * 100,
                        );
                        if (nextLimitMinor > 0) {
                          onUpdateBudgetLimit(budget.budgetId, nextLimitMinor);
                        }
                      }}
                      type="number"
                    />
                  </label>
                  <div className="flex justify-start lg:justify-end">
                    <button
                      className="inline-flex items-center gap-2 rounded-full border border-error/20 bg-error/10 px-3 py-2 text-xs font-semibold text-error transition active:scale-[0.97]"
                      onClick={() => onRemoveBudget(budget.budgetId)}
                      type="button"
                    >
                      <MaterialSymbol className="text-[16px]" name="remove_circle" />
                      Hide card
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-2 flex justify-end">
                  <button
                    className="rounded-full bg-surface-container px-3 py-2 text-[11px] font-semibold text-primary transition active:scale-[0.97]"
                    onClick={() => setManagedBudgetId(budget.budgetId)}
                    type="button"
                  >
                    Manage
                  </button>
                </div>
              )}
            </article>
          ))}

          {activeBudgets.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-outline-variant bg-surface p-4 text-sm text-on-surface-variant">
              No visible budget cards yet. Add a category to start the budget
              workspace.
            </div>
          ) : null}
        </MotionStagger>
      </MotionPanel>

      {availableBudgets.length > 0 ? (
        <MotionPanel
          className="rounded-[28px] border border-outline-variant/20 bg-surface-container-low p-6 shadow-[0_4px_20px_rgba(46,50,48,0.06)]"
          delay={200}
        >
          <h2 className="font-headline text-2xl font-semibold text-on-surface">
            Available categories
          </h2>
          <p className="mt-2 text-sm text-on-surface-variant">
            Categories tracked by the app but not currently surfaced on Home.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            {availableBudgets.map((budget) => (
              <button
                className="inline-flex items-center gap-2 rounded-full border border-outline-variant/20 bg-surface px-4 py-2 text-sm font-semibold text-on-surface transition hover:bg-surface-container-low active:scale-[0.97]"
                key={budget.budgetId}
                onClick={() => {
                  setSelectedBudgetId(budget.budgetId);
                  setLimitInput((budget.limitMinor / 100).toFixed(0));
                  setIsAddOpen(true);
                }}
                type="button"
              >
                <MaterialSymbol className="text-[18px] text-primary" filled name={budget.iconName} />
                {budget.label}
              </button>
            ))}
          </div>
        </MotionPanel>
      ) : null}

      {isAddOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#2e3230]/45 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-[30px] border border-outline-variant/20 bg-background p-6 shadow-[0_18px_48px_rgba(46,50,48,0.24)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-on-surface-variant">
                  Compact add flow
                </p>
                <h2 className="font-headline text-2xl font-semibold text-on-surface">
                  Add category budget
                </h2>
              </div>
              <button
                className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-container text-on-surface transition hover:bg-surface-container-high"
                onClick={() => setIsAddOpen(false)}
                type="button"
              >
                <MaterialSymbol name="close" />
              </button>
            </div>

            {availableBudgets.length > 0 ? (
              <div className="mt-6 grid gap-4">
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-on-surface">
                    Category
                  </span>
                  <select
                    className="w-full rounded-2xl border border-outline-variant/20 bg-surface px-4 py-3 text-on-surface focus:border-primary focus:ring-1 focus:ring-primary"
                    onChange={(event) => setSelectedBudgetId(event.target.value)}
                    value={selectedBudgetId}
                  >
                    {availableBudgets.map((budget) => (
                      <option key={budget.budgetId} value={budget.budgetId}>
                        {budget.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-on-surface">
                    Limit amount
                  </span>
                  <input
                    className="w-full rounded-2xl border border-outline-variant/20 bg-surface px-4 py-3 text-on-surface focus:border-primary focus:ring-1 focus:ring-primary"
                    onChange={(event) => setLimitInput(event.target.value)}
                    placeholder="0"
                    type="number"
                    value={limitInput}
                  />
                </label>
              </div>
            ) : (
              <div className="mt-6 rounded-2xl border border-dashed border-outline-variant bg-surface-container-low p-4 text-sm text-on-surface-variant">
                All currently tracked categories are already visible in the budget
                workspace.
              </div>
            )}

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                className="rounded-2xl border border-outline-variant/20 bg-surface px-4 py-3 text-sm font-semibold text-on-surface-variant"
                onClick={() => setIsAddOpen(false)}
                type="button"
              >
                Cancel
              </button>
              <button
                className="rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-on-primary disabled:cursor-not-allowed disabled:opacity-60"
                disabled={availableBudgets.length === 0 || selectedBudgetId.length === 0}
                onClick={createBudget}
                type="button"
              >
                Add budget
              </button>
            </div>
          </div>
        </div>
      ) : null}
      </section>
    </MotionPage>
  );
}
