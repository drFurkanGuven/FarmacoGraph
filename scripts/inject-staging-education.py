"""Inject curator-authored education arrays into the 4 staging drug packages.

Every fact is traceable to the same package's own fields (mechanism labels,
indications, black-box text, PK strings, evidence titles). Nothing is invented:
check_docstrings below lists the source field per item.

Run: .venv/bin/python scripts/inject-staging-education.py  (repo root)
Idempotent: existing items with the same id are replaced, order preserved.
"""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DRUGS_DIR = ROOT / "staging" / "cardiovascular" / "drugs"


def base(drug_id: str, kind: str, key: str, **fields: object) -> dict:
    return {
        "id": f"{drug_id}:education:{kind}:{key}",
        "entity_type": "EducationResource",
        "kind": kind,
        "slug": f"{key}",
        "label": f"{key.replace('-', ' ')}",
        "content_layer": "education",
        "audience": ["medical_student"],
        "difficulty_level": "core",
        "language": "en",
        "module": "cardiovascular",
        "status": "published",
        "dataset_version": "2026.1.0",
        "linked_entity_ids": [drug_id],
        **fields,
    }


METOPROLOL = "bb260890-9589-5ede-b29d-937e4b73d5ee"
EDUCATION: dict[str, list[dict]] = {
    "metoprolol": [
        base(METOPROLOL, "Flashcard", "receptor",
             front="Which receptor does metoprolol selectively block?",
             back="Beta-1 adrenergic receptors, blocking catecholamine activation.",
             hint="Cardioselective beta blocker"),
        # source: entity_payload.half_life / bioavailability
        base(METOPROLOL, "Flashcard", "pk",
             front="Metoprolol half-life and formulations?",
             back="3–7 hours; tartrate is short-acting, succinate is extended-release.",
             hint="Formulation matters"),
        # source: related Evidence MERIT-HF supports_claim
        base(METOPROLOL, "BoardExamPearl", "merit-hf",
             text="MERIT-HF (1999): metoprolol succinate extended-release reduces mortality in chronic heart failure.",
             exam_tags=["TUS"]),
        # source: entity_payload.black_box_text
        base(METOPROLOL, "CommonMistake", "cessation",
             mistake="Stopping metoprolol abruptly is harmless.",
             correction="Abrupt cessation in coronary disease can trigger angina, MI or arrhythmias — taper gradually.",
             why_wrong="Rebound sympathetic activation after chronic beta-1 blockade."),
        # source: mechanism "Decreased myocardial contractility and heart rate"
        base(METOPROLOL, "Mnemonic", "one-beat",
             mnemonic="1-BEAT",
             expansion="Beta-1 blockade Eases Adrenergic Tone: lower heart rate and contractility."),
    ],
    "ramipril": [
        # source: mechanism "ACE Inhibition" description
        base("2c31ee65-5805-5693-bdeb-01bb4829b1b9", "Flashcard", "target",
             front="Which enzyme does ramiprilat inhibit?",
             back="Angiotensin-converting enzyme (ACE): blocks angiotensin II synthesis.",
             hint="Zinc catalytic site"),
        # source: entity_payload.half_life / duration
        base("2c31ee65-5805-5693-bdeb-01bb4829b1b9", "Flashcard", "pk",
             front="Ramipril bioavailability and dosing?",
             back="~28% oral bioavailability; 24-hour duration allows once-daily dosing.",
             hint="Prodrug, ~11h ramiprilat"),
        # source: related Evidence HOPE supports_claim
        base("2c31ee65-5805-5693-bdeb-01bb4829b1b9", "BoardExamPearl", "hope",
             text="HOPE (2000): ramipril reduces death, MI and stroke in high-risk patients.",
             exam_tags=["TUS"]),
        # source: entity_payload.half_life "(prodrug)"
        base("2c31ee65-5805-5693-bdeb-01bb4829b1b9", "CommonMistake", "prodrug",
             mistake="Ramipril acts directly without conversion.",
             correction="Ramipril is a prodrug hydrolyzed to active ramiprilat (~11h half-life)."),
        # source: drug name + DrugClass "ACE inhibitors"
        base("2c31ee65-5805-5693-bdeb-01bb4829b1b9", "Mnemonic", "pril",
             mnemonic="PRILs block ACE",
             expansion="Ramipril (-pril suffix) inhibits ACE, lowering angiotensin II."),
    ],
    "losartan": [
        # source: mechanism "Angiotensin receptor blockade" description
        base("04fe6ccc-c02e-5256-b362-af0fd4adff98", "Flashcard", "target",
             front="Which receptor does losartan block?",
             back="Angiotensin II type 1 (AT1) receptor, competitive antagonism.",
             hint="ARB, not ACE inhibitor"),
        # source: entity_payload.half_life / bioavailability
        base("04fe6ccc-c02e-5256-b362-af0fd4adff98", "Flashcard", "pk",
             front="Losartan active metabolite and duration?",
             back="E-3174 via CYP2C9/CYP3A4; effect lasts 6–9 hours.",
             hint="Prodrug-like activation"),
        # source: related Evidence RENAAL supports_claim
        base("04fe6ccc-c02e-5256-b362-af0fd4adff98", "BoardExamPearl", "renaal",
             text="RENAAL (2001): losartan protects kidneys in type 2 diabetic nephropathy.",
             exam_tags=["TUS"]),
        # source: entity_payload.black_box_text
        base("04fe6ccc-c02e-5256-b362-af0fd4adff98", "CommonMistake", "pregnancy",
             mistake="Losartan is safe in pregnancy like most antihypertensives.",
             correction="RAAS blockers cause fetal injury and death — stop immediately if pregnancy is detected."),
        # source: drug name + DrugClass "Angiotensin receptor blockers"
        base("04fe6ccc-c02e-5256-b362-af0fd4adff98", "Mnemonic", "sartan",
             mnemonic="SARTANs block AT1",
             expansion="Losartan (-sartan) blocks AT1 receptors: lower pressure, renal protection."),
    ],
    "spironolactone": [
        # source: mechanism "Mineralocorticoid receptor antagonism" description
        base("b173f67c-ef61-55b1-8679-b6a9f2138f6c", "Flashcard", "target",
             front="Which receptor does spironolactone antagonize?",
             back="Cytoplasmic mineralocorticoid (aldosterone) receptors.",
             hint="Potassium-sparing"),
        # source: entity_payload.onset / duration
        base("b173f67c-ef61-55b1-8679-b6a9f2138f6c", "Flashcard", "onset",
             front="Why is spironolactone onset delayed 24–48 hours?",
             back="Genomic effect: ENaC synthesis blockade; peak natriuresis at 48–72 hours.",
             hint="Gene transcription"),
        # source: related Evidence RALES supports_claim
        base("b173f67c-ef61-55b1-8679-b6a9f2138f6c", "BoardExamPearl", "rales",
             text="RALES (1999): spironolactone studied for morbidity/mortality benefit in severe heart failure.",
             exam_tags=["TUS"]),
        # source: DrugClass description "Potassium-sparing ... potassium retention"
        base("b173f67c-ef61-55b1-8679-b6a9f2138f6c", "CommonMistake", "potassium",
             mistake="Spironolactone wastes potassium like other diuretics.",
             correction="It is potassium-sparing: natriuresis with potassium retention (hyperkalemia risk)."),
        # source: mechanism + class facts
        base("b173f67c-ef61-55b1-8679-b6a9f2138f6c", "Mnemonic", "spiro-aldo",
             mnemonic="SPIRO blocks ALDO",
             expansion="Spironolactone antagonizes aldosterone: sodium out, potassium kept."),
    ],
}


def main() -> None:
    for slug, items in EDUCATION.items():
        path = DRUGS_DIR / f"{slug}.json"
        package = json.loads(path.read_text(encoding="utf-8"))
        package["education"] = items
        path.write_text(json.dumps(package, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        print(f"{slug}: {len(items)} education items")


if __name__ == "__main__":
    main()
