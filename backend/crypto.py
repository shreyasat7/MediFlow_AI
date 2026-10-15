"""Transparent field-level encryption for PHI at rest.

`EncryptedString` is a SQLAlchemy type that encrypts on write and decrypts on
read, so application/query code never changes. Legacy plaintext rows decrypt
gracefully (returned as-is) and get encrypted on their next write.

Only apply to fields that are NEVER used in SQL filters/joins — encrypting an
indexed/searched column (like name) would break lookups. Demographics, contact,
insurance and history fields are safe (read into Python, not queried in SQL).
"""
import base64
import hashlib
import os
from cryptography.fernet import Fernet, InvalidToken
from sqlalchemy import String
from sqlalchemy.types import TypeDecorator

_env_key = os.getenv("FERNET_KEY")
USING_DEV_KEY = not _env_key

if _env_key:
    _KEY = _env_key.encode()
else:
    # Deterministic dev key so previously-encrypted rows stay readable across
    # restarts. NEVER use this in production — set FERNET_KEY in the environment.
    _KEY = base64.urlsafe_b64encode(hashlib.sha256(b"mediflow-dev-encryption-key").digest())

_fernet = Fernet(_KEY)


class EncryptedString(TypeDecorator):
    impl = String
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        return _fernet.encrypt(str(value).encode()).decode()

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        try:
            return _fernet.decrypt(value.encode()).decode()
        except (InvalidToken, ValueError, TypeError):
            # Legacy plaintext row (pre-encryption) — return as-is.
            return value
