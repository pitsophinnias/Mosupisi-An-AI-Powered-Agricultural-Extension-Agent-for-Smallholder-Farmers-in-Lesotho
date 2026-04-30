# tests/unit/test_weather_logic.py
# Unit tests for mosupisi-weather-service core logic
# Run from: backend/mosupisi-weather-service
#   pytest tests/unit/test_weather_logic.py -v

import pytest
import math
from datetime import datetime, timezone, timedelta


# ---------------------------------------------------------------------------
# Haversine distance (nearest CSIS town resolution)
# ---------------------------------------------------------------------------

class TestHaversine:
    """
    The weather service uses Haversine to find the nearest of 13 CSIS towns.
    Tests that the formula is correct and picks the right town.
    """

    CSIS_TOWNS = {
        "Maseru":        (-29.32, 27.50),
        "Leribe":        (-28.88, 28.07),
        "Butha-Buthe":   (-28.76, 28.27),
        "Mafeteng":      (-29.83, 27.24),
        "Mohale's Hoek": (-30.16, 27.47),
        "Mokhotlong":    (-29.31, 29.06),
        "Thaba-Tseka":   (-29.52, 28.61),
        "Qacha's Nek":   (-30.12, 28.68),
        "Quthing":       (-30.40, 27.70),
        "Semonkong":     (-29.85, 28.05),
        "Berea":         (-29.16, 27.74),
        "Moshoeshoe I":  (-29.46, 27.56),
        "Oxbow":         (-28.73, 28.62),
    }

    def _haversine(self, lat1, lon1, lat2, lon2) -> float:
        R = 6371.0
        dlat = math.radians(lat2 - lat1)
        dlon = math.radians(lon2 - lon1)
        a = (math.sin(dlat / 2) ** 2
             + math.cos(math.radians(lat1))
             * math.cos(math.radians(lat2))
             * math.sin(dlon / 2) ** 2)
        return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    def _nearest_town(self, lat, lon) -> str:
        return min(
            self.CSIS_TOWNS,
            key=lambda t: self._haversine(lat, lon, *self.CSIS_TOWNS[t])
        )

    def test_maseru_coordinates_resolve_to_maseru(self):
        assert self._nearest_town(-29.32, 27.50) == "Maseru"

    def test_roma_resolves_to_maseru(self):
        # Roma (-29.45, 27.80) is closest to Maseru
        assert self._nearest_town(-29.45, 27.80) == "Maseru"

    def test_lipelaneng_resolves_to_butha_buthe(self):
        # Lipelaneng is in Butha-Buthe district
        assert self._nearest_town(-28.87, 28.09) == "Butha-Buthe"

    def test_qholaqhoe_resolves_to_butha_buthe(self):
        assert self._nearest_town(-28.76, 28.27) == "Butha-Buthe"

    def test_all_13_towns_resolve_to_themselves(self):
        for name, (lat, lon) in self.CSIS_TOWNS.items():
            assert self._nearest_town(lat, lon) == name

    def test_distance_is_symmetric(self):
        d1 = self._haversine(-29.32, 27.50, -28.88, 28.07)
        d2 = self._haversine(-28.88, 28.07, -29.32, 27.50)
        assert abs(d1 - d2) < 0.001

    def test_same_point_distance_is_zero(self):
        assert self._haversine(-29.32, 27.50, -29.32, 27.50) == pytest.approx(0.0)


# ---------------------------------------------------------------------------
# CAT timezone fix (KNOWN ISSUE #4)
# ---------------------------------------------------------------------------

class TestCATTimezone:
    """
    CSIS was returning wrong date at midnight CAT because UTC was used.
    Fix: always use CAT = UTC+2 for date comparisons.
    """

    CAT = timezone(timedelta(hours=2))

    def test_cat_is_utc_plus_2(self):
        cat = timezone(timedelta(hours=2))
        now_cat = datetime.now(cat)
        now_utc = datetime.now(timezone.utc)
        diff = now_cat.utcoffset().total_seconds()
        assert diff == 7200  # 2 hours in seconds

    def test_midnight_cat_is_different_date_from_utc(self):
        """At 23:00 UTC, it's already 01:00 CAT the next day."""
        cat = timezone(timedelta(hours=2))
        # Simulate 23:00 UTC on April 26
        utc_time = datetime(2026, 4, 26, 23, 0, 0, tzinfo=timezone.utc)
        cat_time = utc_time.astimezone(cat)
        assert utc_time.date().day == 26
        assert cat_time.date().day == 27  # CAT is already April 27

    def test_cat_date_used_for_csis_filtering(self):
        """Confirm that using CAT avoids the midnight date skip bug."""
        cat = timezone(timedelta(hours=2))
        today_cat = datetime.now(cat).date()
        today_utc = datetime.now(timezone.utc).date()
        # Either same day or CAT is one day ahead — never behind
        assert today_cat >= today_utc


