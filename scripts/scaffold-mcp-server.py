#!/usr/bin/env python3
"""
Bodhion MCP Server Scaffolder
==============================
Generates a minimal, validator-passing MCP server project skeleton.

Usage:
  python scripts/scaffold-mcp-server.py --name my-skill --lang python
  python scripts/scaffold-mcp-server.py --name my-skill --lang typescript

The generated project passes `validate-mcp-server.py` out of the box and
includes a pre-filled `bodhion-manifest.json` ready for marketplace submission.
"""

import argparse
import json
import os
import sys
import textwrap
from pathlib import Path


# ── Colour helpers ────────────────────────────────────────────────────────────

def _green(s: str) -> str:
    return f"\033[92m{s}\033[0m"

def _bold(s: str) -> str:
    return f"\033[1m{s}\033[0m"

def _dim(s: str) -> str:
    return f"\033[2m{s}\033[0m"


# ── Python template ───────────────────────────────────────────────────────────

def _python_files(name: str, slug: str) -> dict[str, str]:
    return {
        "server.py": textwrap.dedent(f"""\
            #!/usr/bin/env python3
            \"\"\"
            {name} — Bodhion MCP Server
            Run: uvx mcp install server.py --name {slug}
                 python server.py  (for local testing via stdio)
            \"\"\"

            from mcp.server.fastmcp import FastMCP

            mcp = FastMCP("{name}")


            @mcp.tool()
            def hello_world(message: str) -> str:
                \"\"\"Echo a greeting back. Replace this with your real tool logic.\"\"\"
                return f"Hello from {name}! You said: {{message}}"


            if __name__ == "__main__":
                mcp.run()
        """),

        "requirements.txt": textwrap.dedent("""\
            mcp[cli]>=1.0.0
        """),

        "Dockerfile": textwrap.dedent(f"""\
            FROM python:3.12-slim

            WORKDIR /app
            COPY requirements.txt .
            RUN pip install --no-cache-dir -r requirements.txt
            COPY . .

            # Expose as streamable-HTTP via supergateway
            RUN npm install -g supergateway 2>/dev/null || true
            EXPOSE 8000
            CMD ["sh", "-c", "npx supergateway --stdio 'python server.py' --port 8000 --host 0.0.0.0"]
        """),

        "bodhion-manifest.json": json.dumps({
            "id": slug,
            "name": name,
            "description": f"A Bodhion MCP server that provides {name} capabilities.",
            "category": "Custom",
            "author": "community",
            "auth_type": "none",
            "config_template": {
                "url": f"http://localhost:8000",
            },
            "docs_url": "",
            "tags": [slug],
        }, indent=2) + "\n",

        "README.md": textwrap.dedent(f"""\
            # {name} — Bodhion MCP Server

            ## Development

            ```bash
            pip install -r requirements.txt
            python server.py          # stdio mode (for testing)
            ```

            ## Validate against Bodhion

            ```bash
            # In one terminal: start with supergateway
            npx supergateway --stdio 'python server.py' --port 8000

            # In another terminal: run the validator
            python path/to/bodhion/scripts/validate-mcp-server.py --url http://localhost:8000
            ```

            ## Docker

            ```bash
            docker build -t {slug} .
            docker run -p 8000:8000 {slug}
            ```

            ## Marketplace submission

            See `bodhion-manifest.json` — fill in the fields, then open a PR to the Bodhion
            repository following `backend/bodhion/static/mcp-registry/CONTRIBUTING.md`.
        """),
    }


# ── TypeScript template ───────────────────────────────────────────────────────

