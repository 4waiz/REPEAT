# AI Tinkerers — "Agents, Everywhere" submission copy

Copy-paste blocks for each form field. Two fields need your input before you
submit — both are flagged **ACTION NEEDED**.

---

## 1. Project Name

```
REPEAT
```

---

## 2. Project Description

```markdown
**REPEAT — Show it once. Never do it again.**

REPEAT is an agent that learns repetitive workflows by observing how people
already work, instead of asking them to describe or program those workflows
first.

**The problem: customer support runs on repetition.**

Every support desk has the same bottleneck. A message arrives from a customer
in plain prose. Someone has to read it, work out what is actually wrong, decide
which department owns it, judge how urgent it is, open a ticket in the tracker
with the right labels and priority, assign the correct person, tell that
person's team, and reply to the customer with a reference.

None of that is difficult. All of it is repetitive, and it happens tens or
hundreds of times a day. The cost is not the thinking. The cost is:

- **The copy-paste tax.** The same facts are retyped into three different
  tools. By our own effort model, one triage is 13 separate actions across
  three applications and roughly five minutes of unbroken attention.
- **Routing knowledge lives in people's heads.** That a duplicate charge is
  Billing, and a 504 on the reports endpoint is Technical Support, is tribal
  knowledge held by whoever has been there longest. New agents misroute for
  weeks, and every misroute costs a customer another wait.
- **First response is where SLAs are lost.** The acknowledgement reply is the
  step that quietly gets skipped when the queue is deep — so the customer
  hears nothing while their ticket sits perfectly filed.
- **The work is too small to automate and too frequent to ignore.**
  Conventional automation asks the support lead to stop working, document the
  process, pick a trigger, wire conditions and test it. For a five-minute task,
  describing it costs more than doing it. So it never gets automated, and the
  team absorbs it forever.

REPEAT deletes that setup cost. The team keeps triaging exactly as they do
today. After the second time, the workflow already exists as an agent.

**The environment.**

Our chosen environment is a support desk made of three tools people already use
every day: email, an issue tracker and team chat. The agent lives across these
tools and watches the meaning of the work taking place between them. There is
no chatbot and no prompt box. The user's behaviour is the prompt.

**What happens.**

A customer sends a report by email. A human reads it, understands what is
wrong, determines the department and severity, creates a ticket, assigns the
correct owner, notifies that department's channel, and replies to the customer.
REPEAT observes this as semantic actions — `mail.read_message`,
`issue.classify`, `issue.create`, `chat.notify_team`, `mail.reply_customer` —
rather than mouse coordinates or blindly replayed clicks.

The first time the workflow happens, REPEAT observes. The second time, it
compares the new sequence against the previous one and detects a repeated
pattern, with confidence climbing live in front of the user: 63% → 73% → 77% →
96%. Once confidence is high enough, REPEAT names the workflow and compiles the
observed steps into a reusable triage agent. Thirteen manual actions become one
approval.

When a third message arrives, the user does nothing.

REPEAT recognises the trigger and opens a **Ghost Run** — a safe preview of
exactly what it intends to do before anything outside the workspace changes.
The user sees the extracted issue, the classification, the selected owner, the
ticket that will be created, the channel that will be notified, the reply that
will be sent, the permissions required, the risk level, and the literal
sentences from the email that justify each reading. One approval executes and
verifies the run.

**Why this cannot be a chatbot.**

A chatbot must first be told which workflow to perform. REPEAT is never told
anything — it only ever sees what was done. The inbox, the tracker and the chat
are not wrappers around an AI conversation; they are the agent's observation
and action space. The pattern is discovered where the work happens and the plan
is reviewed in the same three windows, so the automation stays legible in
context instead of being described in a transcript.

**Gmail, ClickUp and Slack are examples, not the product.**

We run the demo against a real Gmail inbox, a real ClickUp list and a real
Slack workspace because those are recognisable and independently verifiable — a
judge can watch a ticket appear in ClickUp and a message land in Slack. But
they are three instances of a general mechanism, not the feature set.

What REPEAT learns is a sequence of semantic intents: read the inbound message,
understand it, create a record, assign an owner, notify the right audience,
reply to the sender. Each intent is fulfilled by a swappable adapter behind one
interface. Gmail could be Outlook, Front or Zendesk. ClickUp could be Jira,
Linear or GitHub Issues — our Chrome extension already extracts semantic
context from Gmail, Jira and ClickUp. Slack could be Teams. Nothing in the
learned pattern names a vendor.

That is why the same mechanism carries to other repetitive desks: refunds,
returns, onboarding, invoice approval, lead routing, incident escalation. Any
work shaped like "read something, decide something, record it, tell someone" is
the same shape. We show three tools because a demo needs surfaces; the
mechanism is the product.

**The innovation: it learns the rule, not the values.**

REPEAT learns what changes and what stays constant instead of memorising
previous values.

Both training examples in our demo are Technical Support issues assigned to
Umar, so the owner field never varies across the observations. A naive macro
diffs the two runs, sees a constant, and bakes in "always assign Umar" — which
breaks the moment real work arrives. REPEAT accepts a value as constant only
when a human **authored** it *and* no known rule already derives it. Ownership
is derivable from the department, so it stays bound to the classification even
though every observation agreed. The interface says so in words rather than
leaving it implied.

The third message is a duplicate-billing complaint — a department REPEAT has
never observed being handled. It reclassifies the issue as Billing, routes it
to Awaiz, and announces it in #billing-finance instead of #technical-support.
Owner *and* audience both adapt, from rules rather than memory, to a
combination that never appeared in the examples it learned from.

A fourth message is deliberately vague — "Something went wrong yesterday."
REPEAT classifies it as unresolved at about 32% confidence and refuses to route
it, handing it back to a human. Knowing when not to act is part of the
workflow, and for a support team it is the part that earns trust.

**Technical execution.**

Next.js 15 (App Router), React 19, TypeScript in strict mode, Tailwind CSS,
Framer Motion, React Flow (@xyflow/react), Zustand, Zod and Lucide. CopilotKit
with a self-hosted AG-UI runtime streams the Ghost Run as generative-UI tool
calls — REPEAT's planner runs as a custom AG-UI agent, with no chat component
mounted anywhere. Live surfaces use the Gmail API over OAuth (with ImapFlow and
mailparser for the IMAP path), the ClickUp API, and a Slack bot token so the
agent can post per department rather than into a single fixed webhook channel.

The engine is a pipeline with separated concerns: Observer → Semantic Event
Normalizer → Trace Store → Pattern Detector → Pattern Compiler → Workflow Agent
→ Ghost Runner → Policy and Approval Layer → Executor → Verifier → Activity
Log.

Pattern detection is deterministic and inspectable, with no trained model:
normalised Levenshtein similarity over action verbs (0.55), Jaccard similarity
over the application set (0.20), and bag-of-words cosine similarity over
semantic intent (0.25), combined into a confidence score that is discounted for
sample size so it never displays a fabricated-looking 100%. Every number is
shown to the user. The event model has no field capable of holding a
coordinate.

**Safety and trust.**

Safety is handled outside the model. A policy layer classifies every action by
consequence: reading and analysis run automatically, creating external records
and sending messages require approval, and payments are blocked outright in the
prototype. The guard runs before each individual action, so no code path can
bypass it. Execution is idempotent — a nervous double-click cannot file two
tickets. A failure stops the run, preserves the steps that completed, marks the
rest *not attempted*, and never reports a failed step as successful. Retry
resumes from the failed action rather than restarting, so a recovered run
cannot duplicate a ticket.

The Manifest V3 Chrome extension is the real version of the observation layer.
It records semantic context instead of coordinates, never touches password or
payment fields, skips any page with a password input, strips query strings, and
posts through a server endpoint that re-validates and re-redacts everything it
receives, because a browser is not a trusted source.

**Reliability.**

A fully deterministic Demo Mode is the default and needs no external APIs, no
internet and no keys: the complete experience of observing, learning,
previewing and executing runs offline with identical results. A 58-assertion
headless self-test (`npm run verify`) exercises the entire pipeline in about a
second — including the generalisation, the refusal, the policy guard and
resume-not-restart — and a separate live self-test checks the real services.

**The value.**

Most repetitive work never gets automated because documenting and configuring
it costs more than doing it. REPEAT removes that cost. Instead of asking people
to stop working and explain their process to software, it lets them carry on
working.

Repeated behaviour becomes a pattern. The pattern becomes a workflow. The
workflow becomes an agent.

**REPEAT — Show it once. Never do it again.**
```

