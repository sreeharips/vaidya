"""
Prakriti scoring engine — pure Python, zero ML/LLM dependencies.

Deterministic weighted-matrix scoring. Same inputs always produce the same output.
DO NOT add ML, LLM, or any non-deterministic logic here.
"""

from dataclasses import dataclass, field
from pathlib import Path

import yaml

_CONFIG_DIR = Path(__file__).resolve().parents[2] / "config"

CATEGORY_WEIGHTS = {"physical": 1.4, "digestion": 1.2, "mind": 1.1, "lifestyle": 1.0}


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------
@dataclass
class Answer:
    question_id: str
    category: str
    option_index: int  # 0, 1, or 2


@dataclass
class PrakritiProfile:
    vata: int  # percentage
    pitta: int  # percentage
    kapha: int  # percentage
    primary_type: str
    secondary_type: str | None
    tendencies: list[str] = field(default_factory=list)
    treatment_affinities: list[str] = field(default_factory=list)
    retreat_focus: str = ""


# ---------------------------------------------------------------------------
# YAML loaders (cached at module level)
# ---------------------------------------------------------------------------
_questions_cache: dict | None = None
_tendencies_cache: dict | None = None


def _load_questions() -> dict:
    global _questions_cache
    if _questions_cache is None:
        with open(_CONFIG_DIR / "questions.yaml") as f:
            _questions_cache = yaml.safe_load(f)
    return _questions_cache


def _load_tendencies() -> dict:
    global _tendencies_cache
    if _tendencies_cache is None:
        with open(_CONFIG_DIR / "tendencies.yaml") as f:
            _tendencies_cache = yaml.safe_load(f)
    return _tendencies_cache


def _get_question_by_id(question_id: str) -> dict:
    data = _load_questions()
    for q in data["questions"]:
        if q["id"] == question_id:
            return q
    raise ValueError(f"Unknown question_id: {question_id}")


# ---------------------------------------------------------------------------
# Dosha classification
# ---------------------------------------------------------------------------
def classify_dosha(vata_pct: int, pitta_pct: int, kapha_pct: int) -> str:
    """Classify dosha type from percentage scores.

    Returns one of: Vata, Pitta, Kapha, Vata-Pitta, Vata-Kapha,
    Pitta-Kapha, Tridosha.

    Rules:
    - If all three are within 5 points of each other → Tridosha
    - If the top two are within 5 points and both >10 points above third → dual type
    - Otherwise → single dominant dosha
    """
    scores = {"vata": vata_pct, "pitta": pitta_pct, "kapha": kapha_pct}
    ranked = sorted(scores.items(), key=lambda x: x[1], reverse=True)

    first_name, first_val = ranked[0]
    second_name, second_val = ranked[1]
    third_name, third_val = ranked[2]

    spread = first_val - third_val

    # Tridosha: all within 5 points
    if spread <= 5:
        return "Tridosha"

    gap_top_two = first_val - second_val
    gap_second_third = second_val - third_val

    # Dual type: top two within 5 points, and both meaningfully above third
    if gap_top_two <= 5 and gap_second_third > 5:
        pair = sorted([first_name, second_name])
        label_map = {
            ("kapha", "pitta"): "Pitta-Kapha",
            ("kapha", "vata"): "Vata-Kapha",
            ("pitta", "vata"): "Vata-Pitta",
        }
        return label_map[tuple(pair)]

    # Single dominant
    return first_name.capitalize()


# ---------------------------------------------------------------------------
# Scoring engine
# ---------------------------------------------------------------------------
def score(answers: list[Answer]) -> PrakritiProfile:
    """Score a list of answers and return a full PrakritiProfile.

    Each answer references a question_id. The engine:
    1. Loads the matching question from questions.yaml
    2. Gets vata/pitta/kapha scores for the selected option
    3. Multiplies by category weight
    4. Sums all weighted scores
    5. Normalises to percentages (sum = 100)
    6. Classifies dosha type
    7. Looks up tendencies and treatment affinities
    """
    v, p, k = 0.0, 0.0, 0.0

    for answer in answers:
        question = _get_question_by_id(answer.question_id)
        if answer.option_index < 0 or answer.option_index >= len(question["options"]):
            raise ValueError(
                f"option_index {answer.option_index} out of range for {answer.question_id}"
            )

        option = question["options"][answer.option_index]
        weight = CATEGORY_WEIGHTS[answer.category]

        v += option["vata"] * weight
        p += option["pitta"] * weight
        k += option["kapha"] * weight

    total = v + p + k
    if total == 0:
        vata_pct, pitta_pct, kapha_pct = 33, 34, 33
    else:
        vata_raw = v / total * 100
        pitta_raw = p / total * 100
        kapha_raw = k / total * 100

        # Round and fix to ensure sum == 100
        vata_pct = round(vata_raw)
        pitta_pct = round(pitta_raw)
        kapha_pct = round(kapha_raw)

        remainder = 100 - (vata_pct + pitta_pct + kapha_pct)
        if remainder != 0:
            # Assign remainder to the dosha with the largest rounding error
            errors = [
                (abs(vata_raw - vata_pct), "vata"),
                (abs(pitta_raw - pitta_pct), "pitta"),
                (abs(kapha_raw - kapha_pct), "kapha"),
            ]
            errors.sort(key=lambda x: x[0], reverse=True)
            adjust_target = errors[0][1]
            if adjust_target == "vata":
                vata_pct += remainder
            elif adjust_target == "pitta":
                pitta_pct += remainder
            else:
                kapha_pct += remainder

    dosha_type = classify_dosha(vata_pct, pitta_pct, kapha_pct)

    # Determine primary and secondary types
    scores_map = {"vata": vata_pct, "pitta": pitta_pct, "kapha": kapha_pct}
    ranked = sorted(scores_map.items(), key=lambda x: x[1], reverse=True)
    primary_type = ranked[0][0].capitalize()
    secondary_type = ranked[1][0].capitalize() if ranked[1][1] > 25 else None

    # Look up tendencies and treatment affinities
    tendencies_data = _load_tendencies()["dosha_types"]
    tendencies: list[str] = []
    treatment_affinities: list[str] = []
    retreat_focus = ""

    dosha_key = dosha_type.lower().replace("-", "-")
    if dosha_key in tendencies_data:
        entry = tendencies_data[dosha_key]
        tendencies = entry.get("tendencies", [])
        treatment_affinities = entry.get("recommended_treatments", [])
        retreat_focus = entry.get("ideal_retreat_focus", "")

    return PrakritiProfile(
        vata=vata_pct,
        pitta=pitta_pct,
        kapha=kapha_pct,
        primary_type=primary_type,
        secondary_type=secondary_type,
        tendencies=tendencies,
        treatment_affinities=treatment_affinities,
        retreat_focus=retreat_focus,
    )
