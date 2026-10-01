"""OpenAI-compatible provider (OpenAI, Groq, Together, LM Studio, vLLM, Ollama's /v1 ...)."""
from __future__ import annotations

import logging

import requests

from services.llm.base import LLMProvider
from utils.errors import LLMUnavailableError
from utils.security import redact_secrets

logger = logging.getLogger(__name__)


class OpenAICompatProvider(LLMProvider):
    name = "openai"

    def __init__(
        self, base_url: str, api_key: str, model: str, timeout: float, session: requests.Session | None = None
    ) -> None:
        self._base = base_url.rstrip("/")
        self._key = api_key
        self._model = model
        self._timeout = timeout
        self._session = session or requests.Session()

    def _post(self, payload: dict) -> requests.Response:
        try:
            return self._session.post(
                f"{self._base}/chat/completions",
                json=payload,
                headers={"Authorization": f"Bearer {self._key}"},
                timeout=self._timeout,
            )
        except requests.Timeout:
            raise LLMUnavailableError("The language model API took too long to respond.", detail="timeout") from None
        except requests.RequestException as exc:
            raise LLMUnavailableError(
                "The language model API could not be reached.",
                detail=redact_secrets(str(exc), [self._key]),
            ) from None

    def _chat(self, system: str, user: str, *, schema: dict | None, temperature: float) -> str:
        payload: dict = {
            "model": self._model,
            "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
            "temperature": temperature,
        }
        if schema is not None:
            payload["response_format"] = {"type": "json_object"}
        resp = self._post(payload)
        if resp.status_code == 400 and schema is not None and "response_format" in resp.text:
            payload.pop("response_format")  # server does not support JSON mode; rely on prompt + validation
            resp = self._post(payload)
        if resp.status_code in (401, 403):
            raise LLMUnavailableError(
                "The language model API rejected the API key. Check OPENAI_API_KEY.", detail=f"HTTP {resp.status_code}"
            )
        if resp.status_code == 429:
            raise LLMUnavailableError("The language model API rate limit was reached.", detail="HTTP 429")
        if not resp.ok:
            raise LLMUnavailableError(detail=f"HTTP {resp.status_code}")
        try:
            return str(resp.json()["choices"][0]["message"]["content"] or "")
        except (ValueError, KeyError, IndexError, TypeError):
            raise LLMUnavailableError("The language model returned an unreadable reply.", detail="bad body") from None

    def check_available(self) -> tuple[bool, str]:
        if not self._key:
            return False, "OPENAI_API_KEY is not set."
        return True, f"OpenAI-compatible · {self._model}"
