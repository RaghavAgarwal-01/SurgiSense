import os
import logging
from dotenv import load_dotenv

try:
    from sarvamai import SarvamAI as _SarvamAI
    _SARVAM_AVAILABLE = True
except ImportError:
    _SarvamAI = None
    _SARVAM_AVAILABLE = False

logger = logging.getLogger(__name__)
load_dotenv()

class SpeechToTextService:
    def __init__(self):
        self.client = _SarvamAI(api_subscription_key=os.getenv("SARVAM_API_KEY")) if _SARVAM_AVAILABLE else None

    def transcribe(self, audio_bytes: bytes) -> str:
        if not self.client:
            raise RuntimeError("SarvamAI not available — voice transcription is disabled")
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