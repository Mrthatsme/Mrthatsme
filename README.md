- 👋 Hi, I’m @Mrthatsme
- 👀 I’m interested in call of duty...
- 🌱 I’m currently learning .basics to cybersecurity..
- 💞️ I’m looking to collaborate on ...
- 📫 How to reach me ...
- 😄 Pronouns: ...
- ⚡ Fun fact: ...

<!---
Mrthatsme/Mrthatsme is a ✨ special ✨ repository because its `README.md` (this file) appears on your GitHub profile.
You can click the Preview link to take a look at your changes.
--->

## Virtual Assistant Service

A small FastAPI service that answers chat messages using the Claude API, with per-conversation history and both a plain and a streaming (SSE) endpoint. Conversation history is kept in memory only — it resets when the server restarts.

### Setup

```bash
pip install -r requirements.txt
cp .env.example .env   # then fill in ANTHROPIC_API_KEY
uvicorn app.main:app --reload
```

### Endpoints

- `GET /health` — status check
- `POST /chat` — `{"message": "...", "conversation_id": "optional"}` → `{"reply": "...", "conversation_id": "..."}`
- `POST /chat/stream` — same request body, streams the reply as Server-Sent Events

First call omits `conversation_id`; use the one returned in the response to continue the same conversation on later calls.

## Minutes Regained — Demo Agent (`/mr/*`)

A working prototype of the first Minutes Regained product (the "Automation Sprint"): a lead-intake-and-scheduling agent for a service business, built around a Claude tool-use loop rather than a plain chatbot.

Persona: a composite Florida roll-off dumpster rental company (`app/minutes_regained/business_profile.py`) — swap in a real prospect's name, service area, hours, and pricing before using this in outreach.

- `GET /mr/business` — the business profile the agent is configured for
- `POST /mr/chat` — `{"message": "...", "session_id": "..."}` → chats with the dispatcher agent. It checks service area, checks availability, and books a delivery automatically when the request is within standard policy. Anything outside policy (discount requests, rental-length exceptions, prohibited materials, same-day/emergency requests) is flagged to `/mr/approvals` instead of being auto-confirmed — this human-approval gate is the actual product differentiator, not the booking logic.
- `GET /mr/bookings` — bookings the agent completed on its own (mock CRM — a real engagement replaces this with the client's actual CRM)
- `GET /mr/approvals` — the human-approval queue
- `GET /mr/minutes-regained` — illustrative ROI stats (minutes/hours regained) computed from the bookings and approvals handled so far. The underlying assumptions are placeholders — replace with real numbers from an actual Operations Audit before using with a client.

The bookings/approvals data lives in a local SQLite file (`app/minutes_regained/mock_crm.db`, gitignored) that resets if you delete it.

