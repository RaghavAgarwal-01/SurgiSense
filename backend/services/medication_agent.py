"""
services/medication_agent.py

Agentic Medication Workflow — Phase 1: Multi-Step Task Orchestration

This module contains the core agent logic that replaces the old
reactive "click → deduct" flow with an intelligent multi-step pipeline.

Each call to `execute_medication_completion()` runs this chain:
  1. Verify   — task exists, belongs to user, is valid
  2. Complete — mark the task as done
  3. Deduct   — atomically subtract doses from matching medicines
  4. Log      — record adherence (on_time / late)
  5. Alert    — check inventory levels, create low-stock alerts
  6. Score    — compute today's adherence percentage
  7. Return   — structured JSON summary of all actions taken
"""

import json
import logging
from datetime import datetime, date as date_type
from sqlalchemy import func
from sqlalchemy.orm import Session

from models import (
    RecoveryTask, Medicine, MedicationLog,
    AdherenceLog, AgentAlert,
)

logger = logging.getLogger(__name__)


# ── Helpers ──────────────────────────────────────────────────────────────────

def _parse_task_time(time_str: str, task_date: str) -> datetime | None:
    """Parse '08:00 AM' + '2026-03-27' into a datetime, or None."""
    if not time_str or not task_date:
        return None
    try:
        return datetime.strptime(f"{task_date} {time_str}", "%Y-%m-%d %I:%M %p")
    except (ValueError, TypeError):
        return None


def _fuzzy_match_medicine(med_name: str, all_meds: list[Medicine]) -> Medicine | None:
    """Case-insensitive substring match against the user's medicines."""
    target = med_name.lower().strip()
    for m in all_meds:
        m_name = (m.name or "").lower().strip()
        if target in m_name or m_name in target:
            return m
    return None


def _days_until_empty(med: Medicine) -> int | None:
    """Estimate how many days of supply remain for a medicine."""
    qty = med.current_quantity or 0
    dose = med.dose_amount or 1
    freq = (med.frequency or "").lower()

    # Parse frequency into doses-per-day
    doses_per_day = 1  # default
    if "twice" in freq or "2" in freq or "bid" in freq:
        doses_per_day = 2
    elif "three" in freq or "3" in freq or "tid" in freq:
        doses_per_day = 3
    elif "four" in freq or "4" in freq or "qid" in freq:
        doses_per_day = 4

    daily_consumption = dose * doses_per_day
    if daily_consumption <= 0:
        return None
    return qty // daily_consumption


# ── Main Orchestrator ────────────────────────────────────────────────────────

