import os
import json
import logging
from pathlib import Path
from dotenv import load_dotenv
from pydantic import BaseModel
from google_auth import router as google_router
from fastapi import FastAPI, UploadFile, File, HTTPException ,Depends
from fastapi.middleware.cors import CORSMiddleware
import fitz  
from groq import Groq
from sqlalchemy.orm import Session
from dependencies import get_current_user, get_db
from models import MedicalRecord, User, PatientProfile, RecoveryTask
from services.rules import evaluate_patient
from services.record_digitization import digitize_discharge_summary
from services.speech_to_text import SpeechToTextService
from services.wound_analysis import WoundAnalysisService
from services.chat import MedicalRAGService
from auth_routes import router as auth_router
from database import Base, engine
from starlette.middleware.sessions import SessionMiddleware
Base.metadata.create_all(bind=engine)


BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ENV_PATH = os.path.join(BASE_DIR, ".env")

print("Loading env from:", ENV_PATH)
load_dotenv(dotenv_path=ENV_PATH)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

rag = MedicalRAGService()

app = FastAPI(title="SurgiSense AI Backend")
app.include_router(auth_router, prefix="/auth")
app.include_router(google_router, prefix="/auth")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
from starlette.middleware.sessions import SessionMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(
    SessionMiddleware,
    secret_key="supersecretkey"
)
GROQ_KEY = os.getenv('GROQ_API_KEY')
if not GROQ_KEY:
    logger.error("GROQ_KEY missing!")
client = Groq(api_key=GROQ_KEY)

speech_service = SpeechToTextService()
vision_service = WoundAnalysisService()

@app.get("/api/profile")
def get_profile(
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):

    profile = db.query(PatientProfile).filter(
        PatientProfile.user_id == user.id
    ).first()

    if not profile:
        return {"profile_exists": False}

    return {
        "profile_exists": True,
        "patient_name": profile.patient_name,
        "surgery_type": profile.surgery_type,
        "surgery_date": profile.surgery_date,
        "recovery_days_total": profile.recovery_days_total
    }
class ProfileCreate(BaseModel):
    patient_name: str
    surgery_type: str
    surgery_date: str
@app.post("/api/create-profile")
def create_profile(
    profile: ProfileCreate,
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):

    existing = db.query(PatientProfile).filter(
        PatientProfile.user_id == user.id
    ).first()

    if existing:
        existing.patient_name = profile.patient_name
        existing.surgery_type = profile.surgery_type
        existing.surgery_date = profile.surgery_date

        db.commit()

        return {"message": "profile updated"}

    new_profile = PatientProfile(
        user_id=user.id,
        patient_name=profile.patient_name,
        surgery_type=profile.surgery_type,
        surgery_date=profile.surgery_date,
        recovery_days_total=90
    )

    db.add(new_profile)
    db.commit()

    return {"message": "profile created"}
