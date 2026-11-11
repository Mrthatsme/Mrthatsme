// Tests for the process-map tool (site/tools/process_map.mjs). The API is stubbed;
// nothing is sent and nothing is spent.   node site/tools/test_process_map.mjs
import { mkdtemp, writeFile, mkdir, readFile, readdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { parseArgs, parseNever, applyNever, checkEvidence, dollarsPerMonth, costUsd, render, main, MODEL, FALLBACK_MODEL } from "./process_map.mjs";

let fails = 0;
function check(name, cond, got) {
  if (cond) { console.log("ok  ", name); return; }
  fails++; console.log("FAIL", name, "\n     ", JSON.stringify(got));
}
const throws = async (fn, re) => { try { await fn(); return false; } catch (e) { return re.test(e.message); } };

// ---- pure
check("args", (() => { const a = parseArgs(["dir", "--business", "T P", "--rate", "60", "--go"]); return a.folder === "dir" && a.business === "T P" && a.rate === 60 && a.go === true; })());
check("no business name is refused", await throws(() => parseArgs(["dir"]), /business name/));
check("a bad rate is refused", await throws(() => parseArgs(["dir", "--business", "x", "--rate", "free"]), /rate/));
check("an unknown option is refused", await throws(() => parseArgs(["dir", "--business", "x", "--send-all"]), /Unknown option/));
check("never list parses, ignoring comments", JSON.stringify(parseNever("# lawyers\n@SmithLaw.com\n\n bank@x.com ")) === '["@smithlaw.com","bank@x.com"]');
const nv = applyNever([{ name: "a.txt", text: "From: pat@SMITHLAW.com" }, { name: "b.txt", text: "From: sam@example.test" }], ["@smithlaw.com"]);
check("a file from a Never-list sender is left out whole", nv.kept.length === 1 && nv.kept[0].name === "b.txt" && nv.left_out[0].file === "a.txt", nv);
check("dollars are worked out in code", dollarsPerMonth(120, 45) === 390 && dollarsPerMonth(0, 45) === 0, dollarsPerMonth(120, 45));
check("cost at list prices", costUsd("claude-fable-5-2", 300000, 4000) === 2.56, costUsd("claude-fable-5-2", 300000, 4000));

const files = [{ name: "quotes.csv", text: "Mark T,$4200,sent Oct 2,no reply\nRivera,$1150,sent Oct 9,   no reply" }, { name: "inbox.txt", text: "Are you still coming Tuesday? I called twice." }];
const result = () => ({
  how_work_moves: [{ stage: "Quote", what_happens_now: "Sent by email, then nothing." }],
  gaps: [
    { title: "Quotes go quiet", what_slips: "No follow-up.", evidence: [{ file: "quotes.csv", quote: "Rivera,$1150,sent Oct 9, no reply" }, { file: "quotes.csv", quote: "Customer said they went with someone cheaper" }],
      minutes_per_week: 120, minutes_basis: "2 open quotes in a month.", handled_by: "TRACE", confidence: "medium" },
    { title: "Made-up gap", what_slips: "Nothing.", evidence: [{ file: "inbox.txt", quote: "We lose 40 calls a week" }], minutes_per_week: 600, minutes_basis: "guess", handled_by: "FIRST", confidence: "low" },
    { title: "Callbacks", what_slips: "Missed.", evidence: [{ file: "quotes.csv", quote: "I called twice." }], minutes_per_week: 30, minutes_basis: "1 a week.", handled_by: "A person", confidence: "high" },
  ],
  stays_with_owner: ["Pricing"], plan: { recommended: "Essential", why: "Two gaps.", not_needed: "Review requests." }, questions_for_the_call: ["How many calls a week?"],
});
let r = result();
const unverified = checkEvidence(r, files);
check("a real quote is verified, whitespace aside", r.gaps[0].evidence[0].verified === true && r.gaps[0].supported === true, r.gaps[0]);
check("an invented quote is caught", r.gaps[0].evidence[1].verified === false && unverified === 2, unverified);
check("a gap with only invented quotes is not supported", r.gaps[1].supported === false);
check("a real quote cited to the wrong file still counts", r.gaps[2].evidence[0].verified === true);
const md = render({ business: "Tidewater Plumbing", trade: "plumbing", rate: 45, result: r, left_out: [{ file: "a.txt" }], files, model: MODEL, usage: { input_tokens: 300000, output_tokens: 4000 }, date: "2026-11-11" });
check("draft is labelled a draft with estimates", /\(DRAFT\)/.test(md) && /Nothing here is a measured result/.test(md));
check("dollars shown from the code's sum", /about 2 hr a week, roughly \$390 a month at \$45 an hour/.test(md), md.match(/Estimated cost.*/g));
check("invented quote and unsupported gap are flagged", /\*\*UNVERIFIED\*\* "Customer said/.test(md) && /NOT SUPPORTED/.test(md));
check("total leaves out the unsupported gap", /Total across supported gaps:\*\* about 2 hr 30 min a week, roughly \$488 a month/.test(md), md.match(/Total.*/));
check("says what was left out and what it cost", /Left out, never sent to the AI \(Never list\): a\.txt/.test(md) && /about \$2\.56 at list prices/.test(md));
check("says what isn't needed", /\*\*Not needed:\*\* Review requests\./.test(md));

// ---- end to end, stubbed
const dir = await mkdtemp(path.join(os.tmpdir(), "pm-"));
const src = path.join(dir, "client"); await mkdir(path.join(src, "sub"), { recursive: true });
await writeFile(path.join(src, "quotes.csv"), files[0].text); await writeFile(path.join(src, "sub", "inbox.txt"), files[1].text);
await writeFile(path.join(src, "lawyer.txt"), "From: pat@smithlaw.com privileged"); await writeFile(path.join(src, "photo.jpg"), "xx");
await writeFile(path.join(dir, "never.txt"), "@smithlaw.com\n");
const out = path.join(dir, "out");
let calls = [], tokens = 1200, refuseFable = false;
globalThis.fetch = async (url, init) => {
  const body = JSON.parse(init.body); calls.push({ url: String(url), body });
  if (String(url).endsWith("/count_tokens")) return new Response(JSON.stringify({ input_tokens: tokens }));
  if (body.model === MODEL && refuseFable) return new Response(JSON.stringify({ stop_reason: "refusal", content: [] }));
  return new Response(JSON.stringify({ stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify(result()) }], usage: { input_tokens: tokens, output_tokens: 900 } }));
};
const logs = []; const log = (m) => logs.push(m);
const args = [src, "--business", "Tidewater Plumbing", "--trade", "plumbing", "--never", path.join(dir, "never.txt"), "--out", out];
const env = { ANTHROPIC_API_KEY: "k" };

