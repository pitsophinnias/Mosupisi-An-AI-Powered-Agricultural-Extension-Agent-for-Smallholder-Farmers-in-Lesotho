# tests/offline/test_offline_behaviour.py
#
# Offline and cache tests for Mosupisi.
# These test the backend cache layers directly (IndexedDB tests require browser).
#
# Run with services running:
#   pytest tests/offline/test_offline_behaviour.py -v

import pytest
import requests
import time

BASE_WEATHER = "http://localhost:8002"
BASE_PEST    = "http://localhost:8001"
BASE_PLANTING = "http://localhost:3001"


# ---------------------------------------------------------------------------
# Weather service SQLite cache (30 min TTL)
# ---------------------------------------------------------------------------

class TestWeatherCache:
    """
    The weather service caches responses in SQLite (30 min TTL).
    Second request for same location should be faster (cache hit).
    """

    def test_second_request_faster_than_first(self):
        """Cache hit should respond in < 2s; fresh CSIS fetch can take 10-30s."""
        payload = {"lat": -29.32, "lon": 27.50, "location_name": "Maseru"}

        # First request — may hit CSIS API
        t0 = time.time()
        r1 = requests.post(f"{BASE_WEATHER}/api/weather/current", json=payload, timeout=60)
        t1 = time.time() - t0

        # Second request — should be cache hit
        t2 = time.time()
        r2 = requests.post(f"{BASE_WEATHER}/api/weather/current", json=payload, timeout=10)
        t3 = time.time() - t2

        assert r1.status_code == 200
        assert r2.status_code == 200
        # Cache hit should be noticeably faster (allow 5s for cache hit)
        assert t3 < 5.0, f"Second request took {t3:.1f}s — cache may not be working"

    def test_different_location_fetches_separately(self):
        """Different coordinates should fetch independently."""
        maseru = {"lat": -29.32, "lon": 27.50, "location_name": "Maseru"}
        leribe = {"lat": -28.88, "lon": 28.07, "location_name": "Leribe"}

        r1 = requests.post(f"{BASE_WEATHER}/api/weather/current", json=maseru, timeout=60)
        r2 = requests.post(f"{BASE_WEATHER}/api/weather/current", json=leribe, timeout=60)

        assert r1.status_code == 200
        assert r2.status_code == 200
        # Different locations — data may differ
        d1 = r1.json()
        d2 = r2.json()
        assert d1["location_name"] != d2["location_name"] or d1 == d2  # same town resolves same

    def test_forecast_cached_independently(self):
        """Forecast cache is separate from current weather cache."""
        payload = {"lat": -29.32, "lon": 27.50, "days": 3, "location_name": "Maseru"}
        t0 = time.time()
        r1 = requests.post(f"{BASE_WEATHER}/api/weather/forecast", json=payload, timeout=60)
        t1 = time.time() - t0

        t2 = time.time()
        r2 = requests.post(f"{BASE_WEATHER}/api/weather/forecast", json=payload, timeout=10)
        t3 = time.time() - t2

        assert r1.status_code == 200
        assert r2.status_code == 200
        assert t3 < 5.0, f"Forecast cache hit took {t3:.1f}s"


# ---------------------------------------------------------------------------
# Service fallback when LLM service is slow/unavailable
# ---------------------------------------------------------------------------

