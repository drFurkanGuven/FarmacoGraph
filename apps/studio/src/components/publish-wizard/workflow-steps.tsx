import { Check, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WorkflowStepDefinition } from "./types";

export const WORKFLOW_STEPS: WorkflowStepDefinition[] = [
  { id: "draft", label: "Draft", description: "Edit and validate the package" },
  { id: "review", label: "Review", description: "Submitted for curator review" },
  { id: "approved", label: "Approved", description: "Ready to publish to the graph" },
  { id: "published", label: "Published", description: "Live in the knowledge graph" },
];

function stepIndex(state: string | null): number {
  const index = WORKFLOW_STEPS.findIndex((step) => step.id === state);
  return index >= 0 ? index : 0;
}

export interface WorkflowStepperProps {
  workflowState: string | null;
  className?: string;
}

export function WorkflowStepper({ workflowState, className }: WorkflowStepperProps) {
  const currentIndex = stepIndex(workflowState);

  return (
    <ol className={cn("grid gap-2 sm:grid-cols-4", className)}>
      {WORKFLOW_STEPS.map((step, index) => {
        const completed = index < currentIndex;
        const active = index === currentIndex;
        const upcoming = index > currentIndex;

        return (
          <li
            key={step.id}
            className={cn(
              "rounded-lg border px-3 py-2 text-sm transition-colors",
              active && "border-primary bg-primary/5",
              completed && "border-emerald-500/40 bg-emerald-500/5",
              upcoming && "border-border bg-muted/20 text-muted-foreground",
            )}
          >
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-medium",
                  completed && "border-emerald-500 bg-emerald-500 text-white",
                  active && "border-primary bg-primary text-primary-foreground",
                  upcoming && "border-muted-foreground/30 text-muted-foreground",
                )}
              >
                {completed ? <Check className="h-3.5 w-3.5" /> : active ? <Circle className="h-3 w-3 fill-current" /> : index + 1}
              </span>
              <div className="min-w-0">
                <p className="font-medium">{step.label}</p>
                <p className="text-xs text-muted-foreground">{step.description}</p>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
