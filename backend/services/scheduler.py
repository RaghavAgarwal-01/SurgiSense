"""
services/scheduler.py

Phase 4 — Scheduler Agent (Background Worker)

Autonomous background worker that detects overdue tasks and generates
alerts without relying on frontend polling.

Runs in a separate thread on app startup:
  - Every 5 minutes: scans all users' pending critical tasks for today
  - 30+ min overdue → creates AgentAlert (type: missed_dose)
  - 2+ hours overdue → creates higher-severity alert
  - At 11:55 PM: marks incomplete tasks as 'missed' in AdherenceLog
"""

import json
import logging
import threading
import time
from datetime import datetime, date as date_type, timedelta

from sqlalchemy import distinct

from database import SessionLocal
from models import RecoveryTask, AdherenceLog, AgentAlert, User

logger = logging.getLogger(__name__)

# ── Configuration ────────────────────────────────────────────────────────────

SCAN_INTERVAL_SECONDS = 5 * 60        # 5 minutes
OVERDUE_THRESHOLD_MINUTES = 30        # first alert tier
CRITICAL_OVERDUE_MINUTES = 120        # second alert tier (2 hours)
END_OF_DAY_HOUR = 23                  # hour at which to run end-of-day sweep
END_OF_DAY_MINUTE = 55                # minute at which to run end-of-day sweep

_shutdown_event = threading.Event()


def _fmt_overdue(minutes: float) -> str:
    """Return human-readable overdue duration, e.g. '2 hr 17 min' or '45 min'."""
    total = int(minutes)
    hours, mins = divmod(total, 60)
    if hours > 0 and mins > 0:
        return f"{hours} hr {mins} min"
    elif hours > 0:
        return f"{hours} hr"
    else:
        return f"{mins} min"


def _parse_task_time(time_str: str, task_date: str) -> datetime | None:
    """Parse '08:00 AM' + '2026-03-27' into a datetime, or None."""
    if not time_str or not task_date:
        return None
    try:
        return datetime.strptime(f"{task_date} {time_str}", "%Y-%m-%d %I:%M %p")
    except (ValueError, TypeError):
        return None


def _check_overdue_tasks(db) -> int:
    """
    Scan all users' pending critical tasks for today.
    Creates alerts for overdue tasks.
    Returns the number of new alerts created.
    """
    now = datetime.now()
    today_str = date_type.today().isoformat()
    alerts_created = 0

    # Get all unique user IDs that have tasks today
    user_ids = [
        uid for (uid,) in
        db.query(distinct(RecoveryTask.user_id))
        .filter(
            RecoveryTask.task_date == today_str,
            RecoveryTask.is_critical == 1,
            RecoveryTask.status == "pending",
        )
        .all()
    ]

    for user_id in user_ids:
        tasks = (
            db.query(RecoveryTask)
            .filter(
                RecoveryTask.user_id == user_id,
                RecoveryTask.task_date == today_str,
                RecoveryTask.is_critical == 1,
                RecoveryTask.status == "pending",
            )
            .all()
        )

        for task in tasks:
            scheduled_dt = _parse_task_time(task.time, task.task_date)
            if not scheduled_dt:
                continue

            minutes_overdue = (now - scheduled_dt).total_seconds() / 60
            if minutes_overdue < OVERDUE_THRESHOLD_MINUTES:
                continue

            # Determine severity
            if minutes_overdue >= CRITICAL_OVERDUE_MINUTES:
                severity = "critical"
                alert_type = "missed_dose"
                msg = (
                    f"🚨 CRITICAL: \"{task.title}\" is {_fmt_overdue(minutes_overdue)} overdue! "
                    f"Scheduled at {task.time}. Please take action immediately."
                )
            else:
                severity = "warning"
                alert_type = "missed_dose"
                msg = (
                    f"⏰ \"{task.title}\" is {_fmt_overdue(minutes_overdue)} overdue. "
                    f"Scheduled at {task.time}."
                )

            # Check if we already have an unread alert for this exact task today
            existing = db.query(AgentAlert).filter(
                AgentAlert.user_id == user_id,
                AgentAlert.alert_type == alert_type,
                AgentAlert.is_read == 0,
                AgentAlert.data_json.contains(f'"task_id": {task.id}'),
            ).first()

            # If existing, check if we need to upgrade severity
            if existing:
                try:
                    existing_data = json.loads(existing.data_json or "{}")
                    if existing_data.get("severity") != "critical" and severity == "critical":
                        # Upgrade the existing alert
                        existing.message = msg
                        existing.data_json = json.dumps({
                            "task_id": task.id,
                            "task_title": task.title,
                            "scheduled_time": task.time,
                            "minutes_overdue": int(minutes_overdue),
                            "severity": severity,
                        })
                        existing.created_at = now.isoformat()
                        alerts_created += 1
                except (json.JSONDecodeError, TypeError):
                    pass
                continue

            # Create new alert
            alert = AgentAlert(
                user_id=user_id,
                alert_type=alert_type,
                message=msg,
                data_json=json.dumps({
                    "task_id": task.id,
                    "task_title": task.title,
                    "scheduled_time": task.time,
                    "minutes_overdue": int(minutes_overdue),
                    "severity": severity,
                }),
                is_read=0,
                created_at=now.isoformat(),
            )
            db.add(alert)
            alerts_created += 1

    if alerts_created > 0:
        db.commit()
        logger.info(f"Scheduler: created {alerts_created} overdue alert(s)")

    return alerts_created


