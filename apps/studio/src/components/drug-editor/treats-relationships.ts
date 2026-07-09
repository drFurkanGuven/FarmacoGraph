import type { DrugPublishPackage } from "./types";

export const TREATS_EVIDENCE_LEVELS = [
  { value: "expert_consensus", label: "Expert consensus (curator attested)" },
  { value: "A", label: "Level A" },
  { value: "B", label: "Level B" },
  { value: "C", label: "Level C" },
  { value: "D", label: "Level D" },
] as const;

export interface TreatsIndicationProperties {
  explanation: string;
  confidence_score: number;
  evidence_level: string;
}

export interface PackageRelationshipRow {
  relationship_type: string;
  source_id: string;
  target_id: string;
  source_type: string;
  target_type: string;
  properties?: TreatsIndicationProperties | Record<string, unknown> | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function defaultTreatsIndicationProperties(): TreatsIndicationProperties {
  return {
    explanation: "",
    confidence_score: 0.85,
    evidence_level: "expert_consensus",
  };
}

function normalizeProperties(value: unknown): TreatsIndicationProperties {
  if (!isRecord(value)) return defaultTreatsIndicationProperties();
  const confidence = value.confidence_score;
  return {
    explanation: typeof value.explanation === "string" ? value.explanation : "",
    confidence_score:
      typeof confidence === "number" && Number.isFinite(confidence) ? confidence : 0.85,
    evidence_level:
      typeof value.evidence_level === "string" && value.evidence_level
        ? value.evidence_level
        : "expert_consensus",
  };
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

export function listTreatsDiseaseIds(pkg: DrugPublishPackage): string[] {
  const relationships = drugRelationshipMap(pkg);
  const treats = relationships.TREATS;
  return Array.isArray(treats) ? treats.map((entry) => String(entry)) : [];
}

function treatsEdgeKey(sourceId: string, targetId: string): string {
  return `${sourceId}::TREATS::${targetId}`;
}

function relationshipRows(pkg: DrugPublishPackage): PackageRelationshipRow[] {
  if (!Array.isArray(pkg.relationships)) return [];
  return pkg.relationships as unknown as PackageRelationshipRow[];
}

function findTreatsEdge(
  pkg: DrugPublishPackage,
  drugEntityId: string,
  diseaseId: string,
): PackageRelationshipRow | undefined {
  const rows = relationshipRows(pkg);
  return rows.find(
    (row) =>
      row.relationship_type === "TREATS" &&
      String(row.source_id) === drugEntityId &&
      String(row.target_id) === diseaseId,
  );
}

export function readTreatsIndication(
  pkg: DrugPublishPackage,
  drugEntityId: string,
  diseaseId: string,
): TreatsIndicationProperties {
  const edge = findTreatsEdge(pkg, drugEntityId, diseaseId);
  return normalizeProperties(edge?.properties);
}

function clonePackage(pkg: DrugPublishPackage): DrugPublishPackage {
  return structuredClone(pkg);
}

function touchProvenance(pkg: DrugPublishPackage): void {
  if (isRecord(pkg.entity_payload.provenance)) {
    pkg.entity_payload.provenance.updated_at = new Date().toISOString();
  }
}

export function syncTreatsSelection(
  pkg: DrugPublishPackage,
  drugEntityId: string,
  selectedIds: string[],
): DrugPublishPackage {
  const next = clonePackage(pkg);
  const uniqueIds = [...new Set(selectedIds.map((id) => id.trim()).filter(Boolean))];
  const relationships = drugRelationshipMap(next);
  relationships.TREATS = uniqueIds;

  const selectedKeys = new Set(uniqueIds.map((id) => treatsEdgeKey(drugEntityId, id)));
  const preserved: PackageRelationshipRow[] = [];
  const rows = relationshipRows(next);

  for (const row of rows) {
    if (row.relationship_type !== "TREATS" || String(row.source_id) !== drugEntityId) {
      preserved.push(row);
      continue;
    }
    if (selectedKeys.has(treatsEdgeKey(drugEntityId, String(row.target_id)))) {
      preserved.push(row);
    }
  }

  const existingTargets = new Set(
    preserved
      .filter((row) => row.relationship_type === "TREATS" && String(row.source_id) === drugEntityId)
      .map((row) => String(row.target_id)),
  );

  for (const diseaseId of uniqueIds) {
    if (existingTargets.has(diseaseId)) continue;
    preserved.push({
      relationship_type: "TREATS",
      source_type: "Drug",
      target_type: "Disease",
      source_id: drugEntityId,
      target_id: diseaseId,
      properties: defaultTreatsIndicationProperties(),
    });
  }

  next.relationships = preserved as unknown as Record<string, unknown>[];
  touchProvenance(next);
  return next;
}

export function updateTreatsIndication(
  pkg: DrugPublishPackage,
  drugEntityId: string,
  diseaseId: string,
  patch: Partial<TreatsIndicationProperties>,
): DrugPublishPackage {
  const selectedIds = listTreatsDiseaseIds(pkg);
  const withSelection = selectedIds.includes(diseaseId)
    ? pkg
    : syncTreatsSelection(pkg, drugEntityId, [...selectedIds, diseaseId]);

  const next = clonePackage(withSelection);
  const rows = relationshipRows(next);
  const index = rows.findIndex(
    (row) =>
      row.relationship_type === "TREATS" &&
      String(row.source_id) === drugEntityId &&
      String(row.target_id) === diseaseId,
  );

  const current =
    index >= 0
      ? normalizeProperties(rows[index]?.properties)
      : defaultTreatsIndicationProperties();

  const updated: PackageRelationshipRow = {
    relationship_type: "TREATS",
    source_type: "Drug",
    target_type: "Disease",
    source_id: drugEntityId,
    target_id: diseaseId,
    properties: {
      ...current,
      ...patch,
    },
  };

  if (index >= 0) {
    rows[index] = updated;
  } else {
    rows.push(updated);
  }

  next.relationships = rows as unknown as Record<string, unknown>[];
  const relationships = drugRelationshipMap(next);
  if (!relationships.TREATS.includes(diseaseId)) {
    relationships.TREATS = [...listTreatsDiseaseIds(next), diseaseId];
  }
  touchProvenance(next);
  return next;
}

/** Ensure package.relationships has TREATS edge rows for every selected disease ID. */
export function ensureTreatsRelationshipEdges(pkg: DrugPublishPackage): DrugPublishPackage {
  const drugEntityId = String(pkg.entity_payload.id ?? "");
  if (!drugEntityId) return pkg;
  return syncTreatsSelection(pkg, drugEntityId, listTreatsDiseaseIds(pkg));
}