@app.post("/api/scan")
async def scan_document(
    file: UploadFile = File(...),
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Digitize medical PDFs/TXTs using Groq Llama/Mistral models."""
    try:
        content = await file.read()
        text_content = ""
        
        if file.content_type == "application/pdf":
            try:
                doc = fitz.open(stream=content, filetype="pdf")
                for page in doc:
                    text_content += str(page.get_text())
                doc.close()
            except Exception as e:
                raise HTTPException(status_code=400, detail="Invalid PDF structure.")
        else:
            try:
                text_content = content.decode('utf-8')
            except UnicodeDecodeError:
                raise HTTPException(status_code=400, detail="Please upload a valid PDF or UTF-8 TXT file.")

        if text_content:
            rag.ingest_document(text_content)
            logger.info("Successfully ingested into RAG via /api/scan")

        chat_completion = client.chat.completions.create(
            messages=[
                {
                    "role": "system",
                    "content": "You are a medical data extractor. Extract into JSON: surgery_type, surgery_date, medication_list (with name, dosage, frequency), and pre_op_restrictions. Output ONLY valid JSON."
                },
                {
                    "role": "user",
                    "content": f"Extract data from this medical text: {text_content}"
                }
            ],
            model="llama-3.3-70b-versatile",
            response_format={"type": "json_object"}
        )
        
        raw_ai_response = chat_completion.choices[0].message.content
        if not raw_ai_response:
            raise HTTPException(status_code=500, detail="AI returned an empty response.")
        
        extracted_data = json.loads(raw_ai_response) 
        record = MedicalRecord(
        user_id=user.id,
        content=json.dumps(extracted_data)
        )

        db.add(record)
        db.commit()

        return {"status": "success", "data": extracted_data}
    except Exception as e:
        logger.error(f"Scan Error: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal processing error.")

@app.post("/api/voice-to-text")
async def process_voice(file: UploadFile = File(...)):
    """SurgiVoice: Multilingual transcription via Sarvam AI."""
    try:
        audio_bytes = await file.read()
        transcript = speech_service.transcribe(audio_bytes)
        return {"transcript": transcript}
    except Exception as e:
        logger.error(f"Voice Error: {str(e)}")
        raise HTTPException(status_code=500, detail="Voice processing failed.")

@app.post("/api/analyze-wound")
async def process_wound(file: UploadFile = File(...)):
    """SurgiVision: Clinical wound assessment via Groq Vision."""
    try:
        image_bytes = await file.read()
        analysis = vision_service.analyze(image_bytes)
        return {"analysis": analysis}
    except Exception as e:
        logger.error(f"Vision Error: {str(e)}")
        raise HTTPException(status_code=500, detail="Image analysis failed.")
    
@app.post("/api/digitize-record")
async def digitize_record(
    file: UploadFile = File(...),
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    file_bytes = await file.read()
    
    # 1. Dashboard UI extraction
    result = digitize_discharge_summary(file_bytes)
    record = MedicalRecord(
    user_id=user.id,
    content=json.dumps(result)
)

    db.add(record)
    db.commit()    
    # 2. THE FIX: Extract text and feed the chatbot's FAISS memory
    try:
        doc = fitz.open(stream=file_bytes, filetype="pdf")
        text_content = ""
        for page in doc:
            text_content += str(page.get_text())
        doc.close()
        
        if text_content.strip():
            rag.ingest_document(text_content)
            logger.info("Successfully ingested into RAG via /api/digitize-record")
    except Exception as e:
        logger.error(f"Failed to ingest for RAG: {e}")

    return {"data": result}
class TaskGenerationRequest(BaseModel):
    document_text: str

@app.post("/api/generate-tasks")
async def generate_tasks(
    request: TaskGenerationRequest,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):

    # ✅ Check if tasks already exist for this user
    existing_tasks = db.query(RecoveryTask).filter(
        RecoveryTask.user_id == user.id
    ).count()

    if existing_tasks > 0:
        return {
            "status": "already_generated",
            "tasks": [
                {
                    "id": t.id,
                    "title": t.title,
                    "time": t.time,
                    "status": t.status
                }
                for t in db.query(RecoveryTask).filter(
                    RecoveryTask.user_id == user.id
                ).all()
            ]
        }

    try:

        prompt = f"""
You are a clinical recovery planner.

Based on the following discharge summary data, generate today's recovery schedule.

Return ONLY JSON in this format:

{{
 "tasks":[
  {{"title":"task name","time":"08:00 AM"}},
  {{"title":"task name","time":"02:00 PM"}}
 ]
}}

Discharge Summary:
{request.document_text}
"""

        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": "You generate structured recovery schedules."},
                {"role": "user", "content": prompt}
            ],
            response_format={"type": "json_object"},
            temperature=0.2
        )

        data = json.loads(response.choices[0].message.content)
        tasks = data.get("tasks", [])

        saved_tasks = []

        for task in tasks:

            db_task = RecoveryTask(
                user_id=user.id,
                title=task.get("title"),
                time=task.get("time"),
                status="pending"
            )

            db.add(db_task)
            db.flush()

            saved_tasks.append({
                "id": db_task.id,
                "title": db_task.title,
                "time": db_task.time,
                "status": db_task.status
            })

        db.commit()

        return {
            "status": "success",
            "tasks": saved_tasks
        }

    except Exception as e:
        print("TASK GENERATION ERROR:", e)
        raise HTTPException(
            status_code=500,
            detail="Task generation failed"
        )
class ChatRequest(BaseModel):
    question: str 

@app.post("/api/chat")
async def chat_with_document(request: ChatRequest):
    """Chat with the uploaded medical document via RAG."""
    try:
        answer = rag.ask_question(request.question)
        return {"status": "success", "answer": answer}
    except Exception as e:
        logger.error(f"Chat Error: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to generate an answer.")

class PatientVitals(BaseModel):
    surgery: str
    bp_sys: int
    bp_dia: int
    heart_rate: int
    spo2: int
    temperature: float
    hemoglobin: float
    blood_sugar: int


@app.post("/api/evaluate")
def evaluate(vitals: PatientVitals):
    result = evaluate_patient(vitals)
    return result


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
@app.get("/api/my-records")
def get_my_records(
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):

    records = db.query(MedicalRecord).filter(
        MedicalRecord.user_id == user.id
    ).all()

    return records
@app.get("/api/my-tasks")
def get_my_tasks(
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):

    tasks = db.query(RecoveryTask).filter(
        RecoveryTask.user_id == user.id
    ).order_by(RecoveryTask.id).all()

    return [
        {
            "id": t.id,
            "title": t.title,
            "time": t.time,
            "status": t.status
        }
        for t in tasks
    ]
@app.patch("/api/task/{task_id}")
def update_task(
    task_id: int,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):

    task = db.query(RecoveryTask).filter(
        RecoveryTask.id == task_id,
        RecoveryTask.user_id == user.id
    ).first()

    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    task.status = "completed"

    db.commit()

    return {"message": "task updated"}