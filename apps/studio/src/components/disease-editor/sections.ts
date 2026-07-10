import type { EntityEditorSection, EntityPublishPackage } from "@/components/entity-editor";

export const DEFAULT_SECTION_ID = "identity";

export const DISEASE_EDITOR_SECTIONS: EntityEditorSection[] = [
  {
    id: "identity",
    title: "Identity",
    description: "Core disease identifiers and naming.",
    fields: [
      { key: "slug", label: "Slug", type: "text", path: "entity_payload.slug" },
      { key: "label", label: "Label", type: "text", path: "entity_payload.label" },
      { key: "id", label: "Entity ID", type: "readonly", path: "entity_payload.id" },
    ],
  },
  {
    id: "clinical",
    title: "Clinical",
    description: "Terminology and prevalence notes.",
    fields: [
      { key: "description", label: "Description", type: "textarea", path: "entity_payload.description" },
      {
        key: "prevalence_note",
        label: "Prevalence note",
        type: "textarea",
        path: "entity_payload.prevalence_note",
      },
      { key: "icd10", label: "ICD-10", type: "text", path: "entity_payload.external_ids.icd10" },
      { key: "mesh", label: "MeSH", type: "text", path: "entity_payload.external_ids.mesh" },
    ],
  },
  {
    id: "provenance",
    title: "Provenance",
    description: "Attribution and curation metadata required by validators.",
    fields: [
      {
        key: "source",
        label: "Source",
        type: "text",
        path: "entity_payload.provenance.source",
        placeholder: "manual",
      },
      {
        key: "created_by",
        label: "Created by",
        type: "text",
        path: "entity_payload.provenance.created_by",
      },
      {
        key: "curator_attestation",
        label: "Curator attestation",
        type: "text",
        path: "entity_payload.provenance.curator_attestation",
        description: "Set to true when a human curator attests the content.",
        placeholder: "true",
      },
    ],
  },
];

export function getSectionById(sectionId: string): EntityEditorSection {
  return DISEASE_EDITOR_SECTIONS.find((section) => section.id === sectionId) ?? DISEASE_EDITOR_SECTIONS[0];
}

export type DiseasePublishPackage = EntityPublishPackage;
