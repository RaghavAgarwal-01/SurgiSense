# backend/services/intake_agent.py
#
# Core AI agent service for the healthcare operations workflow.
# Implements:
#   1. PDF extraction into structured intake form fields
#   2. ICD-10 / CPT code validation against a local rule set
#   3. Prior authorization simulation with payer-specific rules
#   4. Surgery readiness evaluation (extends existing rules.py)
#   5. Auditable reasoning — every decision is logged with rationale
#
# Called by the new /api/extract-intake and /api/submit-intake endpoints
# added to main.py.

import os
import json
import logging
from datetime import datetime
from groq import Groq
from utils.pdf_reader import extract_text_from_pdf

logger = logging.getLogger(__name__)


# ─── ICD-10 / CPT reference tables (expand as needed) ────────────────────────
# In production these would be loaded from a full CMS code set database.
VALID_ICD10 = {
    "K35.89": "Acute appendicitis, other",
    "K80.20": "Calculus of gallbladder without cholecystitis",
    "H26.9":  "Unspecified cataract",
    "I25.10": "Atherosclerotic heart disease (CABG indication)",
    "M17.11": "Primary osteoarthritis, right knee",
    "M17.12": "Primary osteoarthritis, left knee",
    "Z48.01": "Encounter for wound care — post-op",
    "Z09":    "Encounter for follow-up after completed treatment",
    "K35.80": "Acute Appendicitis"
}

VALID_CPT = {
    "44950": "Appendectomy",
    "47600": "Cholecystectomy",
    "66984": "Cataract extraction with IOL",
    "33533": "CABG, arterial",
    "27447": "Total knee arthroplasty",
    "99213": "Office visit, established patient, low complexity",
    "99214": "Office visit, established patient, moderate complexity",
}

# Payer-specific prior authorization rules (simplified)
PAYER_RULES = {
    "PAYER-001": {
        "requires_prior_auth": ["27447", "33533", "66984"],
        "auto_approve":        ["44950", "47600"],
        "documentation_required": ["operative note", "pre-op labs"],
    },
    "PAYER-002": {
        "requires_prior_auth": ["33533", "27447"],
        "auto_approve":        ["44950", "47600", "66984"],
        "documentation_required": ["referral letter"],
    },
    "DEFAULT": {
        "requires_prior_auth": ["27447", "33533"],
        "auto_approve":        ["44950", "47600", "66984", "99213", "99214"],
        "documentation_required": [],
    },
}


def get_groq_client() -> Groq:
    key = os.getenv("GROQ_API_KEY")
    if not key:
        raise RuntimeError("GROQ_API_KEY not set")
    return Groq(api_key=key)


# ─── 1. PDF → structured intake fields ───────────────────────────────────────

def extract_intake_from_pdf(file_bytes: bytes) -> dict:
    """
    Extract all fields needed for the intake form from a raw PDF.
    Returns a dict that maps directly to the IntakeForm schema.
    Missing fields are returned as None (frontend highlights them in red).
    """
    raw_text = extract_text_from_pdf(file_bytes)

    prompt = f"""You are a clinical data extraction AI for SurgiSense.

Extract the following fields from the medical document below.
Return ONLY valid JSON. Use null for any field you cannot find.
Do NOT invent values. Do NOT guess ICD-10 or CPT codes — only include them
if they appear explicitly in the document.

Required JSON schema:
{{
  "patient_name":   string | null,
  "age":            integer | null,
  "gender":         "male"|"female"|"other" | null,
  "surgery_type":   string | null,
  "surgery_phase":  "pre"|"post" | null,
  "surgery_date":   "YYYY-MM-DD" | null,
  "icd10_code":     string | null,
  "cpt_code":       string | null,
  "bp_sys":         integer | null,
  "bp_dia":         integer | null,
  "heart_rate":     integer | null,
  "spo2":           number  | null,
  "temperature":    number  | null,
  "hemoglobin":     number  | null,
  "blood_sugar":    integer | null,
  "notes":          string  | null
}}

Document:
{raw_text[:8000]}
"""

    client = get_groq_client()
    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}],
        temperature=0,
        response_format={"type": "json_object"},
    )

    content = response.choices[0].message.content
    if not content:
        logger.warning("Empty extraction response from LLM")
        return {}

    try:
        data = json.loads(content.strip())
        # Replace None-like strings
        return {k: (v if v != "null" else None) for k, v in data.items()}
    except json.JSONDecodeError as e:
        logger.error(f"JSON parse error in extract_intake_from_pdf: {e}")
        return {}


# ─── 2. ICD-10 / CPT validation ──────────────────────────────────────────────

