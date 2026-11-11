// Permission levels: Handle It, Tell Me, Ask Me, Never.
//
// Every customer email the agents read is put in one category, and the
// category follows the level the client set. The never-list in CLAUDE.md is
// enforced here as ceilings no setting can lift: a price question or a
// cancel/change request is never above Ask Me, and complaints, legal matters
// and payment or account changes are always Never.
//
// Our system has no send function. Until "approved replies" exist (exact
// wording the client approved going out on its own after the two-week trial,
// pending the attorney), Handle It and Tell Me on a reply still produce a
// draft, and the brief says so. They act for real where acting needs no send:
// routing an emergency to the client's own on-call staff (Tell Me), and
// quietly setting aside mail that isn't from a customer (Handle It).

export const LEVELS = ["Never", "Ask Me", "Tell Me", "Handle It"];
const RANK = { "Never": 0, "Ask Me": 1, "Tell Me": 2, "Handle It": 3 };

// default: what a new client starts with. max: the highest level allowed.
export const CATEGORIES = {
  new_lead: { label: "New customer asking about a job", default: "Ask Me", max: "Handle It" },
  customer_question: { label: "Existing customer with a question", default: "Ask Me", max: "Handle It" },
  scheduling: { label: "Booking or timing request", default: "Ask Me", max: "Handle It" },
  price_question: { label: "Price, quote or estimate question", default: "Ask Me", max: "Ask Me", why: "We never quote a price." },
  change_or_cancel: { label: "Cancel, reschedule or dispute", default: "Ask Me", max: "Ask Me", why: "We never confirm or refuse a change." },
  emergency: { label: "Emergency you listed", default: "Tell Me", max: "Tell Me" },
  complaint_or_legal: { label: "Complaint, refund or legal", default: "Never", max: "Never", why: "Always goes straight to you." },
  payment_or_account: { label: "Payment details or account changes", default: "Never", max: "Never", why: "Treated as possible fraud." },
  not_customer: { label: "Not from a customer (newsletters, receipts)", default: "Handle It", max: "Handle It" },
};

export const CATEGORY_IDS = Object.keys(CATEGORIES);

// The level that actually applies: the client's setting, capped by the ceiling.
export function effectiveLevel(profile, category) {
  const cat = CATEGORIES[category] || CATEGORIES.customer_question;
  const set = (profile.levels && LEVELS.includes(profile.levels[category])) ? profile.levels[category] : cat.default;
  return RANK[set] > RANK[cat.max] ? cat.max : set;
}

export const canAct = (level) => level === "Tell Me" || level === "Handle It";

// A sender on the client's Never list ("lawyer@firm.com" or "@mybank.com").
// Matched before anything is sent to the AI.
export function onNeverList(profile, from) {
  const addr = (String(from || "").match(/<([^>]+)>/) || [null, from])[1];
  const a = String(addr || "").trim().toLowerCase();
  if (!a) return false;
  return [].concat(profile.neverFrom || []).some((raw) => {
    const r = String(raw || "").trim().toLowerCase();
    if (!r) return false;
    return r.startsWith("@") ? a.endsWith(r) : a === r;
  });
}

// Validate a change from the dashboard. Returns { levels, neverFrom } or { error }.
export function validateLevels({ levels = {}, neverFrom = [] }) {
  const out = {};
  for (const [cat, lvl] of Object.entries(levels)) {
    if (!CATEGORIES[cat]) return { error: "unknown_category", category: cat };
    if (!LEVELS.includes(lvl)) return { error: "unknown_level", level: lvl };
    if (RANK[lvl] > RANK[CATEGORIES[cat].max]) {
      return { error: "above_ceiling", category: cat, max: CATEGORIES[cat].max, message: `${CATEGORIES[cat].label} can't be above ${CATEGORIES[cat].max}. ${CATEGORIES[cat].why || ""}`.trim() };
    }
    out[cat] = lvl;
  }
  const list = [].concat(neverFrom || []).map((s) => String(s).trim().toLowerCase()).filter(Boolean);
  for (const s of list) {
    if (!/^(@[a-z0-9.-]+\.[a-z]{2,}|[^\s@]+@[a-z0-9.-]+\.[a-z]{2,})$/.test(s)) return { error: "bad_never_from", value: s };
  }
  return { levels: out, neverFrom: list.slice(0, 100) };
}
