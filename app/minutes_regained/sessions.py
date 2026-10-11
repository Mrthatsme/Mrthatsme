import threading

_lock = threading.Lock()
_sessions: dict[str, list[dict]] = {}


def get_history(session_id: str) -> list[dict]:
    with _lock:
        return list(_sessions.get(session_id, []))


def save_history(session_id: str, messages: list[dict]) -> None:
    with _lock:
        _sessions[session_id] = messages
