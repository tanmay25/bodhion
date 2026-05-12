"""
Hermes Skill Hub utilities.

Fetch strategy based on source URL:
  - github.com/{owner}/{repo}         → GitHub tree API + per-file raw fetch
  - *.well-known/agent-skills/*       → agentskills well-known index JSON
  - *.well-known/skills/*             → legacy well-known index JSON
  - URL ending in /SKILL.md or .md    → single-file import, returns 1-item list

Token resolution order (highest priority first):
  1. user_token  — forwarded from X-GitHub-Token request header
  2. GITHUB_TOKEN env var — server-wide default set by the admin
  3. None — unauthenticated (60 req/hr GitHub API limit)
"""

import os
import re
import time
import logging
from typing import Optional
from urllib.parse import urlparse

import httpx
import yaml

log = logging.getLogger(__name__)

# ── constants ─────────────────────────────────────────────────────────────────

ALLOWED_IMPORT_DOMAINS = {
    "raw.githubusercontent.com",
    "github.com",
    "gist.githubusercontent.com",
    "cdn.jsdelivr.net",
}

_GITHUB_REPO_RE = re.compile(
    r"https?://github\.com/([^/]+)/([^/]+?)(?:\.git)?/?$"
)
_GITHUB_BLOB_RE = re.compile(
    r"https?://github\.com/([^/]+)/([^/]+)/blob/(.+)"
)
_WELL_KNOWN_RE = re.compile(r"/.well-known/(agent-skills|skills)/")

# ── in-process cache ──────────────────────────────────────────────────────────
# Keyed by (source_url, is_authenticated) so authenticated and unauthenticated
# responses are cached separately (private repos may differ).
_cache: dict[tuple[str, bool], dict] = {}


def _cache_get(source: str, authenticated: bool) -> Optional[list[dict]]:
    entry = _cache.get((source, authenticated))
    if entry and time.monotonic() < entry["expires_at"]:
        return entry["data"]
    return None


def _cache_set(source: str, authenticated: bool, data: list[dict]) -> None:
    _cache[(source, authenticated)] = {
        "data": data,
        "expires_at": time.monotonic() + 3600,
    }


# ── token helpers ─────────────────────────────────────────────────────────────

def _resolve_token(user_token: Optional[str]) -> Optional[str]:
    """Return the best available GitHub token."""
    return user_token or os.environ.get("GITHUB_TOKEN") or None


