# tests/integration/test_service_integration.py
#
# Integration tests for Mosupisi services.
# ALL SERVICES MUST BE RUNNING before executing these tests.
#
# Run from: C:\Users\phinn\Documents\Project\Mosupisi
#   pytest tests/integration/test_service_integration.py -v
#
# Start services first (in order):
#   1. Profile service   : port 8003
#   2. Notification svc  : port 8004
#   3. LLM service       : port 3004
#   4. Weather service   : port 8002
#   5. Pest control      : port 8001
#   6. Planting guide    : port 3001
#   7. Chat Python AI    : port 3003
#   8. Chat Node gateway : port 3002

import pytest
import requests
import time

BASE = {
    "profile":       "http://localhost:8003",
    "notification":  "http://localhost:8004",
    "weather":       "http://localhost:8002",
    "pest":          "http://localhost:8001",
    "planting":      "http://localhost:3001",
    "chat_python":   "http://localhost:3003",
    "chat_node":     "http://localhost:3002",
    "llm":           "http://localhost:3004",
}

TIMEOUT = 10  # seconds for health checks


# ---------------------------------------------------------------------------
# Health check tests — every service must respond
# ---------------------------------------------------------------------------

class TestServiceHealth:

    def test_profile_service_healthy(self):
        r = requests.get(f"{BASE['profile']}/health", timeout=TIMEOUT)
        assert r.status_code == 200
        assert r.json().get("status") in ("healthy", "ok")

    def test_notification_service_healthy(self):
        r = requests.get(f"{BASE['notification']}/health", timeout=TIMEOUT)
        assert r.status_code == 200

    def test_weather_service_healthy(self):
        r = requests.get(f"{BASE['weather']}/health", timeout=TIMEOUT)
        assert r.status_code == 200

    def test_pest_control_service_healthy(self):
        r = requests.get(f"{BASE['pest']}/health", timeout=TIMEOUT)
        assert r.status_code == 200
        data = r.json()
        assert data.get("status") == "healthy"

    def test_planting_guide_service_healthy(self):
        r = requests.get(f"{BASE['planting']}/health", timeout=TIMEOUT)
        assert r.status_code == 200
        assert r.json().get("status") == "ok"

    def test_llm_service_healthy(self):
        r = requests.get(f"{BASE['llm']}/health", timeout=TIMEOUT)
        assert r.status_code == 200
        data = r.json()
        assert data.get("llm_loaded") is True, "LLM model not loaded — check mosupisi-llm-service"

    def test_chat_python_ai_healthy(self):
        r = requests.get(f"{BASE['chat_python']}/health", timeout=TIMEOUT)
        assert r.status_code == 200
        data = r.json()
        assert data.get("status") == "healthy"
        assert data.get("llm_status") == "reachable", "Chat service cannot reach LLM service"

    def test_chat_node_gateway_healthy(self):
        r = requests.get(f"{BASE['chat_node']}/api/health", timeout=TIMEOUT)
        assert r.status_code == 200
        data = r.json()
        assert data.get("status") == "healthy"


# ---------------------------------------------------------------------------
# Auth flow integration (profile service)
# ---------------------------------------------------------------------------

class TestAuthFlow:

    TEST_PHONE = "+26655999001"  # test number unlikely to exist
    TEST_PASSWORD = "TestPass@2026"

    def test_register_new_farmer(self):
        payload = {
            "full_name":      "Test Farmer",
            "phone_number":   self.TEST_PHONE,
            "password":       self.TEST_PASSWORD,
            "home_district":  "Maseru",
            "language":       "en",
        }
        r = requests.post(f"{BASE['profile']}/auth/register", json=payload, timeout=TIMEOUT)
        # 200 = created, 400 = already exists (both acceptable in tests)
        assert r.status_code in (200, 201, 400)

    def test_login_returns_tokens(self):
        payload = {
            "phone_number": self.TEST_PHONE,
            "password":     self.TEST_PASSWORD,
        }
        r = requests.post(f"{BASE['profile']}/auth/login", json=payload, timeout=TIMEOUT)
        if r.status_code == 200:
            data = r.json()
            assert "access_token" in data
            assert "refresh_token" in data
        else:
            pytest.skip("Test farmer not registered — run register test first")

    def test_get_profile_with_token(self):
        # Login first
        r = requests.post(
            f"{BASE['profile']}/auth/login",
            json={"phone_number": self.TEST_PHONE, "password": self.TEST_PASSWORD},
            timeout=TIMEOUT
        )
        if r.status_code != 200:
            pytest.skip("Cannot login — test farmer may not exist")
        token = r.json()["access_token"]
        # Get profile
        r2 = requests.get(
            f"{BASE['profile']}/profile/me",
            headers={"Authorization": f"Bearer {token}"},
            timeout=TIMEOUT
        )
        assert r2.status_code == 200
        data = r2.json()
        assert "full_name" in data or "name" in data

    def test_refresh_token_works(self):
        r = requests.post(
            f"{BASE['profile']}/auth/login",
            json={"phone_number": self.TEST_PHONE, "password": self.TEST_PASSWORD},
            timeout=TIMEOUT
        )
        if r.status_code != 200:
            pytest.skip("Cannot login")
        refresh_token = r.json()["refresh_token"]
        r2 = requests.post(
            f"{BASE['profile']}/auth/refresh",
            json={"refresh_token": refresh_token},
            timeout=TIMEOUT
        )
        assert r2.status_code == 200
        assert "access_token" in r2.json()

    def test_protected_route_without_token_returns_401(self):
        r = requests.get(f"{BASE['profile']}/profile/me", timeout=TIMEOUT)
        assert r.status_code == 401


