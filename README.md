# QEA Banking Agents — AI-Powered QA Workspace

A VS Code-based AI agent system for Quality Engineering & Assurance (QEA) in banking
domain projects. The system auto-fetches live context from Jira and Confluence before
every agent interaction, ensuring Copilot always works with real, up-to-date project data.

---

## How It Works

```
You type:   "BANK-4521 generate test cases"
               │
               ▼
       context-fetcher.js
       ┌──────────────────────────┐
       │  Detects: BANK-4521      │
       │  → Calls Jira REST API   │
       │  → Calls Confluence API  │
       │  → Writes context/*.md   │
       └──────────────────────────┘
               │
               ▼
       Copilot Chat — type @AgentName
       (agents auto-discovered from .github/agents/)
               │
               ▼
       Agent reads live context → generates accurate output
```

The key principle: **agents always see the real acceptance criteria from Jira**,
not whatever you remember to type — making every output directly traceable to
your stories and BRD.

---

## Project Structure

```
QEA-Banking-Agents/
├── .github/
│   ├── agents/                           ← VS Code Copilot custom agents (auto-discovered)
│   │   ├── TestCaseGenerator.agent.md    ← @TestCaseGenerator
│   │   ├── BRDMapper.agent.md            ← @BRDMapper
│   │   ├── DefectAnalyzer.agent.md       ← @DefectAnalyzer
│   │   ├── SQLDataGen.agent.md           ← @SQLDataGen
│   │   ├── RegressionSelector.agent.md  ← @RegressionSelector
│   │   ├── APITestAgent.agent.md         ← @APITestAgent
│   │   └── TraceabilityMatrix.agent.md  ← @TraceabilityMatrix
│   └── copilot-instructions.md           ← Global rules applied to every agent
├── .vscode/
│   └── tasks.json                        ← VS Code tasks (Ctrl+Shift+B)
├── scripts/
│   ├── .env                              ← Your API keys (gitignored, never commit)
│   ├── .env.example                      ← Template — copy this to .env
│   ├── context-fetcher.js                ← Core: auto-detects and fetches context
│   ├── jira-client.js                    ← Jira REST API v3 module
│   └── confluence-client.js              ← Confluence REST API module
├── agents/                               ← Backup prompt files (reference copies)
│   ├── testcase-gen.prompt.md
│   ├── brd-mapper.prompt.md
│   ├── defect-analyzer.prompt.md
│   ├── sql-datagen.prompt.md
│   ├── regression-selector.prompt.md
│   ├── api-test-agent.prompt.md
│   └── traceability-matrix.prompt.md
├── context/                              ← Auto-populated at runtime (gitignored)
│   ├── current-story.md                  ← Active Jira story
│   ├── current-brd.md                    ← Confluence BRD page
│   ├── defect-history.md                 ← Recent project defects
│   ├── current-sprint.md                 ← All open sprint stories
│   └── related-pages.md                  ← Auto-searched related Confluence pages
├── .nvmrc                                ← Pins Node.js version (22.17.1)
├── .gitignore
├── package.json
└── README.md
```

---

## Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | 16+ (22.17.1 recommended) | Runs all scripts |
| nvm-windows | Latest | Optional — manages Node versions on Windows |
| VS Code | 1.99+ | Required for `.agent.md` custom agent support |
| GitHub Copilot | Active subscription | Powers all AI agents |
| Jira account | Cloud or Server | Fetches stories & defects |
| Confluence account | Cloud or Server | Fetches BRD & test plan pages (optional) |

---

## One-Time Setup

### Step 1 — Verify Node.js is available

```bash
node --version    # any v16+ is fine; v22.17.1 recommended
npm --version
```

If Node is already installed (common on corporate VDIs), skip straight to Step 2.

**If Node is NOT installed** — install directly from:
```
https://nodejs.org/en/download  (choose LTS)
```

> **nvm-windows is optional.** If your VDI IT policy restricts installations,
> installing Node.js directly is perfectly fine. nvm only helps if you need to
> switch between Node versions on the same machine.

