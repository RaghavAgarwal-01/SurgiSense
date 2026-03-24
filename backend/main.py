import os
import json
import logging
import urllib.parse  # Added for URL Sanitization
from pathlib import Path
from dotenv import load_dotenv
from pydantic import BaseModel
from google_auth import router as google_router
from fastapi import FastAPI, UploadFile, File, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
import fitz
from groq import Groq
from sqlalchemy.orm import Session
from dependencies import get_current_user, get_db
from models import MedicalRecord, User, PatientProfile, RecoveryTask
from services.rules_ai import evaluate_patient
from services.record_digitization import digitize_discharge_summary
from services.speech_to_text import SpeechToTextService
from services.wound_analysis import WoundAnalysisService
from services.chat import MedicalRAGService
from auth_routes import router as auth_router
from database import Base, engine, SessionLocal
from starlette.middleware.sessions import SessionMiddleware
import requests 
from math import radians, cos, sin, asin, sqrt

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ENV_PATH = os.path.join(BASE_DIR, ".env")
load_dotenv(dotenv_path=ENV_PATH)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

Base.metadata.create_all(bind=engine)

rag = MedicalRAGService()
app = FastAPI(title="SurgiSense AI Backend")

# Get session secret from environment or use default for dev
SESSION_SECRET = os.getenv("SESSION_SECRET", "dev-secret-key-change-in-production")

app.add_middleware(SessionMiddleware, secret_key=SESSION_SECRET)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/auth")
app.include_router(google_router, prefix="/auth")

from intake_routes import router as intake_router
app.include_router(intake_router, prefix="/api")

GROQ_KEY = os.getenv('GROQ_API_KEY')
client = Groq(api_key=GROQ_KEY)
speech_service = SpeechToTextService()
vision_service = WoundAnalysisService()

class ProfileCreate(BaseModel):
    patient_name: str
    surgery_type: str
    surgery_date: str

class TaskGenerationRequest(BaseModel):
    document_text: str

class ChatRequest(BaseModel):
    question: str 

class PatientVitals(BaseModel):
    surgery: str
    bp_sys: int
    bp_dia: int
    heart_rate: int
    spo2: int
    temperature: float
    hemoglobin: float
    blood_sugar: int

@app.get("/api/profile")
def get_profile(db: Session = Depends(get_db), user = Depends(get_current_user)):
    profile = db.query(PatientProfile).filter(PatientProfile.user_id == user.id).first()
    if not profile:
        return {"profile_exists": False}
    return {
        "profile_exists": True,
        "patient_name": profile.patient_name,
        "surgery_type": profile.surgery_type,
        "surgery_date": profile.surgery_date,
        "recovery_days_total": profile.recovery_days_total
    }

