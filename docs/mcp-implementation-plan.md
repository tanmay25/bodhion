# Bodhion — MCP as Primary Skill Extension: Phase-wise Implementation Plan

> **Author:** Tanmay Mondal  
> **Created:** 2026-05-13  
> **Status:** Planning  
> **Scope:** Make MCP (Model Context Protocol) the primary skill/extension delivery mechanism for the Bodhion platform, replacing ad-hoc CLI-based integrations and raw terminal access as the standard pattern.

---

## Background & Decision

After evaluating two extension paths for running external skills (e.g. `email-himalaya`) in Bodhion:

| Path | Mechanism | Verdict |
|---|---|---|
| **Path 1** | Open Terminal — raw shell access to a separate terminal server | Power-user escape hatch only |
| **Path 2** | MCP (Model Context Protocol) — structured tool servers over HTTP | **Primary standard** |

**MCP wins because:**
- Bodhion already ships MCP v1.26 support — zero new infrastructure required
- The MCP ecosystem has hundreds of production-ready servers (Gmail, GitHub, Slack, PostgreSQL, etc.)
- Structured JSON I/O beats raw CLI stdout parsing for reliability
- Isolated server processes align with Bodhion's existing security model (RBAC, sandboxing, audit logs)
- One integration pattern scales to any number of skills without touching Bodhion core

Open Terminal remains available as a developer escape hatch — not removed, just not the standard pattern.

---

## Current State (Codebase Audit)

Before planning, a full audit of the existing MCP implementation was performed. Key findings:

**Already exists:**
- `backend/bodhion/utils/mcp/client.py` — MCP protocol client (HTTP, tool discovery, tool calls, OAuth 2.1)
- `backend/bodhion/utils/oauth.py` — `OAuthClientManager` with encrypted token storage
- `TOOL_SERVER_CONNECTIONS` config in `backend/bodhion/config.py` — supports `type: "openapi" | "mcp"`
- Basic IntegrationsTab admin UI (`frontend/src/components/settings/tabs/IntegrationsTab.tsx`)
- Per-server access grants and function-name filtering
- Redis caching for tool server specs
- SSL verification control (`AIOHTTP_CLIENT_SESSION_TOOL_SERVER_SSL`)

**Missing / needs building:**
- Clean schema separation between MCP and OpenAPI servers
- Server health check endpoint and status indicator
- Per-user credential storage and OAuth UI flow
- Tool-level (not just server-level) access control
- MCP tool call audit logging
- Rate limiting per server per user
- Curated marketplace / discovery UI
- Bundled zero-config MCP servers in Docker Compose
- Usage analytics and health history
- Developer scaffolding tools and contribution workflow

---

## Dependency Order

```
Phase 1 — Core Infrastructure (foundation)
    └── Phase 2 — Admin UI (needs clean schema)
            ├── Phase 3 — Per-User Credentials (needs server management UI)
            └── Phase 4 — Access Control & Audit (needs tool list from Phase 2)
                    └── Phase 5 — Marketplace (needs working, secured servers)
                            └── Phase 6 — Bundled Servers (appear in marketplace)
                                    └── Phase 7 — Observability (meaningful once servers in use)
                                                └── Phase 8 — Developer SDK (documents stable infra)
```

> **Parallelism:** Phases 3 and 4 can run in parallel once Phase 2 is complete.  
> Phases 7 and 8 can run in parallel once Phase 6 is done.

---

## Phase Overview

| # | Phase | Key Output |
|---|---|---|
| 1 | Core MCP Infrastructure Hardening | Clean schema, health check endpoint, typed errors |
| 2 | Admin UI — MCP Server Management | Dedicated admin tab, tool preview panel, bulk actions |
| 3 | Per-User Credentials & OAuth UI | Per-user DB table, OAuth flow, Connected Services panel |
| 4 | Access Control & Audit Logging | Tool-level RBAC, full audit trail, rate limiting |
| 5 | MCP Marketplace & Discovery | Registry JSON, category browser, one-click add |
| 6 | Bundled MCP Servers (Docker) | Zero-config filesystem / DB / fetch servers |
| 7 | Observability & Analytics | Health sparklines, usage metrics, OTel spans, alerts |
| 8 | Developer SDK & Ecosystem | Validator script, scaffolder, in-app docs, CI check |

