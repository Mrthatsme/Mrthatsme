"""
Tool definitions and implementations for the Minutes Regained demo agent.

Four tools map directly onto the Level 2 "Automate" workflow from the Minutes
Regained playbook: check service area -> check availability -> book -> notify.
A fifth, flag_for_owner_approval, is the Level 1 "Assist" risk gate -- anything
outside standard policy (discounts, rental-length exceptions, prohibited
materials, same-day emergencies) goes to a human instead of being auto-confirmed.
That gate is the actual product differentiator, not the booking logic itself.
"""

import hashlib
from datetime import date, datetime, timedelta

from . import mock_crm
from .business_profile import BUSINESS, DUMPSTER_SIZES

TOOLS = [
    {
        "name": "check_service_area",
        "description": "Check whether a city is inside the business's delivery service area.",
        "input_schema": {
            "type": "object",
            "properties": {
                "city": {"type": "string", "description": "City the customer needs delivery to, e.g. 'Brandon'"}
            },
            "required": ["city"],
        },
    },
    {
        "name": "get_available_slots",
        "description": (
            "Get available delivery date/time windows for a given dumpster size, starting from a date. "
            "Call this before offering any delivery time to the customer."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "size_yards": {"type": "integer", "enum": [10, 15, 20, 30]},
                "start_date": {"type": "string", "description": "Earliest date to search from, YYYY-MM-DD"},
            },
            "required": ["size_yards", "start_date"],
        },
    },
    {
        "name": "book_delivery",
        "description": (
            "Confirm a delivery booking for a customer who is within the service area, has picked an "
            "available slot, and whose request fits standard policy (standard rental length, no "
            "prohibited materials, no discount requested)."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "customer_name": {"type": "string"},
                "phone": {"type": "string"},
                "address": {"type": "string"},
                "city": {"type": "string"},
                "size_yards": {"type": "integer", "enum": [10, 15, 20, 30]},
                "delivery_date": {"type": "string", "description": "YYYY-MM-DD"},
                "delivery_window": {"type": "string", "description": "e.g. '7am-10am'"},
                "project_description": {"type": "string"},
            },
            "required": [
                "customer_name",
                "phone",
                "address",
                "city",
                "size_yards",
                "delivery_date",
                "delivery_window",
                "project_description",
            ],
        },
    },
    {
        "name": "flag_for_owner_approval",
        "description": (
            "Use this INSTEAD OF book_delivery whenever the request falls outside standard policy: "
            "a discount or price-match request, a rental longer than the standard period, prohibited "
            "materials, a same-day/emergency request, a commercial account asking for net terms, or "
            "anything else you are not confident is safe to confirm automatically. Tell the customer "
            "the owner will follow up shortly -- do not promise a price or date yourself."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "reason": {"type": "string", "description": "Why this needs human review"},
                "customer_name": {"type": "string"},
                "phone": {"type": "string"},
                "details": {"type": "string", "description": "Everything relevant for the owner to follow up"},
            },
            "required": ["reason", "customer_name", "phone", "details"],
        },
    },
]


def check_service_area(city: str) -> dict:
    normalized = city.strip().lower()
    in_area = any(normalized == c.lower() for c in BUSINESS["service_area_cities"])
    return {
        "in_service_area": in_area,
        "service_area_cities": BUSINESS["service_area_cities"],
    }


def get_available_slots(size_yards: int, start_date: str) -> dict:
    if size_yards not in DUMPSTER_SIZES:
        return {"error": f"size_yards must be one of {list(DUMPSTER_SIZES)}"}

    try:
        start = datetime.strptime(start_date, "%Y-%m-%d").date()
    except ValueError:
        start = date.today()

    windows = ["7am-10am", "12pm-3pm"]
    slots = []
    checked = 0
    day = start
    while len(slots) < 4 and checked < 10:
        if day.weekday() < 5:  # Mon-Fri only for this demo
            for window in windows:
                # Deterministic pseudo-availability so repeated calls on the same
                # day are consistent, without needing a real dispatch calendar.
                digest = hashlib.sha256(f"{day.isoformat()}-{window}-{size_yards}".encode()).hexdigest()
                if int(digest[:2], 16) % 3 != 0:  # ~2/3 of slots "available"
                    slots.append({"date": day.isoformat(), "window": window})
        day += timedelta(days=1)
        checked += 1

    return {"size_yards": size_yards, "price": DUMPSTER_SIZES[size_yards]["price"], "available_slots": slots[:4]}


def book_delivery(
    customer_name: str,
    phone: str,
    address: str,
    city: str,
    size_yards: int,
    delivery_date: str,
    delivery_window: str,
    project_description: str,
) -> dict:
    confirmation_number = mock_crm.create_booking(
        customer_name=customer_name,
        phone=phone,
        address=address,
        city=city,
        size_yards=size_yards,
        delivery_date=delivery_date,
        delivery_window=delivery_window,
        project_description=project_description,
    )
    return {
        "confirmation_number": confirmation_number,
        "price": DUMPSTER_SIZES[size_yards]["price"],
        "rental_period_days": BUSINESS["rental_period_days"],
    }


def flag_for_owner_approval(reason: str, customer_name: str, phone: str, details: str) -> dict:
    ticket_id = mock_crm.create_approval_ticket(reason=reason, customer_name=customer_name, phone=phone, details=details)
    return {"ticket_id": ticket_id, "status": "pending_owner_review"}


DISPATCH = {
    "check_service_area": lambda **kw: check_service_area(**kw),
    "get_available_slots": lambda **kw: get_available_slots(**kw),
    "book_delivery": lambda **kw: book_delivery(**kw),
    "flag_for_owner_approval": lambda **kw: flag_for_owner_approval(**kw),
}


def run_tool(name: str, tool_input: dict) -> dict:
    handler = DISPATCH.get(name)
    if handler is None:
        return {"error": f"Unknown tool: {name}"}
    try:
        return handler(**tool_input)
    except TypeError as e:
        return {"error": f"Bad input for {name}: {e}"}
