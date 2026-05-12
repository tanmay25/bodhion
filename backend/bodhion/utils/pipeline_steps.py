import json
from typing import AsyncGenerator, Optional
from uuid import uuid4


# ── Step action constants ─────────────────────────────────────────────────────

STEP_PREPARING  = "preparing_request"
STEP_RETRIEVING = "retrieving_context"
STEP_RERANKING  = "reranking_results"
STEP_SELECTING  = "selecting_context"
STEP_GENERATING = "generating_response"
STEP_THINKING   = "model_thinking"


# ── Type alias (TypedDict not required here — plain dict is fine for SSE) ─────

def make_step(
    action: str,
    description: str,
    status: str,                          # "started" | "done" | "error"
    step_id: Optional[str] = None,
    metadata: Optional[dict] = None,
) -> dict:
    return {
        "id":          step_id or str(uuid4()),
        "action":      action,
        "description": description,
        "status":      status,
        "metadata":    metadata or {},
    }


def format_step_sse(step: dict) -> bytes:
    """Serialize a step dict as an SSE data line."""
    return f"data: {json.dumps({'step': step})}\n\n".encode()


# ── Convenience: paired started/done steps ───────────────────────────────────

def step_pair(
    action: str,
    started_description: str,
    done_description: str,
    metadata: Optional[dict] = None,
) -> tuple[dict, dict]:
    """Return a (started, done) pair sharing the same id so the frontend can update in place."""
    sid = str(uuid4())
    return (
        make_step(action, started_description, "started", step_id=sid),
        make_step(action, done_description,    "done",    step_id=sid, metadata=metadata),
    )


# ── Request inspection ────────────────────────────────────────────────────────

def _rag_files(payload: dict) -> list[dict]:
    """Return files that are RAG documents (have a collection_name, not plain images).

    Falls back to metadata["pipeline_rag_files"] because middleware pops "files"
    from form_data before the payload reaches the LLM router.
    """
    files = payload.get("files") or []
    rag = [f for f in files if isinstance(f, dict) and f.get("collection_name")]
    return rag or (payload.get("metadata") or {}).get("pipeline_rag_files") or []


def _web_search_enabled(payload: dict) -> bool:
    """Check if web search is active.

    Falls back to metadata["pipeline_web_search"] because middleware pops "features"
    from form_data before the payload reaches the LLM router.
    """
    features = payload.get("features") or {}
    if features.get("web_search"):
        return True
    return bool((payload.get("metadata") or {}).get("pipeline_web_search"))


def _is_openai_reasoning_model(model: str) -> bool:
    """Matches o1, o3, o4-mini, gpt-5, etc. — models with built-in chain-of-thought."""
    return bool(model) and model.lower().startswith(("o1", "o3", "o4", "gpt-5"))


def build_steps_for_request(payload: dict) -> list[dict]:
    """
    Inspect the chat completion payload and return the ordered list of step
    dicts (started + done pairs) to emit before the upstream LLM stream.

    The steps are yielded all-at-once before the first LLM token because the
    upstream pipeline (RAG, re-ranking) has already executed by the time we
    reach the streaming phase in the OpenAI router.
    """
    steps: list[dict] = []

    # 1 — Preparing
    s, d = step_pair(STEP_PREPARING, "Preparing request…", "Request prepared")
    steps += [s, d]

    rag = _rag_files(payload)
    web = _web_search_enabled(payload)

    # 2 — Retrieval (RAG documents)
    if rag:
        n = len(rag)
        label = f"{n} document{'s' if n > 1 else ''}"
        s, d = step_pair(
            STEP_RETRIEVING,
            f"Searching {label}…",
            f"Retrieved context from {label}",
            metadata={"file_count": n},
        )
        steps += [s, d]

        s, d = step_pair(STEP_RERANKING,  "Re-ranking results…",  "Results ranked")
        steps += [s, d]

        s, d = step_pair(STEP_SELECTING,  "Selecting best context…", "Context selected")
        steps += [s, d]

    # 2b — Retrieval (web search)
    elif web:
        s, d = step_pair(STEP_RETRIEVING, "Searching the web…", "Web results retrieved")
        steps += [s, d]

    # 3 — Model reasoning (o-series only: thinking is complete before first content token)
    if _is_openai_reasoning_model(payload.get("model", "")):
        s, d = step_pair(STEP_THINKING, "Reasoning…", "Reasoning complete")
        steps += [s, d]

    # 4 — Generating (started only — done is implicit when the stream ends)
    steps.append(make_step(STEP_GENERATING, "Generating response…", "started"))

    return steps


# ── Stream prefix injector ────────────────────────────────────────────────────

async def prefixed_with_steps(
    steps: list[dict],
    upstream: AsyncGenerator[bytes, None],
) -> AsyncGenerator[bytes, None]:
    """
    Async generator that yields step SSE events first, then transparently
    passes every byte from the upstream LLM stream through unchanged.
    """
    for step in steps:
        yield format_step_sse(step)
    async for chunk in upstream:
        yield chunk


# ── Claude extended thinking interceptor ─────────────────────────────────────

async def passthrough_with_claude_thinking(
    upstream: AsyncGenerator[bytes, None],
) -> AsyncGenerator[bytes, None]:
    """
    Transparent passthrough that injects model_thinking step events when
    Anthropic native SSE thinking blocks are detected in the upstream stream.

    Anthropic emits `content_block_start` with `content_block.type == "thinking"`
    at the start of a thinking block and `content_block_stop` when it ends.
    We convert those boundaries into started/done step pairs so ThinkingPanel
    can show real-time thinking progress for Claude models.
    """
    thinking_blocks: dict = {}  # block index -> step_id

    async for chunk in upstream:
        yield chunk  # always pass the original bytes through unchanged

        text = chunk.decode("utf-8", errors="ignore")
        data_str = None
        for line in text.split("\n"):
            stripped = line.strip()
            if stripped.startswith("data:"):
                data_str = stripped[5:].strip()
                break

        if not data_str or data_str in ("[DONE]", "{}"):
            continue

        try:
            data = json.loads(data_str)
        except (json.JSONDecodeError, TypeError):
            continue

        event = data.get("type")

        if event == "content_block_start":
            if data.get("content_block", {}).get("type") == "thinking":
                idx = data.get("index", 0)
                sid = str(uuid4())
                thinking_blocks[idx] = sid
                yield format_step_sse(
                    make_step(STEP_THINKING, "Thinking…", "started", step_id=sid)
                )

        elif event == "content_block_stop":
            idx = data.get("index", -1)
            if idx in thinking_blocks:
                sid = thinking_blocks.pop(idx)
                yield format_step_sse(
                    make_step(STEP_THINKING, "Thinking complete", "done", step_id=sid)
                )
