import os

from dotenv import load_dotenv

load_dotenv()

CLAUDE_MODEL = "claude-opus-4-8"

DEFAULT_SYSTEM_PROMPT = os.environ.get(
    "ASSISTANT_SYSTEM_PROMPT",
    "You are a helpful, concise virtual assistant.",
)

DEFAULT_MAX_TOKENS = int(os.environ.get("ASSISTANT_MAX_TOKENS", "4096"))
