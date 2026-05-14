import json as _json_std
import logging
from pathlib import Path
from typing import Optional
import time
import re
import aiohttp
from bodhion.env import AIOHTTP_CLIENT_TIMEOUT, MCP_REGISTRY_URL, STATIC_DIR
from bodhion.models.groups import Groups
from pydantic import BaseModel, HttpUrl
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from bodhion.internal.db import get_session
from bodhion.utils.mcp.client import MCPClient
from bodhion.utils.mcp.errors import MCPErrorType


from bodhion.models.oauth_sessions import OAuthSessions
from bodhion.models.tools import (
    ToolForm,
    ToolModel,
    ToolResponse,
    ToolUserResponse,
    ToolAccessResponse,
    Tools,
)
from bodhion.models.access_grants import AccessGrants
from bodhion.utils.plugin import (
    load_tool_module_by_id,
    replace_imports,
    get_tool_module_from_cache,
    resolve_valves_schema_options,
)
from bodhion.utils.tools import get_tool_specs
from bodhion.utils.auth import get_admin_user, get_verified_user
from bodhion.utils.access_control import has_access, has_permission, filter_allowed_access_grants
from bodhion.utils.tools import get_tool_servers, get_server_protocol

from bodhion.config import CACHE_DIR, BYPASS_ADMIN_ACCESS_CONTROL
from bodhion.constants import ERROR_MESSAGES

log = logging.getLogger(__name__)


router = APIRouter()


def get_tool_module(request, tool_id, load_from_db=True):
    """
    Get the tool module by its ID.
    """
    tool_module, _ = get_tool_module_from_cache(request, tool_id, load_from_db)
    return tool_module


############################
# GetTools
############################


@router.get("/", response_model=list[ToolUserResponse])
async def get_tools(
    request: Request,
    user=Depends(get_verified_user),
    db: Session = Depends(get_session),
):
    tools = []

    # Local Tools
    for tool in Tools.get_tools(defer_content=True, db=db):
        tool_module = (
            request.app.state.TOOLS.get(tool.id)
            if hasattr(request.app.state, "TOOLS")
            else None
        )
        tools.append(
            ToolUserResponse(
                **{
                    **tool.model_dump(),
                    "has_user_valves": (
                        hasattr(tool_module, "UserValves") if tool_module else False
                    ),
                }
            )
        )

    # OpenAPI Tool Servers
    server_access_grants = {}
    for server in await get_tool_servers(request):
        connection = request.app.state.config.TOOL_SERVER_CONNECTIONS[
            server.get("idx", 0)
        ]
        server_config = connection.get("config", {})

        server_id = f"server:{server.get('id')}"
        server_access_grants[server_id] = server_config.get("access_grants", [])

        tools.append(
            ToolUserResponse(
                **{
                    "id": server_id,
                    "user_id": server_id,
                    "name": server.get("openapi", {})
                    .get("info", {})
                    .get("title", "Tool Server"),
                    "meta": {
                        "description": server.get("openapi", {})
                        .get("info", {})
                        .get("description", ""),
                    },
                    "updated_at": int(time.time()),
                    "created_at": int(time.time()),
                }
            )
        )

    # MCP Tool Servers
    for server in request.app.state.config.TOOL_SERVER_CONNECTIONS:
        if get_server_protocol(server) == "mcp" and server.get("config", {}).get(
            "enable"
        ):
            server_id = server.get("info", {}).get("id")
            auth_type = server.get("auth_type", "none")

            session_token = None
            if auth_type == "oauth_2.1":
                splits = server_id.split(":")
                server_id = splits[-1] if len(splits) > 1 else server_id

                session_token = (
                    await request.app.state.oauth_client_manager.get_oauth_token(
                        user.id, f"mcp:{server_id}"
                    )
                )

            server_config = server.get("config", {})

            tool_id = f"server:mcp:{server.get('info', {}).get('id')}"
            server_access_grants[tool_id] = server_config.get("access_grants", [])

            tools.append(
                ToolUserResponse(
                    **{
                        "id": tool_id,
                        "user_id": tool_id,
                        "name": server.get("info", {}).get("name", "MCP Tool Server"),
                        "meta": {
                            "description": server.get("info", {}).get(
                                "description", ""
                            ),
                        },
                        "updated_at": int(time.time()),
                        "created_at": int(time.time()),
                        **(
                            {
                                "authenticated": session_token is not None,
                            }
                            if auth_type == "oauth_2.1"
                            else {}
                        ),
                    }
                )
            )

    if user.role == "admin" and BYPASS_ADMIN_ACCESS_CONTROL:
        # Admin can see all tools
        return tools
    else:
        user_group_ids = {
            group.id for group in Groups.get_groups_by_member_id(user.id, db=db)
        }
        tools = [
            tool
            for tool in tools
            if tool.user_id == user.id
            or (
                has_access(
                    user.id,
                    "read",
                    server_access_grants.get(str(tool.id), []),
                    user_group_ids,
                    db=db,
                )
                if str(tool.id).startswith("server:")
                else AccessGrants.has_access(
                    user_id=user.id,
                    resource_type="tool",
                    resource_id=tool.id,
                    permission="read",
                    user_group_ids=user_group_ids,
                    db=db,
                )
            )
        ]
        return tools


