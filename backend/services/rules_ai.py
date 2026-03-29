"""
Clinical Surgical Readiness Evaluation System (AI-Powered)
- Vital sign assessment logic: deterministic and based on ASA/WHO guidelines
- Clinical reasoning: Generated via Groq AI for flexible, detailed explanations

Uses: Groq Llama-3.3-70b for reasoning generation
"""

import os
import json
from groq import Groq

# Initialize Groq client

def evaluate_patient(v):
    """
    Comprehensive preoperative assessment for surgical clearance.
    Returns: status, reasoning (AI-generated detailed clinical justification), and risk factors
    """
    
    if v.surgery == "appendectomy":
        return evaluate_appendectomy(v)
    elif v.surgery == "cataract":
        return evaluate_cataract(v)
    elif v.surgery == "cabg":
        return evaluate_cabg(v)
    
    return {
        "status": "UNKNOWN SURGERY",
        "reasoning": "The selected surgery type is not in our evaluation system. Please consult with the surgical team and anesthesiologist for clearance.",
        "risk_factors": []
    }


def generate_clinical_reasoning(vitals_summary, status, risk_factors, clinical_findings, surgery_type, asa_class):
    """
    Use Groq to generate detailed clinical reasoning based on:
    - Patient vital signs
    - Assessment status (READY, HIGH RISK, NOT READY, etc.)
    - Identified risk factors
    - Clinical findings
    - Surgery type and ASA class
    """
    try:
        groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))
        prompt = f"""You are an expert clinical assistant providing surgical readiness assessments. 
Generate a detailed, professional clinical reasoning narrative for the following patient assessment:

PATIENT VITALS SUMMARY:
{vitals_summary}

ASSESSMENT STATUS: {status}
ASA CLASS: {asa_class}
SURGERY TYPE: {surgery_type.upper()}

IDENTIFIED RISK FACTORS:
{chr(10).join([f"• {rf}" for rf in risk_factors]) if risk_factors else "• None"}

CLINICAL FINDINGS:
{chr(10).join([f"• {cf}" for cf in clinical_findings])}

Please generate a professional clinical reasoning note that:
1. Starts with a status header (✓ for READY, ⚠ for HIGH RISK/DELAY, ✗ for NOT READY)
2. Provides clinical justification specific to this patient's data
3. References appropriate medical guidelines (ASA, WHO, ACC/AHA, etc.)
4. Lists specific recommendations tailored to the status
5. Is written in formal clinical language suitable for medical records
6. Is concise but comprehensive (2-3 paragraphs plus recommendations)

Generate ONLY the clinical reasoning text. Do not add any preamble or metadata."""

        response = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
            max_tokens=1500
        )
        
        reasoning = response.choices[0].message.content
        return reasoning.strip()
    
    except Exception as e:
        print(f"Error generating reasoning via Groq: {e}")
        # Fallback to simple reasoning if API fails
        return f"Assessment Status: {status}\nRisk Factors: {len(risk_factors)} identified\nASA Class: {asa_class}"


