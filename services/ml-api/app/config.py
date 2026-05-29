"""Application configuration loaded from environment / .env."""
from functools import lru_cache
from typing import Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime settings.

    Values are read from environment variables (case-insensitive) and an
    optional local .env file. See .env.example for the expected keys.
    """

    # Shared bearer secret the Cloud Function proxy uses to call this API.
    ml_api_secret: str = "change-me"

    # Filesystem path to a Firebase service-account JSON key (local dev).
    firebase_service_account_json_path: str = ""

    # Full Firebase service-account JSON as a single string (cloud deploy,
    # e.g. Railway). When set and non-empty this takes priority over the path.
    firebase_service_account_json: Optional[str] = None

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    """Return a cached Settings instance."""
    return Settings()
