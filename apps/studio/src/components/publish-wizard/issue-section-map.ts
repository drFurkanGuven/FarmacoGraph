import { DRUG_EDITOR_SECTIONS } from "@/components/drug-editor/sections";

/** Map a validation field path to a drug editor section id when possible. */
export function resolveSectionForField(field: string | null | undefined): string | null {
  if (!field) return null;

  for (const section of DRUG_EDITOR_SECTIONS) {
    if (section.fields.some((entry) => field === entry.path || field.startsWith(`${entry.path}.`))) {
      return section.id;
    }
  }

  if (field.includes("provenance") || field.includes("attestation")) return "provenance";
  if (field.includes("TREATS") || field.includes("indication")) return "indications";
  if (field.includes("BELONGS_TO") || field.includes("class")) return "classification";
  if (field.includes("MECHANISM") || field.includes("mechanism")) return "mechanism";
  if (field.includes("slug") || field.includes("label") || field.includes("generic_name")) {
    return "identity";
  }

  return null;
}
