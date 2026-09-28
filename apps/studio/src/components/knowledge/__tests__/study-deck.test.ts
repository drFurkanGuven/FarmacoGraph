import { describe, expect, it } from "vitest";
import {
  MAX_BOX,
  buildDrillDeck,
  deckStats,
  gradeCard,
  orderDeck,
  type DrillProgress,
} from "../study-deck";
import type { EducationResource } from "@/lib/api/types";

function item(partial: Partial<EducationResource> & { id: string }): EducationResource {
  return {
    entity_type: "EducationResource",
    content_layer: "education",
    ...partial,
  } as EducationResource;
}

const SAMPLE: EducationResource[] = [
  item({ id: "c1", kind: "Flashcard", front: "ACEi suffix?", back: "-pril", hint: "Think" }),
  item({
    id: "c2",
    kind: "CommonMistake",
    mistake: "Stop BB abruptly",
    correction: "Taper 1-2 weeks",
  }),
  item({ id: "c3", kind: "Mnemonic", mnemonic: "ABCD", expansion: "A B C D" }),
  item({ id: "c4", kind: "BoardExamPearl", text: "Pearl without Q/A" }),
  item({ id: "c5", kind: "Flashcard", front: "Only front" }),
];

describe("buildDrillDeck", () => {
  it("derives Q/A cards from flashcards, mistakes and mnemonics only", () => {
    const deck = buildDrillDeck(SAMPLE);
    expect(deck.map((card) => card.id)).toEqual(["c1", "c2", "c3"]);
    expect(deck[0]).toMatchObject({ question: "ACEi suffix?", answer: "-pril" });
    expect(deck[1]).toMatchObject({ question: "Stop BB abruptly", answer: "Taper 1-2 weeks" });
  });
});

describe("gradeCard", () => {
  it("moves boxes with lapses tracked", () => {
    let progress: DrillProgress = {};
    progress = gradeCard(progress, "c1", "good");
    expect(progress.c1.box).toBe(1);
    progress = gradeCard(progress, "c1", "easy");
    expect(progress.c1.box).toBe(3);
    progress = gradeCard(progress, "c1", "again");
    expect(progress.c1).toMatchObject({ box: 0, lapses: 1 });
    progress = gradeCard(progress, "c1", "hard");
    expect(progress.c1.box).toBe(0);
    for (let i = 0; i < 10; i++) progress = gradeCard(progress, "c1", "easy");
    expect(progress.c1.box).toBe(MAX_BOX);
  });
});

describe("orderDeck", () => {
  it("reviews least-known cards first", () => {
    const deck = buildDrillDeck(SAMPLE);
    const progress = gradeCard(gradeCard({}, "c1", "easy"), "c1", "easy");
    const ordered = orderDeck(deck, progress);
    expect(ordered[ordered.length - 1].id).toBe("c1");
    expect(ordered.map((card) => card.id)).toContain("c2");
  });
});

describe("deckStats", () => {
  it("splits mastered / learning / new", () => {
    const deck = buildDrillDeck(SAMPLE);
    let progress: DrillProgress = {};
    progress = gradeCard(gradeCard(gradeCard(progress, "c1", "easy"), "c1", "easy"), "c1", "easy");
    progress = gradeCard(progress, "c2", "good");
    expect(deckStats(deck, progress)).toEqual({
      total: 3,
      mastered: 1,
      learning: 1,
      newCount: 1,
    });
  });
});
