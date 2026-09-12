# Products and tools used — and what each one does for the agent

Everything in this file is verifiable in the repository. Nothing is listed
that the code does not actually call.

## 1. What runs the agent at runtime

| Product | Where in the code | What it does for the agent |
|---|---|---|
| **OpenRouter** | [`lib/llm/openrouter.ts`](../lib/llm/openrouter.ts), [`lib/agents/understanding-live.ts`](../lib/agents/understanding-live.ts), `POST /api/understand` | The *understanding* step. When a learned trigger fires, REPEAT sends the new report to a model through OpenRouter's chat completions API and gets back the structured interpretation: customer, title, description, category, engineering area, severity, labels, evidence, confidence. One endpoint for every model, so the model is an environment variable (`OPENROUTER_MODEL`), with `OPENROUTER_FALLBACK_MODELS` for OpenRouter's model routing if the primary is down. |
| **OpenAI** (through OpenRouter) | `.env.example` → `OPENROUTER_MODEL=openai/gpt-4.1-mini` | The default model that reads the report. Chosen because it is fast (~2–3 s measured), cheap ($0.40 / M input tokens on OpenRouter — well under a tenth of a cent per report) and emits JSON reliably. `anthropic/claude-haiku-4.5` and `google/gemini-2.5-flash` were also run through the live self-test and pass 37/37; Gemini Flash is the fastest at ~1.5 s. |
| **Exa** | [`lib/research/exa.ts`](../lib/research/exa.ts), `POST /api/research` | The *research* step. In parallel with the model, REPEAT searches Exa (`/search`, `type: auto`, 3 results with highlights) for public pages related to the symptom — docs, similar issues, status posts — and attaches them to the Ghost Run and the ticket body. At Exa's listed prices (search $7 / 1k requests, content $1 / 1k pages) that is roughly a cent per report. |
| **Zod** | [`lib/agents/understanding.ts`](../lib/agents/understanding.ts) | The contract the model must satisfy. Anything that does not parse is refused in full and the deterministic classifier answers instead. |
| **Next.js 15 (App Router) + React 19 + TypeScript strict** | `app/`, `components/`, `lib/` | The workspace with the three replica apps, the API routes, and the engine. The keys live on the server; the browser never sees them. |
| **Zustand** | [`lib/store/repeat-store.ts`](../lib/store/repeat-store.ts) | The live engine state. Every UI transition and the headless self-test go through the same pipeline. |
| **Tailwind CSS · Framer Motion · React Flow (@xyflow/react) · Lucide** | `components/` | The interface: the Ghost Run, the Memory Map, the timeline, the orb. |
| **Chrome Extensions Manifest V3** | [`extension/`](../extension) | The real observation layer — DOM interactions become semantic events posted to `/api/observe`, which re-validates and re-redacts everything. |
| **ClickUp** | [`lib/adapters/clickup.ts`](../lib/adapters/clickup.ts), [`lib/adapters/remote.ts`](../lib/adapters/remote.ts), `POST /api/execute` | The *ticketing* step, for real. After the one approval, the executor's "Create issue" and "Assign owner" steps create a task in a ClickUp list (title, markdown body with the Exa references, labels as tags, priority urgent/high/normal/low) and assign it by matching the owner's name against workspace members. The browser-side executor is unchanged; each consequential step goes to `/api/execute`, which derives the permission from the action and re-runs the policy guard. |
| **Google Gemini API** (direct, optional) | [`lib/llm/openrouter.ts`](../lib/llm/openrouter.ts) | Same client, Google's OpenAI-compatible endpoint (`GEMINI_API_KEY`), used when no OpenRouter key is set. |
| **GitHub REST API · Slack webhooks** | [`lib/adapters/github.ts`](../lib/adapters/github.ts), `POST /api/execute` | Optional live executors behind the same adapter interface; GitHub is used when ClickUp is not configured. |

**Build tooling:** Claude Code (this codebase was built and integrated with it). The team also holds OpenAI Codex credits; those are Codex usage credits for the coding agent, not API credits, and the app does not call Codex.

## 2. How the two live integrations make the agent better

The judging criteria are functionality, innovation in a real setting,
technical integration, and usefulness with clear user control. Here is what
each integration adds against them — and what it deliberately does not change.

