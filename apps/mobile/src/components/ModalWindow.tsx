import type { ReactNode } from "react";

import { MaterialSymbol } from "@omni-sync/ui";

import {
  SettingsMotionStyles,
  useMotionPresence,
} from "./settingsMotionPrimitives";

function joinClasses(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function ModalWindow({
  isOpen,
  title,
  subtitle,
  onClose,
  children,
  className,
  panelClassName,
}: {
  isOpen: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  panelClassName?: string;
}) {
  const { motionState, shouldRender } = useMotionPresence(isOpen, {
    exitDurationMs: 240,
  });

  if (!shouldRender) {
    return null;
  }

  return (
    <>
      <SettingsMotionStyles />
      <div
        aria-modal="true"
        className={joinClasses(
          "tw-motion-overlay fixed inset-0 z-[75] flex items-end justify-center bg-[#2e3230]/38 p-3 backdrop-blur-sm sm:items-center",
          className,
        )}
        data-motion-state={motionState}
        role="dialog"
      >
        <button
          aria-label="Dismiss window backdrop"
          className="absolute inset-0 cursor-default"
          onClick={onClose}
          type="button"
        />
        <section
          className={joinClasses(
            "tw-motion-surface tw-motion-modal-surface relative flex max-h-[86vh] w-full flex-col overflow-hidden rounded-[30px] border border-outline-variant/20 bg-background shadow-[0_22px_60px_rgba(46,50,48,0.22)] sm:w-[min(60vw,58rem)]",
            panelClassName,
          )}
          data-motion-state={motionState}
        >
          <div className="flex items-start justify-between gap-4 border-b border-outline-variant/14 bg-[linear-gradient(180deg,rgba(248,244,237,0.98),rgba(244,239,231,0.96))] px-5 py-4 backdrop-blur-sm">
            <div>
              <h3 className="font-headline text-2xl font-semibold text-on-surface">
                {title}
              </h3>
              {subtitle ? (
                <p className="mt-1 text-sm text-on-surface-variant">{subtitle}</p>
              ) : null}
            </div>
            <button
              aria-label="Close window"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-container text-on-surface transition active:scale-[0.96]"
              onClick={onClose}
              type="button"
            >
              <MaterialSymbol name="close" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 pt-5">
            {children}
          </div>
        </section>
      </div>
    </>
  );
}
