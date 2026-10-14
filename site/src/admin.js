// Lightweight HTTP Basic Auth gate for the /api/admin/* CRM views.
// This is a v1 — swap for Cloudflare Access in front of /admin* if the
// CRM needs more than one person to have access, or finer-grained roles.

export function requireAdmin(request, env) {
  const auth = request.headers.get("Authorization") || "";
  if (!auth.startsWith("Basic ")) return false;
  let decoded;
  try {
    decoded = atob(auth.slice(6));
  } catch {
    return false;
  }
  const sep = decoded.indexOf(":");
  if (sep < 0) return false;
  const user = decoded.slice(0, sep);
  const pass = decoded.slice(sep + 1);
  return user === "admin" && pass === env.ADMIN_PASSWORD && !!env.ADMIN_PASSWORD;
}

export function unauthorizedResponse() {
  return new Response("Authentication required.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Minutes Regained CRM"' },
  });
}

export function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

export function renderAdminPage({ leads, contracts, clients, payments }) {
  const table = (title, rows, cols) => `
    <h2>${title} (${rows.length})</h2>
    <table>
      <thead><tr>${cols.map((c) => `<th>${escapeHtml(c)}</th>`).join("")}</tr></thead>
      <tbody>
        ${rows
          .map(
            (r) => `<tr>${cols.map((c) => `<td>${escapeHtml(r[c] ?? "")}</td>`).join("")}</tr>`
          )
          .join("")}
      </tbody>
    </table>`;

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Minutes Regained — CRM</title>
<style>
  body{font-family:system-ui,sans-serif;margin:2rem;color:#111;background:#fdfae7}
  h1{margin-bottom:.25rem} h2{margin-top:2.5rem;font-size:1.05rem;text-transform:uppercase;letter-spacing:.04em;color:#1e2bfa}
  table{width:100%;border-collapse:collapse;font-size:.85rem;background:#fff}
  th,td{border:1px solid #ddd;padding:.4rem .5rem;text-align:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:220px}
  th{background:#f4f4ea}
</style></head>
<body>
  <h1>Minutes Regained — internal CRM</h1>
  <p>Leads, contracts, clients, and payments. Not linked from the public site.</p>
  ${table("Leads", leads, ["id", "name", "business", "contact", "status", "triage_status", "triage_note", "created_at"])}
  ${table("Contracts", contracts, ["id", "plan_label", "price_cents", "founding_offer", "business_name", "signer_name", "status", "created_at"])}
  ${table("Clients", clients, ["id", "business_name", "contact_name", "plan_id", "status", "created_at"])}
  ${table("Payments", payments, ["id", "client_id", "amount_cents", "currency", "status", "occurred_at"])}
</body></html>`;
}