---

## Phase 1 — Core MCP Infrastructure Hardening

**Goal:** Make the existing MCP client robust and the server schema unambiguous before building anything on top of it.

**Why first:** Everything in later phases depends on reliable MCP connectivity and a clean data contract. Currently, OpenAPI and MCP servers share the same config structure — this causes ambiguity and silent failures.

---

### Task 1.1 — Split MCP and OpenAPI server schemas cleanly

**Files:**
- `backend/bodhion/config.py`
- `backend/bodhion/utils/tools.py`

**Work:**
- Add `"server_protocol": "mcp" | "openapi"` as a required discriminator field in `TOOL_SERVER_CONNECTIONS` entries — remove the ambiguous `"type"` field.
- Update `get_tool_servers()` and `get_tool_servers_data()` in `utils/tools.py` to branch on `server_protocol`.
- Add Pydantic models `MCPServerConfig` and `OpenAPIServerConfig` with strict field validation so misconfigured entries fail loudly at startup, not silently at runtime.

---

### Task 1.2 — Add server health-check endpoint

**Files:**
- `backend/bodhion/routers/tools.py`

**Work:**
- Add `GET /tool-servers/{id}/health` — pings the MCP server's tool discovery endpoint, returns:
  ```json
  { "status": "ok | unreachable | auth_error", "latency_ms": 142 }
  ```
- Cache health status in Redis with a 30-second TTL so repeated UI polls are cheap.

---

### Task 1.3 — Enforce tool discovery on server registration

**Files:**
- `backend/bodhion/routers/tools.py`
- `backend/bodhion/utils/tools.py`

**Work:**
- When a new MCP server is saved, immediately attempt tool discovery and store the resolved tool list in Redis.
- If discovery fails, mark the server `status: "error"` rather than silently accepting it.
- Surface the error message in the save response so the admin sees it immediately.

---

### Task 1.4 — Standardise error propagation from MCP tool calls

**Files:**
- `backend/bodhion/utils/mcp/client.py`
- `backend/bodhion/utils/tools.py`

**Work:**
- Ensure all MCP call failures (`network`, `auth`, `tool_not_found`, `schema_mismatch`) return a typed `MCPToolError` object instead of raw exceptions bubbling to the chat pipeline.
- Map `MCPToolError` to structured JSON returned to the model so it can reason about the failure rather than crashing the response stream.

---

**Phase 1 Deliverable:** MCP and OpenAPI servers are cleanly distinguished. Health is observable from day one. Tool call errors are handled gracefully and model-readable.

---

## Phase 2 — Admin UI: MCP Server Management

**Goal:** Give admins a purpose-built, information-rich UI for managing MCP servers — separate from OpenAPI servers and the generic Integrations tab.

**Why now:** The current `IntegrationsTab.tsx` treats MCP as a footnote inside a generic connections list. A dedicated MCP management surface is the prerequisite for the marketplace, per-user credentials, and categories.

---

### Task 2.1 — Create a dedicated MCP Servers admin section

**Files:**
- `frontend/src/app/(app)/admin/settings/` — add new "MCP Servers" tab
- `frontend/src/components/settings/tabs/MCPServersTab.tsx` — new component

**Work:**
- New **"MCP Servers"** tab alongside existing admin tabs (Connections, Models, Documents…).
- Table of all configured MCP servers with columns: **Name**, **URL**, **Category**, **Status** (green/amber/red badge from Phase 1 health API), **Tools count**, **Enabled toggle**.

---

### Task 2.2 — Add/Edit MCP server form with rich fields

**Files:**
- `frontend/src/components/settings/tabs/MCPServersTab.tsx`