def execute_medication_completion(
    user_id: int,
    task_id: int,
    db: Session,
) -> dict:
    """
    The agentic multi-step pipeline for completing a medication task.

    Returns a structured dict with:
      - status: "success" | "error"
      - task: basic task info
      - deductions: list of {medicine, deducted, remaining}
      - adherence: {action, scheduled, completed}
      - alerts: list of new alerts generated
      - score: today's adherence %
      - message: human-readable summary
    """
    now = datetime.now()
    today_str = date_type.today().isoformat()
    result = {
        "status": "success",
        "task": None,
        "deductions": [],
        "adherence": None,
        "alerts": [],
        "score": 0,
        "message": "",
    }

    # ── Step 1: Verify ───────────────────────────────────────────────────
    task = db.query(RecoveryTask).filter(
        RecoveryTask.id == task_id,
        RecoveryTask.user_id == user_id,
    ).first()

    if not task:
        return {"status": "error", "message": "Task not found"}

    if task.status == "completed":
        return {"status": "error", "message": "Task already completed"}

    result["task"] = {
        "id": task.id,
        "title": task.title,
        "time": task.time,
        "task_date": task.task_date,
        "is_critical": getattr(task, "is_critical", 0),
    }

    # ── Step 2: Mark Complete ────────────────────────────────────────────
    task.status = "completed"
    db.flush()
    logger.info(f"Agent: task {task_id} marked completed for user {user_id}")

    # ── Step 3: Deduct Inventory (only for medication tasks) ─────────────
    is_medication_task = "medication" in (task.title or "").lower()

    if is_medication_task:
        all_meds = db.query(Medicine).filter(Medicine.user_id == user_id).all()

        # Determine which meds to deduct
        meds_to_deduct = []
        title_lower = (task.title or "").lower()

        # Check if it's a generic "take prescribed medication" task
        if "take prescribed medication" in title_lower or title_lower.strip() == "medication":
            meds_to_deduct = all_meds
        else:
            # Try to extract specific medicine name from title
            med_name = task.title
            if "-" in task.title:
                med_name = task.title.split("-", 1)[1].strip()
            elif ":" in task.title:
                med_name = task.title.split(":", 1)[1].strip()

            matched = _fuzzy_match_medicine(med_name, all_meds)
            if matched:
                meds_to_deduct = [matched]

        # Atomically deduct each medicine
        for med in meds_to_deduct:
            dose = med.dose_amount or 1
            rows = (
                db.query(Medicine)
                .filter(Medicine.id == med.id)
                .update(
                    {Medicine.current_quantity: func.greatest(
                        func.coalesce(Medicine.current_quantity, 0) - dose, 0
                    )},
                    synchronize_session="fetch",
                )
            )
            if rows > 0:
                db.refresh(med)
                new_qty = med.current_quantity or 0

                # Log the deduction
                db.add(MedicationLog(
                    medicine_id=med.id,
                    user_id=user_id,
                    action="deducted",
                    quantity_change=dose,
                    remaining=new_qty,
                    timestamp=now.isoformat(),
                ))

                result["deductions"].append({
                    "medicine": med.name,
                    "deducted": dose,
                    "remaining": new_qty,
                })

                logger.info(f"Agent: deducted {dose} from {med.name}, remaining={new_qty}")

    # ── Step 4: Log Adherence ────────────────────────────────────────────
    scheduled_dt = _parse_task_time(task.time, task.task_date or today_str)
    if scheduled_dt:
        diff_minutes = (now - scheduled_dt).total_seconds() / 60
        if diff_minutes <= 30:
            adherence_action = "on_time"
        else:
            adherence_action = "late"
    else:
        adherence_action = "on_time"  # can't determine, assume on-time

    adherence_log = AdherenceLog(
        user_id=user_id,
        task_id=task.id,
        medicine_id=result["deductions"][0]["medicine"] if result["deductions"] else None,
        action=adherence_action,
        scheduled_time=task.time,
        completed_time=now.strftime("%I:%M %p"),
        task_date=task.task_date or today_str,
        timestamp=now.isoformat(),
    )
    # Fix: medicine_id should be an int, not string
    if result["deductions"]:
        matched_med = db.query(Medicine).filter(
            Medicine.user_id == user_id,
            Medicine.name == result["deductions"][0]["medicine"],
        ).first()
        adherence_log.medicine_id = matched_med.id if matched_med else None

    db.add(adherence_log)

    result["adherence"] = {
        "action": adherence_action,
        "scheduled": task.time,
        "completed": now.strftime("%I:%M %p"),
    }

    # ── Step 5: Check Inventory & Generate Alerts ────────────────────────
    if is_medication_task:
        all_meds_fresh = db.query(Medicine).filter(Medicine.user_id == user_id).all()
        for med in all_meds_fresh:
            days_left = _days_until_empty(med)
            if days_left is not None and days_left <= 3:
                # Check if we already have an unread alert for this med
                existing_alert = db.query(AgentAlert).filter(
                    AgentAlert.user_id == user_id,
                    AgentAlert.alert_type == "low_stock",
                    AgentAlert.is_read == 0,
                    AgentAlert.data_json.contains(med.name),
                ).first()

                if not existing_alert:
                    alert_msg = (
                        f"⚠️ {med.name} will run out in ~{days_left} day{'s' if days_left != 1 else ''}. "
                        f"Only {med.current_quantity} doses remaining."
                    )
                    alert = AgentAlert(
                        user_id=user_id,
                        alert_type="low_stock",
                        message=alert_msg,
                        data_json=json.dumps({
                            "medicine_name": med.name,
                            "medicine_id": med.id,
                            "remaining": med.current_quantity,
                            "days_left": days_left,
                        }),
                        is_read=0,
                        created_at=now.isoformat(),
                    )
                    db.add(alert)
                    result["alerts"].append({
                        "type": "low_stock",
                        "message": alert_msg,
                        "medicine": med.name,
                        "days_left": days_left,
                    })
                    logger.info(f"Agent: low-stock alert created for {med.name}")

    # ── Step 6: Calculate Today's Adherence Score ────────────────────────
    total_critical = db.query(RecoveryTask).filter(
        RecoveryTask.user_id == user_id,
        RecoveryTask.task_date == today_str,
        RecoveryTask.is_critical == 1,
    ).count()

    completed_critical = db.query(RecoveryTask).filter(
        RecoveryTask.user_id == user_id,
        RecoveryTask.task_date == today_str,
        RecoveryTask.is_critical == 1,
        RecoveryTask.status == "completed",
    ).count()

    score = round((completed_critical / total_critical) * 100) if total_critical > 0 else 100
    result["score"] = score

    # ── Commit everything ────────────────────────────────────────────────
    db.commit()

    # ── Step 7: Build Summary Message ────────────────────────────────────
    parts = [f"✅ Task completed ({adherence_action})."]
    if result["deductions"]:
        med_names = ", ".join(d["medicine"] for d in result["deductions"])
        parts.append(f"💊 Doses deducted: {med_names}.")
    if result["alerts"]:
        parts.append(f"⚠️ {len(result['alerts'])} low-stock alert(s).")
    parts.append(f"📊 Today's adherence: {score}%.")
    result["message"] = " ".join(parts)

    logger.info(f"Agent: pipeline complete for task {task_id} — {result['message']}")
    return result