def _typescript_files(name: str, slug: str) -> dict[str, str]:
    return {
        "src/index.ts": textwrap.dedent(f"""\
            import {{ McpServer }} from "@modelcontextprotocol/sdk/server/mcp.js";
            import {{ StdioServerTransport }} from "@modelcontextprotocol/sdk/server/stdio.js";
            import {{ z }} from "zod";

            const server = new McpServer({{
              name: "{name}",
              version: "0.1.0",
            }});

            server.tool(
              "hello_world",
              "Echo a greeting back. Replace this with your real tool logic.",
              {{ message: z.string().describe("The message to echo") }},
              async ({{ message }}) => {{
                return {{
                  content: [{{ type: "text", text: `Hello from {name}! You said: ${{message}}` }}],
                }};
              }}
            );

            async function main() {{
              const transport = new StdioServerTransport();
              await server.connect(transport);
            }}

            main().catch(console.error);
        """),

        "package.json": json.dumps({
            "name": slug,
            "version": "0.1.0",
            "description": f"Bodhion MCP server — {name}",
            "type": "module",
            "scripts": {
                "build": "tsc",
                "start": "node dist/index.js",
                "dev": "tsx src/index.ts",
            },
            "dependencies": {
                "@modelcontextprotocol/sdk": "^1.0.0",
                "zod": "^3.22.0",
            },
            "devDependencies": {
                "typescript": "^5.3.0",
                "tsx": "^4.7.0",
                "@types/node": "^20.0.0",
            },
        }, indent=2) + "\n",

        "tsconfig.json": json.dumps({
            "compilerOptions": {
                "target": "ES2022",
                "module": "Node16",
                "moduleResolution": "Node16",
                "outDir": "dist",
                "rootDir": "src",
                "strict": True,
                "esModuleInterop": True,
            },
            "include": ["src/**/*"],
        }, indent=2) + "\n",

        "Dockerfile": textwrap.dedent(f"""\
            FROM node:22-alpine

            WORKDIR /app
            COPY package*.json .
            RUN npm ci
            COPY . .
            RUN npm run build

            EXPOSE 8000
            RUN npm install -g supergateway
            CMD ["sh", "-c", "npx supergateway --stdio 'node dist/index.js' --port 8000 --host 0.0.0.0"]
        """),

        "bodhion-manifest.json": json.dumps({
            "id": slug,
            "name": name,
            "description": f"A Bodhion MCP server that provides {name} capabilities.",
            "category": "Custom",
            "author": "community",
            "auth_type": "none",
            "config_template": {
                "url": "http://localhost:8000",
            },
            "docs_url": "",
            "tags": [slug],
        }, indent=2) + "\n",

        "README.md": textwrap.dedent(f"""\
            # {name} — Bodhion MCP Server

            ## Development

            ```bash
            npm install
            npm run dev        # stdio mode (tsx, hot reload)
            ```

            ## Validate against Bodhion

            ```bash
            # In one terminal: start with supergateway
            npx supergateway --stdio 'npm start' --port 8000

            # In another terminal: run the validator
            python path/to/bodhion/scripts/validate-mcp-server.py --url http://localhost:8000
            ```

            ## Docker

            ```bash
            docker build -t {slug} .
            docker run -p 8000:8000 {slug}
            ```

            ## Marketplace submission

            See `bodhion-manifest.json` and `backend/bodhion/static/mcp-registry/CONTRIBUTING.md`.
        """),

        ".gitignore": "node_modules/\ndist/\n",
    }


# ── File writer ───────────────────────────────────────────────────────────────

def _write_files(base: Path, files: dict[str, str]) -> None:
    for rel_path, content in files.items():
        target = base / rel_path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")
        print(f"  {_green('created')}  {rel_path}")


# ── CLI entry point ───────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Scaffold a new Bodhion-compatible MCP server project",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument("--name", required=True,
                        help="Human-readable server name, e.g. 'My Skill'")
    parser.add_argument("--lang", required=True, choices=["python", "typescript"],
                        help="Language: python or typescript")
    parser.add_argument("--output", default=None,
                        help="Output directory (default: ./<slug> in current dir)")
    args = parser.parse_args()

    slug = args.name.lower().replace(" ", "-").replace("_", "-")
    slug = "".join(c if c.isalnum() or c == "-" else "" for c in slug)

    out_dir = Path(args.output) if args.output else Path.cwd() / slug
    if out_dir.exists() and list(out_dir.iterdir()):
        print(f"ERROR: Output directory already exists and is not empty: {out_dir}")
        sys.exit(1)

    files = (
        _python_files(args.name, slug)
        if args.lang == "python"
        else _typescript_files(args.name, slug)
    )

    print()
    print(_bold(f"Scaffolding '{args.name}' ({args.lang}) → {out_dir}"))
    print()
    _write_files(out_dir, files)

    print()
    print(_bold("Next steps:"))
    if args.lang == "python":
        print(_dim(f"  cd {out_dir}"))
        print(_dim( "  pip install -r requirements.txt"))
        print(_dim( "  python server.py"))
    else:
        print(_dim(f"  cd {out_dir}"))
        print(_dim( "  npm install && npm run dev"))

    print()
    print("Validate with Bodhion:")
    print(_dim( "  # (in another terminal, with server running via supergateway on :8000)"))
    print(_dim( "  python scripts/validate-mcp-server.py --url http://localhost:8000"))
    print()
    print(f"Submit to the marketplace: fill in {_bold('bodhion-manifest.json')} and open a PR.")
    print()


if __name__ == "__main__":
    main()