**Work:**
- Form fields: `Name`, `URL`, `Category` (dropdown: Email / Calendar / Dev Tools / Productivity / Database / File System / Search / Custom), `Description`, `Auth Type` (none / API key / OAuth 2.1), `API key` (masked), `Function filter` (comma-separated allowlist), `Access` (Public / Groups / Admin-only).
- On save: immediately trigger health check (Task 1.2) and show result inline.

---

### Task 2.3 — Tool preview panel per server

**Files:**
- `frontend/src/components/settings/tabs/MCPServersTab.tsx`

**Work:**
- Clicking a server row expands an inline panel listing all discovered tools with: tool name, description, input schema summary, and an individual enable/disable toggle.
- Uses the Redis-cached tool list from Phase 1 Task 1.3 — no extra network call.

---

### Task 2.4 — Bulk actions

**Files:**
- `frontend/src/components/settings/tabs/MCPServersTab.tsx`
- `backend/bodhion/routers/tools.py`

**Work:**
- "Enable all / Disable all" toggle for the server list.
- "Refresh tools" button per server (re-runs discovery, updates Redis cache and health status).
- "Test connection" button that calls the Phase 1 health endpoint and shows latency inline.

---

**Phase 2 Deliverable:** Admins have a clear, purpose-built interface to manage MCP servers with live status, tool previews, and bulk controls.

---

## Phase 3 — Per-User Credentials & OAuth UI

**Goal:** Let each user authenticate to MCP servers with their own credentials — so Gmail MCP uses User A's Gmail account, not a shared service account.

**Why now:** The existing backend has `OAuthClientManager` and token storage logic, but there is no user-facing UI to complete OAuth flows or enter personal API keys. This is the missing link that makes identity-sensitive MCP servers (email, calendar, GitHub) actually usable per-user.

---

### Task 3.1 — Add `user_mcp_credentials` database table

**Files:**
- `backend/bodhion/models/` — new model file `user_mcp_credentials.py`
- `backend/bodhion/migrations/` — new Alembic migration

**Schema:**
```
id               String (PK)
user_id          String (FK → users)
server_id        String
auth_type        String
encrypted_api_key          Text (nullable)
oauth_access_token         Text (nullable, encrypted)
oauth_refresh_token        Text (nullable, encrypted)
token_expires_at           BigInteger (nullable)
created_at                 BigInteger
updated_at                 BigInteger
```

Uses the existing `OAUTH_CLIENT_INFO_ENCRYPTION_KEY` for field-level encryption — no new secret needed.

---

### Task 3.2 — Backend API for per-user credential management

**Files:**
- `backend/bodhion/routers/tools.py`

**New endpoints:**
- `GET  /tool-servers/{id}/credentials/me` — fetch current user's credential status (connected / expired / missing) without exposing the token value.
- `POST /tool-servers/{id}/credentials/me` — save personal API key.
- `DELETE /tool-servers/{id}/credentials/me` — revoke / disconnect.
- `GET  /tool-servers/{id}/oauth/authorize` — initiate OAuth 2.1 PKCE flow, return redirect URL.
- `GET  /tool-servers/{id}/oauth/callback` — handle code exchange, store tokens.

---

### Task 3.3 — User Settings: Connected Services panel

**Files:**
- `frontend/src/app/(app)/settings/` — new "Connected Services" section

