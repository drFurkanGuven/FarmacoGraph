import type { DiseasePublishPackage } from "./sections";

function setPath(target: Record<string, unknown>, path: string, value: string): Record<string, unknown> {
  const parts = path.split(".");
  const next = structuredClone(target);
  let cursor: Record<string, unknown> = next;
  for (let index = 0; index < parts.length - 1; index += 1) {
    const key = parts[index];
    const existing = cursor[key];
    if (!existing || typeof existing !== "object") {
      cursor[key] = {};
    }
    cursor = cursor[key] as Record<string, unknown>;
  }
  cursor[parts[parts.length - 1]] = value;
  return next;
}

export function createEmptyDiseasePackage(slug: string): DiseasePublishPackage {
  return {
    module: "cardiovascular",
    dataset_version: "2026.1.0",
    entity_payload: {
      entity_type: "Disease",
      slug,
      label: slug.replace(/-/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()),
      description: "",
      prevalence_note: "",
      external_ids: { icd10: "", mesh: "" },
      provenance: {
        source: "manual",
        created_by: "",
        curator_attestation: false,
      },
      versioning: { status: "draft" },
    },
    related_entities: [],
    relationships: [],
  };
}

export function applyFieldChange(
  pkg: DiseasePublishPackage,
  path: string,
  value: string,
): DiseasePublishPackage {
  return setPath(pkg as unknown as Record<string, unknown>, path, value) as unknown as DiseasePublishPackage;
}

export function sectionFieldValues(
  pkg: DiseasePublishPackage,
  sectionId: string,
  sections: { id: string; fields: { path: string }[] }[],
): Record<string, string> {
  const section = sections.find((entry) => entry.id === sectionId);
  if (!section) return {};
  const values: Record<string, string> = {};
  for (const field of section.fields) {
    const parts = field.path.split(".");
    let cursor: unknown = pkg;
    for (const part of parts) {
      if (!cursor || typeof cursor !== "object") {
        cursor = undefined;
        break;
      }
      cursor = (cursor as Record<string, unknown>)[part];
    }
    values[field.path] = cursor === undefined || cursor === null ? "" : String(cursor);
  }
  return values;
}