---

## 3. Products & Tools Used

Tick these — each one is verifiable in the repo:

- **OpenRouter** — the live understanding step (`lib/llm/openrouter.ts`,
  `lib/agents/understanding-live.ts`, `POST /api/understand`) reads every new
  report through OpenRouter's chat completions API with model routing and
  fallbacks. Judges can run `npm run verify:live`.
- **Exa** — the research step (`lib/research/exa.ts`, `POST /api/research`)
  searches Exa for related public context and attaches it to the Ghost Run and
  the ticket body. Same self-test.
- **OpenAI** — the default OpenRouter model is `openai/gpt-4.1-mini`, so in
  live mode an OpenAI model is what reads the report. (If you also used Codex
  while building, that is a second honest reason.)
- **CopilotKit** — in live mode the Ghost Run is streamed over AG-UI through
  a self-hosted CopilotKit runtime (`app/api/copilotkit/[[...slug]]/route.ts`,
  `components/copilot/`): REPEAT's planner is a custom AG-UI agent and every
  proposed action arrives as a generative-UI tool call. No chat component is
  mounted and no prompt is typed. Judges can run `npm run verify:copilotkit`.
- **Ambiguous AI** — the approved "Create issue" step files a real task
  through the Ambiguous Tasks API (`lib/adapters/ambiguous.ts`), by default
  against their credential-free sandbox, or a real workspace with an `ak_`
  key. Judges can run `npm run verify:ambiguous` with no account.