@app.post("/api/create-profile")
def create_profile(profile: ProfileCreate, db: Session = Depends(get_db), user = Depends(get_current_user)):
    existing = db.query(PatientProfile).filter(PatientProfile.user_id == user.id).first()
    if existing:
        existing.patient_name = profile.patient_name # type: ignore
        existing.surgery_type = profile.surgery_type # type: ignore
        existing.surgery_date = profile.surgery_date # type: ignore
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
async def scan_document(file: UploadFile = File(...), user = Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        content = await file.read()
        text_content = ""
        if file.content_type == "application/pdf":
            doc = fitz.open(stream=content, filetype="pdf")
            text_content = "".join([str(page.get_text()) for page in doc])
            doc.close()
        else:
            text_content = content.decode('utf-8')

        if text_content and text_content.strip():
            rag.ingest_document(text_content)

        chat_completion = client.chat.completions.create(
            messages=[
                {"role": "system", "content": "You are a medical data extractor. Extract into JSON: surgery_type, surgery_date, medication_list (with name, dosage, frequency), and pre_op_restrictions. Output ONLY valid JSON."},
                {"role": "user", "content": f"Extract data from this medical text: {text_content}"}
            ],
            model="llama-3.3-70b-versatile",
            response_format={"type": "json_object"}
        )
        
        response_text = chat_completion.choices[0].message.content
        if not response_text:
            raise ValueError("Empty AI response")
            
        extracted_data = json.loads(response_text) 
        record = MedicalRecord(user_id=user.id, content=json.dumps(extracted_data))
        db.add(record)
        db.commit()
        return {"status": "success", "data": extracted_data}
    except Exception as e:
        logger.error(f"Scan Error: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal processing error.")

@app.post("/api/voice-to-text")
async def process_voice(file: UploadFile = File(...)):
    try:
        audio_bytes = await file.read()
        transcript = speech_service.transcribe(audio_bytes)
        return {"transcript": transcript}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Voice processing failed.")

@app.post("/api/analyze-wound")
async def process_wound(file: UploadFile = File(...)):
    try:
        image_bytes = await file.read()
        analysis = vision_service.analyze(image_bytes)
        return {"analysis": analysis}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Image analysis failed.")
    
@app.post("/api/digitize-record")
async def digitize_record(file: UploadFile = File(...), user = Depends(get_current_user), db: Session = Depends(get_db)):
    file_bytes = await file.read()
    result = digitize_discharge_summary(file_bytes)
    record = MedicalRecord(user_id=user.id, content=json.dumps(result))
    db.add(record)
    db.commit()    
    try:
        doc = fitz.open(stream=file_bytes, filetype="pdf")
        text_content = "".join([str(page.get_text()) for page in doc])
        doc.close()
        if text_content and text_content.strip():
            rag.ingest_document(text_content)
    except Exception as e:
        logger.error(f"RAG Ingestion Failed: {e}")
    return {"data": result}

@app.post("/api/generate-tasks")
async def generate_tasks(request: TaskGenerationRequest, user = Depends(get_current_user), db: Session = Depends(get_db)):
    from datetime import date as date_type
    today_str = date_type.today().isoformat()

    # Check if tasks for TODAY already exist — if so return them directly as dicts
    # (old code returned ORM objects which are not JSON serializable, and the
    #  already_generated branch was skipped entirely by the frontend status check)
    existing_today = db.query(RecoveryTask).filter(
        RecoveryTask.user_id == user.id,
        RecoveryTask.task_date == today_str
    ).all()
    if existing_today:
        return {"status": "success", "tasks": [
            {"id": t.id, "title": t.title, "time": t.time,
             "status": t.status, "task_date": t.task_date, "is_critical": t.is_critical}
            for t in existing_today
        ]}

    try:
        # Build a richer prompt that asks for critical flag and daily scheduling
        prompt = f"""You are a clinical AI. Generate a daily task schedule for a patient based on their medical document.

Return ONLY valid JSON in this exact format:
{{
  "tasks": [
    {{
      "title": "Take prescribed medication",
      "time": "08:00 AM",
      "is_critical": 1
    }}
  ]
}}

Rules:
- Generate 6-10 tasks for a single day
- Set is_critical=1 for: medication intake, wound dressing changes, vital sign checks, prescribed physiotherapy
- Set is_critical=0 for: general rest, diet reminders, follow-up scheduling
- Times should be spread across the day (morning, afternoon, evening)

Medical document:
{request.document_text}"""

        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"}
        )
        
        content_str = response.choices[0].message.content
        if not content_str:
            raise ValueError("No content from LLM")
            
        data = json.loads(content_str)
        saved_tasks = []
        for task in data.get("tasks", []):
            db_task = RecoveryTask(
                user_id=user.id,
                title=task.get("title"),
                time=task.get("time"),
                status="pending",
                task_date=today_str,
                is_critical=int(task.get("is_critical", 0))
            )
            db.add(db_task)
            db.flush()
            saved_tasks.append({
                "id": db_task.id, "title": db_task.title, "time": db_task.time,
                "status": db_task.status, "task_date": db_task.task_date,
                "is_critical": db_task.is_critical
            })
        db.commit()
        return {"status": "success", "tasks": saved_tasks}
    except Exception as e:
        logger.error(f"Task generation failed: {e}")
        raise HTTPException(status_code=500, detail="Task generation failed")

