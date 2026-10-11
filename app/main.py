import json

import anthropic
from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse

from . import conversation_store as store
from .claude_client import client, send_message
from .config import CLAUDE_MODEL, DEFAULT_MAX_TOKENS, DEFAULT_SYSTEM_PROMPT
from .minutes_regained.router import router as minutes_regained_router
from .schemas import ChatRequest, ChatResponse

app = FastAPI(title="Minutes Regained")
app.include_router(minutes_regained_router)


@app.get("/health")
def health():
    return {"status": "ok", "model": CLAUDE_MODEL}


@app.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest):
    conversation_id = store.get_or_create(req.conversation_id)
    history = store.get_history(conversation_id)

    try:
        reply = send_message(history, req.message)
    except anthropic.AuthenticationError:
        raise HTTPException(status_code=500, detail="Claude API authentication failed. Check ANTHROPIC_API_KEY.")
    except anthropic.RateLimitError:
        raise HTTPException(status_code=429, detail="Rate limited by the Claude API. Try again shortly.")
    except anthropic.APIStatusError as e:
        raise HTTPException(status_code=502, detail=f"Claude API error: {e.message}")
    except anthropic.APIConnectionError:
        raise HTTPException(status_code=502, detail="Could not reach the Claude API.")

    store.append_turn(conversation_id, req.message, reply)
    return ChatResponse(reply=reply, conversation_id=conversation_id)


@app.post("/chat/stream")
def chat_stream(req: ChatRequest):
    conversation_id = store.get_or_create(req.conversation_id)
    history = store.get_history(conversation_id)
    messages = history + [{"role": "user", "content": req.message}]

    def event_generator():
        collected: list[str] = []
        try:
            with client.messages.stream(
                model=CLAUDE_MODEL,
                max_tokens=DEFAULT_MAX_TOKENS,
                system=DEFAULT_SYSTEM_PROMPT,
                messages=messages,
            ) as stream:
                for text in stream.text_stream:
                    collected.append(text)
                    yield f"data: {json.dumps({'text': text})}\n\n"
        except anthropic.APIError as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
            return

        full_reply = "".join(collected)
        store.append_turn(conversation_id, req.message, full_reply)
        yield f"data: {json.dumps({'done': True, 'conversation_id': conversation_id})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")
