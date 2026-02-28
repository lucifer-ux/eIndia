import os
import io
import tempfile
import logging
import subprocess
import asyncio
from fastapi import FastAPI, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="ElectroFind Voice Server")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Lazy-load Whisper
whisper_pipe = None

def get_whisper():
    global whisper_pipe
    if whisper_pipe is None:
        from transformers import pipeline
        logger.info("Loading Whisper medium model...")
        whisper_pipe = pipeline(
            "automatic-speech-recognition",
            model="openai/whisper-medium",
            device="mps",
        )
        logger.info("Whisper model loaded.")
    return whisper_pipe

# Edge-TTS voice map for Indian languages
EDGE_VOICES = {
    "hi": "hi-IN-SwaraNeural",
    "kn": "kn-IN-SapnaNeural",
    "te": "te-IN-ShrutiNeural",
    "ta": "ta-IN-PallaviNeural",
    "mr": "mr-IN-AarohiNeural",
    "pa": "pa-IN-GurpreetNeural",
    "en": "en-IN-NeerjaNeural",
    "bn": "bn-IN-TanishaaNeural",
    "gu": "gu-IN-DhwaniNeural",
    "ml": "ml-IN-SobhanaNeural",
}


@app.get("/health")
def health():
    return {"status": "ok"}


def convert_webm_to_wav(webm_path: str) -> str:
    """Convert webm audio to wav using ffmpeg."""
    wav_path = webm_path.replace(".webm", ".wav")
    try:
        subprocess.run(
            ["ffmpeg", "-y", "-i", webm_path, "-ar", "16000", "-ac", "1", wav_path],
            capture_output=True, check=True
        )
        return wav_path
    except FileNotFoundError:
        logger.error("ffmpeg not found. Install with: brew install ffmpeg")
        raise
    except subprocess.CalledProcessError as e:
        logger.error(f"ffmpeg error: {e.stderr.decode()}")
        raise


@app.post("/stt")
async def speech_to_text(
    audio: UploadFile = File(...),
    language: str = Form("en")
):
    """Transcribe audio to text using Whisper."""
    try:
        pipe = get_whisper()

        # Save uploaded audio to temp file
        with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as tmp:
            content = await audio.read()
            tmp.write(content)
            tmp_path = tmp.name

        # Convert webm to wav (Whisper needs wav/flac/mp3)
        wav_path = convert_webm_to_wav(tmp_path)
        os.unlink(tmp_path)

        # Transcribe
        result = pipe(
            wav_path,
            generate_kwargs={"language": language} if language != "en" else {},
        )
        os.unlink(wav_path)

        return {
            "transcript": result["text"].strip(),
            "language": language,
        }
    except Exception as e:
        logger.error(f"STT error: {e}")
        return {"error": str(e), "transcript": ""}


class TTSRequest(BaseModel):
    text: str
    language: str = "hi"

@app.post("/tts")
async def text_to_speech(req: TTSRequest):
    """Convert text to speech using Microsoft Edge TTS (free)."""
    try:
        import edge_tts

        voice = EDGE_VOICES.get(req.language, "hi-IN-SwaraNeural")

        # Generate audio
        communicate = edge_tts.Communicate(req.text, voice)

        with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as tmp:
            tmp_path = tmp.name

        await communicate.save(tmp_path)

        # Read and return
        with open(tmp_path, "rb") as f:
            audio_data = f.read()
        os.unlink(tmp_path)

        return StreamingResponse(
            io.BytesIO(audio_data),
            media_type="audio/mpeg"
        )

    except Exception as e:
        logger.error(f"TTS error: {e}")
        return {"error": str(e)}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5001)
