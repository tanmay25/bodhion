import time
import logging
import uuid
import base64
import hashlib

from typing import Optional, List
from cryptography.fernet import Fernet

from sqlalchemy.orm import Session
from sqlalchemy import BigInteger, Column, String, Text, Index, UniqueConstraint

from bodhion.internal.db import Base, get_db_context
from bodhion.env import OAUTH_SESSION_TOKEN_ENCRYPTION_KEY
from pydantic import BaseModel, ConfigDict

log = logging.getLogger(__name__)


####################
# DB MODEL
####################


class UserMcpCredential(Base):
    __tablename__ = "user_mcp_credential"

    id = Column(Text, primary_key=True, unique=True)
    user_id = Column(Text, nullable=False)
    server_id = Column(Text, nullable=False)
    auth_type = Column(Text, nullable=False, default="none")
    encrypted_api_key = Column(Text, nullable=True)
    oauth_access_token = Column(Text, nullable=True)
    oauth_refresh_token = Column(Text, nullable=True)
    token_expires_at = Column(BigInteger, nullable=True)
    created_at = Column(BigInteger, nullable=False)
    updated_at = Column(BigInteger, nullable=False)

    __table_args__ = (
        UniqueConstraint("user_id", "server_id", name="uq_user_mcp_credential"),
        Index("idx_user_mcp_credential_user_id", "user_id"),
        Index("idx_user_mcp_credential_server_id", "server_id"),
    )


####################
# Pydantic models
####################


class UserMcpCredentialModel(BaseModel):
    id: str
    user_id: str
    server_id: str
    auth_type: str
    token_expires_at: Optional[int] = None
    created_at: int
    updated_at: int

    model_config = ConfigDict(from_attributes=True)


class UserMcpCredentialStatus(BaseModel):
    server_id: str
    auth_type: str
    connected: bool
    token_expires_at: Optional[int] = None


####################
# Table class
####################


