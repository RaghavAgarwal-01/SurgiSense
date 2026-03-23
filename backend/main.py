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
from services.rules import evaluate_patient
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
    existing_tasks = db.query(RecoveryTask).filter(RecoveryTask.user_id == user.id).all()
    if existing_tasks:
        return {"status": "already_generated", "tasks": existing_tasks}
    try:
        prompt = f"Return ONLY JSON: {{'tasks': [{{'title': 'name', 'time': '08:00 AM'}}]}} based on: {request.document_text}"
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"}
        )
        
        content = response.choices[0].message.content
        if not content:
            raise ValueError("No content from LLM")
            
        data = json.loads(content)
        saved_tasks = []
        for task in data.get("tasks", []):
            db_task = RecoveryTask(user_id=user.id, title=task.get("title"), time=task.get("time"), status="pending")
            db.add(db_task)
            db.flush()
            saved_tasks.append({"id": db_task.id, "title": db_task.title, "time": db_task.time, "status": db_task.status})
        db.commit()
        return {"status": "success", "tasks": saved_tasks}
    except Exception as e:
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
def get_my_tasks(user = Depends(get_current_user), db: Session = Depends(get_db)):
    tasks = db.query(RecoveryTask).filter(RecoveryTask.user_id == user.id).order_by(RecoveryTask.id).all()
    return [{"id": t.id, "title": t.title, "time": t.time, "status": t.status} for t in tasks]

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
    SERP_API_KEY = "b88df29866b24d0487521c395852f1c9f9bb3e3d1458c61268a860749a4452af"
    
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