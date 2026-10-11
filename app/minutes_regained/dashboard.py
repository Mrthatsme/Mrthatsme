from . import mock_crm
from .business_profile import ASSUMED_MANUAL_MINUTES_PER_LEAD, ASSUMED_OWNER_MINUTES_PER_APPROVAL_REVIEW


def compute_stats() -> dict:
    bookings = mock_crm.list_bookings()
    approvals = mock_crm.list_approval_queue()

    bookings_count = len(bookings)
    approvals_count = len(approvals)
    total_leads = bookings_count + approvals_count

    minutes_regained = (
        bookings_count * ASSUMED_MANUAL_MINUTES_PER_LEAD
        + approvals_count * (ASSUMED_MANUAL_MINUTES_PER_LEAD - ASSUMED_OWNER_MINUTES_PER_APPROVAL_REVIEW)
    )

    return {
        "total_leads_handled": total_leads,
        "bookings_auto_completed": bookings_count,
        "approvals_flagged_for_owner": approvals_count,
        "assumptions": {
            "manual_minutes_per_lead_today": ASSUMED_MANUAL_MINUTES_PER_LEAD,
            "owner_review_minutes_per_approval": ASSUMED_OWNER_MINUTES_PER_APPROVAL_REVIEW,
            "note": (
                "Illustrative defaults for this demo, not a verified audit of any specific business. "
                "Replace with real numbers gathered during discovery before using these figures with a client."
            ),
        },
        "estimated_minutes_regained": minutes_regained,
        "estimated_hours_regained": round(minutes_regained / 60, 1),
    }