# ── Phase 2: Inventory Intelligence Agent ────────────────────────────────────

def check_inventory_alerts(user_id: int, db: Session) -> dict:
    """
    Proactive inventory scanner — designed to run on every dashboard load.

    For each medicine:
      1. Calculates days-until-empty based on dose_amount + frequency
      2. Groups meds into severity tiers: critical (≤1 day), warning (≤3 days), good
      3. Creates AgentAlert records for new low-stock items
      4. Returns structured JSON for the frontend

    Returns:
        {
          "status": "success",
          "medications": [ { name, remaining, total, days_left, severity, frequency } ],
          "alerts": [ { type, message, medicine, days_left, medicine_id } ],
          "summary": "2 medications running low"
        }
    """
    now = datetime.now()

    all_meds = db.query(Medicine).filter(Medicine.user_id == user_id).all()
    if not all_meds:
        return {"status": "success", "medications": [], "alerts": [], "summary": "No medications tracked"}

    med_reports = []
    new_alerts = []

    for med in all_meds:
        days_left = _days_until_empty(med)
        remaining = med.current_quantity or 0
        total = med.total_quantity or 0

        # Determine severity
        if days_left is not None and days_left <= 1:
            severity = "critical"
        elif days_left is not None and days_left <= 3:
            severity = "warning"
        elif remaining == 0:
            severity = "critical"
        else:
            severity = "good"

        med_reports.append({
            "id": med.id,
            "name": med.name,
            "dosage": med.dosage,
            "frequency": med.frequency,
            "remaining": remaining,
            "total": total,
            "dose_amount": med.dose_amount or 1,
            "days_left": days_left,
            "severity": severity,
            "percent_left": round((remaining / total) * 100) if total > 0 else 0,
        })

        # Create alerts for critical/warning meds (if not already alerted)
        if severity in ("critical", "warning"):
            existing = db.query(AgentAlert).filter(
                AgentAlert.user_id == user_id,
                AgentAlert.alert_type == "low_stock",
                AgentAlert.is_read == 0,
                AgentAlert.data_json.contains(med.name),
            ).first()

            if not existing:
                if severity == "critical":
                    msg = (
                        f"🚨 {med.name} is almost empty! "
                        f"Only {remaining} dose{'s' if remaining != 1 else ''} left. "
                        f"Reorder immediately."
                    )
                else:
                    msg = (
                        f"⚠️ {med.name} will run out in ~{days_left} day{'s' if days_left != 1 else ''}. "
                        f"{remaining} doses remaining."
                    )

                alert = AgentAlert(
                    user_id=user_id,
                    alert_type="low_stock",
                    message=msg,
                    data_json=json.dumps({
                        "medicine_name": med.name,
                        "medicine_id": med.id,
                        "remaining": remaining,
                        "days_left": days_left,
                        "severity": severity,
                    }),
                    is_read=0,
                    created_at=now.isoformat(),
                )
                db.add(alert)
                new_alerts.append({
                    "type": "low_stock",
                    "message": msg,
                    "medicine": med.name,
                    "medicine_id": med.id,
                    "days_left": days_left,
                    "severity": severity,
                })

    if new_alerts:
        db.commit()

    # Build summary
    critical_count = sum(1 for m in med_reports if m["severity"] == "critical")
    warning_count = sum(1 for m in med_reports if m["severity"] == "warning")

    if critical_count > 0:
        summary = f"🚨 {critical_count} medication{'s' if critical_count > 1 else ''} critically low"
    elif warning_count > 0:
        summary = f"⚠️ {warning_count} medication{'s' if warning_count > 1 else ''} running low"
    else:
        summary = "✅ All medications well-stocked"

    logger.info(f"Inventory scan: user={user_id} critical={critical_count} warning={warning_count}")

    return {
        "status": "success",
        "medications": med_reports,
        "alerts": new_alerts,
        "summary": summary,
    }

