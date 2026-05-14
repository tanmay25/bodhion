import asyncio
from typing import Optional
from contextlib import AsyncExitStack, nullcontext

import anyio

from mcp import ClientSession
from mcp.client.auth import OAuthClientProvider, TokenStorage
from mcp.client.streamable_http import streamablehttp_client
from mcp.shared.auth import OAuthClientInformationFull, OAuthClientMetadata, OAuthToken
import httpx
from bodhion.env import AIOHTTP_CLIENT_SESSION_TOOL_SERVER_SSL
from bodhion.utils.mcp.errors import MCPErrorType, MCPToolError

try:
    from opentelemetry import trace as _otel_trace
    _tracer = _otel_trace.get_tracer("bodhion.mcp")
except Exception:
    _tracer = None


def create_insecure_httpx_client(headers=None, timeout=None, auth=None):
    """Create an httpx AsyncClient with SSL verification disabled.

    Note: verify=False must be passed at construction time because httpx
    configures the SSL context during __init__. Setting client.verify = False
    after construction does not affect the underlying transport's SSL context.
    """
    kwargs = {
        "follow_redirects": True,
        "verify": False,
    }
    if timeout is not None:
        kwargs["timeout"] = timeout
    if headers is not None:
        kwargs["headers"] = headers
    if auth is not None:
        kwargs["auth"] = auth
    return httpx.AsyncClient(**kwargs)


class MCPClient:
    def __init__(self):
        self.session: Optional[ClientSession] = None
        self.exit_stack = None

    async def connect(self, url: str, headers: Optional[dict] = None):
        async with AsyncExitStack() as exit_stack:
            try:
                if AIOHTTP_CLIENT_SESSION_TOOL_SERVER_SSL:
                    self._streams_context = streamablehttp_client(url, headers=headers)
                else:
                    self._streams_context = streamablehttp_client(
                        url,
                        headers=headers,
                        httpx_client_factory=create_insecure_httpx_client,
                    )

                transport = await exit_stack.enter_async_context(self._streams_context)
                read_stream, write_stream, _ = transport

                self._session_context = ClientSession(
                    read_stream, write_stream
                )  # pylint: disable=W0201

                self.session = await exit_stack.enter_async_context(
                    self._session_context
                )
                with anyio.fail_after(10):
                    await self.session.initialize()
                self.exit_stack = exit_stack.pop_all()
            except Exception as e:
                await asyncio.shield(self.disconnect())
                raise e

    async def list_tool_specs(self) -> Optional[dict]:
        if not self.session:
            raise RuntimeError("MCP client is not connected.")

        result = await self.session.list_tools()
        tools = result.tools

        tool_specs = []
        for tool in tools:
            name = tool.name
            description = tool.description

            inputSchema = tool.inputSchema

            # TODO: handle outputSchema if needed
            outputSchema = getattr(tool, "outputSchema", None)

            tool_specs.append(
                {"name": name, "description": description, "parameters": inputSchema}
            )

        return tool_specs

    async def call_tool(
        self,
        function_name: str,
        function_args: dict,
        *,
        server_id: str = "",
        server_name: str = "",
        user_id: str = "",
    ) -> Optional[dict]:
        if not self.session:
            raise MCPToolError(MCPErrorType.NETWORK, "MCP client is not connected.")

        span_ctx = (
            _tracer.start_as_current_span(
                "mcp.tool_call",
                attributes={
                    "mcp.server_id": server_id,
                    "mcp.server_name": server_name,
                    "mcp.tool_name": function_name,
                    "mcp.user_id": user_id,
                },
            )
            if _tracer is not None
            else nullcontext()
        )

        with span_ctx as span:
            try:
                result = await self.session.call_tool(function_name, function_args)
            except anyio.EndOfStream:
                if span and hasattr(span, "set_attribute"):
                    span.set_attribute("mcp.status", "network_error")
                raise MCPToolError(MCPErrorType.NETWORK, "Connection to MCP server lost.")
            except Exception as e:
                msg = str(e)
                lower = msg.lower()
                if "not found" in lower or "unknown tool" in lower or "no such tool" in lower:
                    if span and hasattr(span, "set_attribute"):
                        span.set_attribute("mcp.status", "tool_not_found")
                    raise MCPToolError(
                        MCPErrorType.TOOL_NOT_FOUND,
                        f"Tool '{function_name}' not found on MCP server.",
                    )
                if "unauthorized" in lower or "forbidden" in lower or "401" in lower or "403" in lower:
                    if span and hasattr(span, "set_attribute"):
                        span.set_attribute("mcp.status", "auth_error")
                    raise MCPToolError(MCPErrorType.AUTH, f"Authentication failed: {msg}")
                if span and hasattr(span, "set_attribute"):
                    span.set_attribute("mcp.status", "error")
                raise MCPToolError(MCPErrorType.UNKNOWN, msg)

            if not result:
                raise MCPToolError(MCPErrorType.UNKNOWN, "No result returned from MCP tool call.")

            result_dict = result.model_dump(mode="json")
            result_content = result_dict.get("content", {})

            if result.isError:
                if span and hasattr(span, "set_attribute"):
                    span.set_attribute("mcp.status", "tool_error")
                raise MCPToolError(MCPErrorType.TOOL_ERROR, str(result_content))

            if span and hasattr(span, "set_attribute"):
                span.set_attribute("mcp.status", "ok")

            return result_content

    async def ping(self) -> bool:
        """Attempt tool discovery to verify server connectivity."""
        if not self.session:
            return False
        try:
            await self.session.list_tools()
            return True
        except Exception:
            return False

    async def list_resources(self, cursor: Optional[str] = None) -> Optional[dict]:
        if not self.session:
            raise RuntimeError("MCP client is not connected.")

        result = await self.session.list_resources(cursor=cursor)
        if not result:
            raise Exception("No result returned from MCP list_resources call.")

        result_dict = result.model_dump()
        resources = result_dict.get("resources", [])

        return resources

    async def read_resource(self, uri: str) -> Optional[dict]:
        if not self.session:
            raise RuntimeError("MCP client is not connected.")

        result = await self.session.read_resource(uri)
        if not result:
            raise Exception("No result returned from MCP read_resource call.")
        result_dict = result.model_dump()

        return result_dict

    async def disconnect(self):
        # Clean up and close the session
        await self.exit_stack.aclose()

    async def __aenter__(self):
        await self.exit_stack.__aenter__()
        return self

    async def __aexit__(self, exc_type, exc_value, traceback):
        await self.exit_stack.__aexit__(exc_type, exc_value, traceback)
        await self.disconnect()
