from database import SessionLocal
from models import RecoveryTask

db = SessionLocal()

deleted = db.query(RecoveryTask).delete()
db.commit()

print("Deleted tasks:", deleted)