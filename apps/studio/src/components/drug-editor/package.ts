import type { DrugEditorSection, DrugPublishPackage } from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Flatten Neo4j node shapes (`{ d: {...} }` or nested `properties`) into a plain record. */
export function normalizeDrugRecord(raw: Record<string, unknown>): Record<string, unknown> {
  if (isRecord(raw.d)) return normalizeDrugRecord(raw.d);
  if (isRecord(raw.properties)) return { ...raw, ...raw.properties };

  const flattened: Record<string, unknown> = { ...raw };
  for (const [key, value] of Object.entries(raw)) {
    if (key.startsWith("d.") && typeof value !== "undefined") {
      flattened[key.slice(2)] = value;
    }
  }
  return flattened;
}

function nowIso(): string {
  return new Date().toISOString();
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function createEmptyDrugPackage(drugId: string, module = "cardiovascular"): DrugPublishPackage {
  const timestamp = nowIso();
  return {
    entity_payload: {
      id: drugId,
      entity_type: "Drug",
      slug: "",
      label: "",
      generic_name: "",
      module,
      routes: [],
      status: "draft",
      dataset_version: "2026.1.0",
      provenance: {
        created_at: timestamp,
        updated_at: timestamp,
        created_by: "",
        source: "manual",
        curator_attestation: true,
      },
      versioning: {
        dataset_version: "2026.1.0",
        ontology_version: "1.0.0",
        valid_from: todayIso(),
        status: "draft",
      },
      relationships: {
        BELONGS_TO: [],
        TREATS: [],
        HAS_MECHANISM_ROOT: [],
      },
    },
    related_entities: [],
    relationships: [],
    dataset_version: "2026.1.0",
    module,
    create_snapshot: false,
  };
}

export function drugRecordToPackage(
  drugId: string,
  record: Record<string, unknown>,
  module?: string | null,
): DrugPublishPackage {
  const drug = normalizeDrugRecord(record);
  const resolvedModule = String(drug.module ?? module ?? "cardiovascular");
  const base = createEmptyDrugPackage(drugId, resolvedModule);
  const relationships = isRecord(drug.relationships) ? drug.relationships : {};

  base.entity_payload = {
    ...base.entity_payload,
    id: String(drug.id ?? drugId),
    entity_type: String(drug.entity_type ?? "Drug"),
    slug: String(drug.slug ?? ""),
    label: String(drug.label ?? drug.generic_name ?? ""),
    generic_name: String(drug.generic_name ?? drug.label ?? ""),
    module: resolvedModule,
    routes: Array.isArray(drug.routes) ? drug.routes : [],
    status: String(drug.status ?? "published"),
    dataset_version: String(drug.dataset_version ?? base.dataset_version),
    provenance: {
      ...(isRecord(base.entity_payload.provenance) ? base.entity_payload.provenance : {}),
      ...(isRecord(drug.provenance) ? drug.provenance : {}),
      updated_at: nowIso(),
    },
    versioning: {
      ...(isRecord(base.entity_payload.versioning) ? base.entity_payload.versioning : {}),
      ...(isRecord(drug.versioning) ? drug.versioning : {}),
    },
    relationships: {
      BELONGS_TO: Array.isArray(relationships.BELONGS_TO) ? [...relationships.BELONGS_TO] : [],
      TREATS: Array.isArray(relationships.TREATS) ? [...relationships.TREATS] : [],
      HAS_MECHANISM_ROOT: Array.isArray(relationships.HAS_MECHANISM_ROOT)
        ? [...relationships.HAS_MECHANISM_ROOT]
        : [],
    },
  };

  base.module = resolvedModule;
  base.dataset_version = String(drug.dataset_version ?? base.dataset_version);
  return base;
}

export function getValueAtPath(root: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((current, segment) => {
    if (!isRecord(current)) return undefined;
    return current[segment];
  }, root);
}

export function setValueAtPath(root: Record<string, unknown>, path: string, value: unknown): void {
  const segments = path.split(".");
  let current: Record<string, unknown> = root;

  for (let index = 0; index < segments.length - 1; index += 1) {
    const segment = segments[index]!;
    const next = current[segment];
    if (!isRecord(next)) {
      current[segment] = {};
    }
    current = current[segment] as Record<string, unknown>;
  }

  current[segments[segments.length - 1]!] = value;
}

export function parseUuidList(value: string): string[] {
  return value
    .split(/[\n,]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function formatUuidList(value: unknown): string {
  if (!Array.isArray(value)) return "";
  return value.map((entry) => String(entry)).join("\n");
}

export function formatFieldValue(value: unknown, type: DrugEditorSection["fields"][number]["type"]): string {
  if (type === "uuid-list") return formatUuidList(value);
  if (value === null || value === undefined) return "";
  return String(value);
}

export function parseFieldValue(
  raw: string,
  type: DrugEditorSection["fields"][number]["type"],
): string | string[] | boolean {
  if (type === "uuid-list") return parseUuidList(raw);
  if (type === "readonly") return raw;
  if (raw === "true") return true;
  if (raw === "false") return false;
  return raw;
}

export function applyFieldChange(
  pkg: DrugPublishPackage,
  path: string,
  rawValue: string,
  type: DrugEditorSection["fields"][number]["type"],
): DrugPublishPackage {
  const next: DrugPublishPackage = structuredClone(pkg);
  const parsed = parseFieldValue(rawValue, type);
  setValueAtPath(next as unknown as Record<string, unknown>, path, parsed);

  if (isRecord(next.entity_payload.provenance)) {
    next.entity_payload.provenance.updated_at = nowIso();
  }

  return next;
}

export function sectionFieldValues(
  pkg: DrugPublishPackage,
  section: DrugEditorSection,
): Record<string, string> {
  const values: Record<string, string> = {};
  for (const field of section.fields) {
    values[field.key] = formatFieldValue(getValueAtPath(pkg, field.path), field.type);
  }
  return values;
}

export function relationshipCounts(pkg: DrugPublishPackage): Record<string, number> {
  const relationships = isRecord(pkg.entity_payload.relationships) ? pkg.entity_payload.relationships : {};
  return {
    classes: Array.isArray(relationships.BELONGS_TO) ? relationships.BELONGS_TO.length : 0,
    indications: Array.isArray(relationships.TREATS) ? relationships.TREATS.length : 0,
    mechanisms: Array.isArray(relationships.HAS_MECHANISM_ROOT)
      ? relationships.HAS_MECHANISM_ROOT.length
      : 0,
  };
}
