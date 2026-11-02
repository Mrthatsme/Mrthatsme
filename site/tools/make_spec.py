"""Builds the specialty landing pages (site/public/for/*.html) from one template.

Run from the site folder: python3 -I tools/make_spec.py public
"""
import html
import os
import sys

OUT = os.path.join(sys.argv[1], "for")
CAL = "https://calendar.app.google/mL2TQQSCAgLAURZC6"
LOGO = ('<svg viewBox="0 0 40 40" width="{s}" height="{s}" aria-hidden="true"><circle cx="20" cy="20" r="16.5" fill="none" '
        'stroke="var(--teal)" stroke-width="3"/><path d="M20 20 L20 6.5 A13.5 13.5 0 0 0 6.5 20 Z" fill="var(--signal)"/>'
        '<circle cx="20" cy="20" r="2.6" fill="var(--teal)"/></svg>')
STATUS = {"live": "Live today", "setup": "Set up during onboarding", "soon": "Coming soon"}

PAGES = [
  {
    "slug": "law-firms",
    "title": "Admin support for small law firms | Minutes Regained",
    "desc": "Intake, consultation scheduling, document chasing, calendar upkeep and billing reminders for solo attorneys and small law firms. Admin only, never legal advice.",
    "eyebrow": "For solo attorneys and small law firms",
    "h1": 'Intake answered. Calendar current. <em>Evenings back.</em>',
    "lede": "We build and run automations and handle the admin around your practice: new-client intake, consultation scheduling, document chasing and billing reminders. You approve every word, and we never give legal advice.",
    "biz": "Example law firm",
    "brief": [
      ("8:05", "you", "NEEDS YOU", "New intake: landlord dispute. Names for your conflict check are attached."),
      ("9:40", "you", "NEEDS YOU", "Hearing notice received for the Ramos matter. The date waits for your confirmation before it goes on the calendar."),
      ("11:15", "", "DONE", "Consultation booked for Thursday at 2:00. Reminder email set."),
      ("1:30", "", "DONE", "Document checklist sent to a new client. 2 of 5 received."),
      ("4:10", "", "DONE", "Invoice reminder sent with your operating-account payment link."),
    ],
    "tasks_title": "The admin around your practice, handled.",
    "tasks_lede": "Everything here is administrative work done under your supervision. Anything that needs a lawyer's judgment comes to you.",
    "tasks": [
      ("Intake and consultations", "live", "Website chat and inquiry replies in your approved words, an intake summary for you, and consultations booked with reminders and no-show follow-up."),
      ("Conflict-check details", "setup", "We collect the names of everyone involved at intake and put them in front of you. You run the conflict check and decide."),
      ("Document collection", "setup", "A checklist goes to each new client, and we track what's in, what's missing, and send polite email reminders until it arrives."),
      ("Calendar upkeep", "live", "Consultations, meetings and appointments kept current. Court dates and deadlines go on only after you confirm them."),
      ("Client updates", "live", "Status-update emails drafted for you to approve, so clients feel looked after without you writing each one."),
      ("Billing reminders and your brief", "live", "Invoice reminders that link to your own payment page, plus one daily brief with only the decisions that are yours."),
    ],
    "never_title": "Lines we never cross",
    "never": [
      "Give legal advice or answer legal questions. The chat says so and passes the question to you.",
      "Touch your trust or IOLTA account, or any client funds. We never run a card or move money.",
      "Put a court date or deadline on the calendar without your confirmation.",
      "Quote fees, sign anything or make promises on your behalf.",
      "Call ourselves paralegals or hold ourselves out as part of your legal staff.",
      "Mix one firm's information with another's, or use it to train any AI model.",
    ],
    "fit": "You stay in charge. We're added as a user to your own tools instead of taking passwords, every action is logged, and you can remove our access yourself at any time. If your firm has a security questionnaire, send it over and we'll answer it in writing.",
    "faq": [
      ("Do you give legal advice?", "No. We handle administrative work only. If a client or prospect asks a legal question, the reply says we can't answer it and the question goes straight to you."),
      ("Do you handle trust accounting?", "No. We never touch a trust or IOLTA account or any client funds. Billing reminders only link to the payment page you already use, and you or your bookkeeper handle the money."),
      ("Who is responsible for deadlines?", "You are, always. We can keep your calendar current, but a court date or deadline only goes on the calendar after you confirm it, and we never calculate one ourselves."),
      ("Will you work in our practice-management software?", "We work in the tools you already use by being added as a user, the same way you'd add a new staff member. We confirm your specific software on the free assessment call before you sign anything."),
      ("Is our client information kept confidential?", "Yes. Your information stays in your own accounts, is never mixed with another client's, and is never used to train any AI model. Every action is logged so you can see who did what and when."),
      ("Do you text our clients?", "No, never. Replies happen where the person reached out, like your website chat or email."),
    ],
  },
  {
    "slug": "contractors",
    "title": "Back office for contractors and home services | Minutes Regained",
    "desc": "Lead replies, quote follow-ups, booking and crew schedules, review requests and a daily brief for contractors and home service businesses.",
    "eyebrow": "For contractors and home service crews",
    "h1": 'You run the crews. <em>We run the office.</em>',
    "lede": "We build and run the automations that answer new leads, chase open quotes, keep tomorrow's schedule straight and ask for reviews after every job. You approve every word. We never text your customers.",
    "biz": "Example contractor",
    "brief": [
      ("7:42", "", "DONE", "Website chat answered in 2 minutes. Lead saved: water heater replacement."),
      ("10:20", "", "DONE", "Day-5 follow-up sent on 2 open quotes."),
      ("2:15", "you", "NEEDS YOU", "Customer asked for a discount on the Miller job. Sent to you, not answered."),
      ("5:30", "you", "NEEDS YOU", "Tomorrow: 3 crews, 9 jobs. One drive-time conflict flagged. Approve to email each crew their schedule."),
      ("6:00", "", "DONE", "Review request sent after 2 jobs marked complete."),
    ],
    "tasks_title": "Every job, from first call to five stars.",
    "tasks_lede": "Five core automations plus the admin around them, built for crews that are out on jobs all day.",
    "tasks": [
      ("Lead Catcher", "live", "Website chat answered in minutes, every lead saved to a simple CRM, and missed calls put at the top of your brief so you can call back."),
      ("Quote Chaser", "live", "Email follow-ups on open quotes on day 2, 5 and 10, waiting for your OK until you approve them to go on their own."),
      ("Booking & Dispatch", "setup", "Online booking within your rules, confirmation and reminder emails, and each evening tomorrow's schedule checked for double bookings and impossible drive times. Once you approve it, each crew member gets their schedule by email, or by text through your own scheduling app if you ask us to."),
      ("Job Wrap-Up", "setup", "A review request after every finished job, and a heads-up to you when an invoice still needs charging."),
      ("Supply reminders", "setup", "A flag in your brief when you're due to reorder, based on your own purchase history. You place the order."),
      ("Daily Brief", "live", "Your inbox sorted, replies drafted, voice notes from the truck turned into job notes, and one evening summary."),
    ],
    "never_title": "What it never does",
    "never": [
      "Text your customers, or text anyone from a number of ours. Crew schedules go by email, or through your own app if you choose.",
      "Quote a price, give a discount or promise an arrival time you didn't set.",
      "Send a crew anywhere without your OK on the schedule.",
      "Order supplies or spend money. It flags, you buy.",
      "Run a card, take a payment or touch your bank.",
      "Pretend to be you. It says it's your company's assistant.",
    ],
    "fit": "You stay in charge. We're added as a user to your own tools, like your calendar, Jobber or Housecall Pro, instead of taking passwords. Every action is logged, and you can remove our access yourself at any time.",
    "faq": [
      ("Do you send my crews out?", "Not on our own. Each evening we line up tomorrow's schedule and flag conflicts. Once you approve it, each crew member gets their schedule by email. If your crews already get texts from your own scheduling app, like Jobber or Housecall Pro, we can send the schedule through that app instead. Nothing ever comes from a number of ours."),
      ("Do you text my customers?", "No, never. Replies happen where the customer reached out, like your website chat or email. Missed calls go to the top of your brief so you can call back."),
      ("What about emergencies after hours?", "You tell us what counts as an emergency and who's on call. An emergency goes straight to that person, and the customer gets a short holding reply so they're not left waiting."),
      ("Do you order supplies?", "No. We flag when you're due to reorder, based on your purchase history. You decide what to buy and place the order."),
      ("Will it work with Jobber or Housecall Pro?", "We work in the tools you already use by being added as a user. We confirm your specific software on the free assessment call before you sign anything."),
    ],
  },
]


