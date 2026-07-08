import type { PublishPackageInput, ValidationResult, WorkflowItem } from "@/lib/api";

/** Curator publish package used by the drug editor. */
export type DrugPublishPackage = PublishPackageInput;

export type DrugFieldType = "text" | "textarea" | "readonly" | "uuid-list";

export interface DrugFieldDef {
  key: string;
  label: string;
  type: DrugFieldType;
  /** Dot path relative to the publish package root (e.g. entity_payload.slug). */
  path: string;
  description?: string;
  placeholder?: string;
}

export interface DrugEditorSection {
  id: string;
  title: string;
  description?: string;
  fields: DrugFieldDef[];
}

export type SaveStatus = "idle" | "pending" | "saving" | "saved" | "error";

export type SaveStrategy = "drug_patch" | "curator_draft";

export interface SaveResult {
  strategy: SaveStrategy;
  savedAt: string;
}

export interface DrugEditorSnapshot {
  drugId: string;
  workflow: WorkflowItem | null;
  package: DrugPublishPackage;
  activeSectionId: string;
  saveStatus: SaveStatus;
  saveError: string | null;
  lastSavedAt: string | null;
  lastSaveStrategy: SaveStrategy | null;
  dirtySections: string[];
  validation: ValidationResult | null;
  validationPending: boolean;
}

export interface SectionChange {
  sectionId: string;
  fieldKey: string;
  value: string;
}