############################
# GetToolList
############################


@router.get("/list", response_model=list[ToolAccessResponse])
async def get_tool_list(
    user=Depends(get_verified_user), db: Session = Depends(get_session)
):
    if user.role == "admin" and BYPASS_ADMIN_ACCESS_CONTROL:
        tools = Tools.get_tools(defer_content=True, db=db)
    else:
        tools = Tools.get_tools_by_user_id(user.id, "read", defer_content=True, db=db)

    user_group_ids = {
        group.id for group in Groups.get_groups_by_member_id(user.id, db=db)
    }

    result = []
    for tool in tools:
        has_write = (
            (user.role == "admin" and BYPASS_ADMIN_ACCESS_CONTROL)
            or user.id == tool.user_id
            or any(
                g.permission == "write"
                and (
                    (
                        g.principal_type == "user"
                        and (g.principal_id == user.id or g.principal_id == "*")
                    )
                    or (
                        g.principal_type == "group" and g.principal_id in user_group_ids
                    )
                )
                for g in tool.access_grants
            )
        )
        result.append(
            ToolAccessResponse(
                **tool.model_dump(),
                write_access=has_write,
            )
        )
    return result


############################
# LoadFunctionFromLink
############################


class LoadUrlForm(BaseModel):
    url: HttpUrl


def github_url_to_raw_url(url: str) -> str:
    # Handle 'tree' (folder) URLs (add main.py at the end)
    m1 = re.match(r"https://github\.com/([^/]+)/([^/]+)/tree/([^/]+)/(.*)", url)
    if m1:
        org, repo, branch, path = m1.groups()
        return f"https://raw.githubusercontent.com/{org}/{repo}/refs/heads/{branch}/{path.rstrip('/')}/main.py"

    # Handle 'blob' (file) URLs
    m2 = re.match(r"https://github\.com/([^/]+)/([^/]+)/blob/([^/]+)/(.*)", url)
    if m2:
        org, repo, branch, path = m2.groups()
        return (
            f"https://raw.githubusercontent.com/{org}/{repo}/refs/heads/{branch}/{path}"
        )

    # No match; return as-is
    return url


