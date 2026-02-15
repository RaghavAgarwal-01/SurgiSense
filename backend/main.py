from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from groq import Groq
import os
import json
import base64
from dotenv import load_dotenv
from pathlib import Path
import fitz 
app = FastAPI()
env_path = Path(__file__).resolve().parent.parent / '.env'
load_dotenv(dotenv_path=env_path)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)
GROQ_KEY=os.getenv('GROQ_KEY')
client = Groq(api_key=GROQ_KEY)

@app.post("/api/scan")
async def scan_document(file: UploadFile = File(...)):
    try:
        content = await file.read()
        text_content = ""
        if file.content_type == "application/pdf":
            doc = fitz.open(stream=content, filetype="pdf")
            for page in doc:
                text_content += page.get_text()
            doc.close()
        else:
            # Fallback for .txt or other text formats [cite: 136]
            try:
                text_content = content.decode('utf-8')
            except UnicodeDecodeError:
                raise HTTPException(status_code=400, detail="Unsupported binary file format. Please upload a PDF or TXT.")

        # AI Extraction Flow [cite: 92, 178]
        chat_completion = client.chat.completions.create(
            messages=[
                {
                    "role": "system",
                    "content": "You are a medical data extractor. Extract the following into JSON: surgery_type, surgery_date, medication_list (with name, dosage, frequency), and pre_op_restrictions. Output ONLY valid JSON."
                },
                {
                    "role": "user",
                    "content": f"Extract data from this medical text: {text_content}"
                }
            ],
            model="openai/gpt-oss-120b", 
            response_format={"type": "json_object"}
        )

        extracted_data = json.loads(chat_completion.choices[0].message.content)
        
        return {
            "status": "success",
            "data": extracted_data 
        }
    except Exception as e:
        print(f"Server Error: {str(e)}") # Visible in your terminal [cite: 241]
        raise HTTPException(status_code=500, detail=str(e))