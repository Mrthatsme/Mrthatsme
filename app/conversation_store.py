import threading
import uuid
from typing import Optional

_lock = threading.Lock()
_conversations: dict[str, list[dict]] = {}


def get_or_create(conversation_id: Optional[str]) -> str:
    """Resolve a conversation id, creating a new one if none was given or it's unknown."""
    if conversation_id and conversation_id in _conversations:
        return conversation_id
    new_id = conversation_id or str(uuid.uuid4())
    with _lock:
        _conversations.setdefault(new_id, [])
    return new_id


def get_history(conversation_id: str) -> list[dict]:
    return list(_conversations.get(conversation_id, []))


def append_turn(conversation_id: str, user_message: str, assistant_reply: str) -> None:
    with _lock:
        history = _conversations.setdefault(conversation_id, [])
        history.append({"role": "user", "content": user_message})
        history.append({"role": "assistant", "content": assistant_reply})