@router.post("/load/url", response_model=Optional[dict])
async def load_tool_from_url(
    request: Request, form_data: LoadUrlForm, user=Depends(get_admin_user)
):
    # NOTE: This is NOT a SSRF vulnerability:
    # This endpoint is admin-only (see get_admin_user), meant for *trusted* internal use,
    # and does NOT accept untrusted user input. Access is enforced by authentication.

    url = str(form_data.url)
    if not url:
        raise HTTPException(status_code=400, detail="Please enter a valid URL")

    url = github_url_to_raw_url(url)
    url_parts = url.rstrip("/").split("/")

    file_name = url_parts[-1]
    tool_name = (
        file_name[:-3]
        if (
            file_name.endswith(".py")
            and (not file_name.startswith(("main.py", "index.py", "__init__.py")))
        )
        else url_parts[-2] if len(url_parts) > 1 else "function"
    )

    try:
        async with aiohttp.ClientSession(
            trust_env=True, timeout=aiohttp.ClientTimeout(total=AIOHTTP_CLIENT_TIMEOUT)
        ) as session:
            async with session.get(
                url, headers={"Content-Type": "application/json"}
            ) as resp:
                if resp.status != 200:
                    raise HTTPException(
                        status_code=resp.status, detail="Failed to fetch the tool"
                    )
                data = await resp.text()
                if not data:
                    raise HTTPException(
                        status_code=400, detail="No data received from the URL"
                    )
        return {
            "name": tool_name,
            "content": data,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error importing tool: {e}")


############################
# ExportTools
############################


@router.get("/export", response_model=list[ToolModel])
async def export_tools(
    request: Request,
    user=Depends(get_verified_user),
    db: Session = Depends(get_session),
):
    if user.role != "admin" and not has_permission(
        user.id,
        "workspace.tools_export",
        request.app.state.config.USER_PERMISSIONS,
        db=db,
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=ERROR_MESSAGES.UNAUTHORIZED,
        )

    if user.role == "admin" and BYPASS_ADMIN_ACCESS_CONTROL:
        return Tools.get_tools(db=db)
    else:
        return Tools.get_tools_by_user_id(user.id, "read", db=db)


############################
# CreateNewTools
############################


@router.post("/create", response_model=Optional[ToolResponse])
async def create_new_tools(
    request: Request,
    form_data: ToolForm,
    user=Depends(get_verified_user),
    db: Session = Depends(get_session),
):
    if user.role != "admin" and not (
        has_permission(
            user.id, "workspace.tools", request.app.state.config.USER_PERMISSIONS, db=db
        )
        or has_permission(
            user.id,
            "workspace.tools_import",
            request.app.state.config.USER_PERMISSIONS,
            db=db,
        )
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=ERROR_MESSAGES.UNAUTHORIZED,
        )

    if not form_data.id.isidentifier():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only alphanumeric characters and underscores are allowed in the id",
        )

    form_data.id = form_data.id.lower()

    tools = Tools.get_tool_by_id(form_data.id, db=db)
    if tools is None:
        try:
            form_data.content = replace_imports(form_data.content)
            tool_module, frontmatter = load_tool_module_by_id(
                form_data.id, content=form_data.content
            )
            form_data.meta.manifest = frontmatter

            TOOLS = request.app.state.TOOLS
            TOOLS[form_data.id] = tool_module

            specs = get_tool_specs(TOOLS[form_data.id])
            tools = Tools.insert_new_tool(user.id, form_data, specs, db=db)

            tool_cache_dir = CACHE_DIR / "tools" / form_data.id
            tool_cache_dir.mkdir(parents=True, exist_ok=True)

            if tools:
                return tools
            else:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=ERROR_MESSAGES.DEFAULT("Error creating tools"),
                )
        except Exception as e:
            log.exception(f"Failed to load the tool by id {form_data.id}: {e}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=ERROR_MESSAGES.DEFAULT(str(e)),
            )
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=ERROR_MESSAGES.ID_TAKEN,
        )


############################
# GetToolsById
############################


@router.get("/id/{id}", response_model=Optional[ToolAccessResponse])
async def get_tools_by_id(
    id: str, user=Depends(get_verified_user), db: Session = Depends(get_session)
):
    tools = Tools.get_tool_by_id(id, db=db)

    if tools:
        if (
            user.role == "admin"
            or tools.user_id == user.id
            or AccessGrants.has_access(
                user_id=user.id,
                resource_type="tool",
                resource_id=tools.id,
                permission="read",
                db=db,
            )
        ):
            return ToolAccessResponse(
                **tools.model_dump(),
                write_access=(
                    (user.role == "admin" and BYPASS_ADMIN_ACCESS_CONTROL)
                    or user.id == tools.user_id
                    or AccessGrants.has_access(
                        user_id=user.id,
                        resource_type="tool",
                        resource_id=tools.id,
                        permission="write",
                        db=db,
                    )
                ),
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=ERROR_MESSAGES.ACCESS_PROHIBITED,
            )
    else:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=ERROR_MESSAGES.NOT_FOUND,
        )


