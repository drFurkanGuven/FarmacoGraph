"use client";

import * as React from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

export interface SearchInputProps extends Omit<React.ComponentProps<typeof Input>, "type"> {
  /** Called when the clear button is clicked */
  onClear?: () => void;
  /** Show clear button when value is non-empty */
  clearable?: boolean;
  /** Container className */
  containerClassName?: string;
}

/**
 * Standalone search input with icon and optional clear action.
 */
const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  ({ className, containerClassName, value, onClear, clearable = true, ...props }, ref) => {
    const hasValue = value !== undefined && value !== "";

    return (
      <div className={cn("relative", containerClassName)}>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={ref}
          type="search"
          value={value}
          className={cn("pl-9", clearable && hasValue && "pr-9", className)}
          {...props}
        />
        {clearable && hasValue && onClear && (
          <button
            type="button"
            onClick={onClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-1 text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Clear search"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    );
  },
);
SearchInput.displayName = "SearchInput";

export { SearchInput };
