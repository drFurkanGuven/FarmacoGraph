"use client";

import { cn } from "@/lib/utils";
import { PropertyEditor } from "@/components/ui";
import type { EntityEditorSection, EntityPublishPackage } from "@/components/entity-editor";
import { sectionFieldValues } from "./package";

export function DiseaseSectionEditor({
  section,
  pkg,
  disabled = false,
  onFieldChange,
  className,
}: {
  section: EntityEditorSection;
  pkg: EntityPublishPackage;
  disabled?: boolean;
  onFieldChange: (fieldPath: string, value: string) => void;
  className?: string;
}) {
  const values = sectionFieldValues(pkg, section.id, [section]);
  const fields = section.fields.map((field) => ({
    key: field.key,
    label: field.label,
    type: field.type,
    value: values[field.path] ?? "",
    description: field.description,
    placeholder: field.placeholder,
  }));

  return (
    <div className={cn("space-y-4", className)}>
      <div>
        <h3 className="text-lg font-semibold">{section.title}</h3>
        {section.description ? <p className="text-sm text-muted-foreground">{section.description}</p> : null}
      </div>
      <PropertyEditor
        fields={fields}
        disabled={disabled}
        onFieldChange={(key, value) => {
          const field = section.fields.find((entry) => entry.key === key);
          if (field) onFieldChange(field.path, value);
        }}
      />
    </div>
  );
}