- **AI Tinkerers** — tick if you count the event/platform as helpful (your call).
- **Other products (not on the tick list):** **ClickUp** — the agent files the
  real ticket there (`lib/adapters/clickup.ts`); **Google Gemini API** — an
  optional direct model provider.

Do **not** tick Trigger.dev, Auth0 or Mozilla.ai — they were researched and
deliberately not built (see `docs/STACK.md`), and a false claim costs more
than a missing tick. Auth0 becomes honest only if a team member creates a
tenant and the 401 → login → approve path is wired and demonstrated.

- **Other Products** — paste:

```
OpenRouter (live model understanding via chat completions with model routing; default openai/gpt-4.1-mini, fallback anthropic/claude-haiku-4.5), Exa (related-context research attached to the Ghost Run and ticket), CopilotKit (self-hosted AG-UI runtime; REPEAT's planner runs as a custom agent and streams the Ghost Run as generative-UI tool calls, no chat), Ambiguous AI (Tasks API — the approved run files a real task, sandbox or workspace), ClickUp API (the approved run creates and assigns a real task in the team's list), Google Gemini API (optional direct model provider via the OpenAI-compatible endpoint), Claude Code (build tooling), Next.js 15, React 19, TypeScript, Tailwind CSS, Framer Motion, React Flow (@xyflow/react), Zustand, Zod, Lucide, Chrome Extensions Manifest V3, GitHub REST API + Slack webhooks (optional live adapters). The judged demo also runs fully offline in Demo Mode with a deterministic classifier.
```

---

## 4. Project Video (optional, 2 min max)

Script is ready at `docs/DEMO-SCRIPT.md` — timed to 2:00 with exact beats and a
"if something goes wrong" table. Record the screen at **1366×768 or wider**
(below 1280px the workspace scrolls). Run `npm run verify` first; if it prints
`engine OK` the demo path is sound.

Suggested cut: 0:00 framing · 0:10 run 1 by hand · 0:35 run 2 · 0:50 Pattern
Discovered + the "not memorised" box · 1:05 third bug, hands off · 1:10 the
Umar→Noor adaptation · 1:20 Execute · 1:40 13 actions → 1 approval · 1:52 close.

---

## 5. Team Contributions

**ACTION NEEDED — verify and correct before submitting.**

I drafted these from the team roles encoded in the product's routing table
(`lib/demo/team.ts`). I do not have first-hand knowledge of who did what today,
so **please correct each line to what actually happened** — judges read this
field closely and inaccurate credit is worse than terse credit.

**Awaiz Ahmed (Lead)**
```
Led the project and owned the AI/data layer: the semantic event taxonomy, the deterministic understanding engine (weighted signal classifier for engineering area, category and severity with evidence extraction), the pattern detector's similarity scoring, and the pattern compiler — including the provenance-and-functional-dependency rule that stops REPEAT memorising a value it can derive. Also set the scope decision to build one flawless end-to-end sequence rather than several shallow ones, and wired the live understanding path — a model via OpenRouter plus related-context research via Exa, run concurrently — with Zod validation, literal-evidence checking and deterministic fallback.
```

**Mohammad Umar (Member)**
```
Backend and engine internals: the executor and verifier (per-action policy guard, resume-not-restart on retry, downstream issue-number correction), the policy/approval layer and permission classes, the adapter interfaces with in-memory and live GitHub/Slack implementations, and the Next.js API routes (/api/understand, /api/research, /api/execute, /api/observe), including the OpenRouter and Exa clients with per-provider timeouts.
```

**Noor AlHamoud (Member)**
```
Frontend and design system: the dark near-black visual language and token set, the REPEAT orb and its six states, the three replica application windows (mail, issue tracker, team chat), the animated workflow rail, the Pattern Discovered card and its collapse-into-agent moment, and the Ghost Run panel layout — including the two-column action list that keeps Execute above the fold.
```

**Huda Mueen (Member)**
```
Research and verification: the 58-assertion headless engine self-test covering classification, generalisation, the frontend reroute, the policy guard, failure handling and resume semantics; the demo fixtures including the deliberately ambiguous fourth report that exercises the requires-review path; and cross-resolution QA at 1366×768, 1512×900 and 1920×1080.
```

