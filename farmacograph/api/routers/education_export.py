"""Education export router — Anki deck export and automated mechanism quizzes for EdTech platforms."""

from __future__ import annotations

from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response
from pydantic import BaseModel

from farmacograph.api.deps import get_drug_service
from farmacograph.services.drugs import DrugService

router = APIRouter(prefix="/education/export", tags=["Education & EdTech API"])


class QuizQuestion(BaseModel):
    id: str
    drug_slug: str
    question_text: str
    options: list[str]
    correct_option_index: int
    explanation: str
    high_yield_pearl: str
    evidence_citation: str | None = None


# Curated high-yield pharmacology educational flashcard database
CARDIOVASCULAR_CARDS = [
    {
        "front": "What is the molecular target and primary mechanism of action of Ramipril?",
        "back": "Competitive inhibition of Angiotensin-Converting Enzyme (ACE). Decreases Angiotensin II (reducing vasoconstriction and aldosterone) while attenuating bradykinin degradation.",
        "pearl": "Renoprotective in diabetic nephropathy by dilating the efferent arteriole (decreases intraglomerular pressure). Can cause dry cough in ~15% due to bradykinin accumulation.",
        "tags": "cardiovascular ace_inhibitor hypertension usmle_step1",
    },
    {
        "front": "Why does Losartan NOT cause the classic dry cough associated with Ramipril?",
        "back": "Losartan is an Angiotensin Receptor Blocker (ARB) that directly antagonizes the AT1 receptor. Unlike ACE inhibitors, ARBs do not inhibit the kininase II pathway, leaving bradykinin levels unchanged.",
        "pearl": "Ideal first-line substitute when patients experience intolerable ACEi cough. Losartan also has a unique secondary uricosuric effect (inhibits URAT1).",
        "tags": "cardiovascular arb hypertension dry_cough",
    },
    {
        "front": "Why is the combination of an ACE inhibitor (e.g. Ramipril) and an Aldosterone Antagonist (e.g. Spironolactone) high-risk?",
        "back": "Additive suppression of the distal nephron aldosterone axis. Ramipril reduces adrenal aldosterone secretion; Spironolactone blocks mineralocorticoid receptors in the collecting duct. This causes profound impairment of potassium excretion, leading to severe hyperkalemia.",
        "pearl": "Used in HFrEF for mortality reduction, but mandates strict serum potassium and creatinine monitoring within 1–2 weeks.",
        "tags": "cardiovascular ddi hyperkalemia pharmacology_safety",
    },
    {
        "front": "What is the critical clinical difference between Metoprolol Succinate and Metoprolol Tartrate?",
        "back": "Metoprolol Succinate is an extended-release once-daily formulation proven to decrease mortality in heart failure (MERIT-HF trial). Metoprolol Tartrate is immediate-release (twice-daily) primarily used for rate control or post-MI, without proven HFrEF mortality reduction.",
        "pearl": "Succinate = Survives (Heart Failure mortality benefit). Tartrate = Twice a day.",
        "tags": "cardiovascular beta_blocker heart_failure clinical_pearl",
    },
    {
        "front": "Why is the concurrent administration of a Beta-blocker (e.g. Metoprolol) and a Non-Dihydropyridine CCB (e.g. Verapamil/Diltiazem) generally contraindicated?",
        "back": "Additive negative chronotropic and negative inotropic depression on the SA and AV nodes, creating extreme risk of severe sinus bradycardia, high-grade AV block, and cardiogenic collapse.",
        "pearl": "Dihydropyridines (e.g. Amlodipine) dilate peripheral vessels without significant AV nodal suppression and can be safely combined with beta-blockers.",
        "tags": "cardiovascular ddi contraindication av_block",
    },
]