### Step 2 — Clone / open the project

```bash
cd QEA-Banking-Agents
node --version    # confirm Node is active
```

### Step 3 — Install dependencies

```bash
npm install
```

Only one dependency: `dotenv` (loads environment variables from `scripts/.env`).

### Step 4 — Create your `.env` file

```bash
cp scripts/.env.example scripts/.env
```

Open `scripts/.env` and fill in your values:

```env
# ─── Jira ───────────────────────────────────────────────
JIRA_BASE_URL=https://yourcompany.atlassian.net
JIRA_EMAIL=your.email@company.com
JIRA_API_TOKEN=ATATxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
JIRA_PROJECT_KEY=BANK

# ─── Confluence ─────────────────────────────────────────
CONFLUENCE_BASE_URL=https://yourcompany.atlassian.net/wiki
CONFLUENCE_EMAIL=your.email@company.com
CONFLUENCE_API_TOKEN=ATATxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
CONFLUENCE_SPACE_KEY=QEA
```

**Where to find each value:**

| Variable | Where to find it |
|----------|-----------------|
| `JIRA_BASE_URL` | Your browser URL on any Jira page, up to `.atlassian.net` |
| `JIRA_EMAIL` | The email you use to log in to Atlassian |
| `JIRA_API_TOKEN` | https://id.atlassian.com/manage-profile/security/api-tokens → Create API token |
| `JIRA_PROJECT_KEY` | The prefix before `-` in your ticket numbers (e.g. `BANK` from `BANK-1234`) |
| `CONFLUENCE_BASE_URL` | Same as Jira base URL but with `/wiki` appended |
| `CONFLUENCE_EMAIL` | Same as Jira email (same Atlassian account) |
| `CONFLUENCE_API_TOKEN` | Same token as Jira (one token works for both) |
| `CONFLUENCE_SPACE_KEY` | Found in Confluence URL: `.../wiki/spaces/QEA/...` — the `QEA` part |

> **Security note:** `scripts/.env` is listed in `.gitignore` and will never be committed.
> Never share this file or paste its contents into chat.

### Step 5 — Test the connection

```bash
node scripts/context-fetcher.js BANK-1
```

Expected output:
```
Fetching Jira issue: BANK-1...
  ✅ Written → context/current-story.md
  ✅ Written → context/BANK-1.md

--- Context ready ---
  ✔ Jira BANK-1: Fund Transfer — NEFT/IMPS/RTGS
  📎 #context/current-story.md
```

Setup is complete once you see the green checkmarks.

---

## Custom Agents — VS Code Copilot Integration

All 7 agents live in `.github/agents/` as `.agent.md` files. VS Code Copilot
**auto-discovers** them when you open the workspace — no manual import or configuration needed.

### How to invoke an agent

1. Open **Copilot Chat** (`Ctrl+Alt+I`)
2. Type `@` — all 7 agents appear in the picker
3. Select an agent and describe your task

```
@TestCaseGenerator  generate all test cases for BANK-4521
@BRDMapper          run traceability analysis
@DefectAnalyzer     analyse defect patterns and give recommendations
@SQLDataGen         generate test data SQL for all scenarios
@RegressionSelector select regression tests for this sprint
@APITestAgent       generate the full Postman collection
@TraceabilityMatrix generate the full RTM
```

### Agent Reference

