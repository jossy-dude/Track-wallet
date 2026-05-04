import { cn } from "../utils";
import { MaterialSymbol } from "./MaterialSymbol";
import type { TopAppBarAction, TopAppBarProfile } from "../types";

export interface TopAppBarProps {
  brandLabel: string;
  profile: TopAppBarProfile;
  actions: readonly TopAppBarAction[];
  className?: string;
}

function buildAvatarFallback(label: string) {
  const initials = label
    .trim()
    .split(/\s+/)
    .filter((part) => part.length > 0)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return initials.length > 0 ? initials : "TW";
}

export function TopAppBar({
  brandLabel,
  profile,
  actions,
  className
}: TopAppBarProps) {
  return (
    <header
      className={cn(
        "tw-mobile-shell-enter sticky top-0 z-40 flex w-full items-center justify-between bg-background px-6 py-4 shadow-[0_4px_20px_rgba(46,50,48,0.06)]",
        className
      )}
    >
      <div className="flex items-center gap-3">
        <div
          aria-label={profile.avatarAlt}
          className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border-2 border-primary-container bg-primary-container/75 text-xs font-bold uppercase tracking-[0.14em] text-primary"
        >
          {profile.avatarUrl ? (
            <img
              alt={profile.avatarAlt}
              className="h-full w-full object-cover"
              src={profile.avatarUrl}
            />
          ) : (
            <span>{buildAvatarFallback(profile.avatarFallbackLabel)}</span>
          )}
        </div>
        <h1 className="font-headline text-lg font-bold tracking-tight text-primary">
          {brandLabel}
        </h1>
      </div>

      <div className="flex items-center gap-2">
        {actions.map((action) =>
          action.variant === "pill" ? (
            <button
              aria-label={action.label}
              className="tw-mobile-nav-item inline-flex min-h-11 items-center gap-2 rounded-full border border-tertiary-container/55 bg-tertiary-container/35 px-3 py-2 text-sm font-semibold text-on-surface transition-colors active:scale-95"
              key={`${action.label}-${action.icon}`}
              onClick={action.onPress}
              type="button"
            >
              <MaterialSymbol className="text-[20px]" filled name={action.icon} />
              <span>{action.label}</span>
            </button>
          ) : (
            <button
              aria-label={action.label}
              className="tw-mobile-nav-item flex h-12 w-12 items-center justify-center rounded-full text-primary transition-colors active:scale-95"
              key={`${action.label}-${action.icon}`}
              onClick={action.onPress}
              type="button"
            >
              <MaterialSymbol className="text-[24px]" name={action.icon} />
            </button>
          ),
        )}
      </div>
    </header>
  );
}
