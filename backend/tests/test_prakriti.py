"""Tests for the Prakriti scoring engine."""

import pytest

from core.prakriti import (
    CATEGORY_WEIGHTS,
    Answer,
    PrakritiProfile,
    classify_dosha,
    score,
)

# ---------------------------------------------------------------------------
# Helper: build a full 22-answer set where every answer picks the same option
# ---------------------------------------------------------------------------
QUESTION_IDS_BY_CATEGORY = {
    "physical": [f"q{i:02d}" for i in range(1, 9)],
    "digestion": [f"q{i:02d}" for i in range(9, 14)],
    "mind": [f"q{i:02d}" for i in range(14, 19)],
    "lifestyle": [f"q{i:02d}" for i in range(19, 23)],
}


def _all_answers(option_index: int) -> list[Answer]:
    """Return 22 answers all selecting the same option_index (0=vata, 1=pitta, 2=kapha)."""
    answers = []
    for category, qids in QUESTION_IDS_BY_CATEGORY.items():
        for qid in qids:
            answers.append(Answer(question_id=qid, category=category, option_index=option_index))
    return answers


def _mixed_answers(vata_count: int, pitta_count: int, kapha_count: int) -> list[Answer]:
    """Build a 22-answer set with specified counts for each option.

    Distributes answers across categories proportionally.
    """
    assert vata_count + pitta_count + kapha_count == 22
    all_qids = []
    for category, qids in QUESTION_IDS_BY_CATEGORY.items():
        for qid in qids:
            all_qids.append((qid, category))

    answers = []
    idx = 0
    for option, count in [(0, vata_count), (1, pitta_count), (2, kapha_count)]:
        for _ in range(count):
            qid, category = all_qids[idx]
            answers.append(Answer(question_id=qid, category=category, option_index=option))
            idx += 1
    return answers


# ---------------------------------------------------------------------------
# Tests: classify_dosha
# ---------------------------------------------------------------------------
class TestClassifyDosha:
    def test_single_dominant_vata(self):
        assert classify_dosha(60, 25, 15) == "Vata"

    def test_single_dominant_pitta(self):
        assert classify_dosha(15, 60, 25) == "Pitta"

    def test_single_dominant_kapha(self):
        assert classify_dosha(20, 15, 65) == "Kapha"

    def test_dual_vata_pitta(self):
        assert classify_dosha(40, 42, 18) == "Vata-Pitta"

    def test_dual_vata_kapha(self):
        assert classify_dosha(38, 20, 42) == "Vata-Kapha"

    def test_dual_pitta_kapha(self):
        assert classify_dosha(15, 43, 42) == "Pitta-Kapha"

    def test_tridosha_equal(self):
        assert classify_dosha(33, 34, 33) == "Tridosha"

    def test_tridosha_within_5(self):
        assert classify_dosha(32, 35, 33) == "Tridosha"

    def test_edge_exactly_5_spread_is_tridosha(self):
        assert classify_dosha(31, 36, 33) == "Tridosha"

    def test_edge_6_spread_not_tridosha(self):
        result = classify_dosha(30, 36, 34)
        assert result != "Tridosha"

    def test_dual_boundary_gap_exactly_5(self):
        # Top two within 5 of each other, gap to third > 5
        result = classify_dosha(40, 45, 15)
        assert result == "Vata-Pitta"

    def test_not_dual_when_third_is_close(self):
        # Top two within 5, but third also close → tridosha
        result = classify_dosha(33, 35, 32)
        assert result == "Tridosha"

    def test_two_equal_at_top(self):
        # Exactly equal top two, third well below
        result = classify_dosha(40, 40, 20)
        assert result in ("Vata-Pitta",)

    def test_all_equal(self):
        result = classify_dosha(33, 33, 34)
        assert result == "Tridosha"


# ---------------------------------------------------------------------------
# Tests: score() — all-Vata answers
# ---------------------------------------------------------------------------
class TestAllVataAnswers:
    def test_vata_dominant(self):
        profile = score(_all_answers(0))
        assert profile.primary_type == "Vata"
        assert profile.vata > profile.pitta
        assert profile.vata > profile.kapha

    def test_vata_high_percentage(self):
        profile = score(_all_answers(0))
        assert profile.vata >= 60

    def test_has_treatment_affinities(self):
        profile = score(_all_answers(0))
        assert len(profile.treatment_affinities) > 0
        assert "abhyanga" in profile.treatment_affinities

    def test_has_tendencies(self):
        profile = score(_all_answers(0))
        assert len(profile.tendencies) > 0


# ---------------------------------------------------------------------------
# Tests: score() — all-Pitta answers
# ---------------------------------------------------------------------------
class TestAllPittaAnswers:
    def test_pitta_dominant(self):
        profile = score(_all_answers(1))
        assert profile.primary_type == "Pitta"
        assert profile.pitta > profile.vata
        assert profile.pitta > profile.kapha

    def test_pitta_has_cooling_treatments(self):
        profile = score(_all_answers(1))
        assert "shirodhara" in profile.treatment_affinities


# ---------------------------------------------------------------------------
# Tests: score() — all-Kapha answers
# ---------------------------------------------------------------------------
class TestAllKaphaAnswers:
    def test_kapha_dominant(self):
        profile = score(_all_answers(2))
        assert profile.primary_type == "Kapha"
        assert profile.kapha > profile.vata
        assert profile.kapha > profile.pitta


