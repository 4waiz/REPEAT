# REPEAT — 2 minute demo script

Run `npm run verify` first. If it prints `engine OK`, the demo works.
Open `/workspace` at 1366x768 or larger. Demo console: `Ctrl/Cmd + Shift + D`.

---

### 0:00 — the framing

> "Automation usually starts by asking a human to document their workflow."

Workspace is open: mail, issue tracker, team chat. REPEAT says **● Watching**.

> "We asked a different question. What if the workflow documented itself?"

---

### 0:10 — first bug, done by hand

Click through the highlighted controls. Alex Chen, login failure.

Read → Copy details → New issue → Paste report → labels `bug` `authentication`
`backend` → priority `high` → assignee `Umar` → Create issue → `#product-updates`
→ Use this draft → Send.

REPEAT shows **● Learning your work**, step *n* of 11.

> "I'm not configuring anything. I'm just doing my job."

Point at the timeline: *Extract issue details — inferred by REPEAT*.

> "I never clicked 'understand the issue'. REPEAT named that step itself."

---

### 0:35 — second bug

"Send the next report" → Priya Raman, API timeout. Same eleven clicks.

Confidence climbs in the dock as it goes: **63% → 73% → 77% → 96%**.

---

### 0:50 — pattern discovered

> "These aren't five separate actions. They're one workflow."

**13 manual actions → 1 approval.** Confidence 96%, observed 2 times.

Press **Show me first** and point at the amber box:

> "Both bugs went to Umar. Owner never varied. But REPEAT did *not* memorise
> Umar — it noticed the value is already derivable from the engineering area,
> so it bound the field to the rule instead. That's the difference between
> this and a macro."

Press **Approve**. The five steps collapse into one agent.

---

### 1:05 — third bug. Hands off the keyboard.

Demo console → **Send third bug**, or "Send the next bug report".

> "I'm not going to touch anything."

**Trigger detected** → Ghost Run opens itself.

---

### 1:10 — the adaptation

Point at the two cyan callouts:

```
ADAPTED  Owner  Umar → Noor      rule: frontend → Noor
ADAPTED  Area   backend → frontend   rule: classified from the report text
```

> "This one's a frontend bug. REPEAT has never seen a frontend bug. It
> reclassified it and rerouted it to Noor — on a rule, not a memory."

Note **"No external changes have been made."**

---

### 1:20 — execute

Press **Execute**. Nodes light in sequence: read → extract → classify →
create → label → **#44 created** → **assigned Noor** → draft → **posted**.

---

### 1:40 — the result

> "Thirteen manual actions became one approval. Four minutes thirty-seven
> saved — and that number is derived from a per-action effort table, it's in
> the tooltip."

Tracker shows the ticket tagged **by repeat**, owner Noor. Chat shows the
message from **REPEAT · agent**.

---

### 1:48 — memory map

Two seconds on the Memory Map, then:

> "Traditional automation asks humans to describe their workflow.
> REPEAT learns it by watching the work itself."

### 2:00

> **REPEAT. Show it once. Never do it again.** Team Kanban.

---

## If something goes wrong

| Problem | Fix |
|---|---|
| Lost your place clicking | Demo console → the highlighted step is the next one |
| No time to click manually | Demo console → Run observation 1, Run observation 2 |
| Need to start over | Demo console → Reset demo (or `⌘K` → Reset) |
| Want to show failure handling | Demo console → Error injection → Fail: assign owner |
| Want to show the review path | Demo console → Send ambiguous report |
| Judge asks "is it hardcoded?" | Show me first → the amber "Not memorized" box; or `npm run verify` |

Demo Mode is on by default: no network, no keys, no external calls.

If you want the live version for the judges — the model reading the third bug
via OpenRouter and Exa attaching related context — set `DEMO_MODE=false` plus
the two keys in `.env`, run `npm run verify:live` first, and keep the demo
console's "demo mode" badge in view: it reads "live adapters" when live. The
only visible differences are the "Understood by" row, the "Related context"
list in the Ghost Run, and two extra timeline entries. Everything else is the
same engine.
