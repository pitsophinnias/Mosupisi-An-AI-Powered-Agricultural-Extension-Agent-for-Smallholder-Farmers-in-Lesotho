# routes/pests.py
# Pest routes - library (GET) + reports (POST/PATCH/DELETE) + action logs.

import uuid
import logging
import os
from datetime import datetime
from typing import List, Optional

import httpx
from fastapi import APIRouter, HTTPException, Depends, Request
from sqlalchemy.orm import Session

from database import get_db, PestReportDB, PestActionLogDB
from schemas import (
    PestReportCreate, PestReportUpdate,
    PestActionLogCreate, PestActionLogOut,
)

logger = logging.getLogger(__name__)
router = APIRouter()

LLM_SERVICE_URL = os.getenv("LLM_SERVICE_URL", "http://localhost:3004")


def _call_llm(prompt: str) -> str | None:
    """Call mosupisi-llm-service. Returns None if unavailable."""
    try:
        with httpx.Client(timeout=60.0) as client:
            response = client.post(
                f"{LLM_SERVICE_URL}/infer",
                json={
                    "prompt":      prompt,
                    "max_tokens":  256,
                    "temperature": 0.3,
                    "stop":        ["[INST]", "</s>"],
                },
            )
            response.raise_for_status()
            return response.json()["text"]
    except httpx.ConnectError:
        logger.error(
            f"Cannot reach LLM service at {LLM_SERVICE_URL}. "
            "Is mosupisi-llm-service running on port 3004?"
        )
        return None
    except Exception as e:
        logger.error(f"LLM service error: {e}")
        return None


# ── Pest Library ──────────────────────────────────────────────────────────────

@router.get("/")
async def get_all_pests(request: Request, crop: Optional[str] = None):
    rag = request.app.state.rag
    if not rag:
        raise HTTPException(status_code=503, detail="Service not ready")
    if crop:
        return rag.get_pests_by_crop(crop)
    return rag.get_all_pests()


@router.get("/crops")
async def get_crops(request: Request):
    rag = request.app.state.rag
    if not rag:
        raise HTTPException(status_code=503, detail="Service not ready")
    pests = rag.get_all_pests()
    crops = set()
    for pest in pests:
        for crop in pest.get("crops", []):
            crops.add(crop.lower())
    return sorted(list(crops))


@router.get("/tips")
async def get_general_tips(request: Request):
    rag = request.app.state.rag
    if not rag:
        raise HTTPException(status_code=503, detail="Service not ready")
    tips_data = rag.get_general_tips()
    tips = []
    for key, value in tips_data.items():
        if isinstance(value, dict):
            tips.append({"key": key, "en": value.get("en", ""), "st": value.get("st", "")})
        else:
            tips.append({"key": key, "en": str(value), "st": str(value)})
    return tips


@router.get("/library/{pest_id}")
async def get_pest_by_id(pest_id: str, request: Request):
    rag = request.app.state.rag
    if not rag:
        raise HTTPException(status_code=503, detail="Service not ready")
    pest = rag.get_pest_by_id(pest_id)
    if not pest:
        raise HTTPException(status_code=404, detail="Pest not found")
    return pest


# ── Pest Reports ──────────────────────────────────────────────────────────────

@router.post("/reports")
async def create_report(report: PestReportCreate, db: Session = Depends(get_db)):
    db_report = PestReportDB(
        id            = str(uuid.uuid4()),
        user_id       = report.user_id,
        crop          = report.crop,
        pest_name     = report.pest_name,
        date_observed = str(report.date_observed),
        location      = report.location,
        severity      = report.severity,
        action_taken  = report.action_taken,
        notes         = report.notes or "",
        status        = "monitoring",
        created_at    = datetime.utcnow().isoformat(),
    )
    db.add(db_report)
    db.commit()
    db.refresh(db_report)
    return db_report


@router.get("/reports/user/{user_id}")
async def get_user_reports(
    user_id: str,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
):
    query = db.query(PestReportDB).filter(PestReportDB.user_id == user_id)
    if status:
        query = query.filter(PestReportDB.status == status)
    return query.order_by(PestReportDB.created_at.desc()).all()


