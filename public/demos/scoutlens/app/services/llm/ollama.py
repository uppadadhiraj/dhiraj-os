"""Ollama provider (local models via the native /api/chat endpoint)."""
from __future__ import annotations

import logging

import requests

from services.llm.base import LLMProvider
from utils.errors import LLMUnavailableError

logger = logging.getLogger(__name__)


class OllamaProvider(LLMProvider):
    name = "ollama"

    def __init__(
        self, base_url: str, model: str, timeout: float, session: requests.Session | None = None
    ) -> None:
        self._base = base_url.rstrip("/")
        self._model = model
        self._timeout = timeout
        self._session = session or requests.Session()

    def _post_chat(self, payload: dict) -> requests.Response:
        try:
            return self._session.post(f"{self._base}/api/chat", json=payload, timeout=self._timeout)
        except requests.Timeout:
            raise LLMUnavailableError(
                "The local language model took too long to respond.", detail="ollama timeout"
            ) from None
        except requests.ConnectionError:
            raise LLMUnavailableError(
                "Ollama is not reachable. Start it (`ollama serve`) or set LLM_PROVIDER=none.",
                detail="ollama connection error",
            ) from None
        except requests.RequestException as exc:
            raise LLMUnavailableError(detail=type(exc).__name__) from None

    def _chat(self, system: str, user: str, *, schema: dict | None, temperature: float) -> str:
        payload: dict = {
            "model": self._model,
            "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
            "stream": False,
            "options": {"temperature": temperature},
        }
        if schema is not None:
            payload["format"] = schema
        resp = self._post_chat(payload)
        if resp.status_code == 400 and schema is not None:  # older Ollama: no schema support in `format`
            payload["format"] = "json"
            resp = self._post_chat(payload)
        if resp.status_code == 404:
            raise LLMUnavailableError(
                f"The model '{self._model}' is not installed. Run `ollama pull {self._model}`.",
                detail="ollama model not found",
            )
        if not resp.ok:
            raise LLMUnavailableError(detail=f"ollama HTTP {resp.status_code}")
        try:
            return str(resp.json()["message"]["content"])
        except (ValueError, KeyError, TypeError):
            raise LLMUnavailableError("The language model returned an unreadable reply.", detail="ollama bad body") from None

    def check_available(self) -> tuple[bool, str]:
        try:
            resp = self._session.get(f"{self._base}/api/tags", timeout=5)
            resp.raise_for_status()
            names = {m.get("name", "") for m in resp.json().get("models", [])}
        except (requests.RequestException, ValueError):
            return False, "Ollama is not reachable. Start it (`ollama serve`) or set LLM_PROVIDER=none."
        if self._model in names or f"{self._model}:latest" in names:
            return True, f"Ollama · {self._model}"
        return False, f"Ollama is running but model '{self._model}' is not installed (`ollama pull {self._model}`)."
