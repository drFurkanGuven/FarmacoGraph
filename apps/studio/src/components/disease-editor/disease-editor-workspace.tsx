"use client";

import { useState } from "react";
import { Rocket } from "lucide-react";
import { PublishWizard } from "@/components/publish-wizard";
import { WorkflowStatePanel } from "@/components/publish-wizard/workflow-state-panel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { TableSkeleton } from "@/components/ui/loading-skeleton";
import { ValidationBadge } from "@/components/ui/validation-badge";
import { EntityEditorShell } from "@/components/entity-editor";
import { DiseaseSectionEditor } from "./disease-section-editor";
import { useDiseaseEditor } from "./use-disease-editor";

export function DiseaseEditorWorkspace({ diseaseSlug }: { diseaseSlug: string }) {
  const editor = useDiseaseEditor({ diseaseSlug });
  const [publishOpen, setPublishOpen] = useState(false);

  if (editor.loading) {
    return <TableSkeleton rows={6} />;
  }

  if (editor.loadError) {
    return <ErrorState title="Unable to open disease editor" message={editor.loadError} />;
  }

  const { snapshot } = editor;

  return (
    <>
      <EntityEditorShell
        title={String(snapshot.package.entity_payload.label ?? diseaseSlug)}
        subtitle={`Disease editor · ${diseaseSlug}`}
        headerActions={
          <>
            <span className="text-xs text-muted-foreground">
              {snapshot.saveStatus === "saving"
                ? "Saving…"
                : snapshot.saveStatus === "saved"
                  ? "Saved"
                  : snapshot.saveStatus === "error"
                    ? snapshot.saveError
                    : "Idle"}
            </span>
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
        contextPanel={
          <div className="space-y-3">
            <WorkflowStatePanel
              snapshot={{
                drugId: diseaseSlug,
                workflow: snapshot.workflow,
                package: snapshot.package,
                activeSectionId: snapshot.activeSectionId,
                saveStatus: snapshot.saveStatus,
                saveError: snapshot.saveError,
                lastSavedAt: snapshot.lastSavedAt,
                lastSaveStrategy: null,
                dirtySections: snapshot.dirtySections,
                validation: snapshot.validation,
                validationPending: snapshot.validationPending,
              }}
              entityType="Disease"
              compact
            />
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Validation</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <ValidationBadge
                  status={
                    snapshot.validation?.valid
                      ? "valid"
                      : snapshot.validation
                        ? "invalid"
                        : "pending"
                  }
                />
                {snapshot.workflow?.state ? (
                  <p className="text-muted-foreground">Workflow: {snapshot.workflow.state}</p>
                ) : null}
              </CardContent>
            </Card>
          </div>
        }
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
