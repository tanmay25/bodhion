import time
import uuid
import logging
from typing import Optional, List

from sqlalchemy.orm import Session
from sqlalchemy import BigInteger, Column, Text, Index, func, case

from bodhion.internal.db import Base, get_db_context
from pydantic import BaseModel, ConfigDict

log = logging.getLogger(__name__)


####################
# DB MODEL
####################


class McpHealthLog(Base):
    __tablename__ = "mcp_health_log"

    id = Column(Text, primary_key=True, unique=True)
    server_id = Column(Text, nullable=False)
    server_name = Column(Text, nullable=True)
    status = Column(Text, nullable=False)  # 'ok' | 'unreachable' | 'auth_error'
    latency_ms = Column(BigInteger, nullable=True)
    timestamp = Column(BigInteger, nullable=False)

    __table_args__ = (
        Index("idx_mcp_health_server_id", "server_id"),
        Index("idx_mcp_health_timestamp", "timestamp"),
    )


####################
# Pydantic model
####################


class McpHealthLogModel(BaseModel):
    id: str
    server_id: str
    server_name: Optional[str] = None
    status: str
    latency_ms: Optional[int] = None
    timestamp: int

    model_config = ConfigDict(from_attributes=True)


####################
# Table class
####################


class McpHealthLogTable:
    def write(
        self,
        server_id: str,
        server_name: Optional[str],
        status: str,
        latency_ms: Optional[int] = None,
        db: Optional[Session] = None,
    ) -> None:
        try:
            with get_db_context(db) as db:
                row = McpHealthLog(
                    id=str(uuid.uuid4()),
                    server_id=server_id,
                    server_name=server_name,
                    status=status,
                    latency_ms=latency_ms,
                    timestamp=int(time.time()),
                )
                db.add(row)
                db.commit()
        except Exception as e:
            log.error(f"Failed to write MCP health log for '{server_id}': {e}")

    def get_history(
        self,
        server_id: str,
        hours: int = 24,
        db: Optional[Session] = None,
    ) -> List[McpHealthLogModel]:
        try:
            since = int(time.time()) - hours * 3600
            with get_db_context(db) as db:
                rows = (
                    db.query(McpHealthLog)
                    .filter(
                        McpHealthLog.server_id == server_id,
                        McpHealthLog.timestamp >= since,
                    )
                    .order_by(McpHealthLog.timestamp.asc())
                    .all()
                )
                return [McpHealthLogModel.model_validate(r) for r in rows]
        except Exception as e:
            log.error(f"Failed to get MCP health history for '{server_id}': {e}")
            return []

    def get_uptime_percent(
        self,
        server_id: str,
        days: int = 7,
        db: Optional[Session] = None,
    ) -> Optional[float]:
        """Return the percentage of 'ok' checks in the last N days, or None if no data."""
        try:
            since = int(time.time()) - days * 86400
            with get_db_context(db) as db:
                total = (
                    db.query(func.count(McpHealthLog.id))
                    .filter(
                        McpHealthLog.server_id == server_id,
                        McpHealthLog.timestamp >= since,
                    )
                    .scalar()
                )
                if not total:
                    return None
                ok_count = (
                    db.query(func.count(McpHealthLog.id))
                    .filter(
                        McpHealthLog.server_id == server_id,
                        McpHealthLog.timestamp >= since,
                        McpHealthLog.status == "ok",
                    )
                    .scalar()
                )
                return round(100.0 * (ok_count or 0) / total, 1)
        except Exception as e:
            log.error(f"Failed to compute uptime for '{server_id}': {e}")
            return None

    def prune(self, older_than_days: int = 7, db: Optional[Session] = None) -> int:
        """Delete health log entries older than N days. Returns number of rows deleted."""
        try:
            cutoff = int(time.time()) - older_than_days * 86400
            with get_db_context(db) as db:
                n = (
                    db.query(McpHealthLog)
                    .filter(McpHealthLog.timestamp < cutoff)
                    .delete(synchronize_session=False)
                )
                db.commit()
                return n
        except Exception as e:
            log.error(f"Failed to prune MCP health log: {e}")
            return 0


McpHealthLogs = McpHealthLogTable()