**Work:**
- Each enabled MCP server appears as a card: server name + category icon, connection status badge (Connected / Disconnected / Token Expired), "Connect" / "Disconnect" / "Re-authenticate" button.
- OAuth servers trigger a popup window for the provider's consent screen.
- API key servers show a masked input field inline.
- On successful auth, the card turns green and shows the connected account identifier (e.g. the user's email for Gmail OAuth).

---

### Task 3.4 — Token refresh and re-auth prompts

**Files:**
- `backend/bodhion/utils/mcp/client.py`
- `frontend/src/components/ai/` — chat UI event handler

**Work:**
- Before each MCP tool call, check `token_expires_at`. If within 5 minutes of expiry, attempt silent refresh using the stored refresh token.
- If refresh fails, emit a Socket.IO event to the user's session: `{ "type": "mcp_auth_required", "server_id": "..." }`.
- Catch the event in the chat UI and display a non-blocking banner: *"Your Gmail connection needs re-authentication — [Reconnect]"* linking to Connected Services.

---

**Phase 3 Deliverable:** Each user can independently connect/disconnect personal credentials to any MCP server. Identity-sensitive skills (email, calendar, GitHub) work correctly per user without sharing credentials.

---

## Phase 4 — Access Control & Audit Logging

**Goal:** Apply Bodhion's existing RBAC model down to the individual tool level, and create a full audit trail for every MCP tool invocation.

**Why now:** Phase 2 gives admins visibility. Phase 3 gives users credentials. This phase locks down who can invoke what — and records it. Required for enterprise/regulated environments and for the marketplace to be trustworthy.

---

### Task 4.1 — Tool-level access control within a server

**Files:**
- `backend/bodhion/config.py` — extend `MCPServerConfig`
- `backend/bodhion/utils/tools.py` — enforce in `get_tools()`
- `frontend/src/components/settings/tabs/MCPServersTab.tsx` — group dropdown per tool

**Config extension:**
```json
{
  "tool_access_overrides": {
    "send_email":   { "groups": ["admins"] },
    "delete_email": { "groups": [] },
    "list_emails":  { "groups": ["all"] }
  }
}
```

Filter the tool list per-user by combining server-level access grants with tool-level overrides. A user only sees tools they are allowed to invoke. In the tool preview panel (Phase 2.3), add a group assignment dropdown per tool.

---

### Task 4.2 — MCP tool call audit log

**Files:**
- `backend/bodhion/utils/audit.py`

**New audit event `MCP_TOOL_CALL`:**
```json
{
  "event":        "MCP_TOOL_CALL",
  "user_id":      "...",
  "chat_id":      "...",
  "message_id":   "...",
  "server_id":    "...",
  "server_name":  "...",
  "tool_name":    "...",
  "input_summary":"...",
  "status":       "success | error",
  "error_type":   "...",
  "latency_ms":   142,
  "timestamp":    "..."
}
```

`input_summary` is a truncated, non-sensitive representation — never log full email bodies or credentials. Respects existing `ENABLE_AUDIT_STDOUT` flag and JSON log format.

---

### Task 4.3 — Rate limiting per MCP server per user

**Files:**
- `backend/bodhion/utils/rate_limit.py`
- `backend/bodhion/config.py` — extend `MCPServerConfig`

**Config extension:**
```json
{ "rate_limit": { "calls_per_minute": 20, "calls_per_day": 500 } }
```

- Add `RateLimitScope.MCP_SERVER` using Redis sliding window counters.
- When limit is breached, return a typed `MCPToolError(type="rate_limited", retry_after_seconds=...)` so the model can inform the user gracefully.
- Expose current rate limit status in `GET /tool-servers/{id}/health` response.

---

### Task 4.4 — Audit log viewer in Admin UI

**Files:**
- `frontend/src/app/(app)/admin/mcp-audit/` — new page

**Work:**
- Filterable by: server name, user, tool name, status (success / error), date range.
- Each row shows: timestamp, user, server → tool, status badge, latency, expandable input summary.
- Export to CSV for compliance reporting.

---

**Phase 4 Deliverable:** Admins control exactly which groups can call which tools on which servers. Every call is logged with timing, outcome, and user identity. Rate limiting prevents abuse.

---

## Phase 5 — MCP Marketplace & Discovery

**Goal:** Turn MCP server addition from a manual URL-entry task into a one-click experience backed by a curated, categorised registry.

**Why now:** Phases 1–4 make MCP rock-solid. Phase 5 is the product differentiator — the moment Bodhion goes from "platform that supports MCP" to "platform with a skill ecosystem."

---

### Task 5.1 — Define the MCP Registry manifest schema

**Files:**
- `static/mcp-registry/registry.json` — new file

**Schema per server entry:**
```json
{
  "id":              "gmail-mcp",
  "name":            "Gmail",
  "description":     "Read, send, and manage Gmail emails",
  "category":        "Email",
  "author":          "community | verified",
  "auth_type":       "oauth_2.1",
  "oauth_scopes":    ["gmail.readonly", "gmail.send"],
  "config_template": { "url": "https://...", "path": "/mcp/v1" },
  "docs_url":        "https://...",
  "icon_url":        "...",
  "tags":            ["email", "google", "productivity"]
}
```

- `verified` = tested against Bodhion's MCP client by the maintainer team.
- `community` = self-reported by contributor.
- Overridable via `MCP_REGISTRY_URL` env var to support private/enterprise registries.

**Initial curated entries to include:**

| ID | Name | Category | Auth |
|---|---|---|---|
| `gmail-mcp` | Gmail | Email | OAuth 2.1 |
| `github-mcp` | GitHub | Dev Tools | API Key / OAuth |
| `slack-mcp` | Slack | Productivity | OAuth 2.1 |
| `google-calendar-mcp` | Google Calendar | Calendar | OAuth 2.1 |
| `postgres-mcp` | PostgreSQL | Database | API Key |
| `notion-mcp` | Notion | Productivity | API Key |
| `linear-mcp` | Linear | Dev Tools | API Key |
| `brave-search-mcp` | Brave Search | Search | API Key |

---

### Task 5.2 — Marketplace backend endpoints

**Files:**
- `backend/bodhion/routers/tools.py`

**New endpoints (admin-only):**
- `GET /mcp-registry` — returns registry JSON merged with installed server list (marks which are already added).
- `GET /mcp-registry/categories` — returns distinct categories with server counts for the filter sidebar.
- Both cached in Redis for 1 hour.

---

### Task 5.3 — Marketplace UI

**Files:**
- `frontend/src/app/(app)/admin/mcp-marketplace/page.tsx` — new page

**Layout:**
- Category filter sidebar (left) + server cards grid (right).
- Each card: icon, name, category badge, short description, auth type chip, **"Add to Bodhion"** button (disabled / grey if already installed).
- Search bar filters by name, description, tags — client-side, no server round-trip.
- **"Add to Bodhion"** opens the Add Server form (Phase 2.2) pre-populated from the registry template. User only needs to supply credentials.

---

### Task 5.4 — Installed state and update notifications

**Files:**
- `frontend/src/app/(app)/admin/mcp-marketplace/page.tsx`
- `backend/bodhion/routers/tools.py`

**Work:**
- Installed servers show a green **"Installed"** badge and a **"Configure"** button instead of "Add".
- Version-stamp the registry JSON and compare on admin login.
- When a new Bodhion release updates the registry, show a banner: *"3 new MCP servers available since your last visit."*

---

**Phase 5 Deliverable:** Any admin can browse a curated skill marketplace by category, click one button to add a pre-configured MCP server, and supply only their credentials. Bodhion now has a living, extensible skill ecosystem.

---

## Phase 6 — Bundled MCP Servers (Docker Compose)

**Goal:** Ship Bodhion with a set of first-party, zero-configuration MCP servers that work out of the box — no external hosting or third-party accounts required for the most common self-hosted use cases.

**Why now:** The marketplace covers cloud services requiring credentials. Bundled servers cover self-contained use cases where teams want zero external dependencies.

---

### Task 6.1 — Select bundled server candidates

Three servers cover the highest-value, zero-credential use cases using **official Anthropic-maintained MCP server implementations** — no custom code to maintain long-term:

| Service | Tools exposed | Implementation |
|---|---|---|
| `bodhion-mcp-filesystem` | Read, write, list, search files in a configurable root | [Filesystem MCP](https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem) (Node.js) |
| `bodhion-mcp-sqlite` | Query, insert, update SQLite databases | [SQLite MCP](https://github.com/modelcontextprotocol/servers/tree/main/src/sqlite) (Python) |
| `bodhion-mcp-fetch` | Fetch any URL and return parsed Markdown content | [Fetch MCP](https://github.com/modelcontextprotocol/servers/tree/main/src/fetch) (Python) |

---

### Task 6.2 — Add bundled services to Docker Compose

**Files:**
- `docker/docker-compose.yml`
- `.env.default` — add `ENABLE_BUNDLED_MCP_SERVERS=false`

```yaml
mcp-filesystem:
  image: node:22-alpine
  command: npx @modelcontextprotocol/server-filesystem /data/workspace
  volumes: ["bodhion_workspace:/data/workspace"]
  profiles: ["mcp-bundled"]

mcp-sqlite:
  image: python:3.11-slim
  command: uvx mcp-server-sqlite --db-path /data/mcp.db
  volumes: ["bodhion_data:/data"]
  profiles: ["mcp-bundled"]

mcp-fetch:
  image: python:3.11-slim
  command: uvx mcp-server-fetch
  profiles: ["mcp-bundled"]
```

Activated with: `docker compose --profile mcp-bundled up`

---

### Task 6.3 — Auto-registration of bundled servers on startup

**Files:**
- `backend/bodhion/main.py`

**Work:**
- On startup, if `ENABLE_BUNDLED_MCP_SERVERS=true`, check if bundled servers are already in `TOOL_SERVER_CONNECTIONS`.
- If not, auto-append them with `auth_type: "none"` and `access: "admin-only"` (admin must explicitly open them up to users).
- Zero manual configuration — start with the profile flag, bundled servers appear in the admin panel automatically.

---

### Task 6.4 — Bundled server entries in the Marketplace registry

**Files:**
- `static/mcp-registry/registry.json`
- `frontend/src/app/(app)/admin/mcp-marketplace/page.tsx`

**Work:**
- Add entries for all three bundled servers tagged `"bundled": true`.
- In the Marketplace UI, bundled servers show a distinct **"Built-in"** badge.
- If the server is detected as running (health check passes), the badge changes to **"Running"**.

---

**Phase 6 Deliverable:** Users who start Bodhion with `--profile mcp-bundled` immediately get filesystem browsing, database querying, and URL fetching as zero-config AI skills. No credentials. No external accounts.

---

## Phase 7 — Observability & Analytics

**Goal:** Give admins operational visibility into MCP server health, usage patterns, error rates, and cost signals — making MCP infrastructure manageable at scale.

**Why now:** By Phase 6, the platform has multiple MCP servers running across many users. Without observability, admins are flying blind. This phase makes MCP production-ready.

---

### Task 7.1 — MCP usage metrics in the Admin Analytics dashboard

**Files:**
- `backend/bodhion/routers/analytics.py`
- Admin analytics frontend

**New analytics dimensions** (sourced from the Phase 4.2 audit log):
- **MCP Server Usage** table: Server name | Total calls | Success rate | Avg latency | Unique users — sortable by all columns.
- **Top Tools** table: Tool name | Server | Call count | Error count.
- **Per-User MCP Usage**: which users call which servers, how often.
- Time filter: Last 24h / 7d / 30d — consistent with existing analytics UI.

---

### Task 7.2 — Server health history and uptime tracking

**Files:**
- `backend/bodhion/tasks.py` — new APScheduler job
- `backend/bodhion/routers/tools.py` — new history endpoint
- `frontend/src/components/settings/tabs/MCPServersTab.tsx` — sparkline column

**Work:**
- APScheduler job every 60 seconds: call `GET /tool-servers/{id}/health` for every enabled server, write result (`status`, `latency_ms`, `timestamp`) to a `mcp_health_log` table (retain last 7 days).
- `GET /tool-servers/{id}/health-history` returns the last 24h of records for sparkline rendering.
- Each server row in the admin table shows a 24-dot sparkline coloured green/red + uptime % for the last 7 days.

---

### Task 7.3 — Error alerting via admin notifications

**Files:**
- `backend/bodhion/socket/main.py` — new Socket.IO events
- `frontend/src/components/` — dismissible admin banner

**Work:**
- When a server's health check fails 3 consecutive times, emit to all admin sessions:
  `{ "type": "mcp_server_down", "server_name": "...", "since": "..." }`
- Render as a dismissible admin-only banner: *"MCP Server 'Gmail' has been unreachable for 3 minutes — [View Details]"*
- When the server recovers, send `mcp_server_recovered` and auto-dismiss the banner.

---

### Task 7.4 — OpenTelemetry spans for MCP tool calls

**Files:**
- `backend/bodhion/utils/mcp/client.py`

**Work:**
- Wrap each MCP tool call in an OpenTelemetry span:
  ```
  span name:   "mcp.tool_call"
  attributes:  server_id, server_name, tool_name, user_id, status, latency_ms
  ```
- Plugs into Bodhion's existing OpenTelemetry setup — all MCP call traces appear automatically in whatever observability stack the operator has configured (Jaeger, Grafana Tempo, Datadog, etc.). Zero additional operator work.

---

**Phase 7 Deliverable:** Admins see real-time health sparklines, usage tables, and auto-alerts for downed servers. All MCP calls appear as traceable spans in the operator's existing observability stack.

---

## Phase 8 — Developer SDK & Ecosystem

**Goal:** Make it easy for developers (internal teams or community contributors) to build, test, and publish MCP servers that work reliably with Bodhion.

**Why last:** All infrastructure this phase documents must be stable first. This phase grows the supply side of the marketplace.

---

### Task 8.1 — Bodhion MCP compatibility validator

**Files:**
- `scripts/validate-mcp-server.py` — new script

**Usage:**
```bash
python scripts/validate-mcp-server.py --url http://localhost:8001
```

**Checks:**
- Tool discovery endpoint responds with valid JSON.
- All tools have valid JSON Schema input definitions.
- Tool calls return correctly shaped responses.
- Auth handshake works (if auth type is set).
- Error responses are correctly typed (`MCPToolError` format).

Exit code 0 = passes all checks. Non-zero = prints which checks failed and why.

Also integrated into the admin UI: a **"Validate"** button in the Add Server form (Phase 2.2) that runs the validator before saving.

---

### Task 8.2 — MCP server scaffolding script

**Files:**
- `scripts/scaffold-mcp-server.py` — new script

**Usage:**
```bash
python scripts/scaffold-mcp-server.py --name my-skill --lang python
python scripts/scaffold-mcp-server.py --name my-skill --lang typescript
```

**Generates:**
- Correct tool discovery endpoint.
- Tool call handler with typed error responses.
- `Dockerfile`.
- A sample tool (`hello_world`) that passes the validator out of the box.
- `bodhion-manifest.json` (the registry entry format from Phase 5.1) pre-filled with placeholders.

---

### Task 8.3 — In-app developer documentation

**Files:**
- `docs/mcp-server-guide.md` — source document
- `frontend/src/app/(app)/admin/mcp-marketplace/page.tsx` — "Build a Server" tab

**Guide content (rendered Markdown):**
1. What MCP is and how Bodhion uses it
2. Minimum required endpoints for Bodhion compatibility
3. Auth type options and when to use each
4. How to run the validator locally
5. How to submit to the registry (manifest format + PR process)

The doc lives in the repo and is rendered at runtime via the existing Markdown renderer — no separate docs site needed.

---

### Task 8.4 — Registry contribution workflow

**Files:**
- `static/mcp-registry/CONTRIBUTING.md` — new file
- `.github/workflows/validate-mcp-registry.yml` — new CI workflow

**Process:**
1. Developer forks the repo, adds their `bodhion-manifest.json` entry to `registry.json`.
2. Opens a PR — the CI workflow runs `validate-mcp-server.py` against the submitted server URL.
3. CI passes → PR is reviewed → merged with `community` badge.
4. Bodhion-team-run validation on a longer test suite → upgraded to `verified` badge.

---

**Phase 8 Deliverable:** Any developer can scaffold, validate, and submit a new MCP server to the Bodhion marketplace in under an hour. The community can grow the skill ecosystem without any changes to Bodhion core.

---

## Skill Type → Integration Pattern Reference

Use this table when evaluating any new skill or service request:

| Skill / Service type | Recommended path | Reason |
|---|---|---|
| External service (email, calendar, CRM) | MCP Server | Structured I/O, per-user auth, marketplace |
| Third-party API (GitHub, Slack, Linear) | MCP Server | Typed tools, RBAC, audit trail |
| Database operations | MCP Server (bundled SQLite or custom Postgres) | Safe, queryable, no shell exposure |
| Local file system access | Bundled `bodhion-mcp-filesystem` | Zero-config, path-scoped |
| Pure Python logic (transforms, calculations) | Bodhion Native Functions | No network hop, RestrictedPython sandboxed |
| Ad-hoc shell / file inspection (dev only) | Open Terminal | Escape hatch, not for production skills |
| CLI tool with no MCP wrapper yet | Wrap it → MCP Server using scaffold script | Standard pattern, then submit to registry |

---

## Environment Variables Reference

New environment variables introduced across all phases:

| Variable | Default | Phase | Description |
|---|---|---|---|
| `MCP_REGISTRY_URL` | _(bundled registry)_ | 5 | Override with private/enterprise registry URL |
| `ENABLE_BUNDLED_MCP_SERVERS` | `false` | 6 | Auto-register bundled Docker MCP servers on startup |
| `MCP_HEALTH_CHECK_INTERVAL_SECONDS` | `60` | 7 | How often the health check scheduler runs |
| `MCP_HEALTH_HISTORY_RETENTION_DAYS` | `7` | 7 | How long health log entries are kept |
| `MCP_SERVER_DOWN_ALERT_THRESHOLD` | `3` | 7 | Consecutive failures before admin alert is sent |

---

## File Change Summary

| File | Phases | Change type |
|---|---|---|
| `backend/bodhion/config.py` | 1, 4 | Modify — schema split, rate limit config |
| `backend/bodhion/utils/mcp/client.py` | 1, 3, 7 | Modify — typed errors, token refresh, OTel spans |
| `backend/bodhion/utils/tools.py` | 1, 4 | Modify — protocol branching, tool-level RBAC |
| `backend/bodhion/routers/tools.py` | 1, 2, 3, 5 | Modify — health endpoint, credential endpoints, registry endpoints |
| `backend/bodhion/utils/audit.py` | 4 | Modify — new `MCP_TOOL_CALL` event type |
| `backend/bodhion/utils/rate_limit.py` | 4 | Modify — `MCP_SERVER` rate limit scope |
| `backend/bodhion/routers/analytics.py` | 7 | Modify — MCP usage metrics |
| `backend/bodhion/tasks.py` | 7 | Modify — health check scheduler job |
| `backend/bodhion/main.py` | 6 | Modify — bundled server auto-registration |
| `backend/bodhion/models/user_mcp_credentials.py` | 3 | **New** — per-user credential model |
| `backend/bodhion/migrations/` | 3, 7 | **New** — Alembic migrations |
| `frontend/src/components/settings/tabs/MCPServersTab.tsx` | 2, 4, 7 | **New** — dedicated MCP admin component |
| `frontend/src/app/(app)/admin/mcp-marketplace/page.tsx` | 5, 8 | **New** — marketplace page |
| `frontend/src/app/(app)/admin/mcp-audit/page.tsx` | 4 | **New** — audit log viewer |
| `frontend/src/app/(app)/settings/` | 3 | Modify — Connected Services panel |
| `static/mcp-registry/registry.json` | 5, 6 | **New** — curated registry |
| `static/mcp-registry/CONTRIBUTING.md` | 8 | **New** — contribution guide |
| `docker/docker-compose.yml` | 6 | Modify — bundled MCP service definitions |
| `.env.default` | 6, 7 | Modify — new env vars |
| `scripts/validate-mcp-server.py` | 8 | **New** — compatibility validator |
| `scripts/scaffold-mcp-server.py` | 8 | **New** — project scaffolder |
| `docs/mcp-server-guide.md` | 8 | **New** — developer guide |

---

*This document was generated on 2026-05-13 based on a full codebase audit of Bodhion v0.8.8.*  
*Update this document as phases are completed and implementation decisions are revised.*