def evaluate_appendectomy(v):
    """
    Appendectomy Evaluation (Emergency/Urgent General Surgery)
    Reference: ASA Guidelines, Emergency Surgery Risk Stratification
    """
    risk_factors = []
    clinical_findings = []
    
    # Blood Pressure Assessment
    bp_acceptable = v.bp_sys >= 90 and v.bp_sys <= 180 and v.bp_dia >= 60 and v.bp_dia <= 110
    if v.bp_sys < 90:
        risk_factors.append("Hypotension (SBP <90 mmHg) - increased risk of organ hypoperfusion")
        clinical_findings.append(f"Systolic BP {v.bp_sys} mmHg is critically low")
    elif v.bp_sys > 180:
        risk_factors.append("Stage 2 Hypertension (SBP >180 mmHg) - increased cardiac risk")
        clinical_findings.append(f"Systolic BP {v.bp_sys} mmHg requires stabilization")
    else:
        clinical_findings.append(f"Blood pressure {v.bp_sys}/{v.bp_dia} mmHg is acceptable")
    
    # Oxygen Saturation Assessment
    spo2_acceptable = v.spo2 > 94
    if v.spo2 <= 94:
        risk_factors.append(f"Hypoxemia (SpO2 {v.spo2}%) - inadequate oxygenation")
        clinical_findings.append("SpO2 below acceptable threshold; respiratory compromise detected")
    else:
        clinical_findings.append(f"Oxygen saturation {v.spo2}% is adequate")
    
    # Temperature Assessment
    temp_acceptable = v.temperature >= 36.5 and v.temperature < 38.5
    if v.temperature < 36:
        risk_factors.append("Hypothermia (<36°C) - increased surgical bleeding and infection risk")
        clinical_findings.append(f"Body temperature {v.temperature}°C is abnormally low")
    elif v.temperature >= 38.5:
        risk_factors.append(f"Fever/Infection (Temp {v.temperature}°C) - likely acute abdomen with infection")
        clinical_findings.append(f"Temperature {v.temperature}°C suggests active infection; investigate source")
    else:
        clinical_findings.append(f"Core temperature {v.temperature}°C is within normal range")
    
    # Heart Rate Assessment
    hr_assessment = analyze_heart_rate(v.heart_rate)
    clinical_findings.append(hr_assessment["finding"])
    if hr_assessment["concern"]:
        risk_factors.append(hr_assessment["concern"])
    
    # Hemoglobin Assessment
    hb_assessment = analyze_hemoglobin(v.hemoglobin, "emergency")
    clinical_findings.append(hb_assessment["finding"])
    if hb_assessment["concern"]:
        risk_factors.append(hb_assessment["concern"])
    
    # Blood Sugar Assessment
    glucose_assessment = analyze_glucose(v.blood_sugar)
    clinical_findings.append(glucose_assessment["finding"])
    if glucose_assessment["concern"]:
        risk_factors.append(glucose_assessment["concern"])
    
    # Determine status
    all_critical_acceptable = bp_acceptable and spo2_acceptable and temp_acceptable
    
    if all_critical_acceptable and len(risk_factors) == 0:
        status = "READY"
        asa_class = "I-II"
    elif all_critical_acceptable and len(risk_factors) <= 2:
        status = "HIGH RISK"
        asa_class = "III"
    else:
        status = "NOT READY"
        asa_class = "IV-V"
    
    # Prepare vitals summary for AI
    vitals_summary = f"""
BP: {v.bp_sys}/{v.bp_dia} mmHg
HR: {v.heart_rate} bpm
SpO2: {v.spo2}%
Temperature: {v.temperature}°C
Hemoglobin: {v.hemoglobin} g/dL
Blood Glucose: {v.blood_sugar} mg/dL
    """
    
    # Generate reasoning via AI
    reasoning = generate_clinical_reasoning(
        vitals_summary=vitals_summary,
        status=status,
        risk_factors=risk_factors,
        clinical_findings=clinical_findings,
        surgery_type="appendectomy",
        asa_class=asa_class
    )
    
    return {
        "status": status,
        "reasoning": reasoning,
        "risk_factors": risk_factors,
        "asa_class": asa_class
    }


