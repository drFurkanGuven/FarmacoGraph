import type { ReactNode } from "react";
import type { ValidationResult, WorkflowItem } from "@/lib/api";

/** Shared section config for entity editors (Drug, Disease, …). */
export interface EntityEditorSection {
  id: string;
  title: string;
  description?: string;
  fields: EntityEditorField[];
}

export interface EntityEditorField {
  key: string;
  label: string;
  type: "text" | "textarea" | "readonly";
  path: string;
  placeholder?: string;
  description?: string;
}

export interface EntityPublishPackage {
  entity_payload: Record<string, unknown>;
  related_entities?: Record<string, unknown>[];
  relationships?: Record<string, unknown>[];
  dataset_version?: string;
  module?: string | null;
  create_snapshot?: boolean;
}

export interface EntityEditorSnapshot {
  entityKey: string;
  entityType: string;
  workflow: WorkflowItem | null;
  package: EntityPublishPackage;
  activeSectionId: string;
  saveStatus: "idle" | "pending" | "saving" | "saved" | "error";
  saveError: string | null;
  lastSavedAt: string | null;
  dirtySections: string[];
  validation: ValidationResult | null;
  validationPending: boolean;
}

export interface EntityEditorShellProps {
  title: string;
  subtitle?: string;
  headerActions?: ReactNode;
  sectionNav: ReactNode;
  editor: ReactNode;
  contextPanel?: ReactNode;
}
