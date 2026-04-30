import { cn } from "../utils";
import { MaterialSymbol } from "./MaterialSymbol";
import type { AccountSummaryCardData, AccountSurfaceTone } from "../types";

const toneStyles: Record<
  AccountSurfaceTone,
  {
    card: string;
    orb: string;
    icon: string;
    institution: string;
    balance: string;
    mask: string;
  }
> = {
  primary: {
    card: "bg-primary text-on-primary",
    orb: "-right-10 -top-10 bg-white/10",
    icon: "text-on-primary",
    institution: "text-on-primary",
    balance: "text-on-primary",
    mask: "text-on-primary/80"
  },
  tertiary: {
    card: "bg-tertiary text-on-tertiary",
    orb: "-right-10 -bottom-10 bg-white/10",
    icon: "text-on-tertiary",
    institution: "text-on-tertiary",
    balance: "text-on-tertiary",
    mask: "text-on-tertiary/80"
  },
  secondary: {
    card: "bg-secondary text-on-secondary",
    orb: "-left-10 -bottom-10 bg-white/10",
    icon: "text-on-secondary",
    institution: "text-on-secondary",
    balance: "text-on-secondary",
    mask: "text-on-secondary/80"
  },
  surface: {
    card: "border border-outline-variant/30 bg-surface-container-high text-on-surface",
    orb: "",
    icon: "text-outline",
    institution: "text-on-surface-variant",
    balance: "text-on-surface",
    mask: "text-on-surface-variant"
  }
};

export interface AccountCardProps {
  account: AccountSummaryCardData;
  onPress?: (account: AccountSummaryCardData) => void;
  className?: string;
}

export function AccountCard({
  account,
  onPress,
  className
}: AccountCardProps) {
  const styles = toneStyles[account.tone];
  const Comp = onPress ? "button" : "article";

  return (
    <Comp
      className={cn(
        "relative flex min-h-40 min-w-[280px] flex-col justify-between overflow-hidden rounded-[20px] p-5 text-left shadow-[0_4px_20px_rgba(46,50,48,0.06)]",
        styles.card,
        onPress && "active:scale-[0.99]",
        className
      )}
      onClick={onPress ? () => onPress(account) : undefined}
      type={onPress ? "button" : undefined}
    >
      {styles.orb ? (
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute h-32 w-32 rounded-full blur-2xl",
            styles.orb,
          )}
        />
      ) : null}

      <div className="relative z-10 flex items-start justify-between gap-4">
        <div className={cn("font-headline font-medium", styles.institution)}>
          {account.institutionName}
        </div>
        <MaterialSymbol
          className={cn("text-[22px]", styles.icon)}
          filled
          name={account.icon}
        />
      </div>

      <div className="relative z-10">
        <div className={cn("mb-1 font-headline text-2xl font-semibold", styles.balance)}>
          {account.balanceDisplay}
        </div>
        <div className={cn("text-xs", styles.mask)}>{account.maskedAccountNumber}</div>
      </div>
    </Comp>
  );
}
