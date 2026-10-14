# Minutes Regained Workspace agent — setup

One-time setup, about 5 minutes, on a computer, signed in to Google as
**support@minutesregained.com**.

## 1. Open Apps Script

Either way works:

- Go to **https://script.google.com/home** and click **New project** (top left), or
- Go to **https://drive.google.com**, click **+ New** > **More** > **Google Apps Script**.

If you see "Apps Script has been disabled by your administrator": go to
**https://admin.google.com** > **Apps** > **Additional Google services** >
**Google Apps Script** > set **Service status** to **ON for everyone** > **Save**,
then try again.

## 2. Paste the script

1. Click **Untitled project** at the top and rename it `Minutes Regained Agent`.
2. In the editor, select everything in `Code.gs` (Ctrl+A) and delete it.
3. Paste the full contents of `MinutesRegainedAgent.gs`.
4. Click the **Save** icon (floppy disk) or press Ctrl+S.

## 3. Set the time zone

1. Click the **gear icon** (Project Settings) on the left.
2. Set **Time zone** to **(GMT-04:00) Eastern Time - New York**.

## 4. Run setup and approve

1. Click the **< >** icon (Editor) on the left to go back to the code.
2. In the toolbar dropdown next to **Debug**, choose **setup**.
3. Click **Run**.
4. Google asks for permission: **Review permissions** > choose
   support@minutesregained.com.
5. If you see "Google hasn't verified this app": click **Advanced** >
   **Go to Minutes Regained Agent (unsafe)**. This warning appears for every
   private script you write yourself; it is your own code in your own account.
6. Click **Allow**.

When the log at the bottom says **Setup complete**, check your inbox for the
first **Morning/Evening inbox brief**.

## What it does from then on

- **Every hour:** sorts new mail into `MR/` labels, marks customer email you
  haven't answered within 1 business day as **MR/Needs-You**, and writes one
  follow-up **draft** for email you sent 2+ days ago that got no reply.
- **8 AM and 8 PM Eastern** (arrives between 8 and 9): emails you the Inbox
  brief.
- It never sends anything except the brief to you, and never deletes or
  archives.

## To change it later

- **Add a paying client:** add their email or domain to `clients: []` near the
  top, e.g. `clients: ['firstcoastcarpetcare.com'],` then Save.
- **Pause it:** Triggers (alarm-clock icon on the left) > delete the 3
  triggers. Run `setup` again to restart.
