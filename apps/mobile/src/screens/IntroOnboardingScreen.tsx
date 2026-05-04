import { useEffect, useMemo, useState } from "react";

import { MaterialSymbol } from "@omni-sync/ui";

import {
  MotionPage,
  MotionPanel,
  MotionStagger,
} from "../components/settingsMotionPrimitives";
import {
  OnboardingIllustration,
  type OnboardingIllustrationId,
} from "../components/OnboardingIllustration";

type OnboardingAccent = "primary" | "secondary" | "tertiary";

export interface IntroOnboardingBullet {
  icon: string;
  title: string;
  description: string;
}

export interface IntroOnboardingPage {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  highlightLabel: string;
  accent: OnboardingAccent;
  illustration: OnboardingIllustrationId;
  bullets: readonly IntroOnboardingBullet[];
}

export interface IntroOnboardingScreenProps {
  pages?: readonly IntroOnboardingPage[];
  initialPage?: number;
  nextLabel?: string;
  completeLabel?: string;
  skipLabel?: string;
  skipConfirmTitle?: string;
  skipConfirmDescription?: string;
  skipConfirmCancelLabel?: string;
  skipConfirmConfirmLabel?: string;
  onOpenCategoryWindow?: () => void;
  onSkip?: (page: IntroOnboardingPage, index: number) => void;
  onComplete: (page: IntroOnboardingPage, index: number) => void;
  onPageChange?: (page: IntroOnboardingPage, index: number) => void;
}

const accentClassMap: Record<
  OnboardingAccent,
  {
    badge: string;
    dot: string;
    dotMuted: string;
    iconWrap: string;
    iconColor: string;
    panelBorder: string;
    panelGlow: string;
  }
> = {
  primary: {
    badge: "bg-primary-container/70 text-primary",
    dot: "bg-primary",
    dotMuted: "bg-primary/24",
    iconWrap: "bg-primary-container/70",
    iconColor: "text-primary",
    panelBorder: "border-primary/16",
    panelGlow: "bg-primary/16",
  },
  secondary: {
    badge: "bg-secondary-container/75 text-secondary",
    dot: "bg-secondary",
    dotMuted: "bg-secondary/24",
    iconWrap: "bg-secondary-container/75",
    iconColor: "text-secondary",
    panelBorder: "border-secondary/16",
    panelGlow: "bg-secondary/14",
  },
  tertiary: {
    badge: "bg-tertiary-container/75 text-tertiary",
    dot: "bg-tertiary",
    dotMuted: "bg-tertiary/24",
    iconWrap: "bg-tertiary-container/75",
    iconColor: "text-tertiary",
    panelBorder: "border-tertiary/16",
    panelGlow: "bg-tertiary/14",
  },
};

export const defaultIntroOnboardingPages: readonly IntroOnboardingPage[] = [
  {
    id: "start",
    eyebrow: "Start here",
    title: "Choose how this phone should start",
    description:
      "Start with showcase samples or a private empty wallet.",
    highlightLabel: "Private or showcase",
    accent: "primary",
    illustration: "password-vault",
    bullets: [
      {
        icon: "shield_lock",
        title: "Private starts empty",
        description: "No sample balances, drafts, or budgets.",
      },
      {
        icon: "science",
        title: "Showcase stays available",
        description: "Load the sample wallet when you need the walkthrough.",
      },
      {
        icon: "phone_iphone",
        title: "Setup starts here",
        description: "SMS setup, review, and entry begin on this phone.",
      },
    ],
  },
  {
    id: "capture",
    eyebrow: "How it works",
    title: "Messages and manual entry share one lane",
    description:
      "SMS alerts, copied receipts, and manual entries use one intake flow.",
    highlightLabel: "One intake flow",
    accent: "secondary",
    illustration: "capture-lane",
    bullets: [
      {
        icon: "sms",
        title: "Inbox catches signals",
        description: "Drafts wait in one review queue.",
      },
      {
        icon: "edit_note",
        title: "Manual entry stays close",
        description: "Corrections and new entries use the same path.",
      },
      {
        icon: "hub",
        title: "Parser suggests details",
        description: "The parser drafts fields for you to confirm.",
      },
    ],
  },
  {
    id: "approval",
    eyebrow: "Review first",
    title: "Approve clean records, fix uncertain ones",
    description:
      "Approve, edit, or reject drafts before they reach the ledger.",
    highlightLabel: "Approval gate",
    accent: "tertiary",
    illustration: "approval-stack",
    bullets: [
      {
        icon: "task_alt",
        title: "Approve with intent",
        description: "Only reviewed rows post.",
      },
      {
        icon: "edit",
        title: "Correct before posting",
        description: "Fix amount, category, reference, or notes first.",
      },
      {
        icon: "rule",
        title: "Keep noise out",
        description: "Stop bad drafts here.",
      },
    ],
  },
  {
    id: "surfaces",
    eyebrow: "See the shape",
    title: "Accounts and budgets stay readable at a glance",
    description:
      "Track accounts and budgets together without losing the balance view.",
    highlightLabel: "Clarity at a glance",
    accent: "primary",
    illustration: "accounts-budget",
    bullets: [
      {
        icon: "account_balance_wallet",
        title: "One money view",
        description: "Banks, mobile, and cash stay together.",
      },
      {
        icon: "bar_chart",
        title: "Budget pressure early",
        description: "See pressure before overspending spreads.",
      },
      {
        icon: "insights",
        title: "Better decisions later",
        description: "Clean review leads to cleaner reports.",
      },
    ],
  },
];