def evaluate_cataract(v):
    """
    Cataract Surgery Evaluation (Low-Risk Ocular Surgery)
    Reference: American Academy of Ophthalmology, ASA Low-Risk Surgery Guidelines
    """
    risk_factors = []
    clinical_findings = []
    
    # Blood Pressure Assessment
    if v.bp_sys < 100:
        risk_factors.append("Hypotension (SBP <100 mmHg) - risk of intraoperative hypotension")
        clinical_findings.append(f"Systolic BP {v.bp_sys} mmHg is low; risk of syncope")
    elif v.bp_sys >= 160:
        risk_factors.append(f"Elevated BP (SBP {v.bp_sys} mmHg) - increased cardiac workload during surgery")
        clinical_findings.append(f"Systolic BP {v.bp_sys} mmHg is elevated; antihypertensive optimization recommended")
    else:
        clinical_findings.append(f"Blood pressure {v.bp_sys}/{v.bp_dia} mmHg is optimal")
    
    # Oxygen Saturation
    if v.spo2 <= 94:
        risk_factors.append(f"Hypoxemia (SpO2 {v.spo2}%) - contraindication for elective surgery")
        clinical_findings.append("SpO2 below safe threshold; respiratory evaluation needed")
    else:
        clinical_findings.append(f"Oxygen saturation {v.spo2}% is excellent")
    
    # Blood Glucose
    if v.blood_sugar > 250:
        risk_factors.append(f"Hyperglycemia (Glucose {v.blood_sugar} mg/dL) - increased surgical site infection risk")
        clinical_findings.append("Uncontrolled diabetes detected; perioperative glucose management essential")
    elif v.blood_sugar < 70:
        risk_factors.append(f"Hypoglycemia (Glucose {v.blood_sugar} mg/dL) - risk of perioperative complications")
        clinical_findings.append("Low blood glucose detected; administer glucose before surgery")
    else:
        clinical_findings.append(f"Blood glucose {v.blood_sugar} mg/dL is within safe range")
    
    # Heart Rate
    hr_assessment = analyze_heart_rate(v.heart_rate)
    clinical_findings.append(hr_assessment["finding"])
    if hr_assessment["concern"]:
        risk_factors.append(hr_assessment["concern"])
    
    # Hemoglobin
    hb_assessment = analyze_hemoglobin(v.hemoglobin, "routine")
    clinical_findings.append(hb_assessment["finding"])
    if hb_assessment["concern"]:
        risk_factors.append(hb_assessment["concern"])
    
    # Temperature
    if v.temperature >= 38.5:
        risk_factors.append(f"Fever (Temp {v.temperature}°C) - postpone elective surgery")
        clinical_findings.append("Fever present; infection evaluation required before surgery")
    else:
        clinical_findings.append(f"Core temperature {v.temperature}°C is normal")
    
    # Determine status
    bp_clear = v.bp_sys >= 100 and v.bp_sys < 160
    glucose_clear = v.blood_sugar < 250 and v.blood_sugar > 70
    spo2_clear = v.spo2 > 94
    temp_clear = v.temperature < 38.5
    
    if bp_clear and glucose_clear and spo2_clear and temp_clear and len(risk_factors) == 0:
        status = "READY"
        asa_class = "I"
    elif len(risk_factors) <= 1:
        status = "DELAY"
        asa_class = "II"
    else:
        status = "NOT READY"
        asa_class = "III-IV"
    
    # Prepare vitals summary for AI
    vitals_summary = f"""
BP: {v.bp_sys}/{v.bp_dia} mmHg
HR: {v.heart_rate} bpm
SpO2: {v.spo2}%
Temperature: {v.temperature}°C
Hemoglobin: {v.hemoglobin} g/dL
Blood Glucose: {v.blood_sugar} mg/dL
    """
    
    # Generate reasoning via AI
    reasoning = generate_clinical_reasoning(
        vitals_summary=vitals_summary,
        status=status,
        risk_factors=risk_factors,
        clinical_findings=clinical_findings,
        surgery_type="cataract",
        asa_class=asa_class
    )
    
    return {
        "status": status,
        "reasoning": reasoning,
        "risk_factors": risk_factors,
        "asa_class": asa_class
    }


