/** Mechanism pathway package helpers — roots + fragment DAG edges. */

import type { DrugPublishPackage } from "./types";

export const PATHWAY_EDGE_TYPES = ["PRECEDES", "BRANCHES_TO", "MERGES_INTO"] as const;
export type PathwayEdgeType = (typeof PATHWAY_EDGE_TYPES)[number];

export interface MechanismEdgeProperties {
  explanation: string;
  confidence_score: number;
  evidence_level: string;
}

export interface PathwayEdgeRow {
  relationship_type: PathwayEdgeType;
  source_id: string;
  target_id: string;
  source_type: "MechanismFragment";
  target_type: "MechanismFragment";
  properties: MechanismEdgeProperties;
}

export interface MechanismFragmentRef {
  id: string;
  slug?: string;
  label?: string;
  description?: string | null;
}

export interface PackageRelationshipRow {
  relationship_type: string;
  source_id: string;
  target_id: string;
  source_type: string;
  target_type: string;
  properties?: MechanismEdgeProperties | Record<string, unknown> | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
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

function relationshipRows(pkg: DrugPublishPackage): PackageRelationshipRow[] {
  if (!Array.isArray(pkg.relationships)) return [];
  return pkg.relationships as unknown as PackageRelationshipRow[];
}

export function defaultMechanismEdgeProperties(): MechanismEdgeProperties {
  return {
    explanation: "Curator-authored mechanism step.",
    confidence_score: 0.85,
    evidence_level: "expert_consensus",
  };
}

export function isPathwayEdgeType(value: string): value is PathwayEdgeType {
  return (PATHWAY_EDGE_TYPES as readonly string[]).includes(value);
}

export function listMechanismRootIds(pkg: DrugPublishPackage): string[] {
  const relationships = asRecord(pkg.entity_payload.relationships);
  const roots = relationships.HAS_MECHANISM_ROOT;
  if (!Array.isArray(roots)) return [];
  return roots
    .map((entry) => {
      if (typeof entry === "string") return entry.trim();
      const row = asRecord(entry);
      const id = row.target_id ?? row.to_id ?? row.id ?? row.target;
      return typeof id === "string" ? id.trim() : "";
    })
    .filter(Boolean);
}

function normalizeFragmentEntity(
  fragment: MechanismFragmentRef,
  existing?: Record<string, unknown>,
): Record<string, unknown> {
  const slug =
    fragment.slug?.trim() ||
    (typeof existing?.slug === "string" ? existing.slug : fragment.id);
  const label =
    fragment.label?.trim() ||
    (typeof existing?.label === "string" ? existing.label : slug);
  return {
    ...(existing ?? {}),
    id: fragment.id,
    entity_type: "MechanismFragment",
    slug,
    label,
    description:
      fragment.description ??
      (typeof existing?.description === "string" ? existing.description : null),
    status: typeof existing?.status === "string" ? existing.status : "draft",
  };
}

export function ensureMechanismFragments(
  pkg: DrugPublishPackage,
  fragments: MechanismFragmentRef[],
): DrugPublishPackage {
  if (fragments.length === 0) return pkg;
  const next = clonePackage(pkg);
  const related = Array.isArray(next.related_entities) ? [...next.related_entities] : [];
  const byId = new Map<string, number>();
  related.forEach((row, index) => {
    if (isRecord(row) && typeof row.id === "string") byId.set(row.id, index);
  });

  for (const fragment of fragments) {
    const id = fragment.id.trim();
    if (!id) continue;
    const existingIndex = byId.get(id);
    const existing =
      existingIndex !== undefined && isRecord(related[existingIndex])
        ? related[existingIndex]
        : undefined;
    const entity = normalizeFragmentEntity(fragment, existing);
    if (existingIndex !== undefined) {
      related[existingIndex] = entity;
    } else {
      byId.set(id, related.length);
      related.push(entity);
    }
  }

  next.related_entities = related;
  touchProvenance(next);
  return next;
}

export function setMechanismRoot(
  pkg: DrugPublishPackage,
  drugEntityId: string,
  fragmentId: string,
  enabled: boolean,
  fragmentMeta?: MechanismFragmentRef,
): DrugPublishPackage {
  const id = fragmentId.trim();
  if (!id) return pkg;
  const roots = listMechanismRootIds(pkg);
  if (enabled) {
    if (roots.includes(id)) {
      return fragmentMeta ? ensureMechanismFragments(pkg, [fragmentMeta]) : pkg;
    }
    return syncMechanismRootSelection(
      pkg,
      drugEntityId,
      [...roots, id],
      fragmentMeta ? [fragmentMeta] : [{ id }],
    );
  }
  if (!roots.includes(id)) return pkg;
  return syncMechanismRootSelection(
    pkg,
    drugEntityId,
    roots.filter((rootId) => rootId !== id),
  );
}

export function syncMechanismRootSelection(
  pkg: DrugPublishPackage,
  drugEntityId: string,
  nextIds: string[],
  fragmentMeta: MechanismFragmentRef[] = [],
): DrugPublishPackage {
  const unique = [...new Set(nextIds.map((id) => id.trim()).filter(Boolean))];
  let next = clonePackage(pkg);
  const relationships = drugRelationshipMap(next);
  relationships.HAS_MECHANISM_ROOT = unique;

  const selected = new Set(unique);
  const preserved = relationshipRows(next).filter((row) => {
    if (row.relationship_type !== "HAS_MECHANISM_ROOT") return true;
    if (String(row.source_id) !== drugEntityId) return true;
    return selected.has(String(row.target_id));
  });

  const existingTargets = new Set(
    preserved
      .filter(
        (row) =>
          row.relationship_type === "HAS_MECHANISM_ROOT" &&
          String(row.source_id) === drugEntityId,
      )
      .map((row) => String(row.target_id)),
  );

  for (const fragmentId of unique) {
    if (existingTargets.has(fragmentId)) continue;
    preserved.push({
      relationship_type: "HAS_MECHANISM_ROOT",
      source_type: "Drug",
      target_type: "MechanismFragment",
      source_id: drugEntityId,
      target_id: fragmentId,
      properties: defaultMechanismEdgeProperties(),
    });
  }

  next.relationships = preserved as unknown as Record<string, unknown>[];
  next = ensureMechanismFragments(next, [
    ...fragmentMeta.filter((row) => unique.includes(row.id)),
    ...unique
      .filter((id) => !fragmentMeta.some((row) => row.id === id))
      .map((id) => ({ id })),
  ]);
  touchProvenance(next);
  return next;
}

export function listPathwayEdges(pkg: DrugPublishPackage): PathwayEdgeRow[] {
  return relationshipRows(pkg)
    .filter((row) => isPathwayEdgeType(String(row.relationship_type)))
    .map((row) => ({
      relationship_type: row.relationship_type as PathwayEdgeType,
      source_id: String(row.source_id),
      target_id: String(row.target_id),
      source_type: "MechanismFragment",
      target_type: "MechanismFragment",
      properties: {
        ...defaultMechanismEdgeProperties(),
        ...(isRecord(row.properties)
          ? (row.properties as unknown as MechanismEdgeProperties)
          : {}),
      },
    }));
}

export function listPathwayNodeIds(pkg: DrugPublishPackage): string[] {
  const ids = new Set(listMechanismRootIds(pkg));
  for (const edge of listPathwayEdges(pkg)) {
    ids.add(edge.source_id);
    ids.add(edge.target_id);
  }
  const related = Array.isArray(pkg.related_entities) ? pkg.related_entities : [];
  for (const row of related) {
    if (
      isRecord(row) &&
      row.entity_type === "MechanismFragment" &&
      typeof row.id === "string" &&
      row.id.trim()
    ) {
      ids.add(row.id.trim());
    }
  }
  return [...ids];
}

function pathwayAdjacency(pkg: DrugPublishPackage): Map<string, string[]> {
  const adj = new Map<string, string[]>();
  for (const edge of listPathwayEdges(pkg)) {
    const list = adj.get(edge.source_id) ?? [];
    list.push(edge.target_id);
    adj.set(edge.source_id, list);
  }
  return adj;
}

export function isPathwayAcyclic(pkg: DrugPublishPackage): boolean {
  const adj = pathwayAdjacency(pkg);
  const visiting = new Set<string>();
  const visited = new Set<string>();

  function dfs(node: string): boolean {
    if (visiting.has(node)) return false;
    if (visited.has(node)) return true;
    visiting.add(node);
    for (const next of adj.get(node) ?? []) {
      if (!dfs(next)) return false;
    }
    visiting.delete(node);
    visited.add(node);
    return true;
  }

  for (const node of adj.keys()) {
    if (!dfs(node)) return false;
  }
  return true;
}

export function wouldCreateCycle(
  pkg: DrugPublishPackage,
  sourceId: string,
  targetId: string,
): boolean {
  if (sourceId === targetId) return true;
  const probe = clonePackage(pkg);
  const rows = relationshipRows(probe);
  rows.push({
    relationship_type: "PRECEDES",
    source_type: "MechanismFragment",
    target_type: "MechanismFragment",
    source_id: sourceId,
    target_id: targetId,
    properties: defaultMechanismEdgeProperties(),
  });
  probe.relationships = rows as unknown as Record<string, unknown>[];
  return !isPathwayAcyclic(probe);
}

export function addPathwayEdge(
  pkg: DrugPublishPackage,
  input: {
    sourceId: string;
    targetId: string;
    relationshipType?: PathwayEdgeType;
    properties?: Partial<MechanismEdgeProperties>;
    fragments?: MechanismFragmentRef[];
  },
): DrugPublishPackage {
  const sourceId = input.sourceId.trim();
  const targetId = input.targetId.trim();
  if (!sourceId || !targetId || sourceId === targetId) return pkg;

  const relationshipType = input.relationshipType ?? "PRECEDES";
  const existing = listPathwayEdges(pkg).find(
    (edge) =>
      edge.source_id === sourceId &&
      edge.target_id === targetId &&
      edge.relationship_type === relationshipType,
  );
  if (existing) return pkg;
  if (wouldCreateCycle(pkg, sourceId, targetId)) {
    throw new Error("Pathway edges must remain acyclic (FG-C003).");
  }

  let next = clonePackage(pkg);
  const rows = relationshipRows(next);
  rows.push({
    relationship_type: relationshipType,
    source_type: "MechanismFragment",
    target_type: "MechanismFragment",
    source_id: sourceId,
    target_id: targetId,
    properties: {
      ...defaultMechanismEdgeProperties(),
      ...input.properties,
    },
  });
  next.relationships = rows as unknown as Record<string, unknown>[];
  next = ensureMechanismFragments(next, [
    ...(input.fragments ?? []),
    { id: sourceId },
    { id: targetId },
  ]);
  touchProvenance(next);
  return next;
}

export function removePathwayEdge(
  pkg: DrugPublishPackage,
  sourceId: string,
  targetId: string,
  relationshipType?: PathwayEdgeType,
): DrugPublishPackage {
  const next = clonePackage(pkg);
  next.relationships = relationshipRows(next).filter((row) => {
    if (!isPathwayEdgeType(String(row.relationship_type))) return true;
    if (String(row.source_id) !== sourceId || String(row.target_id) !== targetId) return true;
    if (relationshipType && row.relationship_type !== relationshipType) return true;
    return false;
  }) as unknown as Record<string, unknown>[];
  touchProvenance(next);
  return next;
}

export function addPathwayNode(
  pkg: DrugPublishPackage,
  fragment: MechanismFragmentRef,
): DrugPublishPackage {
  return ensureMechanismFragments(pkg, [fragment]);
}

export function removePathwayNode(pkg: DrugPublishPackage, fragmentId: string): DrugPublishPackage {
  const id = fragmentId.trim();
  if (!id) return pkg;

  const roots = listMechanismRootIds(pkg).filter((rootId) => rootId !== id);
  const drugEntityId = String(pkg.entity_payload.id ?? "");
  const next = drugEntityId
    ? syncMechanismRootSelection(pkg, drugEntityId, roots)
    : clonePackage(pkg);

  next.relationships = relationshipRows(next).filter((row) => {
    if (!isPathwayEdgeType(String(row.relationship_type))) return true;
    return String(row.source_id) !== id && String(row.target_id) !== id;
  }) as unknown as Record<string, unknown>[];

  const stillRoot = listMechanismRootIds(next).includes(id);
  if (!stillRoot && Array.isArray(next.related_entities)) {
    next.related_entities = next.related_entities.filter(
      (row) => !(isRecord(row) && row.entity_type === "MechanismFragment" && row.id === id),
    );
  }
  touchProvenance(next);
  return next;
}

export function readFragmentLabel(pkg: DrugPublishPackage, fragmentId: string): string {
  const related = Array.isArray(pkg.related_entities) ? pkg.related_entities : [];
  for (const row of related) {
    if (isRecord(row) && row.id === fragmentId) {
      if (typeof row.label === "string" && row.label.trim()) return row.label;
      if (typeof row.slug === "string" && row.slug.trim()) return row.slug;
    }
  }
  return fragmentId;
}
