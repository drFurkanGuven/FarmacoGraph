"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Rocket } from "lucide-react";
import { PublishWizard } from "@/components/publish-wizard";
import { AutosaveStatus } from "@/components/drug-editor/autosave-status";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { TableSkeleton } from "@/components/ui/loading-skeleton";
import { EntityEditorShell } from "@/components/entity-editor";
import { DiseaseContextPanel } from "./disease-context-panel";
import { DiseaseSectionEditor } from "./disease-section-editor";
import { useDiseaseEditor } from "./use-disease-editor";

export function DiseaseEditorWorkspace({ diseaseSlug }: { diseaseSlug: string }) {
  const editor = useDiseaseEditor({ diseaseSlug });
  const [publishOpen, setPublishOpen] = useState(false);

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
            <AutosaveStatus
              status={snapshot.saveStatus}
              error={snapshot.saveError}
              lastSavedAt={snapshot.lastSavedAt}
              onRetry={editor.retrySave}
            />
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
              <DiseaseSectionEditor
                section={editor.activeSection}
                pkg={snapshot.package}
                onFieldChange={editor.onFieldChange}
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
