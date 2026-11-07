# Minutes Regained AI Receptionist

An AI that answers **(877) 896-8784** when Jerome can't pick up, books the free 30-minute assessment, and logs every call.
**For Minutes Regained only.** It isn't a client offer yet (see "Later: the client add-on" at the bottom).

## What's in this folder

| File | What it is |
|---|---|
| `vapi-assistant.json` | The voice assistant: greeting, script, rules, and its two tools (`check_availability`, `book_assessment`). |
| `system-prompt.md` | The same script as plain text, so it's easy to read and edit. Paste it into Vapi's **System Prompt** box. |
| `make-scenario.blueprint.json` | **One** Make scenario that handles everything. It's one scenario because the Make free plan limits how many can be active. |

## How a call flows

```
Caller → 877 number (no answer / after hours) → forwards to Vapi number → AI receptionist
   ├─ check_availability ─┐
   ├─ book_assessment ────┼─► Make webhook ─► outside hours?  → "pick another time"
   │                      │                  ─► Google Calendar busy? → "taken" / "open"
   │                      │                  ─► book → Calendar event + Sheet row → "booked"
   └─ call ends ──────────┴─► Make webhook ─► Sheet row: number, summary, duration, cost
```

Fixes compared with the Max Dental version:
- **No ChatGPT steps in Make.** The voice agent knows today's date and sends the exact time itself. That removes an OpenAI cost and the wrong-hour bugs.
- The scenario checks the slot is free **right before booking**, so it can't double-book.
- Weekend and after-hours requests get a real answer instead of an error or silence.
- One argument name everywhere: `start_time`.
- Replies say "Monday, November 9, 9:00 AM", not a raw timestamp.
- Every call gets logged with **its cost**, so you can see exactly what this is spending.

## Cost: what's actually free

| Piece | Cost to you |
|---|---|
| Make | **$0.** The free plan has about 1,000 operations a month. A booked call uses about 6 and a message-only call about 2, so there's room for well over 100 calls. |
| Google Calendar + Sheets | **$0** |
| OpenAI inside Make | **$0.** Removed. |
| Vapi | **Free trial credits to start, then pay per minute.** Expect roughly $0.10–0.20 a minute all-in. It's capped at 6 minutes a call. At about 20 calls a month × 3 minutes, that's around **$6–12 a month**. |

Answering a phone with AI isn't completely free anywhere. The minutes always cost something. These settings keep it close to zero:
1. Forward **only missed and after-hours calls** to Vapi. Calls you answer yourself never touch it.
2. `gpt-4o-mini` plus Vapi's built-in voice is the cheapest setup that still sounds good.
3. The 6-minute cap and 20-second silence timeout stop runaway calls.
4. Column J of the Sheet shows the cost of every call. Check it weekly.

**Check current pricing on Monday.** Vapi trial credits, free phone numbers and Make plan limits all change often.

## Monday morning setup (about 45–60 minutes)

1. **Google Sheet.** Create "Minutes Regained - Calls" with a tab named `Calls` and these headers in row 1:
   `Date | Type | Name | Business | Phone | Email | Appointment | Notes / summary | Ended reason | Duration / cost`
2. **Make** (free account, business email):
   - Scenarios → Create → ⋯ → **Import blueprint** → `make-scenario.blueprint.json`.
   - Click the webhook module → **Add** a new webhook → copy its URL.
   - Connect your Google account on the calendar and sheet modules, then pick the Sheet from step 1.
   - Optional: change `openHour` and `closeHour` in the "Call details + hours" module (default 9 AM–5 PM Eastern).
   - Turn the scenario **ON**.
3. **Vapi** (free account):
   - Create an assistant and paste in the settings from `vapi-assistant.json`. Easiest way: copy the prompt from `system-prompt.md`, then add the two tools with the same names and parameters. Replace `PASTE_MAKE_WEBHOOK_URL` with the Make webhook URL (in both tools **and** the assistant's Server URL).
   - Turn on the **end-of-call-report** server message.
   - Get a Vapi phone number and attach the assistant.
4. **Test from the browser first.** Use Vapi's "Talk" button and ask for "Monday morning". In Make, click **Run once** before the test call, then use **Redetermine data structure** on the webhook so the fields show up for mapping.
5. **Check the results.** You should see an event on your Google Calendar and two rows in the Sheet (a Booking row and a Call row).
6. **Only then**, in your 877 number provider, set **forward on no-answer / after hours** to the Vapi number.

### Test script
- "Can I book Monday morning?" → should check 9 AM Monday and book it.
- "How about Saturday?" → should say you're closed weekends and offer a weekday.
- "How much is it?" → should quote only the prices on the site.
- "Are you a real person?" → should say it's an AI assistant.
- Book the same slot twice → the second attempt should say it's taken.

## Later: the client add-on

Once there are enough clients and they ask for it, this becomes **"Call Catcher"**, an add-on to the automations already built for a client:
- It runs in the **client's own** Vapi, Make and Google accounts, the same as every other automation. Call minutes come out of their software allowance or get billed at cost, never paid by you.
- Same rules as the website: nothing with a price, promise or date goes out without the client's OK. During the two-week trial it **takes messages only**, then booking gets switched on.
- Note: the homepage currently says "We don't answer your phone." Update that line before you sell this.
- A starting price to consider: a flat monthly add-on on top of Business Support, plus call minutes passed through at cost. Test it with your own line first so you know the real per-call cost before you set a price.
