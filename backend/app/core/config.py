from functools import lru_cache
from pathlib import Path
from typing import Optional

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


_CORE_DIR = Path(__file__).resolve().parent
_APP_DIR = _CORE_DIR.parent
_BACKEND_DIR = _APP_DIR.parent
_REPO_ROOT = _BACKEND_DIR.parent

ENV_FILES = (
    _REPO_ROOT / ".env",
    _BACKEND_DIR / ".env",
)


class Settings(BaseSettings):
    """Application settings managed via environment variables."""

    model_config = SettingsConfigDict(
        env_file=ENV_FILES,
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    # Application
    PROJECT_NAME: str = "noteboard.ai"
    API_V1_PREFIX: str = "/api/v1"
    DEBUG: bool = False

    # PostgreSQL
    POSTGRES_USER: str = "noteboard"
    POSTGRES_PASSWORD: str = "noteboard_secret"
    POSTGRES_SERVER: str = Field(
        default="postgres",
        validation_alias=AliasChoices("POSTGRES_SERVER", "POSTGRES_HOST"),
    )
    POSTGRES_PORT: int = 5432
    POSTGRES_DB: str = "noteboard"

    # Redis
    REDIS_URL: str = "redis://redis:6379/0"

    # Security
    SECRET_KEY: str = "your-super-secret-key-change-in-production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    AUTH_DIAGNOSTIC_ENABLED: bool = False
    AUTH_DIAGNOSTIC_KEY: Optional[str] = None

    # Neo4j
    NEO4J_URI: str = "bolt://neo4j:7687"
    NEO4J_USER: str = "neo4j"
    NEO4J_PASSWORD: str = "neo4j_secret"

    # Weaviate
    WEAVIATE_URL: str = "http://weaviate:8080"

    # OpenAI
    OPENAI_API_KEY: str = ""

    @property
    def SQLALCHEMY_DATABASE_URI(self) -> str:
        """Construct async PostgreSQL connection string."""
        return (
            f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )


@lru_cache
def get_settings() -> Settings:
    """Cached settings instance."""
    return Settings()


settings = get_settings()