############################
# UpdateToolsById
############################


@router.post("/id/{id}/update", response_model=Optional[ToolModel])
async def update_tools_by_id(
    request: Request,
    id: str,
    form_data: ToolForm,
    user=Depends(get_verified_user),
    db: Session = Depends(get_session),
):
    tools = Tools.get_tool_by_id(id, db=db)
    if not tools:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=ERROR_MESSAGES.NOT_FOUND,
        )

    # Is the user the original creator, in a group with write access, or an admin
    if (
        tools.user_id != user.id
        and not AccessGrants.has_access(
            user_id=user.id,
            resource_type="tool",
            resource_id=tools.id,
            permission="write",
            db=db,
        )
        and user.role != "admin"
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=ERROR_MESSAGES.UNAUTHORIZED,
        )

    try:
        form_data.content = replace_imports(form_data.content)
        tool_module, frontmatter = load_tool_module_by_id(id, content=form_data.content)
        form_data.meta.manifest = frontmatter

        TOOLS = request.app.state.TOOLS
        TOOLS[id] = tool_module

        specs = get_tool_specs(TOOLS[id])

        updated = {
            **form_data.model_dump(exclude={"id"}),
            "specs": specs,
        }

        log.debug(updated)
        tools = Tools.update_tool_by_id(id, updated, db=db)

        if tools:
            return tools
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=ERROR_MESSAGES.DEFAULT("Error updating tools"),
            )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=ERROR_MESSAGES.DEFAULT(str(e)),
        )


############################
# UpdateToolAccessById
############################


class ToolAccessGrantsForm(BaseModel):
    access_grants: list[dict]


@router.post("/id/{id}/access/update", response_model=Optional[ToolModel])
async def update_tool_access_by_id(
    request: Request,
    id: str,
    form_data: ToolAccessGrantsForm,
    user=Depends(get_verified_user),
    db: Session = Depends(get_session),
):
    tools = Tools.get_tool_by_id(id, db=db)
    if not tools:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=ERROR_MESSAGES.NOT_FOUND,
        )

    if (
        tools.user_id != user.id
        and not AccessGrants.has_access(
            user_id=user.id,
            resource_type="tool",
            resource_id=tools.id,
            permission="write",
            db=db,
        )
        and user.role != "admin"
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=ERROR_MESSAGES.UNAUTHORIZED,
        )

    form_data.access_grants = filter_allowed_access_grants(
        request.app.state.config.USER_PERMISSIONS,
        user.id,
        user.role,
        form_data.access_grants,
        "sharing.public_tools",
    )

    AccessGrants.set_access_grants("tool", id, form_data.access_grants, db=db)

    return Tools.get_tool_by_id(id, db=db)


############################
# DeleteToolsById
############################


@router.delete("/id/{id}/delete", response_model=bool)
async def delete_tools_by_id(
    request: Request,
    id: str,
    user=Depends(get_verified_user),
    db: Session = Depends(get_session),
):
    tools = Tools.get_tool_by_id(id, db=db)
    if not tools:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=ERROR_MESSAGES.NOT_FOUND,
        )

    if (
        tools.user_id != user.id
        and not AccessGrants.has_access(
            user_id=user.id,
            resource_type="tool",
            resource_id=tools.id,
            permission="write",
            db=db,
        )
        and user.role != "admin"
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=ERROR_MESSAGES.UNAUTHORIZED,
        )

    result = Tools.delete_tool_by_id(id, db=db)
    if result:
        TOOLS = request.app.state.TOOLS
        if id in TOOLS:
            del TOOLS[id]

    return result


############################
# GetToolValves
############################


