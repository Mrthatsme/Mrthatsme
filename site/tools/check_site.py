#!/usr/bin/env python3
"""Checks the public marketing pages before a push.

    python3 site/tools/check_site.py          # report problems, exit 1 if any
    python3 site/tools/check_site.py --fix    # also rewrite the JSON-LD hashes in public/_headers

What it checks, per page:
  - the main menu (Home, Services, Pricing, Industries, About) and the tel: link are in the header
  - one H1, and a title and description no other page uses
  - every <details class="faq-item"> question is in that page's FAQPage JSON-LD, and nothing extra
  - the five automation names are in the server HTML of Home and Services
  - no links to the old one-page anchors (/#pricing and so on)
  - every page is listed in sitemap.xml
And site-wide: each JSON-LD block's sha256 is allowed by the Content-Security-Policy in _headers,
because the CSP blocks any inline script it has no hash for.
"""
import base64, glob, hashlib, html, json, os, re, sys

PUB = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public")
PAGES = {  # file -> public path
    "index.html": "/", "services.html": "/services", "pricing.html": "/pricing", "about.html": "/about",
    "for/index.html": "/for/", "for/contractors.html": "/for/contractors", "for/law-firms.html": "/for/law-firms",
    "automations/first.html": "/automations/first", "automations/trace.html": "/automations/trace",
    "automations/clock.html": "/automations/clock", "automations/stars.html": "/automations/stars",
    "automations/paid.html": "/automations/paid", "calculators/index.html": "/calculators/",
    "calculators/slow-replies.html": "/calculators/slow-replies", "calculators/cold-quotes.html": "/calculators/cold-quotes",
    "calculators/late-invoices.html": "/calculators/late-invoices",
}
MENU = ['href="/"', 'href="/services"', 'href="/pricing"', 'href="/for/"', 'href="/about"']
FIVE = ["FIRST", "TRACE", "CLOCK", "STARS", "PAID"]  # renamed Nov 11, 2026 (Jerome)
JSONLD = re.compile(r'<script type="application/ld\+json">(.*?)</script>', re.S)

problems = []


def bad(f, msg):
    problems.append(f"{f}: {msg}")


def text(s):
    return html.unescape(re.sub(r"<[^>]+>", "", s)).strip()


titles, descs = {}, {}
sitemap = open(os.path.join(PUB, "sitemap.xml")).read()
for f, path in PAGES.items():
    s = open(os.path.join(PUB, f)).read()
    hdr = re.search(r'<header class="site">(.*?)</header>', s, re.S)
    if not hdr:
        bad(f, "no site header")
    else:
        for m in MENU:
            if m not in hdr.group(1):
                bad(f, f"menu is missing {m}")
        if 'href="tel:+18778968784"' not in hdr.group(1):
            bad(f, "no tel: link in the header")
    if len(re.findall(r"<h1[ >]", s)) != 1:
        bad(f, "needs exactly one <h1>")
    t = re.search(r"<title>(.*?)</title>", s).group(1)
    d = re.search(r'<meta name="description" content="(.*?)">', s).group(1)
    for seen, val, kind in ((titles, t, "title"), (descs, d, "description")):
        if val in seen:
            bad(f, f"same {kind} as {seen[val]}")
        seen[val] = f
    if 'name="robots" content="noindex' in s:
        bad(f, "is set to noindex")
    if f"<loc>https://minutesregained.com{path}</loc>" not in sitemap:
        bad(f, f"{path} is not in sitemap.xml")
    if re.search(r'href="/#', s):
        bad(f, "links to an old one-page anchor (/#...)")
    if f in ("index.html", "services.html"):
        for n in FIVE:
            if n not in s:
                bad(f, f"automation name missing from the HTML: {n}")

    visible = [text(q) for q in re.findall(r'<details class="faq-item"[^>]*><summary>(.*?)</summary>', s, re.S)]
    in_ld = []
    for block in JSONLD.findall(s):
        data = json.loads(block)
        if data.get("@type") == "FAQPage":
            in_ld += [e["name"] for e in data["mainEntity"]]
    if visible != in_ld:
        bad(f, f"FAQPage JSON-LD does not match the visible questions ({len(visible)} visible, {len(in_ld)} in JSON-LD)")

# CSP hashes for every JSON-LD block on any page
hashes = []
for f in sorted(glob.glob(os.path.join(PUB, "**", "*.html"), recursive=True)):
    for block in JSONLD.findall(open(f).read()):
        h = "'sha256-%s'" % base64.b64encode(hashlib.sha256(block.encode()).digest()).decode()
        if h not in hashes:
            hashes.append(h)
hp = os.path.join(PUB, "_headers")
headers = open(hp).read()
csp = re.search(r"script-src 'self'((?: 'sha256-[^']+')*) ", headers)
have = csp.group(1).split()
missing = [h for h in hashes if h not in have]
extra = [h for h in have if h not in hashes]
if missing or extra:
    if "--fix" in sys.argv:
        headers = headers.replace(csp.group(0), "script-src 'self' " + " ".join(hashes) + " ")
        open(hp, "w").write(headers)
        print(f"_headers: CSP hashes rewritten ({len(hashes)} JSON-LD blocks)")
    else:
        bad("_headers", f"CSP script-src hashes are out of date ({len(missing)} missing, {len(extra)} unused). Run with --fix.")

if problems:
    print("\n".join(problems))
    sys.exit(1)
print(f"OK: {len(PAGES)} pages, {len(hashes)} JSON-LD blocks allowed by the CSP")
