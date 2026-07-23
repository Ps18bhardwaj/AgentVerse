"""Single LLM entrypoint for the whole portfolio — FREE models only.

Design goals (this file is itself a portfolio detail):
  * One ``chat()`` function every project imports.
  * **3-model chain:** Groq primary → Gemini Flash → Gemini Flash Lite.
    Each has an independent rate-limit quota; exhausting one falls to the next.
  * Exponential backoff with jitter on 429s before falling back.
  * Inter-provider cooldown sleep so rate limits have time to reset.
  * Langfuse tracing wired into LiteLLM callbacks (auto, optional).
  * Providers swappable in ONE place via env vars.

All model IDs are free / free-tier (verified 2026-06-22). Re-verify in the
Groq console / Google AI Studio if running much later — Groq deprecates
models and Gemini renames Flash tiers frequently.

Usage
-----
    from shared.llm import chat
    text = chat([{"role": "user", "content": "Hello"}])

    # JSON / structured output
    data = chat(messages, response_format={"type": "json_object"})

    # Streaming
    for token in chat_stream(messages):
        print(token, end="")
"""
from __future__ import annotations

import logging
import os
import random
import time
from typing import Any, Iterator, Optional

import litellm
from litellm import completion
from litellm.exceptions import (
    APIConnectionError,
    InternalServerError,
    RateLimitError,
    ServiceUnavailableError,
    Timeout,
)

from .tracing import observe

# --------------------------------------------------------------------------
# Configuration
# --------------------------------------------------------------------------
# 3-model chain: Groq (fast reasoning) → Gemini Flash → Gemini Flash Lite.
# Each has its own independent rate-limit bucket on the free tier:
#   Groq:           ~30 RPM / 1 K RPD
#   Gemini Flash:   ~15 RPM / 1 M TPD
#   Gemini Lite:    ~30 RPM / 1 M TPD  ← separate quota from Flash
def get_primary_model() -> str:
    return os.getenv("PRIMARY_MODEL") or "groq/llama-3.3-70b-versatile"

def get_fallback_model() -> str:
    return os.getenv("FALLBACK_MODEL") or "gemini/gemini-2.0-flash"

def get_fallback_model_2() -> str:
    return os.getenv("FALLBACK_MODEL_2") or "gemini/gemini-1.5-flash"

# Errors that justify a retry-then-fallback (transient / capacity).
_RETRYABLE = (
    RateLimitError,
    ServiceUnavailableError,
    InternalServerError,
    APIConnectionError,
    Timeout,
    ValueError,
)


# Keep LiteLLM quiet and resilient.
litellm.drop_params = True          # silently drop params a provider doesn't support
litellm.suppress_debug_info = True
# Quiet LiteLLM's WARNING-level log noise
logging.getLogger("LiteLLM").setLevel(logging.ERROR)

_log = logging.getLogger("llm.router")


# --------------------------------------------------------------------------
# Core helpers
# --------------------------------------------------------------------------
def _backoff_sleep(attempt: int, base: float = 1.0, cap: float = 60.0) -> None:
    """Exponential backoff with full jitter (cap raised to 60 s for free tiers)."""
    delay = min(cap, base * (2 ** attempt))
    time.sleep(random.uniform(0, delay))


def _call(model: str, messages: list[dict], stream: bool = False, **kwargs: Any):
    """One LiteLLM completion call (no retry logic here)."""
    return completion(model=model, messages=messages, stream=stream, **kwargs)


from pathlib import Path
from dotenv import load_dotenv

_PROJECT_ENV = Path(__file__).resolve().parents[2] / ".env"
_BACKEND_ENV = Path(__file__).resolve().parents[1] / ".env"
load_dotenv(_PROJECT_ENV)
load_dotenv(_BACKEND_ENV)

def _attempt_model(
    model: str,
    messages: list[dict],
    *,
    max_retries: int,
    stream: bool,
    **kwargs: Any,
):
    """Try a single model with backoff on transient errors.

    Returns the response on success, or raises the last error so the caller
    can decide whether to fall back to another provider.
    """
    last_err: Optional[Exception] = None
    for attempt in range(max_retries + 1):
        try:
            return _call(model, messages, stream=stream, **kwargs)
        except _RETRYABLE as err:
            last_err = err
            if "Missing" in str(err) or "API key" in str(err) or "APIKey" in str(err):
                raise err
            if attempt < max_retries:
                _backoff_sleep(attempt)
            continue
        except Exception as err:
            # Non-retryable error for this model (e.g. invalid model ID/auth), re-raise immediately to fall back
            raise err
    assert last_err is not None
    raise last_err