def validate_codes(icd10_code: str, cpt_code: str) -> dict:
    """
    Validates ICD-10 and CPT codes against the reference table.
    Returns a dict with validation status and human-readable descriptions.
    This is an auditable step — all decisions are logged.
    """
    result = {
        "icd10": {
            "code":        icd10_code,
            "valid":       icd10_code in VALID_ICD10,
            "description": VALID_ICD10.get(icd10_code, "Unknown / not in reference set"),
            "guardrail":   None,
        },
        "cpt": {
            "code":        cpt_code,
            "valid":       cpt_code in VALID_CPT,
            "description": VALID_CPT.get(cpt_code, "Unknown / not in reference set"),
            "guardrail":   None,
        },
        "code_match": False,
        "audit_note": "",
    }

    # Guardrail: flag unknown codes — do not block, but require human review
    if not result["icd10"]["valid"]:
        result["icd10"]["guardrail"] = "UNKNOWN_CODE — requires manual clinical review before claim submission"
    if not result["cpt"]["valid"]:
        result["cpt"]["guardrail"] = "UNKNOWN_CODE — requires manual clinical review before claim submission"

    # Cross-check ICD-10 ↔ CPT clinical coherence
    coherence_map = {
        "K35.89": ["44950"],
        "K80.20": ["47600"],
        "H26.9":  ["66984"],
        "I25.10": ["33533"],
        "M17.11": ["27447"],
        "M17.12": ["27447"],
    }
    if icd10_code in coherence_map:
        if cpt_code in coherence_map[icd10_code]:
            result["code_match"] = True
            result["audit_note"] = "ICD-10 and CPT codes are clinically coherent."
        else:
            result["audit_note"] = (
                f"Possible mismatch: ICD-10 {icd10_code} typically maps to "
                f"CPT {coherence_map[icd10_code]}. Submitted CPT is {cpt_code}. "
                f"Flag for clinical review."
            )
    else:
        result["audit_note"] = "Code coherence check not available for this ICD-10 code."

    logger.info(f"Code validation: ICD10={icd10_code} valid={result['icd10']['valid']} "
                f"CPT={cpt_code} valid={result['cpt']['valid']} match={result['code_match']}")
    return result


# ─── 3. Prior authorization check ────────────────────────────────────────────

def check_prior_auth(cpt_code: str, payer_id: str) -> dict:
    """
    Simulates a payer-specific prior authorization check.
    In production this would call the payer's real-time eligibility API.
    Returns authorization status with full audit trail.
    """
    rules = PAYER_RULES.get(payer_id, PAYER_RULES["DEFAULT"])

    if cpt_code in rules["auto_approve"]:
        status = "AUTO_APPROVED"
        reason = f"Payer {payer_id or 'DEFAULT'} auto-approves CPT {cpt_code}. No prior auth required."
    elif cpt_code in rules["requires_prior_auth"]:
        status = "PRIOR_AUTH_REQUIRED"
        reason = (
            f"Payer {payer_id or 'DEFAULT'} requires prior authorization for CPT {cpt_code}. "
            f"Required documentation: {', '.join(rules['documentation_required']) or 'standard clinical notes'}."
        )
    else:
        status = "UNKNOWN_PROCEDURE"
        reason = f"CPT {cpt_code} not in payer {payer_id or 'DEFAULT'} benefit schedule. Manual review required."

    auth_result = {
        "status":    status,
        "reason":    reason,
        "payer_id":  payer_id or "DEFAULT",
        "cpt_code":  cpt_code,
        "timestamp": datetime.utcnow().isoformat() + "Z",
    }
    logger.info(f"Prior auth: {auth_result}")
    return auth_result


# ─── 4. Surgery readiness evaluation (extended) ──────────────────────────────