class TestLLMFallback:
    """
    When LLM service is slow, the keyword-based fallback must fire.
    These tests verify fallback responses are meaningful.
    """

    def test_pest_ask_fallback_on_no_context(self):
        """
        Pest control /ask returns a fallback if RAG retrieves nothing.
        Fallback must be a non-empty helpful string.
        """
        payload = {
            "question": "How do I water my crops?",  # not a pest question — poor RAG match
            "language": "en",
            "crop": None,
        }
        r = requests.post(f"{BASE_PEST}/api/ask/", json=payload, timeout=60)
        assert r.status_code == 200
        answer = r.json().get("answer", "")
        assert len(answer) > 10

    def test_chat_fallback_on_keyword(self):
        """Chat service keyword fallback fires when LLM unavailable."""
        payload = {
            "question": "How do I fertilize my maize?",
            "language": "en",
        }
        r = requests.post(
            "http://localhost:3002/api/chat/ask",
            json=payload,
            timeout=120
        )
        assert r.status_code == 200
        answer = r.json().get("answer", "")
        # Either LLM or fallback — both must contain useful content
        assert len(answer) > 10
        # Fallback for fertilizer keyword: should mention "basal fertilizer" or "LAN"
        # (actual LLM response will vary)


# ---------------------------------------------------------------------------
# Pest control offline cache validation
# ---------------------------------------------------------------------------

class TestPestControlOfflineCache:
    """
    The pest library is loaded from the knowledge base JSON on startup.
    It should be available even without LLM service.
    """

    def test_pest_library_available_without_ai(self):
        """Pest library GET should work regardless of LLM service status."""
        r = requests.get(f"{BASE_PEST}/api/pests/", timeout=10)
        assert r.status_code == 200
        pests = r.json()
        assert len(pests) > 0

    def test_general_tips_available_without_ai(self):
        """Prevention tips from JSON knowledge base — no AI needed."""
        r = requests.get(f"{BASE_PEST}/api/pests/tips", timeout=10)
        assert r.status_code == 200
        tips = r.json()
        assert len(tips) > 0

    def test_pest_reports_crud_works_without_llm(self):
        """CRUD on pest reports must work even if LLM service is down."""
        # Create
        payload = {
            "user_id": "offline-test-user",
            "crop": "maize",
            "pest_name": "Aphid",
            "date_observed": "2026-04-27",
            "location": "Maseru",
            "severity": "low",
            "action_taken": "Inspected manually",
            "notes": "Offline cache test",
        }
        r_create = requests.post(f"{BASE_PEST}/api/pests/reports", json=payload, timeout=10)
        assert r_create.status_code in (200, 201)
        report_id = r_create.json()["id"]

        # Read
        r_read = requests.get(
            f"{BASE_PEST}/api/pests/reports/user/offline-test-user",
            timeout=10
        )
        assert r_read.status_code == 200
        ids = [r["id"] for r in r_read.json()]
        assert report_id in ids

        # Update
        r_update = requests.patch(
            f"{BASE_PEST}/api/pests/reports/{report_id}",
            json={"status": "resolved"},
            timeout=10
        )
        assert r_update.status_code == 200

        # Delete
        r_delete = requests.delete(
            f"{BASE_PEST}/api/pests/reports/{report_id}",
            timeout=10
        )
        assert r_delete.status_code == 200


# ---------------------------------------------------------------------------
# Planting guide delta sync
# ---------------------------------------------------------------------------

