import type { AuditLogItem } from "@/lib/api/types";

/** Map workspace slug to API module parameter. */
export function resolveModuleSlug(workspaceSlug: string): string {
  return workspaceSlug === "default" ? "cardiovascular" : workspaceSlug;
}

export function formatRelativeTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";

  const deltaMs = Date.now() - date.getTime();
  const minutes = Math.floor(deltaMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function describeAuditEntry(entry: AuditLogItem): string {
  const resource = entry.resource_type.toLowerCase();
  const resourceId = entry.resource_id ?? "unknown";
  switch (entry.action) {
    case "create":
      return `Created ${resource} ${resourceId}`;
    case "update":
      return `Updated ${resource} ${resourceId}`;
    case "delete":
      return `Deleted ${resource} ${resourceId}`;
    case "publish":
      return `Published ${resource} ${resourceId}`;
    case "transition":
      return `Workflow change on ${resourceId}`;
    default:
      return `${entry.action} · ${resource} ${resourceId}`;
  }
}

export function jobStatusLabel(status: string): string {
  return status.replace(/_/g, " ");
}
