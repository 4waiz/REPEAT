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

Automation normally begins by asking a human to document their workflow: pick a
trigger, add conditions, wire up actions, test it. For everyday work the
describing costs more than the doing, so it never gets automated. REPEAT asks a
different question — what if the workflow documented itself?

REPEAT is an agent that lives *inside* the tools where work already happens. Our
environment is the support-triage desktop: an email client, an issue tracker and
a team chat, side by side in one workspace. The agent has no chat input. You
never type a prompt. **Your behaviour is the prompt.**

**The workflow.** A customer emails a bug report. A human reads it, works out
what is actually broken, writes an engineering ticket, labels it, prioritises it,
decides who owns it, files it, and tells the team. Measured by our own effort
model that is 13 semantic actions across 3 applications, ~4m 43s of attention,
every single time.

**What REPEAT does.** Run 1: you triage by hand; REPEAT observes. Run 2: you do
it again; confidence climbs live (63% → 96%). It then says **Pattern
discovered** — 13 manual actions → 1 approval — and collapses the five observed
steps into one reusable agent. Run 3: a third bug arrives and you touch nothing.
REPEAT detects the trigger and opens a **Ghost Run**: a fully resolved plan that
has changed nothing, showing every proposed action, its permission class, the
risk level, and the literal phrases from the email that justified its reading.
You approve once; it executes and verifies.

**Why this cannot be a chatbot.** A chatbot must be told. REPEAT is never told
anything — it only ever sees what you did. The environment *is* the interface:
the observation, the pattern, the plan and the result all happen in the same
three windows where the work lives, so the automation is legible in context
rather than described in a transcript.

**The innovation — and the hard part.** Both training bugs in our demo happen to
be backend bugs assigned to Umar, so the `owner` field never varies. A naive
compiler diffs the observations, sees a constant, and bakes in "always assign
Umar" — that is a macro, and it fails the moment work changes. So in REPEAT
constants must earn it: a field is only constant when the human **authored** it
*and* no known rule already derives it. Anything computed from the trigger stays
bound even when every sample agreed, because two identical samples are one
coincidence, not evidence. The UI says so in words: *"Owner was Umar in every
observation, but it is consistent with the rule area → owner, so it is bound to
Engineering area rather than memorised."* Consequently the third bug — a
**frontend** bug, an area REPEAT has never seen — is reclassified and rerouted
to **Noor** on a rule, not a memory. Delete the routing rule and it stops
working; change the email text and it routes elsewhere.

**Technical execution.** Next.js 15 (App Router) · React 19 · TypeScript strict
· Tailwind CSS · Framer Motion · React Flow (@xyflow/react) · Zustand · Zod ·
Lucide. ~11,100 lines of TypeScript. The engine is a real pipeline with separated
concerns: Observer → Semantic Event Normalizer → Trace Store → Pattern Detector →
Pattern Compiler → Workflow Agent → Ghost Runner → Policy/Approval Layer →
Executor → Verifier → Activity Log. Pattern detection is deterministic and
inspectable — normalised Levenshtein over action verbs (0.55), Jaccard over the
app set (0.20), bag-of-words cosine over semantic intent (0.25) — with no trained
model, and every number is shown to the user. Reported confidence is discounted
for sample size so it never displays a fabricated-looking 100%. The event model
has **no field capable of holding a coordinate**: REPEAT records `mail.read_message`,
never `click x=531 y=322`. It also names latent steps the human never clicked —
when prose becomes a structured title, labels and a priority, an "understand"
step demonstrably happened, so REPEAT labels it as inferred with lower confidence.

**Safety and UX.** A policy layer — not the model — classifies every action by
consequence; `create_external` and `send_message` require approval and `payment`
is blocked outright. The guard runs before every individual action, so no code
path can bypass it; Execute is idempotent (a nervous double-click cannot file two
tickets); a failure stops the run, preserves completed steps, marks the rest *not
attempted*, and never reports a failed step as successful; retry **resumes rather
than restarts**, so a recovered run cannot duplicate a ticket. The Ghost Run
shows evidence, structured interpretation, permissions, risk and expected
result — never model reasoning. A 58-assertion headless self-test (`npm run
verify`) exercises the whole pipeline in about a second.

**Reliability.** Demo Mode is the default: zero network calls, zero API keys,
deterministic IDs and classification, system fonts and synthesised WebAudio
instead of loaded assets. The demo renders identically with the Wi-Fi off.
Claude, GitHub and Slack adapters are wired in behind the same interfaces for
live use; the model path is Zod-validated, requires its cited evidence to be
quotable from the source text, times out at 6s, and falls back to the
deterministic classifier — so a model failure can never reach the UI as an error.

Also included: a Manifest V3 Chrome extension that is the real version of the
observation layer (never touches password or payment fields, records no
coordinates, skips any page with a password input, strips query strings), and a
`/api/observe` endpoint that re-validates and re-redacts everything it receives
because a browser is not a trusted source.
```

---

## 3. Products & Tools Used

**ACTION NEEDED — read this before ticking boxes.**

We did not use OpenAI, CopilotKit, OpenRouter, Exa, Trigger.dev, Auth0,
Mozilla.ai or Ambiguous AI. Do not tick them. Judges can check the repo, and a
false claim costs more than a missing tick.

- **AI Tinkerers** — tick if you count the event/platform as helpful (your call).
- **Other Products** — paste:

```
Anthropic Claude (optional Zod-validated understanding path in /api/understand; the judged demo runs the deterministic classifier so it works fully offline), Claude Code (build tooling), Next.js 15, React 19, TypeScript, Tailwind CSS, Framer Motion, React Flow (@xyflow/react), Zustand, Zod, Lucide, Chrome Extensions Manifest V3, GitHub REST API + Slack webhooks (optional live adapters)
```

> **Worth 15 minutes if you want a sponsor tick honestly:** the LLM path is
> already isolated in one file (`app/api/understand/route.ts`) behind a Zod
> schema with a deterministic fallback. Pointing it at **OpenRouter** is a
> base-URL, header and model-name change. That would make an OpenRouter tick
> truthful without touching the demo path. Say the word and I'll do it.

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
Led the project and owned the AI/data layer: the semantic event taxonomy, the deterministic understanding engine (weighted signal classifier for engineering area, category and severity with evidence extraction), the pattern detector's similarity scoring, and the pattern compiler — including the provenance-and-functional-dependency rule that stops REPEAT memorising a value it can derive. Also set the scope decision to build one flawless end-to-end sequence rather than several shallow ones, and wired the optional Anthropic Claude understanding path with Zod validation and deterministic fallback.
```

**Mohammad Umar (Member)**
```
Backend and engine internals: the executor and verifier (per-action policy guard, resume-not-restart on retry, downstream issue-number correction), the policy/approval layer and permission classes, the adapter interfaces with in-memory and live GitHub/Slack implementations, and the Next.js API routes (/api/understand, /api/execute, /api/observe).
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

Built with Next.js, React, TypeScript, Tailwind, Framer Motion, React Flow, Zustand and Zod. Runs fully offline with no API keys. 58 automated assertions guard the behaviour.

Code: https://github.com/4waiz/REPEAT

#AgentsEverywhere

AI Tinkerers, OpenAI, CopilotKit, OpenRouter, Exa, Auth0, Ambiguous AI, Trigger.dev, Mozilla.ai, Google Cloud
```

> Both posts tag the sponsor list because the form requires it. Neither claims
> we used those tools — keep it that way.
