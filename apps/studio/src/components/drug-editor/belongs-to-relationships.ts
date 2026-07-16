import type { DrugPublishPackage } from "./types";

export interface DrugClassRef {
  id: string;
  slug?: string;
  label?: string;
  organ_system?: string;
  module?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function clonePackage(pkg: DrugPublishPackage): DrugPublishPackage {
  return structuredClone(pkg);
}

function touchProvenance(pkg: DrugPublishPackage): void {
  if (isRecord(pkg.entity_payload.provenance)) {
    pkg.entity_payload.provenance.updated_at = new Date().toISOString();
  }
}

function drugRelationshipMap(pkg: DrugPublishPackage): Record<string, string[]> {
  if (!isRecord(pkg.entity_payload.relationships)) {
    pkg.entity_payload.relationships = {
      BELONGS_TO: [],
      TREATS: [],
      HAS_MECHANISM_ROOT: [],
    };
  }
  return pkg.entity_payload.relationships as Record<string, string[]>;
}

interface PackageRelationshipRow {
  relationship_type: string;
  source_id: string;
  target_id: string;
  source_type: string;
  target_type: string;
  properties?: Record<string, unknown> | null;
}

function relationshipRows(pkg: DrugPublishPackage): PackageRelationshipRow[] {
  if (!Array.isArray(pkg.relationships)) return [];
  return pkg.relationships as unknown as PackageRelationshipRow[];
}

export function listBelongsToClassIds(pkg: DrugPublishPackage): string[] {
  const relationships = drugRelationshipMap(pkg);
  const belongs = relationships.BELONGS_TO;
  return Array.isArray(belongs) ? belongs.map((entry) => String(entry)) : [];
}

function normalizeClassEntity(
  drugClass: DrugClassRef,
  existing?: Record<string, unknown>,
): Record<string, unknown> {
  const slug =
    drugClass.slug?.trim() ||
    (typeof existing?.slug === "string" ? existing.slug : drugClass.id);
  const label =
    drugClass.label?.trim() ||
    (typeof existing?.label === "string" ? existing.label : slug);
  return {
    ...(existing ?? {}),
    id: drugClass.id,
    entity_type: "DrugClass",
    slug,
    label,
    organ_system:
      drugClass.organ_system ??
      drugClass.module ??
      (typeof existing?.organ_system === "string" ? existing.organ_system : "cardiovascular"),
    status: typeof existing?.status === "string" ? existing.status : "published",
  };
}

function ensureDrugClasses(pkg: DrugPublishPackage, classes: DrugClassRef[]): void {
  if (classes.length === 0) return;
  const related = Array.isArray(pkg.related_entities) ? [...pkg.related_entities] : [];
  const byId = new Map<string, number>();
  related.forEach((row, index) => {
    if (isRecord(row) && typeof row.id === "string") byId.set(row.id, index);
  });

  for (const drugClass of classes) {
    const id = drugClass.id.trim();
    if (!id) continue;
    const existingIndex = byId.get(id);
    const existing =
      existingIndex !== undefined && isRecord(related[existingIndex])
        ? related[existingIndex]
        : undefined;
    const entity = normalizeClassEntity(drugClass, existing);
    if (existingIndex !== undefined) {
      related[existingIndex] = entity;
    } else {
      byId.set(id, related.length);
      related.push(entity);
    }
  }

  pkg.related_entities = related;
}

/** Keep entity_payload.relationships.BELONGS_TO, relationships[], and related_entities in sync. */
export function syncBelongsToSelection(
  pkg: DrugPublishPackage,
  drugEntityId: string,
  selectedIds: string[],
  catalog?: DrugClassRef[],
): DrugPublishPackage {
  const next = clonePackage(pkg);
  const uniqueIds = [...new Set(selectedIds.map((id) => id.trim()).filter(Boolean))];
  const relationships = drugRelationshipMap(next);
  relationships.BELONGS_TO = uniqueIds;

  const selected = new Set(uniqueIds);
  const preserved: PackageRelationshipRow[] = [];
  for (const row of relationshipRows(next)) {
    if (row.relationship_type !== "BELONGS_TO" || String(row.source_id) !== drugEntityId) {
      preserved.push(row);
      continue;
    }
    if (selected.has(String(row.target_id))) {
      preserved.push(row);
    }
  }

  const existingTargets = new Set(
    preserved
      .filter(
        (row) => row.relationship_type === "BELONGS_TO" && String(row.source_id) === drugEntityId,
      )
      .map((row) => String(row.target_id)),
  );

  for (const classId of uniqueIds) {
    if (existingTargets.has(classId)) continue;
    preserved.push({
      relationship_type: "BELONGS_TO",
      source_type: "Drug",
      target_type: "DrugClass",
      source_id: drugEntityId,
      target_id: classId,
    });
  }

  next.relationships = preserved as unknown as Record<string, unknown>[];

  const catalogById = new Map((catalog ?? []).map((row) => [row.id, row]));
  ensureDrugClasses(
    next,
    uniqueIds.map((id) => catalogById.get(id) ?? { id }),
  );

  if (Array.isArray(next.related_entities)) {
    next.related_entities = next.related_entities.filter((row) => {
      if (!isRecord(row) || row.entity_type !== "DrugClass") return true;
      return selected.has(String(row.id));
    });
  }

  touchProvenance(next);
  return next;
}