**Obaid Mukaddam (Member)**
```
Product and operations: the demo narrative and 2-minute script, the hidden demo console and error-injection controls that make the run presentable under pressure, the explainability and privacy surfaces (what REPEAT observes, what it ignores, and the limitations we explicitly do not claim), and the derived time-saved metric model with its per-action effort table.
```

---

## 6. Additional Links

```
GitHub repository: https://github.com/4waiz/REPEAT
2-minute demo script: https://github.com/4waiz/REPEAT/blob/main/docs/DEMO-SCRIPT.md
Architecture & design decisions: https://github.com/4waiz/REPEAT/blob/main/README.md
Products used and what each does for the agent: https://github.com/4waiz/REPEAT/blob/main/docs/STACK.md
```

---

## 7. Prior Work

```
None. The repository was initialised empty today (12 September 2026) and contains a single commit, 2db6efb, with all 73 files and 19,416 lines written during the event. There is no pre-existing code, scaffolding, design system or template underneath this — the Next.js app, the design language, the semantic event model, the pattern detector and compiler, the Ghost Run safety layer, the executor, the Chrome extension and the 58-assertion self-test were all authored today. The commit history is public and verifiable.

Only standard open-source libraries are used as dependencies (Next.js, React, Tailwind CSS, Framer Motion, React Flow, Zustand, Zod, Lucide).
```

> Check one thing: the repo was created at 06:19 +04 and the official focused
> build window was 11:15–15:30. If your event requires code written *only*
> inside that window, reword to "during the event day" or ask an organiser.
> Better to raise it than have it questioned.

---

## 8. Social Media Posts

### X / Twitter

```
Automation usually starts by asking a human to document their workflow.

We asked: what if the workflow documented itself?

REPEAT watches you triage a bug twice — then says "pattern discovered."

13 manual actions → 1 approval.

The part I like: both training bugs went to @umar. Owner never varied. REPEAT still refused to memorise it, because the value is derivable from the engineering area. So when a FRONTEND bug arrived — an area it had never seen — it rerouted to the right person on a rule, not a memory.

No chat window. Your behaviour is the prompt.

Live mode reads the report through @openrouter and pulls related context from @exaailabs — and if either is down, it degrades to the offline classifier instead of an error.

Built at @AITinkerers #AgentsEverywhere

@OpenAI @CopilotKit @openrouter @exaailabs @auth0 @ambiguousio @triggerdotdev @mozillaAI

github.com/4waiz/REPEAT
```

> Drop `@umar` if that isn't his handle — just write "Umar".

### LinkedIn

```
Automation normally begins by asking a human to document their workflow: pick a trigger, add conditions, wire up actions, test it. For everyday work, describing it costs more than doing it — so it never gets automated at all.

This weekend at the AI Tinkerers "Agents, Everywhere" hackathon in Abu Dhabi, Team Kanban asked a different question: what if the workflow documented itself?

REPEAT is an AI layer that learns repetitive work by watching how you already work. It has no chat input. You never write a prompt. Your behaviour is the prompt.

Triage a bug report by hand. Do it again. REPEAT says "Pattern discovered" — 13 manual actions → 1 approval — and collapses what it saw into a reusable agent. When the third report arrives, you do nothing: it plans the work in a "Ghost Run" that has changed nothing yet, shows you every action, its permissions and its risk, and waits for one approval.

The hardest part was making sure it wasn't a macro. Both bugs we trained on were backend bugs assigned to the same engineer, so that field never varied — a naive system bakes in "always assign Umar" and breaks the moment work changes. REPEAT only accepts a value as fixed if a human authored it AND no rule already derives it. So when a frontend bug arrived — an area it had never observed — it reclassified and rerouted to the right owner from a rule, and told us it had done so.

Agents shouldn't live in a separate chat window. They should live where the work is.

Built with Next.js, React, TypeScript, Tailwind, Framer Motion, React Flow, Zustand and Zod. Live mode reads each report with a model through OpenRouter and attaches related context found by Exa; Demo Mode runs fully offline with no API keys. 58 offline assertions plus a live integration self-test guard the behaviour.

Code: https://github.com/4waiz/REPEAT

#AgentsEverywhere

AI Tinkerers, OpenAI, CopilotKit, OpenRouter, Exa, Auth0, Ambiguous AI, Trigger.dev, Mozilla.ai, Google Cloud
```

> Both posts tag the sponsor list because the form requires it. OpenRouter,
> Exa, CopilotKit and Ambiguous AI are genuinely used (live mode); Auth0,
> Trigger.dev and Mozilla.ai are tags only — keep it that way.
