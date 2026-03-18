"""
api/voice.py — Voice Prakriti assessment endpoints.

POST /api/voice/tts          Text → speech (Sarvam AI, Indian languages only)
POST /api/voice/transcribe   Audio → transcript + intent match

Language support:
  ml  Malayalam   → Sarvam AI ml-IN
  hi  Hindi       → Sarvam AI hi-IN
  en  English     → Sarvam AI en-IN (Indian accent)
  ar/de/fr        → Not supported (HTTP 400)

Architecture:
  The voice layer is a thin wrapper around the same 22-question assessment.
  It does NOT have its own session management — the front-end manages question
  state and calls the existing /api/assessment/score endpoint when done,
  exactly as the text form does. Voice = alternate input method only.
"""

import base64
import os
from datetime import datetime, timezone
from pathlib import Path

import yaml
from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel

from core.intent import match_intent, needs_llm_fallback
from core.sarvam import is_supported, speech_to_text, text_to_speech

router = APIRouter(prefix="/api/voice", tags=["voice"])

_QUESTIONS_PATH = Path(__file__).parent.parent.parent / "config" / "questions.yaml"

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")


@router.get("/supported-langs")
async def get_supported_langs():
    """Return which languages support voice assessment."""
    return {
        "supported": ["ml", "hi", "en"],
        "labels": {
            "ml": "Malayalam",
            "hi": "Hindi",
            "en": "English (Indian)",
        },
    }


# ── TTS ────────────────────────────────────────────────────────────────────────

class TTSRequest(BaseModel):
    text: str
    lang: str


@router.post("/tts")
async def tts_endpoint(body: TTSRequest):
    """
    Convert text to speech using Sarvam AI.

    Returns JSON with base64-encoded WAV audio so the browser can
    decode and play it without a separate audio file download.
    """
    if not is_supported(body.lang):
        raise HTTPException(
            status_code=400,
            detail=f"Voice not supported for language '{body.lang}'. Supported: ml (Malayalam), hi (Hindi), en (English).",
        )
    if not body.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty")

    # Truncate to Sarvam's safe limit (~500 chars)
    text = body.text[:500]

    try:
        wav_bytes = await text_to_speech(text, body.lang)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"TTS service error: {e}")

    return {
        "audio_b64": base64.b64encode(wav_bytes).decode(),
        "content_type": "audio/wav",
        "lang": body.lang,
    }


# ── STT + Intent matching ──────────────────────────────────────────────────────

@router.post("/transcribe")
async def transcribe_endpoint(
    request: Request,
    audio: UploadFile = File(...),
    question_id: str = Form(...),
    lang: str = Form(...),
):
    """
    Transcribe audio and match intent to one of three answer options.

    Returns:
        transcript      Raw STT output
        option_index    0/1/2 or null if no match
        confidence      0.0 – 0.95
        matched_words   Keywords that triggered the match
        needs_reask     True if confidence < threshold
        reask_prompt    Rephrased question to help the user clarify
    """
    if not is_supported(lang):
        raise HTTPException(
            status_code=400,
            detail=f"Voice not supported for language '{lang}'.",
        )

    audio_bytes = await audio.read()
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="Empty audio file")

    content_type = audio.content_type or "audio/webm"

    # 1. Speech → text (Sarvam AI)
    try:
        transcript = await speech_to_text(audio_bytes, lang, content_type)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"STT error: {e}")

    if not transcript.strip():
        return {
            "transcript": "",
            "option_index": None,
            "confidence": 0.0,
            "matched_words": [],
            "needs_reask": True,
            "reask_prompt": _get_reask_prompt(question_id),
        }

    # 2. Keyword intent matching
    result = match_intent(transcript, question_id)
    needs_reask = result["option_index"] is None or needs_llm_fallback(result["confidence"])

    # 3. Optional: Claude Haiku for ambiguous cases (< threshold, ~15% of answers)
    if needs_reask and result["confidence"] > 0.0 and ANTHROPIC_API_KEY:
        llm_result = await _haiku_intent_fallback(transcript, question_id, lang)
        if llm_result:
            result = llm_result
            needs_reask = False

    return {
        "transcript": transcript,
        "option_index": result["option_index"],
        "confidence": result["confidence"],
        "matched_words": result["matched_words"],
        "needs_reask": needs_reask,
        "reask_prompt": _get_reask_prompt(question_id) if needs_reask else None,
    }


# ── Helpers ────────────────────────────────────────────────────────────────────

def _get_reask_prompt(question_id: str) -> str | None:
    """Load the reask_prompt for a question from questions.yaml."""
    try:
        with open(_QUESTIONS_PATH) as f:
            data = yaml.safe_load(f)
        for q in data.get("questions", []):
            if q["id"] == question_id:
                return q.get("reask_prompt")
    except Exception:
        pass
    return None


async def _haiku_intent_fallback(transcript: str, question_id: str, lang: str) -> dict | None:
    """
    Use Claude Haiku to resolve ambiguous voice input.
    Only called when keyword confidence < threshold (~15% of answers).
    Returns same shape as match_intent result, or None on failure.
    """
    try:
        import anthropic

        # Load question options
        with open(_QUESTIONS_PATH) as f:
            data = yaml.safe_load(f)
        question = next((q for q in data["questions"] if q["id"] == question_id), None)
        if not question:
            return None

        options_text = "\n".join(
            f"Option {i} (index={i}): {o['text']}"
            for i, o in enumerate(question["options"])
        )

        prompt = f"""A user is taking an Ayurvedic Prakriti (body constitution) assessment via voice.
They were asked: "{question['text']}"

The three options are:
{options_text}

The user said: "{transcript}"

Which option index (0, 1, or 2) best matches what the user said?
Respond with ONLY a JSON object like: {{"option_index": 1, "confidence": 0.82}}
If you cannot determine, respond: {{"option_index": null, "confidence": 0.0}}"""

        client = anthropic.AsyncAnthropic(api_key=ANTHROPIC_API_KEY)
        message = await client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=64,
            messages=[{"role": "user", "content": prompt}],
        )

        import json
        text = message.content[0].text.strip()
        parsed = json.loads(text)
        return {
            "option_index": parsed.get("option_index"),
            "confidence": parsed.get("confidence", 0.0),
            "matched_words": ["[haiku]"],
        }
    except Exception:
        return None
