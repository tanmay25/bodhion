import time
import logging
import uuid
from typing import Optional, List

from sqlalchemy.orm import Session
from sqlalchemy import BigInteger, Column, String, Text, Index

from bodhion.internal.db import Base, get_db_context
from pydantic import BaseModel, ConfigDict

log = logging.getLogger(__name__)


####################
# DB MODEL
####################


class McpAuditLog(Base):
    __tablename__ = "mcp_audit_log"

    id = Column(Text, primary_key=True, unique=True)
    user_id = Column(Text, nullable=True)
    server_id = Column(Text, nullable=True)
    server_name = Column(Text, nullable=True)
    tool_name = Column(Text, nullable=True)
    input_summary = Column(Text, nullable=True)
    status = Column(Text, nullable=False, default="success")
    error_type = Column(Text, nullable=True)
    latency_ms = Column(BigInteger, nullable=True)
    chat_id = Column(Text, nullable=True)
    timestamp = Column(BigInteger, nullable=False)

    __table_args__ = (
        Index("idx_mcp_audit_user_id", "user_id"),
        Index("idx_mcp_audit_server_id", "server_id"),
        Index("idx_mcp_audit_timestamp", "timestamp"),
        Index("idx_mcp_audit_status", "status"),
    )


####################
# Pydantic model
####################


class McpAuditLogModel(BaseModel):
    id: str
    user_id: Optional[str] = None
    server_id: Optional[str] = None
    server_name: Optional[str] = None
    tool_name: Optional[str] = None
    input_summary: Optional[str] = None
    status: str
    error_type: Optional[str] = None
    latency_ms: Optional[int] = None
    chat_id: Optional[str] = None
    timestamp: int

    model_config = ConfigDict(from_attributes=True)


####################
# Table class
####################


class McpAuditLogTable:
    def write(
        self,
        user_id: Optional[str],
        server_id: Optional[str],
        server_name: Optional[str],
        tool_name: Optional[str],
        status: str,
        latency_ms: Optional[int] = None,
        input_summary: Optional[str] = None,
        error_type: Optional[str] = None,
        chat_id: Optional[str] = None,
        db: Optional[Session] = None,
    ) -> None:
        try:
            with get_db_context(db) as db:
                row = McpAuditLog(
                    id=str(uuid.uuid4()),
                    user_id=user_id,
                    server_id=server_id,
                    server_name=server_name,
                    tool_name=tool_name,
                    input_summary=input_summary,
                    status=status,
                    error_type=error_type,
                    latency_ms=latency_ms,
                    chat_id=chat_id,
                    timestamp=int(time.time()),
                )
                db.add(row)
                db.commit()
        except Exception as e:
            log.error(f"Failed to write MCP audit log: {e}")

    def query(
        self,
        user_id: Optional[str] = None,
        server_id: Optional[str] = None,
        tool_name: Optional[str] = None,
        status: Optional[str] = None,
        start_time: Optional[int] = None,
        end_time: Optional[int] = None,
        skip: int = 0,
        limit: int = 100,
        db: Optional[Session] = None,
    ) -> List[McpAuditLogModel]:
        try:
            with get_db_context(db) as db:
                q = db.query(McpAuditLog)
                if user_id:
                    q = q.filter(McpAuditLog.user_id == user_id)
                if server_id:
                    q = q.filter(McpAuditLog.server_id == server_id)
                if tool_name:
                    q = q.filter(McpAuditLog.tool_name == tool_name)
                if status:
                    q = q.filter(McpAuditLog.status == status)
                if start_time is not None:
                    q = q.filter(McpAuditLog.timestamp >= start_time)
                if end_time is not None:
                    q = q.filter(McpAuditLog.timestamp <= end_time)
                rows = (
                    q.order_by(McpAuditLog.timestamp.desc())
                    .offset(skip)
                    .limit(limit)
                    .all()
                )
                return [McpAuditLogModel.model_validate(r) for r in rows]
        except Exception as e:
            log.error(f"Failed to query MCP audit log: {e}")
            return []

    def count(
        self,
        user_id: Optional[str] = None,
        server_id: Optional[str] = None,
        tool_name: Optional[str] = None,
        status: Optional[str] = None,
        start_time: Optional[int] = None,
        end_time: Optional[int] = None,
        db: Optional[Session] = None,
    ) -> int:
        try:
            with get_db_context(db) as db:
                q = db.query(McpAuditLog)
                if user_id:
                    q = q.filter(McpAuditLog.user_id == user_id)
                if server_id:
                    q = q.filter(McpAuditLog.server_id == server_id)
                if tool_name:
                    q = q.filter(McpAuditLog.tool_name == tool_name)
                if status:
                    q = q.filter(McpAuditLog.status == status)
                if start_time is not None:
                    q = q.filter(McpAuditLog.timestamp >= start_time)
                if end_time is not None:
                    q = q.filter(McpAuditLog.timestamp <= end_time)
                return q.count()
        except Exception as e:
            log.error(f"Failed to count MCP audit log: {e}")
            return 0


McpAuditLogs = McpAuditLogTable()
