import type { EducationResource } from "@/lib/api/types";

/** A single self-test card derived from education content. */
export interface DrillCard {
  id: string;
  kind: string;
  question: string;
  answer: string;
  hint?: string | null;
}

export type DrillGrade = "again" | "hard" | "good" | "easy";

/** Leitner box per card id. Higher box = better known. */
export interface DrillProgress {
  [cardId: string]: { box: number; lapses: number };
}

export const MAX_BOX = 4;
const STORAGE_PREFIX = "farmacograph.studio.drill:";

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Build a self-test deck from education items (no backend change needed). */
export function buildDrillDeck(education: EducationResource[]): DrillCard[] {
  const deck: DrillCard[] = [];
  for (const item of education) {
    const id = String(item.id ?? item.slug ?? Math.random().toString(36).slice(2));
    const kind = String(item.kind ?? "");
    if (kind === "Flashcard" && text(item.front) && text(item.back)) {
      deck.push({
        id,
        kind,
        question: text(item.front),
        answer: text(item.back),
        hint: text(item.hint) || null,
      });
    } else if (kind === "CommonMistake" && text(item.mistake) && text(item.correction)) {
      deck.push({
        id,
        kind,
        question: text(item.mistake),
        answer: text(item.correction),
        hint: text(item.why_wrong) || null,
      });
    } else if (kind === "Mnemonic" && text(item.mnemonic) && text(item.expansion)) {
      deck.push({
        id,
        kind,
        question: text(item.mnemonic),
        answer: text(item.expansion),
      });
    }
  }
  return deck;
}

export function gradeCard(
  progress: DrillProgress,
  cardId: string,
  grade: DrillGrade
): DrillProgress {
  const current = progress[cardId] ?? { box: 0, lapses: 0 };
  let box = current.box;
  let lapses = current.lapses;
  if (grade === "again") {
    box = 0;
    lapses += 1;
  } else if (grade === "hard") {
    box = Math.max(0, box - 1);
  } else if (grade === "good") {
    box = Math.min(MAX_BOX, box + 1);
  } else {
    box = Math.min(MAX_BOX, box + 2);
  }
  return { ...progress, [cardId]: { box, lapses } };
}

/** Session order: least-known first, stable shuffle within a box. */
export function orderDeck(deck: DrillCard[], progress: DrillProgress, seed = 0): DrillCard[] {
  const keyed = deck.map((card, index) => {
    const box = progress[card.id]?.box ?? 0;
    // Deterministic pseudo-shuffle so a session order is reproducible in tests.
    const jitter = ((index * 2654435761 + seed * 40503) >>> 0) % 1000;
    return { card, box, jitter };
  });
  keyed.sort((a, b) => a.box - b.box || a.jitter - b.jitter);
  return keyed.map((entry) => entry.card);
}

export function deckStats(
  deck: DrillCard[],
  progress: DrillProgress
): {
  total: number;
  mastered: number;
  learning: number;
  newCount: number;
} {
  let mastered = 0;
  let learning = 0;
  let fresh = 0;
  for (const card of deck) {
    const record = progress[card.id];
    if (!record) fresh += 1;
    else if (record.box >= 3) mastered += 1;
    else learning += 1;
  }
  return { total: deck.length, mastered, learning, newCount: fresh };
}

export function loadProgress(drug: string): DrillProgress {
  if (typeof localStorage === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + drug);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as DrillProgress;
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

export function saveProgress(drug: string, progress: DrillProgress): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_PREFIX + drug, JSON.stringify(progress));
  } catch {
    // Private mode / quota — progress simply stays in memory.
  }
}
