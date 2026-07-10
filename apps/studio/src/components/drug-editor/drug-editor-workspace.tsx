"use client";

import { useState } from "react";
import Link from "next/link";
import { Archive, ArrowLeft, Loader2, Lock, PanelRight, Rocket, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { ApiError } from "@/lib/api";
import { useApiClient } from "@/lib/hooks/use-api-client";
import { usePermissions } from "@/lib/auth/hooks";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { ErrorState } from "@/components/ui/error-state";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { AutosaveStatus } from "./autosave-status";
import { DrugContextPanel } from "./drug-context-panel";
import { DrugSectionEditor } from "./drug-section-editor";
import { DrugSectionNav } from "./drug-section-nav";
import { useDrugEditor } from "./use-drug-editor";
import { PublishWizard } from "@/components/publish-wizard";

export interface DrugEditorWorkspaceProps {
  drugId: string;
}

function EditorSkeleton() {
  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <Skeleton className="h-8 w-64" />
      <div className="grid flex-1 gap-4 lg:grid-cols-[220px_minmax(0,1fr)_340px] xl:grid-cols-[220px_minmax(0,1fr)_360px]">
        <Skeleton className="hidden h-full lg:block" />
        <Skeleton className="h-full min-h-[320px]" />
        <Skeleton className="hidden h-full lg:block" />
      </div>
    </div>
  );
}

