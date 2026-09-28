"use client";

import { useMemo, useState } from "react";
import { Eye, EyeOff, GraduationCap, RotateCcw, Shuffle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/i18n/context";
import type { EducationResource } from "@/lib/api";
import {
  buildDrillDeck,
  deckStats,
  gradeCard,
  loadProgress,
  orderDeck,
  saveProgress,
  type DrillCard,
  type DrillGrade,
  type DrillProgress,
} from "./study-deck";

const GRADE_ORDER: DrillGrade[] = ["again", "hard", "good", "easy"];

export function StudyDrill({ drug, education }: { drug: string; education: EducationResource[] }) {
  const { t } = useLanguage();
  const deck = useMemo(() => buildDrillDeck(education), [education]);
  const [progress, setProgress] = useState<DrillProgress>(() => loadProgress(drug));
  const [position, setPosition] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [session, setSession] = useState(0);
  const [reviewed, setReviewed] = useState(0);

  const ordered = useMemo(() => orderDeck(deck, progress, session), [deck, progress, session]);
  const card: DrillCard | null = ordered.length > 0 ? ordered[position % ordered.length]! : null;
  const stats = useMemo(() => deckStats(deck, progress), [deck, progress]);

  function persist(next: DrillProgress) {
    setProgress(next);
    saveProgress(drug, next);
  }

  function handleGrade(grade: DrillGrade) {
    if (!card) return;
    persist(gradeCard(progress, card.id, grade));
    setRevealed(false);
    setReviewed((count) => count + 1);
    if (grade === "again") {
      // Requeue the lapsed card near the end of this session.
      setPosition((pos) => pos + 1);
    } else {
      setPosition((pos) => pos + 1);
    }
  }

  function restart(shuffle: boolean) {
    setPosition(0);
    setRevealed(false);
    setReviewed(0);
    if (shuffle) setSession((value) => value + 1);
  }

  if (deck.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {t(
          "study.emptyDeck",
          "No drillable cards yet. Add flashcards, mnemonics, or common mistakes in the Drug Editor."
        )}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Badge variant="success">
          {t("study.mastered", "Mastered")}: {stats.mastered}
        </Badge>
        <Badge variant="warning">
          {t("study.learning", "Learning")}: {stats.learning}
        </Badge>
        <Badge variant="muted">
          {t("study.newCards", "New")}: {stats.newCount}
        </Badge>
        <span className="ml-auto text-muted-foreground">
          {t("study.reviewed", "Reviewed")}: {reviewed} · {t("study.card", "Card")}{" "}
          {ordered.length > 0 ? (position % ordered.length) + 1 : 0}/{ordered.length}
        </span>
      </div>

      {card && (
        <div className="rounded-md border bg-card p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {card.kind}
            </span>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setRevealed((value) => !value)}
            >
              {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              {revealed
                ? t("study.hideAnswer", "Hide answer")
                : t("study.showAnswer", "Show answer")}
            </Button>
          </div>
          <p className="mt-2 text-base font-medium leading-relaxed">{card.question}</p>
          {card.hint && !revealed && (
            <p className="mt-2 text-xs text-muted-foreground">
              {t("study.hint", "Hint")}: {card.hint}
            </p>
          )}
          {revealed && (
            <div className="mt-3 space-y-3 border-t pt-3">
              <p className="text-sm leading-relaxed">{card.answer}</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {GRADE_ORDER.map((grade) => (
                  <Button
                    key={grade}
                    type="button"
                    size="sm"
                    variant={grade === "again" ? "destructive" : "outline"}
                    onClick={() => handleGrade(grade)}
                  >
                    {t(`study.grade.${grade}`, grade)}
                  </Button>
                ))}
              </div>
            </div>
          )}
          {!revealed && (
            <p className="mt-3 text-xs text-muted-foreground">
              {t("study.recallFirst", "Recall first, then reveal and grade yourself honestly.")}
            </p>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" onClick={() => restart(false)}>
          <RotateCcw className="h-4 w-4" />
          {t("study.restart", "Restart")}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => restart(true)}>
          <Shuffle className="h-4 w-4" />
          {t("study.shuffle", "Shuffle")}
        </Button>
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <GraduationCap className="h-3.5 w-3.5" />
          {t("study.leitnerHint", "Progress is saved on this device per drug.")}
        </span>
      </div>
    </div>
  );
}
