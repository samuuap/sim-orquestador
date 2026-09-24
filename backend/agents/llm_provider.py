"""
LLM provider integration layer for agents.

This module is a thin compatibility layer over :mod:`agents.universal_llm_provider`,
which is the single implementation used by every agent. It supports OpenAI,
Anthropic, DeepSeek, NVIDIA, MiniMax, GLM, any OpenAI-compatible endpoint, and a
zero-cost ``mock`` provider for testing.

Providers are created lazily via :func:`get_llm_provider`. Nothing is instantiated
at import time, so importing this package never fails because of missing
credentials or an unsupported provider setting.
"""
from typing import Optional

import structlog

from agents.universal_llm_provider import UniversalLLMProvider

logger = structlog.get_logger()

# Canonical provider type. Kept under the historical name so existing type hints
# (``Optional[LLMProvider]`` on the agents) keep working.
LLMProvider = UniversalLLMProvider

_provider: Optional[UniversalLLMProvider] = None


def get_llm_provider(refresh: bool = False) -> UniversalLLMProvider:
    """
    Return the process-wide LLM provider, creating it on first use.

    Args:
        refresh: Rebuild the provider even if one was already created. Useful
            when configuration changes at runtime (mainly in tests).

    Returns:
        A configured :class:`UniversalLLMProvider`.

    Raises:
        ValueError: If the configured provider is unknown or its credentials
            are missing.
    """
    global _provider

    if _provider is None or refresh:
        _provider = UniversalLLMProvider()
        logger.info("llm_provider_created", provider=_provider.provider, model=_provider.model)

    return _provider


__all__ = ["LLMProvider", "UniversalLLMProvider", "get_llm_provider"]
