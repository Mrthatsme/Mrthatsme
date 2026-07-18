import anthropic

from .config import CLAUDE_MODEL, DEFAULT_MAX_TOKENS, DEFAULT_SYSTEM_PROMPT

# Zero-arg client resolves credentials from the environment (ANTHROPIC_API_KEY,
# ANTHROPIC_AUTH_TOKEN, or an `ant auth login` profile) — never hardcode a key.
client = anthropic.Anthropic()


def send_message(
    history: list[dict],
    user_message: str,
    system_prompt: str = DEFAULT_SYSTEM_PROMPT,
) -> str:
    """Send one turn to Claude and return the assistant's text reply."""
    messages = history + [{"role": "user", "content": user_message}]
    response = client.messages.create(
        model=CLAUDE_MODEL,
        max_tokens=DEFAULT_MAX_TOKENS,
        system=system_prompt,
        messages=messages,
    )
    return next((block.text for block in response.content if block.type == "text"), "")