# ---------------------------------------------------------------------------
# Weather service integration
# ---------------------------------------------------------------------------

class TestWeatherIntegration:

    def test_current_weather_maseru(self):
        r = requests.post(
            f"{BASE['weather']}/api/weather/current",
            json={"lat": -29.32, "lon": 27.50, "location_name": "Maseru"},
            timeout=30
        )
        assert r.status_code == 200
        data = r.json()
        assert "temperature_c" in data
        assert "humidity_pct" in data
        assert "description" in data
        assert data["location_name"] is not None

    def test_forecast_returns_days(self):
        r = requests.post(
            f"{BASE['weather']}/api/weather/forecast",
            json={"lat": -29.32, "lon": 27.50, "days": 3, "location_name": "Maseru"},
            timeout=30
        )
        assert r.status_code == 200
        data = r.json()
        assert "days" in data
        assert len(data["days"]) > 0

    def test_weather_for_butha_buthe(self):
        """Verify different district returns different location_name."""
        r = requests.post(
            f"{BASE['weather']}/api/weather/current",
            json={"lat": -28.76, "lon": 28.27, "location_name": "Butha-Buthe"},
            timeout=30
        )
        assert r.status_code == 200
        data = r.json()
        assert "temperature_c" in data

    def test_alert_evaluation_current(self):
        """POST /api/alerts/evaluate/current — frontend-callable endpoint."""
        weather = {
            "temperature_c": 1.0,   # below frost threshold (2.0°C)
            "humidity_pct": 60,
            "wind_speed_ms": 3.0,
            "rainfall_mm": 0,
            "description": "Clear",
            "location_name": "Maseru",
        }
        r = requests.post(
            f"{BASE['weather']}/api/alerts/evaluate/current",
            json=weather,
            timeout=TIMEOUT
        )
        assert r.status_code == 200
        alerts = r.json()
        assert isinstance(alerts, list)
        # Should contain frost alert
        types = [a.get("type", "").lower() for a in alerts]
        assert any("frost" in t for t in types), f"Expected frost alert, got: {types}"


# ---------------------------------------------------------------------------
# Pest control service integration
# ---------------------------------------------------------------------------

class TestPestControlIntegration:

    def test_get_all_pests(self):
        r = requests.get(f"{BASE['pest']}/api/pests/", timeout=TIMEOUT)
        assert r.status_code == 200
        pests = r.json()
        assert isinstance(pests, list)
        assert len(pests) > 0

    def test_pest_has_required_fields(self):
        r = requests.get(f"{BASE['pest']}/api/pests/", timeout=TIMEOUT)
        pest = r.json()[0]
        for field in ["id", "name", "crops", "severity", "symptoms"]:
            assert field in pest, f"Missing field: {field}"

    def test_get_crops(self):
        r = requests.get(f"{BASE['pest']}/api/pests/crops", timeout=TIMEOUT)
        assert r.status_code == 200
        crops = r.json()
        assert "maize" in crops or "sorghum" in crops

    def test_filter_pests_by_crop(self):
        r = requests.get(f"{BASE['pest']}/api/pests/?crop=maize", timeout=TIMEOUT)
        assert r.status_code == 200
        pests = r.json()
        for pest in pests:
            assert "maize" in [c.lower() for c in pest["crops"]]

    def test_ask_pest_question(self):
        payload = {
            "question": "How do I control fall armyworm?",
            "language": "en",
            "crop": "maize",
        }
        r = requests.post(f"{BASE['pest']}/api/ask/", json=payload, timeout=60)
        assert r.status_code == 200
        data = r.json()
        assert "answer" in data
        assert len(data["answer"]) > 10

    def test_create_pest_report(self):
        payload = {
            "user_id":       "test-user-1",
            "crop":          "maize",
            "pest_name":     "Fall Armyworm",
            "date_observed": "2026-04-27",
            "location":      "Maseru",
            "severity":      "medium",
            "action_taken":  "Applied neem spray",
            "notes":         "Integration test report",
        }
        r = requests.post(f"{BASE['pest']}/api/pests/reports", json=payload, timeout=TIMEOUT)
        assert r.status_code in (200, 201)
        data = r.json()
        assert "id" in data
        return data["id"]

    def test_get_user_reports(self):
        r = requests.get(
            f"{BASE['pest']}/api/pests/reports/user/test-user-1",
            timeout=TIMEOUT
        )
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# ---------------------------------------------------------------------------
# Planting guide integration
# ---------------------------------------------------------------------------

