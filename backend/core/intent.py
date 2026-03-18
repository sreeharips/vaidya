"""
core/intent.py — Keyword-based voice intent matcher.

Matches a voice transcript to one of the three answer options (a/b/c)
for a given Prakriti assessment question using the synonyms dictionary.

Design principle: NO LLM on the hot path.
  - keyword + synonym matching covers ~85–90% of typical answers
  - confidence < 0.6 → caller should invoke Claude Haiku (15% case)

Confidence scoring:
  - Each synonym match scores 1 point (multi-word phrase = 2 points)
  - Best option's score / total score = raw confidence
  - Penalised if only 1 keyword matched (single weak signal)
  - Boosted if 3+ keywords matched (strong multi-signal)
  - Final confidence clamped to [0.0, 0.95]
"""

import os
from functools import lru_cache
from pathlib import Path

import yaml

_SYNONYMS_PATH = Path(__file__).parent.parent.parent / "config" / "synonyms.yaml"
_OPTION_MAP = {"a": 0, "b": 1, "c": 2}

CONFIDENCE_THRESHOLD = float(os.getenv("INTENT_CONFIDENCE_THRESHOLD", "0.6"))


@lru_cache(maxsize=1)
def _load_synonyms() -> dict:
    with open(_SYNONYMS_PATH, "r") as f:
        return yaml.safe_load(f)


def match_intent(transcript: str, question_id: str) -> dict:
    """
    Match a transcript to one of the three answer options for a question.

    Args:
        transcript: Raw text from STT
        question_id: e.g. "q01", "q14"

    Returns:
        {
            "option_index": int | None,  # 0, 1, or 2 (None = no match)
            "confidence": float,         # 0.0 – 0.95
            "matched_words": list[str],  # keywords that fired for the best option
        }
    """
    synonyms = _load_synonyms()
    question_synonyms = synonyms.get(question_id)

    if not question_synonyms:
        return {"option_index": None, "confidence": 0.0, "matched_words": []}

    text = transcript.lower().strip()
    # Normalise: remove punctuation
    for ch in ".,!?;:\"'()[]{}":
        text = text.replace(ch, " ")

    scores: dict[str, int] = {}
    matched: dict[str, list[str]] = {}

    for option_key, syn_list in question_synonyms.items():
        score = 0
        words_matched: list[str] = []
        for syn in syn_list:
            syn_lower = syn.lower()
            if " " in syn_lower:
                # Multi-word phrase — counts double
                if syn_lower in text:
                    score += 2
                    words_matched.append(syn)
            else:
                # Single word — must appear as a word boundary token
                if f" {syn_lower} " in f" {text} ":
                    score += 1
                    words_matched.append(syn)
        scores[option_key] = score
        matched[option_key] = words_matched

    total_score = sum(scores.values())
    if total_score == 0:
        return {"option_index": None, "confidence": 0.0, "matched_words": []}

    best_key = max(scores, key=lambda k: scores[k])
    best_score = scores[best_key]

    # Raw confidence = best / total
    confidence = best_score / total_score

    # Penalty: only 1 point (weak single-word match) → reduce confidence
    if best_score == 1:
        confidence *= 0.65

    # Boost: 3+ matches (strong multi-signal)
    elif best_score >= 3:
        confidence = min(0.95, confidence * 1.15)

    # Tie-breaking: if two options share the best score, lower confidence
    top_scores = [v for v in scores.values() if v == best_score]
    if len(top_scores) > 1:
        confidence *= 0.55

    confidence = round(min(confidence, 0.95), 3)

    return {
        "option_index": _OPTION_MAP[best_key],
        "confidence": confidence,
        "matched_words": matched[best_key],
    }


def needs_llm_fallback(confidence: float) -> bool:
    """Returns True if confidence is below threshold and Claude Haiku should be called."""
    return confidence < CONFIDENCE_THRESHOLD
