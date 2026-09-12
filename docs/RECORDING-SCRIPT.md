# Demo video — recording script

Everything below is real: real Gmail, real ClickUp, real Slack. Your own
manual passes now file real tickets too, not just the agent's run.

## Before you hit record

1. Restart the dev server so the bundle is clean:
   ```
   rm -rf .next && npm run dev
   ```
2. Open `http://localhost:3000/workspace`.
3. Click **Reset** in the top bar (then **Clear everything?** to confirm). This
   wipes observations and re-reads Gmail and ClickUp immediately.
4. Have all three emails ready to send from your other account.

**The inbox polls every 20 seconds.** Send each email slightly before you need
it, or expect a short wait. Don't send all three up front — the third must
arrive *after* the pattern is learned, or it becomes a third manual pass.

---

## Why three emails and not two

REPEAT requires **two** completed observations before it proposes anything
(`PATTERN_MIN_OBSERVATIONS = 2`). One learning pass is not enough — the
second email would just be another manual pass and the agent would never
offer to take over.

Both learning emails route to **Umar**. The third routes to **Awaiz**. That
contrast is the whole point: it was only ever shown Umar.

---

## Pass 1 — learning (Technical Support → Umar)

**Subject:** `Reports API timing out on every request`

```
Hello,

Every call to the reports endpoint times out. We get an HTTP 504 after
about thirty seconds, on every request, since yesterday afternoon.

This is blocking our nightly export job.
```

Then work it by hand. Twelve clicks, and the guide ring shows you the next one:

| # | Where | Click |
|---|---|---|
| 1 | Gmail | the email in the list |
| 2 | Gmail | **Copy details** |
| 3 | ClickUp | **+ Task** |
| 4 | ClickUp | **Paste report** |
| 5 | ClickUp | the tags |
| 6 | ClickUp | the priority flag |
| 7 | ClickUp | **Umar** |
| 8 | ClickUp | **Create task** |
| 9 | Slack | **#technical-support** |
| 10 | Slack | **Use this draft** |
| 11 | Slack | **Send** |
| 12 | Gmail | **Send reply** |

Step 12 closes the trace. The counter reads **1 / 2 observations**.

Say out loud what you are doing — this is the "watch me do my job" half.

## Pass 2 — learning (Technical Support → Umar again)

**Subject:** `Can't log in - invalid credentials error`

```
Hi team,

I am unable to log in to my account since this morning. I keep getting an
"Invalid credentials" error even though my password is correct.

This is blocking me from accessing the dashboard completely.

Can someone take a look?
```

Same twelve clicks, same owner, same channel. On step 12 the detector runs and
REPEAT announces the pattern. **Pause here** — this is the turn of the video.

Worth pointing at on screen: it did *not* memorise "assign to Umar". The
Memory Map shows `owner` as a bound variable derived from the department, even
though both passes used the same person.

## Pass 3 — automation (Billing → Awaiz)

**Subject:** `Charged twice for my subscription this month`

```
Hi,

I have been billed twice for my subscription this month. There are two
identical payments on my card three days apart, and only one invoice in
my account.

Could you refund the duplicate charge?

Thanks
```

Now do nothing. REPEAT detects the trigger, plans a Ghost Run, and waits for
approval. Read the plan aloud — especially the adaptation lines:

```
owner  Umar -> Awaiz          (billing -> Awaiz)
area   technical-support -> billing   (classified from the report text)
```

Approve it. It files the real ClickUp ticket, assigns Awaiz, posts to
**#billing-finance** — a different channel than either learning pass — and
emails the customer their complaint number.

---

## The closing shot

Cut to the three real surfaces and show the receipts:

- **ClickUp** — the ticket, assigned to Awaiz
- **Slack `#billing-finance`** — the notification, in a channel neither
  learning pass ever touched
- **The customer's inbox** — the acknowledgement, threaded onto their original
  email, carrying the real ticket reference

Then the top bar: **actions saved** and **time saved**.

## The strongest question you can invite

"What if it isn't sure?" Send this one:

**Subject:** `Something went wrong yesterday`

```
Hey,

Something was off yesterday afternoon. It seemed to sort itself out but I
wanted to flag it in case it matters.
```

It classifies `unresolved` at ~32%, below the 0.6 owner floor, and REPEAT
**stops and asks a human** instead of guessing a department. An agent that
knows when not to act is a stronger claim than one that always has an answer.

---

## If something goes wrong mid-take

- **Email hasn't appeared** — the poll is 20s. Wait, don't re-send.
- **Wrong department** — check the subject line matches above exactly; the
  classifier reads subject and body together.
- **Need to start over** — **Reset** in the top bar. It clears everything and
  re-reads both accounts immediately.
- **Blank page** — the dev bundle is stale: Ctrl+C, `rm -rf .next && npm run dev`.
