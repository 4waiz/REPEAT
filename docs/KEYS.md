# Keys and integrations — what REPEAT needs, where to get it, what it unlocks

Everything goes in `.env` at the repo root (copy `.env.example`). `.env` is
gitignored; never commit it and never paste keys into docs or chat logs you
intend to share. With **no** `.env` at all, REPEAT runs fully offline in Demo
Mode and needs nothing below.

Status legend: ✅ configured and verified today · 🔑 needs a value from you ·
🧪 optional

---

## 0. Mode

| Variable | Value | Meaning |
|---|---|---|
| `DEMO_MODE` | `false` | Live mode: real model, real research, real tickets. `true` = offline, deterministic, zero network. |

---

## 1. Model understanding (one of these) — reads the report

| Provider | Variables | Where to get it | Status |
|---|---|---|---|
| **OpenRouter** (default, recommended) | `OPENROUTER_API_KEY`, `OPENROUTER_MODEL` (default `openai/gpt-4.1-mini`), `OPENROUTER_FALLBACK_MODELS` (e.g. `anthropic/claude-haiku-4.5`), `OPENROUTER_SITE_URL` | https://openrouter.ai/keys → Create key. Any model id from https://openrouter.ai/models works. | ✅ |
| OpenAI direct | `OPENAI_API_KEY`, `OPENAI_MODEL` (`gpt-4.1-mini`) | https://platform.openai.com/api-keys — a real API key (`sk-…`). **Codex credits are not API credits** and cannot be used here. | 🧪 |
| Gemini direct | `GEMINI_API_KEY`, `GEMINI_MODEL` (`gemini-2.5-flash`) | https://aistudio.google.com/apikey | 🧪 (code path tested; add your key to confirm) |

Precedence when several are set: OpenRouter → OpenAI → Gemini.

## 2. Research — attaches related context to the ticket

| Provider | Variables | Where to get it | Status |
|---|---|---|---|
| **Exa** | `EXA_API_KEY` | https://dashboard.exa.ai → API Keys. Only the symptom phrase is ever sent. | ✅ ($70 balance) |

## 3. Plan streaming — the Ghost Run over AG-UI

| Provider | Variables | Where to get it | Status |
|---|---|---|---|
| **CopilotKit** (self-hosted runtime) | `COPILOTKIT_TELEMETRY_DISABLED=true` | No key needed — the runtime is in the repo at `/api/copilotkit`. | ✅ |

## 4. Ticketing — where the approved run files the ticket

The first configured tracker wins, or force one with `TRACKER=clickup|jira|ambiguous|github`.

| Tracker | Variables | Where to get it | Status |
|---|---|---|---|
| **ClickUp** | `CLICKUP_API_KEY` (personal token `pk_…`), `CLICKUP_LIST_ID`, `CLICKUP_TEAM_ID` (optional), `CLICKUP_ASSIGNEES` (owner name → user id map, e.g. `Umar=260468885,Noor=216252351`) | Token: ClickUp → avatar → **Settings → Apps → API Token**. List id: open the list, it is the number in the URL (`/v/li/<LIST_ID>`). User ids: `GET https://api.clickup.com/api/v2/team` (or ask me — I can list them). | ✅ Kanban Studios · Engineering & Delivery. **Noor is not in the workspace** — currently mapped to Awaiz; fix the map or add her. |
| **Jira Cloud** | `JIRA_BASE_URL` (`https://<site>.atlassian.net`), `JIRA_EMAIL` (the Atlassian account email), `JIRA_API_TOKEN`, `JIRA_PROJECT_KEY` (e.g. `KAN`), `JIRA_ISSUE_TYPE` (default `Bug`; use `Task` if the project has no Bug type) | Token: https://id.atlassian.com/manage-profile/security/api-tokens → **Create API token**. Project key: the prefix of any issue key in that project (`KAN-12` → `KAN`). Assignment matches team first names against Jira display names; override with `JIRA_ASSIGNEES=Noor=<accountId>,…` (I can look up accountIds once the token is in). | 🔑 needed for the Jira window and Jira tickets |
| **Ambiguous AI** | `AMBIGUOUS_SANDBOX=true` (no account) or `AMBIGUOUS_API_KEY` (`ak_…`) + `AMBIGUOUS_CHANNEL_ID` | Sandbox needs nothing. Workspace key: `npx ambiguous auth signup --name "REPEAT" --human-email you@example.com` or https://app.ambiguous.ai/developers | ✅ sandbox |
| GitHub Issues | `GITHUB_TOKEN` (fine-grained PAT, Issues: read & write), `GITHUB_REPO` (`owner/repo`), `REPEAT_GH_<NAME>=<login>` per owner | https://github.com/settings/personal-access-tokens | 🧪 |