def _model_chain(
    primary: Optional[str],
    fallback_model: Optional[str],
) -> list[str]:
    """Return the ordered list of models to try, deduped."""
    p = primary or get_primary_model()
    f1 = fallback_model if fallback_model is not None else get_fallback_model()
    f2 = get_fallback_model_2()
    seen: set[str] = set()
    chain: list[str] = []
    for m in [p, f1, f2]:
        if m and m not in seen:
            seen.add(m)
            chain.append(m)
    return chain


@observe(name="llm-chat")
def chat(
    messages: list[dict],
    *,
    model: Optional[str] = None,
    fallback_model: Optional[str] = None,
    temperature: float = 0.2,
    max_tokens: int = 1024,
    max_retries: int = 4,
    metadata: Optional[dict] = None,
    **kwargs: Any,
) -> str:
    if metadata:
        kwargs.setdefault("metadata", metadata)

    chain = _model_chain(model, fallback_model)
    last_err: Optional[Exception] = None
    for i, m in enumerate(chain):
        if i > 0:
            cooldown = random.uniform(1, 3)
            _log.warning("provider %s exhausted — waiting %.1fs then trying %s", chain[i - 1], cooldown, m)
            time.sleep(cooldown)
        try:
            resp = _attempt_model(
                m, messages, max_retries=max_retries, stream=False,
                temperature=temperature, max_tokens=max_tokens, **kwargs,
            )
            if i > 0:
                _log.info("succeeded on fallback provider %s", m)
            return resp.choices[0].message.content or ""
        except Exception as err:
            last_err = err
            _log.warning("provider %s failed: %s", m, str(err)[:120])
            continue

    assert last_err is not None
    err_str = str(last_err)
    if "Invalid API Key" in err_str or "invalid_api_key" in err_str or "Missing" in err_str or "APIKey" in err_str:
        raise RuntimeError("LLM Provider Error: Invalid or missing GROQ_API_KEY / GEMINI_API_KEY in .env. Please set a valid free API key from https://console.groq.com/keys or https://aistudio.google.com.")
    raise last_err



@observe(name="llm-chat-stream")
def chat_stream(
    messages: list[dict],
    *,
    model: Optional[str] = None,
    fallback_model: Optional[str] = None,
    temperature: float = 0.2,
    max_tokens: int = 1024,
    max_retries: int = 2,
    metadata: Optional[dict] = None,
    **kwargs: Any,
) -> Iterator[str]:
    if metadata:
        kwargs.setdefault("metadata", metadata)

    emitted = 0  # tokens yielded so far — guards against mid-stream double-emit

    def _iter(m: str):
        nonlocal emitted
        resp = _attempt_model(
            m, messages, max_retries=max_retries, stream=True,
            temperature=temperature, max_tokens=max_tokens, **kwargs,
        )
        for chunk in resp:
            delta = chunk.choices[0].delta.content
            if delta:
                emitted += 1
                yield delta

    chain = _model_chain(model, fallback_model)
    last_err: Optional[Exception] = None
    for i, m in enumerate(chain):
        if emitted:
            break
        if i > 0:
            cooldown = random.uniform(1, 3)
            _log.warning("stream: provider %s exhausted — waiting %.1fs then trying %s",
                         chain[i - 1], cooldown, m)
            time.sleep(cooldown)
        try:
            yield from _iter(m)
            return
        except Exception as err:
            if emitted:
                raise
            last_err = err
            _log.warning("stream: provider %s failed: %s", m, str(err)[:120])
            continue

    if last_err is not None:
        raise last_err


def health_check() -> dict:
    """Cheap reachability probe for all providers (used by /health)."""
    status = {}
    for label, m in (
        ("primary",    PRIMARY_MODEL),
        ("fallback",   FALLBACK_MODEL),
        ("fallback_2", FALLBACK_MODEL_2),
    ):
        try:
            chat(
                [{"role": "user", "content": "ping"}],
                model=m,
                fallback_model=None,
                max_tokens=1,
                max_retries=0,
            )
            status[label] = {"model": m, "ok": True}
        except Exception as err:  # pragma: no cover - network dependent
            status[label] = {"model": m, "ok": False, "error": str(err)[:200]}
    return status