def _auth_headers(token: Optional[str]) -> dict:
    headers: dict = {"Accept": "application/vnd.github+json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return headers


# ── URL helpers ───────────────────────────────────────────────────────────────

def _normalize_to_raw(url: str) -> str:
    """Convert github.com/…/blob/… to raw.githubusercontent.com equivalent."""
    m = _GITHUB_BLOB_RE.match(url)
    if m:
        owner, repo, path = m.groups()
        return f"https://raw.githubusercontent.com/{owner}/{repo}/{path}"
    return url


def _validate_import_url(url: str) -> None:
    parsed = urlparse(url)
    if parsed.scheme != "https":
        raise ValueError("Only HTTPS URLs are allowed")
    if parsed.netloc not in ALLOWED_IMPORT_DOMAINS:
        raise ValueError(
            f"Domain '{parsed.netloc}' is not in the import allowlist. "
            f"Allowed: {sorted(ALLOWED_IMPORT_DOMAINS)}"
        )


def _detect_source_type(source_url: str) -> str:
    """
    Classify a hub source URL.
    Returns: 'github_repo' | 'well_known' | 'single_file'
    """
    if _GITHUB_REPO_RE.match(source_url):
        return "github_repo"
    if _WELL_KNOWN_RE.search(source_url):
        return "well_known"
    lower = source_url.lower()
    if lower.endswith("/skill.md") or lower.endswith(".md"):
        return "single_file"
    # Fallback: treat bare domain/path as well-known attempt
    return "well_known"


# ── SKILL.md parser ───────────────────────────────────────────────────────────

def parse_skill_md(md_text: str) -> dict:
    """
    Parse a SKILL.md string into structured fields.
    Returns: name, description, version, author, license, homepage,
             tags, prerequisites, content (full raw text including frontmatter).
    """
    frontmatter: dict = {}
    if md_text.startswith("---"):
        parts = md_text.split("---", 2)
        if len(parts) >= 3:
            try:
                frontmatter = yaml.safe_load(parts[1]) or {}
            except yaml.YAMLError:
                frontmatter = {}

    return {
        "name": str(frontmatter.get("name") or ""),
        "description": str(frontmatter.get("description") or ""),
        "version": frontmatter.get("version"),
        "author": frontmatter.get("author"),
        "license": frontmatter.get("license"),
        "homepage": frontmatter.get("homepage"),
        "tags": frontmatter.get("tags") or [],
        "prerequisites": frontmatter.get("prerequisites"),
        "content": md_text,
    }


# ── single-file import ────────────────────────────────────────────────────────

async def fetch_skill_md(url: str, github_token: Optional[str] = None) -> dict:
    """
    Fetch a single SKILL.md from an allowed URL.
    Returns parsed fields + source_url.
    Raises ValueError for disallowed URLs.
    """
    raw_url = _normalize_to_raw(url)
    _validate_import_url(raw_url)

    token = _resolve_token(github_token)
    headers = _auth_headers(token) if "github" in raw_url else {}

    async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
        r = await client.get(raw_url, headers=headers)
        r.raise_for_status()

    return {**parse_skill_md(r.text), "source_url": raw_url}


# ── hub index fetchers ────────────────────────────────────────────────────────

async def _fetch_from_github_repo(
    source_url: str, token: Optional[str]
) -> list[dict]:
    """Fetch all SKILL.md files from a GitHub repository."""
    m = _GITHUB_REPO_RE.match(source_url)
    if not m:
        raise ValueError(f"Not a valid GitHub repo URL: {source_url}")
    owner, repo = m.group(1), m.group(2)

    tree_url = (
        f"https://api.github.com/repos/{owner}/{repo}"
        "/git/trees/main?recursive=1"
    )
    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.get(tree_url, headers=_auth_headers(token))
        if r.status_code == 404:
            # Try 'master' branch as fallback
            r = await client.get(
                tree_url.replace("/main?", "/master?"),
                headers=_auth_headers(token),
            )
        r.raise_for_status()

    tree = r.json().get("tree", [])
    skill_paths = [
        item["path"]
        for item in tree
        if item.get("type") == "blob"
        and item["path"].endswith("/SKILL.md")
        and item["path"].startswith("skills/")
    ]

    skills: list[dict] = []
    async with httpx.AsyncClient(timeout=10, follow_redirects=True) as client:
        for path in skill_paths:
            raw_url = (
                f"https://raw.githubusercontent.com/{owner}/{repo}/main/{path}"
            )
            try:
                r = await client.get(raw_url, headers=_auth_headers(token))
                if r.status_code != 200:
                    continue
                parsed = parse_skill_md(r.text)
                parts = path.split("/")
                category = parts[1] if len(parts) >= 4 else "general"
                skills.append(
                    {**parsed, "category": category, "raw_url": raw_url}
                )
            except Exception as exc:
                log.warning("Skipping %s: %s", path, exc)

    return skills


async def _fetch_from_well_known(
    source_url: str, token: Optional[str]
) -> list[dict]:
    """
    Fetch a /.well-known/agent-skills/index.json (or legacy /skills/index.json).
    Supports both v0.2.0 and v0.1.0 index formats.
    """
    # Normalise: strip any trailing path and append well-known suffix
    parsed = urlparse(source_url)
    base = f"{parsed.scheme}://{parsed.netloc}"

    for path in (
        "/.well-known/agent-skills/index.json",
        "/.well-known/skills/index.json",
    ):
        index_url = base + path
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                r = await client.get(index_url, headers=_auth_headers(token))
                if r.status_code == 200:
                    break
        except Exception:
            continue
    else:
        raise ValueError(f"No well-known skills index found at {base}")

    index = r.json()
    entries = index.get("skills", [])
    skills: list[dict] = []

    async with httpx.AsyncClient(timeout=10, follow_redirects=True) as client:
        for entry in entries:
            if entry.get("type") not in ("skill-md", None):
                continue
            skill_url = entry.get("url", "")
            if not skill_url.startswith("http"):
                skill_url = base + skill_url
            try:
                r = await client.get(skill_url)
                if r.status_code != 200:
                    continue
                parsed_skill = parse_skill_md(r.text)
                skills.append(
                    {
                        **parsed_skill,
                        "category": entry.get("category", "general"),
                        "raw_url": skill_url,
                    }
                )
            except Exception as exc:
                log.warning("Skipping %s: %s", skill_url, exc)

    return skills


# ── public API ────────────────────────────────────────────────────────────────

async def get_hermes_hub_index(
    source_url: str = "https://github.com/NousResearch/hermes-agent",
    user_token: Optional[str] = None,
) -> list[dict]:
    """
    Return the skill index for the given hub source.
    Applies token resolution and uses a 1-hour in-process cache.
    """
    token = _resolve_token(user_token)
    cached = _cache_get(source_url, bool(token))
    if cached is not None:
        return cached

    source_type = _detect_source_type(source_url)

    if source_type == "github_repo":
        data = await _fetch_from_github_repo(source_url, token)
    elif source_type == "single_file":
        parsed = await fetch_skill_md(source_url, user_token)
        parts = urlparse(source_url).path.split("/")
        category = parts[-2] if len(parts) >= 2 else "general"
        data = [{**parsed, "category": category, "raw_url": source_url}]
    else:
        data = await _fetch_from_well_known(source_url, token)

    _cache_set(source_url, bool(token), data)
    return data
