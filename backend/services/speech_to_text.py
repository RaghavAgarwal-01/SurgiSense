import os
import logging
from sarvamai import SarvamAI
from dotenv import load_dotenv

logger = logging.getLogger(__name__)
load_dotenv()

class SpeechToTextService:
    def __init__(self):
        self.client = SarvamAI(api_subscription_key=os.getenv("SARVAM_API_KEY"))

    def transcribe(self, audio_bytes: bytes) -> str:
        temp_file = "temp_voice.wav"
        try:
            with open(temp_file, "wb") as f:
                f.write(audio_bytes)

            with open(temp_file, "rb") as audio:
                response = self.client.speech_to_text.transcribe(
                    file=audio,
                    model="saaras:v3", 
                    language_code="unknown",
                    mode="codemix"
                )
            
            transcript = getattr(response, "transcript", "")
            return transcript if transcript else "Speech not recognized."

        except Exception as e:
            logger.error(f"STT Failure: {str(e)}")
            return "Service Error: Could not process audio."
            
        finally:
            if os.path.exists(temp_file):
                os.remove(temp_file)