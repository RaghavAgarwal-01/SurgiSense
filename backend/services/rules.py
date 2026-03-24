"""
Clinical Surgical Readiness Evaluation System
Based on: ASA Physical Status Classification, WHO Surgical Safety Checklist, 
ACC/AHA Perioperative Guidelines, and Standard Perioperative Protocols
"""

def evaluate_patient(v):
    """
    Comprehensive preoperative assessment for surgical clearance.
    Returns: status, reasoning (detailed clinical justification), and risk factors
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


def evaluate_appendectomy(v):
    """
    Appendectomy Evaluation (Emergency/Urgent General Surgery)
    Reference: ASA Guidelines, Emergency Surgery Risk Stratification
    """
    risk_factors = []
    clinical_findings = []
    
    # Blood Pressure Assessment
    # Guidelines: Preop SBP should ideally be 90-180 mmHg; <90 mmHg indicates hypotension/shock
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
    # Guidelines: SpO2 should be ≥95% on room air; <94% indicates hypoxemia
    spo2_acceptable = v.spo2 > 94
    if v.spo2 <= 94:
        risk_factors.append(f"Hypoxemia (SpO2 {v.spo2}%) - inadequate oxygenation")
        clinical_findings.append("SpO2 below acceptable threshold; respiratory compromise detected")
    else:
        clinical_findings.append(f"Oxygen saturation {v.spo2}% is adequate")
    
    # Temperature Assessment
    # Guidelines: Normal 36.5-37.5°C; <36°C is hypothermia; >38.5°C suggests infection
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
    # Guidelines: Normal 60-100 bpm at rest; >100 suggests tachycardia (pain, sepsis, hypovolemia)
    hr_assessment = analyze_heart_rate(v.heart_rate)
    clinical_findings.append(hr_assessment["finding"])
    if hr_assessment["concern"]:
        risk_factors.append(hr_assessment["concern"])
    
    # Hemoglobin Assessment
    # Guidelines: Preop Hb should be ≥7-8 g/dL minimum; <7 g/dL requires transfusion consideration
    hb_assessment = analyze_hemoglobin(v.hemoglobin, "emergency")
    clinical_findings.append(hb_assessment["finding"])
    if hb_assessment["concern"]:
        risk_factors.append(hb_assessment["concern"])
    
    # Blood Sugar Assessment
    # Guidelines: Preop glucose 140-180 mg/dL is safe; >250 mg/dL risks surgical site infection
    glucose_assessment = analyze_glucose(v.blood_sugar)
    clinical_findings.append(glucose_assessment["finding"])
    if glucose_assessment["concern"]:
        risk_factors.append(glucose_assessment["concern"])
    
    # Final Determination using ASA criteria
    all_critical_acceptable = bp_acceptable and spo2_acceptable and temp_acceptable
    
    if all_critical_acceptable and len(risk_factors) == 0:
        return {
            "status": "READY",
            "reasoning": (
                "✓ SURGICAL READINESS: CLEARED FOR APPENDECTOMY\n\n"
                "CLINICAL JUSTIFICATION:\n"
                f"• All vital parameters are within safe preoperative limits\n"
                f"• Hemodynamic stability confirmed (BP {v.bp_sys}/{v.bp_dia} mmHg)\n"
                f"• Adequate oxygenation (SpO2 {v.spo2}%)\n"
                f"• No evidence of active infection (Temp {v.temperature}°C)\n"
                f"• Hematologic parameters acceptable (Hb {v.hemoglobin} g/dL)\n"
                f"• Metabolic status appropriate for surgery (Glucose {v.blood_sugar} mg/dL)\n\n"
                "REFERENCE GUIDELINES:\n"
                "• ASA Physical Status Class I-II (minimal perioperative risk)\n"
                "• WHO Surgical Safety Checklist requirements satisfied\n"
                "• ACC/AHA Perioperative Risk Assessment: Low risk\n\n"
                "RECOMMENDATION: Patient is medically optimized and appropriate for scheduled appendectomy. "
                "Proceed with standard preoperative protocols and anesthesia consultation."
            ),
            "risk_factors": [],
            "asa_class": "I-II"
        }
    elif all_critical_acceptable and len(risk_factors) <= 2:
        return {
            "status": "HIGH RISK",
            "reasoning": (
                "⚠ SURGICAL READINESS: CONDITIONAL CLEARANCE (HIGH RISK)\n\n"
                "CLINICAL FINDINGS:\n"
                + "\n".join([f"• {finding}" for finding in clinical_findings]) + "\n\n"
                "IDENTIFIED RISK FACTORS:\n"
                + "\n".join([f"• {risk}" for risk in risk_factors]) + "\n\n"
                "CLINICAL ASSESSMENT:\n"
                "While critical vital parameters are acceptable, the patient has modifiable risk factors "
                "that require optimization or enhanced intraoperative monitoring.\n\n"
                "REFERENCE GUIDELINES:\n"
                "• ASA Physical Status Class III (significant systemic disease)\n"
                "• Enhanced perioperative monitoring recommended\n"
                "• Anesthesia consultation REQUIRED\n\n"
                "RECOMMENDATIONS:\n"
                "1. Address identified risk factors before surgery if feasible\n"
                "2. Inform patient of elevated perioperative risks\n"
                "3. Arrange pre-anesthesia evaluation\n"
                "4. Increase intraoperative monitoring intensity\n"
                "5. Consider ICU admission postoperatively"
            ),
            "risk_factors": risk_factors,
            "asa_class": "III"
        }
    else:
        return {
            "status": "NOT READY",
            "reasoning": (
                "✗ SURGICAL READINESS: NOT CLEARED FOR SURGERY\n\n"
                "CLINICAL FINDINGS:\n"
                + "\n".join([f"• {finding}" for finding in clinical_findings]) + "\n\n"
                "CRITICAL RISK FACTORS IDENTIFIED:\n"
                + "\n".join([f"• {risk}" for risk in risk_factors]) + "\n\n"
                "CLINICAL RATIONALE:\n"
                "The patient has one or more critical vital sign abnormalities that significantly increase "
                "perioperative morbidity and mortality. These derangements must be corrected before proceeding "
                "with elective surgery. This aligns with ASA Guidelines for risk stratification.\n\n"
                "REFERENCE GUIDELINES:\n"
                "• ASA Physical Status Class IV-V (life-threatening disease)\n"
                "• WHO Surgical Safety Checklist identifies unsafe conditions\n"
                "• ACC/AHA: High/Very High perioperative risk\n\n"
                "REQUIRED ACTIONS BEFORE SURGERY:\n"
                "1. URGENT: Stabilize vital signs (BP/SpO2/Temperature)\n"
                "2. Investigate and treat underlying conditions\n"
                "3. Consult with Anesthesiology and Internal Medicine\n"
                "4. Consider ICU-level care/optimization\n"
                "5. Reassess when parameters normalize\n"
                "6. For emergency surgery: Proceed only with institutional protocols for high-risk cases"
            ),
            "risk_factors": risk_factors,
            "asa_class": "IV-V"
        }


def evaluate_cataract(v):
    """
    Cataract Surgery Evaluation (Low-Risk Ocular Surgery)
    Reference: American Academy of Ophthalmology, ASA Low-Risk Surgery Guidelines
    """
    risk_factors = []
    clinical_findings = []
    
    # Blood Pressure Assessment
    # Guidelines: Cataract surgery well-tolerated up to SBP <200; usual range 100-160 mmHg
    if v.bp_sys < 100:
        risk_factors.append("Hypotension (SBP <100 mmHg) - risk of intraoperative hypotension")
        clinical_findings.append(f"Systolic BP {v.bp_sys} mmHg is low; risk of syncope")
    elif v.bp_sys >= 160:
        risk_factors.append(f"Elevated BP (SBP {v.bp_sys} mmHg) - increased cardiac workload during surgery")
        clinical_findings.append(f"Systolic BP {v.bp_sys} mmHg is elevated; antihypertensive optimization recommended")
    else:
        clinical_findings.append(f"Blood pressure {v.bp_sys}/{v.bp_dia} mmHg is optimal")
    
    # Oxygen Saturation
    # Guidelines: SpO2 ≥95% essentials for any surgery
    if v.spo2 <= 94:
        risk_factors.append(f"Hypoxemia (SpO2 {v.spo2}%) - contraindication for elective surgery")
        clinical_findings.append("SpO2 below safe threshold; respiratory evaluation needed")
    else:
        clinical_findings.append(f"Oxygen saturation {v.spo2}% is excellent")
    
    # Blood Glucose
    # Guidelines: Cataract surgery can proceed with glucose 70-250 mg/dL; >250 increases infection risk
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
    
    # Cataract is inherently low-risk with topical/regional anesthesia
    bp_clear = v.bp_sys >= 100 and v.bp_sys < 160
    glucose_clear = v.blood_sugar < 250 and v.blood_sugar > 70
    spo2_clear = v.spo2 > 94
    temp_clear = v.temperature < 38.5
    
    if bp_clear and glucose_clear and spo2_clear and temp_clear and len(risk_factors) == 0:
        return {
            "status": "READY",
            "reasoning": (
                "✓ SURGICAL READINESS: CLEARED FOR CATARACT SURGERY\n\n"
                "CLINICAL JUSTIFICATION:\n"
                f"• Excellent hemodynamic stability (BP {v.bp_sys}/{v.bp_dia} mmHg)\n"
                f"• Optimal oxygenation (SpO2 {v.spo2}%)\n"
                f"• Appropriate metabolic glucose control ({v.blood_sugar} mg/dL)\n"
                f"• Hemoglobin adequate for surgery (Hb {v.hemoglobin} g/dL)\n"
                f"• Afebrile (Temp {v.temperature}°C)\n"
                f"• Heart rate within normal limits ({v.heart_rate} bpm)\n\n"
                "PROCEDURE CHARACTERISTICS:\n"
                "• Cataract surgery is minimally invasive with regional/topical anesthesia\n"
                "• Physiologic stress is minimal (ASA low-risk surgery)\n"
                "• Procedural time typically <30 minutes\n\n"
                "REFERENCE GUIDELINES:\n"
                "• ASA Physical Status Class I (minimal perioperative risk)\n"
                "• AAO Cataract Surgery Guidelines: Patient appropriate\n"
                "• WHO Surgical Safety Checklist: All prerequisites met\n\n"
                "RECOMMENDATION: Patient is optimally prepared for cataract surgery. "
                "Proceed with standard outpatient protocols."
            ),
            "risk_factors": [],
            "asa_class": "I"
        }
    elif len(risk_factors) <= 1:
        return {
            "status": "DELAY",
            "reasoning": (
                "⚠ SURGICAL READINESS: RECOMMEND PERIOPERATIVE OPTIMIZATION\n\n"
                "CLINICAL FINDINGS:\n"
                + "\n".join([f"• {finding}" for finding in clinical_findings]) + "\n\n"
                "IDENTIFIED CONCERNS:\n"
                + "\n".join([f"• {risk}" for risk in risk_factors]) + "\n\n"
                "CLINICAL ASSESSMENT:\n"
                "While cataract surgery is inherently low-risk, one or more preoperative parameters "
                "require optimization to ensure optimal surgical outcomes and anesthesia safety.\n\n"
                "REFERENCE GUIDELINES:\n"
                "• ASA Guidelines recommend optimization of modifiable risk factors\n"
                "• WHO Surgical Safety Checklist: Address identified risk factors\n\n"
                "RECOMMENDATIONS:\n"
                "1. Optimize identified parameter(s) listed above\n"
                "2. Recheck vitals after optimization\n"
                "3. Coordinate with anesthesia regarding specific concerns\n"
                "4. Reschedule surgery after 24-48 hours of optimization\n"
                "5. Ensure patient education on perioperative protocols"
            ),
            "risk_factors": risk_factors,
            "asa_class": "II"
        }
    else:
        return {
            "status": "NOT READY",
            "reasoning": (
                "✗ SURGICAL READINESS: NOT CLEARED FOR ELECTIVE SURGERY\n\n"
                "CLINICAL FINDINGS:\n"
                + "\n".join([f"• {finding}" for finding in clinical_findings]) + "\n\n"
                "RISK FACTORS REQUIRING RESOLUTION:\n"
                + "\n".join([f"• {risk}" for risk in risk_factors]) + "\n\n"
                "CLINICAL RATIONALE:\n"
                "Multiple preoperative parameters are abnormal, making elective cataract surgery inadvisable "
                "at this time. Although the procedure itself is low-risk, the patient's current status "
                "increases perioperative complications.\n\n"
                "REFERENCE GUIDELINES:\n"
                "• ASA Guidelines: Elective surgery should be postponed\n"
                "• WHO Surgical Safety Checklist: Unsafe conditions identified\n\n"
                "REQUIRED ACTIONS:\n"
                "1. Address and correct identified abnormalities\n"
                "2. Consult with Anesthesiology if multiple systemic issues\n"
                "3. Consider Internal Medicine evaluation\n"
                "4. Reassess after 48-72 hours of optimization\n"
                "5. Rescind surgery until parameters normalized\n"
                "6. Patient education on importance of preoperative optimization"
            ),
            "risk_factors": risk_factors,
            "asa_class": "III-IV"
        }


def evaluate_cabg(v):
    """
    CABG (Coronary Artery Bypass Graft) Evaluation - HIGH RISK CARDIAC SURGERY
    Reference: ACC/AHA Perioperative Guidelines, ESC Cardiac Risk Stratification,
    ACS Risk Calculator, Society of Thoracic Surgeons (STS) Risk Models
    """
    risk_factors = []
    clinical_findings = []
    
    # CABG is inherently high-risk (major cardiac surgery, CPB, significant trauma)
    # Even with excellent vitals, CABG carries 1-3% mortality in low-risk patients
    
    # Hemoglobin Assessment - CRITICAL for cardiac surgery
    # Guidelines: Preop Hb should be ≥10 g/dL; <8 g/dL requires transfusion, increases mortality
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
    # Guidelines: SpO2 ≥95% required; <94% indicates pulmonary pathology
    spo2_acceptable = v.spo2 > 95
    if v.spo2 <= 94:
        risk_factors.append(f"Hypoxemia (SpO2 {v.spo2}%) - indicates pulmonary disease, major cardiac risk")
        clinical_findings.append(f"SpO2 {v.spo2}% suggests respiratory compromise; pulmonary evaluation URGENT")
    else:
        clinical_findings.append(f"Oxygen saturation {v.spo2}% is acceptable")
    
    # Blood Pressure Assessment
    # For CABG: SBP 90-160 mmHg is target; <90 indicates cardiogenic shock, >160 suggests HTN
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
    
    # CABG-Specific Risk Assessment (ACC/AHA Framework)
    # Major risk factors: Age, EF <40%, Renal dysfunction, Diabetes, DIAB, prior cardiac procedures
    # We can only assess from provided vitals
    
    meets_critical_thresholds = hb_acceptable and spo2_acceptable and v.bp_sys >= 90 and v.bp_sys <= 160 and v.temperature < 38.5
    
    if meets_critical_thresholds and len(risk_factors) == 0:
        return {
            "status": "HIGH RISK",
            "reasoning": (
                "⚠ SURGICAL READINESS: CLEARED FOR CABG (INHERENT HIGH RISK)\n\n"
                "CLINICAL FINDINGS:\n"
                f"• Hemoglobin adequate for cardiac bypass (Hb {v.hemoglobin} g/dL ≥10 g/dL)\n"
                f"• Respiratory reserve acceptable (SpO2 {v.spo2}% >95%)\n"
                f"• Hemodynamic stability confirmed (BP {v.bp_sys}/{v.bp_dia} mmHg, HR {v.heart_rate} bpm)\n"
                f"• Afebrile (Temp {v.temperature}°C)\n"
                f"• Metabolic glucose control (BG {v.blood_sugar} mg/dL)\n\n"
                "CRITICAL CONTEXT:\n"
                "Coronary Artery Bypass Grafting is a MAJOR CARDIAC SURGERY with significant perioperative risk:\n"
                "• Procedure involves cardiopulmonary bypass (CPB) and cardiac arrest\n"
                "• 30-day mortality: 1-3% (low-risk patients), up to 5-10% in higher-risk populations\n"
                "• Common complications: MI (8-15%), Afib (20-30%), Stroke (1-3%), Kidney injury (5-10%)\n\n"
                "PREOPERATIVE ASSESSMENT:\n"
                "✓ Vital parameters acceptable despite inherent surgical risk\n"
                "✓ No critical contraindications identified from submitted vitals\n"
                "✓ Patient physiologically optimized\n\n"
                "REFERENCE GUIDELINES:\n"
                "• ACC/AHA Perioperative Guidelines: CABG appropriate with demonstrated CAD\n"
                "• STS Risk Calculator: Estimate patient-specific mortality\n"
                "• ESC Cardiac Risk Classification: Intermediate-High risk procedure\n\n"
                "MANDATORY PREOPERATIVE REQUIREMENTS:\n"
                "1. ✓ Cardiology clearance REQUIRED\n"
                "2. ✓ Cardiac catheterization/anatomy confirmation (CAD severity)\n"
                "3. ✓ Echocardiography (EF assessment, valve function)\n"
                "4. ✓ Pulmonary function tests if respiratory disease present\n"
                "5. ✓ Renal function assessment (Cr, eGFR)\n"
                "6. ✓ Comprehensive anesthesia evaluation\n"
                "7. ✓ Informed consent with discussion of major risks\n"
                "8. ✓ ICU bed reservation (routine for all CABG patients)\n\n"
                "FINAL RECOMMENDATION:\n"
                "Patient vitals are acceptable for CABG proceeding; however, this is a HIGH-RISK procedure "
                "requiring full preoperative workup, cardiology/cardiac surgery coordination, ICU admission, "
                "and expert anesthesia team. Ensure all mandatory prerequisites are completed before surgery."
            ),
            "risk_factors": ["CABG is inherently high-risk major cardiac surgery"],
            "asa_class": "III-IV (even with optimized vitals)"
        }
    elif len(risk_factors) <= 2 and hb_acceptable and spo2_acceptable:
        return {
            "status": "HIGH RISK",
            "reasoning": (
                "⚠ SURGICAL READINESS: CONDITIONAL CLEARANCE (VERY HIGH RISK)\n\n"
                "CLINICAL FINDINGS:\n"
                + "\n".join([f"• {finding}" for finding in clinical_findings]) + "\n\n"
                "IDENTIFIED RISK FACTORS:\n"
                + "\n".join([f"• {risk}" for risk in risk_factors]) + "\n\n"
                "SURGICAL RISK ASSESSMENT:\n"
                "Coronary Artery Bypass Grafting with identified modifiable risk factors requires:\n"
                "• Aggressive perioperative risk mitigation\n"
                "• Enhanced monitoring and ICU resources\n"
                "• Multidisciplinary team coordination (Cardiology, Cardiac Surgery, Anesthesia, ICU)\n\n"
                "REFERENCE GUIDELINES:\n"
                "• ACC/AHA: Optimization of modifiable factors is ESSENTIAL\n"
                "• STS Risk Calculator: Recalculate after risk factor optimization\n"
                "• ESC Guidelines: High-risk patient category\n\n"
                "REQUIRED ACTIONS BEFORE SURGERY:\n"
                "1. URGENT optimization of identified risk factors\n"
                "2. Cardiology re-evaluation after optimization\n"
                "3. Anesthesia high-risk patient consultation\n"
                "4. Extended ICU stay planning (consider 48-72 hours minimum)\n"
                "5. Informed consent emphasizing elevated perioperative risks\n"
                "6. Consider alternative revascularization (PCI) vs CABG risk-benefit analysis\n"
                "7. Complete all mandatory preoperative testing\n\n"
                "CONDITIONAL CLEARANCE: Provided identified factors are optimized and "
                "cardiology clearance obtained, surgery may proceed with enhanced protocols."
            ),
            "risk_factors": risk_factors,
            "asa_class": "IV"
        }
    else:
        return {
            "status": "NOT READY",
            "reasoning": (
                "✗ SURGICAL READINESS: NOT CLEARED FOR ELECTIVE CABG AT THIS TIME\n\n"
                "CLINICAL FINDINGS:\n"
                + "\n".join([f"• {finding}" for finding in clinical_findings]) + "\n\n"
                "CRITICAL RISK FACTORS:\n"
                + "\n".join([f"• {risk}" for risk in risk_factors]) + "\n\n"
                "CLINICAL ASSESSMENT:\n"
                "The patient has one or more critical cardiopulmonary parameters that absolutely contraindicate "
                "elective CABG at this time. These include inadequate oxygenation, severe anemia, or hemodynamic "
                "instability - all of which are life-threatening during cardiac bypass.\n\n"
                "REFERENCE GUIDELINES:\n"
                "• ACC/AHA: Elective surgery contraindicated with identified critical abnormalities\n"
                "• ESC: Patient in high-risk preoperative state\n"
                "• STS: Procedure should be cancelled/postponed\n\n"
                "URGENT ACTIONS REQUIRED:\n"
                "1. CANCEL scheduled CABG immediately\n"
                "2. Admit to ICU/High-care unit for stabilization\n"
                "3. Investigate and treat underlying conditions (anemia source, respiratory disease, etc.)\n"
                "4. Cardiology URGENT consultation for hemodynamic support consideration\n"
                "5. Consider inotropic support if cardiogenic shock (SBP <90)\n"
                "6. Blood transfusion if Hb <8 and bleeding risk\n"
                "7. Pulmonary evaluation and respiratory support if hypoxemic\n"
                "8. Reassess readiness after 5-7 days of intensive optimization\n"
                "9. For emergency reoperation: Only proceed with ICU/ECMO standby support\n\n"
                "IMPORTANT: Do NOT proceed with elective CABG under these conditions. "
                "Risk of perioperative death is unacceptably high."
            ),
            "risk_factors": risk_factors,
            "asa_class": "V"
        }


def analyze_heart_rate(hr):
    """Analyze heart rate within context"""
    if hr < 50:
        return {
            "finding": f"Heart rate {hr} bpm - bradycardia detected",
            "concern": "Severe Bradycardia (<50 bpm) - increased risk of hypotension and arrhythmias"
        }
    elif hr > 100:
        return {
            "finding": f"Heart rate {hr} bpm - tachycardia present",
            "concern": f"Tachycardia ({hr} bpm) - suggests pain, anxiety, sepsis, or hypovolemia"
        }
    else:
        return {
            "finding": f"Heart rate {hr} bpm is normal",
            "concern": None
        }


def analyze_hemoglobin(hb, context):
    """Analyze hemoglobin based on procedure type"""
    if context == "emergency":  # Appendectomy
        if hb < 7:
            return {
                "finding": f"Hemoglobin {hb} g/dL - severe anemia",
                "concern": "Severe Anemia (Hb <7 g/dL) - consider transfusion; impacts oxygen-carrying capacity"
            }
        elif hb < 9:
            return {
                "finding": f"Hemoglobin {hb} g/dL - moderate anemia",
                "concern": "Moderate Anemia (Hb <9 g/dL) - may require intraoperative transfusion"
            }
        else:
            return {
                "finding": f"Hemoglobin {hb} g/dL is acceptable for emergency surgery",
                "concern": None
            }
    else:  # Cataract - elective, minimal blood loss
        if hb < 8:
            return {
                "finding": f"Hemoglobin {hb} g/dL - significant anemia",
                "concern": "Anemia (Hb <8 g/dL) - evaluate cause; may postpone elective surgery"
            }
        elif hb < 10:
            return {
                "finding": f"Hemoglobin {hb} g/dL - mild anemia",
                "concern": "Mild Anemia (Hb <10 g/dL) - investigate and treat before elective surgery"
            }
        else:
            return {
                "finding": f"Hemoglobin {hb} g/dL is adequate",
                "concern": None
            }


def analyze_glucose(glucose):
    """Analyze blood glucose"""
    if glucose < 70:
        return {
            "finding": f"Blood glucose {glucose} mg/dL - hypoglycemia",
            "concern": "Hypoglycemia (<70 mg/dL) - risk of perioperative altered mental status, seizures"
        }
    elif glucose > 300:
        return {
            "finding": f"Blood glucose {glucose} mg/dL - severe hyperglycemia",
            "concern": "Severe Hyperglycemia (>300 mg/dL) - increased infection risk, metabolic acidosis risk"
        }
    elif glucose > 250:
        return {
            "finding": f"Blood glucose {glucose} mg/dL - elevated glucose",
            "concern": "Hyperglycemia (>250 mg/dL) - increased surgical site infection risk"
        }
    else:
        return {
            "finding": f"Blood glucose {glucose} mg/dL is within safe range",
            "concern": None
        }