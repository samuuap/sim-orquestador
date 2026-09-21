"""
Universal LLM Provider supporting multiple models and providers.

Supports:
- OpenAI (GPT-4, GPT-3.5, etc.)
- Anthropic (Claude 3.5, Claude 3, etc.)
- DeepSeek
- NVIDIA (via OpenAI-compatible API)
- MiniMax
- GLM (ChatGLM)
- Any OpenAI-compatible API
- Mock (for testing)
"""

import asyncio
from typing import Optional, Dict, Any
from datetime import datetime

import structlog
from openai import AsyncOpenAI
from anthropic import AsyncAnthropic

from config import settings

logger = structlog.get_logger()


class UniversalLLMProvider:
    """
    Universal LLM provider supporting multiple backends.

    Handles API calls, retry logic, and token tracking for any LLM provider.
    """

    # Provider configurations
    PROVIDER_CONFIGS = {
        "openai": {
            "client_class": AsyncOpenAI,
            "default_model": "gpt-4-turbo-preview",
            "api_key_env": "OPENAI_API_KEY",
            "base_url": None
        },
        "anthropic": {
            "client_class": AsyncAnthropic,
            "default_model": "claude-3-5-sonnet-20241022",
            "api_key_env": "ANTHROPIC_API_KEY",
            "base_url": None
        },
        "deepseek": {
            "client_class": AsyncOpenAI,  # OpenAI-compatible
            "default_model": "deepseek-chat",
            "api_key_env": "DEEPSEEK_API_KEY",
            "base_url": "https://api.deepseek.com"
        },
        "nvidia": {
            "client_class": AsyncOpenAI,  # OpenAI-compatible
            "default_model": "nvidia/llama-3.1-nemotron-70b-instruct",
            "api_key_env": "NVIDIA_API_KEY",
            "base_url": "https://integrate.api.nvidia.com/v1"
        },
        "minimax": {
            "client_class": AsyncOpenAI,  # OpenAI-compatible
            "default_model": "abab6.5-chat",
            "api_key_env": "MINIMAX_API_KEY",
            "base_url": "https://api.minimax.chat/v1"
        },
        "glm": {
            "client_class": AsyncOpenAI,  # OpenAI-compatible
            "default_model": "glm-4",
            "api_key_env": "GLM_API_KEY",
            "base_url": "https://open.bigmodel.cn/api/paas/v4"
        },
        "custom_openai": {
            "client_class": AsyncOpenAI,  # Generic OpenAI-compatible
            "default_model": None,  # Must be specified in config
            "api_key_env": "CUSTOM_API_KEY",
            "base_url": None  # Must be specified in config
        }
    }

    def __init__(self, provider: Optional[str] = None, model: Optional[str] = None,
                 base_url: Optional[str] = None, api_key: Optional[str] = None):
        """
        Initialize Universal LLM provider.

        Args:
            provider: Provider name (openai, anthropic, deepseek, nvidia, minimax, glm, custom_openai, mock)
            model: Model name (optional, uses default if not provided)
            base_url: Custom base URL for API (optional, for custom providers)
            api_key: API key (optional, reads from config if not provided)
        """
        self.provider = provider or settings.llm_provider
        self.logger = logger.bind(provider=self.provider)

        # Handle mock provider
        if self.provider == "mock":
            from agents.mock_llm_provider import mock_llm_provider
            self._mock = mock_llm_provider
            self.model = "mock-gpt-4"
            self.logger.info("llm_provider_initialized", model=self.model, mode="mock")
            return

        # Get provider config
        if self.provider not in self.PROVIDER_CONFIGS:
            raise ValueError(f"Unsupported LLM provider: {self.provider}. "
                           f"Supported: {list(self.PROVIDER_CONFIGS.keys())}")

        config = self.PROVIDER_CONFIGS[self.provider]

        # Get API key
        if api_key:
            self.api_key = api_key
        else:
            self.api_key = getattr(settings, config["api_key_env"].lower(), None)
            if not self.api_key:
                raise ValueError(f"API key not found for {self.provider}. "
                               f"Set {config['api_key_env']} in environment.")

        # Get model
        if model:
            self.model = model
        elif self.provider == "custom_openai":
            self.model = settings.custom_model or config["default_model"]
            if not self.model:
                raise ValueError("custom_openai provider requires model to be specified")
        else:
            self.model = getattr(settings, f"{self.provider}_model", None) or config["default_model"]

        # Get base URL
        if base_url:
            self.base_url = base_url
        elif self.provider == "custom_openai":
            self.base_url = settings.custom_base_url or config["base_url"]
            if not self.base_url:
                raise ValueError("custom_openai provider requires base_url to be specified")
        else:
            self.base_url = config["base_url"]

        # Initialize client
        client_class = config["client_class"]

        if client_class == AsyncOpenAI:
            client_kwargs = {"api_key": self.api_key}
            if self.base_url:
                client_kwargs["base_url"] = self.base_url
            self.client = client_class(**client_kwargs)
        elif client_class == AsyncAnthropic:
            self.client = client_class(api_key=self.api_key)
        else:
            raise ValueError(f"Unknown client class: {client_class}")

        self.logger.info("llm_provider_initialized", model=self.model, base_url=self.base_url)

    async def generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 1000,
        timeout: float = 30.0
    ) -> Dict[str, Any]:
        """
        Generate a completion from the LLM.

        Args:
            prompt: User prompt
            system_prompt: Optional system prompt
            temperature: Sampling temperature (0-1)
            max_tokens: Maximum tokens to generate
            timeout: Request timeout in seconds

        Returns:
            Dictionary with 'content', 'tokens', 'cost', 'duration'
        """
        # Handle mock provider
        if self.provider == "mock":
            return await self._mock.generate(prompt, system_prompt, temperature, max_tokens, timeout)

        start_time = datetime.utcnow()

        try:
            if self.provider == "anthropic":
                result = await self._generate_anthropic(
                    prompt, system_prompt, temperature, max_tokens, timeout
                )
            else:
                # All others use OpenAI-compatible API
                result = await self._generate_openai_compatible(
                    prompt, system_prompt, temperature, max_tokens, timeout
                )

            duration = (datetime.utcnow() - start_time).total_seconds()
            result["duration"] = duration

            self.logger.info(
                "llm_generation_complete",
                tokens=result["tokens"],
                cost=result["cost"],
                duration=duration
            )

            return result

        except asyncio.TimeoutError:
            self.logger.error("llm_timeout", timeout=timeout)
            raise
        except Exception as e:
            self.logger.error("llm_error", error=str(e))
            raise

    async def _generate_openai_compatible(
        self,
        prompt: str,
        system_prompt: Optional[str],
        temperature: float,
        max_tokens: int,
        timeout: float
    ) -> Dict[str, Any]:
        """Generate using OpenAI-compatible API (OpenAI, DeepSeek, NVIDIA, MiniMax, GLM, etc.)."""
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        response = await asyncio.wait_for(
            self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens
            ),
            timeout=timeout
        )

        content = response.choices[0].message.content
        tokens = response.usage.total_tokens

        # Cost calculation (provider-specific)
        cost = self._calculate_cost(tokens, response.usage.prompt_tokens, response.usage.completion_tokens)

        return {
            "content": content,
            "tokens": tokens,
            "cost": cost
        }

    async def _generate_anthropic(
        self,
        prompt: str,
        system_prompt: Optional[str],
        temperature: float,
        max_tokens: int,
        timeout: float
    ) -> Dict[str, Any]:
        """Generate using Anthropic API."""
        kwargs = {
            "model": self.model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": temperature,
            "max_tokens": max_tokens
        }

        if system_prompt:
            kwargs["system"] = system_prompt

        response = await asyncio.wait_for(
            self.client.messages.create(**kwargs),
            timeout=timeout
        )

        content = response.content[0].text
        tokens = response.usage.input_tokens + response.usage.output_tokens

        # Claude pricing
        input_cost = (response.usage.input_tokens / 1_000_000) * 15
        output_cost = (response.usage.output_tokens / 1_000_000) * 75
        cost = input_cost + output_cost

        return {
            "content": content,
            "tokens": tokens,
            "cost": cost
        }

    def _calculate_cost(self, total_tokens: int, input_tokens: int, output_tokens: int) -> float:
        """
        Calculate cost based on provider and model.

        Args:
            total_tokens: Total tokens used
            input_tokens: Input/prompt tokens
            output_tokens: Output/completion tokens

        Returns:
            Estimated cost in USD
        """
        # Pricing per 1M tokens (approximate, adjust based on actual pricing)
        pricing = {
            "openai": {
                "gpt-4-turbo-preview": {"input": 10, "output": 30},
                "gpt-4": {"input": 30, "output": 60},
                "gpt-3.5-turbo": {"input": 0.5, "output": 1.5}
            },
            "deepseek": {
                "deepseek-chat": {"input": 0.14, "output": 0.28}
            },
            "nvidia": {
                "default": {"input": 0.0, "output": 0.0}  # Often free tier available
            },
            "minimax": {
                "abab6.5-chat": {"input": 2.0, "output": 2.0}
            },
            "glm": {
                "glm-4": {"input": 1.0, "output": 1.0}
            },
            "custom_openai": {
                "default": {"input": 1.0, "output": 2.0}  # Generic estimate
            }
        }

        provider_pricing = pricing.get(self.provider, {})
        model_pricing = provider_pricing.get(self.model, provider_pricing.get("default", {"input": 1.0, "output": 2.0}))

        input_cost = (input_tokens / 1_000_000) * model_pricing["input"]
        output_cost = (output_tokens / 1_000_000) * model_pricing["output"]

        return input_cost + output_cost

    async def generate_with_retry(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        max_retries: int = 3,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Generate with exponential backoff retry logic.

        Args:
            prompt: User prompt
            system_prompt: Optional system prompt
            max_retries: Maximum number of retry attempts
            **kwargs: Additional arguments passed to generate()

        Returns:
            Dictionary with 'content', 'tokens', 'cost', 'duration'
        """
        for attempt in range(max_retries):
            try:
                return await self.generate(prompt, system_prompt, **kwargs)
            except asyncio.TimeoutError:
                if attempt == max_retries - 1:
                    raise
                wait_time = 2 ** attempt
                self.logger.warning(
                    "llm_retry",
                    attempt=attempt + 1,
                    max_retries=max_retries,
                    wait_time=wait_time
                )
                await asyncio.sleep(wait_time)
            except Exception as e:
                self.logger.error("llm_error_retry", attempt=attempt + 1, error=str(e))
                if attempt == max_retries - 1:
                    raise
                await asyncio.sleep(2 ** attempt)


# Create global instance based on config
def create_llm_provider() -> UniversalLLMProvider:
    """Create and return configured LLM provider."""
    return UniversalLLMProvider()


# Global LLM provider instance
llm_provider = create_llm_provider()
