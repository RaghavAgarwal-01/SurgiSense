"""
services/agent_router.py

Phase 5 — Agent Router (Unified Orchestrator)

Central dispatcher that accepts events and routes them to the
correct agent tool. Provides a single event-driven entry point
for the entire agentic workflow.

Supported events:
  - task_completed   → medication_agent.execute_medication_completion
  - inventory_changed → medication_agent.check_inventory_alerts
  - daily_summary    → medication_agent.get_adherence_stats
  - time_tick        → scheduler._check_overdue_tasks
"""

import logging
from sqlalchemy.orm import Session

from services.medication_agent import (
    execute_medication_completion,
    check_inventory_alerts,
    get_adherence_stats,
)
from services.scheduler import _check_overdue_tasks

logger = logging.getLogger(__name__)

# ── Event type constants ─────────────────────────────────────────────────────

EVENT_TASK_COMPLETED = "task_completed"
EVENT_INVENTORY_CHANGED = "inventory_changed"
EVENT_DAILY_SUMMARY = "daily_summary"
EVENT_TIME_TICK = "time_tick"

SUPPORTED_EVENTS = {
    EVENT_TASK_COMPLETED,
    EVENT_INVENTORY_CHANGED,
    EVENT_DAILY_SUMMARY,
    EVENT_TIME_TICK,
}


def route_event(
    event_type: str,
    payload: dict,
    user_id: int,
    db: Session,
) -> dict:
    """
    Central event dispatcher — routes to the correct agent tool.

    Args:
        event_type: One of the supported event types
        payload: Event-specific data (e.g., {"task_id": 42})
        user_id: Authenticated user ID
        db: SQLAlchemy session

    Returns:
        Structured dict from the agent that handled the event
    """
    logger.info(f"Agent Router: event={event_type} user={user_id} payload={payload}")

    if event_type not in SUPPORTED_EVENTS:
        return {
            "status": "error",
            "event": event_type,
            "message": f"Unknown event type '{event_type}'. "
                       f"Supported: {', '.join(sorted(SUPPORTED_EVENTS))}",
        }

    try:
        # ── task_completed ────────────────────────────────────────────────
        if event_type == EVENT_TASK_COMPLETED:
            task_id = payload.get("task_id")
            if not task_id:
                return {
                    "status": "error",
                    "event": event_type,
                    "message": "Missing required field: payload.task_id",
                }
            result = execute_medication_completion(user_id, int(task_id), db)
            return {"event": event_type, **result}

        # ── inventory_changed ─────────────────────────────────────────────
        elif event_type == EVENT_INVENTORY_CHANGED:
            result = check_inventory_alerts(user_id, db)
            return {"event": event_type, **result}

        # ── daily_summary ─────────────────────────────────────────────────
        elif event_type == EVENT_DAILY_SUMMARY:
            days = payload.get("days", 7)
            days = max(1, min(int(days), 90))
            result = get_adherence_stats(user_id, days, db)
            return {"event": event_type, **result}

        # ── time_tick ─────────────────────────────────────────────────────
        elif event_type == EVENT_TIME_TICK:
            alerts_created = _check_overdue_tasks(db)
            return {
                "event": event_type,
                "status": "success",
                "alerts_created": alerts_created,
                "message": f"Scheduler tick complete: {alerts_created} new alert(s)",
            }

    except Exception as e:
        logger.error(f"Agent Router error: event={event_type} error={e}")
        return {
            "status": "error",
            "event": event_type,
            "message": f"Agent execution failed: {str(e)}",
        }
