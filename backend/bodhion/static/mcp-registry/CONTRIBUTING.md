# Contributing to the Bodhion MCP Registry

This file explains how to add a new MCP server to the Bodhion Marketplace so it appears for all Bodhion admins to discover and install.

---

## Prerequisites

- Your MCP server must be publicly reachable at a stable URL **or** self-hostable via Docker.
- It must pass the Bodhion compatibility validator (see below).
- You must have a GitHub account to open a pull request.

---

## Step 1 — Validate your server

Run the compatibility validator against your live server URL before submitting:

```bash
git clone https://github.com/your-org/bodhion
cd bodhion
python scripts/validate-mcp-server.py --url https://your-server.example.com
```

All 4 check groups must pass (exit code 0). If your server requires auth:

```bash
python scripts/validate-mcp-server.py \
    --url https://your-server.example.com \
    --header "Authorization: Bearer your-test-key"
```

---

## Step 2 — Create a `bodhion-manifest.json`

If you used the scaffolder (`scripts/scaffold-mcp-server.py`), this file was generated for you. Otherwise, create it manually following this schema:

```json
{
  "id":           "your-server-id",
  "name":         "Human-Readable Name",
  "description":  "One sentence: what this server does for users.",
  "category":     "Email | Calendar | Dev Tools | Productivity | Database | File System | Search | Custom",
  "author":       "community",
  "auth_type":    "none | bearer | oauth_2.1",
  "config_template": {
    "url":  "https://your-server.example.com"
  },
  "docs_url":     "https://link-to-your-docs",
  "icon":         "📦",
  "tags":         ["tag1", "tag2"]
}
```

### Field rules

| Field | Rule |
|---|---|
| `id` | Unique across the registry. Use `kebab-case`. Must not collide with an existing entry. |
| `name` | Max 40 characters. Title-case. |
| `description` | Max 120 characters. No marketing fluff — describe the capability. |
| `category` | Must be one of the values listed above. |
| `author` | Use `"community"` for all external submissions. |
| `auth_type` | Must be `"none"`, `"bearer"`, or `"oauth_2.1"`. |
| `config_template.url` | The base URL Bodhion will use to connect. Must be HTTPS in production. |
| `tags` | All lowercase, alphanumeric + hyphens only. |

---

## Step 3 — Add your entry to `registry.json`

Open `backend/bodhion/static/mcp-registry/registry.json` and append your entry to the `"servers"` array. Then bump the `"version"` timestamp:

```json
{
  "version": "2026-05-14.3",
  "servers": [
    ...existing entries...,
    {
      "id":          "your-server-id",
      "name":        "Human-Readable Name",
      ...
    }
  ]
}
```

Keep entries sorted alphabetically by `id` within each category group.

---

## Step 4 — Open a pull request

1. Fork the Bodhion repository.
2. Create a branch: `git checkout -b mcp-registry/add-your-server-id`
3. Commit: `git commit -m "registry: add your-server-id"`
4. Push and open a PR against `main`.
5. In the PR description, include:
   - What the server does
   - The live URL the CI validator will test against (or instructions to run it locally)
   - Any auth configuration needed for the CI check

---

## CI validation

The repository CI workflow (`.github/workflows/validate-mcp-registry.yml`) automatically runs `validate-mcp-server.py` against every registry entry in each PR diff. Your PR will be blocked until the validator exits 0.

If your server requires auth that cannot be shared publicly, contact the maintainers to arrange a private validation run.

---

## Badge levels

| Badge | Meaning |
|---|---|
| `community` | Self-reported; CI validator passed. No guarantee of long-term availability. |
| `verified` | Tested by the Bodhion maintainer team against a production-grade deployment. SLA not guaranteed but the server is known to work. |

All new contributions start as `community`. Maintainers may upgrade to `verified` after extended testing.

---

## What happens after merge?

- Your server appears in the Bodhion Marketplace under its category immediately after the next Bodhion release that includes the updated `registry.json`.
- Bodhion admins can install it with one click.
- If your server URL changes, open a PR updating the `config_template.url` field.
- If your server is discontinued, please open a PR removing the entry rather than letting it stay and fail health checks.