function clampInitialPage(initialPage: number | undefined, totalPages: number) {
  if (totalPages <= 1) {
    return 0;
  }

  if (typeof initialPage !== "number" || Number.isNaN(initialPage)) {
    return 0;
  }

  return Math.min(Math.max(0, Math.floor(initialPage)), totalPages - 1);
}

export function IntroOnboardingScreen({
  pages,
  initialPage,
  nextLabel = "Continue",
  completeLabel = "Enter showcase",
  skipLabel = "Start private",
  skipConfirmConfirmLabel = "Start private",
  onOpenCategoryWindow,
  onSkip,
  onComplete,
  onPageChange,
}: IntroOnboardingScreenProps) {
  const usesDefaultEntryChoice = !pages || pages.length === 0;
  const resolvedPages = useMemo(
    () => (pages && pages.length > 0 ? pages : defaultIntroOnboardingPages),
    [pages],
  );
  const [activeIndex, setActiveIndex] = useState(() =>
    clampInitialPage(initialPage, resolvedPages.length),
  );
  const activePage = resolvedPages[activeIndex];
  const accentClass = accentClassMap[activePage.accent];
  const isLastPage = activeIndex === resolvedPages.length - 1;
  const isStartPage = activeIndex === 0;

  useEffect(() => {
    setActiveIndex((current) =>
      clampInitialPage(current, resolvedPages.length),
    );
  }, [resolvedPages.length]);

  useEffect(() => {
    setActiveIndex(clampInitialPage(initialPage, resolvedPages.length));
  }, [initialPage, resolvedPages.length]);

  useEffect(() => {
    onPageChange?.(activePage, activeIndex);
  }, [activeIndex, activePage, onPageChange]);

  function handleAdvance() {
    if (isLastPage) {
      onComplete(activePage, activeIndex);
      return;
    }

    setActiveIndex((current) => Math.min(current + 1, resolvedPages.length - 1));
  }

  function handleBack() {
    setActiveIndex((current) => Math.max(current - 1, 0));
  }

  return (
    <MotionPage includeStyles variant="showcase">
      <section className="relative overflow-hidden rounded-[36px] border border-outline-variant/20 bg-[#f7efe6] p-4 shadow-[0_24px_60px_rgba(46,50,48,0.12)] sm:p-5">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-44 bg-[radial-gradient(circle_at_top,_rgba(186,104,64,0.16),_transparent_64%)]" />
        <div className="pointer-events-none absolute -left-10 bottom-10 h-36 w-36 rounded-full bg-white/50 blur-3xl" />
        <div className="tw-motion-showcase-halo pointer-events-none absolute -right-8 top-28 h-44 w-44 rounded-full bg-primary-container/25 blur-3xl" />

        <MotionStagger
          className="relative z-10 flex flex-col gap-5"
          delay={30}
          key={activePage.id}
          step={52}
          variant="hero"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/60 bg-white/72 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-on-surface-variant shadow-sm backdrop-blur">
                <MaterialSymbol className="text-[16px] text-primary" filled name="lock_person" />
                Track Wallet intro
              </div>
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-on-surface-variant">
                  {activePage.eyebrow}
                </p>
                <h1 className="mt-2 max-w-sm font-headline text-[2rem] font-semibold leading-tight tracking-[-0.03em] text-[#221e18]">
                  {activePage.title}
                </h1>
              </div>
            </div>

            {!isStartPage ? (
              <button
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/60 bg-white/72 px-4 py-2 text-sm font-semibold text-on-surface-variant shadow-sm backdrop-blur transition active:scale-[0.98]"
                onClick={() => onSkip?.(activePage, activeIndex)}
                type="button"
              >
                {skipLabel}
              </button>
            ) : null}
          </div>

          <MotionPanel
            className={`relative overflow-hidden rounded-[34px] border bg-white/30 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)] ${accentClass.panelBorder}`}
            variant="hero"
          >
            <div className={`tw-motion-showcase-halo pointer-events-none absolute inset-x-6 top-4 h-20 rounded-full blur-3xl ${accentClass.panelGlow}`} />
            <div className="relative">
              <OnboardingIllustration
                accent={activePage.accent}
                illustration={activePage.illustration}
              />
            </div>
          </MotionPanel>

          <article className="rounded-[30px] border border-white/55 bg-white/70 p-5 shadow-[0_14px_34px_rgba(46,50,48,0.08)] backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] ${accentClass.badge}`}>
                <MaterialSymbol className="text-[16px]" filled name="fiber_manual_record" />
                {activePage.highlightLabel}
              </div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-on-surface-variant">
                {activeIndex + 1} / {resolvedPages.length} pages
              </p>
            </div>

            <p className="mt-4 max-w-xl text-sm leading-6 text-on-surface-variant">
              {activePage.description}
            </p>

            <div className="mt-4 rounded-[24px] border border-[#1f544b]/12 bg-[#edf5f1] p-4 shadow-[0_8px_22px_rgba(31,84,75,0.08)]">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/82 text-[#1f544b] shadow-sm">
                  <MaterialSymbol className="text-[20px]" filled name="science" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#1f544b]">
                    Showcase warning
                  </p>
                  <p className="mt-1 text-sm leading-6 text-on-surface">
                    Showcase loads sample balances, budgets, and inbox drafts on
                    this phone. Skip if you want to start private and empty.
                  </p>
                </div>
              </div>
            </div>

            {activePage.id === "surfaces" && onOpenCategoryWindow ? (
              <button
                className="mt-4 inline-flex items-center gap-2 rounded-full border border-outline-variant/18 bg-white/82 px-4 py-2 text-sm font-semibold text-on-surface transition active:scale-[0.98]"
                onClick={onOpenCategoryWindow}
                type="button"
              >
                <MaterialSymbol className="text-[18px]" filled name="category" />
                Add category
              </button>
            ) : null}

            <MotionStagger className="mt-5 grid gap-3" step={45}>
              {activePage.bullets.map((bullet) => (
                <div
                  className="flex items-start gap-3 rounded-[24px] border border-outline-variant/16 bg-white/75 px-4 py-3 shadow-[0_6px_18px_rgba(46,50,48,0.04)]"
                  key={`${activePage.id}-${bullet.title}`}
                >
                  <div
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${accentClass.iconWrap}`}
                  >
                    <MaterialSymbol
                      className={`text-[21px] ${accentClass.iconColor}`}
                      filled
                      name={bullet.icon}
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-on-surface">
                      {bullet.title}
                    </p>
                    <p className="mt-1 text-sm leading-5 text-on-surface-variant">
                      {bullet.description}
                    </p>
                  </div>
                </div>
              ))}
            </MotionStagger>
          </article>

          <footer className="flex flex-col gap-4 rounded-[30px] border border-white/55 bg-white/68 p-4 shadow-[0_14px_34px_rgba(46,50,48,0.08)] backdrop-blur">
            <div className="flex items-center justify-center gap-2">
              {resolvedPages.map((page, index) => (
                <button
                  aria-label={`Go to page ${index + 1}: ${page.title}`}
                  className={`h-2.5 rounded-full transition ${
                    index === activeIndex
                      ? `w-8 ${accentClass.dot}`
                      : `w-2.5 ${accentClass.dotMuted}`
                  }`}
                  key={page.id}
                  onClick={() => setActiveIndex(index)}
                  type="button"
                />
              ))}
            </div>

            <div className="flex items-center justify-between gap-3">
              {isStartPage && usesDefaultEntryChoice ? (
                <>
                  <button
                    className="inline-flex min-h-12 items-center gap-2 rounded-2xl border border-outline-variant/18 bg-white/82 px-4 py-3 text-sm font-semibold text-on-surface transition active:scale-[0.98]"
                    onClick={() => onSkip?.(activePage, activeIndex)}
                    type="button"
                  >
                    <MaterialSymbol className="text-[18px]" filled name="shield_lock" />
                    {skipConfirmConfirmLabel}
                  </button>

                  <button
                    className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-[22px] bg-[#1f544b] px-5 py-3 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(31,84,75,0.24)] transition active:scale-[0.98]"
                    onClick={handleAdvance}
                    type="button"
                  >
                    Try showcase
                    <MaterialSymbol
                      className="text-[18px]"
                      filled
                      name="arrow_forward"
                    />
                  </button>
                </>
              ) : (
                <>
              <button
                className="inline-flex min-h-12 items-center gap-2 rounded-2xl border border-outline-variant/18 bg-white/82 px-4 py-3 text-sm font-semibold text-on-surface transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
                disabled={activeIndex === 0}
                onClick={handleBack}
                type="button"
              >
                <MaterialSymbol className="text-[18px]" filled name="arrow_back" />
                Back
              </button>

              <button
                className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-[22px] bg-[#1f544b] px-5 py-3 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(31,84,75,0.24)] transition active:scale-[0.98]"
                onClick={handleAdvance}
                type="button"
              >
                {isLastPage ? completeLabel : nextLabel}
                <MaterialSymbol
                  className="text-[18px]"
                  filled
                  name={isLastPage ? "north_east" : "arrow_forward"}
                />
              </button>
                </>
              )}
            </div>
          </footer>
        </MotionStagger>
      </section>
    </MotionPage>
  );
}
