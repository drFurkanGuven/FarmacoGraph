import type { PublishPackageInput, PublishWorkflowResult, WorkflowItem } from "@/lib/api";
import type { SaveStatus } from "@/components/drug-editor/types";
import type { ValidationResult } from "@/lib/api";
import type { PublishWizardAction } from "./validation";

export type PublishWizardPhase = "overview" | "confirm" | "result";

export type PublishWizardResultStatus = "success" | "error";

export interface PublishWizardResult {
  status: PublishWizardResultStatus;
  action: PublishWizardAction;
  message: string;
  workflow: WorkflowItem | null;
  publishOutcome?: PublishWorkflowResult | null;
}

export interface PublishWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  drugId: string;
  entityType?: "Drug" | "Disease";
  workflow: WorkflowItem | null;
  package: PublishPackageInput;
  saveStatus: SaveStatus;
  dirtySections: string[];
  editorValidation: ValidationResult | null;
  validationPending: boolean;
  onWorkflowUpdated: (workflow: WorkflowItem) => void;
  onNavigateSection?: (sectionId: string) => void;
}

export interface WorkflowStepDefinition {
  id: string;
  label: string;
  description: string;
}
