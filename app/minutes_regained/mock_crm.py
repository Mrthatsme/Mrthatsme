"""
Minimal mock CRM for the demo agent: bookings the agent completed on its own,
and an approval queue for anything outside standard policy that needs a human.

This stands in for "write to the client's real CRM" -- in an actual engagement
this module is replaced by calls into whatever system the business already uses
(ServiceTitan, Jobber, a spreadsheet, etc.), per the Minutes Regained principle
of integrating into what the client has rather than forcing a new tool on them.
"""

import os
import sqlite3
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone

DB_PATH = os.path.join(os.path.dirname(__file__), "mock_crm.db")


@contextmanager
def _connect():
    conn = sqlite3.connect(DB_PATH)
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db() -> None:
    with _connect() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS bookings (
                confirmation_number TEXT PRIMARY KEY,
                customer_name TEXT NOT NULL,
                phone TEXT NOT NULL,
                address TEXT NOT NULL,
                city TEXT NOT NULL,
                size_yards INTEGER NOT NULL,
                delivery_date TEXT NOT NULL,
                delivery_window TEXT NOT NULL,
                project_description TEXT,
                created_at TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS approval_queue (
                ticket_id TEXT PRIMARY KEY,
                reason TEXT NOT NULL,
                customer_name TEXT NOT NULL,
                phone TEXT NOT NULL,
                details TEXT,
                status TEXT NOT NULL DEFAULT 'pending',
                created_at TEXT NOT NULL
            )
            """
        )


def create_booking(
    customer_name: str,
    phone: str,
    address: str,
    city: str,
    size_yards: int,
    delivery_date: str,
    delivery_window: str,
    project_description: str,
) -> str:
    confirmation_number = "SR-" + uuid.uuid4().hex[:6].upper()
    with _connect() as conn:
        conn.execute(
            """
            INSERT INTO bookings (
                confirmation_number, customer_name, phone, address, city,
                size_yards, delivery_date, delivery_window, project_description, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                confirmation_number,
                customer_name,
                phone,
                address,
                city,
                size_yards,
                delivery_date,
                delivery_window,
                project_description,
                datetime.now(timezone.utc).isoformat(),
            ),
        )
    return confirmation_number


def create_approval_ticket(reason: str, customer_name: str, phone: str, details: str) -> str:
    ticket_id = "APR-" + uuid.uuid4().hex[:6].upper()
    with _connect() as conn:
        conn.execute(
            """
            INSERT INTO approval_queue (ticket_id, reason, customer_name, phone, details, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (ticket_id, reason, customer_name, phone, details, datetime.now(timezone.utc).isoformat()),
        )
    return ticket_id


def list_bookings() -> list[dict]:
    with _connect() as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute("SELECT * FROM bookings ORDER BY created_at DESC").fetchall()
        return [dict(row) for row in rows]


def list_approval_queue(status: str | None = None) -> list[dict]:
    with _connect() as conn:
        conn.row_factory = sqlite3.Row
        if status:
            rows = conn.execute(
                "SELECT * FROM approval_queue WHERE status = ? ORDER BY created_at DESC", (status,)
            ).fetchall()
        else:
            rows = conn.execute("SELECT * FROM approval_queue ORDER BY created_at DESC").fetchall()
        return [dict(row) for row in rows]


init_db()
