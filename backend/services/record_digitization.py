# backend/services/record_digitization.py

import os
import json
from groq import Groq
from utils.pdf_reader import extract_text_from_pdf
import logging
logging.basicConfig(level=logging.INFO)



def get_groq_client():
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise RuntimeError("GROQ_API_KEY not set in environment")
    return Groq(api_key=api_key)


def digitize_discharge_summary(file_bytes: bytes) -> dict:
    raw_text = extract_text_from_pdf(file_bytes)

    prompt = f"""
You are a medical AI assistant.

Extract structured information from the following hospital discharge summary.
Return ONLY valid JSON. No explanations.

Required fields:
- patient (name, age, gender)
- admission_date
- discharge_date
- procedure
- medications (name, dosage, frequency, duration)
- follow_up (date, doctor)
- red_flags (list)

Discharge Summary:
{raw_text}
"""

    client = get_groq_client()

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}],
        temperature=0,
        response_format={"type": "json_object"}
    )

    content = response.choices[0].message.content
    if content is None:
        return {
            "error": "Empty response from LLM",
            "raw_output": None
        }
    content = content.strip()

    try:
        ai_json = json.loads(content)
    except json.JSONDecodeError:
        return {
            "error": "Invalid JSON from LLM",
            "raw_output": content
        }

    # Normalize for frontend
    normalized = {
        "procedure": ai_json.get("procedure"),
        "doctor": ai_json.get("follow_up", {}).get("doctor"),
        "follow_up_date": ai_json.get("follow_up", {}).get("date"),
        "medications": ai_json.get("medications", [])
    }

    return normalized