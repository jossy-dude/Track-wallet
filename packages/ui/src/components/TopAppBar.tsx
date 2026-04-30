import { cn } from "../utils";
import { MaterialSymbol } from "./MaterialSymbol";
import type { TopAppBarAction, TopAppBarProfile } from "../types";

export interface TopAppBarProps {
  brandLabel: string;
  profile: TopAppBarProfile;
  action: TopAppBarAction;
  className?: string;
}

export function TopAppBar({
  brandLabel,
  profile,
  action,
  className
}: TopAppBarProps) {
  return (
    <header
      className={cn(
        "sticky top-0 z-40 flex w-full items-center justify-between bg-background px-6 py-4 shadow-[0_4px_20px_rgba(46,50,48,0.06)]",
        className
      )}
    >
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 overflow-hidden rounded-full border-2 border-primary-container">
          <img
            alt={profile.avatarAlt}
            className="h-full w-full object-cover"
            src={profile.avatarUrl}
          />
        </div>
        <h1 className="font-headline text-lg font-bold tracking-tight text-primary">
          {brandLabel}
        </h1>
      </div>

      <button
        aria-label={action.label}
        className="flex h-12 w-12 items-center justify-center rounded-full text-primary transition-colors active:scale-95"
        onClick={action.onPress}
        type="button"
      >
        <MaterialSymbol className="text-[24px]" name={action.icon} />
      </button>
    </header>
  );
}