def e(s):
    return html.escape(s, quote=False)


def page(p):
    brief = "\n".join(
        f'            <div class="row"><time>{t}</time><span class="tag {c}">{tag}</span><span>{e(txt)}</span></div>'
        for t, c, tag, txt in p["brief"])
    tasks = "\n".join(
        f'        <article class="task"><span class="chip-status {st}">{STATUS[st]}</span><h3>{e(name)}</h3><p>{e(body)}</p></article>'
        for name, st, body in p["tasks"])
    never = "\n".join(f"        <li>{e(x)}</li>" for x in p["never"])
    faq = "\n".join(
        f'        <details class="faq-item"><summary>{e(q)}</summary><p>{e(a)}</p></details>' for q, a in p["faq"])
    url = f"https://minutesregained.com/for/{p['slug']}"
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="description" content="{e(p['desc'])}">
<meta name="robots" content="noindex,follow">
<link rel="canonical" href="{url}">
<meta property="og:type" content="website">
<meta property="og:title" content="{e(p['title'])}">
<meta property="og:description" content="{e(p['desc'])}">
<meta property="og:url" content="{url}">
<meta property="og:image" content="https://minutesregained.com/og-image.png">
<meta name="theme-color" content="#2C6468" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0C1822" media="(prefers-color-scheme: dark)">
<link rel="icon" href="/mark.svg" type="image/svg+xml">
<link rel="icon" href="/favicon-32.png" sizes="32x32">
<link rel="apple-touch-icon" href="/favicon-180.png">
<title>{e(p['title'])}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500..800&family=Figtree:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500&display=swap">
<link rel="stylesheet" href="/home.css?v=20261102d">
</head>
<body>
<header class="top band">
  <div class="wrap">
    <a class="mark" href="/" aria-label="Minutes Regained home">{LOGO.format(s=30)}<b>Minutes Regained</b></a>
    <nav aria-label="Sections">
      <a href="#work">What we handle</a>
      <a href="#pricing">Pricing</a>
      <a href="#faq">Questions</a>
    </nav>
    <a class="btn btn--go" href="{CAL}" target="_blank" rel="noopener">Book a free assessment</a>
  </div>
