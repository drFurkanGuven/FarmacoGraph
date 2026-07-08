"use client";

import { ExternalLink, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfidenceBadge } from "@/components/ui/confidence-badge";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { ErrorState } from "@/components/ui/error-state";
import { ListSkeleton } from "@/components/ui/loading-skeleton";
import { Separator } from "@/components/ui/separator";
import { ApiError } from "@/lib/api";
import { EvidenceTypeBadge } from "./evidence-type-badge";
import { useEvidenceDetail } from "./hooks/use-evidence-browser";
import { qualityToConfidenceLevel } from "./utils";

interface EvidenceDetailDrawerProps {
  evidenceId: string | null;
  open: boolean;
  onClose: () => void;
  onEdit: (id: string) => void;
}

function DetailField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="text-sm">{value}</div>
    </div>
  );
}

export function EvidenceDetailDrawer({ evidenceId, open, onClose, onEdit }: EvidenceDetailDrawerProps) {
  const detailQuery = useEvidenceDetail(open ? evidenceId : null);
  const record = detailQuery.data?.data;
  const confidence = qualityToConfidenceLevel(record?.quality_score ?? record?.confidence_score ?? null);

  const errorMessage =
    detailQuery.error instanceof ApiError
      ? detailQuery.error.message
      : "Failed to load evidence detail.";

  return (
    <Drawer open={open} onOpenChange={(next) => !next && onClose()}>
      <DrawerContent side="right" className="max-w-lg">
        <DrawerHeader>
          <DrawerTitle>{record?.title ?? record?.label ?? "Evidence detail"}</DrawerTitle>
          <DrawerDescription>
            Loaded from GET /evidence/{"{id}"} when the endpoint is available.
          </DrawerDescription>
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto px-6 pb-4">
          {detailQuery.isLoading ? (
            <ListSkeleton rows={6} />
          ) : detailQuery.error ? (
            <ErrorState
              message={errorMessage}
              onRetry={() => void detailQuery.refetch()}
              variant="inline"
            />
          ) : record ? (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <EvidenceTypeBadge type={record.evidence_type} />
                {confidence && (
                  <ConfidenceBadge
                    level={confidence}
                    score={
                      record.quality_score !== undefined && record.quality_score !== null
                        ? Math.round(record.quality_score * 100)
                        : undefined
                    }
                  />
                )}
                {record.status && <Badge variant="secondary">{record.status}</Badge>}
              </div>

              <Separator />

              <DetailField label="ID" value={<code className="text-xs">{record.id}</code>} />
              {record.year && <DetailField label="Year" value={record.year} />}
              {record.journal && <DetailField label="Journal" value={record.journal} />}
              {Array.isArray(record.authors) && record.authors.length > 0 && (
                <DetailField label="Authors" value={record.authors.join(", ")} />
              )}
              {record.supports_claim && (
                <DetailField label="Supports claim" value={record.supports_claim} />
              )}
              {record.extract && <DetailField label="Extract" value={record.extract} />}

              {typeof record.url === "string" && record.url && (
                <a
                  href={record.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  Source URL
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No evidence selected.</p>
          )}
        </div>

        <DrawerFooter className="border-t">
          <Button
            variant="outline"
            disabled={!evidenceId}
            onClick={() => evidenceId && onEdit(evidenceId)}
          >
            <Pencil className="h-4 w-4" />
            Edit
          </Button>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