## 5. Mail — the real inbox (replaces the replica Mail window)

| Provider | Variables | Where to get it | Status |
|---|---|---|---|
| **Gmail (IMAP, app password)** — fastest | `GMAIL_ADDRESS` (the Gmail address), `GMAIL_APP_PASSWORD` (16 characters, no spaces needed), `GMAIL_QUERY` (optional filter, e.g. `to:support@yourdomain.com` or a label) | Turn on **2-Step Verification** for the Google account, then https://myaccount.google.com/apppasswords → app name "REPEAT" → copy the 16-character password. Works with personal Gmail and Workspace accounts whose admin allows app passwords. | 🔑 needed for a real inbox |
| Gmail API (OAuth) — alternative | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, then a one-time "Connect Gmail" click | Google Cloud console → new project → enable **Gmail API** → OAuth consent screen (External, Testing, add your Gmail as a test user) → Credentials → OAuth client (Web) with redirect `http://localhost:3000/api/mail/callback` | 🧪 only if app passwords are blocked for the account |

## 6. Team notification — the last step of the workflow

| Provider | Variables | Where to get it | Status |
|---|---|---|---|
| **Slack** | `SLACK_WEBHOOK_URL` | https://api.slack.com/apps → Create app → Incoming Webhooks → Add to workspace → pick a channel → copy the webhook URL | 🔑 optional; without it the replica chat window is used and labelled as such |
| Ambiguous channel | `AMBIGUOUS_API_KEY` + `AMBIGUOUS_CHANNEL_ID` | see §4 | 🧪 |

## 7. The Chrome extension — observing the real Gmail / ClickUp / Jira tabs

No key. Load `extension/` unpacked (`chrome://extensions` → Developer mode →
Load unpacked) while `npm run dev` is running in live mode. It only sends
semantic events to `http://localhost:3000/api/observe`; the workspace polls
that feed and learns from it exactly as from the replica apps. You test it
in your own logged-in Chrome: the popup shows the last events captured,
whether REPEAT received them, and has a **Finish observation** button for
when a pass is done. `npm run verify:surfaces` checks every connector above
with one command.

## 8. MCP servers (for the coding agent, not the app)

| Server | Setup | Note |
|---|---|---|
| Exa MCP | `claude plugin install exa@claude-plugins-official`, then a new Claude Code session | Gives Claude Code web search. The app calls Exa's REST API directly. |
| ClickUp MCP | `claude mcp add --transport http clickup https://mcp.clickup.com/mcp` (then sign in via OAuth when Claude Code prompts) | **OAuth-only by ClickUp's own FAQ** — it cannot be used with a `pk_` token, and it is capped at 50–300 calls/day without their AI add-on. So the app talks to ClickUp's REST API (100 req/min); the MCP is for Claude Code. |

---

## What I need from you right now, in priority order

1. **Jira**: site URL, account email, API token, project key → Jira window + Jira tickets.
2. **Gmail**: address + app password → real inbox and real triggers.
3. **Slack** webhook (optional) → real team notification.
4. **Noor's ClickUp mapping** (or add her to the workspace).
5. **Gemini key** (optional) → one confirmation call.

Paste them here or put them straight into `.env` and tell me — either way I will verify each one with a single real call before wiring the UI to it.