def evaluate_readiness(intake: dict) -> dict:
    """
    Extended version of rules.py evaluate_patient().
    Accepts the full intake dict (not just vitals) and returns a structured
    readiness verdict with per-criterion audit trail.
    """
    surgery = (intake.get("surgery_type") or "").lower().strip()
    phase   = intake.get("surgery_phase", "post")

    criteria = []
    flags    = []

    def check(label: str, passed: bool, detail: str):
        criteria.append({"criterion": label, "passed": passed, "detail": detail})
        if not passed:
            flags.append(label)

    # Extract vitals safely
    bp_sys      = _safe_int(intake.get("bp_sys"))
    bp_dia      = _safe_int(intake.get("bp_dia"))
    heart_rate  = _safe_int(intake.get("heart_rate"))
    spo2        = _safe_float(intake.get("spo2"))
    temperature = _safe_float(intake.get("temperature"))
    hemoglobin  = _safe_float(intake.get("hemoglobin"))
    blood_sugar = _safe_int(intake.get("blood_sugar"))

    # Universal checks
    if spo2 is not None:
        check("SpO₂ ≥ 94%", spo2 >= 94, f"SpO₂ = {spo2}%")
    if temperature is not None:
        check("Afebrile (temp < 38.5 °C)", temperature < 38.5, f"Temperature = {temperature} °C")
    if bp_sys is not None:
        check("Systolic BP > 90 mmHg", bp_sys > 90, f"BP = {bp_sys}/{bp_dia} mmHg")

    # Surgery-specific checks
    if "appendect" in surgery:
        # No additional checks beyond universal vitals
        pass
    elif "cataract" in surgery:
        if bp_sys is not None:
            check("BP < 160 mmHg (cataract safety)", bp_sys < 160, f"Systolic BP = {bp_sys}")
        if blood_sugar is not None:
            check("Blood sugar < 200 mg/dL", blood_sugar < 200, f"Blood sugar = {blood_sugar} mg/dL")
    elif "cabg" in surgery or "bypass" in surgery:
        if hemoglobin is not None:
            check("Hemoglobin > 10 g/dL (CABG)", hemoglobin > 10, f"Hemoglobin = {hemoglobin} g/dL")
    elif "knee" in surgery or "arthroplasty" in surgery:
        if hemoglobin is not None:
            check("Hemoglobin > 10 g/dL", hemoglobin > 10, f"Hemoglobin = {hemoglobin} g/dL")
        if blood_sugar is not None:
            check("Blood sugar < 180 mg/dL", blood_sugar < 180, f"Blood sugar = {blood_sugar} mg/dL")

    # Determine overall verdict
    if not criteria:
        verdict = "INCOMPLETE"
        rationale = "Insufficient vitals provided to make a readiness determination."
    elif all(c["passed"] for c in criteria):
        verdict = "READY"
        rationale = "All evaluated criteria met. Patient appears clinically ready."
    elif len(flags) == 1:
        verdict = "CONDITIONAL"
        rationale = f"One criterion failed ({flags[0]}). Clinical review recommended before proceeding."
    else:
        verdict = "NOT_READY"
        rationale = f"{len(flags)} criteria failed: {', '.join(flags)}. Delay surgery until resolved."

    return {
        "verdict":   verdict,
        "rationale": rationale,
        "criteria":  criteria,
        "flags":     flags,
        "phase":     phase,
        "timestamp": datetime.utcnow().isoformat() + "Z",
    }


# ─── 5. Master agent runner ───────────────────────────────────────────────────

def run_intake_agent(intake: dict, wound_analysis: str = "") -> dict:
    """
    Orchestrates the full healthcare operations agent workflow:
      Step 1 → validate ICD-10 and CPT codes
      Step 2 → check prior authorization against payer rules
      Step 3 → evaluate surgery readiness from vitals
      Step 4 → compose final audit report

    All steps are auditable: every decision includes its rationale and timestamp.
    Guardrails: no claim is auto-submitted if a code is unknown or if the
                prior auth status is PRIOR_AUTH_REQUIRED.
    """
    logger.info(f"[AGENT] Starting intake workflow for patient: {intake.get('patient_name')}")

    audit_trail = []

    # Step 1: Code validation
    code_result = validate_codes(
        icd10_code=intake.get("icd10_code", ""),
        cpt_code=intake.get("cpt_code", ""),
    )
    audit_trail.append({
        "step": "code_validation",
        "result": code_result,
    })

    # Step 2: Prior auth
    auth_result = check_prior_auth(
        cpt_code=intake.get("cpt_code", ""),
        payer_id=intake.get("payer_id", ""),
    )
    audit_trail.append({
        "step": "prior_authorization",
        "result": auth_result,
    })

    # Step 3: Readiness
    readiness = evaluate_readiness(intake)
    audit_trail.append({
        "step": "readiness_evaluation",
        "result": readiness,
    })

    # Step 4: Guardrail enforcement
    guardrails_triggered = []
    if not code_result["icd10"]["valid"]:
        guardrails_triggered.append("Unknown ICD-10 code — claim blocked pending review")
    if not code_result["cpt"]["valid"]:
        guardrails_triggered.append("Unknown CPT code — claim blocked pending review")
    if not code_result["code_match"] and code_result["icd10"]["valid"] and code_result["cpt"]["valid"]:
        guardrails_triggered.append("ICD-10 / CPT coherence mismatch — flagged for clinical review")
    if auth_result["status"] == "PRIOR_AUTH_REQUIRED":
        guardrails_triggered.append("Prior authorization required before claim submission")

    # Final composite status
    if guardrails_triggered:
        workflow_status = "REQUIRES_REVIEW"
    elif readiness["verdict"] in ("READY", "CONDITIONAL"):
        workflow_status = "APPROVED"
    else:
        workflow_status = "DEFER"

    report = {
        "patient_name":      intake.get("patient_name"),
        "surgery_type":      intake.get("surgery_type"),
        "surgery_phase":     intake.get("surgery_phase"),
        "workflow_status":   workflow_status,
        "audit_trail":       audit_trail,
        "guardrails":        guardrails_triggered,
        "wound_analysis":    wound_analysis or None,
        "generated_at":      datetime.utcnow().isoformat() + "Z",
    }

    logger.info(f"[AGENT] Workflow complete. Status: {workflow_status}. Guardrails: {guardrails_triggered}")
    return report


# ─── helpers ──────────────────────────────────────────────────────────────────

def _safe_int(v):
    try:
        return int(v) if v not in (None, "", "null") else None
    except (ValueError, TypeError):
        return None

def _safe_float(v):
    try:
        return float(v) if v not in (None, "", "null") else None
    except (ValueError, TypeError):
        return None