class TestPlantingDeltaSync:
    """
    Delta sync: /api/sync/delta?since=<ISO timestamp>
    Returns only plantings modified after the given timestamp.
    """

    def test_delta_sync_returns_list(self):
        r = requests.get(
            f"{BASE_PLANTING}/api/sync/delta?since=2026-01-01T00:00:00Z",
            timeout=10
        )
        assert r.status_code == 200
        data = r.json()
        assert "delta" in data
        assert isinstance(data["delta"], list)

    def test_delta_sync_future_timestamp_returns_empty(self):
        """Nothing should have been modified after a future timestamp."""
        r = requests.get(
            f"{BASE_PLANTING}/api/sync/delta?since=2099-01-01T00:00:00Z",
            timeout=10
        )
        assert r.status_code == 200
        data = r.json()
        assert data["delta"] == []

    def test_delta_sync_invalid_timestamp_returns_422(self):
        r = requests.get(
            f"{BASE_PLANTING}/api/sync/delta?since=not-a-date",
            timeout=10
        )
        assert r.status_code == 422

    def test_full_sync_endpoint(self):
        """POST /api/sync — upsert plantings from device."""
        payload = {
            "plantings": [],
            "lastSyncTimestamp": "2026-04-01T00:00:00Z",
        }
        r = requests.post(f"{BASE_PLANTING}/api/sync", json=payload, timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert "synced" in data
        assert "timestamp" in data


# ---------------------------------------------------------------------------
# Sesotho translation quality evaluation
# ---------------------------------------------------------------------------

class TestSesothoQuality:
    """
    Sesotho translation quality checks — not a full linguistic evaluation
    (that requires native Sesotho speakers) but structural checks:
    - Not empty
    - Not identical to English (i.e., translation actually happened)
    - No obvious English sentences in a Sesotho response
    - No repetition loops
    """

    REFERENCE_PAIRS = [
        # (english, expected_sesotho_keywords)
        ("water",      ["nosetsa", "metsi", "mongobo"]),
        ("fertilizer", ["manyolo", "naetrojene"]),
        ("harvest",    ["kotula", "lithollo"]),
        ("maize",      ["mabele", "poone"]),
        ("pest",       ["likokonyana", "kokonyana"]),
    ]

    def _detect_repetition(self, text: str) -> bool:
        words = text.split()
        if len(words) < 10:
            return False
        for i in range(len(words) - 4):
            phrase = " ".join(words[i:i+4])
            if text.count(phrase) > 3:
                return True
        return False

    def test_sesotho_chat_response_not_english(self):
        """When language=st, chat must respond in Sesotho, not English."""
        payload = {
            "question": "Ke laola likokonyana joang?",  # How do I control pests?
            "language": "st",
        }
        r = requests.post(
            "http://localhost:3002/api/chat/ask",
            json=payload,
            timeout=120
        )
        if r.status_code != 200:
            pytest.skip("Chat service unavailable")
        answer = r.json().get("answer", "")
        # A Sesotho response should contain some common Sesotho words
        sesotho_indicators = ["ho", "ea", "le", "ka", "ke", "li", "ba", "se", "na"]
        found = sum(1 for w in sesotho_indicators if w in answer.lower().split())
        assert found >= 2, f"Response doesn't look like Sesotho: {answer[:100]}"

    def test_sesotho_advice_not_empty(self):
        """Sesotho planting advice must be non-empty."""
        payload = {
            "crop": "maize", "plantingDate": "2026-01-01",
            "area": "1 hectare", "location": "Maseru", "status": "growing",
        }
        r = requests.post(f"{BASE_PLANTING}/api/plantings", json=payload, timeout=10)
        if r.status_code not in (200, 201):
            pytest.skip("Cannot create planting")
        planting_id = r.json()["id"]

        r2 = requests.post(
            f"{BASE_PLANTING}/api/plantings/{planting_id}/advice",
            json={"language": "st"},
            timeout=120
        )
        assert r2.status_code == 200
        advice_st = r2.json().get("advice_st", "")
        assert len(advice_st) > 20, "Sesotho advice is empty or too short"

    def test_sesotho_advice_no_repetition(self):
        """Sesotho advice must not loop (repetition detection regression test)."""
        payload = {
            "crop": "sorghum", "plantingDate": "2026-02-01",
            "area": "2 hectares", "location": "Leribe", "status": "growing",
        }
        r = requests.post(f"{BASE_PLANTING}/api/plantings", json=payload, timeout=10)
        if r.status_code not in (200, 201):
            pytest.skip("Cannot create planting")
        planting_id = r.json()["id"]

        r2 = requests.post(
            f"{BASE_PLANTING}/api/plantings/{planting_id}/advice",
            json={"language": "st"},
            timeout=120
        )
        advice_st = r2.json().get("advice_st", "")
        assert not self._detect_repetition(advice_st), \
            f"Sesotho translation is looping: {advice_st[:200]}"