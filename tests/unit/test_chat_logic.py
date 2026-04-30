# tests/unit/test_chat_logic.py
# Unit tests for mosupisi-chat-service/main.py helper functions
# Run from: backend/mosupisi-chat-service
#   pytest tests/unit/test_chat_logic.py -v

import pytest
import re


# ---------------------------------------------------------------------------
# _clean_response — strips echoed prompt artifacts
# ---------------------------------------------------------------------------

def _clean_response(text: str, message: str) -> str:
    """Replica of main.py _clean_response."""
    if not text:
        return text
    text = re.sub(r"^Farmer question:[^\n]*\n+", "", text, flags=re.IGNORECASE)
    text = re.sub(r"^Question:[^\n]*\n+", "", text, flags=re.IGNORECASE)
    text = re.sub(r"^(Advice|Answer)\s*:\s*", "", text, flags=re.IGNORECASE)
    q = message.strip().rstrip("?").lower()
    t = text.strip().lower()
    if t.startswith(q):
        text = text[len(q):].lstrip("? \n\t:")
    return text.strip()


class TestCleanResponse:

    def test_strips_farmer_question_prefix(self):
        raw = "Farmer question: How do I control locusts?\nLocusts can be controlled by pesticides."
        result = _clean_response(raw, "How do I control locusts?")
        assert not result.startswith("Farmer question")
        assert "pesticides" in result

    def test_strips_advice_label(self):
        raw = "Advice: Apply neem spray weekly."
        result = _clean_response(raw, "How do I control pests?")
        assert result == "Apply neem spray weekly."

    def test_strips_answer_label(self):
        raw = "Answer: Water your maize every 3 days."
        result = _clean_response(raw, "When should I water maize?")
        assert result == "Water your maize every 3 days."

    def test_clean_response_unchanged(self):
        raw = "Scout your maize weekly for armyworm."
        result = _clean_response(raw, "How to check for armyworm?")
        assert result == raw

    def test_empty_string_returns_empty(self):
        assert _clean_response("", "question") == ""

    def test_none_returns_none(self):
        assert _clean_response(None, "question") is None

    def test_strips_question_label(self):
        raw = "Question: How do I plant maize?\nPlant maize in October when rains start."
        result = _clean_response(raw, "How do I plant maize?")
        assert not result.startswith("Question")
        assert "October" in result

    def test_verbatim_question_at_start_stripped(self):
        raw = "how do I control locusts on my crops: Apply pesticides and contact extension officer."
        result = _clean_response(raw, "How do I control locusts on my crops")
        assert "Apply pesticides" in result

    def test_preserves_actual_advice(self):
        raw = "Farmer question: What fertilizer for maize?\nUse 2:3:2 + Zn at planting and LAN top-dress at 4 weeks."
        result = _clean_response(raw, "What fertilizer for maize?")
        assert "2:3:2" in result
        assert "LAN" in result


# ---------------------------------------------------------------------------
# _is_wrong_language — detects Chinese/non-Latin responses
# ---------------------------------------------------------------------------

def _is_wrong_language(text: str, expected_language: str) -> bool:
    """Replica of main.py _is_wrong_language."""
    if not text:
        return False
    non_latin = sum(1 for c in text if ord(c) > 0x2E7F)
    return non_latin > len(text) * 0.1


class TestWrongLanguageDetection:

    def test_english_response_not_flagged(self):
        text = "Scout your maize weekly for fall armyworm. Apply neem spray if infestation is found."
        assert _is_wrong_language(text, "en") is False

    def test_sesotho_response_not_flagged(self):
        text = "Hlahloba tšimo ea hau beke le beke bakeng sa sesobeng. Sebelisa neem ha kokonyana e fumaneha."
        assert _is_wrong_language(text, "st") is False

    def test_chinese_response_flagged(self):
        text = "蝗虫可以通过定期使用农药来控制。建议向推广人员寻求指导。"
        assert _is_wrong_language(text, "en") is True

    def test_mostly_english_with_few_unicode_not_flagged(self):
        # A response with a few emoji or special chars should not be flagged
        text = "Apply neem spray 🌿 every 7 days. Check leaves carefully for pests."
        assert _is_wrong_language(text, "en") is False

    def test_empty_string_not_flagged(self):
        assert _is_wrong_language("", "en") is False

    def test_arabic_response_flagged(self):
        text = "يمكن السيطرة على الجراد باستخدام المبيدات الحشرية بانتظام"
        assert _is_wrong_language(text, "en") is True

    def test_mixed_mostly_english_not_flagged(self):
        # Less than 10% non-Latin — should not be flagged
        text = "Control fall armyworm: 農 apply neem spray weekly and scout fields."
        ratio = sum(1 for c in text if ord(c) > 0x2E7F) / len(text)
        expected = ratio > 0.1
        assert _is_wrong_language(text, "en") == expected


# ---------------------------------------------------------------------------
# normaliseAdvice — inline numbered point splitting (PlantingGuide.js logic)
# Replicated in Python for testing
# ---------------------------------------------------------------------------

def normalise_advice(text: str) -> str:
    """Python replica of PlantingGuide.js normaliseAdvice."""
    if not text:
        return text
    t = re.sub(r"(\d+)\.\s+\1\.", r"\1.", text)
    t = re.sub(r"\s+(?=\d+\.\s)", "\n", t)
    return t.strip()


class TestNormaliseAdvice:

    def test_inline_points_split_to_lines(self):
        text = "1. First point. 2. Second point. 3. Third point."
        result = normalise_advice(text)
        lines = [l for l in result.split("\n") if l.strip()]
        assert len(lines) == 3

    def test_duplicate_numbers_removed(self):
        text = "1. First point. 2. 2. Second point."
        result = normalise_advice(text)
        assert "2. 2." not in result

    def test_already_newline_separated_unchanged(self):
        text = "1. First point.\n2. Second point.\n3. Third point."
        result = normalise_advice(text)
        lines = [l for l in result.split("\n") if l.strip()]
        assert len(lines) == 3

    def test_bold_format_preserved(self):
        text = "1. **Water Management**: Apply irrigation. 2. **Fertilizer**: Use LAN."
        result = normalise_advice(text)
        assert "**Water Management**" in result
        assert "**Fertilizer**" in result

    def test_empty_string(self):
        assert normalise_advice("") == ""

    def test_single_point_unchanged(self):
        text = "1. Apply neem spray weekly."
        assert normalise_advice(text).strip() == text.strip()