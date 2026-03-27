# backend/models.py  (updated — add IntakeRecord)
#
# Changes from original:
#   • Added IntakeRecord model to store full intake + agent audit report
#   • Added age, gender, icd10_code, cpt_code, payer_id to PatientProfile
#   • All existing models unchanged

from sqlalchemy import Column, Integer, String, ForeignKey, Text
from sqlalchemy.orm import relationship
from database import Base


class User(Base):
    __tablename__ = "users"

    id        = Column(Integer, primary_key=True)
    email     = Column(String, unique=True, index=True)
    password  = Column(String, nullable=True)
    google_id = Column(String, nullable=True)

    records  = relationship("MedicalRecord", back_populates="owner")
    profile  = relationship("PatientProfile", back_populates="user", uselist=False)
    intakes  = relationship("IntakeRecord", back_populates="user")
    discharge_summaries = relationship("DischargeSummary", back_populates="user")


class MedicalRecord(Base):
    __tablename__ = "records"

    id      = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    content = Column(Text)

    owner = relationship("User", back_populates="records")


class PatientProfile(Base):
    __tablename__ = "patient_profiles"

    id        = Column(Integer, primary_key=True, index=True)
    user_id   = Column(Integer, ForeignKey("users.id"))

    patient_name  = Column(String)
    surgery_type  = Column(String)
    surgery_date  = Column(String)

    # New fields added for healthcare agent alignment
    age           = Column(Integer,  nullable=True)
    gender        = Column(String,   nullable=True)
    surgery_phase = Column(String,   nullable=True, default="post")  # "pre" | "post"
    icd10_code    = Column(String,   nullable=True)
    cpt_code      = Column(String,   nullable=True)
    payer_id      = Column(String,   nullable=True)

    recovery_days_total = Column(Integer, default=90)

    user = relationship("User", back_populates="profile")


class RecoveryTask(Base):
    __tablename__ = "recovery_tasks"

    id          = Column(Integer, primary_key=True, index=True)
    user_id     = Column(Integer, ForeignKey("users.id"))

    title       = Column(String)
    time        = Column(String)
    status      = Column(String, default="pending")
    task_date   = Column(String, nullable=True)   # YYYY-MM-DD — which day this task belongs to
    is_critical = Column(Integer, default=0)       # 1 = critical, triggers 2hr notification


class IntakeRecord(Base):
    """
    Stores the full intake form data and the AI agent's audit report
    for every submission. This provides the auditable reasoning trail
    required by the healthcare operations agent problem statement.
    """
    __tablename__ = "intake_records"

    id          = Column(Integer, primary_key=True, index=True)
    user_id     = Column(Integer, ForeignKey("users.id"))
    intake_json = Column(Text)   # JSON: all intake form fields
    report_json = Column(Text)   # JSON: full agent audit report
    created_at  = Column(String)

    user = relationship("User", back_populates="intakes")


class DischargeSummary(Base):
    """
    Stores the full structured extraction from /api/scan.
    One row per PDF scan — holds all patient, surgery, and vitals fields.
    """
    __tablename__ = "discharge_summaries"

    id             = Column(Integer, primary_key=True, index=True)
    user_id        = Column(Integer, ForeignKey("users.id"))

    patient_name   = Column(String,  nullable=True)
    age            = Column(Integer, nullable=True)
    gender         = Column(String,  nullable=True)
    surgery_type   = Column(String,  nullable=True)
    surgery_date   = Column(String,  nullable=True)
    surgery_phase  = Column(String,  nullable=True, default="post")
    icd10_code     = Column(String,  nullable=True)
    cpt_code       = Column(String,  nullable=True)

    # Vitals
    bp_sys         = Column(Integer, nullable=True)
    bp_dia         = Column(Integer, nullable=True)
    heart_rate     = Column(Integer, nullable=True)
    spo2           = Column(Integer, nullable=True)
    temperature    = Column(String,  nullable=True)
    hemoglobin     = Column(String,  nullable=True)
    blood_sugar    = Column(Integer, nullable=True)

    created_at     = Column(String,  nullable=True)

    user      = relationship("User", back_populates="discharge_summaries")
    medicines = relationship("Medicine", back_populates="summary")


class Medicine(Base):
    """
    Individual medication row extracted from a discharge summary.
    Tracks inventory: total_quantity, current_quantity, dose_amount.
    """
    __tablename__ = "medicines"

    id               = Column(Integer, primary_key=True, index=True)
    summary_id       = Column(Integer, ForeignKey("discharge_summaries.id"))
    user_id          = Column(Integer, ForeignKey("users.id"))

    name             = Column(String,  nullable=False)
    dosage           = Column(String,  nullable=True)
    frequency        = Column(String,  nullable=True)

    total_quantity   = Column(Integer, nullable=True)
    current_quantity = Column(Integer, nullable=True)
    dose_amount      = Column(Integer, nullable=True, default=1)

    summary = relationship("DischargeSummary", back_populates="medicines")
    logs    = relationship("MedicationLog", back_populates="medicine")


class MedicationLog(Base):
    """
    Audit trail for every dose deduction or inventory change.
    """
    __tablename__ = "medication_logs"

    id              = Column(Integer, primary_key=True, index=True)
    medicine_id     = Column(Integer, ForeignKey("medicines.id"))
    user_id         = Column(Integer, ForeignKey("users.id"))

    action          = Column(String,  nullable=False)   # "deducted", "restocked", etc.
    quantity_change = Column(Integer, nullable=False)
    remaining       = Column(Integer, nullable=False)
    timestamp       = Column(String,  nullable=False)

    medicine = relationship("Medicine", back_populates="logs")
