from dataclasses import dataclass
from typing import Optional


@dataclass
class PestRisk:
    pest_name: str
    severity: str
    title_en: str
    body_en: str
    title_st: str
    body_st: str


def evaluate_pest_risks(
    crop_id: str,
    temperature_c: Optional[float],
    humidity_pct: Optional[float],
    rainfall_mm: Optional[float],
    wind_speed_ms: Optional[float],
    consecutive_rain_days: int = 0,
) -> list[PestRisk]:
    risks = []
    temp  = temperature_c or 20.0
    humid = humidity_pct or 50.0
    rain  = rainfall_mm or 0.0
    wind  = wind_speed_ms or 0.0
    crop  = crop_id.lower()

    # ── Maize ──────────────────────────────────────────────────────────────────
    if crop == "maize":
        if 18 <= temp <= 30 and humid >= 65:
            risks.append(PestRisk(
                pest_name="Fall Armyworm", severity="critical",
                title_en="⚠️ Fall Armyworm HIGH RISK",
                body_en=(f"Conditions (temp {temp:.0f}°C, humidity {humid:.0f}%) strongly favour "
                         "fall armyworm. Check maize leaves for egg masses and feeding damage "
                         "in the whorl. Act within 24 hours if larvae found."),
                title_st="⚠️ Kotsi e Phahameng ea Sebole sa Autumn",
                body_st=(f"Maemo (mocheso {temp:.0f}°C, mongobo {humid:.0f}%) a khothaletsa "
                         "sebole sa autumn. Hlahloba makhasi a poone. Etsa ka mora 24 hora."),
            ))

        if temp >= 28 and humid < 50:
            risks.append(PestRisk(
                pest_name="Maize Stalk Borer", severity="warning",
                title_en="Stalk Borer Risk",
                body_en=(f"Hot dry conditions (temp {temp:.0f}°C) increase stalk borer risk. "
                         "Look for dead hearts in young plants and frass in the whorl."),
                title_st="Kotsi ea Mobi oa Motse",
                body_st=(f"Maemo a chesang (mocheso {temp:.0f}°C) a eketsa kotsi ea mobi oa motse. "
                         "Sheba dipelo tse shoeleng memmeng e metšoana."),
            ))

    # ── Sorghum ────────────────────────────────────────────────────────────────
    if crop == "sorghum":
        if 20 <= temp <= 32 and humid >= 60:
            risks.append(PestRisk(
                pest_name="Sorghum Aphid", severity="warning",
                title_en="Sorghum Aphid Risk",
                body_en=("Warm humid conditions favour sorghum aphids. "
                         "Check undersides of leaves and around the head for aphid colonies."),
                title_st="Kotsi ea Likhothola tsa Mabele",
                body_st=("Maemo a chesang a mongobo a khothaletsa likhothola tsa mabele. "
                         "Hlahloba ka tlase ha makhasi."),
            ))

        if humid >= 75 or consecutive_rain_days >= 3:
            risks.append(PestRisk(
                pest_name="Head Smut", severity="warning",
                title_en="Head Smut Disease Risk",
                body_en=("Wet conditions increase head smut risk in sorghum. "
                         "Remove and destroy infected heads immediately to prevent spread."),
                title_st="Kotsi ea Lefu la Lihlooho",
                body_st=("Maemo a metsi a eketsa kotsi ea lefu la lihlooho mabeleng. "
                         "Tlosa le ho senya lihlooho tse koahetsoeng ka pela."),
            ))

    # ── All crops — fungal disease ─────────────────────────────────────────────
    if humid >= 80 or consecutive_rain_days >= 4:
        risks.append(PestRisk(
            pest_name="Fungal Disease", severity="warning",
            title_en="Fungal Disease Risk — All Crops",
            body_en=(f"Prolonged wet conditions (humidity {humid:.0f}%, "
                     f"{consecutive_rain_days} rainy days) increase fungal risk. "
                     "Watch for rust, blight, and grey leaf spot."),
            title_st="Kotsi ea Mafu a Likhohle — Lijalo Tsohle",
            body_st=(f"Maemo a metsi (mongobo {humid:.0f}%, matsatsi a pula a {consecutive_rain_days}) "
                     "a eketsa kotsi ea mafu a likhohle."),
        ))

    # ── All crops — locust ─────────────────────────────────────────────────────
    if wind >= 8 and temp >= 25:
        risks.append(PestRisk(
            pest_name="Locust Movement", severity="warning",
            title_en="Locust Movement Risk",
            body_en=(f"High winds ({wind:.1f} m/s) and warm temperatures may facilitate "
                     "locust movement. Monitor fields for swarms."),
            title_st="Kotsi ea Phallo ea Matsie",
            body_st=(f"Meea e matla ({wind:.1f} m/s) le mocheso o mongata o ka khothaletsa matsie. "
                     "Hlahloba masimo."),
        ))

    # ── Legumes/beans — storage weevil ────────────────────────────────────────
    if crop in ("legumes", "beans") and temp >= 25 and humid < 50:
        risks.append(PestRisk(
            pest_name="Storage Weevil", severity="info",
            title_en="Storage Weevil Risk — Dry Conditions",
            body_en=("Hot dry conditions favour storage weevils. "
                     "Inspect stored legumes. Use hermetic bags or ash for protection."),
            title_st="Kotsi ea Likokoanyana tsa Polokelo",
            body_st=("Maemo a chesang a omileng a khothaletsa likokoanyana tsa polokelo. "
                     "Hlahloba linaoa tse bolokiloeng."),
        ))

    return risks