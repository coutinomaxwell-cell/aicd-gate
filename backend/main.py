import os

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

app = FastAPI(title="AICD Gate API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
MODEL_NAME = os.getenv("OLLAMA_MODEL", "gemma3:4b")

SYSTEM_PROMPT = """
You are the AI reasoning assistant inside AICD Gate, a
software development workflow and constraint management system.

Your job is to help users turn software ideas into:
- Clear, testable requirements
- Explicit constraints and assumptions
- Implementation plans and algorithms
- Task dependencies and priorities
- Acceptance criteria and verification procedures
- Risk assessments and edge-case checks

Rules:
1. Ask focused questions when important information is missing.
2. Distinguish confirmed requirements from assumptions.
3. Provide practical, structured, actionable answers.
4. Identify dependencies, risks, and testable acceptance criteria.
5. Never claim code was executed, tested, inspected, or verified
   unless actual tool evidence supports that claim.
6. Your own generated answer is not proof of correctness.
7. Identify decisions that require human approval.
8. Do not invent project facts, test results, or completed actions.
9. Respect user constraints and explain conflicts clearly.
10. Help the user make progress one concrete step at a time.
"""


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=12000)
    history: list[dict[str, str]] = Field(
        default_factory=list,
        max_length=20,
    )


class ChatResponse(BaseModel):
    reply: str
    model: str


@app.get("/api/health")
async def health():
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"{OLLAMA_URL}/api/tags")
            response.raise_for_status()
            models = response.json().get("models", [])

        available = any(
            item.get("name") == MODEL_NAME
            or item.get("name", "").startswith(MODEL_NAME + ":")
            for item in models
        )

        return {
            "api": "ok",
            "ollama": "connected",
            "model": MODEL_NAME,
            "model_available": available,
        }

    except (httpx.HTTPError, ValueError):
        return {
            "api": "ok",
            "ollama": "unavailable",
            "model": MODEL_NAME,
            "model_available": False,
        }


@app.post("/api/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT}
    ]

    for item in request.history:
        role = item.get("role")
        content = item.get("content", "")

        if (
            role in ("user", "assistant")
            and isinstance(content, str)
            and content.strip()
        ):
            messages.append({
                "role": role,
                "content": content[:12000],
            })

    messages.append({
        "role": "user",
        "content": request.message,
    })

    try:
        async with httpx.AsyncClient(timeout=180.0) as client:
            response = await client.post(
                f"{OLLAMA_URL}/api/chat",
                json={
                    "model": MODEL_NAME,
                    "messages": messages,
                    "stream": False,
                },
            )
            response.raise_for_status()
            data = response.json()

        reply = data.get("message", {}).get("content", "").strip()

        if not reply:
            raise HTTPException(
                status_code=502,
                detail="The model returned an empty response.",
            )

        return ChatResponse(
            reply=reply,
            model=MODEL_NAME,
        )

    except httpx.TimeoutException:
        raise HTTPException(
            status_code=504,
            detail="Gemma took too long to respond. Please try again.",
        )

    except httpx.HTTPStatusError as exc:
        raise HTTPException(
            status_code=502,
            detail=(
                f"Ollama returned HTTP {exc.response.status_code}. "
                "Check that the model is available."
            ),
        )

    except httpx.RequestError:
        raise HTTPException(
            status_code=503,
            detail="Cannot reach Ollama. Check that Ollama is running.",
        )
