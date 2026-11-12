// Tests that /api/agree and /api/checkout are rate-limited per IP once sign-ups open,
// and stay closed while they're closed.   node site/tools/test_signup_limits.mjs
import { DatabaseSync } from "node:sqlite";
import worker from "../src/worker.js";

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
  all: async () => ({ results: db.prepare(sql).all(...args) }),
  run: async () => { db.prepare(sql).run(...args); return { meta: {} }; },
});
const base = { DB: { prepare: (sql) => stmt(sql) }, OPS_TOKEN: "t" };
const post = (path, env, ip = "9.9.9.9") => worker.fetch(new Request("https://minutesregained.com" + path, {
  method: "POST", headers: { "Content-Type": "application/json", "CF-Connecting-IP": ip }, body: "{}" }), env, { waitUntil() {} });

let r = await post("/api/agree", base);
check("closed: agree refused, nothing counted", r.status === 403 && db.prepare(`SELECT COUNT(*) n FROM security_events`).get().n === 0, r.status);
const open = { ...base, SIGNUPS_OPEN: "true" };
const codes = [];
for (let i = 0; i < 6; i++) codes.push((await post("/api/agree", open)).status);
check("open: 5 attempts reach the agreement, the 6th is limited", codes.slice(0, 5).every((c) => c === 400) && codes[5] === 429, codes);
check("another visitor isn't affected", (await post("/api/agree", open, "8.8.8.8")).status === 400);
const ck = [];
for (let i = 0; i < 6; i++) ck.push((await post("/api/checkout", open)).status);
check("checkout has its own limit", ck.slice(0, 5).every((c) => c === 400) && ck[5] === 429, ck);

console.log(fails ? `\n${fails} FAILED` : "\nAll passed.");
process.exit(fails ? 1 : 0);
