"use client";

import { useState } from "react";
import { Check, Loader2, MessageSquareWarning, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api";
import type { WorkflowItem } from "@/lib/api/types";
import { usePermissions } from "@/lib/auth/hooks";
import { useApiClient } from "@/lib/hooks/use-api-client";

export interface UnpublishRequestControlsProps {
  workflow: WorkflowItem | null | undefined;
  onWorkflowUpdated: (workflow: WorkflowItem) => void;
}

export function UnpublishRequestControls({
  workflow,
  onWorkflowUpdated,
}: UnpublishRequestControlsProps) {
  const client = useApiClient();
  const { hasPermission } = usePermissions();
  const isAdmin = hasPermission("admin:org");
  const [requestOpen, setRequestOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [rejectNotes, setRejectNotes] = useState("");
  const [busy, setBusy] = useState(false);

  if (!workflow || workflow.state !== "published") {
    return null;
  }

  const pending = Boolean(workflow.unpublish_requested_at);

  async function handleRequest(event: React.FormEvent) {
    event.preventDefault();
    if (!workflow?.id || busy) return;
    const reason = notes.trim();
    if (!reason) {
      toast.error("A reason is required to request unpublish.");
      return;
    }
    setBusy(true);
    try {
      const envelope = await client.requestUnpublish(workflow.id, { notes: reason });
      onWorkflowUpdated(envelope.data);
      setRequestOpen(false);
      setNotes("");
      toast.success("Unpublish request sent to administrators.");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not request unpublish.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCancel() {
    if (!workflow?.id || busy) return;
    setBusy(true);
    try {
      const envelope = await client.cancelUnpublishRequest(workflow.id);
      onWorkflowUpdated(envelope.data);
      toast.success("Unpublish request cancelled.");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not cancel request.");
    } finally {
      setBusy(false);
    }
  }

  async function handleApprove() {
    if (!workflow?.id || busy) return;
    setBusy(true);
    try {
      const envelope = await client.returnWorkflowToDraft(workflow.id);
      onWorkflowUpdated(envelope.data);
      toast.success("Unpublished — editing unlocked.");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not approve unpublish.");
    } finally {
      setBusy(false);
    }
  }

  async function handleReject(event: React.FormEvent) {
    event.preventDefault();
    if (!workflow?.id || busy) return;
    setBusy(true);
    try {
      const envelope = await client.rejectUnpublishRequest(workflow.id, {
        notes: rejectNotes.trim() || undefined,
      });
      onWorkflowUpdated(envelope.data);
      setRejectOpen(false);
      setRejectNotes("");
      toast.success("Unpublish request rejected.");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not reject request.");
    } finally {
      setBusy(false);
    }
  }

  if (pending) {
    return (
      <>
        <Badge variant="warning" className="gap-1">
          <MessageSquareWarning className="h-3 w-3" />
          Unpublish requested
        </Badge>
        {isAdmin ? (
          <>
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => void handleApprove()}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Approve unpublish
            </Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => setRejectOpen(true)}>
              <X className="h-4 w-4" />
              Reject
            </Button>
          </>
        ) : (
          <Button size="sm" variant="outline" disabled={busy} onClick={() => void handleCancel()}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
            Cancel request
          </Button>
        )}
        {workflow.unpublish_request_notes ? (
          <span className="max-w-[220px] truncate text-xs text-muted-foreground" title={workflow.unpublish_request_notes}>
            {workflow.unpublish_request_notes}
          </span>
        ) : null}

        <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
          <DialogContent>
            <form onSubmit={(event) => void handleReject(event)}>
              <DialogHeader>
                <DialogTitle>Reject unpublish request</DialogTitle>
                <DialogDescription>
                  The package stays published. Optionally explain why the request was rejected.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2 py-4">
                <Label htmlFor="reject-notes">Reason (optional)</Label>
                <Textarea
                  id="reject-notes"
                  value={rejectNotes}
                  onChange={(event) => setRejectNotes(event.target.value)}
                  rows={3}
                  maxLength={2000}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setRejectOpen(false)}>
                  Back
                </Button>
                <Button type="submit" disabled={busy}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Reject request
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  if (isAdmin) {
    return null;
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setRequestOpen(true)}>
        <MessageSquareWarning className="h-4 w-4" />
        Request unpublish
      </Button>
      <Dialog open={requestOpen} onOpenChange={setRequestOpen}>
        <DialogContent>
          <form onSubmit={(event) => void handleRequest(event)}>
            <DialogHeader>
              <DialogTitle>Request unpublish</DialogTitle>
              <DialogDescription>
                Only administrators can unpublish. Describe why this published package needs to return
                to draft.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 py-4">
              <Label htmlFor="unpublish-notes">Reason</Label>
              <Textarea
                id="unpublish-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={4}
                required
                maxLength={2000}
                placeholder="e.g. Incorrect indication linkage; need to revise before re-publish"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRequestOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy || !notes.trim()}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Send request
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