check("no API key: stops before reading anything", await throws(() => main(args, {}, log), /ANTHROPIC_API_KEY/));
let res = await main(args, env, log);
check("without --go nothing is sent, only counted", res.sent === false && calls.length === 1 && calls[0].url.endsWith("/count_tokens") && logs.some((l) => /Nothing was sent/.test(l)), calls.map((c) => c.url));
check("the cost and the 30-day note are shown first", logs.some((l) => /1,200 tokens to send/.test(l) && /at most \$/.test(l)) && logs.some((l) => /30 days/.test(l)), logs);
const sent = calls[0].body.messages[0].content;
check("Never-list file and non-text file never reach the API", !/smithlaw|privileged/.test(JSON.stringify(calls[0].body)) && /<file name="quotes\.csv">/.test(sent) && /sub\/inbox\.txt|sub\\\\inbox\.txt/.test(sent), sent.slice(0, 120));

calls = []; res = await main([...args, "--go"], env, log);
const msg = calls.find((c) => !c.url.endsWith("/count_tokens")).body;
check("with --go: Fable, structured output, no forced tool choice, no thinking setting", res.sent && msg.model === MODEL && msg.output_config.format.type === "json_schema" && msg.output_config.effort === "high" && !msg.tool_choice && !msg.thinking, msg.model);
const written = await readdir(out);
check("writes a dated draft and its data", written.includes("process-map-tidewater-plumbing-" + new Date().toISOString().slice(0, 10) + ".md") && written.some((f) => f.endsWith(".json")), written);
check("the draft on disk flags the invented quote", /UNVERIFIED/.test(await readFile(res.file, "utf8")) && res.unverified === 2);

calls = []; refuseFable = true; res = await main([...args, "--go"], env, log);
check("Fable declines: one retry on Opus", res.model === FALLBACK_MODEL && calls.filter((c) => !c.url.endsWith("/count_tokens")).map((c) => c.body.model).join() === `${MODEL},${FALLBACK_MODEL}`, res.model);
refuseFable = false;

calls = []; tokens = 950000;
check("too large: stops, cuts nothing, sends nothing", await throws(() => main([...args, "--go"], env, log), /Nothing was cut and nothing was sent/) && calls.length === 1);

console.log(fails ? `\n${fails} FAILED` : "\nAll passed.");
process.exit(fails ? 1 : 0);
