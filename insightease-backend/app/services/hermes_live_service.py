"""Live Hermes Agent client for bounded result explanation.

This module is intentionally small and isolated. It calls only the remote
Hermes Agent from the backend, never from the browser, and it accepts only the
validated SafeResultSummary-style payload prepared by the endpoint.
"""

from __future__ import annotations

import asyncio
import json
from typing import Any, Dict, List
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from app.schemas.hermes import (
    HermesExplainResultRequest,
    HermesExplainResultResponse,
    HermesRecommendedAction,
)


MAX_ANSWER_CHARS = 6000
MAX_LIST_ITEMS = 8
MAX_ITEM_CHARS = 500


class HermesLiveError(RuntimeError):
    """Raised when Hermes live explanation cannot produce a valid response."""


async def probe_hermes_health(
    *,
    base_url: str,
    auth_token: str | None,
    timeout_ms: int,
) -> Dict[str, Any]:
    """Probe the Hermes Agent health endpoint without exposing secrets."""
    url = _join_url(base_url, "health")
    return await _request_json("GET", url, None, auth_token, timeout_ms)


async def explain_result_with_live_hermes(
    *,
    request: HermesExplainResultRequest,
    base_url: str,
    auth_token: str,
    model: str,
    timeout_ms: int,
) -> HermesExplainResultResponse:
    """Call live Hermes for result explanation and validate the response."""
    payload = {
        "model": model,
        "temperature": 0.2,
        "messages": [
            {
                "role": "system",
                "content": (
                    "You are Hermes for InsightEase. Explain analysis results using only "
                    "the provided SafeResultSummary, explanation_hints, and bounded metadata. "
                    "Do not infer from raw dataset rows or raw result_data, do not request "
                    "SQL execution, do not propose joins as already executed, and do not "
                    "claim that analysis was rerun. Prefer module-specific explanation_hints "
                    "when present, clearly separate confirmed findings from limitations, and "
                    "say when deeper interpretation requires opening the full result page. "
                    "Return strict JSON with keys: answer, key_findings, risks_and_caveats, "
                    "suggested_next_steps, recommended_actions, confidence."
                ),
            },
            {
                "role": "user",
                "content": json.dumps(
                    {
                        "user_question": request.user_question,
                        "result_summary": request.result_summary,
                        "assistant_context": request.assistant_context or {},
                        "safety": {
                            "allow_raw_data": False,
                            "allow_auto_run": False,
                            "allow_sql_generation": False,
                            "allow_dataset_mutation": False,
                        },
                    },
                    ensure_ascii=False,
                    default=str,
                ),
            },
        ],
    }

    raw_response = await _request_json(
        "POST",
        _join_url(base_url, "chat/completions"),
        payload,
        auth_token,
        timeout_ms,
    )
    return parse_hermes_explain_response(raw_response)


def parse_hermes_explain_response(value: Any) -> HermesExplainResultResponse:
    """Parse direct or OpenAI-compatible Hermes responses into the safe schema."""
    candidate = _extract_response_candidate(value)
    if not isinstance(candidate, dict):
        raise HermesLiveError("Hermes response did not contain a parseable object.")

    answer = _safe_text(candidate.get("answer") or candidate.get("summary") or candidate.get("content"))
    if not answer:
        raise HermesLiveError("Hermes response did not include an answer.")

    confidence = candidate.get("confidence")
    if confidence not in {"low", "medium", "high"}:
        confidence = "medium"

    return HermesExplainResultResponse(
        answer=answer,
        key_findings=_safe_text_list(candidate.get("key_findings") or candidate.get("findings")),
        risks_and_caveats=_safe_text_list(
            candidate.get("risks_and_caveats")
            or candidate.get("risks")
            or candidate.get("caveats")
        ),
        suggested_next_steps=_safe_text_list(
            candidate.get("suggested_next_steps")
            or candidate.get("next_steps")
            or candidate.get("recommendations")
        ),
        recommended_actions=_safe_actions(candidate.get("recommended_actions")),
        confidence=confidence,
        fallback_used=False,
    )


