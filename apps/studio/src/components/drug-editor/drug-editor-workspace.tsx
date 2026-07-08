"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, PanelRight } from "lucide-react";
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

export interface DrugEditorWorkspaceProps {
  drugId: string;
}

function EditorSkeleton() {
  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <Skeleton className="h-8 w-64" />
      <div className="grid flex-1 gap-4 lg:grid-cols-[220px_minmax(0,1fr)_320px]">
        <Skeleton className="hidden h-full lg:block" />
        <Skeleton className="h-full min-h-[320px]" />
        <Skeleton className="hidden h-full lg:block" />
      </div>
    </div>
  );
}

export function DrugEditorWorkspace({ drugId }: DrugEditorWorkspaceProps) {
  const [contextOpen, setContextOpen] = useState(false);
  const { loading, loadError, snapshot, activeSection, setActiveSection, updateField, retrySave } =
    useDrugEditor({ drugId });

  if (loading) {
    return <EditorSkeleton />;
  }

  if (loadError) {
    return (
      <div className="p-4">
        <ErrorState title="Unable to open drug editor" message={loadError} />
      </div>
    );
  }

  const title = String(
    snapshot.package.entity_payload.label ||
      snapshot.package.entity_payload.generic_name ||
      snapshot.package.entity_payload.slug ||
      "Untitled drug",
  );

  return (
    <div className="-m-4 flex h-[calc(100vh-4rem)] flex-col overflow-hidden md:-m-6">
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
          <AutosaveStatus
            status={snapshot.saveStatus}
            error={snapshot.saveError}
            lastSavedAt={snapshot.lastSavedAt}
            strategy={snapshot.lastSaveStrategy}
            onRetry={retrySave}
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

      <div className="grid min-h-0 flex-1 lg:grid-cols-[220px_minmax(0,1fr)_320px]">
        <div className="hidden border-r lg:block">
          <DrugSectionNav
            activeSectionId={snapshot.activeSectionId}
            dirtySections={snapshot.dirtySections}
            onSelect={setActiveSection}
          />
        </div>

        <main className="min-h-0 overflow-auto p-4 md:p-6">
          <DrugSectionEditor
            section={activeSection}
            pkg={snapshot.package}
            disabled={snapshot.saveStatus === "saving"}
            onFieldChange={(fieldKey, value) => updateField(snapshot.activeSectionId, fieldKey, value)}
          />
        </main>

        <div className="hidden border-l lg:block">
          <DrugContextPanel snapshot={snapshot} className="h-full" />
        </div>
      </div>

      <Drawer open={contextOpen} onOpenChange={setContextOpen}>
        <DrawerContent side="right" className="w-full max-w-md">
          <DrawerHeader>
            <DrawerTitle>Live context</DrawerTitle>
            <DrawerDescription>Workflow, validation, and graph context for this drug.</DrawerDescription>
          </DrawerHeader>
          <DrugContextPanel snapshot={snapshot} className="h-[calc(100vh-8rem)]" />
        </DrawerContent>
      </Drawer>
    </div>
  );
}
