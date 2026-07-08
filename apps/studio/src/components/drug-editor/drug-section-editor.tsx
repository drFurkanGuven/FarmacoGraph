"use client";

import { cn } from "@/lib/utils";
import { PropertyEditor, type PropertyEditorField } from "@/components/ui";
import { sectionFieldValues } from "./package";
import type { DrugEditorSection, DrugPublishPackage } from "./types";

export interface DrugSectionEditorProps {
  section: DrugEditorSection;
  pkg: DrugPublishPackage;
  disabled?: boolean;
  onFieldChange: (fieldKey: string, value: string) => void;
  className?: string;
}

export function DrugSectionEditor({
  section,
  pkg,
  disabled = false,
  onFieldChange,
  className,
}: DrugSectionEditorProps) {
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