**It reads, instead of matching keywords.** Demo Mode classifies with a
weighted signal table. That is honest and offline, but it only knows the
symptoms it was written for. With OpenRouter the agent reads the report the
way the human did: bug 3 becomes *"Mobile navigation bar layout and
interaction issues"* with the four sentences that justify it quoted back.
And the vague report (#4) comes back `unresolved` at 30% confidence — the
model is allowed to say "I don't know", and the policy layer turns that into
a human review instead of a guess.

**It arrives with context the human never had time to gather.** The Exa step
is a step the human never performed. The ticket REPEAT files carries three
public pages that match the symptom (for the navbar bug: a Stack Overflow
thread on fixed navbars overlapping content on mobile, and two mobile-menu
troubleshooting guides). The owner starts from context, not from a blank
ticket. That is the agent adding value rather than replaying the workflow.

**It does not change what makes REPEAT REPEAT.** The model produces the
*understanding*; the planner, the policy layer, the routing rules and the
executor are untouched. The Umar → Noor reroute on the frontend bug is still
`area → owner`, a rule, not a memory — the live self-test asserts it with the
model's understanding as input. Labels keep the convention the human was
observed using (`bug + category + area`); the model's own labels are added
after, for specificity.

**It cannot break the demo.** Both passes have hard timeouts (8 s model,
6 s research), both degrade with a stated reason, and a bad key produces the
deterministic answer byte-for-byte. Demo Mode makes zero network calls and is
unchanged.

**The user can see exactly what happened.** The Ghost Run names the model
that read the report (`openai/gpt-4.1-mini via OpenRouter · validated`), the
timeline records the latency and the *exact* string sent to Exa, and the
privacy page states what leaves the machine. Only the symptom phrase goes to
Exa — never the sender, their address or the message body — and that is
enforced in `buildResearchQuery`, not promised in a paragraph.

**It is tested against the real services.** `npm run verify:live` (37
checks) reads the four fixtures through OpenRouter and Exa and asserts the
classifications, literal evidence, the review path, the privacy rule, the
graceful failure and the unchanged reroute.

**The ticket is real.** With ClickUp configured, the third bug in the demo
produced task `z8t8qgd17k` in the team's *Engineering & Delivery* list:
model-written title and description, the three Exa references in the body,
tags `bug, ui, frontend, mobile, navigation`, priority high, assigned — and
the completion card links to it. Demo Mode still touches nothing.

## 3. How to advance this agent

In rough order of value for effort, and using tools already in the stack:

1. **Confidence-gated escalation across models.** When the primary model's
   confidence is below the owner floor, retry once with a stronger model
   (OpenRouter makes this one field change) before asking a human. Measure how
   often the human review path is avoided without a wrong route.
2. **Structured outputs instead of JSON mode.** OpenRouter supports
   `response_format: json_schema` with strict schemas on the default model.
   Generate the schema from the Zod contract so the model cannot produce an
   invalid shape at all; keep the literal-evidence check, which a schema
   cannot express.
3. **Duplicate and prior-art detection.** Before filing, ask the model whether
   the new report matches an open issue in the tracker (the seed issues are
   already in memory) and use Exa `findSimilar` on the attached references to
   surface an existing public fix. The Ghost Run would say *"looks like #40 —
   file anyway?"*.
4. **A one-paragraph brief with citations.** Exa's `/answer` endpoint returns a
   cited answer for a query; *"what is known about this symptom"* on the
   ticket is a natural next step after the reference list.
5. **Correction as training signal.** When the human picks an owner on an
   `unresolved` report, or edits a title in the Ghost Run, feed that decision
   back as the next observation and as a few-shot example in the
   understanding prompt. The README already names this as roadmap; the live
   path makes it cheap.
6. **Learned dependency discovery.** Let the model propose `field → field`
   rules from the observed traces (the way `area → owner` is hand-written
   today), then have the compiler verify each proposal against every
   observation before it is allowed to bind a variable. The compiler stays
   the authority; the model only proposes.
7. **Real surfaces.** The Chrome extension already emits semantic events;
   wire it to Gmail, GitHub Issues and Slack, and switch `/api/execute` on so
   the same run files a real issue and posts a real message.
8. **An accuracy benchmark.** Grow the four fixtures into fifty reports with
   golden labels and extend `verify:live` to score each model's accuracy,
   latency and cost, so the default model is chosen by measurement rather
   than by name.