@router.get("/id/{id}/valves", response_model=Optional[dict])
async def get_tools_valves_by_id(
    id: str, user=Depends(get_verified_user), db: Session = Depends(get_session)
):
    tools = Tools.get_tool_by_id(id, db=db)
    if tools:
        try:
            valves = Tools.get_tool_valves_by_id(id, db=db)
            return valves
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=ERROR_MESSAGES.DEFAULT(str(e)),
            )
    else:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=ERROR_MESSAGES.NOT_FOUND,
        )


############################
# GetToolValvesSpec
############################


@router.get("/id/{id}/valves/spec", response_model=Optional[dict])
async def get_tools_valves_spec_by_id(
    request: Request,
    id: str,
    user=Depends(get_verified_user),
    db: Session = Depends(get_session),
):
    tools = Tools.get_tool_by_id(id, db=db)
    if tools:
        if id in request.app.state.TOOLS:
            tools_module = request.app.state.TOOLS[id]
        else:
            tools_module, _ = load_tool_module_by_id(id)
            request.app.state.TOOLS[id] = tools_module

        if hasattr(tools_module, "Valves"):
            Valves = tools_module.Valves
            schema = Valves.schema()
            # Resolve dynamic options for select dropdowns
            schema = resolve_valves_schema_options(Valves, schema, user)
            return schema
        return None
    else:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=ERROR_MESSAGES.NOT_FOUND,
        )


############################
# UpdateToolValves
############################


@router.post("/id/{id}/valves/update", response_model=Optional[dict])
async def update_tools_valves_by_id(
    request: Request,
    id: str,
    form_data: dict,
    user=Depends(get_verified_user),
    db: Session = Depends(get_session),
):
    tools = Tools.get_tool_by_id(id, db=db)
    if not tools:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=ERROR_MESSAGES.NOT_FOUND,
        )

    if (
        tools.user_id != user.id
        and not AccessGrants.has_access(
            user_id=user.id,
            resource_type="tool",
            resource_id=tools.id,
            permission="write",
            db=db,
        )
        and user.role != "admin"
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=ERROR_MESSAGES.ACCESS_PROHIBITED,
        )

    if id in request.app.state.TOOLS:
        tools_module = request.app.state.TOOLS[id]
    else:
        tools_module, _ = load_tool_module_by_id(id)
        request.app.state.TOOLS[id] = tools_module

    if not hasattr(tools_module, "Valves"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=ERROR_MESSAGES.NOT_FOUND,
        )
    Valves = tools_module.Valves

    try:
        form_data = {k: v for k, v in form_data.items() if v is not None}
        valves = Valves(**form_data)
        valves_dict = valves.model_dump(exclude_unset=True)
        Tools.update_tool_valves_by_id(id, valves_dict, db=db)
        return valves_dict
    except Exception as e:
        log.exception(f"Failed to update tool valves by id {id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=ERROR_MESSAGES.DEFAULT(str(e)),
        )


############################
# ToolUserValves
############################


@router.get("/id/{id}/valves/user", response_model=Optional[dict])
async def get_tools_user_valves_by_id(
    id: str, user=Depends(get_verified_user), db: Session = Depends(get_session)
):
    tools = Tools.get_tool_by_id(id, db=db)
    if tools:
        try:
            user_valves = Tools.get_user_valves_by_id_and_user_id(id, user.id, db=db)
            return user_valves
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=ERROR_MESSAGES.DEFAULT(str(e)),
            )
    else:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=ERROR_MESSAGES.NOT_FOUND,
        )


@router.get("/id/{id}/valves/user/spec", response_model=Optional[dict])
async def get_tools_user_valves_spec_by_id(
    request: Request,
    id: str,
    user=Depends(get_verified_user),
    db: Session = Depends(get_session),
):
    tools = Tools.get_tool_by_id(id, db=db)
    if tools:
        if id in request.app.state.TOOLS:
            tools_module = request.app.state.TOOLS[id]
        else:
            tools_module, _ = load_tool_module_by_id(id)
            request.app.state.TOOLS[id] = tools_module

        if hasattr(tools_module, "UserValves"):
            UserValves = tools_module.UserValves
            schema = UserValves.schema()
            # Resolve dynamic options for select dropdowns
            schema = resolve_valves_schema_options(UserValves, schema, user)
            return schema
        return None
    else:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=ERROR_MESSAGES.NOT_FOUND,
        )