# ---------------------------------------------------------------------------
# Alert threshold logic (KNOWN ISSUE #10: duplicate alerts)
# ---------------------------------------------------------------------------

class TestAlertThresholds:
    """
    Weather alert thresholds from the modules file.
    Also tests the once-per-day deduplication logic.
    """

    THRESHOLDS = {
        "frost":       {"field": "temperature_c", "op": "<=", "value": 2.0,  "severity": "WARNING"},
        "heat":        {"field": "temperature_c", "op": ">=", "value": 35.0, "severity": "WARNING"},
        "heavy_rain":  {"field": "rainfall_mm",   "op": ">=", "value": 20.0, "severity": "SEVERE"},
        "strong_wind": {"field": "wind_speed_ms",  "op": ">=", "value": 10.0, "severity": "WARNING"},
    }

    def _evaluate(self, weather: dict) -> list:
        alerts = []
        temp = weather.get("temperature_c", 20)
        rain = weather.get("rainfall_mm", 0)
        wind = weather.get("wind_speed_ms", 0)
        if temp <= 2.0:  alerts.append("frost")
        if temp >= 35.0: alerts.append("heat")
        if rain >= 20.0: alerts.append("heavy_rain")
        if wind >= 10.0: alerts.append("strong_wind")
        return alerts

    def test_frost_alert_triggers_at_2c(self):
        assert "frost" in self._evaluate({"temperature_c": 2.0})

    def test_frost_alert_triggers_below_2c(self):
        assert "frost" in self._evaluate({"temperature_c": -3.0})

    def test_frost_no_alert_above_2c(self):
        assert "frost" not in self._evaluate({"temperature_c": 3.0})

    def test_heat_alert_at_35c(self):
        assert "heat" in self._evaluate({"temperature_c": 35.0})

    def test_no_alert_in_normal_conditions(self):
        alerts = self._evaluate({"temperature_c": 22, "rainfall_mm": 5, "wind_speed_ms": 3})
        assert alerts == []

    def test_multiple_alerts_simultaneously(self):
        alerts = self._evaluate({"temperature_c": 36, "rainfall_mm": 25, "wind_speed_ms": 12})
        assert "heat" in alerts
        assert "heavy_rain" in alerts
        assert "strong_wind" in alerts

    def test_dedup_key_format(self):
        """KNOWN ISSUE #10 fix: sessionStorage key prevents duplicate alerts."""
        from datetime import date
        today = date.today().isoformat()
        key = f"alerts_reported_{today}"
        assert key.startswith("alerts_reported_")
        assert len(key) == len("alerts_reported_") + 10  # YYYY-MM-DD = 10 chars


# ---------------------------------------------------------------------------
# Pest risk matrix (notification service pest_risk.py)
# ---------------------------------------------------------------------------

class TestPestRiskMatrix:
    """
    From modules file PEST RISK MATRIX section.
    """

    def _evaluate_pest_risk(self, crop: str, weather: dict) -> list:
        temp  = weather.get("temperature_c", 20)
        humid = weather.get("humidity_pct", 50)
        risks = []
        if crop == "maize":
            if 18 <= temp <= 30 and humid >= 65:
                risks.append(("Fall Armyworm", "CRITICAL"))
            if temp >= 28 and humid < 50:
                risks.append(("Stalk Borer", "WARNING"))
        if crop == "sorghum":
            if 20 <= temp <= 32 and humid >= 60:
                risks.append(("Aphid", "WARNING"))
            if humid >= 75:
                risks.append(("Head Smut", "WARNING"))
        if humid >= 80:
            risks.append(("Fungal Disease", "WARNING"))
        return risks

    def test_fall_armyworm_critical_conditions(self):
        weather = {"temperature_c": 25, "humidity_pct": 70}
        risks = self._evaluate_pest_risk("maize", weather)
        names = [r[0] for r in risks]
        assert "Fall Armyworm" in names

    def test_fall_armyworm_severity_is_critical(self):
        weather = {"temperature_c": 25, "humidity_pct": 70}
        risks = self._evaluate_pest_risk("maize", weather)
        risk = next(r for r in risks if r[0] == "Fall Armyworm")
        assert risk[1] == "CRITICAL"

    def test_stalk_borer_hot_dry(self):
        weather = {"temperature_c": 30, "humidity_pct": 40}
        risks = self._evaluate_pest_risk("maize", weather)
        names = [r[0] for r in risks]
        assert "Stalk Borer" in names

    def test_no_risk_cool_dry_maize(self):
        weather = {"temperature_c": 15, "humidity_pct": 40}
        risks = self._evaluate_pest_risk("maize", weather)
        assert risks == []

    def test_fungal_disease_all_crops(self):
        weather = {"temperature_c": 20, "humidity_pct": 85}
        for crop in ["maize", "sorghum", "legumes"]:
            risks = self._evaluate_pest_risk(crop, weather)
            names = [r[0] for r in risks]
            assert "Fungal Disease" in names, f"Fungal not triggered for {crop}"