| Agent | Command | Context Needed | What It Produces |
|-------|---------|----------------|-----------------|
| TestCaseGenerator | `@TestCaseGenerator` | `current-story.md` (+ optional `current-brd.md`) | ISTQB test cases in Jira/Zephyr/Xray format |
| BRDMapper | `@BRDMapper` | `current-story.md` + `current-brd.md` | Traceability matrix + regulatory gap report |
| DefectAnalyzer | `@DefectAnalyzer` | `defect-history.md` (+ optional `current-story.md`) | Defect trends, root causes, TC recommendations |
| SQLDataGen | `@SQLDataGen` | `current-story.md` | PCI-DSS masked SQL INSERT + cleanup script |
| RegressionSelector | `@RegressionSelector` | `current-story.md` (+ optional `current-sprint.md`) | Prioritised regression suite with time estimate |
| APITestAgent | `@APITestAgent` | `current-story.md` (+ optional `current-brd.md`) | Postman collection + REST-Assured test scripts |
| TraceabilityMatrix | `@TraceabilityMatrix` | `current-brd.md` (+ optional `current-story.md`) | Full RTM: BRD → AC → TC → Execution Status with gap & regulatory report |

> **Backup copies** of all agent prompts are kept in `agents/*.prompt.md` for reference.
> The active agents used by Copilot are exclusively in `.github/agents/`.

---

## Daily Workflow

### Step 1 — Fetch context (30 seconds)

**Option A — VS Code Task (recommended)**

1. Press `Ctrl+Shift+B`
2. Select **"Fetch Context"**
3. Type your Jira key (e.g. `BANK-4521`) → Enter

**Option B — Terminal**

```bash
# Story only
node scripts/context-fetcher.js BANK-4521

# Story + Confluence page by ID
node scripts/context-fetcher.js "BANK-4521 confluence:112233445"

# Story + Confluence page by full URL (paste directly from browser)
node scripts/context-fetcher.js "BANK-4521 https://yourcompany.atlassian.net/wiki/spaces/QEA/pages/112233445/Page-Title"

# Confluence page only (no Jira story) — useful for RTM
node scripts/context-fetcher.js "https://yourcompany.atlassian.net/wiki/spaces/QEA/pages/112233445/BRD-Title"

# Refresh defect history
node scripts/context-fetcher.js --defects

# Load all open sprint stories
node scripts/context-fetcher.js --sprint
```

**Option C — npm shortcuts**

```bash
npm run fetch -- BANK-4521
npm run defects
npm run sprint
```

### Step 2 — Invoke an agent in Copilot Chat

```
@TestCaseGenerator generate all test cases
```

That's it. No file attachment needed — agents read `context/` automatically via the `codebase` tool.

---

## Context Fetcher — Input Formats

| Input | What it fetches |
|-------|----------------|
| `BANK-4521` | Jira story → `context/current-story.md` |
| `confluence:112233445` | Confluence page by ID → `context/current-brd.md` |
| `https://…/wiki/spaces/QEA/pages/112233445/Title` | Confluence page by full URL → `context/current-brd.md` |
| `BANK-4521 confluence:112233445` | Story + Confluence page by ID |
| `BANK-4521 https://…/pages/112233445/Title` | Story + Confluence page by full URL |
| `--defects` | Last 20 bugs → `context/defect-history.md` |
| `--sprint` | All open sprint stories → `context/current-sprint.md` |
| `BANK-4521` (no Confluence input) | Also auto-searches Confluence → `context/related-pages.md` |

**Providing a Confluence URL** — just paste the full URL from your browser:
```
https://yourcompany.atlassian.net/wiki/spaces/QEA/pages/112233445/Page-Title
                                                         ─────────
                                              Page ID extracted automatically
```

---

## VS Code Tasks Reference

Access via `Ctrl+Shift+B`:

| Task | What it runs | Purpose |
|------|-------------|---------|
| Fetch Context | prompts for input → runs fetcher | Fetch Jira story ± Confluence page |
| Refresh Defects | `--defects` flag | Pull latest 20 bugs from Jira |
| Load Current Sprint | `--sprint` flag | Pull all open sprint stories |

---

## Troubleshooting

### `401 Unauthorized`
- Your `JIRA_EMAIL` or `JIRA_API_TOKEN` is wrong
- Verify by opening `https://yourcompany.atlassian.net/rest/api/3/myself` in a browser while logged in — you should see your profile JSON

