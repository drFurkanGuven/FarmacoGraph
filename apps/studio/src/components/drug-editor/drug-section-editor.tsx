"use client";

import { cn } from "@/lib/utils";
import { PropertyEditor, type PropertyEditorField } from "@/components/ui";
import type { ValidationResult } from "@/lib/api";
import { DrugEvidenceSection } from "./drug-evidence-section";
import { DiseasePicker } from "./disease-picker";
import { getValueAtPath, sectionFieldValues } from "./package";
import type { DrugEditorSection, DrugPublishPackage } from "./types";

export interface DrugSectionEditorProps {
  section: DrugEditorSection;
  pkg: DrugPublishPackage;
  drugId: string;
  validation: ValidationResult | null;
  disabled?: boolean;
  onFieldChange: (fieldKey: string, value: string) => void;
  className?: string;
}

export function DrugSectionEditor({
  section,
  pkg,
  drugId,
  validation,
  disabled = false,
  onFieldChange,
  className,
}: DrugSectionEditorProps) {
  if (section.kind === "evidence" || section.id === "evidence") {
    const entityId = String(pkg.entity_payload.id ?? drugId);
    const slug = typeof pkg.entity_payload.slug === "string" && pkg.entity_payload.slug
      ? pkg.entity_payload.slug
      : null;

    return (
      <DrugEvidenceSection
        drugId={drugId}
        entityId={entityId}
        slug={slug}
        validation={validation}
        disabled={disabled}
        className={className}
      />
    );
  }

  if (section.id === "indications") {
    const treats = getValueAtPath(pkg, "entity_payload.relationships.TREATS");
    const selectedIds = Array.isArray(treats) ? treats.map((entry) => String(entry)) : [];

    return (
      <div className={cn("space-y-4", className)}>
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{section.title}</h2>
          {section.description && <p className="mt-1 text-sm text-muted-foreground">{section.description}</p>}
        </div>
        <DiseasePicker
          selectedIds={selectedIds}
          disabled={disabled}
          onChange={(nextIds) => onFieldChange("treats", nextIds.join("\n"))}
        />
      </div>
    );
  }

  const values = sectionFieldValues(pkg, section);
  const fields: PropertyEditorField[] = section.fields.map((field) => ({
    key: field.key,
    label: field.label,
    value: values[field.key] ?? "",
    type: field.type === "uuid-list" ? "textarea" : field.type,
    description: field.description,
    placeholder: field.placeholder,
  }));

  return (
    <div className={cn("space-y-4", className)}>
      <div>
        <h2 className="text-lg font-semibold tracking-tight">{section.title}</h2>
        {section.description && <p className="mt-1 text-sm text-muted-foreground">{section.description}</p>}
      </div>
      <PropertyEditor
        fields={fields}
        disabled={disabled}
        onFieldChange={onFieldChange}
        className="max-w-2xl"
      />
    </div>
  );
}