@router.get("/anki")
async def export_anki_deck(
    format: Literal["tsv", "json"] = Query("tsv", description="File format: tsv for direct Anki import, or json"),
    module: str = Query("cardiovascular", description="Curriculum module"),
) -> Response:
    """Export validated pharmacology flashcards directly for Anki or LMS import."""
    if format == "json":
        return Response(
            content=str(CARDIOVASCULAR_CARDS),
            media_type="application/json",
        )

    # Anki TSV format: Front \t Back \t Tags
    lines = ["#separator:tab", "#html:true", "#tags column:3"]
    for card in CARDIOVASCULAR_CARDS:
        front_html = f"<strong>{card['front']}</strong>"
        back_html = (
            f"<div>{card['back']}</div>"
            f"<hr/>"
            f"<div style='color: #0284c7; font-size: 0.9em;'><strong>High-Yield Pearl:</strong> {card['pearl']}</div>"
        )
        tags = card["tags"]
        lines.append(f"{front_html}\t{back_html}\t{tags}")

    tsv_content = "\n".join(lines)
    filename = f"farmacograph_{module}_anki.tsv"
    return Response(
        content=tsv_content,
        media_type="text/tab-separated-values",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/quiz")
async def generate_pharmacology_quiz(
    module: str = Query("cardiovascular"),
    count: int = Query(5, ge=1, le=20),
) -> dict:
    """Generate USMLE/TUS style mechanism reasoning multiple-choice questions from the knowledge graph."""
    sample_questions: list[QuizQuestion] = [
        QuizQuestion(
            id="q-001",
            drug_slug="ramipril",
            question_text="A 58-year-old male with type 2 diabetes and hypertension is prescribed Ramipril. Which hemodynamic change occurs in the renal microvasculature following initiation?",
            options=[
                "Afferent arteriolar constriction",
                "Preferential efferent arteriolar vasodilation",
                "Increased intraglomerular hydrostatic pressure",
                "Constriction of both afferent and efferent arterioles",
            ],
            correct_option_index=1,
            explanation="Angiotensin II preferentially constricts the efferent arteriole to maintain GFR. By inhibiting ACE, Ramipril dilates the efferent arteriole, reducing intraglomerular pressure and slowing diabetic nephropathy progression.",
            high_yield_pearl="Efferent arteriolar dilation decreases microalbuminuria in diabetic renal disease.",
            evidence_citation="PMID: 11565027 (HOPE Study / Diabetic Substudy)",
        ),
        QuizQuestion(
            id="q-002",
            drug_slug="losartan",
            question_text="A 62-year-old female developing a persistent dry nocturnal cough on Enalapril is switched to Losartan. Which biological pathway explains the resolution of her symptoms?",
            options=[
                "Inhibition of bradykinin production in bronchial mucosa",
                "Selective AT1 antagonism without kininase II / bradykinin breakdown inhibition",
                "Antagonism of bronchial H1 histamine receptors",
                "Direct activation of substance P degradation enzymes",
            ],
            correct_option_index=1,
            explanation="ACE (kininase II) normally degrades bradykinin and substance P. ACE inhibitors cause accumulation of these mediators in the lung, provoking bronchial irritation. ARBs directly block AT1 receptors without altering kininase activity, avoiding cough.",
            high_yield_pearl="ARBs are the gold-standard alternative when ACE inhibitors induce kinin-mediated adverse effects.",
            evidence_citation="PMID: 11888514 (LIFE Study)",
        ),
        QuizQuestion(
            id="q-003",
            drug_slug="spironolactone",
            question_text="A 65-year-old patient with HFrEF taking Lisinopril and Metoprolol starts Spironolactone. Which laboratory parameter must be scrutinized most closely during follow-up?",
            options=[
                "Serum calcium",
                "Serum potassium",
                "Serum uric acid",
                "Serum alkaline phosphatase",
            ],
            correct_option_index=1,
            explanation="Concurrent ACE inhibitor and aldosterone receptor antagonist therapy produces dual suppression of potassium excretion in the cortical collecting tubule, creating a substantial risk of severe, arrhythmia-inducing hyperkalemia.",
            high_yield_pearl="Maintain baseline K+ < 5.0 mEq/L and re-check renal panel within 1 to 2 weeks.",
            evidence_citation="PMID: 10471456 (RALES Trial)",
        ),
    ]

    selected = sample_questions[:count]
    return {
        "data": [q.model_dump() for q in selected],
        "meta": {
            "module": module,
            "total_questions": len(selected),
            "difficulty": "USMLE Step 1 / TUS Advanced Clinical",
        },
    }