class UserMcpCredentialTable:
    def __init__(self):
        self.encryption_key = OAUTH_SESSION_TOKEN_ENCRYPTION_KEY
        if not self.encryption_key:
            raise Exception("OAUTH_SESSION_TOKEN_ENCRYPTION_KEY is not set")

        if len(self.encryption_key) != 44:
            key_bytes = hashlib.sha256(self.encryption_key.encode()).digest()
            self.encryption_key = base64.urlsafe_b64encode(key_bytes)
        else:
            self.encryption_key = self.encryption_key.encode()

        try:
            self.fernet = Fernet(self.encryption_key)
        except Exception as e:
            log.error(f"Error initializing Fernet: {e}")
            raise

    def _encrypt(self, value: str) -> str:
        return self.fernet.encrypt(value.encode()).decode()

    def _decrypt(self, value: str) -> str:
        return self.fernet.decrypt(value.encode()).decode()

    def upsert_credential(
        self,
        user_id: str,
        server_id: str,
        auth_type: str,
        api_key: Optional[str] = None,
        access_token: Optional[str] = None,
        refresh_token: Optional[str] = None,
        expires_at: Optional[int] = None,
        db: Optional[Session] = None,
    ) -> Optional[UserMcpCredentialModel]:
        try:
            with get_db_context(db) as db:
                current_time = int(time.time())
                existing = (
                    db.query(UserMcpCredential)
                    .filter_by(user_id=user_id, server_id=server_id)
                    .first()
                )

                enc_api_key = self._encrypt(api_key) if api_key else None
                enc_access = self._encrypt(access_token) if access_token else None
                enc_refresh = self._encrypt(refresh_token) if refresh_token else None

                if existing:
                    update_fields: dict = {
                        "auth_type": auth_type,
                        "updated_at": current_time,
                    }
                    if enc_api_key is not None:
                        update_fields["encrypted_api_key"] = enc_api_key
                    if enc_access is not None:
                        update_fields["oauth_access_token"] = enc_access
                    if enc_refresh is not None:
                        update_fields["oauth_refresh_token"] = enc_refresh
                    if expires_at is not None:
                        update_fields["token_expires_at"] = expires_at

                    db.query(UserMcpCredential).filter_by(
                        user_id=user_id, server_id=server_id
                    ).update(update_fields)
                    db.commit()
                    row = (
                        db.query(UserMcpCredential)
                        .filter_by(user_id=user_id, server_id=server_id)
                        .first()
                    )
                else:
                    row = UserMcpCredential(
                        id=str(uuid.uuid4()),
                        user_id=user_id,
                        server_id=server_id,
                        auth_type=auth_type,
                        encrypted_api_key=enc_api_key,
                        oauth_access_token=enc_access,
                        oauth_refresh_token=enc_refresh,
                        token_expires_at=expires_at,
                        created_at=current_time,
                        updated_at=current_time,
                    )
                    db.add(row)
                    db.commit()
                    db.refresh(row)

                if row:
                    return UserMcpCredentialModel.model_validate(row)
                return None
        except Exception as e:
            log.error(f"Error upserting MCP credential for user {user_id}, server {server_id}: {e}")
            return None

    def get_credential_status(
        self, user_id: str, server_id: str, db: Optional[Session] = None
    ) -> Optional[UserMcpCredentialStatus]:
        try:
            with get_db_context(db) as db:
                row = (
                    db.query(UserMcpCredential)
                    .filter_by(user_id=user_id, server_id=server_id)
                    .first()
                )
                if not row:
                    return None
                connected = bool(row.encrypted_api_key or row.oauth_access_token)
                return UserMcpCredentialStatus(
                    server_id=row.server_id,
                    auth_type=row.auth_type,
                    connected=connected,
                    token_expires_at=row.token_expires_at,
                )
        except Exception as e:
            log.error(f"Error getting MCP credential status: {e}")
            return None

    def get_decrypted_api_key(
        self, user_id: str, server_id: str, db: Optional[Session] = None
    ) -> Optional[str]:
        try:
            with get_db_context(db) as db:
                row = (
                    db.query(UserMcpCredential)
                    .filter_by(user_id=user_id, server_id=server_id)
                    .first()
                )
                if row and row.encrypted_api_key:
                    return self._decrypt(row.encrypted_api_key)
                return None
        except Exception as e:
            log.error(f"Error decrypting MCP API key: {e}")
            return None

    def get_decrypted_oauth_tokens(
        self, user_id: str, server_id: str, db: Optional[Session] = None
    ) -> Optional[dict]:
        try:
            with get_db_context(db) as db:
                row = (
                    db.query(UserMcpCredential)
                    .filter_by(user_id=user_id, server_id=server_id)
                    .first()
                )
                if not row or not row.oauth_access_token:
                    return None
                return {
                    "access_token": self._decrypt(row.oauth_access_token),
                    "refresh_token": self._decrypt(row.oauth_refresh_token) if row.oauth_refresh_token else None,
                    "expires_at": row.token_expires_at,
                }
        except Exception as e:
            log.error(f"Error decrypting MCP OAuth tokens: {e}")
            return None

    def update_oauth_tokens(
        self,
        user_id: str,
        server_id: str,
        access_token: str,
        refresh_token: Optional[str],
        expires_at: Optional[int],
        db: Optional[Session] = None,
    ) -> bool:
        try:
            with get_db_context(db) as db:
                update_fields: dict = {
                    "oauth_access_token": self._encrypt(access_token),
                    "token_expires_at": expires_at,
                    "updated_at": int(time.time()),
                }
                if refresh_token:
                    update_fields["oauth_refresh_token"] = self._encrypt(refresh_token)
                count = (
                    db.query(UserMcpCredential)
                    .filter_by(user_id=user_id, server_id=server_id)
                    .update(update_fields)
                )
                db.commit()
                return count > 0
        except Exception as e:
            log.error(f"Error updating OAuth tokens: {e}")
            return False

    def get_user_credentials(
        self, user_id: str, db: Optional[Session] = None
    ) -> List[UserMcpCredentialStatus]:
        try:
            with get_db_context(db) as db:
                rows = db.query(UserMcpCredential).filter_by(user_id=user_id).all()
                return [
                    UserMcpCredentialStatus(
                        server_id=r.server_id,
                        auth_type=r.auth_type,
                        connected=bool(r.encrypted_api_key or r.oauth_access_token),
                        token_expires_at=r.token_expires_at,
                    )
                    for r in rows
                ]
        except Exception as e:
            log.error(f"Error getting user MCP credentials: {e}")
            return []

    def delete_credential(
        self, user_id: str, server_id: str, db: Optional[Session] = None
    ) -> bool:
        try:
            with get_db_context(db) as db:
                count = (
                    db.query(UserMcpCredential)
                    .filter_by(user_id=user_id, server_id=server_id)
                    .delete()
                )
                db.commit()
                return count > 0
        except Exception as e:
            log.error(f"Error deleting MCP credential: {e}")
            return False

    def delete_credentials_by_user(
        self, user_id: str, db: Optional[Session] = None
    ) -> bool:
        try:
            with get_db_context(db) as db:
                db.query(UserMcpCredential).filter_by(user_id=user_id).delete()
                db.commit()
                return True
        except Exception as e:
            log.error(f"Error deleting all MCP credentials for user {user_id}: {e}")
            return False


UserMcpCredentials = UserMcpCredentialTable()
