import type { DrugEditorSection } from "./types";

export const DRUG_EDITOR_SECTIONS: DrugEditorSection[] = [
  {
    id: "identity",
    title: "Identity",
    description: "Core identifiers and naming for the drug entity.",
    fields: [
      {
        key: "slug",
        label: "Slug",
        type: "text",
        path: "entity_payload.slug",
        placeholder: "ramipril",
        description: "URL-safe identifier used across the knowledge graph.",
      },
      {
        key: "label",
        label: "Label",
        type: "text",
        path: "entity_payload.label",
        placeholder: "Ramipril",
      },
      {
        key: "generic_name",
        label: "Generic name",
        type: "text",
        path: "entity_payload.generic_name",
        placeholder: "Ramipril",
      },
      {
        key: "module",
        label: "Module",
        type: "text",
        path: "entity_payload.module",
        placeholder: "cardiovascular",
      },
      {
        key: "id",
        label: "Entity ID",
        type: "readonly",
        path: "entity_payload.id",
      },
    ],
  },
  {
    id: "classification",
    title: "Classification",
    description: "Therapeutic and pharmacologic class relationships.",
    fields: [
      {
        key: "belongs_to",
        label: "Drug classes",
        type: "uuid-list",
        path: "entity_payload.relationships.BELONGS_TO",
        description: "One UUID per line — DrugClass entity IDs.",
      },
    ],
  },
  {
    id: "indications",
    title: "Indications",
    description: "Link diseases this drug treats and add publish metadata for each TREATS edge.",
    fields: [
      {
        key: "treats",
        label: "Treats",
        type: "uuid-list",
        path: "entity_payload.relationships.TREATS",
        description: "Select Disease nodes from the curator catalog.",
      },
      {
        key: "treats_metadata",
        label: "TREATS metadata",
        type: "readonly",
        path: "relationships.TREATS",
        description: "Per-edge explanation, confidence, and evidence for publish validation.",
      },
    ],
  },
  {
    id: "mechanism",
    title: "Mechanism",
    description:
      "Author the mechanism pathway on the canvas: add fragments, set roots from the Drug node, and connect steps.",
    fields: [
      {
        key: "mechanism_root",
        label: "Mechanism roots",
        type: "uuid-list",
        path: "entity_payload.relationships.HAS_MECHANISM_ROOT",
        description: "MechanismFragment entity IDs selected via the catalog picker.",
      },
    ],
  },
  {
    id: "education",
    title: "Education",
    kind: "education",
    description: "Student-facing summaries and board-exam pearls kept outside biomedical facts.",
    fields: [],
  },
  {
    id: "evidence",
    title: "Evidence",
    kind: "evidence",
    description: "Citations, provenance links, and validation gaps for this drug.",
    fields: [],
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

export const DEFAULT_SECTION_ID = DRUG_EDITOR_SECTIONS[0]?.id ?? "identity";

export function getSectionById(sectionId: string): DrugEditorSection | undefined {
  return DRUG_EDITOR_SECTIONS.find((section) => section.id === sectionId);
}