export function DrugEditorWorkspace({ drugId }: DrugEditorWorkspaceProps) {
  const client = useApiClient();
  const { hasPermission } = usePermissions();
  const isAdmin = hasPermission("admin:org");
  const [contextOpen, setContextOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [deprecating, setDeprecating] = useState(false);
  const {
    loading,
    loadError,
    snapshot,
    activeSection,
    setActiveSection,
    updateField,
    updatePackage,
    retrySave,
    retryLoad,
    onWorkflowUpdated,
  } = useDrugEditor({ drugId });

  const workflow = snapshot.workflow;
  const workflowState = workflow?.state ?? null;
  const packageFieldsLocked =
    workflowState === "approved" || workflowState === "published" || workflowState === "deprecated";
  /** Graph-backed evidence attach is allowed after publish; package JSON stays locked. */
  const evidenceLocked = workflowState === "approved" || workflowState === "deprecated";
  const sectionLocked =
    activeSection.id === "evidence" || activeSection.kind === "evidence"
      ? evidenceLocked
      : packageFieldsLocked;

  async function handleReturnToDraft() {
    if (!workflow?.id || unlocking) return;
    setUnlocking(true);
    try {
      const envelope = await client.returnWorkflowToDraft(workflow.id);
      onWorkflowUpdated(envelope.data);
      toast.success(
        workflowState === "published"
          ? "Unpublished — editing unlocked (admin)."
          : "Returned to draft — editing unlocked.",
      );
    } catch (error) {
      const message =
        error instanceof ApiError ? error.message : "Could not return workflow to draft.";
      toast.error(message);
    } finally {
      setUnlocking(false);
    }
  }

  async function handleDeprecate() {
    if (!workflow?.id || deprecating) return;
    const ok = window.confirm(
      "Deprecate this published record? It will be soft-deleted from public graph reads.",
    );
    if (!ok) return;
    setDeprecating(true);
    try {
      const envelope = await client.deprecateWorkflow(workflow.id);
      onWorkflowUpdated(envelope.data);
      toast.success("Deprecated — hidden from public graph reads.");
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Could not deprecate workflow.";
      toast.error(message);
    } finally {
      setDeprecating(false);
    }
  }

  if (loading) {
    return <EditorSkeleton />;
  }

  if (loadError) {
    return (
      <div className="space-y-4 p-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/knowledge/drugs">
            <ArrowLeft className="h-4 w-4" />
            Back to drug browser
          </Link>
        </Button>
        <ErrorState
          title="Unable to open drug editor"
          message={loadError}
          onRetry={retryLoad}
          retryLabel="Try again"
        />
      </div>
    );
  }

  const title = String(
    snapshot.package.entity_payload.label ||
      snapshot.package.entity_payload.generic_name ||
      snapshot.package.entity_payload.slug ||
      "Untitled drug"
  );

  return (
    <div className="-m-4 flex h-[calc(100dvh-3.5rem)] min-h-0 flex-col overflow-hidden md:-m-6">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b bg-background/95 px-4 py-3 backdrop-blur">
        <div className="flex min-w-0 items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/knowledge/drugs">
              <ArrowLeft className="h-4 w-4" />
              Drugs
            </Link>
          </Button>
          <Separator orientation="vertical" className="hidden h-5 sm:block" />
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <p className="truncate text-sm font-medium">{title}</p>
              {packageFieldsLocked ? (
                <Badge variant="warning" className="shrink-0 gap-1">
                  <Lock className="h-3 w-3" />
                  {workflowState}
                </Badge>
              ) : null}
            </div>
            <p className="truncate font-mono text-xs text-muted-foreground">{drugId}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          {workflowState === "approved" || (workflowState === "published" && isAdmin) ? (
            <Button size="sm" variant="secondary" disabled={unlocking} onClick={handleReturnToDraft}>
              {unlocking ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
              {workflowState === "published" ? "Unpublish to edit" : "Return to draft"}
            </Button>
          ) : null}
          {workflowState === "published" && isAdmin ? (
            <Button size="sm" variant="outline" disabled={deprecating} onClick={handleDeprecate}>
              {deprecating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Archive className="h-4 w-4" />}
              Deprecate
            </Button>
          ) : null}
          {workflowState === "published" && !isAdmin ? (
            <Button size="sm" variant="outline" onClick={() => setActiveSection("evidence")}>
              Evidence
            </Button>
          ) : null}
          <Button variant="default" size="sm" onClick={() => setPublishOpen(true)}>
            <Rocket className="h-4 w-4" />
            {workflowState === "published" ? "Workflow" : "Publish"}
          </Button>
          <AutosaveStatus
            status={snapshot.saveStatus}
            error={snapshot.saveError}
            lastSavedAt={snapshot.lastSavedAt}
            strategy={snapshot.lastSaveStrategy}
            onRetry={packageFieldsLocked ? undefined : retrySave}
          />
          <Button
            variant="outline"
            size="sm"
            className="lg:hidden"
            onClick={() => setContextOpen(true)}
          >
            <PanelRight className="h-4 w-4" />
            Context
          </Button>
        </div>
      </header>

      <div className="border-b px-2 py-2 lg:hidden">
        <DrugSectionNav
          activeSectionId={snapshot.activeSectionId}
          dirtySections={snapshot.dirtySections}
          onSelect={setActiveSection}
          orientation="horizontal"
        />
      </div>

      <div className="grid min-h-0 flex-1 overflow-hidden lg:grid-cols-[220px_minmax(0,1fr)_340px] xl:grid-cols-[220px_minmax(0,1fr)_360px]">
        <div className="hidden min-h-0 min-w-0 overflow-hidden border-r lg:block">
          <DrugSectionNav
            activeSectionId={snapshot.activeSectionId}
            dirtySections={snapshot.dirtySections}
            onSelect={setActiveSection}
          />
        </div>

        <main className="minimal-scrollbar min-h-0 overflow-auto p-4 md:p-6">
          {workflowState === "published" && activeSection.id !== "evidence" ? (
            <p className="mb-4 text-xs text-muted-foreground">
              {isAdmin ? (
                <>
                  Published package is read-only until you{" "}
                  <button type="button" className="underline underline-offset-2" onClick={() => void handleReturnToDraft()}>
                    Unpublish to edit
                  </button>
                  . Deprecate soft-deletes from public graph reads.
                </>
              ) : (
                <>
                  Published package fields are read-only. Use{" "}
                  <button type="button" className="underline underline-offset-2" onClick={() => setActiveSection("evidence")}>
                    Evidence
                  </button>{" "}
                  to attach graph-backed citations, or open Workflow for history.
                </>
              )}
            </p>
          ) : null}
          {workflowState === "approved" ? (
            <p className="mb-4 text-xs text-muted-foreground">
              Approved — package locked. Use <span className="font-medium text-foreground">Return to draft</span> to edit, or Publish to write Neo4j.
            </p>
          ) : null}
          {workflowState === "deprecated" ? (
            <p className="mb-4 text-xs text-muted-foreground">
              Deprecated — soft-deleted from public reads. Package edits are closed.
            </p>
          ) : null}
          <DrugSectionEditor
            section={activeSection}
            pkg={snapshot.package}
            drugId={drugId}
            validation={snapshot.validation}
            disabled={sectionLocked || snapshot.saveStatus === "saving"}
            onFieldChange={(fieldKey, value) => {
              if (packageFieldsLocked) return;
              updateField(snapshot.activeSectionId, fieldKey, value);
            }}
            onPackageChange={(next) => {
              if (packageFieldsLocked) return;
              updatePackage(snapshot.activeSectionId, next);
            }}
          />
        </main>

        <div className="hidden min-h-0 min-w-0 overflow-hidden border-l lg:block">
          <DrugContextPanel
            snapshot={snapshot}
            onOpenEvidenceSection={() => setActiveSection("evidence")}
            className="h-full"
          />
        </div>
      </div>

      <Drawer open={contextOpen} onOpenChange={setContextOpen}>
        <DrawerContent side="right" className="w-full max-w-md">
          <DrawerHeader>
            <DrawerTitle>Live context</DrawerTitle>
            <DrawerDescription>
              Workflow, validation, and graph context for this drug.
            </DrawerDescription>
          </DrawerHeader>
          <DrugContextPanel
            snapshot={snapshot}
            onOpenEvidenceSection={() => {
              setActiveSection("evidence");
              setContextOpen(false);
            }}
            className="h-[calc(100dvh-8rem)]"
          />
        </DrawerContent>
      </Drawer>

      <PublishWizard
        open={publishOpen}
        onOpenChange={setPublishOpen}
        drugId={drugId}
        workflow={workflow}
        package={snapshot.package}
        saveStatus={snapshot.saveStatus}
        dirtySections={snapshot.dirtySections}
        editorValidation={snapshot.validation}
        validationPending={snapshot.validationPending}
        onWorkflowUpdated={onWorkflowUpdated}
        onNavigateSection={setActiveSection}
      />
    </div>
  );
}