def _extract_response_candidate(value: Any) -> Any:
    if isinstance(value, dict):
        if any(key in value for key in ("answer", "summary", "key_findings")):
            return value

        choices = value.get("choices")
        if isinstance(choices, list) and choices:
            first = choices[0]
            if isinstance(first, dict):
                message = first.get("message")
                if isinstance(message, dict):
                    content = message.get("content")
                    parsed = _parse_json_text(content)
                    return parsed if parsed is not None else {"answer": content}

                text = first.get("text")
                parsed = _parse_json_text(text)
                return parsed if parsed is not None else {"answer": text}

        output_text = value.get("output_text")
        parsed = _parse_json_text(output_text)
        if parsed is not None:
            return parsed
        if isinstance(output_text, str):
            return {"answer": output_text}

    return value


def _parse_json_text(value: Any) -> Any:
    if not isinstance(value, str) or not value.strip():
        return None

    text = value.strip()
    if text.startswith("```"):
        lines = text.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].startswith("```"):
            lines = lines[:-1]
        text = "\n".join(lines).strip()
        if text.lower().startswith("json"):
            text = text[4:].strip()

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return None


async def _request_json(
    method: str,
    url: str,
    payload: Dict[str, Any] | None,
    auth_token: str | None,
    timeout_ms: int,
) -> Dict[str, Any]:
    timeout_seconds = max(timeout_ms, 1000) / 1000
    return await asyncio.to_thread(
        _request_json_sync,
        method,
        url,
        payload,
        auth_token,
        timeout_seconds,
    )


def _request_json_sync(
    method: str,
    url: str,
    payload: Dict[str, Any] | None,
    auth_token: str | None,
    timeout_seconds: float,
) -> Dict[str, Any]:
    body = json.dumps(payload, ensure_ascii=False, default=str).encode("utf-8") if payload is not None else None
    headers = {"Accept": "application/json"}
    if body is not None:
        headers["Content-Type"] = "application/json"
    if auth_token:
        headers["Authorization"] = f"Bearer {auth_token}"

    request = Request(url, data=body, headers=headers, method=method)
    try:
        with urlopen(request, timeout=timeout_seconds) as response:
            raw_body = response.read().decode("utf-8")
    except HTTPError as exc:
        raise HermesLiveError(f"Hermes provider returned HTTP {exc.code}.") from exc
    except URLError as exc:
        raise HermesLiveError("Hermes provider is unavailable.") from exc
    except TimeoutError as exc:
        raise HermesLiveError("Hermes provider timed out.") from exc
    except OSError as exc:
        raise HermesLiveError("Hermes provider request failed.") from exc

    try:
        parsed = json.loads(raw_body)
    except json.JSONDecodeError as exc:
        raise HermesLiveError("Hermes provider returned non-JSON content.") from exc

    if not isinstance(parsed, dict):
        raise HermesLiveError("Hermes provider returned an invalid JSON shape.")
    return parsed


def _join_url(base_url: str, path: str) -> str:
    return f"{base_url.rstrip('/')}/{path.lstrip('/')}"


def _safe_text(value: Any, max_length: int = MAX_ANSWER_CHARS) -> str:
    if value is None:
        return ""
    text = str(value).strip()
    if len(text) > max_length:
        return f"{text[:max_length]}..."
    return text


def _safe_text_list(value: Any) -> List[str]:
    if isinstance(value, list):
        return [
            item
            for item in (_safe_text(entry, MAX_ITEM_CHARS) for entry in value)
            if item
        ][:MAX_LIST_ITEMS]
    if isinstance(value, str) and value.strip():
        return [_safe_text(value, MAX_ITEM_CHARS)]
    return []


def _safe_actions(value: Any) -> List[HermesRecommendedAction]:
    if not isinstance(value, list):
        return []

    actions: List[HermesRecommendedAction] = []
    for item in value[:MAX_LIST_ITEMS]:
        if not isinstance(item, dict):
            continue
        label = _safe_text(item.get("label"), 120)
        action_type = item.get("action_type")
        if not label or action_type not in {
            "navigate",
            "generate_plan",
            "ask_clarifying_question",
            "requires_confirmation",
        }:
            continue
        actions.append(
            HermesRecommendedAction(
                label=label,
                action_type=action_type,
                target=_safe_text(item.get("target"), 300) or None,
                reason=_safe_text(item.get("reason"), 300) or None,
            )
        )
    return actions
