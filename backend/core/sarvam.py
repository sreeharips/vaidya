"""
core/sarvam.py — Sarvam AI client for Indian language STT and TTS.

Sarvam AI supports Indian languages natively:
  ml-IN  Malayalam
  hi-IN  Hindi
  en-IN  Indian English

For Arabic / European languages, use Deepgram / Azure instead.
"""

import base64
import os

import httpx

SARVAM_API_KEY = os.getenv("SARVAM_API_KEY", "")
SARVAM_BASE = "https://api.sarvam.ai"

# Vaidya lang code → Sarvam language code
LANG_MAP: dict[str, str] = {
    "ml": "ml-IN",
    "hi": "hi-IN",
    "en": "en-IN",
}

# TTS speaker selection per language
TTS_SPEAKERS: dict[str, str] = {
    "ml-IN": "meera",   # Clear Kerala Malayalam female voice
    "hi-IN": "meera",   # Hindi female voice
    "en-IN": "meera",   # Indian English female voice
}

SUPPORTED_LANGS = set(LANG_MAP.keys())


def is_supported(lang: str) -> bool:
    return lang in SUPPORTED_LANGS


async def speech_to_text(audio_bytes: bytes, lang: str, content_type: str = "audio/webm") -> str:
    """
    Transcribe audio bytes to text using Sarvam AI STT (Saarika model).

    Args:
        audio_bytes: Raw audio data (WebM, OGG, WAV, MP3)
        lang: Vaidya language code (ml, hi, en)
        content_type: MIME type of the audio bytes

    Returns:
        Transcript string

    Raises:
        ValueError: if language is not supported by Sarvam
        httpx.HTTPError: on API failure
    """
    sarvam_lang = LANG_MAP.get(lang)
    if not sarvam_lang:
        raise ValueError(f"Language '{lang}' not supported by Sarvam AI. Supported: {list(LANG_MAP)}")

    # Determine file extension from content type
    ext_map = {
        "audio/webm": "webm",
        "audio/ogg": "ogg",
        "audio/wav": "wav",
        "audio/wave": "wav",
        "audio/mp4": "mp4",
        "audio/mpeg": "mp3",
        "audio/webm;codecs=opus": "webm",
        "audio/ogg;codecs=opus": "ogg",
    }
    ext = ext_map.get(content_type.split(";")[0].strip(), "webm")
    filename = f"audio.{ext}"

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            f"{SARVAM_BASE}/speech-to-text",
            headers={"api-subscription-key": SARVAM_API_KEY},
            files={"file": (filename, audio_bytes, content_type)},
            data={
                "language_code": sarvam_lang,
                "model": "saarika:v2",
                "with_timestamps": "false",
            },
        )
        response.raise_for_status()
        data = response.json()
        return data.get("transcript", "")


async def text_to_speech(text: str, lang: str) -> bytes:
    """
    Convert text to speech using Sarvam AI TTS (Bulbul model).

    Args:
        text: Text to synthesise (max ~500 chars per Sarvam limit)
        lang: Vaidya language code (ml, hi, en)

    Returns:
        WAV audio as bytes (decoded from base64 response)

    Raises:
        ValueError: if language is not supported by Sarvam
        httpx.HTTPError: on API failure
    """
    sarvam_lang = LANG_MAP.get(lang)
    if not sarvam_lang:
        raise ValueError(f"Language '{lang}' not supported by Sarvam AI TTS. Supported: {list(LANG_MAP)}")

    speaker = TTS_SPEAKERS.get(sarvam_lang, "meera")

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            f"{SARVAM_BASE}/text-to-speech",
            headers={
                "api-subscription-key": SARVAM_API_KEY,
                "Content-Type": "application/json",
            },
            json={
                "inputs": [text],
                "target_language_code": sarvam_lang,
                "speaker": speaker,
                "model": "bulbul:v1",
                "pitch": 0,
                "pace": 1.0,
                "loudness": 1.5,
                "enable_preprocessing": True,
            },
        )
        response.raise_for_status()
        data = response.json()

        audios = data.get("audios", [])
        if not audios:
            raise ValueError("Sarvam TTS returned no audio")

        # Response is base64-encoded WAV
        return base64.b64decode(audios[0])
