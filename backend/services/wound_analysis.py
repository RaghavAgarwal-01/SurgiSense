import os
import base64
import logging
from groq import Groq
from dotenv import load_dotenv

logger = logging.getLogger(__name__)
load_dotenv()

class WoundAnalysisService:
    def __init__(self):
        self.client = Groq(api_key=os.getenv("GROQ_KEY"))

    def analyze(self, image_bytes: bytes) -> str:
        try:
            b64_image = base64.b64encode(image_bytes).decode("utf-8")
            prompt = (
                "Act as a surgical specialist. Analyze this wound image. "
                "Identify signs of redness (Erythema), swelling, or infection. "
                "Provide a severity score from 1-10. You must format the score exactly as 'X/10' at the very end of your response."
            )
            
            response = self.client.chat.completions.create(
                messages=[{
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64_image}"}}
                    ]
                }],
                model="meta-llama/llama-4-scout-17b-16e-instruct" 
            )
            
            content = response.choices[0].message.content
            return content if content else "Analysis could not be generated."
            
        except Exception as e:
            logger.error(f"Vision Error: {str(e)}")
            return f"API Error: {str(e)}"