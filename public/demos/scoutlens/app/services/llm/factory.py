"""Build the configured :class:`LLMProvider`. The rest of the app depends only on the base class."""
from __future__ import annotations

from config import Settings
from services.llm.base import LLMProvider, NullProvider
from services.llm.ollama import OllamaProvider
from services.llm.openai_compat import OpenAICompatProvider


def get_llm(settings: Settings) -> LLMProvider:
    if settings.llm_provider == "ollama":
        return OllamaProvider(settings.ollama_base_url, settings.ollama_model, settings.llm_timeout)
    if settings.llm_provider == "openai":
        key = settings.openai_api_key.get_secret_value().strip() if settings.openai_api_key else ""
        if not key:
            return NullProvider("OPENAI_API_KEY is not set; running without an LLM.")
        return OpenAICompatProvider(settings.openai_base_url, key, settings.openai_model, settings.llm_timeout)
    return NullProvider()
