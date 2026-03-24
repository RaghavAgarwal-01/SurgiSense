# backend/intake_routes.py
#
# Add this router to main.py with:
#   from intake_routes import router as intake_router
#   app.include_router(intake_router, prefix="/api")
#
# New endpoints:
#   POST /api/extract-intake      — PDF → auto-filled form fields
#   POST /api/submit-intake       — Full intake + agent workflow → audit report
#   GET  /api/intake-report       — Fetch the latest agent report for the user
#   GET  /api/audit-trail/{id}    — Fetch a specific audit report by ID

import json
import logging
from datetime import datetime
from models import Base, IntakeRecord
import fitz
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy import Column, Integer, String, Text, ForeignKey
from sqlalchemy.orm import Session

from database import Base, engine
from dependencies import get_current_user, get_db
from services.intake_agent import extract_intake_from_pdf, run_intake_agent

logger = logging.getLogger(__name__)
router = APIRouter()


# ─── DB model for intake + agent reports ─────────────────────────────────────




# ─── Pydantic schema for the intake form submission ───────────────────────────

class IntakeSubmission(BaseModel):
    patient_name:   str
    age:            str = ""
    gender:         str = ""
    surgery_type:   str
    surgery_phase:  str = "post"
    surgery_date:   str = ""
    icd10_code:     str = ""
    cpt_code:       str = ""
    payer_id:       str = ""
    bp_sys:         str = ""
    bp_dia:         str = ""
    heart_rate:     str = ""
    spo2:           str = ""
    temperature:    str = ""
    hemoglobin:     str = ""
    blood_sugar:    str = ""
    notes:          str = ""
    wound_analysis: str = ""
    next_appointment_date: str = ""  # YYYY-MM-DD: for post-op task scheduling


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/extract-intake")
async def extract_intake(
    file: UploadFile = File(...),
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Step 1 of the intake flow.
    Accepts a PDF (prescription or discharge summary) and returns structured
    form fields extracted by the AI agent. Fields the agent could not find
    are returned as null so the frontend can highlight them for manual entry.
    """
    try:
        content = await file.read()

        # Allow PDF or plain text documents
        if file.content_type == "application/pdf":
            file_bytes = content
        else:
            # Treat as UTF-8 text — wrap in bytes for the extractor
            file_bytes = content  # extract_text_from_pdf handles this gracefully

        extracted = extract_intake_from_pdf(file_bytes)
        return {"status": "ok", **extracted}

    except Exception as e:
        logger.error(f"extract-intake error: {e}")
        raise HTTPException(status_code=500, detail="Extraction failed")


@router.post("/submit-intake")
async def submit_intake(
    payload: IntakeSubmission,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Step 2 — receives the completed intake form (auto-filled + user corrections)
    and runs the full healthcare operations agent workflow:
      • ICD-10 and CPT code validation
      • Prior authorization check
      • Surgery readiness evaluation
      • Guardrail enforcement
    Returns a structured audit report and persists it to the DB.
    """
    try:
        intake_dict = payload.dict()
        wound_analysis = intake_dict.pop("wound_analysis", "")

        # Run the AI agent orchestration
        report = run_intake_agent(intake_dict, wound_analysis=wound_analysis)

        # Persist intake + report
        record = IntakeRecord(
            user_id=user.id,
            intake_json=json.dumps(intake_dict),
            report_json=json.dumps(report),
        )
        db.add(record)

        # Also update the existing PatientProfile for backward compatibility
        # with Dashboard, RAG chatbot, and task generation
        from models import PatientProfile
        from datetime import date as date_type
        
        today_str = date_type.today().isoformat()
        profile = db.query(PatientProfile).filter(PatientProfile.user_id == user.id).first()
        if profile:
            profile.patient_name  = payload.patient_name
            profile.surgery_type  = payload.surgery_type
            profile.surgery_date  = payload.surgery_date
            profile.pdf_upload_date = today_str  # Record when PDF was uploaded
            profile.next_appointment_date = payload.next_appointment_date or None
        else:
            profile = PatientProfile(
                user_id=user.id,
                patient_name=payload.patient_name,
                surgery_type=payload.surgery_type,
                surgery_date=payload.surgery_date,
                recovery_days_total=90,
                pdf_upload_date=today_str,
                next_appointment_date=payload.next_appointment_date or None,
            )
            db.add(profile)

        db.commit()
        db.refresh(record)

        # ── Generate recovery tasks from intake data ──────────────────────────
        tasks_generated = 0
        try:
            from datetime import date as date_type, timedelta
            from models import RecoveryTask

            # Build document text from intake fields for the LLM prompt
            doc_text = json.dumps(intake_dict)

            # Ask Groq to generate a task template
            import os
            from groq import Groq
            groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))

            prompt = f"""You are a clinical AI. Generate a daily recovery task schedule for a patient.

Return ONLY valid JSON:
{{
  "tasks": [
    {{"title": "Take prescribed medication", "time": "08:00 AM", "is_critical": 1}}
  ]
}}

Rules:
- 6-10 tasks covering the full day
- is_critical=1 for: medication, wound care, vitals, physiotherapy
- is_critical=0 for: rest, diet, scheduling tasks
- Spread times from 07:00 AM to 09:00 PM

Patient intake data:
{doc_text}"""

            resp = groq_client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[{"role": "user", "content": prompt}],
                response_format={"type": "json_object"}
            )
            template_str = resp.choices[0].message.content
            template = json.loads(template_str).get("tasks", []) if template_str else []

            if template:
                today = date_type.today()
                
                # Determine date range based on phase
                surgery_date = None
                if payload.surgery_date:
                    try:
                        surgery_date = date_type.fromisoformat(payload.surgery_date)
                    except Exception:
                        pass
                
                phase = payload.surgery_phase or "post"
                
                if phase == "pre" and surgery_date:
                    # Pre-op: from today (PDF upload date) until surgery date
                    start_date = today
                    end_date = surgery_date
                else:
                    # Post-op: from today until next appointment or 14 days
                    start_date = today
                    if payload.next_appointment_date:
                        try:
                            end_date = date_type.fromisoformat(payload.next_appointment_date)
                        except Exception:
                            end_date = today + timedelta(days=14)
                    else:
                        end_date = today + timedelta(days=14)

                # Wipe any existing tasks in the date range
                db.query(RecoveryTask).filter(
                    RecoveryTask.user_id == user.id,
                    RecoveryTask.task_date >= start_date.isoformat(),
                    RecoveryTask.task_date <= end_date.isoformat()
                ).delete(synchronize_session=False)

                # Stamp template onto every day in the range
                for day_offset in range((end_date - start_date).days + 1):
                    day_str = (start_date + timedelta(days=day_offset)).isoformat()
                    for task in template:
                        db.add(RecoveryTask(
                            user_id=user.id,
                            title=task.get("title"),
                            time=task.get("time"),
                            status="pending",
                            task_date=day_str,
                            is_critical=int(task.get("is_critical", 0))
                        ))
                        tasks_generated += 1
                db.commit()
                logger.info(f"submit-intake: generated {tasks_generated} tasks for user {user.id}")

        except Exception as task_err:
            logger.error(f"submit-intake task generation failed: {task_err}")
            # Don't fail the whole request — intake was saved successfully

        return {
            "status":          "ok",
            "intake_record_id": record.id,
            "workflow_status": report["workflow_status"],
            "guardrails":      report["guardrails"],
            "readiness":       report["audit_trail"][2]["result"] if len(report["audit_trail"]) > 2 else {},
            "prior_auth":      report["audit_trail"][1]["result"] if len(report["audit_trail"]) > 1 else {},
            "code_validation": report["audit_trail"][0]["result"] if len(report["audit_trail"]) > 0 else {},
            "tasks_generated": tasks_generated,
        }

    except Exception as e:
        logger.error(f"submit-intake error: {e}")
        raise HTTPException(status_code=500, detail="Agent workflow failed")