@router.post("/id/{id}/valves/user/update", response_model=Optional[dict])
async def update_tools_user_valves_by_id(
    request: Request,
    id: str,
    form_data: dict,
    user=Depends(get_verified_user),
    db: Session = Depends(get_session),
):
    tools = Tools.get_tool_by_id(id, db=db)

    if tools:
        if id in request.app.state.TOOLS:
            tools_module = request.app.state.TOOLS[id]
        else:
            tools_module, _ = load_tool_module_by_id(id)
            request.app.state.TOOLS[id] = tools_module

        if hasattr(tools_module, "UserValves"):
            UserValves = tools_module.UserValves

            try:
                form_data = {k: v for k, v in form_data.items() if v is not None}
                user_valves = UserValves(**form_data)
                user_valves_dict = user_valves.model_dump(exclude_unset=True)
                Tools.update_user_valves_by_id_and_user_id(
                    id, user.id, user_valves_dict, db=db
                )
                return user_valves_dict
            except Exception as e:
                log.exception(f"Failed to update user valves by id {id}: {e}")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=ERROR_MESSAGES.DEFAULT(str(e)),
                )
        else:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=ERROR_MESSAGES.NOT_FOUND,
            )
    else:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=ERROR_MESSAGES.NOT_FOUND,
        )


############################
# MCP Server Credentials (per-user)
############################


class McpCredentialForm(BaseModel):
    api_key: Optional[str] = None


@router.get("/servers/{server_id}/credentials/me")
async def get_mcp_credential(
    server_id: str,
    user=Depends(get_verified_user),
):
    from bodhion.models.user_mcp_credentials import UserMcpCredentials

    status = UserMcpCredentials.get_credential_status(user.id, server_id)
    if status is None:
        return {"server_id": server_id, "connected": False}
    return status


@router.post("/servers/{server_id}/credentials/me")
async def save_mcp_credential(
    server_id: str,
    form_data: McpCredentialForm,
    request: Request,
    user=Depends(get_verified_user),
):
    from bodhion.models.user_mcp_credentials import UserMcpCredentials

    # Verify the server exists and the user has access
    connection = next(
        (
            conn
            for conn in request.app.state.config.TOOL_SERVER_CONNECTIONS
            if get_server_protocol(conn) == "mcp"
            and conn.get("info", {}).get("id") == server_id
        ),
        None,
    )
    if connection is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"MCP server '{server_id}' not found.",
        )

    auth_type = connection.get("auth_type", "none")
    if auth_type not in ("bearer", "none"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Use the OAuth flow to authenticate this server.",
        )

    credential = UserMcpCredentials.upsert_credential(
        user_id=user.id,
        server_id=server_id,
        auth_type=auth_type,
        api_key=form_data.api_key,
    )
    if credential is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save credential.",
        )
    return {"server_id": server_id, "connected": True, "auth_type": auth_type}


@router.delete("/servers/{server_id}/credentials/me")
async def delete_mcp_credential(
    server_id: str,
    user=Depends(get_verified_user),
):
    from bodhion.models.user_mcp_credentials import UserMcpCredentials

    deleted = UserMcpCredentials.delete_credential(user.id, server_id)
    return {"server_id": server_id, "deleted": deleted}


############################
# MCP Server Health Check
############################

HEALTH_CACHE_TTL = 30  # seconds