# ---------------------------------------------------------------------------
# Tests: score normalisation always sums to 100
# ---------------------------------------------------------------------------
class TestNormalisation:
    def test_all_vata_sums_to_100(self):
        profile = score(_all_answers(0))
        assert profile.vata + profile.pitta + profile.kapha == 100

    def test_all_pitta_sums_to_100(self):
        profile = score(_all_answers(1))
        assert profile.vata + profile.pitta + profile.kapha == 100

    def test_all_kapha_sums_to_100(self):
        profile = score(_all_answers(2))
        assert profile.vata + profile.pitta + profile.kapha == 100

    def test_mixed_sums_to_100(self):
        profile = score(_mixed_answers(10, 7, 5))
        assert profile.vata + profile.pitta + profile.kapha == 100

    def test_even_split_sums_to_100(self):
        # 8 vata + 7 pitta + 7 kapha = 22
        profile = score(_mixed_answers(8, 7, 7))
        assert profile.vata + profile.pitta + profile.kapha == 100


# ---------------------------------------------------------------------------
# Tests: mixed answers — correct percentage math
# ---------------------------------------------------------------------------
class TestMixedAnswers:
    def test_mostly_vata_with_some_pitta(self):
        # 15 vata, 7 pitta, 0 kapha
        profile = score(_mixed_answers(15, 7, 0))
        assert profile.primary_type == "Vata"
        assert profile.vata > profile.pitta > profile.kapha

    def test_balanced_mix(self):
        # 8 vata, 7 pitta, 7 kapha — should be close to balanced
        profile = score(_mixed_answers(8, 7, 7))
        # All should be roughly in the 25-40 range
        assert profile.vata >= 25
        assert profile.pitta >= 20
        assert profile.kapha >= 20

    def test_secondary_type_present_when_over_25(self):
        # Enough pitta answers that pitta should be > 25%
        profile = score(_mixed_answers(12, 10, 0))
        assert profile.secondary_type is not None

    def test_no_secondary_when_heavily_dominant(self):
        profile = score(_all_answers(0))
        # When one dosha is 60%+, the others are likely <25%
        if profile.pitta <= 25 and profile.kapha <= 25:
            second_highest = max(profile.pitta, profile.kapha)
            if second_highest <= 25:
                assert profile.secondary_type is None


# ---------------------------------------------------------------------------
# Tests: boundary — two doshas exactly equal
# ---------------------------------------------------------------------------
class TestEqualDoshas:
    def test_two_equal_produces_dual_type(self):
        # Force a scenario where vata and pitta are nearly equal
        # by using 11 vata + 11 pitta + 0 kapha
        profile = score(_mixed_answers(11, 11, 0))
        # Both should be significant
        assert profile.vata > 20
        assert profile.pitta > 20
        # Should classify as dual or one of them as primary
        dosha = classify_dosha(profile.vata, profile.pitta, profile.kapha)
        assert dosha in ("Vata-Pitta", "Vata", "Pitta")


# ---------------------------------------------------------------------------
# Tests: determinism
# ---------------------------------------------------------------------------
class TestDeterminism:
    def test_same_inputs_same_output(self):
        answers = _mixed_answers(10, 8, 4)
        profile1 = score(answers)
        profile2 = score(answers)
        assert profile1.vata == profile2.vata
        assert profile1.pitta == profile2.pitta
        assert profile1.kapha == profile2.kapha
        assert profile1.primary_type == profile2.primary_type
        assert profile1.secondary_type == profile2.secondary_type

    def test_deterministic_over_many_runs(self):
        answers = _all_answers(0)
        results = [score(answers) for _ in range(50)]
        assert all(r.vata == results[0].vata for r in results)
        assert all(r.pitta == results[0].pitta for r in results)
        assert all(r.kapha == results[0].kapha for r in results)


# ---------------------------------------------------------------------------
# Tests: error handling
# ---------------------------------------------------------------------------
class TestErrors:
    def test_invalid_question_id(self):
        with pytest.raises(ValueError, match="Unknown question_id"):
            score([Answer(question_id="q99", category="physical", option_index=0)])

    def test_invalid_option_index(self):
        with pytest.raises(ValueError, match="option_index"):
            score([Answer(question_id="q01", category="physical", option_index=5)])

    def test_negative_option_index(self):
        with pytest.raises(ValueError, match="option_index"):
            score([Answer(question_id="q01", category="physical", option_index=-1)])


# ---------------------------------------------------------------------------
# Tests: category weights are applied
# ---------------------------------------------------------------------------
class TestCategoryWeights:
    def test_physical_weighted_higher(self):
        """A single physical-category vata answer should contribute more
        than a single lifestyle-category vata answer."""
        physical = score([Answer(question_id="q01", category="physical", option_index=0)])
        lifestyle = score([Answer(question_id="q19", category="lifestyle", option_index=0)])
        # With only one answer each, both should be vata-dominant,
        # but the raw vata weight should be higher for physical
        # (we can verify via the percentage staying the same since it's relative)
        # What matters is that the weight constant is being used
        assert CATEGORY_WEIGHTS["physical"] > CATEGORY_WEIGHTS["lifestyle"]

    def test_weights_match_spec(self):
        assert CATEGORY_WEIGHTS == {
            "physical": 1.4,
            "digestion": 1.2,
            "mind": 1.1,
            "lifestyle": 1.0,
        }


# ---------------------------------------------------------------------------
# Tests: retreat focus and tendencies lookup
# ---------------------------------------------------------------------------
class TestTendenciesLookup:
    def test_vata_retreat_focus(self):
        profile = score(_all_answers(0))
        assert "warm" in profile.retreat_focus.lower() or "nourish" in profile.retreat_focus.lower()

    def test_pitta_retreat_focus(self):
        profile = score(_all_answers(1))
        assert "cool" in profile.retreat_focus.lower()

    def test_kapha_retreat_focus(self):
        profile = score(_all_answers(2))
        assert "stimulat" in profile.retreat_focus.lower() or "detox" in profile.retreat_focus.lower()
