import type { TreatsIndicationProperties } from "./treats-relationships";

export type TreatsIndicationReadiness = "ready" | "partial" | "missing";

export interface TreatsIndicationReadinessResult {
  status: TreatsIndicationReadiness;
  missing: string[];
}

export function readCuratorAttestationFromPackage(
  provenance: Record<string, unknown> | null | undefined,
): boolean {
  if (!provenance || typeof provenance !== "object" || Array.isArray(provenance)) {
    return false;
  }
  return provenance.curator_attestation === true;
}

/** Client-side mirror of FG-C012 / FG-C019 / FG-C020 for a single TREATS indication. */
export function evaluateTreatsIndicationReadiness(
  props: TreatsIndicationProperties,
  curatorAttestation: boolean,
): TreatsIndicationReadinessResult {
  const missing: string[] = [];

  if (!props.explanation.trim()) {
    missing.push("explanation");
  }

  if (
    typeof props.confidence_score !== "number" ||
    !Number.isFinite(props.confidence_score) ||
    props.confidence_score < 0 ||
    props.confidence_score > 1
  ) {
    missing.push("confidence_score");
  }

  if (!props.evidence_level) {
    missing.push("evidence_level");
  }

  const hasEvidenceIds = Array.isArray(props.evidence_ids) && props.evidence_ids.length > 0;
  const expertEscape = props.evidence_level === "expert_consensus" && curatorAttestation;

  if (!hasEvidenceIds && !expertEscape) {
    if (props.evidence_level === "expert_consensus") {
      missing.push("curator_attestation");
    } else {
      missing.push("evidence");
    }
  }

  if (missing.length === 0) {
    return { status: "ready", missing: [] };
  }

  const filledCount = 4 - missing.length;
  if (filledCount >= 2) {
    return { status: "partial", missing };
  }

  return { status: "missing", missing };
}

export function treatsReadinessLabel(status: TreatsIndicationReadiness): string {
  switch (status) {
    case "ready":
      return "Publish ready";
    case "partial":
      return "Incomplete";
    case "missing":
      return "Needs metadata";
  }
}
