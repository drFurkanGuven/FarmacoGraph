"""AI Content Generator for education materials."""

from __future__ import annotations

import json
from typing import Any

from farmacograph.services.ai_provider import AIProvider


# Prompts for different content types
FLASHCARD_SYSTEM_PROMPT = """You are a medical education expert creating flashcards for pharmacology students. 
Generate clear, concise flashcards that test important clinical knowledge.
Each flashcard should have a question on one side and a precise answer on the other.
Focus on high-yield facts that are commonly tested in medical exams."""

FLASHCARD_PROMPT = """Create {count} pharmacology flashcards about {drug_name}.

Drug information:
- Class: {drug_class}
- Mechanism: {mechanism}
- Indications: {indications}

Format each flashcard as JSON with "question" and "answer" fields.
Return ONLY a valid JSON array, no other text.

Example format:
[
  {{"question": "What is the mechanism of action of {drug_name}?", "answer": "..."}},
  {{"question": "...", "answer": "..."}}
]"""


QUIZ_SYSTEM_PROMPT = """You are a medical examiner creating clinical quiz questions for pharmacology.
Create challenging multiple-choice questions that test clinical reasoning.
Each question should have 4 options with one correct answer and a detailed explanation."""

QUIZ_PROMPT = """Create {count} clinical quiz questions about {drug_name}.

Drug information:
- Class: {drug_class}
- Mechanism: {mechanism}
- Indications: {indications}
- Side effects: {side_effects}

Format each question as JSON with "question", "options" (array of 4), "correct_answer" (index 0-3), and "explanation" fields.
Return ONLY a valid JSON array, no other text.

Example format:
[
  {{
    "question": "A 65-year-old patient...",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correct_answer": 0,
    "explanation": "Detailed explanation..."
  }}
]"""


CLINICAL_PEARL_SYSTEM_PROMPT = """You are a senior clinician sharing practical clinical pearls.
Create memorable, high-yield clinical tips that help students and junior doctors.
Focus on practical applications, common pitfalls, and memorable mnemonics."""

CLINICAL_PEARL_PROMPT = """Create {count} clinical pearls about {drug_name}.

Drug information:
- Class: {drug_class}
- Mechanism: {mechanism}
- Indications: {indications}

Format each pearl as JSON with "title" and "content" fields.
Return ONLY a valid JSON array, no other text.

Example format:
[
  {{"title": "Remember...", "content": "Clinical pearl content..."}},
  {{"title": "...", "content": "..."}}
]"""


def parse_json_response(content: str) -> list[dict[str, Any]]:
    """Parse JSON from AI response, handling markdown code blocks."""
    content = content.strip()

    # Remove markdown code blocks if present
    if content.startswith("```"):
        lines = content.split("\n")
        # Remove first and last lines (``` markers)
        lines = [l for l in lines if not l.strip().startswith("```")]
        content = "\n".join(lines)

    try:
        return json.loads(content)
    except json.JSONDecodeError:
        # Try to find JSON array in the content
        start = content.find("[")
        end = content.rfind("]") + 1
        if start >= 0 and end > start:
            try:
                return json.loads(content[start:end])
            except json.JSONDecodeError:
                pass
        return []


async def generate_flashcards(
    provider: AIProvider,
    drug_name: str,
    drug_class: str = "",
    mechanism: str = "",
    indications: str = "",
    count: int = 5,
) -> list[dict[str, str]]:
    """Generate flashcards for a drug."""
    prompt = FLASHCARD_PROMPT.format(
        count=count,
        drug_name=drug_name,
        drug_class=drug_class or "Not specified",
        mechanism=mechanism or "Not specified",
        indications=indications or "Not specified",
    )

    response = await provider.generate(
        prompt=prompt,
        system_prompt=FLASHCARD_SYSTEM_PROMPT,
        temperature=0.7,
    )

    return parse_json_response(response)


async def generate_quiz(
    provider: AIProvider,
    drug_name: str,
    drug_class: str = "",
    mechanism: str = "",
    indications: str = "",
    side_effects: str = "",
    count: int = 3,
) -> list[dict[str, Any]]:
    """Generate quiz questions for a drug."""
    prompt = QUIZ_PROMPT.format(
        count=count,
        drug_name=drug_name,
        drug_class=drug_class or "Not specified",
        mechanism=mechanism or "Not specified",
        indications=indications or "Not specified",
        side_effects=side_effects or "Not specified",
    )

    response = await provider.generate(
        prompt=prompt,
        system_prompt=QUIZ_SYSTEM_PROMPT,
        temperature=0.7,
    )

    return parse_json_response(response)


async def generate_clinical_pearls(
    provider: AIProvider,
    drug_name: str,
    drug_class: str = "",
    mechanism: str = "",
    indications: str = "",
    count: int = 3,
) -> list[dict[str, str]]:
    """Generate clinical pearls for a drug."""
    prompt = CLINICAL_PEARL_PROMPT.format(
        count=count,
        drug_name=drug_name,
        drug_class=drug_class or "Not specified",
        mechanism=mechanism or "Not specified",
        indications=indications or "Not specified",
    )

    response = await provider.generate(
        prompt=prompt,
        system_prompt=CLINICAL_PEARL_SYSTEM_PROMPT,
        temperature=0.7,
    )

    return parse_json_response(response)
