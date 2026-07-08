import type { PublishPackageInput, ValidationResult, WorkflowItem } from "@/lib/api";
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

export type DrugEditorSectionKind = "fields" | "evidence";

export interface DrugEditorSection {
  id: string;
  title: string;
  description?: string;
  kind?: DrugEditorSectionKind;
  fields: DrugFieldDef[];
}

export type SaveStatus = "idle" | "pending" | "saving" | "saved" | "error";

export type SaveStrategy = "curator_package";

export interface SaveResult {
  strategy: SaveStrategy;
  savedAt: string;
  validation?: ValidationResult;
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
