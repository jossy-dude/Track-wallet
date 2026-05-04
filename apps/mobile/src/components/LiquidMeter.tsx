import type { CSSProperties } from "react";

type LiquidTone = "primary" | "tertiary" | "secondary" | "danger";
type LiquidOrientation = "horizontal" | "vertical";

const toneStyles: Record<
  LiquidTone,
  { fill: string; glow: string; track: string }
> = {
  primary: {
    fill: "from-[#9dde74] via-[#58c653] to-[#2f9d44]",
    glow: "bg-white/30",
    track: "bg-[#e7ecef]",
  },
  tertiary: {
    fill: "from-[#9ff0e5] via-[#4fd9cf] to-[#1aaea5]",
    glow: "bg-white/28",
    track: "bg-[#e7ecef]",
  },
  secondary: {
    fill: "from-[#98a1ff] via-[#5c61ff] to-[#4249db]",
    glow: "bg-white/28",
    track: "bg-[#e7ecef]",
  },
  danger: {
    fill: "from-[#c56b67] via-[#8b3330] to-[#63211f]",
    glow: "bg-white/18",
    track: "bg-[#eadbdb]",
  },
};

export interface LiquidMeterProps {
  progressPercent: number;
  tone: LiquidTone;
  orientation?: LiquidOrientation;
  className?: string;
  fillClassName?: string;
}

function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

const liquidMotionCss = `
@keyframes track-wallet-liquid-wave {
  0%, 100% { transform: translateX(-18%) translateY(1%); }
  50% { transform: translateX(18%) translateY(-9%); }
}

@keyframes track-wallet-liquid-glow {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 0.92; }
}

@keyframes track-wallet-liquid-rise-x {
  from { width: 0%; }
  to { width: var(--liquid-target); }
}

@keyframes track-wallet-liquid-rise-y {
  from { height: 0%; }
  to { height: var(--liquid-target); }
}

.track-wallet-liquid-wave {
  animation: track-wallet-liquid-wave 4.2s ease-in-out infinite;
}

.track-wallet-liquid-wave-delayed {
  animation: track-wallet-liquid-wave 5.8s ease-in-out infinite reverse;
}

.track-wallet-liquid-glow {
  animation: track-wallet-liquid-glow 3.2s ease-in-out infinite;
}

.track-wallet-liquid-fill-horizontal {
  animation: track-wallet-liquid-rise-x 700ms cubic-bezier(0.2, 0.9, 0.22, 1) both;
}

.track-wallet-liquid-fill-vertical {
  animation: track-wallet-liquid-rise-y 820ms cubic-bezier(0.2, 0.9, 0.22, 1) both;
}
`;

export function LiquidMeter({
  progressPercent,
  tone,
  orientation = "horizontal",
  className,
  fillClassName,
}: LiquidMeterProps) {
  const style = toneStyles[tone];
  const clampedProgress = Math.max(0, Math.min(100, progressPercent));
  const targetPercent =
    clampedProgress <= 0
      ? "0%"
      : `${Math.max(orientation === "vertical" ? 12 : 8, clampedProgress)}%`;
  const fillStyle =
    orientation === "vertical"
      ? ({
          height: targetPercent,
          ["--liquid-target" as string]: targetPercent,
        } as CSSProperties)
      : ({
          width: targetPercent,
          ["--liquid-target" as string]: targetPercent,
        } as CSSProperties);

  return (
    <>
      <style>{liquidMotionCss}</style>
      <div
        className={cn(
          "relative overflow-hidden rounded-full",
          style.track,
          className,
        )}
      >
        <div
          className={cn(
            "absolute bottom-0 left-0 overflow-hidden rounded-full",
            orientation === "vertical" ? "right-0" : "top-0",
            orientation === "vertical"
              ? "track-wallet-liquid-fill-vertical"
              : "track-wallet-liquid-fill-horizontal",
            fillClassName,
          )}
          style={fillStyle}
        >
          <div
            className={cn(
              "absolute inset-0 bg-gradient-to-r",
              style.fill,
              orientation === "vertical" ? "bg-gradient-to-t" : "",
            )}
          />
          <div
            className={cn(
              "track-wallet-liquid-wave absolute left-[-18%] top-[8%] h-[44%] w-[136%] rounded-full blur-[1px]",
              style.glow,
            )}
          />
          <div
            className={cn(
              "track-wallet-liquid-wave-delayed track-wallet-liquid-glow absolute left-[-10%] top-[34%] h-[36%] w-[122%] rounded-full bg-white/20",
            )}
          />
        </div>
      </div>
    </>
  );
}
