import { cn } from "../utils";
import type { MaterialSymbolName } from "../types";

interface MaterialSymbolProps {
  name: MaterialSymbolName;
  filled?: boolean;
  className?: string;
}

export function MaterialSymbol({
  name,
  filled = false,
  className
}: MaterialSymbolProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "pointer-events-none material-symbols-outlined select-none leading-none",
        className,
      )}
      style={{ fontVariationSettings: `'FILL' ${filled ? 1 : 0}` }}
    >
      {name}
    </span>
  );
}
