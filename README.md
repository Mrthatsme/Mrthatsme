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
