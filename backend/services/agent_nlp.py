"""
services/agent_nlp.py

Natural Language Agent — LLM-powered intent detection and tool routing.

Accepts free-form user messages and:
  1. Uses LLM to classify intent + extract parameters
  2. Routes to the correct agent tool (via agent_router)
  3. Returns a conversational response with the agent's structured result

Supported intents:
  - complete_task  → "I took my morning meds" / "Done with wound care"
  - check_inventory → "How many pills do I have left?"
  - adherence_report → "How am I doing this week?"
  - search_pharmacy → "Find prices for Pantoprazole"
  - general_health → Anything else → medical RAG
"""

import os
import json
import logging
from datetime import date as date_type

from groq import Groq
from sqlalchemy.orm import Session

from models import RecoveryTask, Medicine
from services.agent_router import route_event

logger = logging.getLogger(__name__)

GROQ_KEY = os.getenv("GROQ_API_KEY")
_client = Groq(api_key=GROQ_KEY)

# ── Intent Classification Prompt ─────────────────────────────────────────────

CLASSIFY_PROMPT = """You are an AI agent router for a post-surgical recovery app called SurgiSense.

Given the user's message, classify their intent into EXACTLY ONE of these categories and extract any parameters.

INTENTS:
1. "complete_task" — User says they did something (took meds, did exercise, checked vitals, etc.)
   Extract: {"task_keyword": "medication|wound|vitals|exercise|rest|<whatever they mention>"}

2. "check_inventory" — User asks about medication supply, pills remaining, stock levels
   Extract: {"medicine_name": "<specific med or null>"}

3. "adherence_report" — User asks about their adherence, progress, streak, how they're doing
   Extract: {"days": 7}

4. "search_pharmacy" — User wants to buy/reorder/find prices for medicine
   Extract: {"medicine_name": "<specific medicine>"}

5. "general_health" — Anything else (health questions, symptoms, advice)
   Extract: {"question": "<the user's question>"}

Return ONLY valid JSON:
{
  "intent": "<one of the 5 intents above>",
  "params": { ... },
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation of why you chose this intent"
}
"""


