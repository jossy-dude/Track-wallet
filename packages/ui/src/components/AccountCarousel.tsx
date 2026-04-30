import { cn } from "../utils";
import { AccountCard } from "./AccountCard";
import type { AccountSummaryCardData } from "../types";

export interface AccountCarouselProps {
  title: string;
  accounts: readonly AccountSummaryCardData[];
  onAccountPress?: (account: AccountSummaryCardData) => void;
  className?: string;
}

export function AccountCarousel({
  title,
  accounts,
  onAccountPress,
  className
}: AccountCarouselProps) {
  return (
    <section className={cn("flex flex-col gap-4", className)}>
      <h3 className="px-2 font-headline text-lg font-semibold text-on-surface">
        {title}
      </h3>

      <div className="-mx-2 flex items-stretch gap-4 overflow-x-auto px-2 pb-4 no-scrollbar">
        {accounts.length > 0 ? (
          accounts.map((account) => (
            <AccountCard
              account={account}
              key={account.id}
              onPress={onAccountPress}
            />
          ))
        ) : (
          <div className="flex min-h-40 w-full items-center rounded-[20px] border border-dashed border-outline-variant bg-surface-container-low p-5 text-sm text-on-surface-variant">
            No synced accounts yet. Queue and approve SMS entries to rebuild this view.
          </div>
        )}
      </div>
    </section>
  );
}
