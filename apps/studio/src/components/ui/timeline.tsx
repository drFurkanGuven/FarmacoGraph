import * as React from "react";
import { cn } from "@/lib/utils";

export interface TimelineItem {
  /** Unique item id */
  id: string;
  /** Primary label */
  title: string;
  /** Secondary description */
  description?: string;
  /** Timestamp or meta text */
  timestamp?: string;
  /** Optional leading icon */
  icon?: React.ReactNode;
}

export interface TimelineProps extends React.HTMLAttributes<HTMLOListElement> {
  items: TimelineItem[];
}

/**
 * Vertical timeline for activity feeds and audit logs.
 */
function Timeline({ items, className, ...props }: TimelineProps) {
  return (
    <ol className={cn("relative space-y-0", className)} {...props}>
      {items.map((item, index) => {
        const isLast = index === items.length - 1;

        return (
          <li key={item.id} className="relative flex gap-4 pb-8 last:pb-0">
            {!isLast && <span className="absolute left-[15px] top-8 h-[calc(100%-1rem)] w-px bg-border" aria-hidden />}
            <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-background text-muted-foreground">
              {item.icon ?? <span className="h-2 w-2 rounded-full bg-primary" />}
            </div>
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-medium leading-none">{item.title}</p>
                {item.timestamp && (
                  <time className="shrink-0 text-xs text-muted-foreground tabular-nums">{item.timestamp}</time>
                )}
              </div>
              {item.description && <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export { Timeline };