def evaluate_cabg(v):
    """
    CABG (Coronary Artery Bypass Graft) Evaluation - HIGH RISK CARDIAC SURGERY
    Reference: ACC/AHA Perioperative Guidelines, ESC Cardiac Risk Stratification,
    ACS Risk Calculator, Society of Thoracic Surgeons (STS) Risk Models
    """
    risk_factors = []
    clinical_findings = []
    
    # Hemoglobin Assessment - CRITICAL for cardiac surgery
    hb_acceptable = v.hemoglobin >= 10
    if v.hemoglobin < 8:
        risk_factors.append(f"Severe Anemia (Hb {v.hemoglobin} g/dL) - SIGNIFICANTLY increases mortality, requires transfusion")
        clinical_findings.append(f"Hemoglobin {v.hemoglobin} g/dL is critically low; transfusion + investigation needed")
    elif v.hemoglobin < 10:
        risk_factors.append(f"Moderate Anemia (Hb {v.hemoglobin} g/dL) - increases perioperative complications")
        clinical_findings.append(f"Hemoglobin {v.hemoglobin} g/dL is below guideline threshold (≥10 g/dL)")
    else:
        clinical_findings.append(f"Hemoglobin {v.hemoglobin} g/dL meets minimum requirement for cardiac surgery")
    
    # Oxygen Saturation - CRITICAL for cardiac/pulmonary reserve
    spo2_acceptable = v.spo2 > 95
    if v.spo2 <= 94:
        risk_factors.append(f"Hypoxemia (SpO2 {v.spo2}%) - indicates pulmonary disease, major cardiac risk")
        clinical_findings.append(f"SpO2 {v.spo2}% suggests respiratory compromise; pulmonary evaluation URGENT")
    else:
        clinical_findings.append(f"Oxygen saturation {v.spo2}% is acceptable")
    
    # Blood Pressure Assessment
    if v.bp_sys < 90:
        risk_factors.append(f"Hypotension (SBP {v.bp_sys} mmHg) - cardiogenic shock/decompensated heart failure")
        clinical_findings.append(f"SBP {v.bp_sys} mmHg indicates hemodynamic instability; ICU-level care needed")
    elif v.bp_sys > 160:
        risk_factors.append(f"Hypertension (SBP {v.bp_sys} mmHg) - inadequate blood pressure control")
        clinical_findings.append(f"SBP {v.bp_sys} mmHg is elevated; antihypertensive optimization required")
    else:
        clinical_findings.append(f"Blood pressure {v.bp_sys}/{v.bp_dia} mmHg is within surgical limits")
    
    # Heart Rate Assessment
    hr_assessment = analyze_heart_rate(v.heart_rate)
    clinical_findings.append(hr_assessment["finding"])
    if hr_assessment["concern"]:
        risk_factors.append(hr_assessment["concern"])
    
    # Temperature
    if v.temperature >= 38.5:
        risk_factors.append(f"Fever (Temp {v.temperature}°C) - contraindication for elective cardiac surgery")
        clinical_findings.append("Fever present; postpone elective surgery and investigate source")
    else:
        clinical_findings.append(f"Core temperature {v.temperature}°C is normal")
    
    # Blood Glucose
    if v.blood_sugar > 300:
        risk_factors.append(f"Severe Hyperglycemia ({v.blood_sugar} mg/dL) - major risk factor for cardiac mortality")
        clinical_findings.append("Severe hyperglycemia; urgent endocrine/ICU consultation needed")
    elif v.blood_sugar > 200:
        risk_factors.append(f"Hyperglycemia ({v.blood_sugar} mg/dL) - independent predictor of worse outcomes in cardiac surgery")
        clinical_findings.append("Elevated glucose; perioperative glucose management critical")
    else:
        clinical_findings.append(f"Blood glucose {v.blood_sugar} mg/dL is acceptable")
    
    # Determine status
    meets_critical_thresholds = hb_acceptable and spo2_acceptable and v.bp_sys >= 90 and v.bp_sys <= 160 and v.temperature < 38.5
    
    if meets_critical_thresholds and len(risk_factors) == 0:
        status = "HIGH RISK"  # Always high risk for CABG
        asa_class = "III-IV (even with optimized vitals)"
    elif len(risk_factors) <= 2 and hb_acceptable and spo2_acceptable:
        status = "HIGH RISK"
        asa_class = "IV"
    else:
        status = "NOT READY"
        asa_class = "V"
    
    # Prepare vitals summary for AI
    vitals_summary = f"""
BP: {v.bp_sys}/{v.bp_dia} mmHg
HR: {v.heart_rate} bpm
SpO2: {v.spo2}%
Temperature: {v.temperature}°C
Hemoglobin: {v.hemoglobin} g/dL
Blood Glucose: {v.blood_sugar} mg/dL
    """
    
    # Generate reasoning via AI
    reasoning = generate_clinical_reasoning(
        vitals_summary=vitals_summary,
        status=status,
        risk_factors=risk_factors,
        clinical_findings=clinical_findings,
        surgery_type="cabg",
        asa_class=asa_class
    )
    
    return {
        "status": status,
        "reasoning": reasoning,
        "risk_factors": risk_factors,
        "asa_class": asa_class
    }


