"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, PanelRight, Rocket } from "lucide-react";
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
  const [contextOpen, setContextOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
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
  const packageLocked =
    workflowState === "approved" || workflowState === "published" || workflowState === "deprecated";

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
            <p className="truncate text-sm font-medium">{title}</p>
            <p className="truncate font-mono text-xs text-muted-foreground">{drugId}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="default" size="sm" onClick={() => setPublishOpen(true)}>
            <Rocket className="h-4 w-4" />
            Publish
          </Button>
          <AutosaveStatus
            status={snapshot.saveStatus}
            error={snapshot.saveError}
            lastSavedAt={snapshot.lastSavedAt}
            strategy={snapshot.lastSaveStrategy}
            onRetry={packageLocked ? undefined : retrySave}
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

      {packageLocked ? (
        <div className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
          <p className="font-medium">
            Package locked in <span className="font-mono">{workflowState}</span>
          </p>
          <p className="mt-1 text-muted-foreground">
            {workflowState === "approved"
              ? "Approved packages cannot be edited or autosaved. Open Publish → Return to draft to keep editing, or Publish to write the drug into Neo4j (required before graph-backed evidence attach)."
              : "This workflow state is read-only. Open Publish to advance or return to draft for a new edit cycle."}
          </p>
          <Button className="mt-2" size="sm" variant="outline" onClick={() => setPublishOpen(true)}>
            <Rocket className="h-4 w-4" />
            Open publish wizard
          </Button>
        </div>
      ) : null}

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
          <DrugSectionEditor
            section={activeSection}
            pkg={snapshot.package}
            drugId={drugId}
            validation={snapshot.validation}
            disabled={packageLocked || snapshot.saveStatus === "saving"}
            onFieldChange={(fieldKey, value) => {
              if (packageLocked) return;
              updateField(snapshot.activeSectionId, fieldKey, value);
            }}
            onPackageChange={(next) => {
              if (packageLocked) return;
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
