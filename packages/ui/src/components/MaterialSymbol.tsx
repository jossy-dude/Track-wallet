import { cn } from "../utils";
import type { MaterialSymbolName } from "../types";
import { getMaterialSymbolAsset } from "./materialSymbolRegistry";

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
  const { content, isFallback } = getMaterialSymbolAsset(name, filled);

  return (
    <span
      aria-hidden="true"
      data-fallback={isFallback ? "true" : undefined}
      data-icon={name}
      className={cn(
        "pointer-events-none inline-flex items-center justify-center select-none leading-none",
        className,
      )}
    >
      <svg
        fill="none"
        focusable="false"
        height="1em"
        viewBox="0 0 24 24"
        width="1em"
      >
        {content}
      </svg>
    </span>
  );
}