@router.get("/intake-report")
def get_latest_intake_report(
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns the most recent agent audit report for the authenticated user.
    Used by the Dashboard to display the workflow status card.
    """
    record = (
        db.query(IntakeRecord)
        .filter(IntakeRecord.user_id == user.id)
        .order_by(IntakeRecord.id.desc())
        .first()
    )
    if not record:
        return {"status": "no_report"}

    try:
        report = json.loads(record.report_json)
        intake = json.loads(record.intake_json)
        return {
            "status":          "ok",
            "record_id":       record.id,
            "created_at":      record.created_at,
            "workflow_status": report.get("workflow_status"),
            "guardrails":      report.get("guardrails", []),
            "audit_trail":     report.get("audit_trail", []),
            "wound_analysis":  report.get("wound_analysis"),
            "patient_name":    report.get("patient_name"),
            "surgery_type":    report.get("surgery_type"),
            "surgery_phase":   report.get("surgery_phase"),
        }
    except Exception as e:
        logger.error(f"get-intake-report parse error: {e}")
        raise HTTPException(status_code=500, detail="Report parse error")


@router.get("/my-intake")
def get_my_intake(
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns the saved intake form data for the authenticated user so the
    frontend can pre-fill the form on every subsequent login.

    Priority order:
      1. Most recent IntakeRecord (intake_json) — has all fields including
         vitals, ICD-10, CPT, payer that PatientProfile doesn't store.
      2. PatientProfile fallback — for users who set up profile the old way.
      3. Empty object — first-time user, no data yet.

    The frontend uses this on /intake page mount: if data exists, fill the
    form and show a "Your saved details are pre-filled — update if needed"
    banner instead of asking the user to start from scratch.
    """
    # Try the richest source first: latest intake submission
    latest = (
        db.query(IntakeRecord)
        .filter(IntakeRecord.user_id == user.id)
        .order_by(IntakeRecord.id.desc())
        .first()
    )

    if latest:
        try:
            intake = json.loads(latest.intake_json)
            # Pull wound_analysis from the report if it was stored there
            report = json.loads(latest.report_json) if latest.report_json else {}
            return {
                "status":          "prefilled",
                "source":          "intake_record",
                "record_id":       latest.id,
                "last_updated":    latest.created_at,
                "data": {
                    "patient_name":  intake.get("patient_name", ""),
                    "age":           intake.get("age", ""),
                    "gender":        intake.get("gender", ""),
                    "surgery_type":  intake.get("surgery_type", ""),
                    "surgery_phase": intake.get("surgery_phase", "post"),
                    "surgery_date":  intake.get("surgery_date", ""),
                    "icd10_code":    intake.get("icd10_code", ""),
                    "cpt_code":      intake.get("cpt_code", ""),
                    "payer_id":      intake.get("payer_id", ""),
                    "bp_sys":        intake.get("bp_sys", ""),
                    "bp_dia":        intake.get("bp_dia", ""),
                    "heart_rate":    intake.get("heart_rate", ""),
                    "spo2":          intake.get("spo2", ""),
                    "temperature":   intake.get("temperature", ""),
                    "hemoglobin":    intake.get("hemoglobin", ""),
                    "blood_sugar":   intake.get("blood_sugar", ""),
                    "notes":         intake.get("notes", ""),
                },
                "wound_analysis": report.get("wound_analysis", ""),
                "workflow_status": report.get("workflow_status", ""),
            }
        except Exception as e:
            logger.error(f"my-intake parse error: {e}")

    # Fallback: old-style PatientProfile (name + surgery_type + date only)
    from models import PatientProfile
    profile = db.query(PatientProfile).filter(PatientProfile.user_id == user.id).first()
    if profile:
        return {
            "status":       "prefilled",
            "source":       "patient_profile",
            "record_id":    None,
            "last_updated": None,
            "data": {
                "patient_name":  profile.patient_name or "",
                "age":           str(profile.age) if profile.age else "",
                "gender":        profile.gender or "",
                "surgery_type":  profile.surgery_type or "",
                "surgery_phase": profile.surgery_phase or "post",
                "surgery_date":  profile.surgery_date or "",
                "icd10_code":    profile.icd10_code or "",
                "cpt_code":      profile.cpt_code or "",
                "payer_id":      profile.payer_id or "",
                "bp_sys":        "",
                "bp_dia":        "",
                "heart_rate":    "",
                "spo2":          "",
                "temperature":   "",
                "hemoglobin":    "",
                "blood_sugar":   "",
                "notes":         "",
            },
            "wound_analysis":  "",
            "workflow_status": "",
        }

    # First-time user — no data at all
    return {"status": "empty", "data": {}}


@router.patch("/update-intake")
async def update_intake(
    payload: IntakeSubmission,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Updates the user's latest intake record with new form values without
    re-running the full agent workflow. Used when the user edits individual
    fields from the pre-filled form on subsequent logins.

    If no existing record exists, falls through to a full submit instead.
    """
    latest = (
        db.query(IntakeRecord)
        .filter(IntakeRecord.user_id == user.id)
        .order_by(IntakeRecord.id.desc())
        .first()
    )

    intake_dict = payload.dict()
    wound_analysis = intake_dict.pop("wound_analysis", "")

    if latest:
        # Step 1: merge submitted fields over existing — unconditionally,
        # so cleared fields never revert to old values.
        try:
            existing = json.loads(latest.intake_json)
        except Exception:
            existing = {}

        merged = {**existing, **intake_dict}
        latest.intake_json = json.dumps(merged)
        latest.created_at  = datetime.utcnow().isoformat()

        # Step 2: preserve previous wound_analysis unless a new one arrived
        if not wound_analysis:
            try:
                wound_analysis = json.loads(latest.report_json).get("wound_analysis", "")
            except Exception:
                wound_analysis = ""

        # Step 3: re-run the full agent on the merged data so report_json
        # always reflects the latest ICD code, vitals, CPT, etc.
        new_report = run_intake_agent(merged, wound_analysis=wound_analysis)
        latest.report_json = json.dumps(new_report)

    else:
        # No record yet — run agent fresh and persist both
        merged = intake_dict
        new_report = run_intake_agent(merged, wound_analysis=wound_analysis)
        latest = IntakeRecord(
            user_id=user.id,
            intake_json=json.dumps(merged),
            report_json=json.dumps(new_report),
            created_at=datetime.utcnow().isoformat(),
        )
        db.add(latest)

    # Keep PatientProfile in sync — write every field unconditionally
    # so cleared values don't linger there either.
    from models import PatientProfile
    profile = db.query(PatientProfile).filter(PatientProfile.user_id == user.id).first()
    if profile:
        profile.patient_name  = payload.patient_name
        profile.surgery_type  = payload.surgery_type
        profile.surgery_date  = payload.surgery_date
        profile.gender        = payload.gender
        profile.surgery_phase = payload.surgery_phase
        profile.icd10_code    = payload.icd10_code
        profile.cpt_code      = payload.cpt_code
        profile.payer_id      = payload.payer_id
        profile.next_appointment_date = payload.next_appointment_date or None
        if payload.age and str(payload.age).isdigit():
            profile.age = int(payload.age)
    else:
        profile = PatientProfile(
            user_id=user.id,
            patient_name=payload.patient_name,
            surgery_type=payload.surgery_type,
            surgery_date=payload.surgery_date,
            recovery_days_total=90,
            next_appointment_date=payload.next_appointment_date or None,
        )
        db.add(profile)

    db.commit()

    # Re-generate tasks from updated intake data
    tasks_generated = 0
    try:
        from datetime import date as date_type, timedelta
        from models import RecoveryTask
        import os
        from groq import Groq
        groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))

        doc_text = json.dumps(merged)
        prompt = f"""You are a clinical AI. Generate a daily recovery task schedule for a patient.

Return ONLY valid JSON:
{{
  "tasks": [
    {{"title": "Take prescribed medication", "time": "08:00 AM", "is_critical": 1}}
  ]
}}

Rules:
- 6-10 tasks covering the full day
- is_critical=1 for: medication, wound care, vitals, physiotherapy
- is_critical=0 for: rest, diet, scheduling tasks
- Spread times from 07:00 AM to 09:00 PM

Patient intake data:
{doc_text}"""

        resp = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"}
        )
        template_str = resp.choices[0].message.content
        template = json.loads(template_str).get("tasks", []) if template_str else []

        if template:
            today = date_type.today()
            
            # Determine date range based on phase
            surgery_date = None
            if payload.surgery_date:
                try:
                    surgery_date = date_type.fromisoformat(payload.surgery_date)
                except Exception:
                    pass
            
            phase = payload.surgery_phase or "post"
            
            if phase == "pre" and surgery_date:
                # Pre-op: from PDF upload date (now = today) until surgery date
                start_date = today
                end_date = surgery_date
            else:
                # Post-op: from today until next appointment or 14 days
                start_date = today
                if payload.next_appointment_date:
                    try:
                        end_date = date_type.fromisoformat(payload.next_appointment_date)
                    except Exception:
                        end_date = today + timedelta(days=14)
                else:
                    end_date = today + timedelta(days=14)
            
            # Delete existing tasks in the date range
            db.query(RecoveryTask).filter(
                RecoveryTask.user_id == user.id,
                RecoveryTask.task_date >= start_date.isoformat(),
                RecoveryTask.task_date <= end_date.isoformat()
            ).delete(synchronize_session=False)
            
            # Generate tasks for each day in the range
            for day_offset in range((end_date - start_date).days + 1):
                day_str = (start_date + timedelta(days=day_offset)).isoformat()
                for task in template:
                    db.add(RecoveryTask(
                        user_id=user.id,
                        title=task.get("title"),
                        time=task.get("time"),
                        status="pending",
                        task_date=day_str,
                        is_critical=int(task.get("is_critical", 0))
                    ))
                    tasks_generated += 1
            db.commit()
            logger.info(f"update-intake: regenerated {tasks_generated} tasks for user {user.id}")
    except Exception as task_err:
        logger.error(f"update-intake task generation failed: {task_err}")

    return {"status": "updated", "record_id": latest.id, "tasks_generated": tasks_generated}


@router.get("/audit-trail/{record_id}")
def get_audit_trail(
    record_id: int,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns the full audit trail for a specific intake record.
    Provides step-by-step reasoning for every agent decision —
    satisfying the 'auditable reasoning' requirement of the problem statement.
    """
    record = (
        db.query(IntakeRecord)
        .filter(IntakeRecord.id == record_id, IntakeRecord.user_id == user.id)
        .first()
    )
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")

    try:
        report = json.loads(record.report_json)
        intake = json.loads(record.intake_json)
        return {
            "record_id":       record.id,
            "created_at":      record.created_at,
            "intake":          intake,
            "full_report":     report,
        }
    except Exception as e:
        logger.error(f"audit-trail parse error: {e}")
        raise HTTPException(status_code=500, detail="Audit trail parse error")