@app.post("/api/chat")
async def chat_with_document(request: ChatRequest):
    try:
        answer = rag.ask_question(request.question)
        return {"status": "success", "answer": answer}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to generate an answer.")

@app.post("/api/evaluate")
def evaluate(vitals: PatientVitals):
    return evaluate_patient(vitals)

@app.get("/api/my-records")
def get_my_records(user = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(MedicalRecord).filter(MedicalRecord.user_id == user.id).all()

@app.get("/api/my-tasks")
def get_my_tasks(
    date: str = None,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    from datetime import date as date_type
    today_str = date_type.today().isoformat()
    target_date = date or today_str

    tasks = db.query(RecoveryTask).filter(
        RecoveryTask.user_id == user.id,
        RecoveryTask.task_date == target_date
    ).order_by(RecoveryTask.id).all()

    # Legacy fallback: tasks with no date — backfill them to today so they show up
    if not tasks and target_date == today_str:
        null_tasks = db.query(RecoveryTask).filter(
            RecoveryTask.user_id == user.id,
            RecoveryTask.task_date == None
        ).order_by(RecoveryTask.id).all()

        if null_tasks:
            # Stamp today's date on them so future queries also work
            for t in null_tasks:
                t.task_date = today_str
            db.commit()
            tasks = null_tasks

    logger.info(f"get_my_tasks: user={user.id} date={target_date} found={len(tasks)} tasks")
    return [
        {"id": t.id, "title": t.title, "time": t.time,
         "status": t.status, "task_date": t.task_date,
         "is_critical": getattr(t, "is_critical", 0)}
        for t in tasks
    ]


@app.get("/api/debug-tasks")
def debug_tasks(user = Depends(get_current_user), db: Session = Depends(get_db)):
    """Debug: shows ALL tasks for this user with raw task_date values."""
    all_tasks = db.query(RecoveryTask).filter(
        RecoveryTask.user_id == user.id
    ).order_by(RecoveryTask.id).all()
    return {
        "user_id": user.id,
        "total": len(all_tasks),
        "tasks": [
            {"id": t.id, "title": t.title, "task_date": repr(t.task_date), "status": t.status}
            for t in all_tasks
        ]
    }


@app.get("/api/overdue-tasks")
def get_overdue_tasks(user = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Returns critical tasks that are past their scheduled time and still pending.
    Called by the frontend every 5 minutes to trigger browser notifications.
    """
    from datetime import date as date_type, datetime as dt_type
    today_str = date_type.today().isoformat()
    now = dt_type.now()

    tasks = db.query(RecoveryTask).filter(
        RecoveryTask.user_id == user.id,
        RecoveryTask.task_date == today_str,
        RecoveryTask.is_critical == 1,
        RecoveryTask.status == "pending"
    ).all()

    overdue = []
    for t in tasks:
        try:
            # Parse "08:00 AM" style times
            task_time = dt_type.strptime(f"{today_str} {t.time}", "%Y-%m-%d %I:%M %p")
            minutes_overdue = (now - task_time).total_seconds() / 60
            if minutes_overdue >= 120:   # 2 hours
                overdue.append({
                    "id": t.id, "title": t.title, "time": t.time,
                    "minutes_overdue": round(minutes_overdue)
                })
        except Exception:
            pass
    return {"overdue": overdue}


@app.post("/api/generate-daily-tasks")
async def generate_daily_tasks(
    request: TaskGenerationRequest,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Generates tasks for EVERY day from the start date to the end date based on phase:
    
    Pre-operative:
      - Start: pdf_upload_date (when medical document was uploaded)
      - End: surgery_date (inclusive)
    
    Post-operative:
      - Start: today
      - End: next_appointment_date (or 14 days if no appointment date set)
    """
    from datetime import date as date_type, timedelta
    
    profile = db.query(PatientProfile).filter(PatientProfile.user_id == user.id).first()
    if not profile or not profile.surgery_date:
        raise HTTPException(status_code=400, detail="Surgery date not set in profile")

    try:
        surgery_date = date_type.fromisoformat(profile.surgery_date)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid surgery date format")

    today = date_type.today()
    phase = getattr(profile, "surgery_phase", "post") or "post"

    # Determine start and end dates based on phase
    if phase == "pre":
        # Pre-op: from PDF upload date (or today if no upload date) until surgery date (inclusive)
        if profile.pdf_upload_date:
            try:
                start_date = date_type.fromisoformat(profile.pdf_upload_date)
            except Exception:
                start_date = today
        else:
            start_date = today
        end_date = surgery_date
    else:
        # Post-op: from today until next appointment date (or 14 days if not set)
        start_date = today
        if profile.next_appointment_date:
            try:
                end_date = date_type.fromisoformat(profile.next_appointment_date)
            except Exception:
                end_date = today + timedelta(days=14)
        else:
            end_date = today + timedelta(days=14)

    if end_date < start_date:
        return {"status": "no_dates", "message": "No future dates to schedule"}

    # Generate the base task template from the document (single day)
    prompt = f"""You are a clinical AI. Generate a daily task schedule template for a patient.

Return ONLY valid JSON:
{{
  "tasks": [
    {{"title": "Take prescribed medication", "time": "08:00 AM", "is_critical": 1}}
  ]
}}

Rules:
- 6-10 tasks covering the full day
- is_critical=1 for: medication, wound care, vitals, physiotherapy
- is_critical=0 for: rest, diet, scheduling tasks
- Spread times from 07:00 AM to 09:00 PM

Medical document:
{request.document_text}"""

    resp = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"}
    )
    template_str = resp.choices[0].message.content
    if not template_str:
        raise HTTPException(status_code=500, detail="LLM returned empty response")

    template = json.loads(template_str).get("tasks", [])
    if not template:
        raise HTTPException(status_code=500, detail="No tasks in template")

    # Delete any existing tasks for the date range for this user to avoid duplicates
    db.query(RecoveryTask).filter(
        RecoveryTask.user_id == user.id,
        RecoveryTask.task_date >= start_date.isoformat(),
        RecoveryTask.task_date <= end_date.isoformat()
    ).delete(synchronize_session=False)

    # Stamp the template onto every day in the range
    total_days = (end_date - start_date).days + 1
    created = 0
    for day_offset in range(total_days):
        day = start_date + timedelta(days=day_offset)
        day_str = day.isoformat()
        for task in template:
            db.add(RecoveryTask(
                user_id=user.id,
                title=task.get("title"),
                time=task.get("time"),
                status="pending",
                task_date=day_str,
                is_critical=int(task.get("is_critical", 0))
            ))
            created += 1

    db.commit()

    # Return today's slice for immediate display
    today_tasks = db.query(RecoveryTask).filter(
        RecoveryTask.user_id == user.id,
        RecoveryTask.task_date == today.isoformat()
    ).order_by(RecoveryTask.id).all()

    return {
        "status": "success",
        "days_scheduled": total_days,
        "tasks_created": created,
        "tasks": [
            {"id": t.id, "title": t.title, "time": t.time,
              "status": t.status, "task_date": t.task_date,
              "is_critical": t.is_critical}
            for t in today_tasks
        ]
    }

@app.patch("/api/task/{task_id}")
def update_task(task_id: int, user = Depends(get_current_user), db: Session = Depends(get_db)):
    task = db.query(RecoveryTask).filter(RecoveryTask.id == task_id, RecoveryTask.user_id == user.id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    task.status = "completed" # type: ignore
    db.commit()
    return {"message": "task updated"}

def calculate_distance(lon1, lat1, lon2, lat2):
    lon1, lat1, lon2, lat2 = map(radians, [lon1, lat1, lon2, lat2])
    dlon = lon2 - lon1
    dlat = lat2 - lat1
    a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
    c = 2 * asin(sqrt(a))
    r = 6371
    return c * r

@app.get("/api/pharmacies/nearest")
def get_nearest_pharmacies(lat: float, lng: float):
    overpass_url = "http://overpass-api.de/api/interpreter"
    overpass_query = f"""
    [out:json];
    node["amenity"="pharmacy"](around:5000,{lat},{lng});
    out 10;
    """
    try:
        response = requests.get(overpass_url, params={'data': overpass_query})
        data = response.json()
        pharmacies = []
        for element in data.get('elements', []):
            tags = element.get('tags', {})
            name = tags.get('name', 'Local Pharmacy')
            street = tags.get('addr:street', '')
            city = tags.get('addr:city', '')
            address = f"{street}, {city}".strip(", ")
            if not address:
                address = "Address details not provided"
            p_lat = element['lat']
            p_lon = element['lon']
            dist = calculate_distance(lng, lat, p_lon, p_lat)
            pharmacies.append({
                "name": name,
                "address": address,
                "distance_km": round(dist, 2)
            })
        pharmacies.sort(key=lambda x: x["distance_km"])
        return pharmacies[:5]
    except Exception as e:
        logger.error(f"Failed to fetch global pharmacies: {e}")
        return []

@app.get("/api/pharmacy/search-prices")
def search_medicine_prices(medicine: str):
    """
    AUTONOMOUS PROCUREMENT AGENT:
    Queries Google Shopping live data to find the cheapest vendors.
    """
    # ENTERPRISE SECURITY: Pull key from secure environment variables
    SERP_API_KEY = os.getenv("SERP_API_KEY")
    
    if not SERP_API_KEY:
        logger.error("Security Alert: SERP_API_KEY missing from environment.")
        return {"status": "error", "message": "Procurement agent is offline."}
    
    try:
        url = f"https://serpapi.com/search.json?engine=google_shopping&q={medicine}+medicine&hl=en&gl=in&api_key={SERP_API_KEY}"
        
        response = requests.get(url)
        data = response.json()
        
        real_vendors = []
        
        # Parse the real live shopping results
        if "shopping_results" in data:
            seen_vendors = set()
            
            for item in data["shopping_results"]:
                vendor_name = item.get("source", "Online Pharmacy")
                
                # 1. DEDUPLICATION: Skip if we already have a price from this vendor
                if vendor_name in seen_vendors:
                    continue
                    
                seen_vendors.add(vendor_name)
                
                # 2. AGENTIC DATA SANITIZATION: Clean up Google's messy tracking URLs
                raw_link = item.get("link") or item.get("product_link") or f"https://www.google.com/search?tbm=shop&q={medicine}"
                
                if "google.com" in raw_link and ("url?" in raw_link or "aclk?" in raw_link):
                    parsed_url = urllib.parse.urlparse(raw_link)
                    params = urllib.parse.parse_qs(parsed_url.query)
                    
                    if "url" in params:
                        raw_link = params["url"][0]
                    elif "adurl" in params:
                        raw_link = params["adurl"][0]
                    elif "q" in params:
                        raw_link = params["q"][0]
                
                real_vendors.append({
                    "vendor": vendor_name,
                    "price": item.get("price", "Price unavailable"),
                    "delivery": item.get("delivery", "Standard Delivery"),
                    "url": raw_link
                })
                
                # 3. Stop once we have exactly 3 unique, sanitized pharmacies
                if len(real_vendors) == 3:
                    break
        
        # Fallback just in case Google Shopping hides results
        if not real_vendors:
            real_vendors = [
                {"vendor": "Apollo Pharmacy", "price": "Check site", "delivery": "Fast delivery", "url": f"https://www.apollopharmacy.in/search-medicines/{medicine}"},
                {"vendor": "Tata 1mg", "price": "Check site", "delivery": "Standard delivery", "url": f"https://www.1mg.com/search/all?name={medicine}"}
            ]
                
        return {"status": "success", "vendors": real_vendors}
        
    except Exception as e:
        logger.error(f"Procurement Agent Error: {e}")
        return {"status": "error", "message": "Could not fetch live prices."}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)