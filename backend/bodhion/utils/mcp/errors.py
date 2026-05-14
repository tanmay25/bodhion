from enum import Enum
from typing import Optional


class MCPErrorType(str, Enum):
    NETWORK = "network"
    AUTH = "auth"
    TOOL_NOT_FOUND = "tool_not_found"
    SCHEMA_MISMATCH = "schema_mismatch"
    TOOL_ERROR = "tool_error"
    RATE_LIMITED = "rate_limited"
    UNKNOWN = "unknown"


class MCPToolError(Exception):
    def __init__(
        self,
        error_type: MCPErrorType,
        message: str,
        retry_after_seconds: Optional[int] = None,
    ):
        self.error_type = error_type
        self.message = message
        self.retry_after_seconds = retry_after_seconds
        super().__init__(message)

    def to_dict(self) -> dict:
        result = {
            "error": True,
            "error_type": self.error_type.value,
            "message": self.message,
        }
        if self.retry_after_seconds is not None:
            result["retry_after_seconds"] = self.retry_after_seconds
        return result