class TestPlantingGuideIntegration:

    def test_list_plantings(self):
        r = requests.get(f"{BASE['planting']}/api/plantings", timeout=TIMEOUT)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_create_planting(self):
        payload = {
            "crop":         "maize",
            "plantingDate": "2026-03-01",
            "area":         "2 hectares",
            "location":     "Maseru",
            "status":       "growing",
        }
        r = requests.post(f"{BASE['planting']}/api/plantings", json=payload, timeout=TIMEOUT)
        assert r.status_code in (200, 201)
        data = r.json()
        assert "id" in data
        assert data["crop"] == "maize"
        return data["id"]

    def test_get_planting_advice(self):
        """Full AI advice flow — may take up to 30s on first call."""
        # Create a planting first
        payload = {
            "crop": "sorghum", "plantingDate": "2026-02-01",
            "area": "1 hectare", "location": "Leribe", "status": "growing",
        }
        r = requests.post(f"{BASE['planting']}/api/plantings", json=payload, timeout=TIMEOUT)
        if r.status_code not in (200, 201):
            pytest.skip("Could not create test planting")
        planting_id = r.json()["id"]

        # Get AI advice
        r2 = requests.post(
            f"{BASE['planting']}/api/plantings/{planting_id}/advice",
            json={"language": "en"},
            timeout=120
        )
        assert r2.status_code == 200
        data = r2.json()
        assert "advice_en" in data
        assert len(data["advice_en"]) > 20
        assert "rotation_recommendation" in data

    def test_advice_does_not_echo_question(self):
        """Regression test: model must not repeat the prompt in response."""
        payload = {
            "crop": "maize", "plantingDate": "2026-01-15",
            "area": "1 hectare", "location": "Maseru", "status": "growing",
        }
        r = requests.post(f"{BASE['planting']}/api/plantings", json=payload, timeout=TIMEOUT)
        if r.status_code not in (200, 201):
            pytest.skip("Could not create test planting")
        planting_id = r.json()["id"]

        r2 = requests.post(
            f"{BASE['planting']}/api/plantings/{planting_id}/advice",
            json={"language": "en"},
            timeout=120
        )
        advice = r2.json().get("advice_en", "")
        assert not advice.lower().startswith("farmer question:")
        assert not advice.lower().startswith("answer:")


# ---------------------------------------------------------------------------
# Chat service integration (full chain)
# ---------------------------------------------------------------------------

class TestChatIntegration:

    def test_chat_ask_english(self):
        """Full chain: frontend → Node gateway → Python AI → LLM service."""
        payload = {
            "question": "How do I control fall armyworm on my maize?",
            "language": "en",
            "weatherContext": None,
            "context": None,
        }
        r = requests.post(
            f"{BASE['chat_node']}/api/chat/ask",
            json=payload,
            timeout=120
        )
        assert r.status_code == 200
        data = r.json()
        assert "answer" in data
        assert len(data["answer"]) > 10

    def test_chat_answer_is_english(self):
        """Regression: model must not respond in Chinese."""
        payload = {
            "question": "What fertilizer should I use for maize?",
            "language": "en",
        }
        r = requests.post(
            f"{BASE['chat_node']}/api/chat/ask",
            json=payload,
            timeout=120
        )
        if r.status_code != 200:
            pytest.skip("Chat service unavailable")
        answer = r.json().get("answer", "")
        # Check for CJK characters
        non_latin = sum(1 for c in answer if ord(c) > 0x2E7F)
        ratio = non_latin / max(len(answer), 1)
        assert ratio < 0.1, f"Response appears to be in wrong language: {answer[:100]}"

    def test_chat_does_not_echo_question(self):
        """Regression: model must not start response with the question."""
        question = "When should I water sorghum?"
        payload = {"question": question, "language": "en"}
        r = requests.post(
            f"{BASE['chat_node']}/api/chat/ask",
            json=payload,
            timeout=120
        )
        if r.status_code != 200:
            pytest.skip("Chat service unavailable")
        answer = r.json().get("answer", "")
        assert not answer.lower().startswith("farmer question:")
        assert not answer.lower().startswith(question.lower())

    def test_chat_with_weather_context(self):
        """Weather context is injected into prompt and affects response."""
        payload = {
            "question": "How does this rain affect my crops?",
            "language": "en",
            "weatherContext": "[Weather – Maseru]\nNow: Rain, 14°C, humidity 85%, wind 2.8 m/s",
        }
        r = requests.post(
            f"{BASE['chat_node']}/api/chat/ask",
            json=payload,
            timeout=120
        )
        assert r.status_code == 200
        data = r.json()
        assert len(data.get("answer", "")) > 10

    def test_dashboard_chat_endpoint(self):
        """POST /api/chat — used by dashboard AI advice card."""
        payload = {
            "message":        "CROP: What should I do? PEST: What to watch for?",
            "conversationId": "test-dashboard-001",
            "userId":         1,
        }
        r = requests.post(
            f"{BASE['chat_node']}/api/chat",
            json=payload,
            timeout=120
        )
        assert r.status_code == 200
        data = r.json()
        assert "response" in data or "answer" in data


