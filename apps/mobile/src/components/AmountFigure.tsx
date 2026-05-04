import type { CurrencyLabelPreference } from "../preferences/displayPreferences";

function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

const amountFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const compactAmountFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export function formatCurrencyAmount(
  amountMinor: number,
  {
    compact = false,
    signed = false,
  }: {
    compact?: boolean;
    signed?: boolean;
  } = {},
): string {
  const numericValue = amountMinor / 100;
  const formatter = compact ? compactAmountFormatter : amountFormatter;
  const sign = signed
    ? numericValue > 0
      ? "+"
      : numericValue < 0
        ? "-"
        : ""
    : "";

  return `${sign}${formatter.format(Math.abs(numericValue))}`;
}

export function AmountFigure({
  amountMinor,
  currencyLabel = "ETB",
  compact = false,
  signed = false,
  className,
  valueClassName,
  labelClassName,
}: {
  amountMinor: number;
  currencyLabel?: CurrencyLabelPreference;
  compact?: boolean;
  signed?: boolean;
  className?: string;
  valueClassName?: string;
  labelClassName?: string;
}) {
  return (
    <div className={cn("inline-flex items-end gap-1.5", className)}>
      <span
        className={cn(
          "font-headline text-3xl font-semibold leading-none tracking-tight text-on-surface",
          valueClassName,
        )}
      >
        {formatCurrencyAmount(amountMinor, { compact, signed })}
      </span>
      <span
        className={cn(
          "translate-y-[-1px] text-[9px] font-semibold uppercase tracking-[0.16em] text-on-surface-variant/85",
          labelClassName,
        )}
      >
        {currencyLabel}
      </span>
    </div>
  );
}
