from ..claude_client import client
from ..config import CLAUDE_MODEL
from .business_profile import BUSINESS, DUMPSTER_SIZES
from .tools import TOOLS, run_tool

AGENT_MAX_TOKENS = 1024
MAX_TOOL_ITERATIONS = 6


def _system_prompt() -> str:
    sizes = "\n".join(
        f"- {s['label']} (${s['price']}, for {s['good_for']})" for s in DUMPSTER_SIZES.values()
    )
    return f"""You are the virtual dispatcher for {BUSINESS['name']}, a family-owned roll-off \
dumpster rental company serving the {BUSINESS['location']} area. You handle inbound customer \
messages (website chat / text) the way a busy office manager would, but faster and always available.

Business hours: {BUSINESS['hours']}
Standard rental period: {BUSINESS['rental_period_days']} days (${BUSINESS['extra_day_rate']}/day after that)
Prohibited materials: {', '.join(BUSINESS['prohibited_materials'])}

Dumpster sizes:
{sizes}

How to handle a request:
1. Figure out what the customer is doing (cleanout, remodel, roofing, construction, etc.) and recommend \
a size if they haven't named one.
2. Call check_service_area before promising anything -- if they're outside the service area, say so \
plainly and still offer to log their info so a human can follow up (don't just end the conversation).
3. Call get_available_slots before offering any date/time -- never invent availability.
4. Once the customer confirms a size, date, and window, and everything is within standard policy, call \
book_delivery and give them the confirmation number and price.
5. Call flag_for_owner_approval instead of book_delivery for anything outside standard policy: a \
discount request, a rental longer than {BUSINESS['rental_period_days']} days, prohibited materials, a \
same-day/emergency request, or a commercial account wanting net terms. Tell the customer the owner will \
follow up shortly -- never promise a price, date, or exception yourself.
6. Keep replies short and conversational, like a text message -- 1-3 sentences. Ask for one missing \
piece of information at a time rather than a long form.

You only know what the tools tell you. Never state a price, availability, or policy exception without \
having called the relevant tool first.
"""


def _text_from(content_blocks) -> str:
    return "".join(block.text for block in content_blocks if block.type == "text")


def run_turn(history: list[dict], user_message: str) -> tuple[str, list[dict]]:
    """Run one user turn through the tool-use loop. Returns (reply_text, updated_history)."""
    messages = history + [{"role": "user", "content": user_message}]

    for _ in range(MAX_TOOL_ITERATIONS):
        response = client.messages.create(
            model=CLAUDE_MODEL,
            max_tokens=AGENT_MAX_TOKENS,
            system=_system_prompt(),
            tools=TOOLS,
            messages=messages,
        )

        messages.append({"role": "assistant", "content": response.content})

        if response.stop_reason != "tool_use":
            reply = _text_from(response.content)
            return reply, messages

        tool_results = []
        for block in response.content:
            if block.type == "tool_use":
                result = run_tool(block.name, block.input)
                tool_results.append(
                    {
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": str(result),
                    }
                )
        messages.append({"role": "user", "content": tool_results})

    return (
        "Sorry, I'm having trouble finishing that -- let me have someone from our team follow up with you directly.",
        messages,
    )
