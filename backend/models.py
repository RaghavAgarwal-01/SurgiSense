from sqlalchemy import Column, Integer, String, ForeignKey, Text
from sqlalchemy.orm import relationship
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    email = Column(String, unique=True)
    password = Column(String)

    records = relationship("MedicalRecord", back_populates="owner")


class MedicalRecord(Base):
    __tablename__ = "records"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    content = Column(Text)

    owner = relationship("User", back_populates="records")
class PatientProfile(Base):
    __tablename__ = "patient_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))

    patient_name = Column(String)
    surgery_type = Column(String)
    surgery_date = Column(String)

    recovery_days_total = Column(Integer, default=90)

    user = relationship("User")

class RecoveryTask(Base):
    __tablename__ = "recovery_tasks"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))

    title = Column(String)
    time = Column(String)

    status = Column(String, default="pending")