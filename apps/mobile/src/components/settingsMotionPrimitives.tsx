import {
  useEffect,
  useState,
  type CSSProperties,
  type HTMLAttributes,
  type ReactNode,
} from "react";

import { MaterialSymbol } from "@omni-sync/ui";

function joinClasses(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

const staggerIndexStyles = Array.from({ length: 20 }, (_, index) => {
  const position = index + 1;
  return `.tw-motion-stagger > :nth-child(${position}) { --tw-motion-stagger-index: ${index}; }`;
}).join("\n");

export const pressableClass =
  "transition-[transform,box-shadow,background-color,border-color,opacity] duration-150 ease-out active:scale-[0.985] active:shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]";

export function SettingsMotionStyles() {
  return (
    <style>
      {`
        @keyframes tw-mobile-page-in {
          from {
            opacity: 0;
            transform: translate3d(0, 20px, 0) scale(0.992);
            filter: saturate(0.94) blur(3px);
          }
          to {
            opacity: 1;
            transform: translate3d(0, 0, 0) scale(1);
            filter: saturate(1) blur(0);
          }
        }

        @keyframes tw-mobile-page-showcase-in {
          0% {
            opacity: 0;
            transform: translate3d(0, 22px, 0) scale(0.984);
            filter: saturate(0.88) blur(3px);
          }
          68% {
            opacity: 1;
            transform: translate3d(0, -2px, 0) scale(1.006);
            filter: saturate(1.02) blur(0);
          }
          100% {
            opacity: 1;
            transform: translate3d(0, 0, 0) scale(1);
            filter: saturate(1) blur(0);
          }
        }

        @keyframes tw-settings-panel-in {
          from {
            opacity: 0;
            transform: translate3d(0, 16px, 0) scale(0.992);
            filter: saturate(0.94);
          }
          to {
            opacity: 1;
            transform: translate3d(0, 0, 0) scale(1);
            filter: saturate(1);
          }
        }

        @keyframes tw-settings-subtle-in {
          from {
            opacity: 0;
            transform: translate3d(0, 10px, 0);
          }
          to {
            opacity: 1;
            transform: translate3d(0, 0, 0);
          }
        }

        @keyframes tw-mobile-hero-in {
          0% {
            opacity: 0;
            transform: translate3d(0, 22px, 0) scale(0.97);
            filter: saturate(0.9);
          }
          70% {
            opacity: 1;
            transform: translate3d(0, -3px, 0) scale(1.01);
            filter: saturate(1.02);
          }
          100% {
            opacity: 1;
            transform: translate3d(0, 0, 0) scale(1);
            filter: saturate(1);
          }
        }

        @keyframes tw-settings-toast-in {
          from {
            opacity: 0;
            transform: translate3d(0, -10px, 0) scale(0.985);
          }
          to {
            opacity: 1;
            transform: translate3d(0, 0, 0) scale(1);
          }
        }

        @keyframes tw-mobile-shell-in {
          from {
            opacity: 0;
            transform: translate3d(0, -12px, 0);
          }
          to {
            opacity: 1;
            transform: translate3d(0, 0, 0);
          }
        }

        @keyframes tw-mobile-bottom-nav-in {
          from {
            opacity: 0;
            transform: translate3d(0, 18px, 0);
          }
          to {
            opacity: 1;
            transform: translate3d(0, 0, 0);
          }
        }

        @keyframes tw-mobile-overlay-in {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes tw-mobile-overlay-out {
          from {
            opacity: 1;
          }
          to {
            opacity: 0;
          }
        }

        @keyframes tw-mobile-modal-in {
          0% {
            opacity: 0;
            transform: translate3d(0, 22px, 0) scale(0.95);
          }
          72% {
            opacity: 1;
            transform: translate3d(0, -2px, 0) scale(1.01);
          }
          100% {
            opacity: 1;
            transform: translate3d(0, 0, 0) scale(1);
          }
        }

        @keyframes tw-mobile-modal-out {
          from {
            opacity: 1;
            transform: translate3d(0, 0, 0) scale(1);
          }
          to {
            opacity: 0;
            transform: translate3d(0, 14px, 0) scale(0.975);
          }
        }

        @keyframes tw-mobile-sheet-in {
          0% {
            opacity: 0;
            transform: translate3d(0, 36px, 0) scale(0.985);
          }
          72% {
            opacity: 1;
            transform: translate3d(0, -3px, 0) scale(1.003);
          }
          100% {
            opacity: 1;
            transform: translate3d(0, 0, 0) scale(1);
          }
        }

        @keyframes tw-mobile-sheet-out {
          from {
            opacity: 1;
            transform: translate3d(0, 0, 0) scale(1);
          }
          to {
            opacity: 0;
            transform: translate3d(0, 28px, 0) scale(0.992);
          }
        }

        @keyframes tw-mobile-showcase-halo {
          0%, 100% {
            transform: scale(0.96);
            opacity: 0.48;
          }
          50% {
            transform: scale(1.04);
            opacity: 0.78;
          }
        }

        .tw-motion-node,
        .tw-motion-stagger > * {
          will-change: opacity, transform, filter;
          animation-delay: var(--tw-motion-delay, 0ms);
          animation-fill-mode: forwards;
          animation-timing-function: cubic-bezier(0.22, 1, 0.36, 1);
        }

        .tw-motion-page-root {
          position: relative;
        }

        .tw-motion-page {
          opacity: 0;
          animation-duration: 460ms;
          animation-name: tw-mobile-page-in;
        }

        .tw-motion-page-showcase {
          opacity: 0;
          animation-duration: 540ms;
          animation-name: tw-mobile-page-showcase-in;
        }

        .tw-settings-panel-in {
          opacity: 0;
          animation-duration: 420ms;
          animation-name: tw-settings-panel-in;
        }

        .tw-settings-subtle-in {
          opacity: 0;
          animation-duration: 320ms;
          animation-name: tw-settings-subtle-in;
        }

        .tw-motion-hero-in {
          opacity: 0;
          animation-duration: 520ms;
          animation-name: tw-mobile-hero-in;
        }

        .tw-settings-toast-in {
          opacity: 0;
          animation-duration: 280ms;
          animation-name: tw-settings-toast-in;
        }

        .tw-motion-stagger {
          --tw-motion-delay: 0ms;
          --tw-motion-step: 55ms;
        }

        .tw-motion-stagger-panel > * {
          animation-duration: 360ms;
          animation-name: tw-settings-panel-in;
        }

        .tw-motion-stagger-subtle > * {
          animation-duration: 320ms;
          animation-name: tw-settings-subtle-in;
        }

        .tw-motion-stagger-hero > * {
          animation-duration: 440ms;
          animation-name: tw-mobile-hero-in;
        }

        .tw-motion-stagger > * {
          opacity: 0;
          animation-delay: calc(
            var(--tw-motion-delay, 0ms) +
            var(--tw-motion-stagger-index, 0) * var(--tw-motion-step, 55ms)
          );
        }

        .tw-motion-showcase-halo {
          animation: tw-mobile-showcase-halo 2.8s ease-in-out infinite;
          transform-origin: center;
        }

        .tw-mobile-shell-enter {
          animation: tw-mobile-shell-in 360ms cubic-bezier(0.22, 1, 0.36, 1) both;
        }

        .tw-mobile-bottom-nav-enter {
          animation: tw-mobile-bottom-nav-in 420ms cubic-bezier(0.22, 1, 0.36, 1) both;
        }

        .tw-mobile-nav-item {
          transform-origin: center bottom;
          transition-timing-function: cubic-bezier(0.22, 1, 0.36, 1);
        }

        .tw-motion-overlay,
        .tw-motion-surface {
          will-change: opacity, transform;
          animation-fill-mode: forwards;
          animation-timing-function: cubic-bezier(0.22, 1, 0.36, 1);
        }

        .tw-motion-overlay[data-motion-state="opening"],
        .tw-motion-overlay[data-motion-state="open"] {
          animation-duration: 220ms;
          animation-name: tw-mobile-overlay-in;
        }

        .tw-motion-overlay[data-motion-state="closing"] {
          animation-duration: 220ms;
          animation-name: tw-mobile-overlay-out;
        }

        .tw-motion-modal-surface[data-motion-state="opening"],
        .tw-motion-modal-surface[data-motion-state="open"] {
          animation-duration: 320ms;
          animation-name: tw-mobile-modal-in;
        }

        .tw-motion-modal-surface[data-motion-state="closing"] {
          animation-duration: 220ms;
          animation-name: tw-mobile-modal-out;
        }

        .tw-motion-sheet-surface[data-motion-state="opening"],
        .tw-motion-sheet-surface[data-motion-state="open"] {
          animation-duration: 340ms;
          animation-name: tw-mobile-sheet-in;
        }

        .tw-motion-sheet-surface[data-motion-state="closing"] {
          animation-duration: 240ms;
          animation-name: tw-mobile-sheet-out;
        }

        ${staggerIndexStyles}

        @media (prefers-reduced-motion: reduce) {
          .tw-motion-node,
          .tw-motion-stagger > *,
          .tw-motion-overlay,
          .tw-motion-surface,
          .tw-mobile-shell-enter,
          .tw-mobile-bottom-nav-enter {
            animation-delay: 0ms !important;
            animation-duration: 1ms !important;
            transition-duration: 1ms !important;
          }

          .tw-motion-showcase-halo {
            animation: none !important;
          }
        }
      `}
    </style>
  );
}

export function MotionPage({
  children,
  className,
  delay = 0,
  includeStyles = false,
  variant = "default",
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  includeStyles?: boolean;
  variant?: "default" | "showcase";
}) {
  const content = (
    <div
      className={joinClasses(
        "tw-motion-page-root tw-motion-node",
        variant === "showcase" ? "tw-motion-page-showcase" : "tw-motion-page",
        className,
      )}
      style={
        {
          "--tw-motion-delay": `${delay}ms`,
        } as CSSProperties
      }
    >
      {children}
    </div>
  );

  if (includeStyles) {
    return (
      <>
        <SettingsMotionStyles />
        {content}
      </>
    );
  }

  return content;
}

export function MotionPanel({
  children,
  className,
  delay = 0,
  variant = "panel",
  ...rest
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  variant?: "panel" | "subtle" | "toast" | "hero";
} & HTMLAttributes<HTMLDivElement>) {
  const motionClass =
    variant === "toast"
      ? "tw-settings-toast-in"
      : variant === "hero"
        ? "tw-motion-hero-in"
      : variant === "subtle"
        ? "tw-settings-subtle-in"
        : "tw-settings-panel-in";

  return (
    <div
      className={joinClasses("tw-motion-node", motionClass, className)}
      {...rest}
      style={
        {
          "--tw-motion-delay": `${delay}ms`,
        } as CSSProperties
      }
    >
      {children}
    </div>
  );
}

export function MotionStagger({
  children,
  className,
  delay = 0,
  step = 55,
  style,
  variant = "subtle",
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  step?: number;
  style?: CSSProperties;
  variant?: "panel" | "subtle" | "hero";
}) {
  return (
    <div
      className={joinClasses(
        "tw-motion-stagger",
        variant === "hero"
          ? "tw-motion-stagger-hero"
          : variant === "panel"
            ? "tw-motion-stagger-panel"
            : "tw-motion-stagger-subtle",
        className,
      )}
      style={
        {
          "--tw-motion-delay": `${delay}ms`,
          "--tw-motion-step": `${step}ms`,
          ...style,
        } as CSSProperties
      }
    >
      {children}
    </div>
  );
}

type MotionPresenceState = "closed" | "opening" | "open" | "closing";

export function useMotionPresence(
  isOpen: boolean,
  {
    exitDurationMs = 240,
    settleDelayMs = 18,
  }: {
    exitDurationMs?: number;
    settleDelayMs?: number;
  } = {},
) {
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [motionState, setMotionState] = useState<MotionPresenceState>(
    isOpen ? "opening" : "closed",
  );

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      setMotionState("opening");
      const settleTimer = globalThis.setTimeout(() => {
        setMotionState("open");
      }, settleDelayMs);
      return () => globalThis.clearTimeout(settleTimer);
    }

    if (!shouldRender) {
      setMotionState("closed");
      return;
    }

    setMotionState("closing");
    const closeTimer = globalThis.setTimeout(() => {
      setShouldRender(false);
      setMotionState("closed");
    }, exitDurationMs);
    return () => globalThis.clearTimeout(closeTimer);
  }, [exitDurationMs, isOpen, settleDelayMs, shouldRender]);

  return {
    motionState,
    shouldRender,
  };
}

export function StatusChip({
  children,
  icon,
  tone = "neutral",
}: {
  children: ReactNode;
  icon?: string;
  tone?: "neutral" | "success" | "warning";
}) {
  const toneClass =
    tone === "success"
      ? "bg-primary-container/60 text-primary"
      : tone === "warning"
        ? "bg-tertiary-container/55 text-on-tertiary-container"
        : "bg-surface-container-high text-on-surface-variant";

  return (
    <span
      className={joinClasses(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-[0.02em]",
        toneClass,
      )}
    >
      {icon ? <MaterialSymbol className="text-[13px]" name={icon} /> : null}
      {children}
    </span>
  );
}