def process_natural_language(
    message: str,
    user_id: int,
    db: Session,
) -> dict:
    """
    Process a natural language user message through the agent system.

    Returns:
        {
          "status": "success",
          "intent": "complete_task",
          "confidence": 0.9,
          "reasoning": "User said they took their medication",
          "agent_result": { ... result from the tool ... },
          "response": "Human-readable conversational response",
          "tools_used": ["medication_agent"]
        }
    """
    reasoning_steps = []
    tools_used = []

    # ── Step 1: Classify intent via LLM ───────────────────────────────────
    reasoning_steps.append({
        "step": 1,
        "action": "Understanding intent",
        "status": "running",
        "detail": f"Analyzing: \"{message[:80]}...\"" if len(message) > 80 else f"Analyzing: \"{message}\"",
        "emoji": "🧠",
    })

    try:
        classify_resp = _client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": CLASSIFY_PROMPT},
                {"role": "user", "content": message},
            ],
            response_format={"type": "json_object"},
        )
        raw = classify_resp.choices[0].message.content
        classification = json.loads(raw) if raw else {}
    except Exception as e:
        logger.error(f"NLP classification failed: {e}")
        reasoning_steps[-1]["status"] = "error"
        reasoning_steps[-1]["detail"] = f"Classification failed: {str(e)}"
        return {
            "status": "error",
            "response": "I'm having trouble understanding that right now. Could you try rephrasing?",
            "reasoning_chain": reasoning_steps,
        }

    intent = classification.get("intent", "general_health")
    params = classification.get("params", {})
    confidence = classification.get("confidence", 0.5)
    llm_reasoning = classification.get("reasoning", "")

    reasoning_steps[-1]["status"] = "done"
    reasoning_steps[-1]["detail"] = f"Intent: {intent} (confidence: {confidence:.0%}) — {llm_reasoning}"

    # ── Step 2: Route to the correct agent tool ──────────────────────────
    reasoning_steps.append({
        "step": 2,
        "action": "Selecting agent tool",
        "status": "running",
        "detail": f"Routing to handler for '{intent}'...",
        "emoji": "🔀",
    })

    agent_result = None
    response_text = ""

    try:
        if intent == "complete_task":
            tools_used.append("medication_agent")
            task_keyword = params.get("task_keyword", "medication")

            # Find the best matching pending task
            today_str = date_type.today().isoformat()
            pending_tasks = (
                db.query(RecoveryTask)
                .filter(
                    RecoveryTask.user_id == user_id,
                    RecoveryTask.task_date == today_str,
                    RecoveryTask.status == "pending",
                )
                .all()
            )

            # Fuzzy match task by keyword
            matched_task = None
            for t in pending_tasks:
                if task_keyword.lower() in (t.title or "").lower():
                    matched_task = t
                    break

            if not matched_task and pending_tasks:
                # Fall back to first pending critical task
                critical = [t for t in pending_tasks if t.is_critical == 1]
                matched_task = critical[0] if critical else pending_tasks[0]

            if matched_task:
                reasoning_steps[-1]["status"] = "done"
                reasoning_steps[-1]["detail"] = f"Matched task: \"{matched_task.title}\" at {matched_task.time}"

                reasoning_steps.append({
                    "step": 3, "action": "Executing task completion",
                    "status": "running", "detail": "Running medication agent pipeline...", "emoji": "⚡",
                })

                agent_result = route_event("task_completed", {"task_id": matched_task.id}, user_id, db)
                tools_used.append("task_orchestrator")

                # Merge sub-reasoning if available
                sub_chain = agent_result.get("reasoning_chain", [])
                if sub_chain:
                    reasoning_steps[-1]["status"] = "done"
                    reasoning_steps[-1]["detail"] = f"Pipeline completed with {len(sub_chain)} steps"
                    # Renumber and append sub-steps
                    for i, sub in enumerate(sub_chain):
                        sub_copy = dict(sub)
                        sub_copy["step"] = len(reasoning_steps) + 1
                        sub_copy["action"] = f"  ↳ {sub_copy['action']}"
                        reasoning_steps.append(sub_copy)

                score = agent_result.get("score", "")
                deductions = agent_result.get("deductions", [])
                alerts = agent_result.get("alerts", [])

                response_text = f"✅ Done! I've marked **\"{matched_task.title}\"** as completed."
                if deductions:
                    meds = ", ".join(d["medicine"] for d in deductions)
                    response_text += f"\n\n💊 Deducted doses from: {meds}."
                if alerts:
                    response_text += f"\n\n⚠️ Heads up: {len(alerts)} low-stock alert(s) generated."
                if score:
                    response_text += f"\n\n📊 Today's adherence: **{score}%**."
            else:
                reasoning_steps[-1]["status"] = "done"
                reasoning_steps[-1]["detail"] = "No pending tasks found for today"
                response_text = "I couldn't find any pending tasks matching that for today. All done already? 🎉"

        elif intent == "check_inventory":
            tools_used.append("inventory_agent")
            agent_result = route_event("inventory_changed", {}, user_id, db)
            reasoning_steps[-1]["status"] = "done"
            reasoning_steps[-1]["detail"] = "Inventory scan complete"

            meds = agent_result.get("medications", [])
            if meds:
                lines = ["Here's your medication inventory:\n"]
                for m in meds:
                    emoji = "🟢" if m["severity"] == "good" else "🟡" if m["severity"] == "warning" else "🔴"
                    days = f" (~{m['days_left']} days)" if m.get("days_left") is not None else ""
                    lines.append(f"{emoji} **{m['name']}**: {m['remaining']}/{m['total']} doses left{days}")
                response_text = "\n".join(lines)
            else:
                response_text = "No medications are being tracked yet. Upload a discharge summary to get started."

        elif intent == "adherence_report":
            tools_used.append("compliance_agent")
            days = params.get("days", 7)
            agent_result = route_event("daily_summary", {"days": days}, user_id, db)
            reasoning_steps[-1]["status"] = "done"
            reasoning_steps[-1]["detail"] = f"Adherence report for {days} days"

            pct = agent_result.get("overall_percent", 0)
            streak = agent_result.get("streak", 0)
            missed = agent_result.get("most_missed_slot")

            response_text = f"📊 **Your {days}-day adherence: {pct}%**"
            if streak > 0:
                response_text += f"\n🔥 Current streak: **{streak} day{'s' if streak != 1 else ''}** of perfect adherence!"
            if missed:
                response_text += f"\n⏰ You tend to miss the **{missed}** dose — try setting a reminder for that time."

            per_med = agent_result.get("per_medication", [])
            if per_med:
                response_text += "\n\n**Per medication:**"
                for m in per_med:
                    bar = "█" * (m["percent"] // 10) + "░" * (10 - m["percent"] // 10)
                    response_text += f"\n  {m['name']}: {bar} {m['percent']}%"

        elif intent == "search_pharmacy":
            tools_used.append("pharmacy_agent")
            med_name = params.get("medicine_name", "")
            reasoning_steps[-1]["status"] = "done"
            reasoning_steps[-1]["detail"] = f"Searching prices for: {med_name}"

            # Return a link to pharmacy search — the actual search is done client-side
            response_text = f"🔍 I'll search for **{med_name}** prices for you. "
            response_text += f"Head to the [Pharmacy page](/pharmacy) and I'll start the search, "
            response_text += f"or you can check these directly:\n"
            response_text += f"- [Apollo Pharmacy](https://www.apollopharmacy.in/search-medicines/{med_name})\n"
            response_text += f"- [Tata 1mg](https://www.1mg.com/search/all?name={med_name})"
            agent_result = {"status": "success", "medicine": med_name, "action": "pharmacy_redirect"}

        else:  # general_health
            tools_used.append("medical_rag")
            reasoning_steps[-1]["status"] = "done"
            reasoning_steps[-1]["detail"] = "Forwarding to medical knowledge base"

            # Use RAG for general health questions
            try:
                from services.chat import MedicalRAGService
                rag = MedicalRAGService()
                answer = rag.ask_question(params.get("question", message))
                response_text = answer
                agent_result = {"status": "success", "source": "medical_rag"}
            except Exception:
                response_text = "I can answer that, but I need your medical documents loaded first. Upload a discharge summary to enable AI health chat."
                agent_result = {"status": "no_data"}

    except Exception as e:
        logger.error(f"NLP tool execution failed: {e}")
        reasoning_steps[-1]["status"] = "error"
        reasoning_steps[-1]["detail"] = f"Execution failed: {str(e)}"
        response_text = "Something went wrong while processing your request. Please try again."

    # ── Step 3: Generate response ─────────────────────────────────────────
    reasoning_steps.append({
        "step": len(reasoning_steps) + 1,
        "action": "Generating response",
        "status": "done",
        "detail": f"Used {len(tools_used)} tool(s): {', '.join(tools_used)}",
        "emoji": "💬",
    })

    return {
        "status": "success",
        "intent": intent,
        "confidence": confidence,
        "reasoning": llm_reasoning,
        "agent_result": agent_result,
        "response": response_text,
        "tools_used": tools_used,
        "reasoning_chain": reasoning_steps,
    }
