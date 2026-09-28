"use client";

import { cn } from "@/lib/utils";
import { PropertyEditor, type PropertyEditorField } from "@/components/ui";
import type { ValidationResult } from "@/lib/api";
import { useSectionText } from "@/lib/i18n/context";
import { DrugEvidenceSection } from "./drug-evidence-section";
import { EducationSection } from "./education-section";
import { ClassificationSection } from "./classification-section";
import { IndicationsSection } from "./indications-section";
import { MechanismSection } from "./mechanism-section";
import { sectionFieldValues } from "./package";
import {
  listTreatsDiseaseIds,
  readTreatsIndication,
  setTreatsEvidenceIds,
} from "./treats-relationships";
import type { DrugEditorSection, DrugPublishPackage } from "./types";

export interface DrugSectionEditorProps {
  section: DrugEditorSection;
  pkg: DrugPublishPackage;
  drugId: string;
  validation: ValidationResult | null;
  disabled?: boolean;
  onFieldChange: (fieldKey: string, value: string) => void;
  onPackageChange?: (next: DrugPublishPackage) => void;
  className?: string;
}

export function DrugSectionEditor({
  section,
  pkg,
  drugId,
  validation,
  disabled = false,
  onFieldChange,
  onPackageChange,
  className,
}: DrugSectionEditorProps) {
  const { title: sectionTitle, description: sectionDescription } = useSectionText(section);
  if (section.kind === "evidence" || section.id === "evidence") {
    const entityId = String(pkg.entity_payload.id ?? drugId);
    const slug =
      typeof pkg.entity_payload.slug === "string" && pkg.entity_payload.slug
        ? pkg.entity_payload.slug
        : null;
    const labelByDiseaseId = new Map<string, string>();
    for (const row of pkg.related_entities ?? []) {
      const record = row as Record<string, unknown>;
      if (record.entity_type === "Disease" && typeof record.id === "string") {
        labelByDiseaseId.set(
          record.id,
          typeof record.label === "string" && record.label ? record.label : record.id
        );
      }
    }
    const treatsOptions = listTreatsDiseaseIds(pkg).map((diseaseId) => ({
      id: diseaseId,
      label: labelByDiseaseId.get(diseaseId) ?? diseaseId,
    }));

    return (
      <DrugEvidenceSection
        drugId={drugId}
        entityId={entityId}
        slug={slug}
        validation={validation}
        disabled={disabled}
        className={className}
        treatsOptions={treatsOptions}
        onLinkToIndication={(evidenceId, diseaseId) => {
          const current = readTreatsIndication(pkg, entityId, diseaseId).evidence_ids ?? [];
          if (current.includes(evidenceId)) return;
          onPackageChange?.(
            setTreatsEvidenceIds(pkg, entityId, diseaseId, [...current, evidenceId])
          );
        }}
      />
    );
  }

  if (section.id === "classification") {
    return (
      <div className={cn("space-y-4", className)}>
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{sectionTitle}</h2>
          {sectionDescription && (
            <p className="mt-1 text-sm text-muted-foreground">{sectionDescription}</p>
          )}
        </div>
        <ClassificationSection
          pkg={pkg}
          drugId={drugId}
          disabled={disabled}
          onPackageChange={(next) => onPackageChange?.(next)}
        />
      </div>
    );
  }

  if (section.id === "indications") {
    const slug =
      typeof pkg.entity_payload.slug === "string" && pkg.entity_payload.slug
        ? pkg.entity_payload.slug
        : null;

    return (
      <div className={cn("space-y-4", className)}>
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{sectionTitle}</h2>
          {sectionDescription && (
            <p className="mt-1 text-sm text-muted-foreground">{sectionDescription}</p>
          )}
        </div>
        <IndicationsSection
          pkg={pkg}
          drugId={drugId}
          slug={slug}
          validation={validation}
          disabled={disabled}
          onPackageChange={(next) => onPackageChange?.(next)}
        />
      </div>
    );
  }

  if (section.id === "mechanism") {
    return (
      <div className={cn("space-y-4", className)}>
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{sectionTitle}</h2>
          {sectionDescription && (
            <p className="mt-1 text-sm text-muted-foreground">{sectionDescription}</p>
          )}
        </div>
        <MechanismSection
          pkg={pkg}
          drugId={drugId}
          disabled={disabled}
          onPackageChange={(next) => onPackageChange?.(next)}
        />
      </div>
    );
  }

  if (section.kind === "education" || section.id === "education") {
    return (
      <EducationSection
        pkg={pkg}
        drugId={drugId}
        disabled={disabled}
        onPackageChange={(next) => onPackageChange?.(next)}
      />
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
        <h2 className="text-lg font-semibold tracking-tight">{sectionTitle}</h2>
        {sectionDescription && (
          <p className="mt-1 text-sm text-muted-foreground">{sectionDescription}</p>
        )}
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
