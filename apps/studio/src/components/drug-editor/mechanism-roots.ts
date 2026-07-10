/** Helpers for Drug Editor HAS_MECHANISM_ROOT selection — keep package shape unchanged. */

import type { DrugPublishPackage } from "./types";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
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

export function syncMechanismRootSelection(
  pkg: DrugPublishPackage,
  nextIds: string[],
): DrugPublishPackage {
  const unique = [...new Set(nextIds.map((id) => id.trim()).filter(Boolean))];
  const entityPayload = structuredClone(pkg.entity_payload);
  const relationships = asRecord(entityPayload.relationships);
  relationships.HAS_MECHANISM_ROOT = unique;
  entityPayload.relationships = relationships;
  return {
    ...pkg,
    entity_payload: entityPayload,
  };
}
