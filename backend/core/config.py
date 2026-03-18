from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/vaidya"
    DATABASE_SYNC_URL: str = "postgresql+psycopg2://postgres:postgres@localhost:5432/vaidya"

    # Cache
    REDIS_URL: str = "redis://localhost:6379/0"

    # Payments
    STRIPE_SECRET_KEY: str = ""
    STRIPE_WEBHOOK_SECRET: str = ""
    RAZORPAY_KEY_ID: str = ""
    RAZORPAY_KEY_SECRET: str = ""

    # Voice — STT + TTS (Indian languages)
    SARVAM_API_KEY: str = ""

    # Voice — STT
    DEEPGRAM_API_KEY: str = ""
    AZURE_SPEECH_KEY: str = ""
    AZURE_SPEECH_REGION: str = ""

    # Voice — TTS
    ELEVENLABS_API_KEY: str = ""
    INWORLD_API_KEY: str = ""

    # AI
    ANTHROPIC_API_KEY: str = ""

    # Storage
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    AWS_S3_BUCKET: str = ""
    AWS_REGION: str = "ap-south-1"
    AWS_CLOUDFRONT_URL: str = ""

    # Auth
    JWT_SECRET: str = "dev-secret-change-me"

    # App
    NEXT_PUBLIC_API_URL: str = "http://localhost:8000"
    NEXT_PUBLIC_APP_URL: str = "http://localhost:3000"

    # Environment
    ENVIRONMENT: str = "development"
    DEBUG: bool = True

    model_config = {"env_file": "../.env.local", "env_file_encoding": "utf-8"}


settings = Settings()