</header>

<main id="top">
  <section class="hero spec-hero band" aria-labelledby="heroTitle">
    <div class="wrap">
      <div>
        <p class="eyebrow">{e(p['eyebrow'])}</p>
        <h1 id="heroTitle" class="display mt1">{p['h1']}</h1>
        <p class="lede">{e(p['lede'])}</p>
        <div class="hero__go">
          <a class="btn btn--go" href="{CAL}" target="_blank" rel="noopener">Book a free assessment</a>
          <a class="btn btn--line" href="#work">See what we handle</a>
        </div>
      </div>
      <figure class="screen" aria-label="Example daily brief">
        <div class="screen__bar">
          <span class="live"><i aria-hidden="true"></i><span>Daily brief · 6:00 PM</span></span>
          <span>{e(p['biz'])}</span>
        </div>
        <div class="brief-card">
{brief}
        </div>
        <figcaption class="screen__note"><span>An example, not a client's results. Only the decisions that are yours.</span></figcaption>
      </figure>
    </div>
  </section>

  <section class="sec band" id="work" aria-labelledby="workTitle">
    <div class="wrap">
      <div class="sec__head">
        <p class="eyebrow">What we handle</p>
        <h2 id="workTitle" class="display">{e(p['tasks_title'])}</h2>
        <p class="lede">{e(p['tasks_lede'])}</p>
      </div>
      <div class="tasks">
{tasks}
      </div>
      <p class="status-note"><b>Live today</b> means it runs for clients now. <b>Set up during onboarding</b> means we build it for you in your first weeks.</p>
    </div>
  </section>

  <section class="rules band" aria-labelledby="neverTitle">
    <div class="wrap">
      <h2 id="neverTitle">{e(p['never_title'])}</h2>
      <ul class="never">
{never}
      </ul>
    </div>
  </section>

  <section class="sec band" aria-labelledby="fitTitle">
    <div class="wrap">
      <div class="sec__head">
        <p class="eyebrow">You stay in control</p>
        <h2 id="fitTitle" class="display">You write the rules. It follows them.</h2>
        <p class="lede">{e(p['fit'])}</p>
      </div>
      <div class="levels">
        <div class="level"><b>Handle It</b><span>Does it. No message to you.</span></div>
        <div class="level"><b>Tell Me</b><span>Does it, then reports it in your daily brief.</span></div>
        <div class="level"><b>Ask Me</b><span>Gets it ready and waits for your OK.</span></div>
        <div class="level"><b>Never</b><span>Won't do it, even if someone asks.</span></div>
      </div>
    </div>
  </section>

  <section class="sec sec--dark band" id="pricing" aria-labelledby="priceTitle">
    <div class="wrap">
      <div class="sec__head">
        <p class="eyebrow">Pricing</p>
        <h2 id="priceTitle" class="display">Same simple plans as everyone.</h2>
        <p class="lede">$450, $900 or $1,500 a month. Software included, no setup fee, and monitoring and repairs never use your hours. Founding clients get Business Support at $450 a month for the first 90 days.</p>
      </div>
      <div class="price-line">
        <a class="btn btn--go" href="/#pricing">Compare the three plans</a>
        <a class="btn btn--line" href="#book">Ask us a question</a>
      </div>
    </div>
  </section>

  <section class="sec faq band" id="faq" aria-labelledby="faqTitle">
    <div class="wrap">
      <div>
        <p class="eyebrow">Questions</p>
        <h2 id="faqTitle" class="display mt1">What owners like you ask.</h2>
        <p class="lede mt1">More answers on the <a href="/#faq">main questions page</a>.</p>
      </div>
      <div class="qa-static">
{faq}
      </div>
    </div>
  </section>

  <section class="close band" id="book" aria-labelledby="bookTitle">
    <div class="wrap">
      <div>
        <h2 id="bookTitle" class="display">Get your minutes back.</h2>
        <p class="lede">A free 30-minute operations assessment. You'll leave with a clear list of what can be automated, whether or not you sign up.</p>
        <ul>
          <li>No cost, no pressure</li>
          <li>By phone, weekday evenings 5 to 8 PM Eastern</li>
          <li>A written summary sent after the call</li>
        </ul>
        <a class="btn btn--go" href="{CAL}" target="_blank" rel="noopener">Pick a time on the calendar</a>
      </div>
      <div class="book-card">
        <h3>Or send us a message</h3>
        <form class="sign" id="signup" novalidate>
          <div class="fld"><label for="f-name">Your name</label><input id="f-name" name="name" autocomplete="name" required></div>
          <div class="fld"><label for="f-biz">Business name</label><input id="f-biz" name="biz" autocomplete="organization" required></div>
          <div class="fld"><label for="f-contact">Email</label><input id="f-contact" name="contact" type="email" autocomplete="email" required></div>
          <div class="fld"><label for="f-phone">Phone <span class="opt">(optional)</span></label><input id="f-phone" name="phone" type="tel" autocomplete="tel"></div>
          <div class="fld"><label for="f-when">Best time to reach you</label><select id="f-when" name="window">
            <option value="">Pick one</option><option>Early morning, before 8am</option><option>Daytime, business hours</option>
            <option>Evening, after 6pm</option><option>Weekends only</option><option>Email only, please</option></select></div>
          <div class="fld"><label for="f-pain">What eats most of your time right now?</label><textarea id="f-pain" name="pain" placeholder="Intake, chasing documents, scheduling&hellip;"></textarea></div>
          <div class="hp" aria-hidden="true"><label for="f-hp">Company website</label><input id="f-hp" name="company_website" tabindex="-1" autocomplete="off"></div>
          <button class="btn btn--go" type="submit" id="f-send">Request assessment</button>
          <p class="note" id="f-note">No cost and no obligation. We reply within one business day.</p>
        </form>
        <div class="ok hid" id="f-ok"></div>
      </div>
    </div>
  </section>
</main>

<footer class="foot band">
  <div class="wrap">
    <span class="tagline-row">{LOGO.format(s=22)}Minutes Regained&trade; &middot; Always on watch.</span>
    <span>Veteran-owned business. Serving small businesses of 1 to 25 people across the United States, in any industry.</span>
    <span><a href="/">Home</a> &middot; <a href="/services">Services</a> &middot; <a href="/pricing">Pricing</a> &middot; <a href="/privacy">Privacy</a></span>
    <span>Minutes Regained is operated by Provident Watch LLC &middot; support@minutesregained.com</span>
    <span>&copy; <span id="yr">2026</span> Minutes Regained</span>
  </div>
</footer>

<script src="/site.js?v=20261102" defer></script>
</body>
</html>
"""


os.makedirs(OUT, exist_ok=True)
for p in PAGES:
    path = os.path.join(OUT, p["slug"] + ".html")
    with open(path, "w", encoding="utf-8") as f:
        f.write(page(p))
    print("wrote", path)
