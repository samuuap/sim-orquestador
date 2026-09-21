"""LLM provider integration layer for agents."""
import asyncio
from typing import Optional, Dict, Any, AsyncIterator
from datetime import datetime

import structlog
from openai import AsyncOpenAI
from anthropic import AsyncAnthropic

from config import settings


logger = structlog.get_logger()


class LLMProvider:
    """
    LLM provider abstraction supporting multiple backends.

    Handles API calls, retry logic, streaming, and token tracking.
    """

    def __init__(self):
        """Initialize LLM provider based on configuration."""
        self.provider = settings.llm_provider
        self.logger = logger.bind(provider=self.provider)

        if self.provider == "openai":
            self.client = AsyncOpenAI(api_key=settings.openai_api_key)
            self.model = settings.openai_model
        elif self.provider == "anthropic":
            self.client = AsyncAnthropic(api_key=settings.anthropic_api_key)
            self.model = settings.anthropic_model
        else:
            raise ValueError(f"Unsupported LLM provider: {self.provider}")

        self.logger.info("llm_provider_initialized", model=self.model)

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
        start_time = datetime.utcnow()

        try:
            if self.provider == "openai":
                result = await self._generate_openai(
                    prompt, system_prompt, temperature, max_tokens, timeout
                )
            elif self.provider == "anthropic":
                result = await self._generate_anthropic(
                    prompt, system_prompt, temperature, max_tokens, timeout
                )
            else:
                raise ValueError(f"Unsupported provider: {self.provider}")

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

    async def _generate_openai(
        self,
        prompt: str,
        system_prompt: Optional[str],
        temperature: float,
        max_tokens: int,
        timeout: float
    ) -> Dict[str, Any]:
        """Generate using OpenAI API."""
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
        tokens = response.usage.total_tokens if response.usage else 0

        # Rough cost estimation (GPT-4 pricing: $0.03/1K input, $0.06/1K output)
        cost = (tokens / 1000) * 0.045  # Average

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

        # Claude pricing: $15/1M input, $75/1M output
        input_cost = (response.usage.input_tokens / 1_000_000) * 15
        output_cost = (response.usage.output_tokens / 1_000_000) * 75
        cost = input_cost + output_cost

        return {
            "content": content,
            "tokens": tokens,
            "cost": cost
        }

    async def generate_stream(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 1000
    ) -> AsyncIterator[str]:
        """
        Generate a streaming completion from the LLM.

        Args:
            prompt: User prompt
            system_prompt: Optional system prompt
            temperature: Sampling temperature (0-1)
            max_tokens: Maximum tokens to generate

        Yields:
            Content chunks as they arrive
        """
        if self.provider == "openai":
            async for chunk in self._stream_openai(prompt, system_prompt, temperature, max_tokens):
                yield chunk
        elif self.provider == "anthropic":
            async for chunk in self._stream_anthropic(prompt, system_prompt, temperature, max_tokens):
                yield chunk
        else:
            raise ValueError(f"Unsupported provider: {self.provider}")

    async def _stream_openai(
        self,
        prompt: str,
        system_prompt: Optional[str],
        temperature: float,
        max_tokens: int
    ) -> AsyncIterator[str]:
        """Stream using OpenAI API."""
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        stream = await self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            stream=True
        )

        async for chunk in stream:
            if chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content

    async def _stream_anthropic(
        self,
        prompt: str,
        system_prompt: Optional[str],
        temperature: float,
        max_tokens: int
    ) -> AsyncIterator[str]:
        """Stream using Anthropic API."""
        kwargs = {
            "model": self.model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": True
        }

        if system_prompt:
            kwargs["system"] = system_prompt

        async with self.client.messages.stream(**kwargs) as stream:
            async for text in stream.text_stream:
                yield text

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


# Global LLM provider instance
llm_provider = LLMProvider()
