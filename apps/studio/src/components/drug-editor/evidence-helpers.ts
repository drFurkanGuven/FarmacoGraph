import { isMissingEvidenceIssue, parseValidationIssues } from "@/components/validation/validation-utils";
import type { ValidationResult } from "@/lib/api";
import type {
  DrugEvidenceAttachment,
  DrugEvidenceSummary,
  EvidenceItem,
  EvidenceQualityLevel,
  MissingEvidenceRequirement,
} from "./evidence-types";

const LOW_QUALITY_THRESHOLD = 0.5;
const HIGH_QUALITY_THRESHOLD = 0.8;

export const EVIDENCE_TYPE_OPTIONS = [
  { value: "pubmed_article", label: "PubMed article" },
  { value: "fda_label", label: "FDA label" },
  { value: "ema_smpc", label: "EMA SmPC" },
  { value: "clinical_guideline", label: "Clinical guideline" },
  { value: "systematic_review", label: "Systematic review" },
  { value: "meta_analysis", label: "Meta-analysis" },
  { value: "rct", label: "RCT" },
  { value: "review_article", label: "Review article" },
  { value: "textbook", label: "Textbook" },
  { value: "expert_consensus", label: "Expert consensus" },
] as const;

export function parseEvidenceItem(raw: Record<string, unknown>): EvidenceItem | null {
  const id = raw.id;
  const title = raw.title;
  const evidenceType = raw.evidence_type;

  if (typeof id !== "string" || typeof title !== "string" || typeof evidenceType !== "string") {
    return null;
  }

  const qualityScore = typeof raw.quality_score === "number" ? raw.quality_score : 0.5;

  return {
    id,
    title,
    evidence_type: evidenceType,
    quality_score: qualityScore,
    year: typeof raw.year === "number" ? raw.year : null,
    status: typeof raw.status === "string" ? raw.status : null,
    extract: typeof raw.extract === "string" ? raw.extract : null,
  };
}

export function parseDrugEvidenceAttachment(raw: Record<string, unknown>): DrugEvidenceAttachment | null {
  const evidenceId = typeof raw.evidence_id === "string" ? raw.evidence_id : null;
  const nestedEvidence = raw.evidence;

  if (evidenceId && typeof nestedEvidence === "object" && nestedEvidence !== null && !Array.isArray(nestedEvidence)) {
    const evidence = parseEvidenceItem(nestedEvidence as Record<string, unknown>);
    if (!evidence) return null;
    return {
      evidence_id: evidenceId,
      evidence,
      attached_at: typeof raw.attached_at === "string" ? raw.attached_at : null,
      relationship_type: typeof raw.relationship_type === "string" ? raw.relationship_type : null,
      target_id: typeof raw.target_id === "string" ? raw.target_id : null,
    };
  }

  const flatEvidence = parseEvidenceItem(raw);
  if (!flatEvidence) return null;

  return {
    evidence_id: flatEvidence.id,
    evidence: flatEvidence,
    attached_at: typeof raw.attached_at === "string" ? raw.attached_at : null,
    relationship_type: typeof raw.relationship_type === "string" ? raw.relationship_type : null,
    target_id: typeof raw.target_id === "string" ? raw.target_id : null,
  };
}

export function parseDrugEvidenceAttachments(payload: unknown): DrugEvidenceAttachment[] {
  if (!Array.isArray(payload)) return [];
  return payload
    .map((entry) =>
      typeof entry === "object" && entry !== null && !Array.isArray(entry)
        ? parseDrugEvidenceAttachment(entry as Record<string, unknown>)
        : null,
    )
    .filter((entry): entry is DrugEvidenceAttachment => entry !== null);
}

export function qualityLevelFromScore(score: number | null): EvidenceQualityLevel {
  if (score === null || Number.isNaN(score)) return "none";
  if (score >= HIGH_QUALITY_THRESHOLD) return "high";
  if (score >= LOW_QUALITY_THRESHOLD) return "medium";
  return "low";
}

export function formatQualityScore(score: number | null): string {
  if (score === null || Number.isNaN(score)) return "—";
  return `${Math.round(score * 100)}%`;
}

export function summarizeDrugEvidence(
  attachments: DrugEvidenceAttachment[],
  missingRequirements: MissingEvidenceRequirement[],
): DrugEvidenceSummary {
  const attachedCount = attachments.length;
  const missingCount = missingRequirements.length;

  if (attachedCount === 0) {
    return {
      attachedCount,
      missingCount,
      averageQuality: null,
      qualityLevel: "none",
      lowQualityCount: 0,
    };
  }

  const scores = attachments.map((entry) => entry.evidence.quality_score);
  const averageQuality = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  const lowQualityCount = scores.filter((score) => score < LOW_QUALITY_THRESHOLD).length;

  return {
    attachedCount,
    missingCount,
    averageQuality,
    qualityLevel: qualityLevelFromScore(averageQuality),
    lowQualityCount,
  };
}

export function missingRequirementsFromValidation(
  validation: ValidationResult | null,
): MissingEvidenceRequirement[] {
  if (!validation) return [];

  const issues = parseValidationIssues(validation.issues);
  const seen = new Set<string>();

  return issues
    .filter((issue) => isMissingEvidenceIssue(issue))
    .map((issue, index) => ({
      id: [
        issue.constraint_id ?? "no-constraint",
        issue.field ?? "no-field",
        issue.relationship_type ?? "no-rel",
        index,
      ].join(":"),
      message: issue.message,
      field: issue.field,
      relationship_type: issue.relationship_type,
      constraint_id: issue.constraint_id,
    }))
    .filter((requirement) => {
      if (seen.has(requirement.id)) return false;
      seen.add(requirement.id);
      return true;
    });
}

export function evidenceTypeLabel(value: string): string {
  const match = EVIDENCE_TYPE_OPTIONS.find((option) => option.value === value);
  return match?.label ?? value.replace(/_/g, " ");
}

export function isEvidenceAlreadyAttached(
  attachments: DrugEvidenceAttachment[],
  evidenceId: string,
): boolean {
  return attachments.some((entry) => entry.evidence_id === evidenceId);
}
