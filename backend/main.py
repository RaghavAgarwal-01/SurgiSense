import os
import json
import logging
from pathlib import Path
from dotenv import load_dotenv
from pydantic import BaseModel

from fastapi import FastAPI, UploadFile, File, HTTPException 
from fastapi.middleware.cors import CORSMiddleware
import fitz  
from groq import Groq

from services.record_digitization import digitize_discharge_summary
from services.speech_to_text import SpeechToTextService
from services.wound_analysis import WoundAnalysisService
from services.chat import MedicalRAGService
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ENV_PATH = os.path.join(BASE_DIR, ".env")

print("Loading env from:", ENV_PATH)
load_dotenv(dotenv_path=ENV_PATH)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

rag = MedicalRAGService()

app = FastAPI(title="SurgiSense AI Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

GROQ_KEY = os.getenv('GROQ_API_KEY')
if not GROQ_KEY:
    logger.error("GROQ_KEY missing!")
client = Groq(api_key=GROQ_KEY)

speech_service = SpeechToTextService()
vision_service = WoundAnalysisService()


@app.post("/api/scan")
async def scan_document(file: UploadFile = File(...)):
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
async def digitize_record(file: UploadFile = File(...)):
    file_bytes = await file.read()
    result = digitize_discharge_summary(file_bytes)
    return {"data": result}

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