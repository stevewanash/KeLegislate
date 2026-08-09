import os
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    SUPABASE_URL: str
    SUPABASE_KEY: str
    SUPABASE_SERVICE_KEY: str
    SUPABASE_DB_URL: str
    
    GEMINI_API_KEY: str
    GEMINI_PLATFORM: str = "vertex_ai"
    
    AFRICAS_TALKING_USERNAME: str = "sandbox"
    AFRICAS_TALKING_API_KEY: str
    AFRICAS_TALKING_SENDER_ID: str | None = None
    
    SUPABASE_SMS_WEBHOOK_SECRET: str
    
    MAX_SMS_FAN_OUT: int = 500
    ENCRYPTION_KEY: str
    API_SECRET_TOKEN: str
    
    LLAMAPARSE_API_KEY: str | None = None

    # Support reading from .env file or env variables directly
    model_config = SettingsConfigDict(
        env_file=os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

try:
    settings = Settings()
except Exception as e:
    # During build/scaffolding, if env is missing, we log it and fallback to mock setting
    print(f"Warning: Environment settings validation failed: {e}")
    # We will instantiate a settings object with dummy values for safety
    class MockSettings:
        SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://mock.supabase.co")
        SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "mock-key")
        SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "mock-service-key")
        SUPABASE_DB_URL = os.environ.get("SUPABASE_DB_URL", "postgresql://mock@localhost:5432/mock")
        GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "mock-gemini-key")
        GEMINI_PLATFORM = os.environ.get("GEMINI_PLATFORM", "vertex_ai")
        AFRICAS_TALKING_USERNAME = os.environ.get("AFRICAS_TALKING_USERNAME", "sandbox")
        AFRICAS_TALKING_API_KEY = os.environ.get("AFRICAS_TALKING_API_KEY", "mock-at-key")
        AFRICAS_TALKING_SENDER_ID = os.environ.get("AFRICAS_TALKING_SENDER_ID", None)
        SUPABASE_SMS_WEBHOOK_SECRET = os.environ.get("SUPABASE_SMS_WEBHOOK_SECRET", "mock-secret")
        MAX_SMS_FAN_OUT = int(os.environ.get("MAX_SMS_FAN_OUT", "500"))
        ENCRYPTION_KEY = os.environ.get("ENCRYPTION_KEY", "mock-encryption-key-32-bytes-long-!")
        API_SECRET_TOKEN = os.environ.get("API_SECRET_TOKEN", "mock-api-token")
        LLAMAPARSE_API_KEY = os.environ.get("LLAMAPARSE_API_KEY", None)
    
    settings = MockSettings()