def analyze_heart_rate(hr):
    """Analyze heart rate within context"""
    if hr < 50:
        return {
            "finding": f"Heart rate {hr} bpm - bradycardia detected",
            "concern": "Severe Bradycardia (<50 bpm) - increased risk of hypotension and arrhythmias"
        }
    elif hr < 60:
        return {
            "finding": f"Heart rate {hr} bpm - mild bradycardia",
            "concern": None
        }
    elif hr < 100:
        return {
            "finding": f"Heart rate {hr} bpm is within normal range",
            "concern": None
        }
    elif hr < 120:
        return {
            "finding": f"Heart rate {hr} bpm - mild tachycardia",
            "concern": "Mild Tachycardia (100-120 bpm) - may indicate pain, anxiety, or hypovolemia"
        }
    else:
        return {
            "finding": f"Heart rate {hr} bpm - significant tachycardia",
            "concern": f"Significant Tachycardia (>120 bpm) - investigate for sepsis, hypovolemia, or cardiac pathology"
        }


def analyze_hemoglobin(hb, context="routine"):
    """Analyze hemoglobin based on surgical context"""
    if context == "emergency":
        threshold = 7
        routine_threshold = 8
    elif context == "cardiac":
        threshold = 10
        routine_threshold = 10
    else:  # routine
        threshold = 8
        routine_threshold = 9
    
    if hb < threshold:
        return {
            "finding": f"Hemoglobin {hb} g/dL is critically low",
            "concern": f"Critical Anemia (Hb <{threshold} g/dL) - requires urgent transfusion evaluation"
        }
    elif hb < routine_threshold:
        return {
            "finding": f"Hemoglobin {hb} g/dL is low",
            "concern": f"Mild Anemia (Hb {hb} g/dL) - consider impact on surgical outcomes"
        }
    else:
        return {
            "finding": f"Hemoglobin {hb} g/dL is acceptable",
            "concern": None
        }


def analyze_glucose(glucose):
    """Analyze blood glucose"""
    if glucose < 60:
        return {
            "finding": f"Blood glucose {glucose} mg/dL is dangerously low",
            "concern": "Severe Hypoglycemia (<60 mg/dL) - risk of seizure, CV collapse, death"
        }
    elif glucose < 70:
        return {
            "finding": f"Blood glucose {glucose} mg/dL is low",
            "concern": "Hypoglycemia (<70 mg/dL) - administer dextrose immediately"
        }
    elif glucose < 140:
        return {
            "finding": f"Blood glucose {glucose} mg/dL is optimal",
            "concern": None
        }
    elif glucose < 180:
        return {
            "finding": f"Blood glucose {glucose} mg/dL is elevated but acceptable",
            "concern": None
        }
    elif glucose < 200:
        return {
            "finding": f"Blood glucose {glucose} mg/dL is elevated",
            "concern": "Hyperglycemia (180-200 mg/dL) - increases infection risk"
        }
    elif glucose < 250:
        return {
            "finding": f"Blood glucose {glucose} mg/dL is significantly elevated",
            "concern": f"Significant Hyperglycemia ({glucose} mg/dL) - major infection and cardiac risk"
        }
    else:
        return {
            "finding": f"Blood glucose {glucose} mg/dL is dangerously elevated",
            "concern": f"Severe Hyperglycemia (>{glucose} mg/dL) - emergency management required"
        }
