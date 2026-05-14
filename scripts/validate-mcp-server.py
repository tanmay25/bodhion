#!/usr/bin/env python3
"""
Bodhion MCP Server Compatibility Validator
=========================================
Usage:
  python scripts/validate-mcp-server.py --url http://localhost:8001
  python scripts/validate-mcp-server.py --url https://my-server.example.com \
      --header "Authorization: Bearer sk-abc123"

Exit code 0 = all checks pass (server is Bodhion-compatible).
Exit code 1 = one or more checks failed.
Exit code 2 = missing dependencies.
"""

import argparse
import asyncio
import sys
import time
from typing import Any

try:
    from mcp import ClientSession
    from mcp.client.streamable_http import streamablehttp_client
except ImportError:
    print("ERROR: 'mcp' package not found. Install it with:  pip install mcp")
    sys.exit(2)

# ── Colour helpers ────────────────────────────────────────────────────────────

def _green(s: str) -> str:
    return f"\033[92m{s}\033[0m"

def _red(s: str) -> str:
    return f"\033[91m{s}\033[0m"

def _yellow(s: str) -> str:
    return f"\033[93m{s}\033[0m"

def _bold(s: str) -> str:
    return f"\033[1m{s}\033[0m"

# ── Result collector ──────────────────────────────────────────────────────────

class Results:
    def __init__(self) -> None:
        self._rows: list[dict[str, Any]] = []

    def ok(self, name: str, note: str = "") -> None:
        self._rows.append({"passed": True, "name": name, "note": note})
        line = f"  {_green('PASS')}  {name}"
        if note:
            line += f"  {_yellow(note)}"
        print(line)

    def fail(self, name: str, reason: str = "") -> None:
        self._rows.append({"passed": False, "name": name, "note": reason})
        line = f"  {_red('FAIL')}  {name}"
        if reason:
            line += f"  — {reason}"
        print(line)

    def warn(self, name: str, reason: str = "") -> None:
        line = f"  {_yellow('WARN')}  {name}"
        if reason:
            line += f"  — {reason}"
        print(line)

    @property
    def passed(self) -> int:
        return sum(1 for r in self._rows if r["passed"])

    @property
    def failed(self) -> int:
        return sum(1 for r in self._rows if not r["passed"])

    @property
    def total(self) -> int:
        return len(self._rows)


# ── Core validation ───────────────────────────────────────────────────────────

async def validate(url: str, headers: dict[str, str]) -> bool:
    r = Results()

    print()
    print(_bold("Bodhion MCP Server Compatibility Validator"))
    print(f"Target : {url}")
    print("─" * 56)

    # ── Section 1: Connection ─────────────────────────────────────────────────
    print(f"\n{_bold('[1/4] Connection & Handshake')}")

    try:
        t0 = time.monotonic()
        async with streamablehttp_client(url, headers=headers or None) as (read, write, _):
            latency_ms = int((time.monotonic() - t0) * 1000)
            r.ok("Streamable HTTP transport opened", f"{latency_ms} ms")

            async with ClientSession(read, write) as session:
                try:
                    await session.initialize()
                    r.ok("MCP initialize() handshake succeeded")
                except Exception as e:
                    r.fail("MCP initialize() handshake succeeded", str(e)[:120])
                    _print_summary(r)
                    return r.failed == 0

                # ── Section 2: Tool discovery ─────────────────────────────────
                print(f"\n{_bold('[2/4] Tool Discovery')}")

                tools = []
                try:
                    result = await session.list_tools()
                    tools = result.tools
                    r.ok("list_tools() returned without error", f"{len(tools)} tool(s) found")
                except Exception as e:
                    r.fail("list_tools() returned without error", str(e)[:120])
                    _print_summary(r)
                    return r.failed == 0

                if tools:
                    r.ok("Server exposes at least one tool")
                else:
                    r.fail("Server exposes at least one tool",
                           "No tools returned — Bodhion requires at least one tool")

                # ── Section 3: Schema validation ──────────────────────────────
                print(f"\n{_bold('[3/4] Tool Schema Validation')}")

                schema_ok = True
                no_desc: list[str] = []

                for tool in tools:
                    if not getattr(tool, "name", None):
                        r.fail("Every tool has a 'name' field", "found a tool without name")
                        schema_ok = False
                        continue

                    schema = getattr(tool, "inputSchema", None)
                    if schema is None:
                        r.fail(f"'{tool.name}' has inputSchema", "inputSchema missing")
                        schema_ok = False
                    elif not isinstance(schema, dict):
                        r.fail(f"'{tool.name}' inputSchema is a JSON object",
                               f"got {type(schema).__name__}")
                        schema_ok = False
                    elif schema.get("type") != "object":
                        r.fail(f"'{tool.name}' inputSchema.type == 'object'",
                               f"got type='{schema.get('type')}'")
                        schema_ok = False

                    if not getattr(tool, "description", None):
                        no_desc.append(tool.name)

                if schema_ok and tools:
                    r.ok("All tools have valid inputSchema (type=object)")

                if no_desc:
                    r.warn("All tools have descriptions",
                           f"missing on: {', '.join(no_desc[:5])}" +
                           (" …" if len(no_desc) > 5 else ""))
                elif tools:
                    r.ok("All tools have descriptions")

                # ── Section 4: Error-response contract ────────────────────────
                print(f"\n{_bold('[4/4] Error-Response Contract')}")

                if tools:
                    probe_tool = tools[0]
                    try:
                        call_result = await session.call_tool(probe_tool.name, {})
                        if getattr(call_result, "isError", False):
                            r.ok("Tool errors use isError=true flag",
                                 "(empty-arg call returned isError)")
                        else:
                            r.ok("Tool callable (accepted empty-arg probe)",
                                 f"tool='{probe_tool.name}'")
                    except Exception as exc:
                        msg = str(exc)[:100]
                        r.ok("Tool raises exception on bad input (acceptable)", msg)
                else:
                    r.warn("Error-response contract", "skipped — no tools to probe")

    except Exception as exc:
        r.fail("Streamable HTTP transport opened", str(exc)[:120])
        print("\n  (remaining checks skipped — could not connect)\n")

    _print_summary(r)
    return r.failed == 0


def _print_summary(r: Results) -> None:
    print()
    print("─" * 56)
    if r.failed == 0:
        print(_green(f"✓  All {r.total} checks passed — server is Bodhion-compatible"))
    else:
        print(_red(f"✗  {r.failed}/{r.total} check(s) failed — see details above"))
    print()


# ── CLI entry point ───────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Validate an MCP server for Bodhion compatibility",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument(
        "--url", required=True,
        help="MCP server base URL, e.g. http://localhost:8001",
    )
    parser.add_argument(
        "--header", action="append", dest="headers", metavar="NAME: VALUE",
        help="HTTP request header (repeat for multiple). E.g. --header 'Authorization: Bearer sk-...'",
    )
    args = parser.parse_args()

    headers: dict[str, str] = {}
    for h in (args.headers or []):
        if ": " in h:
            name, value = h.split(": ", 1)
            headers[name.strip()] = value.strip()

    ok = asyncio.run(validate(args.url, headers))
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
