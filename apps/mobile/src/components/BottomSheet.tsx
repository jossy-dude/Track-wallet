import type { ReactNode } from "react";

import { MaterialSymbol } from "@omni-sync/ui";

import {
  SettingsMotionStyles,
  useMotionPresence,
} from "./settingsMotionPrimitives";

function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function BottomSheet({
  isOpen,
  title,
  subtitle,
  onClose,
  children,
  maxHeightClassName = "max-h-[72vh]",
  className,
}: {
  isOpen: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  maxHeightClassName?: string;
  className?: string;
}) {
  const { motionState, shouldRender } = useMotionPresence(isOpen, {
    exitDurationMs: 260,
  });

  if (!shouldRender) {
    return null;
  }

  return (
    <>
      <SettingsMotionStyles />
      <div
        aria-modal="true"
        className="tw-motion-overlay fixed inset-0 z-[70] flex items-end justify-center bg-[#2e3230]/35 p-3 backdrop-blur-sm"
        data-motion-state={motionState}
        role="dialog"
      >
        <button
          aria-label="Dismiss sheet backdrop"
          className="absolute inset-0 cursor-default"
          onClick={onClose}
          type="button"
        />
        <section
          className={cn(
            "tw-motion-surface tw-motion-sheet-surface relative flex w-full max-w-3xl flex-col overflow-hidden rounded-t-[32px] border border-outline-variant/20 bg-background shadow-[0_-10px_40px_rgba(46,50,48,0.18)]",
            maxHeightClassName,
            className,
          )}
          data-motion-state={motionState}
        >
          <div className="mx-auto mt-3 h-1.5 w-14 rounded-full bg-outline-variant/60" />
          <div className="flex items-start justify-between gap-4 px-5 pb-4 pt-4">
            <div>
              <p className="font-headline text-2xl font-semibold text-on-surface">
                {title}
              </p>
              {subtitle ? (
                <p className="mt-1 text-sm text-on-surface-variant">{subtitle}</p>
              ) : null}
            </div>
            <button
              className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-container text-on-surface transition active:scale-[0.96]"
              onClick={onClose}
              type="button"
            >
              <MaterialSymbol name="close" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
            {children}
          </div>
        </section>
      </div>
    </>
  );
}
