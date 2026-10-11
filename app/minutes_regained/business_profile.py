"""
Demo business persona for the Minutes Regained prototype agent.

This is a composite template based on real Florida roll-off dumpster rental
companies (family-owned, 5-50 employees, Tampa Bay service area) -- not scraped
facts about any specific real company. Before using this demo in outreach to an
actual prospect, swap these values for the real business's name, service area,
hours, and pricing confirmed during discovery.
"""

BUSINESS = {
    "name": "Sunshine Roll-Off Dumpster Rental",
    "location": "Tampa Bay, FL",
    "service_area_cities": [
        "Tampa",
        "St. Petersburg",
        "Clearwater",
        "Brandon",
        "Riverview",
        "Pinellas Park",
        "Largo",
        "Temple Terrace",
    ],
    "hours": "Mon-Fri 7am-6pm, Sat 8am-2pm, closed Sunday",
    "rental_period_days": 14,
    "extra_day_rate": 10,
    "prohibited_materials": [
        "hazardous waste",
        "tires",
        "paint or paint cans",
        "batteries",
        "appliances with refrigerant (fridges, AC units)",
    ],
}

DUMPSTER_SIZES = {
    10: {"label": "10-yard", "good_for": "small cleanout, bathroom remodel, yard debris", "price": 350},
    15: {"label": "15-yard", "good_for": "kitchen remodel, garage cleanout, medium renovation", "price": 400},
    20: {"label": "20-yard", "good_for": "roofing job, large remodel, estate cleanout", "price": 450},
    30: {"label": "30-yard", "good_for": "new construction, major demolition, commercial cleanout", "price": 550},
}

# What it costs the business in owner/staff minutes today, per inbound lead, to do
# this manually (read message, look up service area, check calendar, call back,
# confirm, enter into whatever they use as a CRM). Used only for the illustrative
# "minutes regained" estimate -- replace with real numbers from an actual audit.
ASSUMED_MANUAL_MINUTES_PER_LEAD = 14
ASSUMED_OWNER_MINUTES_PER_APPROVAL_REVIEW = 3
