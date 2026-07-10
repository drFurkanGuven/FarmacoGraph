"use client";

import { useState } from "react";
import Link from "next/link";
import { Archive, ArrowLeft, Loader2, Lock, Rocket, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { PublishWizard } from "@/components/publish-wizard";
import { AutosaveStatus } from "@/components/drug-editor/autosave-status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { TableSkeleton } from "@/components/ui/loading-skeleton";
import { EntityEditorShell } from "@/components/entity-editor";
import { ApiError } from "@/lib/api";
import { usePermissions } from "@/lib/auth/hooks";
import { useApiClient } from "@/lib/hooks/use-api-client";
import { DiseaseContextPanel } from "./disease-context-panel";
import { DiseaseSectionEditor } from "./disease-section-editor";
import { useDiseaseEditor } from "./use-disease-editor";

export function DiseaseEditorWorkspace({ diseaseSlug }: { diseaseSlug: string }) {
  const client = useApiClient();
  const { hasPermission } = usePermissions();
  const isAdmin = hasPermission("admin:org");
  const editor = useDiseaseEditor({ diseaseSlug });
  const [publishOpen, setPublishOpen] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [deprecating, setDeprecating] = useState(false);

  if (editor.loading) {
    return <TableSkeleton rows={6} />;
  }

  if (editor.loadError) {
    return (
      <ErrorState
        title="Unable to open disease editor"
        message={editor.loadError}
        onRetry={editor.retryLoad}
      />
    );
  }

  const { snapshot } = editor;
  const workflow = snapshot.workflow;
  const workflowState = workflow?.state ?? null;
  const packageLocked =
    workflowState === "approved" || workflowState === "published" || workflowState === "deprecated";

  async function handleReturnToDraft() {
    if (!workflow?.id || unlocking) return;
    setUnlocking(true);
    try {
      const envelope = await client.returnWorkflowToDraft(workflow.id);
      editor.onWorkflowUpdated(envelope.data);
      toast.success(
        workflowState === "published"
          ? "Unpublished — editing unlocked (admin)."
          : "Returned to draft — editing unlocked.",
      );
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not return to draft.");
    } finally {
      setUnlocking(false);
    }
  }

  async function handleDeprecate() {
    if (!workflow?.id || deprecating) return;
    if (!window.confirm("Deprecate this published disease? Soft-deletes from public graph reads.")) {
      return;
    }
    setDeprecating(true);
    try {
      const envelope = await client.deprecateWorkflow(workflow.id);
      editor.onWorkflowUpdated(envelope.data);
      toast.success("Deprecated — hidden from public graph reads.");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not deprecate.");
    } finally {
      setDeprecating(false);
    }
  }

  return (
    <>
      <EntityEditorShell
        title={String(snapshot.package.entity_payload.label ?? diseaseSlug)}
        subtitle={`Disease editor · ${diseaseSlug}`}
        headerActions={
          <>
            <Button asChild variant="ghost" size="sm">
              <Link href="/knowledge/diseases">
                <ArrowLeft className="h-4 w-4" />
                Back
              </Link>
            </Button>
            {packageLocked ? (
              <Badge variant="warning" className="gap-1">
                <Lock className="h-3 w-3" />
                {workflowState}
              </Badge>
            ) : null}
            <AutosaveStatus
              status={snapshot.saveStatus}
              error={snapshot.saveError}
              lastSavedAt={snapshot.lastSavedAt}
              onRetry={packageLocked ? undefined : editor.retrySave}
            />
            {workflowState === "approved" || (workflowState === "published" && isAdmin) ? (
              <Button size="sm" variant="secondary" disabled={unlocking} onClick={() => void handleReturnToDraft()}>
                {unlocking ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                {workflowState === "published" ? "Unpublish to edit" : "Return to draft"}
              </Button>
            ) : null}
            {workflowState === "published" && isAdmin ? (
              <Button size="sm" variant="outline" disabled={deprecating} onClick={() => void handleDeprecate()}>
                {deprecating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Archive className="h-4 w-4" />}
                Deprecate
              </Button>
            ) : null}
            <Button size="sm" onClick={() => setPublishOpen(true)}>
              <Rocket className="h-4 w-4" />
              Publish
            </Button>
          </>
        }
        sectionNav={
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Sections</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {editor.sections.map((section) => (
                <Button
                  key={section.id}
                  variant={snapshot.activeSectionId === section.id ? "default" : "ghost"}
                  className="w-full justify-start"
                  onClick={() => editor.setActiveSection(section.id)}
                >
                  {section.title}
                </Button>
              ))}
            </CardContent>
          </Card>
        }
        editor={
          <Card>
            <CardContent className="pt-6">
              {packageLocked ? (
                <p className="mb-4 text-xs text-muted-foreground">
                  {workflowState === "published" && isAdmin
                    ? "Published — unpublish to edit, or deprecate to soft-delete."
                    : `Package locked in ${workflowState} state.`}
                </p>
              ) : null}
              <DiseaseSectionEditor
                section={editor.activeSection}
                pkg={snapshot.package}
                disabled={packageLocked || snapshot.saveStatus === "saving"}
                onFieldChange={(key, value) => {
                  if (packageLocked) return;
                  editor.onFieldChange(key, value);
                }}
              />
            </CardContent>
          </Card>
        }
        contextPanel={<DiseaseContextPanel snapshot={snapshot} diseaseSlug={diseaseSlug} />}
      />
      <PublishWizard
        open={publishOpen}
        onOpenChange={setPublishOpen}
        drugId={diseaseSlug}
        entityType="Disease"
        workflow={snapshot.workflow}
        package={snapshot.package}
        saveStatus={snapshot.saveStatus}
        dirtySections={snapshot.dirtySections}
        editorValidation={snapshot.validation}
        validationPending={snapshot.validationPending}
        onWorkflowUpdated={editor.onWorkflowUpdated}
        onNavigateSection={editor.setActiveSection}
      />
    </>
  );
}
