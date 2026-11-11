// Tests for the admin gate (site/src/protect.js): wrong-password lockout, constant-time
// compare, and refusing cross-site requests that would change something.
//   node site/tools/test_admin_gate.mjs
import { DatabaseSync } from "node:sqlite";
import { adminGate, ADMIN_MAX_FAILS } from "../src/protect.js";

let fails = 0;
function check(name, cond, got) {
  if (cond) { console.log("ok  ", name); return; }
  fails++; console.log("FAIL", name, "\n     ", JSON.stringify(got));
}
const db = new DatabaseSync(":memory:");
db.exec(`CREATE TABLE security_events (id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT, path TEXT, ip_hash TEXT, created_at TEXT)`);
const stmt = (sql, args = []) => ({
  bind: (...a) => stmt(sql, a),
  first: async () => db.prepare(sql).get(...args) ?? null,
  run: async () => { db.prepare(sql).run(...args); return { meta: {} }; },
});
const env = { DB: { prepare: (sql) => stmt(sql) }, ADMIN_PASSWORD: "correct horse battery", OPS_TOKEN: "t" };
const basic = (u, p) => "Basic " + btoa(`${u}:${p}`);
const req = ({ auth, method = "GET", ip = "1.1.1.1", origin, site, path = "/api/admin/dashboard" } = {}) =>
  new Request("https://minutesregained.com" + path, { method, headers: {
    ...(auth ? { Authorization: auth } : {}), "CF-Connecting-IP": ip, ...(origin ? { Origin: origin } : {}), ...(site ? { "Sec-Fetch-Site": site } : {}) } });
const good = basic("admin", env.ADMIN_PASSWORD);
const count = (kind) => db.prepare(`SELECT COUNT(*) AS n FROM security_events WHERE kind = ?`).get(kind).n;

check("right password passes", (await adminGate(req({ auth: good }), env)) === null);
let r = await adminGate(req({}), env);
check("no password: asked to sign in, not counted as an attempt", r.status === 401 && /Basic/.test(r.headers.get("WWW-Authenticate")) && count("admin_fail") === 0, r.status);
r = await adminGate(req({ auth: basic("admin", "wrong") }), env);
check("wrong password refused and counted", r.status === 401 && count("admin_fail") === 1, r.status);
check("wrong user refused", (await adminGate(req({ auth: basic("root", env.ADMIN_PASSWORD) }), env)).status === 401);
check("garbage header refused", (await adminGate(req({ auth: "Basic !!!" }), env)).status === 401);
check("a prefix of the password is refused", (await adminGate(req({ auth: basic("admin", "correct horse") }), env)).status === 401);
check("no password configured: nobody gets in", (await adminGate(req({ auth: basic("admin", "") }), { ...env, ADMIN_PASSWORD: "" })).status === 401);

db.exec(`DELETE FROM security_events`);
for (let i = 0; i < ADMIN_MAX_FAILS; i++) await adminGate(req({ auth: basic("admin", "guess" + i), ip: "6.6.6.6" }), env);
r = await adminGate(req({ auth: good, ip: "6.6.6.6" }), env);
check(`after ${ADMIN_MAX_FAILS} wrong tries that IP is locked out, even with the right password`, r.status === 429 && r.headers.get("Retry-After") === "900", r.status);
check("the lockout does not grow the log", count("admin_fail") === ADMIN_MAX_FAILS, count("admin_fail"));
check("another IP is not locked out", (await adminGate(req({ auth: good, ip: "2.2.2.2" }), env)) === null);
db.prepare(`UPDATE security_events SET created_at = ?`).run(new Date(Date.now() - 16 * 60000).toISOString());
check("the lockout lifts after the window", (await adminGate(req({ auth: good, ip: "6.6.6.6" }), env)) === null);

const post = (o) => req({ auth: good, method: "POST", path: "/api/admin/pause", ...o });
check("dashboard's own request passes", (await adminGate(post({ origin: "https://minutesregained.com", site: "same-origin" }), env)) === null);
check("a script with no Origin passes (curl, tools)", (await adminGate(post({}), env)) === null);
r = await adminGate(post({ origin: "https://evil.example" }), env);
check("another site's request is refused, even with the saved password", r.status === 403 && count("admin_cross_site") === 1, r.status);
check("cross-site by Sec-Fetch-Site is refused", (await adminGate(post({ site: "cross-site" }), env)).status === 403);
check("a look-alike origin is refused", (await adminGate(post({ origin: "https://minutesregained.com.evil.example" }), env)).status === 403);
check("reading the dashboard from a link elsewhere is fine", (await adminGate(req({ auth: good, site: "cross-site" }), env)) === null);

console.log(fails ? `\n${fails} FAILED` : "\nAll passed.");
process.exit(fails ? 1 : 0);