@router.get("/servers/{server_id}/health")
async def get_mcp_server_health(
    request: Request,
    server_id: str,
    user=Depends(get_admin_user),
):
    """
    Ping an MCP server's tool discovery endpoint and return health status.
    Result is cached in Redis for 30 seconds.
    """
    redis = getattr(request.app.state, "redis", None)
    cache_key = f"mcp_health:{server_id}"

    if redis is not None:
        try:
            cached = await redis.get(cache_key)
            if cached:
                import json
                return json.loads(cached)
        except Exception:
            pass

    # Find the server connection by id
    connection = next(
        (
            conn
            for conn in request.app.state.config.TOOL_SERVER_CONNECTIONS
            if get_server_protocol(conn) == "mcp"
            and conn.get("info", {}).get("id") == server_id
        ),
        None,
    )

    if connection is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"MCP server '{server_id}' not found.",
        )

    url = connection.get("url", "")
    auth_type = connection.get("auth_type", "none")

    headers = {}
    if auth_type == "bearer":
        headers["Authorization"] = f"Bearer {connection.get('key', '')}"

    start_ms = int(time.time() * 1000)
    health_status = "unreachable"
    tool_count = 0
    specs = []

    client = MCPClient()
    try:
        await client.connect(url, headers=headers or None)
        specs = await client.list_tool_specs() or []
        tool_count = len(specs)
        health_status = "ok"

        # Cache discovered tool specs (5 min TTL)
        if redis is not None and specs:
            import json as _json
            await redis.set(f"mcp_tools:{server_id}", _json.dumps(specs), ex=300)

    except Exception as e:
        msg = str(e).lower()
        if "401" in msg or "403" in msg or "unauthorized" in msg or "forbidden" in msg:
            health_status = "auth_error"
        else:
            health_status = "unreachable"
    finally:
        if client.exit_stack is not None:
            try:
                await client.disconnect()
            except Exception:
                pass

    latency_ms = int(time.time() * 1000) - start_ms
    result = {
        "server_id": server_id,
        "status": health_status,
        "latency_ms": latency_ms,
        "tool_count": tool_count,
        "checked_at": int(time.time()),
        "specs": specs,
    }

    if redis is not None:
        try:
            import json as _json
            # Cache health result without specs to keep payload small
            cache_payload = {k: v for k, v in result.items() if k != "specs"}
            await redis.set(cache_key, _json.dumps(cache_payload), ex=HEALTH_CACHE_TTL)
        except Exception:
            pass

    return result


############################
# MCP Health History & Alerts
############################


@router.get("/servers/{server_id}/health-history")
async def get_mcp_health_history(
    server_id: str,
    hours: int = 24,
    user=Depends(get_admin_user),
):
    """
    Return the last N hours of health check records for a server.
    Used by the admin UI to render sparklines and uptime %.
    """
    from bodhion.models.mcp_health_log import McpHealthLogs

    history = McpHealthLogs.get_history(server_id=server_id, hours=hours)
    uptime = McpHealthLogs.get_uptime_percent(server_id=server_id, days=7)
    return {
        "server_id": server_id,
        "hours": hours,
        "uptime_7d_pct": uptime,
        "records": [r.model_dump() for r in history],
    }


@router.get("/mcp-alerts")
async def get_mcp_alerts(
    request: Request,
    user=Depends(get_admin_user),
):
    """Return current MCP server down-alerts stored in Redis by the health scheduler."""
    redis = getattr(request.app.state, "redis", None)
    if redis is None:
        return {"alerts": []}
    try:
        raw = await redis.hgetall("mcp_alerts")
        alerts = [_json_std.loads(v) for v in (raw or {}).values()]
        return {"alerts": alerts}
    except Exception:
        return {"alerts": []}


############################
# MCP Audit Log
############################


@router.get("/audit")
async def get_mcp_audit_log(
    request: Request,
    user_id: Optional[str] = None,
    server_id: Optional[str] = None,
    tool_name: Optional[str] = None,
    status: Optional[str] = None,
    start_time: Optional[int] = None,
    end_time: Optional[int] = None,
    skip: int = 0,
    limit: int = 100,
    user=Depends(get_admin_user),
):
    from bodhion.models.mcp_audit_log import McpAuditLogs

    rows = McpAuditLogs.query(
        user_id=user_id,
        server_id=server_id,
        tool_name=tool_name,
        status=status,
        start_time=start_time,
        end_time=end_time,
        skip=skip,
        limit=min(limit, 500),
    )
    total = McpAuditLogs.count(
        user_id=user_id,
        server_id=server_id,
        tool_name=tool_name,
        status=status,
        start_time=start_time,
        end_time=end_time,
    )
    return {"rows": [r.model_dump() for r in rows], "total": total}