@router.get("/reports/stats/summary")
async def get_stats(db: Session = Depends(get_db)):
    all_reports     = db.query(PestReportDB).all()
    pest_counts     = {}
    crop_counts     = {}
    severity_counts = {"low": 0, "medium": 0, "high": 0}

    for r in all_reports:
        pest_counts[r.pest_name] = pest_counts.get(r.pest_name, 0) + 1
        crop_counts[r.crop]      = crop_counts.get(r.crop, 0) + 1
        severity_counts[r.severity] = severity_counts.get(r.severity, 0) + 1

    top_pests = sorted(pest_counts.items(), key=lambda x: x[1], reverse=True)[:5]
    top_crops = sorted(crop_counts.items(), key=lambda x: x[1], reverse=True)[:5]

    return {
        "total_reports":      len(all_reports),
        "top_reported_pests": [{"pest": k, "count": v} for k, v in top_pests],
        "top_affected_crops": [{"crop": k, "count": v} for k, v in top_crops],
        "severity_breakdown": severity_counts,
    }


@router.get("/reports/{report_id}")
async def get_report(report_id: str, db: Session = Depends(get_db)):
    report = db.query(PestReportDB).filter(PestReportDB.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    return report


@router.patch("/reports/{report_id}")
async def update_report(
    report_id: str,
    update: PestReportUpdate,
    db: Session = Depends(get_db),
):
    report = db.query(PestReportDB).filter(PestReportDB.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    if update.status is not None:
        report.status = update.status
    if update.action_taken is not None:
        report.action_taken = update.action_taken
    if update.notes is not None:
        report.notes = update.notes
    if update.severity is not None:
        report.severity = update.severity

    db.commit()
    db.refresh(report)
    return report


@router.delete("/reports/{report_id}")
async def delete_report(report_id: str, db: Session = Depends(get_db)):
    report = db.query(PestReportDB).filter(PestReportDB.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    db.delete(report)
    db.commit()
    return {"message": "Report deleted"}


# ── Action Logs ───────────────────────────────────────────────────────────────

@router.post("/reports/{report_id}/actions", response_model=PestActionLogOut)
async def log_pest_action(
    report_id: str,
    body: PestActionLogCreate,
    request: Request,
    db: Session = Depends(get_db),
):
    """Log an action against a pest report and generate AI advice on what to do next."""
    report = db.query(PestReportDB).filter(PestReportDB.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    rag = request.app.state.rag

    advice_en, advice_st = _generate_pest_action_advice(
        action    = body.action,
        pest_name = body.pest_name or report.pest_name,
        crop      = body.crop or report.crop,
        severity  = report.severity,
        location  = report.location,
        language  = body.language or "en",
        rag       = rag,
    )

    log_entry = PestActionLogDB(
        id        = str(uuid.uuid4()),
        report_id = report_id,
        action    = body.action,
        advice_en = advice_en,
        advice_st = advice_st,
        language  = body.language or "en",
        logged_at = datetime.utcnow().isoformat(),
    )
    db.add(log_entry)
    report.action_taken = body.action
    db.commit()
    db.refresh(log_entry)
    return log_entry


@router.get("/reports/{report_id}/actions", response_model=List[PestActionLogOut])
async def get_pest_action_history(
    report_id: str,
    db: Session = Depends(get_db),
):
    """Return all action logs for a pest report, newest first."""
    report = db.query(PestReportDB).filter(PestReportDB.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    logs = (
        db.query(PestActionLogDB)
        .filter(PestActionLogDB.report_id == report_id)
        .order_by(PestActionLogDB.logged_at.desc())
        .all()
    )
    return logs


# ── Internal: advice generation ───────────────────────────────────────────────

def _generate_pest_action_advice(
    action: str,
    pest_name: str,
    crop: str,
    severity: str,
    location: str,
    language: str,
    rag,
) -> tuple[str, str]:
    """Generate next-step advice after a farmer logs a pest control action."""

    # Build RAG context
    context = ""
    if rag:
        try:
            retrieved = rag.retrieve(f"{pest_name} {crop} {action} control Lesotho", n_results=3)
            context = "\n\n".join([r["text"] for r in retrieved[:2]])
        except Exception as e:
            logger.warning(f"RAG retrieval failed: {e}")

    prompt_en = (
        f"[INST] You are Mosupisi, an agricultural pest control advisor for farmers in Lesotho.\n"
        f"A farmer dealing with {pest_name} (severity: {severity}) on their {crop} crop "
        f"in {location} just did: \"{action}\".\n\n"
        f"Based on this and the context below, tell them:\n"
        f"1. Whether this action was appropriate and effective\n"
        f"2. What they should do NEXT and WHEN (be specific: \"tomorrow 6-9am\", \"in 3 days\", \"next week\")\n"
        f"3. Any precautions for the current severity level\n\n"
        f"Context:\n{context}\n\n"
        f"Keep your answer to 3-4 practical sentences. Recommend low-cost options where possible.\n\n"
        f"Answer: [/INST]"
    )

    prompt_st = (
        f"[INST] Ke Mosupisi, moeletsi oa taolo ea likokonyana bakeng sa balimi ba Lesotho.\n"
        f"Molemi ea sebetsanang le {pest_name} (boholo: {severity}) sejaleng sa {crop} "
        f"{location} o entseng: \"{action}\".\n\n"
        f"Mmele:\n"
        f"1. Hore na ketso eo e ne e lokile\n"
        f"2. Hore na o lokela ho etsa eng hajoale le neng (be specific: \"hosane 6-9am\", \"ka matsatsi a 3\")\n"
        f"3. Litemoso tsa boemo ba hajoale ba {severity}\n\n"
        f"Araba ka mefuta e 3-4. Khothaletsa mekhoa e sa bitsoang chelete.\n\n"
        f"Karabo: [/INST]"
    )

    advice_en = _call_llm(prompt_en) if context else None
    if not advice_en:
        advice_en = _fallback_pest_advice(action, pest_name, crop, severity, "en")

    advice_st = _call_llm(prompt_st) if context else None
    if not advice_st:
        advice_st = _fallback_pest_advice(action, pest_name, crop, severity, "st")

    return advice_en, advice_st


def _fallback_pest_advice(
    action: str, pest_name: str, crop: str, severity: str, language: str
) -> str:
    action_lower = action.lower()

    rules_en = {
        "spray":  f"Re-inspect your {crop} in 3 days to check if {pest_name} numbers are reducing. If high severity persists, repeat application in 7 days. Spray between 6-9am when temperatures are cool.",
        "neem":   f"Neem spray is effective against {pest_name}. Reapply after rain or every 7 days. Check the undersides of leaves where pests hide.",
        "weed":   f"Weeding removes pest habitat. Monitor the field again in 5 days. Keep the area around crops clear.",
        "remove": f"Manual removal is effective for low-severity infestations. Check daily for the next week and remove any new egg clusters you find.",
        "trap":   f"Check traps daily. Replace or reposition any traps that have not caught anything after 3 days.",
        "report": f"Good that you have reported this. Continue monitoring twice a week. If {pest_name} spreads to more than 30% of plants, escalate treatment.",
        "apply":  f"Wait 7-14 days before reapplying. Inspect treated plants in 3 days. Rotate pesticide types to prevent resistance.",
    }
    rules_st = {
        "spray":  f"Hlahloba {crop} ea hao ka matsatsi a 3 ho bona hore na palo ea {pest_name} e a fokotsehela. Ha severity e phahameng e ntse e le teng, fafalitsa hape ka matsatsi a 7. Fifafatsa pakeng tsa 6-9am.",
        "neem":   f"Neem e sebetsa hantle khahlanong le {pest_name}. E sebelise hape kamora pula kapa ka matsatsi a 7. Sheba ka tlas'a makhasi moo likokonyana li patolohang teng.",
        "weed":   f"Ho lema ho tlosa sebaka sa likokonyana. Sheba tšimo hape ka matsatsi a 5. Boloka sebaka se haufi le lijalo se hloekileng.",
        "remove": f"Ho tlosa ka matsoho ho sebetsa haholo ha boholo bo tlase. Sheba letsatsi le letsatsi beke e tlang mme o tlose litsoale tsa linyane tseo o li fumanoang.",
        "trap":   f"Hlahloba mekanyo letsatsi le letsatsi. Fetola kapa o fetise mekanyo e sa tshwara letho kamora matsatsi a 3.",
        "report": f"Ho motle hore o tlalehile sena. Tsoela pele ho hlahloba habeli beke le beke. Ha {pest_name} e ata ho feta 30% ea limela, eketsa kalafo.",
        "apply":  f"Letha matsatsi a 7-14 pele o sebelisa hape. Hlahloba limela tse phethahetseng ka matsatsi a 3. Fetola mefuta ea meriana ho thibeloa khahlano.",
    }

    rules = rules_en if language == "en" else rules_st
    for keyword, advice in rules.items():
        if keyword in action_lower:
            return advice

    if language == "en":
        sev_note = " Given the HIGH severity, act quickly and consider consulting your local extension officer." if severity == "high" else ""
        return f"Action logged successfully. Continue monitoring your {crop} for {pest_name} every 2-3 days.{sev_note}"
    return f"Ketso e ngoliloe hantle. Tsoela pele ho hlahloba {crop} ea hao bakeng sa {pest_name} ka matsatsi a 2-3."