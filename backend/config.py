"""Application configuration using pydantic-settings."""
from typing import Literal
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore"
    )

    # LLM Provider
    llm_provider: Literal["openai", "anthropic"] = Field(
        default="openai",
        description="LLM provider to use"
    )

    # OpenAI
    openai_api_key: str = Field(default="", description="OpenAI API key")
    openai_model: str = Field(default="gpt-4-turbo-preview", description="OpenAI model name")

    # Anthropic
    anthropic_api_key: str = Field(default="", description="Anthropic API key")
    anthropic_model: str = Field(default="claude-3-opus-20240229", description="Anthropic model name")

    # Application
    app_env: Literal["development", "production"] = Field(default="development")
    log_level: str = Field(default="INFO", description="Logging level")

    # CORS
    cors_origins: str = Field(
        default="http://localhost:5173,http://localhost:3000",
        description="Comma-separated CORS origins"
    )

    # WebSocket
    ws_heartbeat_interval: int = Field(default=30, description="WebSocket heartbeat interval in seconds")
    ws_max_connections: int = Field(default=100, description="Maximum WebSocket connections")

    @property
    def cors_origins_list(self) -> list[str]:
        """Parse CORS origins into a list."""
        return [origin.strip() for origin in self.cors_origins.split(",")]

    def validate_llm_config(self) -> None:
        """Validate that the selected LLM provider has required credentials."""
        if self.llm_provider == "openai" and not self.openai_api_key:
            raise ValueError("OPENAI_API_KEY is required when LLM_PROVIDER=openai")
        if self.llm_provider == "anthropic" and not self.anthropic_api_key:
            raise ValueError("ANTHROPIC_API_KEY is required when LLM_PROVIDER=anthropic")


# Global settings instance
settings = Settings()