############################
# MCP Marketplace Registry
############################

REGISTRY_CACHE_TTL = 3600  # 1 hour


async def _load_registry() -> dict:
    """Load the MCP server registry from URL (if MCP_REGISTRY_URL is set) or the bundled JSON file."""
    if MCP_REGISTRY_URL:
        async with aiohttp.ClientSession(trust_env=True) as session:
            async with session.get(MCP_REGISTRY_URL, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                resp.raise_for_status()
                return await resp.json()
    registry_path = STATIC_DIR / "mcp-registry" / "registry.json"
    with open(registry_path, "r", encoding="utf-8") as f:
        return _json_std.load(f)


@router.get("/mcp-registry")
async def get_mcp_registry(
    request: Request,
    user=Depends(get_admin_user),
):
    """
    Return the curated MCP server registry merged with current installed state.
    Cached in Redis for 1 hour. Each entry gains an `installed` boolean and
    an `installed_server_id` if the server is already in TOOL_SERVER_CONNECTIONS.
    """
    redis = getattr(request.app.state, "redis", None)
    cache_key = "mcp_registry:full"

    if redis is not None:
        try:
            cached = await redis.get(cache_key)
            if cached:
                return _json_std.loads(cached)
        except Exception:
            pass

    try:
        registry = await _load_registry()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Failed to load MCP registry: {e}",
        )

    installed_ids: set[str] = {
        conn.get("info", {}).get("id", "")
        for conn in request.app.state.config.TOOL_SERVER_CONNECTIONS
        if get_server_protocol(conn) == "mcp"
    }

    servers = registry.get("servers", [])
    for entry in servers:
        entry["installed"] = entry.get("id", "") in installed_ids

    result = {
        "registry_version": registry.get("registry_version", ""),
        "servers": servers,
    }

    if redis is not None:
        try:
            await redis.set(cache_key, _json_std.dumps(result), ex=REGISTRY_CACHE_TTL)
        except Exception:
            pass

    return result


@router.post("/servers/validate")
async def validate_mcp_server(
    request: Request,
    body: dict,
    user=Depends(get_admin_user),
):
    """Quick connectivity + tool-discovery check for the Add Server form."""
    from bodhion.utils.mcp.client import MCPClient
    import time as _time

    url = (body.get("url") or "").strip()
    if not url:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="url is required")

    headers: dict = {}
    auth_type = body.get("auth_type", "none")
    key = (body.get("key") or "").strip()
    if auth_type == "bearer" and key:
        headers["Authorization"] = f"Bearer {key}"

    client = MCPClient()
    try:
        t0 = _time.monotonic()
        await client.connect(url, headers=headers or None)
        latency_ms = int((_time.monotonic() - t0) * 1000)
        specs = await client.list_tool_specs()
        return {
            "ok": True,
            "tool_count": len(specs) if specs else 0,
            "latency_ms": latency_ms,
        }
    except Exception as exc:
        msg = str(exc)
        return {"ok": False, "tool_count": 0, "latency_ms": 0, "error": msg}
    finally:
        try:
            await client.disconnect()
        except Exception:
            pass


@router.get("/mcp-registry/categories")
async def get_mcp_registry_categories(
    request: Request,
    user=Depends(get_admin_user),
):
    """Return distinct categories with server counts from the registry."""
    redis = getattr(request.app.state, "redis", None)
    cache_key = "mcp_registry:categories"

    if redis is not None:
        try:
            cached = await redis.get(cache_key)
            if cached:
                return _json_std.loads(cached)
        except Exception:
            pass

    try:
        registry = await _load_registry()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Failed to load MCP registry: {e}",
        )

    counts: dict[str, int] = {}
    for entry in registry.get("servers", []):
        cat = entry.get("category", "Custom")
        counts[cat] = counts.get(cat, 0) + 1

    result = [{"category": k, "count": v} for k, v in sorted(counts.items())]

    if redis is not None:
        try:
            await redis.set(cache_key, _json_std.dumps(result), ex=REGISTRY_CACHE_TTL)
        except Exception:
            pass

    return result