### `404 Not Found`
- `JIRA_BASE_URL` is incorrect, or the issue key doesn't exist
- Double-check: `https://yourcompany.atlassian.net` (no trailing slash, no `/wiki`)

### `ECONNREFUSED` or network timeout
- VDI firewall may be blocking outbound HTTPS to `*.atlassian.net`
- Ask your project lead to whitelist `*.atlassian.net` on port 443
- If on self-hosted Jira/Confluence (e.g. `jira.yourcompany.com`), ensure VPN is active

### Self-hosted Jira / Confluence (not Atlassian Cloud)
If your Jira URL is `jira.yourcompany.com` (not `.atlassian.net`):
1. Use your Windows/network username and password instead of an API token
2. Change the REST API path in `scripts/jira-client.js` from `/rest/api/3/` to `/rest/api/2/`
3. Auth method stays the same (`Basic base64(username:password)`)

### `Acceptance Criteria field is empty`
Jira stores custom fields under `customfield_XXXXX` IDs that differ per instance.
Open `https://yourcompany.atlassian.net/rest/api/3/issue/BANK-1` in your browser,
find the AC field in the JSON, note its `customfield_` ID, and add it to the
`acceptanceCriteria` line in `scripts/jira-client.js`.

### Agents not appearing in Copilot Chat (`@` picker)
- Ensure VS Code is version **1.99 or later**
- Ensure the **GitHub Copilot extension** is up to date
- Reload the window: `Ctrl+Shift+P` → "Developer: Reload Window"
- Confirm `.github/agents/*.agent.md` files exist in the workspace root

---

## Banking Domain Standards (applied by all agents)

| Standard | Rule |
|----------|------|
| Test design | ISTQB techniques: BVA, EP, Decision Table, State Transition |
| Financial amounts | Always include boundary values; 2 decimal places only |
| Regulatory coverage | Flag RBI / PCI-DSS / NPCI / Basel gaps as CRITICAL |
| Data masking | PAN → `XXXXX1234X` · Account → `XXXX5678` · Aadhaar → `XXXX-XXXX-1234` |
| Test case IDs | `TC_[MODULE]_[NNN]` format (e.g. `TC_NEFT_001`) |
| Severity | Critical > Major > Minor > Trivial |
| Priority | P1 Blocker > P2 > P3 > P4 |
| Output format | Markdown tables formatted for Jira/Confluence copy-paste |

---

## Security Checklist

- [ ] `scripts/.env` is listed in `.gitignore` ← already done
- [ ] Never paste API tokens into Copilot Chat or any AI tool
- [ ] `context/` folder is gitignored — contains live project data
- [ ] Rotate your Atlassian API token every 90 days
- [ ] Do not commit `package-lock.json` if it contains internal registry URLs

---

## Quick Reference Card

```bash
# ── Setup (once per machine) ─────────────────────────────
node --version                                          # confirm Node 16+ is available
npm install
cp scripts/.env.example scripts/.env                    # fill in Jira + Confluence values

# ── Every day ────────────────────────────────────────────
node scripts/context-fetcher.js BANK-XXXX               # story only
node scripts/context-fetcher.js "BANK-XXXX confluence:PAGEID"        # + BRD by ID
node scripts/context-fetcher.js "BANK-XXXX https://…/pages/PAGEID"  # + BRD by URL
node scripts/context-fetcher.js --defects               # refresh defect history
node scripts/context-fetcher.js --sprint                # load current sprint

# ── In Copilot Chat ──────────────────────────────────────
# Type @ and select an agent from the picker (7 agents available):
@TestCaseGenerator   →  generate ISTQB test cases in Jira format
@BRDMapper           →  map ACs to BRD requirements
@DefectAnalyzer      →  analyse defect trends and patterns
@SQLDataGen          →  generate PCI-DSS masked test data SQL
@RegressionSelector  →  select regression tests by impact analysis
@APITestAgent        →  generate Postman collection
@TraceabilityMatrix  →  generate full RTM (BRD → AC → TC → Status)
```