# ---------------------------------------------------------------------------
# Notification service integration
# ---------------------------------------------------------------------------

class TestNotificationIntegration:

    FARMER_ID = 1  # assumes farmer with id=1 exists

    def test_get_notifications(self):
        r = requests.get(
            f"{BASE['notification']}/notifications/?farmer_id={self.FARMER_ID}",
            timeout=TIMEOUT
        )
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_unread_count_returns_number(self):
        r = requests.get(
            f"{BASE['notification']}/notifications/unread-count?farmer_id={self.FARMER_ID}",
            timeout=TIMEOUT
        )
        assert r.status_code == 200
        data = r.json()
        assert "count" in data
        assert isinstance(data["count"], int)

    def test_internal_weather_alert_creates_notification(self):
        """
        Integration: POST /internal/weather-alert should create a notification.
        This replicates what WeatherAlerts.js does via reportWeatherAlert().
        """
        payload = {
            "farmer_id": self.FARMER_ID,
            "title":     "Integration Test: Frost Alert",
            "body":      "Temperature dropped to 1°C — protect crops tonight.",
            "severity":  "warning",
            "type":      "weather",
        }
        r = requests.post(
            f"{BASE['notification']}/internal/weather-alert",
            json=payload,
            timeout=TIMEOUT
        )
        assert r.status_code in (200, 201)

    def test_notification_settings_accessible(self):
        r = requests.get(
            f"{BASE['notification']}/notifications/settings?farmer_id={self.FARMER_ID}",
            timeout=TIMEOUT
        )
        assert r.status_code == 200


# ---------------------------------------------------------------------------
# LLM service integration
# ---------------------------------------------------------------------------

class TestLLMServiceIntegration:

    def test_infer_returns_text(self):
        payload = {
            "prompt":      "<s>[INST] You are a farming advisor. In one sentence, what is the best time to plant maize in Lesotho? Answer: [/INST]",
            "max_tokens":  100,
            "temperature": 0.4,
            "stop":        ["[INST]", "</s>"],
        }
        r = requests.post(f"{BASE['llm']}/infer", json=payload, timeout=120)
        assert r.status_code == 200
        data = r.json()
        assert "text" in data
        assert len(data["text"]) > 5

    def test_infer_does_not_echo_prompt(self):
        payload = {
            "prompt":      "<s>[INST] In English only: what crop grows well in Lesotho highlands? Answer: [/INST]",
            "max_tokens":  80,
            "temperature": 0.3,
            "stop":        ["[INST]", "</s>"],
        }
        r = requests.post(f"{BASE['llm']}/infer", json=payload, timeout=120)
        assert r.status_code == 200
        text = r.json()["text"]
        assert "[INST]" not in text
        assert "[/INST]" not in text

    def test_infer_response_is_english(self):
        payload = {
            "prompt": "<s>[INST] You MUST answer in English only. What pest affects maize in Lesotho? Answer: [/INST]",
            "max_tokens": 100,
            "temperature": 0.3,
            "stop": ["[INST]", "</s>"],
        }
        r = requests.post(f"{BASE['llm']}/infer", json=payload, timeout=120)
        text = r.json().get("text", "")
        non_latin = sum(1 for c in text if ord(c) > 0x2E7F)
        assert non_latin / max(len(text), 1) < 0.1

    def test_empty_prompt_returns_400(self):
        r = requests.post(
            f"{BASE['llm']}/infer",
            json={"prompt": "   ", "max_tokens": 100},
            timeout=10
        )
        assert r.status_code == 400

    def test_prompt_tokens_counted(self):
        payload = {
            "prompt": "<s>[INST] Hello [/INST]",
            "max_tokens": 50,
            "stop": ["[INST]", "</s>"],
        }
        r = requests.post(f"{BASE['llm']}/infer", json=payload, timeout=60)
        data = r.json()
        assert "prompt_tokens" in data
        assert data["prompt_tokens"] > 0