def _end_of_day_sweep(db) -> int:
    """
    Marks all incomplete critical tasks for today as 'missed' in AdherenceLog.
    Runs once near midnight.
    """
    today_str = date_type.today().isoformat()
    now = datetime.now()
    missed_count = 0

    # Get all users with incomplete critical tasks today
    user_ids = [
        uid for (uid,) in
        db.query(distinct(RecoveryTask.user_id))
        .filter(
            RecoveryTask.task_date == today_str,
            RecoveryTask.is_critical == 1,
            RecoveryTask.status == "pending",
        )
        .all()
    ]

    for user_id in user_ids:
        tasks = (
            db.query(RecoveryTask)
            .filter(
                RecoveryTask.user_id == user_id,
                RecoveryTask.task_date == today_str,
                RecoveryTask.is_critical == 1,
                RecoveryTask.status == "pending",
            )
            .all()
        )

        for task in tasks:
            # Check if we already logged this as missed
            existing_log = db.query(AdherenceLog).filter(
                AdherenceLog.user_id == user_id,
                AdherenceLog.task_id == task.id,
                AdherenceLog.action == "missed",
            ).first()

            if existing_log:
                continue

            # Create missed adherence log
            log = AdherenceLog(
                user_id=user_id,
                task_id=task.id,
                medicine_id=None,
                action="missed",
                scheduled_time=task.time,
                completed_time=None,
                task_date=today_str,
                timestamp=now.isoformat(),
            )
            db.add(log)
            missed_count += 1

            # Also create a missed_dose alert
            alert = AgentAlert(
                user_id=user_id,
                alert_type="missed_dose",
                message=f"❌ Missed: \"{task.title}\" was not completed today (scheduled {task.time}).",
                data_json=json.dumps({
                    "task_id": task.id,
                    "task_title": task.title,
                    "scheduled_time": task.time,
                    "severity": "missed",
                }),
                is_read=0,
                created_at=now.isoformat(),
            )
            db.add(alert)

    if missed_count > 0:
        db.commit()
        logger.info(f"Scheduler: end-of-day sweep marked {missed_count} task(s) as missed")

    return missed_count


def _scheduler_loop():
    """Main scheduler loop — runs in a background thread."""
    logger.info("Scheduler agent started (5-min scan interval)")
    last_eod_date = None

    while not _shutdown_event.is_set():
        db = SessionLocal()
        try:
            # Regular overdue scan
            _check_overdue_tasks(db)

            # End-of-day sweep (runs once per day around 11:55 PM)
            now = datetime.now()
            if (
                now.hour == END_OF_DAY_HOUR
                and now.minute >= END_OF_DAY_MINUTE
                and last_eod_date != date_type.today()
            ):
                _end_of_day_sweep(db)
                last_eod_date = date_type.today()

        except Exception as e:
            logger.error(f"Scheduler error: {e}")
        finally:
            db.close()

        # Wait for the next scan interval (or shutdown)
        _shutdown_event.wait(SCAN_INTERVAL_SECONDS)

    logger.info("Scheduler agent stopped")


def start_scheduler():
    """Launch the scheduler in a daemon background thread."""
    thread = threading.Thread(target=_scheduler_loop, daemon=True, name="scheduler-agent")
    thread.start()
    return thread


def stop_scheduler():
    """Signal the scheduler to stop."""
    _shutdown_event.set()
