import { AlertTriangle, CircleAlert, FileWarning, Scale, ShieldAlert } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  ListSkeleton,
} from "@/components/ui";
import type { ValidationIssue } from "./validation-types";
import { formatIssueLocation, issueKey } from "./validation-utils";

interface ValidationIssueSectionProps {
  title: string;
  description: string;
  issues: ValidationIssue[];
  loading?: boolean;
  emptyTitle: string;
  emptyDescription: string;
  icon?: "error" | "warning" | "ontology" | "evidence";
}

const ICONS = {
  error: CircleAlert,
  warning: AlertTriangle,
  ontology: ShieldAlert,
  evidence: FileWarning,
} as const;

function IssueRow({ issue }: { issue: ValidationIssue }) {
  const location = formatIssueLocation(issue);

  return (
    <li className="rounded-md border px-3 py-2 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        {issue.constraint_id && (
          <span className="font-mono text-xs text-muted-foreground">{issue.constraint_id}</span>
        )}
        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {issue.level}
        </span>
        {issue.severity !== "error" && (
          <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-700 dark:text-amber-400">
            {issue.severity}
          </span>
        )}
      </div>
      <p className="mt-1">{issue.message}</p>
      {location && <p className="mt-1 font-mono text-xs text-muted-foreground">{location}</p>}
    </li>
  );
}

export function ValidationIssueSection({
  title,
  description,
  issues,
  loading,
  emptyTitle,
  emptyDescription,
  icon = "error",
}: ValidationIssueSectionProps) {
  const Icon = ICONS[icon];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="h-4 w-4" />
          {title}
          {!loading && (
            <span className="ml-auto text-sm font-normal tabular-nums text-muted-foreground">
              {issues.length}
            </span>
          )}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <ListSkeleton rows={3} />
        ) : issues.length > 0 ? (
          <ul className="space-y-2">
            {issues.map((issue, index) => (
              <IssueRow key={issueKey(issue, index)} issue={issue} />
            ))}
          </ul>
        ) : (
          <EmptyState
            title={emptyTitle}
            description={emptyDescription}
            icon={<Scale className="h-6 w-6" />}
            className="py-8"
          />
        )}
      </CardContent>
    </Card>
  );
}
