# Six demo emails

Send these to **proofiletest@gmail.com** from any other account. Each one is
verified against the real classifier: every one routes to a different
department, owner and Slack channel, so no two runs look alike.

Subject lines matter — the classifier reads subject *and* body. Send them as
plain text. Don't paste the department name into the email; REPEAT has to work
that out for itself, and that's the point.

| # | Department | Owner | Slack channel | Confidence |
|---|---|---|---|---|
| 1 | Billing & Finance | Awaiz | `#billing-finance` | 97% |
| 2 | Technical Support | Umar | `#technical-support` | 97% |
| 3 | Sales & Account Management | Bilal | `#sales-accounts` | 88% |
| 4 | Logistics, Shipping & Fulfilment | Obaid | `#logistics-shipping` | 95% |
| 5 | Product Development & R&D | Noor | `#product-rnd` | 94% |
| 6 | Legal, Privacy & Compliance | Huda | `#legal-compliance` | 95% |

---

## 1 — Billing & Finance → Awaiz

**Subject:** `Charged twice for my subscription this month`

```
Hi,

I have been billed twice for my subscription this month. There are two
identical payments on my card three days apart, and only one invoice in
my account.

Could you refund the duplicate charge?

Thanks
```

## 2 — Technical Support → Umar

**Subject:** `Reports API timing out on every request`

```
Hello,

Every call to the reports endpoint times out. We get an HTTP 504 after
about thirty seconds, on every request, since yesterday afternoon.

This is blocking our nightly export job.
```

## 3 — Sales & Account Management → Bilal

**Subject:** `Quote for 25 additional seats on our plan`

```
Hi,

We are expanding the team and need pricing for 25 additional seats on our
current plan. Could you send a quote, and let us know whether an upgrade
to the enterprise plan works out cheaper?

Our procurement team needs this for the renewal contract.
```

## 4 — Logistics, Shipping & Fulfilment → Obaid

**Subject:** `Order never arrived and tracking has not updated`

```
Hi,

My order was dispatched eight days ago but the parcel never arrived. The
tracking link has not updated since it left the warehouse.

Can you find out where the delivery is, or send a replacement?
```

## 5 — Product Development & R&D → Noor

**Subject:** `Feature request: bulk CSV export for reports`

```
Hi team,

This is a feature request rather than a problem. It would be great if we
could export reports in bulk as CSV instead of one at a time.

Any plans to add this to the roadmap?
```

## 6 — Legal, Privacy & Compliance → Huda

**Subject:** `GDPR request to delete my personal data`

```
Hello,

Under GDPR I am requesting erasure of my personal data from your systems,
including any backups.

Please confirm in writing once the data deletion is complete, as required
by your privacy policy.
```

---

## The deliberate seventh: the one REPEAT refuses

**Subject:** `Something went wrong yesterday`

```
Hey,

Something was off yesterday afternoon. It seemed to sort itself out but I
wanted to flag it in case it matters.
```

This one classifies as `unresolved` at 32% confidence, below the 0.6 owner
floor — so REPEAT **stops and asks a human** instead of guessing a
department. Worth sending to judges who ask "what happens when it's wrong?".
An agent that knows when not to act is a stronger claim than one that always
has an answer.

---

## Running the demo

REPEAT needs to watch the workflow **twice** before it proposes anything
(`PATTERN_MIN_OBSERVATIONS = 2`). So:

1. Send emails 1 and 2. Work each one by hand: read → copy → new task → tags →
   priority → assign → notify → reply to customer.
2. Send email 3. REPEAT recognises the pattern and offers a Ghost Run.
3. Approve it. It files the real ClickUp task, posts to the real Slack
   channel, and emails the customer back — all to a department it was never
   observed handling.

Step 3 is the whole pitch: the owner *and* the channel adapt, because both are
derived from the classified department rather than memorised.

## Retuning

Owner per department is in `lib/demo/team.ts` (`ROUTING_RULES`). Channel per
department is `DEFAULT_AREA_CHANNELS` in the same file, overridable without
touching code:

```
SLACK_AREA_CHANNELS=billing=billing-finance,sales=sales-accounts
```
