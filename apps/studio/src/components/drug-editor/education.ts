import type { DrugPublishPackage } from "./types";

export type EducationKind =
  | "FiveSecondSummary"
  | "BoardExamPearl"
  | "Mnemonic"
  | "CommonMistake"
  | "Flashcard";

export interface EducationItem {
  id: string;
  entity_type: "EducationResource";
  kind: EducationKind;
  slug: string;
  label: string;
  text?: string;
  mnemonic?: string;
  expansion?: string;
  mistake?: string;
  correction?: string;
  why_wrong?: string;
  front?: string;
  back?: string;
  hint?: string;
  content_layer: "education";
  audience: string[];
  difficulty_level: string;
  language: string;
  module: string | null;
  exam_tags?: string[];
  linked_entity_ids: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((entry) => String(entry).trim()).filter(Boolean))];
}

function slugBase(pkg: DrugPublishPackage, drugEntityId: string): string {
  const slug = pkg.entity_payload.slug;
  if (typeof slug === "string" && slug.trim()) return slug.trim();
  return drugEntityId;
}

function educationId(pkg: DrugPublishPackage, drugEntityId: string, kind: EducationKind): string {
  return `${drugEntityId}:education:${kind}`;
}

function educationSlug(pkg: DrugPublishPackage, drugEntityId: string, kind: EducationKind): string {
  return `${slugBase(pkg, drugEntityId)}-${kind.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase()}`;
}

function kindLabel(kind: EducationKind): string {
  return kind.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
}

function defaultEducationItem(
  pkg: DrugPublishPackage,
  drugEntityId: string,
  kind: EducationKind,
): EducationItem {
  const drugLabel = String(
    pkg.entity_payload.label || pkg.entity_payload.generic_name || pkg.entity_payload.slug || "Drug",
  );
  return {
    id: educationId(pkg, drugEntityId, kind),
    entity_type: "EducationResource",
    kind,
    slug: educationSlug(pkg, drugEntityId, kind),
    label: `${drugLabel} ${kindLabel(kind)}`,
    content_layer: "education",
    audience: ["medical_student"],
    difficulty_level: "core",
    language: "en",
    module: typeof pkg.module === "string" ? pkg.module : null,
    exam_tags: kind === "BoardExamPearl" ? ["TUS"] : [],
    linked_entity_ids: [drugEntityId],
  };
}

function hasEducationContent(item: EducationItem | Record<string, unknown>): boolean {
  const record = item as Record<string, unknown>;
  const fields = [
    "text",
    "mnemonic",
    "expansion",
    "mistake",
    "correction",
    "why_wrong",
    "front",
    "back",
    "hint",
  ];
  return fields.some((field) => typeof record[field] === "string" && String(record[field]).trim());
}

export function readEducationItem(
  pkg: DrugPublishPackage,
  drugEntityId: string,
  kind: EducationKind,
): EducationItem {
  const items = Array.isArray(pkg.education) ? pkg.education : [];
  const found = items.find((item) => isRecord(item) && item.kind === kind);
  const fallback = defaultEducationItem(pkg, drugEntityId, kind);
  if (!isRecord(found)) return fallback;
  return {
    ...fallback,
    ...found,
    id: typeof found.id === "string" && found.id ? found.id : fallback.id,
    entity_type: "EducationResource",
    kind,
    slug: typeof found.slug === "string" && found.slug ? found.slug : fallback.slug,
    label: typeof found.label === "string" && found.label ? found.label : fallback.label,
    text: typeof found.text === "string" ? found.text : "",
    mnemonic: typeof found.mnemonic === "string" ? found.mnemonic : "",
    expansion: typeof found.expansion === "string" ? found.expansion : "",
    mistake: typeof found.mistake === "string" ? found.mistake : "",
    correction: typeof found.correction === "string" ? found.correction : "",
    why_wrong: typeof found.why_wrong === "string" ? found.why_wrong : "",
    front: typeof found.front === "string" ? found.front : "",
    back: typeof found.back === "string" ? found.back : "",
    hint: typeof found.hint === "string" ? found.hint : "",
    content_layer: "education",
    audience: normalizeList(found.audience).length ? normalizeList(found.audience) : fallback.audience,
    difficulty_level:
      typeof found.difficulty_level === "string" && found.difficulty_level
        ? found.difficulty_level
        : fallback.difficulty_level,
    language: typeof found.language === "string" && found.language ? found.language : "en",
    module: typeof found.module === "string" ? found.module : fallback.module,
    exam_tags: kind === "BoardExamPearl" ? normalizeList(found.exam_tags) : [],
    linked_entity_ids: normalizeList(found.linked_entity_ids).length
      ? normalizeList(found.linked_entity_ids)
      : [drugEntityId],
  };
}

export function updateEducationItem(
  pkg: DrugPublishPackage,
  drugEntityId: string,
  kind: EducationKind,
  patch: Partial<EducationItem>,
): DrugPublishPackage {
  const next: DrugPublishPackage = structuredClone(pkg);
  const current = readEducationItem(next, drugEntityId, kind);
  const updated: EducationItem = {
    ...current,
    ...patch,
    entity_type: "EducationResource",
    kind,
    content_layer: "education",
    linked_entity_ids: [drugEntityId],
  };
  const existing = Array.isArray(next.education) ? next.education : [];
  const preserved = existing.filter((item) => !(isRecord(item) && item.kind === kind));
  const education = hasEducationContent(updated)
    ? [...preserved, updated as unknown as Record<string, unknown>]
    : preserved;

  next.education = education;
  syncEducationGraphRows(next, drugEntityId);

  if (isRecord(next.entity_payload.provenance)) {
    next.entity_payload.provenance.updated_at = new Date().toISOString();
  }
  return next;
}

export function syncEducationGraphRows(
  pkg: DrugPublishPackage,
  drugEntityId: string,
): DrugPublishPackage {
  const education = Array.isArray(pkg.education)
    ? pkg.education.filter((item) => isRecord(item) && hasEducationContent(item))
    : [];

  const related = Array.isArray(pkg.related_entities) ? pkg.related_entities : [];
  pkg.related_entities = [
    ...related.filter(
      (item) =>
        !(
          isRecord(item) &&
          item.entity_type === "EducationResource" &&
          normalizeList(item.linked_entity_ids).includes(drugEntityId)
        ),
    ),
    ...education,
  ];

  const relationships = Array.isArray(pkg.relationships) ? pkg.relationships : [];
  const preserved = relationships.filter(
    (row) =>
      !(
        isRecord(row) &&
        row.relationship_type === "HAS_EDUCATION" &&
        String(row.source_id) === drugEntityId
      ),
  );
  pkg.relationships = [
    ...preserved,
    ...education.map((item) => ({
      relationship_type: "HAS_EDUCATION",
      source_type: "Drug",
      target_type: "EducationResource",
      source_id: drugEntityId,
      target_id: String(item.id),
      properties: {
        kind: String(item.kind),
      },
    })),
  ];
  return pkg;
}
