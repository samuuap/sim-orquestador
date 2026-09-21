"""Application configuration using pydantic-settings."""
from typing import Literal, Optional
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
    llm_provider: Literal[
        "openai", "anthropic", "deepseek", "nvidia", "minimax", "glm", "custom_openai", "mock"
    ] = Field(
        default="mock",
        description="LLM provider to use"
    )

    # OpenAI
    openai_api_key: str = Field(default="", description="OpenAI API key")
    openai_model: str = Field(default="gpt-4-turbo-preview", description="OpenAI model name")

    # Anthropic
    anthropic_api_key: str = Field(default="", description="Anthropic API key")
    anthropic_model: str = Field(default="claude-3-5-sonnet-20241022", description="Anthropic model name")

    # DeepSeek
    deepseek_api_key: str = Field(default="", description="DeepSeek API key")
    deepseek_model: str = Field(default="deepseek-chat", description="DeepSeek model name")

    # NVIDIA
    nvidia_api_key: str = Field(default="", description="NVIDIA API key")
    nvidia_model: str = Field(default="nvidia/llama-3.1-nemotron-70b-instruct", description="NVIDIA model name")

    # MiniMax
    minimax_api_key: str = Field(default="", description="MiniMax API key")
    minimax_model: str = Field(default="abab6.5-chat", description="MiniMax model name")

    # GLM (ChatGLM)
    glm_api_key: str = Field(default="", description="GLM API key")
    glm_model: str = Field(default="glm-4", description="GLM model name")

    # Custom OpenAI-compatible provider
    custom_api_key: str = Field(default="", description="Custom provider API key")
    custom_model: Optional[str] = Field(default=None, description="Custom model name")
    custom_base_url: Optional[str] = Field(default=None, description="Custom API base URL")

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
        if self.llm_provider == "mock":
            return  # Mock doesn't need credentials

        validation_map = {
            "openai": (self.openai_api_key, "OPENAI_API_KEY"),
            "anthropic": (self.anthropic_api_key, "ANTHROPIC_API_KEY"),
            "deepseek": (self.deepseek_api_key, "DEEPSEEK_API_KEY"),
            "nvidia": (self.nvidia_api_key, "NVIDIA_API_KEY"),
            "minimax": (self.minimax_api_key, "MINIMAX_API_KEY"),
            "glm": (self.glm_api_key, "GLM_API_KEY"),
            "custom_openai": (self.custom_api_key, "CUSTOM_API_KEY"),
        }

        if self.llm_provider in validation_map:
            api_key, env_var = validation_map[self.llm_provider]
            if not api_key:
                raise ValueError(f"{env_var} is required when LLM_PROVIDER={self.llm_provider}")

        if self.llm_provider == "custom_openai":
            if not self.custom_model:
                raise ValueError("CUSTOM_MODEL is required when LLM_PROVIDER=custom_openai")
            if not self.custom_base_url:
                raise ValueError("CUSTOM_BASE_URL is required when LLM_PROVIDER=custom_openai")


# Global settings instance
settings = Settings()
