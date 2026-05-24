#!/usr/bin/env python3
import argparse
import asyncio
import base64
import hashlib
import hmac
import json
import math
import mimetypes
import os
import re
import secrets
import smtplib
import sqlite3
import ssl
import threading
import time
import uuid
from dataclasses import dataclass, field
from email.message import EmailMessage
from email.utils import formataddr
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple
from urllib.parse import quote, urlencode, urlsplit

from aiohttp import ClientSession, ClientTimeout, WSMsgType, web


HOP_BY_HOP_HEADERS = {
    "connection",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailers",
    "transfer-encoding",
    "upgrade",
}


@dataclass
class TunnelSession:
    shop_id: str
    websocket: web.WebSocketResponse
    send_lock: asyncio.Lock = field(default_factory=asyncio.Lock)
    pending_ids: Set[str] = field(default_factory=set)


@dataclass
class SmtpConfig:
    host: str = ""
    port: int = 587
    username: str = ""
    password: str = ""
    sender: str = ""
    sender_name: str = "Hashop"
    security: str = "starttls"
    timeout: float = 12.0

    @property
    def configured(self) -> bool:
        return bool(self.host and self.port and self.sender and self.username and self.password)

    @classmethod
    def from_env(cls) -> "SmtpConfig":
        def safe_int(value: str, default: int) -> int:
            try:
                return int(str(value or "").strip() or default)
            except ValueError:
                return default

        def safe_float(value: str, default: float) -> float:
            try:
                return float(str(value or "").strip() or default)
            except ValueError:
                return default

        sender = str(os.environ.get("HASHOP_SMTP_FROM") or os.environ.get("HASHOP_SMTP_USERNAME") or "").strip()
        return cls(
            host=str(os.environ.get("HASHOP_SMTP_HOST") or "").strip(),
            port=safe_int(os.environ.get("HASHOP_SMTP_PORT", "587"), 587),
            username=str(os.environ.get("HASHOP_SMTP_USERNAME") or "").strip(),
            password=str(os.environ.get("HASHOP_SMTP_PASSWORD") or ""),
            sender=sender,
            sender_name=str(os.environ.get("HASHOP_SMTP_FROM_NAME") or "Hashop").strip() or "Hashop",
            security=str(os.environ.get("HASHOP_SMTP_SECURITY") or "starttls").strip().lower(),
            timeout=safe_float(os.environ.get("HASHOP_SMTP_TIMEOUT", "12"), 12.0),
        )


def env_flag(name: str, default: bool) -> bool:
    value = os.environ.get(name)
    if value is None:
        return default
    return str(value).strip().lower() in {"1", "true", "yes", "on"}


class ShopStore:
    GPS_PATTERN = re.compile(r"GPS:\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)", re.IGNORECASE)
    GPS_COORDS_PATTERN = re.compile(r"^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$")
    VALID_MAP_UNLOCK_METHODS = {"", "manual", "upi", "btc", "eth"}
    VALID_MAP_UNLOCK_STATUSES = {"not_required", "locked", "pending", "unlocked"}
    ORDER_STATES = {"created", "payment_pending", "accepted", "ready", "paid", "completed", "cancelled"}
    MAP_COLOR_PALETTE = [
        "#ffffff",
        "#facc15",
        "#38bdf8",
        "#fb7185",
        "#4ade80",
        "#c084fc",
        "#f97316",
        "#22d3ee",
        "#f59e0b",
        "#a3e635",
        "#f472b6",
        "#60a5fa",
    ]

    def __init__(self, db_path: Path) -> None:
        self.db_path = db_path
        self._lock = threading.Lock()

    async def initialize(self) -> None:
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        await asyncio.to_thread(self._initialize_sync)

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.db_path)
        connection.row_factory = sqlite3.Row
        return connection

    def _initialize_sync(self) -> None:
        with self._connect() as connection:
            connection.execute("PRAGMA journal_mode=WAL")
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS shops (
                    shop_id TEXT PRIMARY KEY,
                    display_name TEXT NOT NULL,
                    reach_plan TEXT NOT NULL,
                    public_url TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
                """
            )
            columns = {
                str(row["name"])
                for row in connection.execute("PRAGMA table_info(shops)").fetchall()
            }
            if "console_json" not in columns:
                connection.execute(
                    """
                    ALTER TABLE shops
                    ADD COLUMN console_json TEXT NOT NULL DEFAULT '{}'
                    """
                )
            if "password_hash" not in columns:
                connection.execute(
                    """
                    ALTER TABLE shops
                    ADD COLUMN password_hash TEXT NOT NULL DEFAULT ''
                    """
                )
            if "map_color" not in columns:
                connection.execute(
                    """
                    ALTER TABLE shops
                    ADD COLUMN map_color TEXT NOT NULL DEFAULT '#ffffff'
                    """
                )
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS buyer_accounts (
                    account_id TEXT PRIMARY KEY,
                    display_name TEXT NOT NULL,
                    contact TEXT NOT NULL,
                    contact_key TEXT NOT NULL UNIQUE,
                    password_hash TEXT NOT NULL,
                    buyer_key TEXT NOT NULL,
                    account_token TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
                """
            )
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS shop_password_resets (
                    reset_id TEXT PRIMARY KEY,
                    shop_id TEXT NOT NULL,
                    contact_key TEXT NOT NULL,
                    code_hash TEXT NOT NULL,
                    created_at INTEGER NOT NULL,
                    expires_at INTEGER NOT NULL,
                    used_at INTEGER NOT NULL DEFAULT 0,
                    attempts INTEGER NOT NULL DEFAULT 0
                )
                """
            )
            connection.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_shop_password_resets_shop
                ON shop_password_resets(shop_id, expires_at, used_at)
                """
            )
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS shop_recovery_contacts (
                    recovery_id TEXT PRIMARY KEY,
                    shop_id TEXT NOT NULL,
                    contact TEXT NOT NULL,
                    contact_key TEXT NOT NULL,
                    contact_type TEXT NOT NULL,
                    is_primary INTEGER NOT NULL DEFAULT 0,
                    verified_at INTEGER NOT NULL DEFAULT 0,
                    source TEXT NOT NULL DEFAULT 'owner_password',
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    UNIQUE(shop_id, contact_key)
                )
                """
            )
            connection.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_shop_recovery_contacts_shop
                ON shop_recovery_contacts(shop_id, verified_at, is_primary)
                """
            )
            connection.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_shop_recovery_contacts_contact
                ON shop_recovery_contacts(contact_key, shop_id)
                """
            )
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS buyer_password_resets (
                    reset_id TEXT PRIMARY KEY,
                    contact_key TEXT NOT NULL,
                    code_hash TEXT NOT NULL,
                    created_at INTEGER NOT NULL,
                    expires_at INTEGER NOT NULL,
                    used_at INTEGER NOT NULL DEFAULT 0,
                    attempts INTEGER NOT NULL DEFAULT 0
                )
                """
            )
            connection.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_buyer_password_resets_contact
                ON buyer_password_resets(contact_key, expires_at, used_at)
                """
            )
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS buyer_contact_verifications (
                    verification_id TEXT PRIMARY KEY,
                    contact TEXT NOT NULL,
                    contact_key TEXT NOT NULL,
                    code_hash TEXT NOT NULL,
                    created_at INTEGER NOT NULL,
                    expires_at INTEGER NOT NULL,
                    used_at INTEGER NOT NULL DEFAULT 0,
                    attempts INTEGER NOT NULL DEFAULT 0
                )
                """
            )
            connection.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_buyer_contact_verifications_contact
                ON buyer_contact_verifications(contact_key, expires_at, used_at)
                """
            )
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS account_auth_events (
                    event_id TEXT PRIMARY KEY,
                    scope TEXT NOT NULL,
                    contact_key TEXT NOT NULL DEFAULT '',
                    client_key TEXT NOT NULL DEFAULT '',
                    created_at INTEGER NOT NULL
                )
                """
            )
            connection.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_account_auth_events_contact
                ON account_auth_events(scope, contact_key, created_at)
                """
            )
            connection.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_account_auth_events_client
                ON account_auth_events(scope, client_key, created_at)
                """
            )
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS account_help_requests (
                    help_id TEXT PRIMARY KEY,
                    buyer_key TEXT NOT NULL,
                    buyer_account_id TEXT NOT NULL DEFAULT '',
                    name TEXT NOT NULL DEFAULT '',
                    contact TEXT NOT NULL DEFAULT '',
                    message TEXT NOT NULL,
                    screen TEXT NOT NULL DEFAULT '',
                    route TEXT NOT NULL DEFAULT '',
                    build TEXT NOT NULL DEFAULT '',
                    user_agent TEXT NOT NULL DEFAULT '',
                    created_at TEXT NOT NULL
                )
                """
            )
            connection.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_account_help_requests_created
                ON account_help_requests(created_at)
                """
            )
            connection.commit()

    async def upsert_shop(
        self,
        shop_id: str,
        display_name: str,
        reach_plan: str,
        public_url: str,
    ) -> Tuple[Dict[str, str], bool]:
        return await asyncio.to_thread(
            self._upsert_shop_threadsafe,
            shop_id,
            display_name,
            reach_plan,
            public_url,
        )

    def _upsert_shop_threadsafe(
        self,
        shop_id: str,
        display_name: str,
        reach_plan: str,
        public_url: str,
    ) -> Tuple[Dict[str, str], bool]:
        with self._lock:
            return self._upsert_shop_sync(
                shop_id,
                display_name,
                reach_plan,
                public_url,
            )

    def _upsert_shop_sync(
        self,
        shop_id: str,
        display_name: str,
        reach_plan: str,
        public_url: str,
    ) -> Tuple[Dict[str, str], bool]:
        timestamp = self._utcnow()
        with self._connect() as connection:
            existing = connection.execute(
                "SELECT created_at, map_color FROM shops WHERE shop_id = ?",
                (shop_id,),
            ).fetchone()
            created = existing is None
            created_at = timestamp if existing is None else str(existing["created_at"])
            map_color = self._normalize_map_color(
                str(existing["map_color"]) if existing is not None and "map_color" in existing.keys() else ""
            ) or self._next_map_color(connection)
            connection.execute(
                """
                INSERT INTO shops (
                    shop_id,
                    display_name,
                    reach_plan,
                    public_url,
                    map_color,
                    created_at,
                    updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(shop_id) DO UPDATE SET
                    display_name = excluded.display_name,
                    reach_plan = excluded.reach_plan,
                    public_url = excluded.public_url,
                    map_color = excluded.map_color,
                    updated_at = excluded.updated_at
                """,
                (
                    shop_id,
                    display_name,
                    reach_plan,
                    public_url,
                    map_color,
                    created_at,
                    timestamp,
                ),
            )
            connection.commit()
            record = self._row_to_dict(
                connection.execute(
                    """
                    SELECT shop_id, display_name, reach_plan, public_url, map_color, created_at, updated_at
                    FROM shops
                    WHERE shop_id = ?
                    """,
                    (shop_id,),
                ).fetchone()
            )
        return record, created

    async def ensure_shop(self, shop_id: str, public_url: str) -> Dict[str, str]:
        return await asyncio.to_thread(self._ensure_shop_threadsafe, shop_id, public_url)

    def _ensure_shop_threadsafe(self, shop_id: str, public_url: str) -> Dict[str, str]:
        with self._lock:
            return self._ensure_shop_sync(shop_id, public_url)

    def _ensure_shop_sync(self, shop_id: str, public_url: str) -> Dict[str, str]:
        timestamp = self._utcnow()
        with self._connect() as connection:
            existing = connection.execute(
                "SELECT map_color FROM shops WHERE shop_id = ?",
                (shop_id,),
            ).fetchone()
            map_color = self._normalize_map_color(
                str(existing["map_color"]) if existing is not None and "map_color" in existing.keys() else ""
            ) or self._next_map_color(connection)
            connection.execute(
                """
                INSERT INTO shops (
                    shop_id,
                    display_name,
                    reach_plan,
                    public_url,
                    map_color,
                    created_at,
                    updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(shop_id) DO UPDATE SET
                    public_url = excluded.public_url,
                    map_color = excluded.map_color,
                    updated_at = excluded.updated_at
                """,
                (
                    shop_id,
                    shop_id,
                    "free",
                    public_url,
                    map_color,
                    timestamp,
                    timestamp,
                ),
            )
            connection.commit()
            return self._row_to_dict(
                connection.execute(
                    """
                    SELECT shop_id, display_name, reach_plan, public_url, map_color, created_at, updated_at
                    FROM shops
                    WHERE shop_id = ?
                    """,
                    (shop_id,),
                ).fetchone()
            )

    async def get_shop(self, shop_id: str) -> Optional[Dict[str, str]]:
        return await asyncio.to_thread(self._get_shop_threadsafe, shop_id)

    def _get_shop_threadsafe(self, shop_id: str) -> Optional[Dict[str, str]]:
        with self._lock:
            return self._get_shop_sync(shop_id)

    def _get_shop_sync(self, shop_id: str) -> Optional[Dict[str, str]]:
        with self._connect() as connection:
            row = connection.execute(
                """
                SELECT shop_id, display_name, reach_plan, public_url, map_color, created_at, updated_at
                FROM shops
                WHERE shop_id = ?
                """,
                (shop_id,),
            ).fetchone()
        return self._row_to_dict(row) if row is not None else None

    async def get_shop_console(self, shop_id: str) -> Optional[Dict[str, Any]]:
        return await asyncio.to_thread(self._get_shop_console_threadsafe, shop_id)

    def _get_shop_console_threadsafe(self, shop_id: str) -> Optional[Dict[str, Any]]:
        with self._lock:
            return self._get_shop_console_sync(shop_id)

    def _get_shop_console_sync(self, shop_id: str) -> Optional[Dict[str, Any]]:
        with self._connect() as connection:
            row = connection.execute(
                """
                SELECT shop_id, display_name, reach_plan, public_url, map_color, created_at, updated_at, console_json
                FROM shops
                WHERE shop_id = ?
                """,
                (shop_id,),
            ).fetchone()
        return self._row_to_console_dict(row) if row is not None else None

    async def save_shop_console(self, shop_id: str, console_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        return await asyncio.to_thread(self._save_shop_console_threadsafe, shop_id, console_data)

    def _save_shop_console_threadsafe(self, shop_id: str, console_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        with self._lock:
            return self._save_shop_console_sync(shop_id, console_data)

    def _save_shop_console_sync(self, shop_id: str, console_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        timestamp = self._utcnow()
        with self._connect() as connection:
            row = connection.execute(
                """
                SELECT shop_id, display_name, reach_plan, public_url, map_color, created_at, updated_at, console_json
                FROM shops
                WHERE shop_id = ?
                """,
                (shop_id,),
            ).fetchone()
            if row is None:
                return None
            record = self._row_to_console_dict(row)
            normalized_console = self._normalize_console(
                shop_id=shop_id,
                display_name=str(record["display_name"]),
                public_url=str(record["public_url"]),
                raw_console=console_data,
            )
            display_name = str(normalized_console["profile"].get("name") or record["display_name"]).strip()[:80] or shop_id
            connection.execute(
                """
                UPDATE shops
                SET display_name = ?, console_json = ?, updated_at = ?
                WHERE shop_id = ?
                """,
                (
                    display_name,
                    json.dumps(normalized_console, separators=(",", ":")),
                    timestamp,
                    shop_id,
                ),
            )
            connection.commit()
            updated = connection.execute(
                """
                SELECT shop_id, display_name, reach_plan, public_url, map_color, created_at, updated_at, console_json
                FROM shops
                WHERE shop_id = ?
                """,
                (shop_id,),
            ).fetchone()
        return self._row_to_console_dict(updated) if updated is not None else None

    async def set_shop_password(self, shop_id: str, password: str) -> Optional[Dict[str, str]]:
        return await asyncio.to_thread(self._set_shop_password_threadsafe, shop_id, password)

    def _set_shop_password_threadsafe(self, shop_id: str, password: str) -> Optional[Dict[str, str]]:
        with self._lock:
            return self._set_shop_password_sync(shop_id, password)

    def _set_shop_password_sync(self, shop_id: str, password: str) -> Optional[Dict[str, str]]:
        timestamp = self._utcnow()
        hashed = self._hash_password(password)
        with self._connect() as connection:
            row = connection.execute(
                """
                SELECT shop_id, display_name, reach_plan, public_url, map_color, created_at, updated_at
                FROM shops
                WHERE shop_id = ?
                """,
                (shop_id,),
            ).fetchone()
            if row is None:
                return None
            connection.execute(
                """
                UPDATE shops
                SET password_hash = ?, updated_at = ?
                WHERE shop_id = ?
                """,
                (hashed, timestamp, shop_id),
            )
            connection.commit()
            updated = connection.execute(
                """
                SELECT shop_id, display_name, reach_plan, public_url, map_color, created_at, updated_at
                FROM shops
                WHERE shop_id = ?
                """,
                (shop_id,),
            ).fetchone()
        return self._row_to_dict(updated) if updated is not None else None

    async def verify_shop_password(self, shop_id: str, password: str) -> Optional[Dict[str, str]]:
        return await asyncio.to_thread(self._verify_shop_password_threadsafe, shop_id, password)

    def _verify_shop_password_threadsafe(self, shop_id: str, password: str) -> Optional[Dict[str, str]]:
        with self._lock:
            return self._verify_shop_password_sync(shop_id, password)

    def _verify_shop_password_sync(self, shop_id: str, password: str) -> Optional[Dict[str, str]]:
        with self._connect() as connection:
            row = connection.execute(
                """
                SELECT shop_id, display_name, reach_plan, public_url, map_color, created_at, updated_at, password_hash
                FROM shops
                WHERE shop_id = ?
                """,
                (shop_id,),
            ).fetchone()
        if row is None:
            return None
        password_hash = str(row["password_hash"] or "").strip()
        if not password_hash or not self._verify_password(password, password_hash):
            return None
        return self._row_to_dict(row)

    async def link_shop_recovery_contact(
        self,
        shop_id: str,
        contact: str,
        source: str = "owner_password",
        is_primary: bool = True,
    ) -> Optional[Dict[str, Any]]:
        return await asyncio.to_thread(
            self._link_shop_recovery_contact_threadsafe,
            shop_id,
            contact,
            source,
            is_primary,
        )

    def _link_shop_recovery_contact_threadsafe(
        self,
        shop_id: str,
        contact: str,
        source: str,
        is_primary: bool,
    ) -> Optional[Dict[str, Any]]:
        with self._lock:
            return self._link_shop_recovery_contact_sync(shop_id, contact, source, is_primary)

    def _link_shop_recovery_contact_sync(
        self,
        shop_id: str,
        contact: str,
        source: str,
        is_primary: bool,
    ) -> Optional[Dict[str, Any]]:
        safe_shop_id = str(shop_id or "").strip()[:64]
        if not safe_shop_id:
            return None
        with self._connect() as connection:
            shop_row = connection.execute(
                """
                SELECT shop_id
                FROM shops
                WHERE shop_id = ?
                """,
                (safe_shop_id,),
            ).fetchone()
            if shop_row is None:
                return None
            result = self._link_shop_recovery_contact_with_connection(
                connection,
                safe_shop_id,
                contact,
                source,
                is_primary,
            )
            connection.commit()
        return result

    def _link_shop_recovery_contact_with_connection(
        self,
        connection: sqlite3.Connection,
        shop_id: str,
        contact: str,
        source: str,
        is_primary: bool,
    ) -> Optional[Dict[str, Any]]:
        safe_contact = str(contact or "").strip()[:255]
        contact_key = self._reset_contact_key(safe_contact)
        if not shop_id or not safe_contact or not contact_key:
            return None
        timestamp = self._utcnow()
        now = int(time.time())
        contact_type = self._recovery_contact_type(contact_key)
        safe_source = re.sub(r"[^a-z0-9_-]+", "_", str(source or "owner_password").strip().lower())[:40] or "owner_password"
        if is_primary:
            connection.execute(
                """
                UPDATE shop_recovery_contacts
                SET is_primary = 0, updated_at = ?
                WHERE shop_id = ?
                """,
                (timestamp, shop_id),
            )
        connection.execute(
            """
            INSERT INTO shop_recovery_contacts (
                recovery_id,
                shop_id,
                contact,
                contact_key,
                contact_type,
                is_primary,
                verified_at,
                source,
                created_at,
                updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(shop_id, contact_key) DO UPDATE SET
                contact = excluded.contact,
                contact_type = excluded.contact_type,
                is_primary = excluded.is_primary,
                verified_at = excluded.verified_at,
                source = excluded.source,
                updated_at = excluded.updated_at
            """,
            (
                uuid.uuid4().hex,
                shop_id,
                safe_contact,
                contact_key,
                contact_type,
                1 if is_primary else 0,
                now,
                safe_source,
                timestamp,
                timestamp,
            ),
        )
        row = connection.execute(
            """
            SELECT recovery_id, shop_id, contact, contact_key, contact_type, is_primary, verified_at, source, created_at, updated_at
            FROM shop_recovery_contacts
            WHERE shop_id = ? AND contact_key = ?
            """,
            (shop_id, contact_key),
        ).fetchone()
        return self._shop_recovery_contact_row_to_dict(row) if row is not None else None

    @staticmethod
    def _recovery_contact_type(contact_key: str) -> str:
        value = str(contact_key or "")
        if value.startswith("email:"):
            return "email"
        if value.startswith("phone:"):
            return "phone"
        return "text"

    @staticmethod
    def _shop_recovery_contact_row_to_dict(row: sqlite3.Row) -> Dict[str, Any]:
        return {
            "recovery_id": str(row["recovery_id"]),
            "shop_id": str(row["shop_id"]),
            "contact": str(row["contact"]),
            "contact_type": str(row["contact_type"]),
            "is_primary": bool(int(row["is_primary"] or 0)),
            "verified_at": int(row["verified_at"] or 0),
            "source": str(row["source"]),
            "created_at": str(row["created_at"]),
            "updated_at": str(row["updated_at"]),
        }

    def _legacy_shop_recovery_contacts_from_row(self, row: sqlite3.Row) -> List[str]:
        raw_profile: Dict[str, Any] = {}
        raw_console = row["console_json"] if "console_json" in row.keys() else "{}"
        if isinstance(raw_console, str):
            try:
                raw_payload = json.loads(raw_console) if raw_console.strip() else {}
            except json.JSONDecodeError:
                raw_payload = {}
        elif isinstance(raw_console, dict):
            raw_payload = raw_console
        else:
            raw_payload = {}
        if isinstance(raw_payload, dict) and isinstance(raw_payload.get("profile"), dict):
            raw_profile = raw_payload.get("profile", {})
        console_payload = self._normalize_console(
            shop_id=str(row["shop_id"] or ""),
            display_name=str(row["display_name"] or row["shop_id"] or ""),
            public_url=str(row["public_url"] or ""),
            raw_console=raw_console,
        )
        profile = console_payload.get("profile")
        if not isinstance(profile, dict):
            profile = {}
        result: List[str] = []
        for value in (
            str(profile.get("contact") or "").strip(),
            str(raw_profile.get("resetContact") or "").strip(),
        ):
            if value and value not in result:
                result.append(value)
        return result

    def _match_shop_recovery_contact(
        self,
        connection: sqlite3.Connection,
        shop_id: str,
        contact_key: str,
        shop_row: sqlite3.Row,
    ) -> Tuple[str, bool]:
        recovery_row = connection.execute(
            """
            SELECT contact
            FROM shop_recovery_contacts
            WHERE shop_id = ? AND contact_key = ? AND verified_at > 0
            ORDER BY is_primary DESC, updated_at DESC
            LIMIT 1
            """,
            (shop_id, contact_key),
        ).fetchone()
        if recovery_row is not None:
            return str(recovery_row["contact"] or "").strip(), True

        has_recovery = connection.execute(
            """
            SELECT 1
            FROM shop_recovery_contacts
            WHERE shop_id = ? AND verified_at > 0
            LIMIT 1
            """,
            (shop_id,),
        ).fetchone() is not None
        legacy_contacts = self._legacy_shop_recovery_contacts_from_row(shop_row)
        for saved_contact in legacy_contacts:
            saved_contact_key = self._reset_contact_key(saved_contact)
            if saved_contact_key and hmac.compare_digest(contact_key, saved_contact_key):
                self._link_shop_recovery_contact_with_connection(
                    connection,
                    shop_id,
                    saved_contact,
                    "legacy_profile",
                    not has_recovery,
                )
                return saved_contact, True
        return "", has_recovery or bool(legacy_contacts)

    async def create_shop_password_reset(
        self,
        shop_id: str,
        contact: str,
        ttl_seconds: int = 600,
    ) -> Dict[str, Any]:
        safe_ttl = max(60, min(3600, int(ttl_seconds or 600)))
        return await asyncio.to_thread(self._create_shop_password_reset_threadsafe, shop_id, contact, safe_ttl)

    def _create_shop_password_reset_threadsafe(
        self,
        shop_id: str,
        contact: str,
        ttl_seconds: int,
    ) -> Dict[str, Any]:
        with self._lock:
            return self._create_shop_password_reset_sync(shop_id, contact, ttl_seconds)

    def _create_shop_password_reset_sync(
        self,
        shop_id: str,
        contact: str,
        ttl_seconds: int,
    ) -> Dict[str, Any]:
        now = int(time.time())
        contact_key = self._reset_contact_key(contact)
        if not contact_key:
            return {"ok": False, "error": "contact_required"}
        with self._connect() as connection:
            row = connection.execute(
                """
                SELECT shop_id, display_name, reach_plan, public_url, map_color, created_at, updated_at, console_json
                FROM shops
                WHERE shop_id = ?
                """,
                (shop_id,),
            ).fetchone()
            if row is None:
                return {"ok": False, "error": "shop_not_found"}
            matched_contact, has_recovery_contact = self._match_shop_recovery_contact(
                connection,
                shop_id,
                contact_key,
                row,
            )
            if not has_recovery_contact:
                return {"ok": False, "error": "reset_contact_missing"}
            if not matched_contact:
                return {"ok": False, "error": "invalid_contact"}
            recent = connection.execute(
                """
                SELECT created_at
                FROM shop_password_resets
                WHERE shop_id = ? AND used_at = 0 AND created_at >= ?
                ORDER BY created_at DESC
                LIMIT 1
                """,
                (shop_id, now - 60),
            ).fetchone()
            if recent is not None:
                return {"ok": False, "error": "reset_rate_limited", "retry_after": 60}
            connection.execute(
                """
                DELETE FROM shop_password_resets
                WHERE expires_at < ? OR used_at > 0
                """,
                (now - 86400,),
            )
            reset_code = f"{secrets.randbelow(1000000):06d}"
            reset_id = uuid.uuid4().hex
            expires_at = now + ttl_seconds
            connection.execute(
                """
                INSERT INTO shop_password_resets (
                    reset_id, shop_id, contact_key, code_hash, created_at, expires_at, used_at, attempts
                )
                VALUES (?, ?, ?, ?, ?, ?, 0, 0)
                """,
                (
                    reset_id,
                    shop_id,
                    contact_key,
                    self._hash_password(f"{shop_id}:{reset_code}"),
                    now,
                    expires_at,
                ),
            )
            connection.commit()
        return {
            "ok": True,
            "reset_code": reset_code,
            "expires_at": expires_at,
            "expires_in": ttl_seconds,
            "shop": self._row_to_dict(row),
            "contact_hint": self._mask_contact(matched_contact),
            "delivery_contact": matched_contact,
            "delivery_method": self._recovery_contact_type(contact_key),
        }

    async def reset_shop_password_with_code(
        self,
        shop_id: str,
        reset_code: str,
        password: str,
    ) -> Optional[Dict[str, str]]:
        return await asyncio.to_thread(self._reset_shop_password_with_code_threadsafe, shop_id, reset_code, password)

    def _reset_shop_password_with_code_threadsafe(
        self,
        shop_id: str,
        reset_code: str,
        password: str,
    ) -> Optional[Dict[str, str]]:
        with self._lock:
            return self._reset_shop_password_with_code_sync(shop_id, reset_code, password)

    def _reset_shop_password_with_code_sync(
        self,
        shop_id: str,
        reset_code: str,
        password: str,
    ) -> Optional[Dict[str, str]]:
        now = int(time.time())
        timestamp = self._utcnow()
        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT reset_id, code_hash, attempts
                FROM shop_password_resets
                WHERE shop_id = ? AND used_at = 0 AND expires_at >= ? AND attempts < 5
                ORDER BY created_at DESC
                LIMIT 5
                """,
                (shop_id, now),
            ).fetchall()
            matched_reset_id = ""
            for row in rows:
                if self._verify_password(f"{shop_id}:{reset_code}", str(row["code_hash"] or "")):
                    matched_reset_id = str(row["reset_id"] or "")
                    break
            if not matched_reset_id:
                connection.execute(
                    """
                    UPDATE shop_password_resets
                    SET attempts = attempts + 1
                    WHERE shop_id = ? AND used_at = 0 AND expires_at >= ?
                    """,
                    (shop_id, now),
                )
                connection.commit()
                return None
            shop_row = connection.execute(
                """
                SELECT shop_id, display_name, reach_plan, public_url, map_color, created_at, updated_at
                FROM shops
                WHERE shop_id = ?
                """,
                (shop_id,),
            ).fetchone()
            if shop_row is None:
                return None
            connection.execute(
                """
                UPDATE shops
                SET password_hash = ?, updated_at = ?
                WHERE shop_id = ?
                """,
                (self._hash_password(password), timestamp, shop_id),
            )
            connection.execute(
                """
                UPDATE shop_password_resets
                SET used_at = ?
                WHERE reset_id = ?
                """,
                (now, matched_reset_id),
            )
            connection.commit()
            updated = connection.execute(
                """
                SELECT shop_id, display_name, reach_plan, public_url, map_color, created_at, updated_at
                FROM shops
                WHERE shop_id = ?
                """,
                (shop_id,),
            ).fetchone()
        return self._row_to_dict(updated) if updated is not None else None

    async def create_buyer_account(
        self,
        display_name: str,
        contact: str,
        password: str,
        buyer_key: str,
    ) -> Optional[Dict[str, str]]:
        return await asyncio.to_thread(
            self._create_buyer_account_threadsafe,
            display_name,
            contact,
            password,
            buyer_key,
        )

    def _create_buyer_account_threadsafe(
        self,
        display_name: str,
        contact: str,
        password: str,
        buyer_key: str,
    ) -> Optional[Dict[str, str]]:
        with self._lock:
            return self._create_buyer_account_sync(display_name, contact, password, buyer_key)

    def _create_buyer_account_sync(
        self,
        display_name: str,
        contact: str,
        password: str,
        buyer_key: str,
    ) -> Optional[Dict[str, str]]:
        safe_contact = str(contact or "").strip()[:255]
        contact_key = self._normalize_account_contact_key(safe_contact)
        if not contact_key:
            return None
        safe_name = str(display_name or "").strip()[:160] or safe_contact
        safe_buyer_key = str(buyer_key or "").strip()[:160] or ("buyer-" + uuid.uuid4().hex[:12])
        timestamp = self._utcnow()
        account_id = "acct-" + uuid.uuid4().hex[:16]
        account_token = secrets.token_urlsafe(24)
        password_hash = self._hash_password(password)
        with self._connect() as connection:
            existing = connection.execute(
                "SELECT account_id FROM buyer_accounts WHERE contact_key = ?",
                (contact_key,),
            ).fetchone()
            if existing is not None:
                return None
            connection.execute(
                """
                INSERT INTO buyer_accounts (
                    account_id,
                    display_name,
                    contact,
                    contact_key,
                    password_hash,
                    buyer_key,
                    account_token,
                    created_at,
                    updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    account_id,
                    safe_name,
                    safe_contact,
                    contact_key,
                    password_hash,
                    safe_buyer_key,
                    account_token,
                    timestamp,
                    timestamp,
                ),
            )
            connection.commit()
            row = connection.execute(
                """
                SELECT account_id, display_name, contact, buyer_key, account_token, created_at, updated_at
                FROM buyer_accounts
                WHERE account_id = ?
                """,
                (account_id,),
            ).fetchone()
        return self._buyer_account_row_to_dict(row) if row is not None else None

    async def verify_buyer_account(
        self,
        contact: str,
        password: str,
        buyer_key: str = "",
    ) -> Optional[Dict[str, str]]:
        return await asyncio.to_thread(self._verify_buyer_account_threadsafe, contact, password, buyer_key)

    def _verify_buyer_account_threadsafe(
        self,
        contact: str,
        password: str,
        buyer_key: str,
    ) -> Optional[Dict[str, str]]:
        with self._lock:
            return self._verify_buyer_account_sync(contact, password, buyer_key)

    def _verify_buyer_account_sync(
        self,
        contact: str,
        password: str,
        buyer_key: str,
    ) -> Optional[Dict[str, str]]:
        contact_key = self._normalize_account_contact_key(contact)
        if not contact_key:
            return None
        timestamp = self._utcnow()
        with self._connect() as connection:
            row = connection.execute(
                """
                SELECT account_id, display_name, contact, buyer_key, account_token, password_hash, created_at, updated_at
                FROM buyer_accounts
                WHERE contact_key = ?
                """,
                (contact_key,),
            ).fetchone()
            if row is None:
                return None
            password_hash = str(row["password_hash"] or "").strip()
            if not password_hash or not self._verify_password(password, password_hash):
                return None
            next_buyer_key = str(buyer_key or "").strip()[:160] or str(row["buyer_key"] or "").strip()
            if next_buyer_key and next_buyer_key != str(row["buyer_key"] or "").strip():
                connection.execute(
                    """
                    UPDATE buyer_accounts
                    SET buyer_key = ?, updated_at = ?
                    WHERE account_id = ?
                    """,
                    (next_buyer_key, timestamp, str(row["account_id"])),
                )
                connection.commit()
                row = connection.execute(
                    """
                    SELECT account_id, display_name, contact, buyer_key, account_token, created_at, updated_at
                    FROM buyer_accounts
                    WHERE account_id = ?
                    """,
                    (str(row["account_id"]),),
                ).fetchone()
            else:
                row = connection.execute(
                    """
                    SELECT account_id, display_name, contact, buyer_key, account_token, created_at, updated_at
                    FROM buyer_accounts
                    WHERE account_id = ?
                    """,
                    (str(row["account_id"]),),
                ).fetchone()
        return self._buyer_account_row_to_dict(row) if row is not None else None

    async def create_buyer_password_reset(self, contact: str, ttl_seconds: int = 600) -> Dict[str, Any]:
        safe_ttl = max(60, min(3600, int(ttl_seconds or 600)))
        return await asyncio.to_thread(self._create_buyer_password_reset_threadsafe, contact, safe_ttl)

    def _create_buyer_password_reset_threadsafe(self, contact: str, ttl_seconds: int) -> Dict[str, Any]:
        with self._lock:
            return self._create_buyer_password_reset_sync(contact, ttl_seconds)

    def _create_buyer_password_reset_sync(self, contact: str, ttl_seconds: int) -> Dict[str, Any]:
        now = int(time.time())
        contact_key = self._normalize_account_contact_key(contact)
        if not contact_key:
            return {"ok": False, "error": "contact_required"}
        with self._connect() as connection:
            row = connection.execute(
                """
                SELECT account_id, display_name, contact, buyer_key, account_token, created_at, updated_at
                FROM buyer_accounts
                WHERE contact_key = ?
                """,
                (contact_key,),
            ).fetchone()
            if row is None:
                return {"ok": False, "error": "account_not_found"}
            recent = connection.execute(
                """
                SELECT created_at
                FROM buyer_password_resets
                WHERE contact_key = ? AND used_at = 0 AND created_at >= ?
                ORDER BY created_at DESC
                LIMIT 1
                """,
                (contact_key, now - 60),
            ).fetchone()
            if recent is not None:
                return {"ok": False, "error": "reset_rate_limited", "retry_after": 60}
            connection.execute(
                """
                DELETE FROM buyer_password_resets
                WHERE expires_at < ? OR used_at > 0
                """,
                (now - 86400,),
            )
            reset_code = f"{secrets.randbelow(1000000):06d}"
            reset_id = uuid.uuid4().hex
            expires_at = now + ttl_seconds
            connection.execute(
                """
                INSERT INTO buyer_password_resets (
                    reset_id, contact_key, code_hash, created_at, expires_at, used_at, attempts
                )
                VALUES (?, ?, ?, ?, ?, 0, 0)
                """,
                (
                    reset_id,
                    contact_key,
                    self._hash_password(f"{contact_key}:{reset_code}"),
                    now,
                    expires_at,
                ),
            )
            connection.commit()
        return {
            "ok": True,
            "reset_code": reset_code,
            "expires_at": expires_at,
            "expires_in": ttl_seconds,
            "contact_hint": self._mask_contact(str(row["contact"] or "")),
            "delivery_contact": str(row["contact"] or ""),
            "delivery_method": self._recovery_contact_type(contact_key),
        }

    async def create_buyer_contact_verification(self, contact: str, ttl_seconds: int = 600) -> Dict[str, Any]:
        safe_ttl = max(60, min(3600, int(ttl_seconds or 600)))
        return await asyncio.to_thread(self._create_buyer_contact_verification_threadsafe, contact, safe_ttl)

    def _create_buyer_contact_verification_threadsafe(self, contact: str, ttl_seconds: int) -> Dict[str, Any]:
        with self._lock:
            return self._create_buyer_contact_verification_sync(contact, ttl_seconds)

    def _create_buyer_contact_verification_sync(self, contact: str, ttl_seconds: int) -> Dict[str, Any]:
        now = int(time.time())
        safe_contact = str(contact or "").strip()[:255]
        contact_key = self._normalize_account_contact_key(safe_contact)
        if not contact_key:
            return {"ok": False, "error": "contact_required"}
        with self._connect() as connection:
            recent = connection.execute(
                """
                SELECT created_at
                FROM buyer_contact_verifications
                WHERE contact_key = ? AND used_at = 0 AND created_at >= ?
                ORDER BY created_at DESC
                LIMIT 1
                """,
                (contact_key, now - 60),
            ).fetchone()
            if recent is not None:
                return {"ok": False, "error": "verification_rate_limited", "retry_after": 60}
            connection.execute(
                """
                DELETE FROM buyer_contact_verifications
                WHERE expires_at < ? OR used_at > 0
                """,
                (now - 86400,),
            )
            verification_code = f"{secrets.randbelow(1000000):06d}"
            verification_id = uuid.uuid4().hex
            expires_at = now + ttl_seconds
            connection.execute(
                """
                INSERT INTO buyer_contact_verifications (
                    verification_id, contact, contact_key, code_hash, created_at, expires_at, used_at, attempts
                )
                VALUES (?, ?, ?, ?, ?, ?, 0, 0)
                """,
                (
                    verification_id,
                    safe_contact,
                    contact_key,
                    self._hash_password(f"{contact_key}:{verification_code}"),
                    now,
                    expires_at,
                ),
            )
            connection.commit()
        return {
            "ok": True,
            "reset_code": verification_code,
            "expires_at": expires_at,
            "expires_in": ttl_seconds,
            "contact_hint": self._mask_contact(safe_contact),
            "delivery_contact": safe_contact,
            "delivery_method": self._recovery_contact_type(contact_key),
        }

    async def verify_buyer_contact_code(self, contact: str, verification_code: str) -> Optional[Dict[str, Any]]:
        return await asyncio.to_thread(self._verify_buyer_contact_code_threadsafe, contact, verification_code)

    def _verify_buyer_contact_code_threadsafe(
        self,
        contact: str,
        verification_code: str,
    ) -> Optional[Dict[str, Any]]:
        with self._lock:
            return self._verify_buyer_contact_code_sync(contact, verification_code)

    def _verify_buyer_contact_code_sync(self, contact: str, verification_code: str) -> Optional[Dict[str, Any]]:
        now = int(time.time())
        safe_contact = str(contact or "").strip()[:255]
        code = str(verification_code or "").strip()
        contact_key = self._normalize_account_contact_key(safe_contact)
        if not contact_key or not code:
            return None
        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT verification_id, contact, code_hash
                FROM buyer_contact_verifications
                WHERE contact_key = ? AND used_at = 0 AND expires_at >= ? AND attempts < 5
                ORDER BY created_at DESC
                LIMIT 5
                """,
                (contact_key, now),
            ).fetchall()
            matched_verification_id = ""
            matched_contact = safe_contact
            for row in rows:
                if self._verify_password(f"{contact_key}:{code}", str(row["code_hash"] or "")):
                    matched_verification_id = str(row["verification_id"] or "")
                    matched_contact = str(row["contact"] or safe_contact)
                    break
            if not matched_verification_id:
                connection.execute(
                    """
                    UPDATE buyer_contact_verifications
                    SET attempts = attempts + 1
                    WHERE contact_key = ? AND used_at = 0 AND expires_at >= ?
                    """,
                    (contact_key, now),
                )
                connection.commit()
                return None
            connection.execute(
                """
                UPDATE buyer_contact_verifications
                SET used_at = ?
                WHERE verification_id = ?
                """,
                (now, matched_verification_id),
            )
            connection.commit()
        return {
            "ok": True,
            "contact": matched_contact,
            "contact_key": contact_key,
            "verified_at": now,
        }

    async def reset_buyer_password_with_code(
        self,
        contact: str,
        reset_code: str,
        password: str,
        buyer_key: str = "",
    ) -> Optional[Dict[str, str]]:
        return await asyncio.to_thread(
            self._reset_buyer_password_with_code_threadsafe,
            contact,
            reset_code,
            password,
            buyer_key,
        )

    def _reset_buyer_password_with_code_threadsafe(
        self,
        contact: str,
        reset_code: str,
        password: str,
        buyer_key: str,
    ) -> Optional[Dict[str, str]]:
        with self._lock:
            return self._reset_buyer_password_with_code_sync(contact, reset_code, password, buyer_key)

    def _reset_buyer_password_with_code_sync(
        self,
        contact: str,
        reset_code: str,
        password: str,
        buyer_key: str,
    ) -> Optional[Dict[str, str]]:
        now = int(time.time())
        timestamp = self._utcnow()
        contact_key = self._normalize_account_contact_key(contact)
        if not contact_key:
            return None
        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT reset_id, code_hash
                FROM buyer_password_resets
                WHERE contact_key = ? AND used_at = 0 AND expires_at >= ? AND attempts < 5
                ORDER BY created_at DESC
                LIMIT 5
                """,
                (contact_key, now),
            ).fetchall()
            matched_reset_id = ""
            for row in rows:
                if self._verify_password(f"{contact_key}:{reset_code}", str(row["code_hash"] or "")):
                    matched_reset_id = str(row["reset_id"] or "")
                    break
            if not matched_reset_id:
                connection.execute(
                    """
                    UPDATE buyer_password_resets
                    SET attempts = attempts + 1
                    WHERE contact_key = ? AND used_at = 0 AND expires_at >= ?
                    """,
                    (contact_key, now),
                )
                connection.commit()
                return None
            account_row = connection.execute(
                """
                SELECT account_id, display_name, contact, buyer_key, account_token, created_at, updated_at
                FROM buyer_accounts
                WHERE contact_key = ?
                """,
                (contact_key,),
            ).fetchone()
            if account_row is None:
                return None
            next_buyer_key = str(buyer_key or "").strip()[:160] or str(account_row["buyer_key"] or "").strip()
            connection.execute(
                """
                UPDATE buyer_accounts
                SET password_hash = ?, buyer_key = ?, updated_at = ?
                WHERE account_id = ?
                """,
                (self._hash_password(password), next_buyer_key, timestamp, str(account_row["account_id"])),
            )
            connection.execute(
                """
                UPDATE buyer_password_resets
                SET used_at = ?
                WHERE reset_id = ?
                """,
                (now, matched_reset_id),
            )
            connection.commit()
            updated = connection.execute(
                """
                SELECT account_id, display_name, contact, buyer_key, account_token, created_at, updated_at
                FROM buyer_accounts
                WHERE account_id = ?
                """,
                (str(account_row["account_id"]),),
            ).fetchone()
        return self._buyer_account_row_to_dict(updated) if updated is not None else None

    async def verify_buyer_token(self, account_id: str, account_token: str) -> Optional[Dict[str, str]]:
        return await asyncio.to_thread(self._verify_buyer_token_threadsafe, account_id, account_token)

    def _verify_buyer_token_threadsafe(self, account_id: str, account_token: str) -> Optional[Dict[str, str]]:
        with self._lock:
            return self._verify_buyer_token_sync(account_id, account_token)

    def _verify_buyer_token_sync(self, account_id: str, account_token: str) -> Optional[Dict[str, str]]:
        safe_account_id = str(account_id or "").strip()[:64]
        safe_token = str(account_token or "").strip()[:255]
        if not safe_account_id or not safe_token:
            return None
        with self._connect() as connection:
            row = connection.execute(
                """
                SELECT account_id, display_name, contact, buyer_key, account_token, created_at, updated_at
                FROM buyer_accounts
                WHERE account_id = ?
                """,
                (safe_account_id,),
            ).fetchone()
        if row is None:
            return None
        stored_token = str(row["account_token"] or "").strip()
        if not hmac.compare_digest(stored_token, safe_token):
            return None
        return self._buyer_account_row_to_dict(row)

    async def create_account_help_request(
        self,
        message: str,
        buyer_key: str = "",
        buyer_account_id: str = "",
        name: str = "",
        contact: str = "",
        screen: str = "",
        route: str = "",
        build: str = "",
        user_agent: str = "",
        help_id: str = "",
    ) -> Dict[str, str]:
        return await asyncio.to_thread(
            self._create_account_help_request_threadsafe,
            message,
            buyer_key,
            buyer_account_id,
            name,
            contact,
            screen,
            route,
            build,
            user_agent,
            help_id,
        )

    def _create_account_help_request_threadsafe(
        self,
        message: str,
        buyer_key: str,
        buyer_account_id: str,
        name: str,
        contact: str,
        screen: str,
        route: str,
        build: str,
        user_agent: str,
        help_id: str,
    ) -> Dict[str, str]:
        with self._lock:
            return self._create_account_help_request_sync(
                message,
                buyer_key,
                buyer_account_id,
                name,
                contact,
                screen,
                route,
                build,
                user_agent,
                help_id,
            )

    def _create_account_help_request_sync(
        self,
        message: str,
        buyer_key: str,
        buyer_account_id: str,
        name: str,
        contact: str,
        screen: str,
        route: str,
        build: str,
        user_agent: str,
        help_id: str,
    ) -> Dict[str, str]:
        safe_message = str(message or "").strip()[:1200]
        if not safe_message:
            raise ValueError("message_required")
        safe_help_id = re.sub(r"[^a-zA-Z0-9_.:-]+", "-", str(help_id or "").strip())[:80]
        if not safe_help_id:
            safe_help_id = "help-" + uuid.uuid4().hex[:16]
        timestamp = self._utcnow()
        record = {
            "help_id": safe_help_id,
            "buyer_key": str(buyer_key or "").strip()[:160],
            "buyer_account_id": str(buyer_account_id or "").strip()[:64],
            "name": str(name or "").strip()[:160],
            "contact": str(contact or "").strip()[:255],
            "message": safe_message,
            "screen": str(screen or "").strip()[:80],
            "route": str(route or "").strip()[:160],
            "build": str(build or "").strip()[:80],
            "user_agent": str(user_agent or "").strip()[:400],
            "created_at": timestamp,
        }
        with self._connect() as connection:
            connection.execute(
                """
                INSERT INTO account_help_requests (
                    help_id,
                    buyer_key,
                    buyer_account_id,
                    name,
                    contact,
                    message,
                    screen,
                    route,
                    build,
                    user_agent,
                    created_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(help_id) DO UPDATE SET
                    buyer_key = excluded.buyer_key,
                    buyer_account_id = excluded.buyer_account_id,
                    name = excluded.name,
                    contact = excluded.contact,
                    message = excluded.message,
                    screen = excluded.screen,
                    route = excluded.route,
                    build = excluded.build,
                    user_agent = excluded.user_agent
                """,
                (
                    record["help_id"],
                    record["buyer_key"],
                    record["buyer_account_id"],
                    record["name"],
                    record["contact"],
                    record["message"],
                    record["screen"],
                    record["route"],
                    record["build"],
                    record["user_agent"],
                    record["created_at"],
                ),
            )
            connection.commit()
        return record

    async def list_shops(self, limit: int = 100) -> List[Dict[str, str]]:
        safe_limit = max(1, min(limit, 500))
        return await asyncio.to_thread(self._list_shops_threadsafe, safe_limit)

    def _list_shops_threadsafe(self, limit: int) -> List[Dict[str, str]]:
        with self._lock:
            return self._list_shops_sync(limit)

    def _list_shops_sync(self, limit: int) -> List[Dict[str, str]]:
        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT shop_id, display_name, reach_plan, public_url, map_color, created_at, updated_at
                FROM shops
                ORDER BY updated_at DESC, shop_id ASC
                LIMIT ?
                """,
                (limit,),
            ).fetchall()
        return [self._row_to_dict(row) for row in rows]

    async def list_item_library(self, limit: int = 400) -> List[Dict[str, Any]]:
        safe_limit = max(1, min(limit, 1000))
        return await asyncio.to_thread(self._list_item_library_threadsafe, safe_limit)

    def _list_item_library_threadsafe(self, limit: int) -> List[Dict[str, Any]]:
        with self._lock:
            return self._list_item_library_sync(limit)

    def _list_item_library_sync(self, limit: int) -> List[Dict[str, Any]]:
        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT shop_id, display_name, public_url, map_color, console_json
                FROM shops
                ORDER BY updated_at DESC, shop_id ASC
                LIMIT 400
                """
            ).fetchall()

        items: List[Dict[str, Any]] = []
        for row in rows:
            shop_id = str(row["shop_id"] or "").strip()
            if not shop_id:
                continue
            display_name = str(row["display_name"] or shop_id).strip()[:80] or shop_id
            console_payload = self._normalize_console(
                shop_id=shop_id,
                display_name=display_name,
                public_url=str(row["public_url"] or "").strip(),
                raw_console=row["console_json"] if "console_json" in row.keys() else "{}",
            )
            listings = console_payload.get("listings")
            if not isinstance(listings, list):
                continue
            for item in listings:
                if not isinstance(item, dict):
                    continue
                title = str(item.get("title") or "").strip()[:120]
                if not title:
                    continue
                item_id = str(item.get("id") or "").strip()[:64]
                images_raw = item.get("imageFiles") or []
                image_files: List[str] = []
                if isinstance(images_raw, list):
                    for image in images_raw[:8]:
                        value = str(image).strip()[:255]
                        if value:
                            image_files.append(value)
                items.append(
                    {
                        "libraryId": f"{shop_id}:{item_id or uuid.uuid4().hex[:12]}",
                        "shopId": shop_id,
                        "shopName": display_name,
                        "shopMapColor": self._normalize_map_color(str(row["map_color"] or "")) or "#29c6ea",
                        "id": item_id,
                        "title": title,
                        "description": str(item.get("description") or "").strip()[:4000],
                        "price": str(item.get("price") or "").strip()[:80],
                        "quantity": self._safe_int(item.get("quantity"), minimum=0, maximum=999999),
                        "imageFiles": image_files,
                        "createdAt": self._safe_int(item.get("createdAt"), minimum=0, maximum=9999999999999),
                    }
                )

        items.sort(
            key=lambda item: (
                -int(item.get("createdAt") or 0),
                str(item.get("title") or "").lower(),
                str(item.get("shopId") or ""),
            )
        )
        return items[:limit]

    async def count_shops(self) -> int:
        return await asyncio.to_thread(self._count_shops_threadsafe)

    def _count_shops_threadsafe(self) -> int:
        with self._lock:
            return self._count_shops_sync()

    def _count_shops_sync(self) -> int:
        with self._connect() as connection:
            row = connection.execute("SELECT COUNT(*) AS count FROM shops").fetchone()
        return int(row["count"]) if row is not None else 0

    async def list_orders_for_buyer(
        self,
        buyer_key: str = "",
        buyer_account_id: str = "",
        limit: int = 50,
    ) -> List[Dict[str, Any]]:
        safe_buyer_key = str(buyer_key or "").strip()[:160]
        safe_buyer_account_id = str(buyer_account_id or "").strip()[:64]
        safe_limit = max(1, min(limit, 200))
        if not safe_buyer_key and not safe_buyer_account_id:
            return []
        return await asyncio.to_thread(
            self._list_orders_for_buyer_threadsafe,
            safe_buyer_key,
            safe_buyer_account_id,
            safe_limit,
        )

    def _list_orders_for_buyer_threadsafe(
        self,
        buyer_key: str,
        buyer_account_id: str,
        limit: int,
    ) -> List[Dict[str, Any]]:
        with self._lock:
            return self._list_orders_for_buyer_sync(buyer_key, buyer_account_id, limit)

    def _list_orders_for_buyer_sync(
        self,
        buyer_key: str,
        buyer_account_id: str,
        limit: int,
    ) -> List[Dict[str, Any]]:
        matches: List[Dict[str, Any]] = []
        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT shop_id, display_name, public_url, map_color, console_json
                FROM shops
                ORDER BY updated_at DESC, shop_id ASC
                """
            ).fetchall()

        for row in rows:
            shop_id = str(row["shop_id"] or "").strip()
            if not shop_id:
                continue
            console_payload = self._normalize_console(
                shop_id=shop_id,
                display_name=str(row["display_name"] or "").strip(),
                public_url=str(row["public_url"] or "").strip(),
                raw_console=row["console_json"] if "console_json" in row.keys() else "{}",
            )
            profile = console_payload.get("profile")
            if not isinstance(profile, dict):
                profile = {}
            orders = console_payload.get("orders")
            if not isinstance(orders, list):
                continue
            for order in orders:
                if not isinstance(order, dict):
                    continue
                order_buyer_key = str(order.get("buyerKey") or "").strip()
                order_buyer_account_id = str(order.get("buyerAccountId") or order.get("accountId") or "").strip()
                buyer_key_matches = bool(buyer_key and order_buyer_key == buyer_key)
                account_matches = bool(
                    buyer_account_id
                    and order_buyer_account_id
                    and order_buyer_account_id == buyer_account_id
                )
                if not buyer_key_matches and not account_matches:
                    continue
                items = self._normalize_order_items(order.get("items"))
                order_status = self._normalize_order_status(order.get("status"), order.get("paymentMode"), order)
                status_flags = self._order_status_flags(order, order_status)
                matches.append(
                    {
                        "id": str(order.get("id") or "").strip()[:64],
                        "timestamp": self._safe_int(order.get("timestamp"), minimum=0, maximum=9999999999999),
                        "itemId": str(order.get("itemId") or "").strip()[:64],
                        "title": str(order.get("title") or "").strip()[:160],
                        "quantity": self._safe_int(order.get("quantity"), minimum=0, maximum=999999),
                        "price": str(order.get("price") or "").strip()[:80],
                        "total": str(order.get("total") or "").strip()[:80],
                        "status": order_status,
                        "paymentPaid": status_flags["paymentPaid"],
                        "paymentReceived": status_flags["paymentReceived"],
                        "orderSent": status_flags["orderSent"],
                        "orderReceived": status_flags["orderReceived"],
                        "clientNonce": str(order.get("clientNonce") or "").strip()[:160],
                        "buyerKey": order_buyer_key,
                        "buyerAccountId": order_buyer_account_id[:64],
                        "buyerName": str(order.get("buyerName") or "").strip()[:160],
                        "buyerContact": str(order.get("buyerContact") or "").strip()[:255],
                        "paymentLabel": str(order.get("paymentLabel") or "").strip()[:80],
                        "paymentValue": str(order.get("paymentValue") or "").strip()[:255],
                        "paymentMode": str(order.get("paymentMode") or "").strip()[:80],
                        "fulfillmentMode": str(order.get("fulfillmentMode") or order.get("fulfillment_mode") or "").strip()[:80],
                        "fulfillmentLabel": str(order.get("fulfillmentLabel") or order.get("fulfillment_label") or "").strip()[:80],
                        "deliveryAddress": str(order.get("deliveryAddress") or order.get("delivery_address") or "").strip()[:4000],
                        "pickupAddress": str(order.get("pickupAddress") or order.get("pickup_address") or "").strip()[:4000],
                        "deliveryLat": self._safe_float(order.get("deliveryLat") or order.get("delivery_lat"), minimum=-90, maximum=90),
                        "deliveryLng": self._safe_float(order.get("deliveryLng") or order.get("delivery_lng"), minimum=-180, maximum=180),
                        "pickupLat": self._safe_float(order.get("pickupLat") or order.get("pickup_lat"), minimum=-90, maximum=90),
                        "pickupLng": self._safe_float(order.get("pickupLng") or order.get("pickup_lng"), minimum=-180, maximum=180),
                        "address": str(order.get("address") or "").strip()[:4000],
                        "notes": str(order.get("notes") or "").strip()[:4000],
                        "items": items,
                        "statusUpdatedAt": self._safe_int(order.get("statusUpdatedAt"), minimum=0, maximum=9999999999999),
                        "shopId": shop_id,
                        "shopName": str(row["display_name"] or shop_id).strip()[:80] or shop_id,
                        "shopPublicUrl": str(row["public_url"] or "").strip()[:4000],
                        "shopMapColor": self._normalize_map_color(str(row["map_color"] or "")) or "#29c6ea",
                        "shopLocation": str(profile.get("location") or "").strip()[:255],
                    }
                )

        matches.sort(
            key=lambda item: (
                -int(item.get("timestamp") or 0),
                str(item.get("shopId") or ""),
                str(item.get("id") or ""),
            )
        )
        return matches[:limit]

    def _row_to_console_dict(self, row: sqlite3.Row) -> Dict[str, Any]:
        record = self._row_to_dict(row)
        raw_console = row["console_json"] if "console_json" in row.keys() else "{}"
        record["console"] = self._normalize_console(
            shop_id=str(record["shop_id"]),
            display_name=str(record["display_name"]),
            public_url=str(record["public_url"]),
            raw_console=raw_console,
        )
        return record

    def _legacy_order_status_from_flags(self, order: Any) -> str:
        if not isinstance(order, dict):
            return ""
        if bool(order.get("orderReceived")):
            return "completed"
        if bool(order.get("paymentPaid")) or bool(order.get("paymentReceived")):
            return "paid"
        if bool(order.get("orderSent")):
            return "ready"
        return ""

    def _normalize_order_status(self, status: Any, payment_mode: Any, order: Any = None) -> str:
        raw_status = str(status or "").strip().lower()
        raw_payment_mode = str(payment_mode or "").strip().lower()
        mode = "before_delivery" if raw_payment_mode == "before_delivery" else "on_receive"
        if raw_status in self.ORDER_STATES:
            return raw_status
        legacy_status = self._legacy_order_status_from_flags(order)
        if legacy_status:
            return legacy_status
        if raw_status in {"", "new"}:
            return "payment_pending" if mode == "before_delivery" else "created"
        if raw_status == "pending":
            return "payment_pending" if mode == "before_delivery" else "created"
        return "payment_pending" if mode == "before_delivery" else "created"

    def _order_status_flags(self, order: Any, status: str) -> Dict[str, bool]:
        source = order if isinstance(order, dict) else {}
        payment_mode = str(source.get("paymentMode") or "").strip().lower()
        on_receive = payment_mode != "before_delivery"
        payment_done = bool(source.get("paymentPaid")) or bool(source.get("paymentReceived")) or status in {"paid", "completed"}
        sent = (
            bool(source.get("orderSent"))
            or status in {"ready", "completed"}
            or (on_receive and status == "paid")
        )
        received = bool(source.get("orderReceived")) or status == "completed"
        return {
            "paymentPaid": payment_done,
            "paymentReceived": payment_done,
            "orderSent": sent,
            "orderReceived": received,
        }

    def _normalize_order_items(self, items_raw: Any) -> List[Dict[str, Any]]:
        if not isinstance(items_raw, list):
            return []
        normalized_items: List[Dict[str, Any]] = []
        for item in items_raw[:80]:
            if not isinstance(item, dict):
                continue
            images_raw = item.get("imageFiles") or item.get("images") or []
            image_files: List[str] = []
            if isinstance(images_raw, list):
                for image in images_raw[:8]:
                    value = str(image).strip()[:255]
                    if value:
                        image_files.append(value)
            primary_image = str(item.get("image") or "").strip()[:255]
            if primary_image and primary_image not in image_files:
                image_files.insert(0, primary_image)
            normalized_items.append(
                {
                    "id": str(item.get("id") or "").strip()[:64],
                    "title": str(item.get("title") or "").strip()[:160],
                    "description": str(item.get("description") or "").strip()[:4000],
                    "quantity": self._safe_int(item.get("quantity"), minimum=0, maximum=999999),
                    "price": str(item.get("price") or "").strip()[:80],
                    "image": image_files[0] if image_files else "",
                    "imageFiles": image_files,
                }
            )
        return normalized_items

    def _normalize_console(
        self,
        shop_id: str,
        display_name: str,
        public_url: str,
        raw_console: Any,
    ) -> Dict[str, Any]:
        base = self._default_console(shop_id, display_name, public_url)
        data: Dict[str, Any] = {}
        if isinstance(raw_console, str):
            try:
                parsed = json.loads(raw_console) if raw_console.strip() else {}
            except json.JSONDecodeError:
                parsed = {}
            if isinstance(parsed, dict):
                data = parsed
        elif isinstance(raw_console, dict):
            data = raw_console

        profile = data.get("profile")
        if isinstance(profile, dict):
            for key in base["profile"].keys():
                if key in profile and profile[key] is not None:
                    base["profile"][key] = str(profile[key]).strip()[:4000]
        legacy_gps = ""
        if not str(base["profile"].get("gps") or "").strip():
            legacy_gps = self._extract_gps(base["profile"].get("location") or "")
            if legacy_gps and self.GPS_PATTERN.search(str(base["profile"].get("location") or "")):
                base["profile"]["location"] = self._strip_gps_tag(base["profile"].get("location") or "")
        base["profile"]["gps"] = self._normalize_gps(str(base["profile"].get("gps") or legacy_gps))
        if not base["profile"].get("name"):
            base["profile"]["name"] = display_name or shop_id
        base["profile"]["name"] = str(base["profile"]["name"]).strip()[:80] or shop_id

        listings = data.get("listings")
        if isinstance(listings, list):
            normalized_listings: List[Dict[str, Any]] = []
            for item in listings[:200]:
                if not isinstance(item, dict):
                    continue
                title = str(item.get("title") or "").strip()[:120]
                item_id = str(item.get("id") or uuid.uuid4().hex[:12]).strip()[:64]
                images_raw = item.get("imageFiles") or item.get("images") or []
                images: List[str] = []
                if isinstance(images_raw, list):
                    for image in images_raw[:8]:
                        value = str(image).strip()[:255]
                        if value:
                            images.append(value)
                normalized_listings.append(
                    {
                        "id": item_id or uuid.uuid4().hex[:12],
                        "title": title,
                        "description": str(item.get("description") or "").strip()[:4000],
                        "price": str(item.get("price") or "").strip()[:80],
                        "quantity": self._safe_int(item.get("quantity"), minimum=0, maximum=999999),
                        "imageFiles": images,
                        "createdAt": self._safe_int(item.get("createdAt"), minimum=0, maximum=9999999999999),
                    }
                )
            base["listings"] = normalized_listings

        payments = data.get("payments")
        if isinstance(payments, list):
            normalized_payments: List[Dict[str, Any]] = []
            for payment in payments[:80]:
                if not isinstance(payment, dict):
                    continue
                normalized_payments.append(
                    {
                        "id": str(payment.get("id") or uuid.uuid4().hex[:12]).strip()[:64],
                        "label": str(payment.get("label") or "").strip()[:120],
                        "details": str(payment.get("details") or "").strip()[:4000],
                        "upiId": str(payment.get("upiId") or "").strip()[:255],
                        "btcAddress": str(payment.get("btcAddress") or "").strip()[:255],
                        "ethAddress": str(payment.get("ethAddress") or "").strip()[:255],
                        "createdAt": self._safe_int(payment.get("createdAt"), minimum=0, maximum=9999999999999),
                    }
                )
            base["payments"] = normalized_payments

        orders = data.get("orders")
        if isinstance(orders, list):
            normalized_orders: List[Dict[str, Any]] = []
            for order in orders[:400]:
                if not isinstance(order, dict):
                    continue
                normalized_items = self._normalize_order_items(order.get("items"))
                order_status = self._normalize_order_status(order.get("status"), order.get("paymentMode"), order)
                status_flags = self._order_status_flags(order, order_status)
                normalized_orders.append(
                    {
                        "id": str(order.get("id") or uuid.uuid4().hex[:12]).strip()[:64],
                        "timestamp": self._safe_int(order.get("timestamp"), minimum=0, maximum=9999999999999),
                        "itemId": str(order.get("itemId") or "").strip()[:64],
                        "title": str(order.get("title") or "").strip()[:160],
                        "quantity": self._safe_int(order.get("quantity"), minimum=0, maximum=999999),
                        "price": str(order.get("price") or "").strip()[:80],
                        "total": str(order.get("total") or "").strip()[:80],
                        "status": order_status,
                        "paymentPaid": status_flags["paymentPaid"],
                        "paymentReceived": status_flags["paymentReceived"],
                        "orderSent": status_flags["orderSent"],
                        "orderReceived": status_flags["orderReceived"],
                        "clientNonce": str(order.get("clientNonce") or "").strip()[:160],
                        "buyerKey": str(order.get("buyerKey") or "").strip()[:160],
                        "buyerAccountId": str(order.get("buyerAccountId") or order.get("accountId") or "").strip()[:64],
                        "buyerName": str(order.get("buyerName") or "").strip()[:160],
                        "buyerContact": str(order.get("buyerContact") or "").strip()[:255],
                        "paymentLabel": str(order.get("paymentLabel") or "").strip()[:80],
                        "paymentValue": str(order.get("paymentValue") or "").strip()[:255],
                        "paymentMode": str(order.get("paymentMode") or "").strip()[:80],
                        "address": str(order.get("address") or "").strip()[:4000],
                        "notes": str(order.get("notes") or "").strip()[:4000],
                        "items": normalized_items,
                        "statusUpdatedAt": self._safe_int(order.get("statusUpdatedAt"), minimum=0, maximum=9999999999999),
                    }
                )
            base["orders"] = normalized_orders

        share = data.get("share")
        if isinstance(share, dict):
            for key in ("mode", "domain", "hubBaseUrl", "publicUrl"):
                if key in share and share[key] is not None:
                    base["share"][key] = str(share[key]).strip()[:4000]
        base["share"]["publicUrl"] = public_url

        billing = data.get("billing")
        if isinstance(billing, dict):
            raw_map_unlock = billing.get("mapUnlock")
            if isinstance(raw_map_unlock, dict):
                requested_plan = str(
                    raw_map_unlock.get("requestedPlan")
                    or base["billing"]["mapUnlock"]["requestedPlan"]
                ).strip().lower()
                if requested_plan not in {"free", "map"}:
                    requested_plan = "free"
                method = str(raw_map_unlock.get("method") or "").strip().lower()
                if method not in self.VALID_MAP_UNLOCK_METHODS:
                    method = ""
                reference = str(raw_map_unlock.get("reference") or "").strip()[:160]
                note = str(raw_map_unlock.get("note") or "").strip()[:4000]
                status = str(raw_map_unlock.get("status") or "").strip().lower()
                if requested_plan != "map":
                    status = "not_required"
                    method = ""
                    reference = ""
                    note = ""
                elif status not in self.VALID_MAP_UNLOCK_STATUSES - {"not_required"}:
                    status = "pending" if (method or reference or note) else "locked"
                base["billing"]["mapUnlock"] = {
                    "requestedPlan": requested_plan,
                    "status": status,
                    "method": method,
                    "reference": reference,
                    "note": note,
                    "updatedAt": self._safe_int(
                        raw_map_unlock.get("updatedAt"),
                        minimum=0,
                        maximum=9999999999999,
                    ),
                }
        return base

    def _default_console(self, shop_id: str, display_name: str, public_url: str) -> Dict[str, Any]:
        parsed_public_url = urlsplit(public_url)
        if parsed_public_url.scheme and parsed_public_url.netloc:
            hub_base_url = f"{parsed_public_url.scheme}://{parsed_public_url.netloc}"
        else:
            hub_base_url = ""
        return {
            "profile": {
                "name": display_name or shop_id,
                "type": "Store",
                "contact": "",
                "location": "",
                "gps": "",
                "hours": "",
                "notes": "",
                "currencyPrefix": "",
                "currencySuffix": "",
                "currencyDecimals": "",
                "logoFile": "",
            },
            "listings": [],
            "payments": [],
            "orders": [],
            "share": {
                "mode": "cloud",
                "domain": "",
                "hubBaseUrl": hub_base_url,
                "publicUrl": public_url,
            },
            "billing": {
                "mapUnlock": {
                    "requestedPlan": "free",
                    "status": "not_required",
                    "method": "",
                    "reference": "",
                    "note": "",
                    "updatedAt": 0,
                }
            },
        }

    @staticmethod
    def _safe_int(value: Any, minimum: int, maximum: int) -> int:
        try:
            parsed = int(value)
        except (TypeError, ValueError):
            return minimum
        return max(minimum, min(maximum, parsed))

    @staticmethod
    def _safe_float(value: Any, minimum: float, maximum: float) -> Optional[float]:
        try:
            parsed = float(value)
        except (TypeError, ValueError):
            return None
        if not math.isfinite(parsed):
            return None
        return max(minimum, min(maximum, parsed))

    @classmethod
    def _extract_gps(cls, value: str) -> str:
        text = str(value or "").strip()
        tagged = cls.GPS_PATTERN.search(text)
        if tagged:
            return f"{float(tagged.group(1)):.6f},{float(tagged.group(2)):.6f}"
        direct = cls.GPS_COORDS_PATTERN.match(text)
        if direct:
            return f"{float(direct.group(1)):.6f},{float(direct.group(2)):.6f}"
        return ""

    @classmethod
    def _strip_gps_tag(cls, value: str) -> str:
        text = str(value or "")
        text = cls.GPS_PATTERN.sub("", text)
        text = re.sub(r"\s*\|\s*\|", " | ", text)
        text = re.sub(r"\s+\|\s*$", "", text)
        text = re.sub(r"^\s*\|\s+", "", text)
        return re.sub(r"\s{2,}", " ", text).strip()

    @classmethod
    def _normalize_gps(cls, value: str) -> str:
        extracted = cls._extract_gps(value)
        return extracted[:64]

    @staticmethod
    def _row_to_dict(row: sqlite3.Row) -> Dict[str, str]:
        return {
            "shop_id": str(row["shop_id"]),
            "display_name": str(row["display_name"]),
            "reach_plan": str(row["reach_plan"]),
            "public_url": str(row["public_url"]),
            "map_color": ShopStore._normalize_map_color(str(row["map_color"])) if "map_color" in row.keys() else "#ffffff",
            "created_at": str(row["created_at"]),
            "updated_at": str(row["updated_at"]),
        }

    @staticmethod
    def _buyer_account_row_to_dict(row: sqlite3.Row) -> Dict[str, str]:
        return {
            "account_id": str(row["account_id"]),
            "display_name": str(row["display_name"]),
            "contact": str(row["contact"]),
            "buyer_key": str(row["buyer_key"]),
            "account_token": str(row["account_token"]),
            "created_at": str(row["created_at"]),
            "updated_at": str(row["updated_at"]),
        }

    async def record_account_auth_attempt(
        self,
        scope: str,
        contact: str = "",
        client_key: str = "",
        contact_limit: int = 0,
        client_limit: int = 0,
        window_seconds: int = 900,
    ) -> Dict[str, Any]:
        return await asyncio.to_thread(
            self._record_account_auth_attempt_threadsafe,
            scope,
            contact,
            client_key,
            contact_limit,
            client_limit,
            window_seconds,
        )

    def _record_account_auth_attempt_threadsafe(
        self,
        scope: str,
        contact: str,
        client_key: str,
        contact_limit: int,
        client_limit: int,
        window_seconds: int,
    ) -> Dict[str, Any]:
        with self._lock:
            return self._record_account_auth_attempt_sync(
                scope,
                contact,
                client_key,
                contact_limit,
                client_limit,
                window_seconds,
            )

    def _record_account_auth_attempt_sync(
        self,
        scope: str,
        contact: str,
        client_key: str,
        contact_limit: int,
        client_limit: int,
        window_seconds: int,
    ) -> Dict[str, Any]:
        safe_scope = re.sub(r"[^a-z0-9_.:-]+", "_", str(scope or "").strip().lower())[:64].strip("_")
        if not safe_scope:
            return {"ok": True}
        safe_window = max(1, min(86400, int(window_seconds or 900)))
        safe_contact_limit = max(0, int(contact_limit or 0))
        safe_client_limit = max(0, int(client_limit or 0))
        contact_key = self._normalize_account_contact_key(contact)
        safe_client_key = self._normalize_rate_client_key(client_key)
        now = int(time.time())
        floor = now - safe_window

        with self._connect() as connection:
            connection.execute(
                """
                DELETE FROM account_auth_events
                WHERE created_at < ?
                """,
                (now - 172800,),
            )
            if contact_key and safe_contact_limit:
                contact_row = connection.execute(
                    """
                    SELECT COUNT(*) AS event_count, MIN(created_at) AS first_created
                    FROM account_auth_events
                    WHERE scope = ? AND contact_key = ? AND created_at >= ?
                    """,
                    (safe_scope, contact_key, floor),
                ).fetchone()
                contact_count = int(contact_row["event_count"] or 0) if contact_row is not None else 0
                if contact_count >= safe_contact_limit:
                    first_created = int(contact_row["first_created"] or now) if contact_row is not None else now
                    return {
                        "ok": False,
                        "error": "auth_rate_limited",
                        "scope": safe_scope,
                        "limit": "contact",
                        "retry_after": max(1, first_created + safe_window - now),
                    }
            if safe_client_key and safe_client_limit:
                client_row = connection.execute(
                    """
                    SELECT COUNT(*) AS event_count, MIN(created_at) AS first_created
                    FROM account_auth_events
                    WHERE scope = ? AND client_key = ? AND created_at >= ?
                    """,
                    (safe_scope, safe_client_key, floor),
                ).fetchone()
                client_count = int(client_row["event_count"] or 0) if client_row is not None else 0
                if client_count >= safe_client_limit:
                    first_created = int(client_row["first_created"] or now) if client_row is not None else now
                    return {
                        "ok": False,
                        "error": "auth_rate_limited",
                        "scope": safe_scope,
                        "limit": "client",
                        "retry_after": max(1, first_created + safe_window - now),
                    }
            connection.execute(
                """
                INSERT INTO account_auth_events (
                    event_id,
                    scope,
                    contact_key,
                    client_key,
                    created_at
                )
                VALUES (?, ?, ?, ?, ?)
                """,
                (uuid.uuid4().hex, safe_scope, contact_key, safe_client_key, now),
            )
            connection.commit()
        return {"ok": True}

    @staticmethod
    def _normalize_account_contact_key(value: str) -> str:
        text = re.sub(r"\s+", " ", str(value or "").strip().lower())[:255]
        if not text:
            return ""
        if "@" in text:
            return "email:" + re.sub(r"\s+", "", text)[:255]
        digits = re.sub(r"\D+", "", text)
        if len(digits) >= 6:
            return "phone:" + digits[:32]
        return "text:" + text

    @staticmethod
    def _normalize_rate_client_key(value: str) -> str:
        text = str(value or "").strip().lower()[:160]
        if not text:
            return ""
        return re.sub(r"[^a-z0-9:._-]+", "_", text)[:120].strip("_")

    @classmethod
    def _normalize_map_color(cls, value: str) -> str:
        text = str(value or "").strip().lower()
        if re.fullmatch(r"#[0-9a-f]{6}", text):
            return text
        return ""

    @classmethod
    def _next_map_color(cls, connection: sqlite3.Connection) -> str:
        used_colors = {
            cls._normalize_map_color(str(row["map_color"]))
            for row in connection.execute("SELECT map_color FROM shops").fetchall()
        }
        for color in cls.MAP_COLOR_PALETTE:
            if color not in used_colors:
                return color
        overflow_index = max(0, len(used_colors) - len(cls.MAP_COLOR_PALETTE))
        return cls._overflow_map_color(overflow_index)

    @staticmethod
    def _overflow_map_color(index: int) -> str:
        hue = (index * 47) % 360
        saturation = 72
        lightness = 64
        return ShopStore._hsl_to_hex(hue, saturation, lightness)

    @staticmethod
    def _hsl_to_hex(hue: int, saturation: int, lightness: int) -> str:
        s = max(0.0, min(1.0, saturation / 100.0))
        l = max(0.0, min(1.0, lightness / 100.0))
        c = (1 - abs(2 * l - 1)) * s
        h = (hue % 360) / 60.0
        x = c * (1 - abs(h % 2 - 1))
        if 0 <= h < 1:
            r1, g1, b1 = c, x, 0
        elif 1 <= h < 2:
            r1, g1, b1 = x, c, 0
        elif 2 <= h < 3:
            r1, g1, b1 = 0, c, x
        elif 3 <= h < 4:
            r1, g1, b1 = 0, x, c
        elif 4 <= h < 5:
            r1, g1, b1 = x, 0, c
        else:
            r1, g1, b1 = c, 0, x
        m = l - c / 2
        red = round((r1 + m) * 255)
        green = round((g1 + m) * 255)
        blue = round((b1 + m) * 255)
        return f"#{red:02x}{green:02x}{blue:02x}"

    @staticmethod
    def _utcnow() -> str:
        return datetime.now(timezone.utc).isoformat()

    @staticmethod
    def _hash_password(password: str) -> str:
        salt = secrets.token_bytes(16)
        derived = hashlib.scrypt(
            password.encode("utf-8"),
            salt=salt,
            n=2**14,
            r=8,
            p=1,
            dklen=32,
        )
        return "scrypt$" + base64.b64encode(salt).decode("ascii") + "$" + base64.b64encode(derived).decode("ascii")

    @staticmethod
    def _verify_password(password: str, stored: str) -> bool:
        try:
            algorithm, salt_b64, digest_b64 = stored.split("$", 2)
            if algorithm != "scrypt":
                return False
            salt = base64.b64decode(salt_b64.encode("ascii"))
            expected = base64.b64decode(digest_b64.encode("ascii"))
        except Exception:
            return False
        actual = hashlib.scrypt(
            password.encode("utf-8"),
            salt=salt,
            n=2**14,
            r=8,
            p=1,
            dklen=len(expected),
        )
        return hmac.compare_digest(actual, expected)

    @staticmethod
    def _reset_contact_key(contact: str) -> str:
        value = str(contact or "").strip().lower()
        if not value:
            return ""
        if "@" in value:
            return "email:" + re.sub(r"\s+", "", value)[:255]
        digits = re.sub(r"\D+", "", value)
        if len(digits) >= 6:
            return "phone:" + digits[-10:]
        return "text:" + re.sub(r"\s+", "", value)

    @staticmethod
    def _mask_contact(contact: str) -> str:
        value = str(contact or "").strip()
        if not value:
            return ""
        if "@" in value:
            local, _, domain = value.partition("@")
            visible = local[:2] if len(local) > 2 else local[:1]
            return f"{visible}••@{domain}" if domain else f"{visible}••"
        digits = re.sub(r"\D+", "", value)
        if len(digits) >= 6:
            visible = digits[-4:]
            return "••••" + visible
        if len(value) <= 4:
            return value[0] + "••" if value else ""
        return value[:2] + "•••" + value[-2:]


class HashopHub:
    SHOP_ID_PATTERN = re.compile(r"[^a-z0-9]+")
    VALID_REACH_PLANS = {"free", "map"}
    DISCOVERY_RESERVED_SEGMENTS = {
        "account",
        "api",
        "cloud",
        "cloud-debug",
        "debug-dropdown",
        "hashop",
        "hashop-debug",
        "healthz",
        "home-debug",
        "login",
        "login-debug",
        "orders",
        "setup",
        "shop",
        "shop-debug",
        "site",
    }
    WALLET_METHOD_META = {
        "upi": {
            "label": "UPI",
            "fee_display": "Rs 1000",
            "reference_label": "UTR / note",
            "reference_placeholder": "UTR or payment note",
            "instruction": "Send Rs 1000 to this UPI ID for one Hashop discovery spot, then paste the UTR or note below.",
        },
        "btc": {
            "label": "Bitcoin",
            "fee_display": "$10 of BTC",
            "reference_label": "Tx hash / note",
            "reference_placeholder": "Bitcoin tx hash or note",
            "instruction": "Send $10 worth of BTC to this Bitcoin address for one Hashop discovery spot, then paste the tx hash or note below.",
        },
        "eth": {
            "label": "Ethereum",
            "fee_display": "$10 of ETH",
            "reference_label": "Tx hash / note",
            "reference_placeholder": "Ethereum tx hash or note",
            "instruction": "Send $10 worth of ETH to this Ethereum address for one Hashop discovery spot, then paste the tx hash or note below.",
        },
    }

    def __init__(
        self,
        public_base_url: str,
        request_timeout: float,
        site_dir: Path,
        store: ShopStore,
        uploads_dir: Path,
        public_shop_create_enabled: bool = True,
        owner_reset_code: str = "",
        smtp_config: Optional[SmtpConfig] = None,
        expose_reset_codes: Optional[bool] = None,
    ) -> None:
        self.public_base_url = public_base_url.rstrip("/")
        if self.public_base_url.startswith("https://"):
            self.ws_base_url = "wss://" + self.public_base_url[len("https://"):]
        elif self.public_base_url.startswith("http://"):
            self.ws_base_url = "ws://" + self.public_base_url[len("http://"):]
        else:
            raise ValueError("public_base_url must start with http:// or https://")
        self.request_timeout = request_timeout
        self.site_dir = site_dir
        self.store = store
        self.uploads_dir = uploads_dir
        self.public_shop_create_enabled = bool(public_shop_create_enabled)
        self.owner_reset_code = str(owner_reset_code or "").strip()
        self.smtp_config = smtp_config or SmtpConfig.from_env()
        self.expose_reset_codes = (
            bool(expose_reset_codes)
            if expose_reset_codes is not None
            else env_flag("HASHOP_EXPOSE_RESET_CODES", not self.smtp_config.configured)
        )
        self.debug_codex_bridge_url = str(os.environ.get("HASHOP_DEBUG_CODEX_BRIDGE_URL") or "").strip().rstrip("/")
        self.debug_codex_token = str(os.environ.get("HASHOP_DEBUG_CODEX_TOKEN") or "").strip()
        self.uploads_dir.mkdir(parents=True, exist_ok=True)
        self.sessions: Dict[str, TunnelSession] = {}
        self.pending: Dict[str, asyncio.Future] = {}
        self.wallet_paths = self._wallet_candidate_paths(site_dir)
        self._wallet_cache_key: Tuple[Tuple[str, int, int], ...] = ()
        self._wallet_cache: Dict[str, str] = {}

    def meta_payload(self) -> Dict[str, object]:
        return {
            "service": "hashop",
            "public_base_url": self.public_base_url,
            "connected_shops": sorted(self.sessions.keys()),
            "shop_count": len(self.sessions),
        }

    @staticmethod
    def _request_client_key(request: web.Request) -> str:
        for header_name in ("CF-Connecting-IP", "X-Real-IP", "X-Forwarded-For"):
            raw_value = str(request.headers.get(header_name) or "").strip()
            if not raw_value:
                continue
            return raw_value.split(",", 1)[0].strip()[:160]
        remote = str(request.remote or "").strip()
        if remote:
            return remote[:160]
        peername = request.transport.get_extra_info("peername") if request.transport else None
        if isinstance(peername, tuple) and peername:
            return str(peername[0] or "").strip()[:160]
        return "unknown"

    async def _auth_guard_response(
        self,
        request: web.Request,
        *,
        scope: str,
        contact: str = "",
        contact_limit: int = 0,
        client_limit: int = 0,
        window_seconds: int = 900,
    ) -> Optional[web.Response]:
        guard = await self.store.record_account_auth_attempt(
            scope=scope,
            contact=contact,
            client_key=self._request_client_key(request),
            contact_limit=contact_limit,
            client_limit=client_limit,
            window_seconds=window_seconds,
        )
        if guard.get("ok"):
            return None
        return web.json_response(
            guard,
            status=429,
            headers={"Cache-Control": "no-store"},
        )

    @staticmethod
    def _wallet_candidate_paths(site_dir: Path) -> List[Path]:
        bases = [Path.cwd(), site_dir.parent.parent, site_dir.parent, site_dir, Path.home()]
        unique_bases: List[Path] = []
        for base in bases:
            try:
                resolved = base.resolve()
            except Exception:
                resolved = base
            if resolved not in unique_bases:
                unique_bases.append(resolved)
        candidates: List[Path] = []
        for base in unique_bases:
            for name in (".wallet", ".wallets"):
                candidate = base / name
                if candidate not in candidates:
                    candidates.append(candidate)
        return candidates

    def _wallet_state(self) -> Tuple[Tuple[str, int, int], ...]:
        state: List[Tuple[str, int, int]] = []
        for path in self.wallet_paths:
            try:
                stat = path.stat()
            except FileNotFoundError:
                continue
            except OSError:
                continue
            state.append((str(path), int(stat.st_mtime_ns), int(stat.st_size)))
        return tuple(state)

    def _load_wallets(self) -> Dict[str, str]:
        state = self._wallet_state()
        if state == self._wallet_cache_key:
            return dict(self._wallet_cache)

        wallets: Dict[str, str] = {}
        for path in self.wallet_paths:
            try:
                content = path.read_text(encoding="utf-8")
            except FileNotFoundError:
                continue
            except OSError:
                continue
            for raw_line in content.splitlines():
                line = raw_line.split("#", 1)[0].strip()
                if not line or "=" not in line:
                    continue
                raw_key, raw_value = line.split("=", 1)
                key = str(raw_key).strip().lower()
                value = str(raw_value).strip()
                if key in self.WALLET_METHOD_META and value:
                    wallets[key] = value

        self._wallet_cache_key = state
        self._wallet_cache = dict(wallets)
        return dict(wallets)

    def payment_options_payload(self) -> Dict[str, object]:
        wallets = self._load_wallets()
        methods: List[Dict[str, str]] = []
        for key, meta in self.WALLET_METHOD_META.items():
            address = wallets.get(key, "").strip()
            if not address:
                continue
            methods.append(
                {
                    "key": key,
                    "label": str(meta["label"]),
                    "feeDisplay": str(meta["fee_display"]),
                    "address": address,
                    "referenceLabel": str(meta["reference_label"]),
                    "referencePlaceholder": str(meta["reference_placeholder"]),
                    "instruction": str(meta["instruction"]),
                }
            )
        return {
            "product": "discovery_spot",
            "pricing": "one_time",
            "available": bool(methods),
            "methods": methods,
        }

    def _reset_email_subject(self, purpose: str) -> str:
        if purpose == "verify":
            return "Hashop verification code"
        if purpose == "buyer":
            return "Hashop account reset code"
        return "Hashop shop reset code"

    def _reset_email_body(
        self,
        purpose: str,
        reset_code: str,
        expires_in: int,
        shop_id: str = "",
        shop_name: str = "",
    ) -> str:
        minutes = max(1, int(expires_in or 600) // 60)
        if purpose == "verify":
            return "\n".join([
                f"Your Hashop verification code is {reset_code}.",
                f"It expires in {minutes} minutes.",
                "",
                "If you did not request this, ignore this email.",
                "Hashop",
            ])
        lines = [
            f"Your Hashop reset code is {reset_code}.",
            f"It expires in {minutes} minutes.",
        ]
        if purpose == "shop":
            lines.insert(1, f"Shop: {shop_name or shop_id or 'Hashop shop'}")
        lines.extend([
            "",
            "If you did not request this, ignore this email.",
            "Hashop",
        ])
        return "\n".join(lines)

    async def _send_reset_email(
        self,
        *,
        to_address: str,
        purpose: str,
        reset_code: str,
        expires_in: int,
        shop_id: str = "",
        shop_name: str = "",
    ) -> None:
        await asyncio.to_thread(
            self._send_reset_email_sync,
            to_address,
            purpose,
            reset_code,
            expires_in,
            shop_id,
            shop_name,
        )

    def _send_reset_email_sync(
        self,
        to_address: str,
        purpose: str,
        reset_code: str,
        expires_in: int,
        shop_id: str,
        shop_name: str,
    ) -> None:
        config = self.smtp_config
        if not config.configured:
            raise RuntimeError("smtp_not_configured")
        message = EmailMessage()
        message["Subject"] = self._reset_email_subject(purpose)
        message["From"] = formataddr((config.sender_name, config.sender))
        message["To"] = to_address
        message.set_content(
            self._reset_email_body(
                purpose=purpose,
                reset_code=reset_code,
                expires_in=expires_in,
                shop_id=shop_id,
                shop_name=shop_name,
            )
        )
        security = str(config.security or "starttls").strip().lower()
        context = ssl.create_default_context()
        if security in {"ssl", "tls", "smtps"}:
            with smtplib.SMTP_SSL(config.host, config.port, timeout=config.timeout, context=context) as smtp:
                smtp.login(config.username, config.password)
                smtp.send_message(message)
            return
        with smtplib.SMTP(config.host, config.port, timeout=config.timeout) as smtp:
            if security not in {"none", "plain", "off"}:
                smtp.starttls(context=context)
            smtp.login(config.username, config.password)
            smtp.send_message(message)

    @staticmethod
    def _email_address_from_contact(value: str) -> str:
        text = str(value or "").strip()
        if "@" not in text:
            return ""
        return re.sub(r"\s+", "", text)[:255]

    @staticmethod
    def _order_email_subject(order: Dict[str, Any], target: str) -> str:
        mode = str(order.get("fulfillmentMode") or "").strip().lower()
        if target == "seller":
            return "Hashop delivery order"
        if mode == "pickup":
            return "Hashop pickup order"
        return "Hashop order update"

    @staticmethod
    def _order_email_body(order: Dict[str, Any], target: str, shop_name: str) -> str:
        mode = str(order.get("fulfillmentMode") or "").strip().lower()
        title = str(order.get("title") or "Order").strip()
        total = str(order.get("total") or order.get("price") or "").strip()
        buyer = str(order.get("buyerName") or order.get("buyerContact") or "Buyer").strip()
        if target == "seller":
            destination = str(order.get("deliveryAddress") or order.get("address") or "").strip()
            return "\n".join([
                f"New delivery order for {shop_name or 'your Hashop shop'}.",
                f"Order: {title}",
                f"Buyer: {buyer}",
                f"Total: {total or '-'}",
                f"Deliver to: {destination or 'Delivery address not set'}",
                "",
                "Use the Hashop map frame for the delivery cue when available.",
                "Hashop",
            ])
        if mode == "pickup":
            pickup = str(order.get("pickupAddress") or order.get("address") or "").strip()
            return "\n".join([
                f"Your pickup order at {shop_name or 'Hashop'} is saved.",
                f"Order: {title}",
                f"Total: {total or '-'}",
                f"Pickup: {pickup or 'Shop pickup point'}",
                "",
                "Use the Hashop map frame for the pickup cue when available.",
                "Hashop",
            ])
        return "\n".join([
            f"Your Hashop order at {shop_name or 'the shop'} is saved.",
            f"Order: {title}",
            f"Total: {total or '-'}",
            "",
            "Hashop",
        ])

    async def _send_order_email(
        self,
        *,
        to_address: str,
        order: Dict[str, Any],
        target: str,
        shop_name: str,
    ) -> bool:
        if not self.smtp_config.configured:
            return False
        safe_to = self._email_address_from_contact(to_address)
        if not safe_to:
            return False
        await asyncio.to_thread(self._send_order_email_sync, safe_to, order, target, shop_name)
        return True

    def _send_order_email_sync(
        self,
        to_address: str,
        order: Dict[str, Any],
        target: str,
        shop_name: str,
    ) -> None:
        config = self.smtp_config
        if not config.configured:
            raise RuntimeError("smtp_not_configured")
        message = EmailMessage()
        message["Subject"] = self._order_email_subject(order, target)
        message["From"] = formataddr((config.sender_name, config.sender))
        message["To"] = to_address
        message.set_content(self._order_email_body(order, target, shop_name))
        security = str(config.security or "starttls").strip().lower()
        context = ssl.create_default_context()
        if security in {"ssl", "tls", "smtps"}:
            with smtplib.SMTP_SSL(config.host, config.port, timeout=config.timeout, context=context) as smtp:
                smtp.login(config.username, config.password)
                smtp.send_message(message)
            return
        with smtplib.SMTP(config.host, config.port, timeout=config.timeout) as smtp:
            if security not in {"none", "plain", "off"}:
                smtp.starttls(context=context)
            smtp.login(config.username, config.password)
            smtp.send_message(message)

    async def _password_reset_response(
        self,
        result: Dict[str, Any],
        *,
        purpose: str,
    ) -> web.Response:
        payload = dict(result)
        reset_code = str(payload.pop("reset_code", "")).strip()
        delivery_contact = str(payload.pop("delivery_contact", "")).strip()
        delivery_method = str(payload.pop("delivery_method", "")).strip()
        sent = False
        if delivery_method == "email" and delivery_contact:
            if self.smtp_config.configured:
                try:
                    shop = payload.get("shop") if isinstance(payload.get("shop"), dict) else {}
                    await self._send_reset_email(
                        to_address=delivery_contact,
                        purpose=purpose,
                        reset_code=reset_code,
                        expires_in=int(payload.get("expires_in") or 600),
                        shop_id=str(shop.get("shop_id") or ""),
                        shop_name=str(shop.get("display_name") or ""),
                    )
                    sent = True
                except Exception:
                    return web.json_response(
                        {"ok": False, "error": "email_delivery_failed"},
                        status=502,
                        headers={"Cache-Control": "no-store"},
                    )
            elif not self.expose_reset_codes:
                return web.json_response(
                    {"ok": False, "error": "smtp_not_configured"},
                    status=503,
                    headers={"Cache-Control": "no-store"},
                )
        elif not self.expose_reset_codes:
            return web.json_response(
                {"ok": False, "error": "delivery_not_configured"},
                status=503,
                headers={"Cache-Control": "no-store"},
            )
        if self.expose_reset_codes:
            payload["reset_code"] = reset_code
        payload["delivery"] = {
            "method": delivery_method or "manual",
            "sent": sent,
            "hint": str(payload.get("contact_hint") or ""),
        }
        return web.json_response(payload, headers={"Cache-Control": "no-store"})

    @staticmethod
    def _buyer_account_payload(account: Dict[str, str]) -> Dict[str, object]:
        return {
            "accountId": str(account.get("account_id") or "").strip(),
            "displayName": str(account.get("display_name") or "").strip(),
            "contact": str(account.get("contact") or "").strip(),
            "buyerKey": str(account.get("buyer_key") or "").strip(),
            "accountToken": str(account.get("account_token") or "").strip(),
            "roles": ["buyer"],
        }

    @staticmethod
    def _empty_map_unlock() -> Dict[str, object]:
        return {
            "requestedPlan": "free",
            "status": "not_required",
            "method": "",
            "reference": "",
            "note": "",
            "updatedAt": 0,
        }

    @staticmethod
    def _effective_reach_plan(map_unlock: Dict[str, object]) -> str:
        if (
            str(map_unlock.get("requestedPlan") or "").strip().lower() == "map"
            and str(map_unlock.get("status") or "").strip().lower() == "unlocked"
        ):
            return "map"
        return "free"

    def _resolve_map_unlock(
        self,
        existing_console: Optional[Dict[str, Any]],
        requested_plan: str,
        raw_unlock: Any,
    ) -> Dict[str, object]:
        current = self._empty_map_unlock()
        if isinstance(existing_console, dict):
            existing_billing = existing_console.get("billing")
            if isinstance(existing_billing, dict):
                current_raw = existing_billing.get("mapUnlock")
                if isinstance(current_raw, dict):
                    current.update(
                        {
                            "requestedPlan": str(current_raw.get("requestedPlan") or current["requestedPlan"]).strip().lower(),
                            "status": str(current_raw.get("status") or current["status"]).strip().lower(),
                            "method": str(current_raw.get("method") or current["method"]).strip().lower(),
                            "reference": str(current_raw.get("reference") or current["reference"]).strip()[:160],
                            "note": str(current_raw.get("note") or current["note"]).strip()[:4000],
                            "updatedAt": ShopStore._safe_int(
                                current_raw.get("updatedAt"),
                                minimum=0,
                                maximum=9999999999999,
                            ),
                        }
                    )
        desired_plan = requested_plan if requested_plan in self.VALID_REACH_PLANS else str(current["requestedPlan"])
        if desired_plan != "map":
            return {
                "requestedPlan": "free",
                "status": "not_required",
                "method": "",
                "reference": "",
                "note": "",
                "updatedAt": int(datetime.now(timezone.utc).timestamp() * 1000),
            }

        payload = raw_unlock if isinstance(raw_unlock, dict) else {}
        method = str(payload.get("method") or current.get("method") or "").strip().lower()
        available_methods = set(self._load_wallets().keys())
        if method not in ShopStore.VALID_MAP_UNLOCK_METHODS or method not in available_methods:
            method = ""
        reference = str(payload.get("reference") or current.get("reference") or "").strip()[:160]
        note = str(payload.get("note") or current.get("note") or "").strip()[:4000]
        current_status = str(current.get("status") or "").strip().lower()
        if current_status == "unlocked":
            status = "unlocked"
        else:
            status = "pending" if (method or reference or note) else "locked"
        return {
            "requestedPlan": "map",
            "status": status,
            "method": method,
            "reference": reference,
            "note": note,
            "updatedAt": int(datetime.now(timezone.utc).timestamp() * 1000),
        }

    def register_payload(self, shop_id: str) -> Dict[str, str]:
        escaped = quote(shop_id, safe="")
        return {
            "shop_id": shop_id,
            "public_url": f"{self.public_base_url}/{escaped}",
            "tunnel_ws_url": f"{self.ws_base_url}/api/tunnel/{escaped}",
        }

    def registration_restricted_payload(self) -> Dict[str, str]:
        return {
            "error": "registration_restricted",
            "message": "Production registration is handled explicitly.",
        }

    def _normalized_shop_record(self, record: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        if not isinstance(record, dict):
            return record
        normalized = dict(record)
        shop_id = self.normalize_shop_id(str(normalized.get("shop_id") or "").strip())
        if shop_id:
            normalized["public_url"] = self.register_payload(shop_id)["public_url"]
        console_payload = normalized.get("console")
        if isinstance(console_payload, dict):
            share = console_payload.get("share")
            if isinstance(share, dict) and shop_id:
                share = dict(share)
                share["publicUrl"] = self.register_payload(shop_id)["public_url"]
                console_payload = dict(console_payload)
                console_payload["share"] = share
                normalized["console"] = console_payload
        return normalized

    async def discovery_bootstrap(self) -> Dict[str, object]:
        shops = await self.store.list_shops(limit=200)
        map_shops: List[Dict[str, object]] = []
        for shop in shops:
            shop_id = str(shop["shop_id"])
            console_record = await self.store.get_shop_console(str(shop["shop_id"]))
            profile = {}
            if console_record is not None:
                profile = console_record.get("console", {}).get("profile", {}) or {}
            raw_gps = str(profile.get("gps") or profile.get("location") or "").strip()
            location_label = self.store._strip_gps_tag(str(profile.get("location") or "").strip())[:160]
            gps = self.store._extract_gps(raw_gps)
            lat: Optional[float] = None
            lng: Optional[float] = None
            if gps:
                try:
                    raw_lat, raw_lng = gps.split(",", 1)
                    lat = float(raw_lat)
                    lng = float(raw_lng)
                except ValueError:
                    lat = None
                    lng = None
            map_shops.append(
                {
                    "shop_id": shop_id,
                    "display_name": str(shop["display_name"]),
                    "public_url": self.register_payload(shop_id)["public_url"],
                    "map_color": str(shop.get("map_color") or "#ffffff"),
                    "has_location": lat is not None and lng is not None,
                    "location_label": location_label,
                    "lat": lat,
                    "lng": lng,
                }
            )
        return {
            "stored_shop_count": len(shops),
            "map_shops": map_shops,
            "google_maps_api_key": os.environ.get("HASHOP_GOOGLE_MAPS_API_KEY", "").strip()
            or os.environ.get("GOOGLE_MAPS_API_KEY", "").strip(),
        }

    def debug_discovery_bootstrap(self) -> Dict[str, object]:
        map_shops = [
            {
                "shop_id": "debug-lake-gas",
                "display_name": "Lake Gas",
                "public_url": "/shop/debug-lake-gas/",
                "map_color": "#f7c948",
                "has_location": True,
                "location_label": "Ulsoor, Bengaluru",
                "lat": 12.9826,
                "lng": 77.6232,
                "preview": {
                    "type": "Gas Store",
                    "note": "Fast home cylinder swaps and late-night refill help.",
                    "contact": "+91 99887 55443",
                    "hours": "Daily 6am-11pm",
                    "pricing": {"prefix": "Rs ", "suffix": "", "decimals": 0},
                    "payments": [
                        {"label": "UPI", "value": "lakegas@oksbi", "note": "Primary UPI ID"},
                        {"label": "BTC", "value": "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kygt080", "note": "Bitcoin address"},
                        {"label": "Cash", "note": "Pay at handoff"},
                    ],
                    "items": [
                        {
                            "id": "gas-14kg",
                            "title": "14kg Refill",
                            "description": "Standard home cylinder refill with doorstep handoff.",
                            "price": "1100",
                            "quantity": 18,
                        },
                        {
                            "id": "gas-mini",
                            "title": "Mini Backup Cylinder",
                            "description": "Small backup cylinder for stalls, carts, and quick swaps.",
                            "price": "650",
                            "quantity": 9,
                        },
                    ],
                },
            },
            {
                "shop_id": "debug-redshop",
                "display_name": "Redshop",
                "public_url": "/shop/debug-redshop/",
                "map_color": "#ff5f7a",
                "has_location": True,
                "location_label": "Indiranagar, Bengaluru",
                "lat": 12.9718,
                "lng": 77.6412,
                "preview": {
                    "type": "Corner Store",
                    "note": "Late-hour essentials, tobacco, cold drinks, and snack runs.",
                    "contact": "+91 98765 11223",
                    "hours": "Daily 9am-1am",
                    "pricing": {"prefix": "Rs ", "suffix": "", "decimals": 0},
                    "payments": [
                        {"label": "UPI", "value": "redshop@okhdfcbank", "note": "Counter UPI ID"},
                        {"label": "BTC", "value": "bc1p5cyxnuxmeuwuvkwfem96lxyepd5d02e0f2j7p6", "note": "Bitcoin address"},
                        {"label": "Cash", "note": "Pay at counter"},
                    ],
                    "items": [
                        {
                            "id": "red-marlboro",
                            "title": "Marlboro Red",
                            "description": "King size pack kept near the counter for quick pickup.",
                            "price": "60",
                            "quantity": 24,
                        },
                        {
                            "id": "red-coke",
                            "title": "Coke 750ml",
                            "description": "Cold bottle from the front fridge.",
                            "price": "45",
                            "quantity": 14,
                        },
                        {
                            "id": "red-chips",
                            "title": "Masala Chips",
                            "description": "Crunchy salted chips for impulse counter buys.",
                            "price": "25",
                            "quantity": 31,
                        },
                    ],
                },
            },
            {
                "shop_id": "debug-tea-corner",
                "display_name": "Tea Corner",
                "public_url": "/shop/debug-tea-corner/",
                "map_color": "#6ee7b7",
                "has_location": True,
                "location_label": "MG Road, Bengaluru",
                "lat": 12.9755,
                "lng": 77.6067,
                "preview": {
                    "type": "Tea Stall",
                    "note": "Strong chai, sweet buns, and office break staples.",
                    "contact": "+91 90358 77001",
                    "hours": "Mon-Sat 7am-8pm",
                    "pricing": {"prefix": "$", "suffix": "", "decimals": 0},
                    "payments": [
                        {"label": "UPI", "value": "teacorner@okaxis", "note": "Tea stall UPI"},
                        {"label": "Cash", "note": "Pay at stall"},
                    ],
                    "items": [
                        {
                            "id": "tea-cutting",
                            "title": "Cutting Chai",
                            "description": "Hot ginger chai in a fast counter cup.",
                            "price": "15",
                            "quantity": 80,
                        },
                        {
                            "id": "tea-bun",
                            "title": "Maska Bun",
                            "description": "Soft bun with butter and sugar, fresh every evening.",
                            "price": "25",
                            "quantity": 22,
                        },
                        {
                            "id": "tea-matcha",
                            "title": "Matcha Latte",
                            "description": "Creamy iced matcha for a slower sit-down sip.",
                            "price": "120",
                            "quantity": 7,
                        },
                    ],
                },
            },
            {
                "shop_id": "debug-night-mart",
                "display_name": "Night Mart",
                "public_url": "/shop/debug-night-mart/",
                "map_color": "#6cc6ff",
                "has_location": True,
                "location_label": "Shivajinagar, Bengaluru",
                "lat": 12.9869,
                "lng": 77.6042,
                "preview": {
                    "type": "Night Grocery",
                    "note": "Midnight snacks, batteries, water, and ride-home basics.",
                    "contact": "+91 95661 22008",
                    "hours": "Open 24 hours",
                    "pricing": {"prefix": "", "suffix": " BTC", "decimals": 5},
                    "payments": [
                        {"label": "BTC", "value": "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh", "note": "Bitcoin address"},
                        {"label": "UPI", "value": "nightmart@ybl", "note": "Night grocery UPI"},
                        {"label": "Cash", "note": "Pay at pickup"},
                    ],
                    "items": [
                        {
                            "id": "night-water",
                            "title": "Mineral Water",
                            "description": "1L chilled bottle kept by the checkout.",
                            "price": "0.00032",
                            "quantity": 43,
                        },
                        {
                            "id": "night-noodles",
                            "title": "Instant Noodles",
                            "description": "Quick late-night meal with masala packet inside.",
                            "price": "0.00028",
                            "quantity": 26,
                        },
                        {
                            "id": "night-battery",
                            "title": "AA Battery Pair",
                            "description": "Emergency remote, torch, and toy replacement cells.",
                            "price": "0.00105",
                            "quantity": 12,
                        },
                    ],
                },
            },
            {
                "shop_id": "debug-bakery",
                "display_name": "Corner Bakery",
                "public_url": "/shop/debug-bakery/",
                "map_color": "#c084fc",
                "has_location": False,
                "location_label": "Location pending",
                "lat": None,
                "lng": None,
                "preview": {
                    "type": "Bakery",
                    "note": "Fresh bake drops every morning and custom cake preorders.",
                    "contact": "+91 91234 88776",
                    "hours": "Daily 8am-9pm",
                    "pricing": {"prefix": "€", "suffix": "", "decimals": 0},
                    "payments": [
                        {"label": "UPI", "value": "cornerbakery@okicici", "note": "Bakery UPI"},
                        {"label": "Cash", "note": "Pay at pickup"},
                    ],
                    "items": [
                        {
                            "id": "bake-croissant",
                            "title": "Butter Croissant",
                            "description": "Flaky morning bake with crisp outer layers.",
                            "price": "55",
                            "quantity": 16,
                        },
                        {
                            "id": "bake-roll",
                            "title": "Chocolate Roll",
                            "description": "Soft sponge roll with rich chocolate cream.",
                            "price": "95",
                            "quantity": 8,
                        },
                    ],
                },
            },
        ]
        return {
            "stored_shop_count": len(map_shops),
            "map_shops": map_shops,
        }

    async def handle_register(self, request: web.Request) -> web.Response:
        if not self.public_shop_create_enabled:
            return web.json_response(self.registration_restricted_payload(), status=403)
        try:
            payload = await request.json()
        except json.JSONDecodeError:
            return web.json_response({"error": "invalid_json"}, status=400)
        shop_id = self.normalize_shop_id(str(payload.get("shop_id", "")).strip())
        if not shop_id:
            return web.json_response({"error": "shop_id_required"}, status=400)
        auth_guard = await self._auth_guard_response(
            request,
            scope="shop_register",
            contact=shop_id,
            contact_limit=5,
            client_limit=30,
            window_seconds=3600,
        )
        if auth_guard is not None:
            return auth_guard
        register_payload = self.register_payload(shop_id)
        await self.store.ensure_shop(shop_id, register_payload["public_url"])
        return web.json_response(register_payload)

    async def handle_health(self, request: web.Request) -> web.Response:
        stored_shop_count = await self.store.count_shops()
        return web.json_response(
            {
                "status": "ok",
                "connected_shops": sorted(self.sessions.keys()),
                "shop_count": len(self.sessions),
                "stored_shop_count": stored_shop_count,
            }
        )

    async def handle_index(self, request: web.Request) -> web.Response:
        return await self._serve_discovery_index()

    async def _serve_discovery_index(
        self,
        debug_page: str = "",
        bootstrap: Optional[Dict[str, object]] = None,
    ) -> web.Response:
        index_file = self.site_dir / "index.html"
        if index_file.exists():
            if bootstrap is None:
                bootstrap = await self.discovery_bootstrap()
            return self._serve_site_html(
                "index.html",
                bootstrap=bootstrap,
                debug_page=debug_page,
            )
        return web.json_response(self.meta_payload())

    async def handle_hashop(self, request: web.Request) -> web.Response:
        return self._serve_site_html("hashop.html")

    async def handle_cloud(self, request: web.Request) -> web.Response:
        raise web.HTTPFound("/login")

    async def handle_login_page(self, request: web.Request) -> web.Response:
        return await self._serve_discovery_index()

    async def handle_account_page(self, request: web.Request) -> web.Response:
        return await self._serve_discovery_index()

    async def handle_orders_page(self, request: web.Request) -> web.Response:
        return await self._serve_discovery_index()

    async def handle_setup_page(self, request: web.Request) -> web.Response:
        return await self._serve_discovery_index()

    async def handle_concept_page(self, request: web.Request) -> web.Response:
        return await self._serve_discovery_index()

    async def handle_about_page(self, request: web.Request) -> web.Response:
        return self._serve_site_html("about.html")

    async def handle_exp_page(self, request: web.Request) -> web.Response:
        return self._serve_site_html("exp.html")

    async def handle_privacy_page(self, request: web.Request) -> web.Response:
        return self._serve_site_html("privacy.html")

    async def handle_index_debug(self, request: web.Request) -> web.Response:
        return await self._serve_discovery_index(
            debug_page="home",
            bootstrap=self.debug_discovery_bootstrap(),
        )

    async def handle_cloud_debug(self, request: web.Request) -> web.Response:
        raise web.HTTPFound("/home-debug?pane=login")

    async def handle_login_page_debug(self, request: web.Request) -> web.Response:
        raise web.HTTPFound("/home-debug?pane=login")

    async def handle_debug_dropdown_removed(self, request: web.Request) -> web.Response:
        raise web.HTTPNotFound()

    async def handle_debug_codex_status(self, request: web.Request) -> web.Response:
        return web.json_response(
            {
                "ok": True,
                "enabled": bool(self.debug_codex_bridge_url and self.debug_codex_token),
                "mode": "bridge" if self.debug_codex_bridge_url else "local-copy",
            },
            headers={"Cache-Control": "no-store"},
        )

    async def handle_debug_codex_process(self, request: web.Request) -> web.Response:
        try:
            payload = await request.json()
        except json.JSONDecodeError:
            return web.json_response({"ok": False, "error": "invalid_json"}, status=400)
        if not isinstance(payload, dict):
            return web.json_response({"ok": False, "error": "invalid_payload"}, status=400)

        if not self.debug_codex_bridge_url or not self.debug_codex_token:
            return web.json_response(
                {
                    "ok": False,
                    "error": "processor_not_configured",
                    "message": "Codex processor is not connected on this server.",
                },
                status=503,
                headers={"Cache-Control": "no-store"},
            )

        token = str(request.headers.get("X-Hashop-Debug-Token") or "").strip()
        if not hmac.compare_digest(token, self.debug_codex_token):
            return web.json_response(
                {"ok": False, "error": "debug_token_required", "message": "Debug token required."},
                status=403,
                headers={"Cache-Control": "no-store"},
            )

        task = str(payload.get("task") or "").strip()[:8000]
        if not task:
            return web.json_response({"ok": False, "error": "task_required"}, status=400)

        bridge_payload = {
            "task": task,
            "context": payload.get("context") if isinstance(payload.get("context"), dict) else {},
            "prompt": str(payload.get("prompt") or "").strip()[:20000],
            "source": "hashop-debug",
        }
        bridge_url = self.debug_codex_bridge_url + "/api/debug/codex/process"
        try:
            async with ClientSession(timeout=ClientTimeout(total=90)) as session:
                async with session.post(
                    bridge_url,
                    json=bridge_payload,
                    headers={"X-Hashop-Debug-Token": self.debug_codex_token},
                ) as response:
                    response_text = await response.text()
                    try:
                        response_payload = json.loads(response_text) if response_text else {}
                    except json.JSONDecodeError:
                        response_payload = {"ok": response.status < 400, "result": response_text}
                    return web.json_response(
                        response_payload if isinstance(response_payload, dict) else {"ok": response.status < 400},
                        status=response.status,
                        headers={"Cache-Control": "no-store"},
                    )
        except Exception as error:
            return web.json_response(
                {
                    "ok": False,
                    "error": "processor_unavailable",
                    "message": str(error)[:240] or "Codex processor unavailable.",
                },
                status=502,
                headers={"Cache-Control": "no-store"},
            )

    async def handle_hashop_debug(self, request: web.Request) -> web.Response:
        return self._serve_site_html("hashop.html", debug_page="hashop")

    async def handle_discovery_shop_page(self, request: web.Request) -> web.Response:
        shop_id = self.normalize_shop_id(request.match_info.get("shop_id", ""))
        tail = str(request.match_info.get("tail", "") or "").strip("/")
        if not shop_id or shop_id in self.DISCOVERY_RESERVED_SEGMENTS:
            raise web.HTTPNotFound()
        if tail:
            parts = [segment for segment in tail.split("/") if segment]
            if not parts:
                raise web.HTTPNotFound()
            if parts[0] == "cart" and len(parts) == 1:
                return await self._serve_discovery_index()
            if parts[0] == "settings" and len(parts) <= 2 and (len(parts) == 1 or parts[1] in {"profile", "payments"}):
                return await self._serve_discovery_index()
            if parts[0] == "history" and len(parts) <= 2 and (len(parts) == 1 or parts[1] in {"orders", "items", "stats"}):
                return await self._serve_discovery_index()
            raise web.HTTPNotFound()
        return await self._serve_discovery_index()

    async def handle_shop_debug_request(self, request: web.Request) -> web.Response:
        response = await self._proxy_shop_request(request, debug_page="shop")
        return response

    async def handle_meta(self, request: web.Request) -> web.Response:
        return web.json_response(
            {
                **self.meta_payload(),
                "stored_shop_count": await self.store.count_shops(),
                "recent_shops": [self._normalized_shop_record(shop) for shop in await self.store.list_shops(limit=12)],
            }
        )

    async def handle_payment_options(self, request: web.Request) -> web.Response:
        return web.json_response(
            self.payment_options_payload(),
            headers={"Cache-Control": "no-cache"},
        )

    async def handle_create_shop(self, request: web.Request) -> web.Response:
        if not self.public_shop_create_enabled:
            return web.json_response(self.registration_restricted_payload(), status=403)
        try:
            payload = await request.json()
        except json.JSONDecodeError:
            return web.json_response({"error": "invalid_json"}, status=400)

        raw_shop_id = str(payload.get("vendor_id") or payload.get("shop_id") or "").strip()
        shop_id = self.normalize_shop_id(raw_shop_id)
        if not shop_id:
            return web.json_response({"error": "shop_id_required"}, status=400)

        raw_display_name = str(payload.get("display_name") or raw_shop_id or shop_id).strip()
        display_name = raw_display_name[:80] or shop_id

        raw_reach_plan = str(payload.get("reach_plan") or "free").strip().lower()
        if raw_reach_plan not in self.VALID_REACH_PLANS:
            return web.json_response({"error": "invalid_reach_plan"}, status=400)
        raw_password = str(payload.get("password") or "").strip()
        if raw_password and len(raw_password) < 6:
            return web.json_response({"error": "password_too_short"}, status=400)
        owner_contact = str(payload.get("owner_contact") or payload.get("contact") or "").strip()[:255]
        verification_code = str(
            payload.get("verification_code")
            or payload.get("code")
            or payload.get("reset_code")
            or ""
        ).strip()
        shop_location = str(
            payload.get("location")
            or payload.get("address")
            or payload.get("shop_address")
            or ""
        ).strip()[:240]
        existing_console_record = await self.store.get_shop_console(shop_id)
        verified_contact = ""
        if raw_password:
            if existing_console_record is not None:
                return web.json_response({"error": "shop_exists"}, status=409)
            if not owner_contact:
                return web.json_response({"error": "contact_required"}, status=400)
            if not verification_code:
                return web.json_response({"error": "verification_code_required"}, status=400)
            auth_guard = await self._auth_guard_response(
                request,
                scope="shop_create",
                contact=f"{shop_id}:{owner_contact}",
                contact_limit=3,
                client_limit=20,
                window_seconds=3600,
            )
            if auth_guard is not None:
                return auth_guard
            verification = await self.store.verify_buyer_contact_code(owner_contact, verification_code)
            if verification is None:
                return web.json_response({"error": "invalid_verification_code"}, status=401)
            verified_contact = str(verification.get("contact") or owner_contact).strip()[:255]
        map_unlock = self._resolve_map_unlock(
            existing_console_record.get("console") if existing_console_record else None,
            raw_reach_plan,
            payload.get("map_unlock"),
        )

        public_url = self.register_payload(shop_id)["public_url"]
        record, created = await self.store.upsert_shop(
            shop_id=shop_id,
            display_name=display_name,
            reach_plan=self._effective_reach_plan(map_unlock),
            public_url=public_url,
        )
        if raw_password:
            updated = await self.store.set_shop_password(shop_id, raw_password)
            if updated is not None:
                record = updated
            if verified_contact:
                await self.store.link_shop_recovery_contact(
                    shop_id=shop_id,
                    contact=verified_contact,
                    source="shop_signup",
                    is_primary=True,
                )
        console_record = await self.store.get_shop_console(shop_id)
        if console_record is not None:
            console_payload = console_record.get("console", {})
            if not isinstance(console_payload, dict):
                console_payload = {}
            profile_payload = console_payload.get("profile")
            if not isinstance(profile_payload, dict):
                profile_payload = {}
                console_payload["profile"] = profile_payload
            profile_payload["name"] = display_name
            if shop_location:
                profile_payload["location"] = shop_location
            if verified_contact:
                profile_payload["contact"] = verified_contact
            console_payload.setdefault("billing", {})["mapUnlock"] = map_unlock
            updated_console = await self.store.save_shop_console(shop_id, console_payload)
            if updated_console is not None:
                record = updated_console
        return web.json_response(
            {
                "created": created,
                "shop": self._normalized_shop_record(record),
                "unlock": map_unlock,
                "launch_url": f"/hashop?shop={quote(shop_id, safe='')}",
            },
            status=201 if created else 200,
        )

    async def handle_update_map_unlock(self, request: web.Request) -> web.Response:
        shop_id = self.normalize_shop_id(request.match_info["shop_id"])
        if not shop_id:
            raise web.HTTPNotFound()
        existing = await self.store.get_shop_console(shop_id)
        if existing is None:
            raise web.HTTPNotFound(text=json.dumps({"error": "shop_not_found"}), content_type="application/json")
        try:
            payload = await request.json()
        except json.JSONDecodeError:
            return web.json_response({"error": "invalid_json"}, status=400)
        if not isinstance(payload, dict):
            return web.json_response({"error": "invalid_payload"}, status=400)
        requested_plan = str(
            payload.get("requested_plan")
            or existing.get("console", {}).get("billing", {}).get("mapUnlock", {}).get("requestedPlan")
            or "free"
        ).strip().lower()
        if requested_plan not in self.VALID_REACH_PLANS:
            return web.json_response({"error": "invalid_reach_plan"}, status=400)

        map_unlock = self._resolve_map_unlock(existing.get("console"), requested_plan, payload)
        console_payload = existing.get("console", {})
        if not isinstance(console_payload, dict):
            console_payload = {}
        console_payload.setdefault("billing", {})["mapUnlock"] = map_unlock
        updated_console = await self.store.save_shop_console(shop_id, console_payload)
        active_reach_plan = self._effective_reach_plan(map_unlock)
        updated_shop, _ = await self.store.upsert_shop(
            shop_id=shop_id,
            display_name=str(
                (updated_console or existing).get("display_name")
                or existing.get("display_name")
                or shop_id
            ),
            reach_plan=active_reach_plan,
            public_url=str(existing.get("public_url") or self.register_payload(shop_id)["public_url"]),
        )
        if updated_console is None:
            return web.json_response({"shop": updated_shop, "unlock": map_unlock})
        updated_console["reach_plan"] = updated_shop["reach_plan"]
        updated_console["updated_at"] = updated_shop["updated_at"]
        return web.json_response(updated_console)

    async def handle_login(self, request: web.Request) -> web.Response:
        try:
            payload = await request.json()
        except json.JSONDecodeError:
            return web.json_response({"error": "invalid_json"}, status=400)
        if not isinstance(payload, dict):
            return web.json_response({"error": "invalid_payload"}, status=400)
        shop_id = self.normalize_shop_id(str(payload.get("shop_id") or "").strip())
        password = str(payload.get("password") or "")
        if not shop_id:
            return web.json_response({"error": "shop_id_required"}, status=400)
        if not password:
            return web.json_response({"error": "password_required"}, status=400)
        auth_guard = await self._auth_guard_response(
            request,
            scope="shop_login",
            contact=shop_id,
            contact_limit=15,
            client_limit=80,
            window_seconds=900,
        )
        if auth_guard is not None:
            return auth_guard
        record = await self.store.verify_shop_password(shop_id, password)
        if record is None:
            return web.json_response({"error": "invalid_login"}, status=401)
        return web.json_response(
            {
                "shop": self._normalized_shop_record(record),
                "launch_url": f"/hashop?shop={quote(shop_id, safe='')}",
            }
        )

    async def handle_link_shop_recovery_contact(self, request: web.Request) -> web.Response:
        shop_id = self.normalize_shop_id(request.match_info["shop_id"])
        if not shop_id:
            raise web.HTTPNotFound()
        try:
            payload = await request.json()
        except json.JSONDecodeError:
            return web.json_response({"error": "invalid_json"}, status=400)
        if not isinstance(payload, dict):
            return web.json_response({"error": "invalid_payload"}, status=400)
        password = str(payload.get("password") or "")
        contact = str(payload.get("contact") or "").strip()[:255]
        if not password:
            return web.json_response({"error": "password_required"}, status=400)
        if not contact:
            return web.json_response({"error": "contact_required"}, status=400)
        if await self.store.verify_shop_password(shop_id, password) is None:
            return web.json_response({"error": "invalid_login"}, status=401)
        linked = await self.store.link_shop_recovery_contact(
            shop_id=shop_id,
            contact=contact,
            source="owner_password",
            is_primary=True,
        )
        if linked is None:
            return web.json_response({"error": "contact_invalid"}, status=400)
        return web.json_response(
            {
                "ok": True,
                "shop_id": shop_id,
                "contact": {
                    "type": linked.get("contact_type") or "text",
                    "hint": self.store._mask_contact(contact),
                    "primary": bool(linked.get("is_primary")),
                    "verified": bool(int(linked.get("verified_at") or 0)),
                },
            },
            headers={"Cache-Control": "no-store"},
        )

    async def handle_request_shop_password_reset(self, request: web.Request) -> web.Response:
        try:
            payload = await request.json()
        except json.JSONDecodeError:
            return web.json_response({"error": "invalid_json"}, status=400)
        if not isinstance(payload, dict):
            return web.json_response({"error": "invalid_payload"}, status=400)
        shop_id = self.normalize_shop_id(str(payload.get("shop_id") or "").strip())
        contact = str(payload.get("contact") or "").strip()
        if not shop_id:
            return web.json_response({"error": "shop_id_required"}, status=400)
        if not contact:
            return web.json_response({"error": "contact_required"}, status=400)
        auth_guard = await self._auth_guard_response(
            request,
            scope="shop_password_reset",
            contact=f"{shop_id}:{contact}",
            contact_limit=5,
            client_limit=20,
            window_seconds=3600,
        )
        if auth_guard is not None:
            return auth_guard
        result = await self.store.create_shop_password_reset(shop_id, contact)
        if not result.get("ok"):
            error = str(result.get("error") or "reset_request_failed")
            status = 400
            if error == "shop_not_found":
                status = 404
            elif error == "reset_rate_limited":
                status = 429
            return web.json_response(result, status=status, headers={"Cache-Control": "no-store"})
        return await self._password_reset_response(result, purpose="shop")

    async def handle_reset_shop_password(self, request: web.Request) -> web.Response:
        try:
            payload = await request.json()
        except json.JSONDecodeError:
            return web.json_response({"error": "invalid_json"}, status=400)
        if not isinstance(payload, dict):
            return web.json_response({"error": "invalid_payload"}, status=400)
        shop_id = self.normalize_shop_id(str(payload.get("shop_id") or "").strip())
        reset_code = str(payload.get("reset_code") or "").strip()
        password = str(payload.get("password") or "")
        if not shop_id:
            return web.json_response({"error": "shop_id_required"}, status=400)
        if not reset_code:
            return web.json_response({"error": "reset_code_required"}, status=400)
        if not password:
            return web.json_response({"error": "password_required"}, status=400)
        if len(password) < 6:
            return web.json_response({"error": "password_too_short"}, status=400)
        auth_guard = await self._auth_guard_response(
            request,
            scope="shop_password_reset_submit",
            contact=shop_id,
            contact_limit=8,
            client_limit=40,
            window_seconds=900,
        )
        if auth_guard is not None:
            return auth_guard
        if self.owner_reset_code and hmac.compare_digest(reset_code, self.owner_reset_code):
            record = await self.store.set_shop_password(shop_id, password)
        else:
            record = await self.store.reset_shop_password_with_code(shop_id, reset_code, password)
        if record is None:
            return web.json_response({"error": "invalid_reset_code"}, status=401)
        return web.json_response(
            {
                "shop": self._normalized_shop_record(record),
                "launch_url": f"/hashop?shop={quote(shop_id, safe='')}",
            }
        )

    async def handle_buyer_signup(self, request: web.Request) -> web.Response:
        try:
            payload = await request.json()
        except json.JSONDecodeError:
            return web.json_response({"error": "invalid_json"}, status=400)
        if not isinstance(payload, dict):
            return web.json_response({"error": "invalid_payload"}, status=400)
        display_name = str(payload.get("display_name") or payload.get("name") or "").strip()[:160]
        contact = str(payload.get("contact") or "").strip()[:255]
        password = str(payload.get("password") or "")
        buyer_key = str(payload.get("buyer_key") or "").strip()[:160]
        if not contact:
            return web.json_response({"error": "contact_required"}, status=400)
        if not password:
            return web.json_response({"error": "password_required"}, status=400)
        if len(password) < 6:
            return web.json_response({"error": "password_too_short"}, status=400)
        auth_guard = await self._auth_guard_response(
            request,
            scope="buyer_signup",
            contact=contact,
            contact_limit=3,
            client_limit=20,
            window_seconds=3600,
        )
        if auth_guard is not None:
            return auth_guard
        account = await self.store.create_buyer_account(display_name, contact, password, buyer_key)
        if account is None:
            return web.json_response({"error": "account_exists"}, status=409)
        return web.json_response(
            {
                "created": True,
                "account": self._buyer_account_payload(account),
                "buyer_key": str(account.get("buyer_key") or "").strip(),
            },
            status=201,
            headers={"Cache-Control": "no-cache"},
        )

    async def handle_buyer_login(self, request: web.Request) -> web.Response:
        try:
            payload = await request.json()
        except json.JSONDecodeError:
            return web.json_response({"error": "invalid_json"}, status=400)
        if not isinstance(payload, dict):
            return web.json_response({"error": "invalid_payload"}, status=400)
        contact = str(payload.get("contact") or "").strip()[:255]
        password = str(payload.get("password") or "")
        buyer_key = str(payload.get("buyer_key") or "").strip()[:160]
        if not contact:
            return web.json_response({"error": "contact_required"}, status=400)
        if not password:
            return web.json_response({"error": "password_required"}, status=400)
        auth_guard = await self._auth_guard_response(
            request,
            scope="buyer_login",
            contact=contact,
            contact_limit=12,
            client_limit=80,
            window_seconds=900,
        )
        if auth_guard is not None:
            return auth_guard
        account = await self.store.verify_buyer_account(contact, password, buyer_key)
        if account is None:
            return web.json_response({"error": "invalid_login"}, status=401)
        return web.json_response(
            {
                "account": self._buyer_account_payload(account),
                "buyer_key": str(account.get("buyer_key") or "").strip(),
            },
            headers={"Cache-Control": "no-cache"},
        )

    async def handle_buyer_request_contact_verification(self, request: web.Request) -> web.Response:
        try:
            payload = await request.json()
        except json.JSONDecodeError:
            return web.json_response({"error": "invalid_json"}, status=400)
        if not isinstance(payload, dict):
            return web.json_response({"error": "invalid_payload"}, status=400)
        contact = str(payload.get("contact") or "").strip()[:255]
        if not contact:
            return web.json_response({"error": "contact_required"}, status=400)
        auth_guard = await self._auth_guard_response(
            request,
            scope="buyer_contact_verification",
            contact=contact,
            contact_limit=5,
            client_limit=25,
            window_seconds=3600,
        )
        if auth_guard is not None:
            return auth_guard
        result = await self.store.create_buyer_contact_verification(contact)
        if not result.get("ok"):
            error = str(result.get("error") or "verification_request_failed")
            status = 429 if error == "verification_rate_limited" else 400
            return web.json_response(result, status=status, headers={"Cache-Control": "no-store"})
        return await self._password_reset_response(result, purpose="verify")

    async def handle_buyer_verify_contact(self, request: web.Request) -> web.Response:
        try:
            payload = await request.json()
        except json.JSONDecodeError:
            return web.json_response({"error": "invalid_json"}, status=400)
        if not isinstance(payload, dict):
            return web.json_response({"error": "invalid_payload"}, status=400)
        contact = str(payload.get("contact") or "").strip()[:255]
        verification_code = str(
            payload.get("verification_code")
            or payload.get("code")
            or payload.get("reset_code")
            or ""
        ).strip()
        if not contact:
            return web.json_response({"error": "contact_required"}, status=400)
        if not verification_code:
            return web.json_response({"error": "verification_code_required"}, status=400)
        auth_guard = await self._auth_guard_response(
            request,
            scope="buyer_contact_verify",
            contact=contact,
            contact_limit=8,
            client_limit=40,
            window_seconds=900,
        )
        if auth_guard is not None:
            return auth_guard
        verification = await self.store.verify_buyer_contact_code(contact, verification_code)
        if verification is None:
            return web.json_response({"error": "invalid_verification_code"}, status=401)
        return web.json_response(
            {
                "verified": True,
                "contact": str(verification.get("contact") or contact).strip(),
                "contact_key": str(verification.get("contact_key") or "").strip(),
                "verified_at": int(verification.get("verified_at") or 0),
            },
            headers={"Cache-Control": "no-store"},
        )

    async def handle_account_help_request(self, request: web.Request) -> web.Response:
        try:
            payload = await request.json()
        except json.JSONDecodeError:
            return web.json_response({"error": "invalid_json"}, status=400)
        if not isinstance(payload, dict):
            return web.json_response({"error": "invalid_payload"}, status=400)
        message = str(payload.get("message") or "").strip()[:1200]
        if not message:
            return web.json_response({"error": "message_required"}, status=400)
        buyer_key = str(payload.get("buyer_key") or "").strip()[:160]
        buyer_account_id = str(payload.get("buyer_account_id") or payload.get("account_id") or "").strip()[:64]
        buyer_account_token = str(payload.get("buyer_account_token") or payload.get("account_token") or "").strip()[:255]
        buyer_account: Optional[Dict[str, str]] = None
        if buyer_account_id or buyer_account_token:
            buyer_account = await self.store.verify_buyer_token(buyer_account_id, buyer_account_token)
            if buyer_account is None:
                return web.json_response({"error": "invalid_buyer_account"}, status=401)
            buyer_key = buyer_key or str(buyer_account.get("buyer_key") or "").strip()[:160]
        name = str(payload.get("name") or "").strip()[:160]
        contact = str(payload.get("contact") or "").strip()[:255]
        if buyer_account is not None:
            name = name or str(buyer_account.get("display_name") or "").strip()[:160]
            contact = contact or str(buyer_account.get("contact") or "").strip()[:255]
        try:
            record = await self.store.create_account_help_request(
                message=message,
                buyer_key=buyer_key,
                buyer_account_id=buyer_account_id,
                name=name,
                contact=contact,
                screen=str(payload.get("screen") or "").strip()[:80],
                route=str(payload.get("route") or "").strip()[:160],
                build=str(payload.get("build") or "").strip()[:80],
                user_agent=str(request.headers.get("User-Agent") or "").strip()[:400],
                help_id=str(payload.get("help_id") or payload.get("id") or "").strip()[:80],
            )
        except ValueError:
            return web.json_response({"error": "message_required"}, status=400)
        return web.json_response(
            {"ok": True, "request": record},
            status=201,
            headers={"Cache-Control": "no-store"},
        )

    async def handle_buyer_request_password_reset(self, request: web.Request) -> web.Response:
        try:
            payload = await request.json()
        except json.JSONDecodeError:
            return web.json_response({"error": "invalid_json"}, status=400)
        if not isinstance(payload, dict):
            return web.json_response({"error": "invalid_payload"}, status=400)
        contact = str(payload.get("contact") or "").strip()[:255]
        if not contact:
            return web.json_response({"error": "contact_required"}, status=400)
        auth_guard = await self._auth_guard_response(
            request,
            scope="buyer_password_reset",
            contact=contact,
            contact_limit=5,
            client_limit=25,
            window_seconds=3600,
        )
        if auth_guard is not None:
            return auth_guard
        result = await self.store.create_buyer_password_reset(contact)
        if not result.get("ok"):
            error = str(result.get("error") or "reset_request_failed")
            status = 404 if error == "account_not_found" else 400
            if error == "reset_rate_limited":
                status = 429
            return web.json_response(result, status=status, headers={"Cache-Control": "no-store"})
        return await self._password_reset_response(result, purpose="buyer")

    async def handle_buyer_reset_password(self, request: web.Request) -> web.Response:
        try:
            payload = await request.json()
        except json.JSONDecodeError:
            return web.json_response({"error": "invalid_json"}, status=400)
        if not isinstance(payload, dict):
            return web.json_response({"error": "invalid_payload"}, status=400)
        contact = str(payload.get("contact") or "").strip()[:255]
        reset_code = str(payload.get("reset_code") or "").strip()
        password = str(payload.get("password") or "")
        buyer_key = str(payload.get("buyer_key") or "").strip()[:160]
        if not contact:
            return web.json_response({"error": "contact_required"}, status=400)
        if not reset_code:
            return web.json_response({"error": "reset_code_required"}, status=400)
        if not password:
            return web.json_response({"error": "password_required"}, status=400)
        if len(password) < 6:
            return web.json_response({"error": "password_too_short"}, status=400)
        auth_guard = await self._auth_guard_response(
            request,
            scope="buyer_password_reset_submit",
            contact=contact,
            contact_limit=8,
            client_limit=40,
            window_seconds=900,
        )
        if auth_guard is not None:
            return auth_guard
        account = await self.store.reset_buyer_password_with_code(contact, reset_code, password, buyer_key)
        if account is None:
            return web.json_response({"error": "invalid_reset_code"}, status=401)
        return web.json_response(
            {
                "account": self._buyer_account_payload(account),
                "buyer_key": str(account.get("buyer_key") or "").strip(),
            },
            headers={"Cache-Control": "no-store"},
        )

    async def handle_get_shop(self, request: web.Request) -> web.Response:
        shop_id = self.normalize_shop_id(request.match_info["shop_id"])
        if not shop_id:
            raise web.HTTPNotFound()
        record = await self.store.get_shop(shop_id)
        if record is None:
            raise web.HTTPNotFound(text=json.dumps({"error": "shop_not_found"}), content_type="application/json")
        return web.json_response(self._normalized_shop_record(record))

    async def handle_get_shop_console(self, request: web.Request) -> web.Response:
        shop_id = self.normalize_shop_id(request.match_info["shop_id"])
        if not shop_id:
            raise web.HTTPNotFound()
        record = await self.store.get_shop_console(shop_id)
        if record is None:
            raise web.HTTPNotFound(text=json.dumps({"error": "shop_not_found"}), content_type="application/json")
        return web.json_response(self._normalized_shop_record(record))

    async def handle_put_shop_console(self, request: web.Request) -> web.Response:
        shop_id = self.normalize_shop_id(request.match_info["shop_id"])
        if not shop_id:
            raise web.HTTPNotFound()
        try:
            payload = await request.json()
        except json.JSONDecodeError:
            return web.json_response({"error": "invalid_json"}, status=400)
        if not isinstance(payload, dict):
            return web.json_response({"error": "invalid_payload"}, status=400)
        console_payload = payload.get("console", payload)
        if not isinstance(console_payload, dict):
            return web.json_response({"error": "invalid_console"}, status=400)
        record = await self.store.save_shop_console(shop_id, console_payload)
        if record is None:
            raise web.HTTPNotFound(text=json.dumps({"error": "shop_not_found"}), content_type="application/json")
        return web.json_response(self._normalized_shop_record(record))

    async def handle_list_buyer_orders(self, request: web.Request) -> web.Response:
        buyer_key = str(request.query.get("buyer_key") or "").strip()[:160]
        buyer_account_id = str(request.query.get("buyer_account_id") or request.query.get("account_id") or "").strip()[:64]
        buyer_account_token = str(request.query.get("buyer_account_token") or request.query.get("account_token") or "").strip()[:255]
        buyer_account: Optional[Dict[str, str]] = None
        if buyer_account_id or buyer_account_token:
            buyer_account = await self.store.verify_buyer_token(buyer_account_id, buyer_account_token)
            if buyer_account is None:
                return web.json_response({"error": "invalid_buyer_account"}, status=401)
            buyer_account_id = str(buyer_account.get("account_id") or "").strip()[:64]
            buyer_key = buyer_key or str(buyer_account.get("buyer_key") or "").strip()[:160]
        if not buyer_key and not buyer_account_id:
            return web.json_response({"error": "buyer_key_required"}, status=400)
        limit = self.store._safe_int(request.query.get("limit"), minimum=1, maximum=100)
        orders = await self.store.list_orders_for_buyer(
            buyer_key=buyer_key,
            buyer_account_id=buyer_account_id,
            limit=limit,
        )
        return web.json_response(
            {"buyer_key": buyer_key, "buyer_account_id": buyer_account_id, "orders": orders},
            headers={"Cache-Control": "no-cache"},
        )

    async def handle_list_item_library(self, request: web.Request) -> web.Response:
        limit = self.store._safe_int(request.query.get("limit"), minimum=1, maximum=1000)
        items = await self.store.list_item_library(limit=limit)
        return web.json_response({"items": items}, headers={"Cache-Control": "no-cache"})

    async def handle_create_shop_order(self, request: web.Request) -> web.Response:
        shop_id = self.normalize_shop_id(request.match_info["shop_id"])
        if not shop_id:
            raise web.HTTPNotFound()
        try:
            payload = await request.json()
        except json.JSONDecodeError:
            return web.json_response({"error": "invalid_json"}, status=400)
        if not isinstance(payload, dict):
            return web.json_response({"error": "invalid_payload"}, status=400)

        debug_order_only = shop_id.startswith("debug-")
        console_payload: Dict[str, Any] = {}
        if not debug_order_only:
            record = await self.store.get_shop_console(shop_id)
            if record is None:
                raise web.HTTPNotFound(text=json.dumps({"error": "shop_not_found"}), content_type="application/json")

            console_payload = record.get("console", {})
            if not isinstance(console_payload, dict):
                console_payload = {}

        buyer_key = str(payload.get("buyer_key") or "").strip()[:160] or ("buyer-" + uuid.uuid4().hex[:12])
        buyer_account_id = str(payload.get("buyer_account_id") or payload.get("account_id") or "").strip()[:64]
        buyer_account_token = str(payload.get("buyer_account_token") or payload.get("account_token") or "").strip()[:255]
        buyer_account: Optional[Dict[str, str]] = None
        if buyer_account_id or buyer_account_token:
            buyer_account = await self.store.verify_buyer_token(buyer_account_id, buyer_account_token)
            if buyer_account is None:
                return web.json_response({"error": "invalid_buyer_account"}, status=401)
            buyer_key = str(buyer_account.get("buyer_key") or buyer_key).strip()[:160] or buyer_key
        buyer_name = str(payload.get("buyer_name") or "").strip()[:160]
        buyer_contact = str(payload.get("buyer_contact") or "").strip()[:255]
        if buyer_account is not None:
            buyer_name = buyer_name or str(buyer_account.get("display_name") or "").strip()[:160]
            buyer_contact = buyer_contact or str(buyer_account.get("contact") or "").strip()[:255]
        payment_label = str(payload.get("payment_label") or "").strip()[:80]
        payment_value = str(payload.get("payment_value") or "").strip()[:255]
        payment_mode = str(payload.get("payment_mode") or "").strip().lower()
        if payment_mode not in {"on_receive", "before_delivery"}:
            payment_mode = "on_receive"
        fulfillment_mode = str(payload.get("fulfillment_mode") or payload.get("fulfillmentMode") or "").strip().lower()
        if fulfillment_mode not in {"pickup", "delivery"}:
            fulfillment_mode = "delivery"
        fulfillment_label = "Pickup" if fulfillment_mode == "pickup" else "Delivery"
        notes = str(payload.get("notes") or "").strip()[:4000]
        delivery_address = str(payload.get("delivery_address") or payload.get("deliveryAddress") or "").strip()[:4000]
        pickup_address = str(payload.get("pickup_address") or payload.get("pickupAddress") or "").strip()[:4000]
        address = str(payload.get("address") or "").strip()[:4000]
        if fulfillment_mode == "pickup":
            address = pickup_address or address
        else:
            address = delivery_address or address
        delivery_lat = self.store._safe_float(payload.get("delivery_lat") or payload.get("deliveryLat"), minimum=-90, maximum=90)
        delivery_lng = self.store._safe_float(payload.get("delivery_lng") or payload.get("deliveryLng"), minimum=-180, maximum=180)
        pickup_lat = self.store._safe_float(payload.get("pickup_lat") or payload.get("pickupLat"), minimum=-90, maximum=90)
        pickup_lng = self.store._safe_float(payload.get("pickup_lng") or payload.get("pickupLng"), minimum=-180, maximum=180)
        item_id = str(payload.get("item_id") or "").strip()[:64]
        title = str(payload.get("title") or "").strip()[:160]
        total = str(payload.get("total") or "").strip()[:80]
        price = str(payload.get("price") or "").strip()[:80]
        quantity = self.store._safe_int(payload.get("quantity"), minimum=0, maximum=999999)
        client_nonce = str(payload.get("client_nonce") or "").strip()[:160]

        items = self.store._normalize_order_items(payload.get("items"))

        if not title and items:
            first_title = str(items[0].get("title") or "").strip()
            title = first_title or "Order"
            if len(items) > 1 and first_title:
                title = f"{first_title} +{len(items) - 1}"
        if quantity <= 0 and items:
            quantity = sum(max(0, int(item.get("quantity") or 0)) for item in items)
        if not notes and items:
            notes = ", ".join(
                f"{str(item.get('title') or '').strip()} x{max(0, int(item.get('quantity') or 0))}"
                for item in items
                if str(item.get("title") or "").strip()
            )[:4000]

        order_id = "ord-" + uuid.uuid4().hex[:12]
        created_order = {
            "id": order_id,
            "timestamp": int(time.time() * 1000),
            "itemId": item_id,
            "title": title or "Order",
            "quantity": quantity,
            "price": price,
            "total": total,
            "status": "payment_pending" if payment_mode == "before_delivery" else "created",
            "statusUpdatedAt": int(time.time() * 1000),
            "paymentPaid": False,
            "paymentReceived": False,
            "orderSent": False,
            "orderReceived": False,
            "clientNonce": client_nonce,
            "buyerKey": buyer_key,
            "buyerAccountId": str(buyer_account.get("account_id") or "").strip()[:64] if buyer_account else "",
            "buyerName": buyer_name,
            "buyerContact": buyer_contact,
            "paymentLabel": payment_label,
            "paymentValue": payment_value,
            "paymentMode": payment_mode,
            "fulfillmentMode": fulfillment_mode,
            "fulfillmentLabel": fulfillment_label,
            "deliveryAddress": delivery_address,
            "pickupAddress": pickup_address,
            "deliveryLat": delivery_lat,
            "deliveryLng": delivery_lng,
            "pickupLat": pickup_lat,
            "pickupLng": pickup_lng,
            "address": address,
            "notes": notes,
            "items": items,
        }
        if debug_order_only:
            return web.json_response(
                {"ok": True, "order": created_order, "buyer_key": buyer_key, "debug": True, "mailDelivery": {"sent": False, "target": ""}},
                headers={"Cache-Control": "no-cache"},
            )

        orders = console_payload.get("orders")
        if not isinstance(orders, list):
            orders = []
        orders.insert(0, created_order)
        console_payload["orders"] = orders
        saved = await self.store.save_shop_console(shop_id, console_payload)
        if saved is None:
            raise web.HTTPNotFound(text=json.dumps({"error": "shop_not_found"}), content_type="application/json")
        profile = console_payload.get("profile") if isinstance(console_payload.get("profile"), dict) else {}
        shop_name = str(profile.get("name") or shop_id).strip()[:160]
        mail_delivery: Dict[str, Any] = {"sent": False, "target": "", "configured": bool(self.smtp_config.configured)}
        if fulfillment_mode == "pickup":
            to_address = self._email_address_from_contact(buyer_contact)
            mail_delivery["target"] = "buyer" if to_address else ""
        else:
            to_address = self._email_address_from_contact(str(profile.get("contact") or ""))
            mail_delivery["target"] = "seller" if to_address else ""
        if to_address and self.smtp_config.configured:
            try:
                mail_delivery["sent"] = await self._send_order_email(
                    to_address=to_address,
                    order=created_order,
                    target=str(mail_delivery["target"] or ""),
                    shop_name=shop_name,
                )
            except Exception:
                mail_delivery["error"] = "email_delivery_failed"
        return web.json_response(
            {"ok": True, "order": created_order, "buyer_key": buyer_key, "mailDelivery": mail_delivery},
            headers={"Cache-Control": "no-cache"},
        )

    async def handle_cancel_shop_order(self, request: web.Request) -> web.Response:
        shop_id = self.normalize_shop_id(request.match_info["shop_id"])
        order_id = str(request.match_info.get("order_id") or "").strip()[:64]
        if not shop_id or not order_id:
            raise web.HTTPNotFound()
        try:
            payload = await request.json()
        except json.JSONDecodeError:
            payload = {}
        if not isinstance(payload, dict):
            return web.json_response({"error": "invalid_payload"}, status=400)
        buyer_key = str(payload.get("buyer_key") or "").strip()[:160]
        buyer_account_id = str(payload.get("buyer_account_id") or payload.get("account_id") or "").strip()[:64]
        buyer_account_token = str(payload.get("buyer_account_token") or payload.get("account_token") or "").strip()[:255]
        buyer_account: Optional[Dict[str, str]] = None
        if buyer_account_id or buyer_account_token:
            buyer_account = await self.store.verify_buyer_token(buyer_account_id, buyer_account_token)
            if buyer_account is None:
                return web.json_response({"error": "invalid_buyer_account"}, status=401)
            buyer_key = buyer_key or str(buyer_account.get("buyer_key") or "").strip()[:160]
        if not buyer_key and buyer_account is None:
            return web.json_response({"error": "buyer_key_required"}, status=400)

        record = await self.store.get_shop_console(shop_id)
        if record is None:
            raise web.HTTPNotFound(text=json.dumps({"error": "shop_not_found"}), content_type="application/json")
        console_payload = record.get("console", {})
        if not isinstance(console_payload, dict):
            console_payload = {}
        orders = console_payload.get("orders")
        if not isinstance(orders, list):
            orders = []

        order_index = -1
        for index, order in enumerate(orders):
            if isinstance(order, dict) and str(order.get("id") or "").strip() == order_id:
                order_index = index
                break
        if order_index < 0:
            return web.json_response({"error": "order_not_found"}, status=404)

        current_order = orders[order_index] if isinstance(orders[order_index], dict) else {}
        order_buyer_key = str(current_order.get("buyerKey") or "").strip()
        order_account_id = str(current_order.get("buyerAccountId") or current_order.get("accountId") or "").strip()
        account_matches = bool(
            buyer_account
            and order_account_id
            and order_account_id == str(buyer_account.get("account_id") or "").strip()
        )
        if order_buyer_key != buyer_key and not account_matches:
            return web.json_response({"error": "order_not_found"}, status=404)
        current_status = self.store._normalize_order_status(
            current_order.get("status"),
            current_order.get("paymentMode"),
            current_order,
        )
        if current_status in {"ready", "paid", "completed", "cancelled"}:
            return web.json_response({"error": "order_cannot_cancel", "status": current_status}, status=409)

        cancelled_order = dict(current_order)
        cancelled_order["status"] = "cancelled"
        cancelled_order["cancelledAt"] = int(time.time() * 1000)
        cancelled_order["statusUpdatedAt"] = int(time.time() * 1000)
        orders[order_index] = cancelled_order
        console_payload["orders"] = orders
        saved = await self.store.save_shop_console(shop_id, console_payload)
        if saved is None:
            raise web.HTTPNotFound(text=json.dumps({"error": "shop_not_found"}), content_type="application/json")
        return web.json_response(
            {"ok": True, "order": {**cancelled_order, "shopId": shop_id}},
            headers={"Cache-Control": "no-cache"},
        )

    async def handle_upload_shop_logo(self, request: web.Request) -> web.Response:
        shop_id = self.normalize_shop_id(request.match_info["shop_id"])
        if not shop_id:
            raise web.HTTPNotFound()
        existing = await self.store.get_shop_console(shop_id)
        if existing is None:
            raise web.HTTPNotFound(text=json.dumps({"error": "shop_not_found"}), content_type="application/json")

        try:
            reader = await request.multipart()
        except AssertionError:
            return web.json_response({"error": "multipart_required"}, status=400)

        field = await reader.next()
        if field is None or field.name != "file":
            return web.json_response({"error": "file_required"}, status=400)

        content_type = str(field.headers.get("Content-Type") or "").strip().lower()
        extension = self._logo_extension(field.filename, content_type)
        if not extension:
            return web.json_response({"error": "invalid_image_type"}, status=400)

        data = bytearray()
        max_size = 5 * 1024 * 1024
        while True:
            chunk = await field.read_chunk()
            if not chunk:
                break
            data.extend(chunk)
            if len(data) > max_size:
                return web.json_response({"error": "file_too_large"}, status=413)

        if not data:
            return web.json_response({"error": "empty_file"}, status=400)

        file_name = f"{shop_id}-{uuid.uuid4().hex[:12]}{extension}"
        file_path = self.uploads_dir / file_name
        file_path.write_bytes(bytes(data))

        console_payload = existing["console"]
        previous_logo = str(console_payload.get("profile", {}).get("logoFile") or "").strip()
        console_payload.setdefault("profile", {})["logoFile"] = file_name
        record = await self.store.save_shop_console(shop_id, console_payload)
        if previous_logo and previous_logo != file_name:
            old_path = self._logo_path(previous_logo)
            if old_path.exists():
                old_path.unlink(missing_ok=True)
        if record is None:
            raise web.HTTPNotFound(text=json.dumps({"error": "shop_not_found"}), content_type="application/json")
        return web.json_response(record)

    async def handle_upload_item_image(self, request: web.Request) -> web.Response:
        shop_id = self.normalize_shop_id(request.match_info["shop_id"])
        item_id = str(request.match_info.get("item_id") or "").strip()[:64]
        if not shop_id or not item_id:
            raise web.HTTPNotFound()
        existing = await self.store.get_shop_console(shop_id)
        if existing is None:
            raise web.HTTPNotFound(text=json.dumps({"error": "shop_not_found"}), content_type="application/json")

        try:
            reader = await request.multipart()
        except AssertionError:
            return web.json_response({"error": "multipart_required"}, status=400)

        field = await reader.next()
        if field is None or field.name != "file":
            return web.json_response({"error": "file_required"}, status=400)

        content_type = str(field.headers.get("Content-Type") or "").strip().lower()
        extension = self._logo_extension(field.filename, content_type)
        if not extension:
            return web.json_response({"error": "invalid_image_type"}, status=400)

        data = bytearray()
        max_size = 5 * 1024 * 1024
        while True:
            chunk = await field.read_chunk()
            if not chunk:
                break
            data.extend(chunk)
            if len(data) > max_size:
                return web.json_response({"error": "file_too_large"}, status=413)

        if not data:
            return web.json_response({"error": "empty_file"}, status=400)

        console_payload = existing["console"]
        listings = console_payload.get("listings")
        if not isinstance(listings, list):
            listings = []
        item_index = next(
            (index for index, item in enumerate(listings) if isinstance(item, dict) and str(item.get("id") or "").strip() == item_id),
            -1,
        )
        if item_index < 0:
            return web.json_response({"error": "item_not_found"}, status=404)

        file_name = f"{shop_id}-item-{uuid.uuid4().hex[:12]}{extension}"
        file_path = self._asset_path(file_name)
        file_path.write_bytes(bytes(data))

        item_record = dict(listings[item_index])
        images_raw = item_record.get("imageFiles") or []
        next_images: List[str] = []
        if isinstance(images_raw, list):
            for image in images_raw[:7]:
                value = str(image).strip()[:255]
                if value:
                    next_images.append(value)
        next_images.insert(0, file_name)
        item_record["imageFiles"] = next_images[:8]
        listings[item_index] = item_record
        console_payload["listings"] = listings
        record = await self.store.save_shop_console(shop_id, console_payload)
        if record is None:
            raise web.HTTPNotFound(text=json.dumps({"error": "shop_not_found"}), content_type="application/json")
        return web.json_response(record)

    async def handle_get_shop_logo(self, request: web.Request) -> web.StreamResponse:
        shop_id = self.normalize_shop_id(request.match_info["shop_id"])
        if not shop_id:
            raise web.HTTPNotFound()
        record = await self.store.get_shop_console(shop_id)
        if record is None:
            raise web.HTTPNotFound()
        logo_file = str(record.get("console", {}).get("profile", {}).get("logoFile") or "").strip()
        if not logo_file:
            raise web.HTTPNotFound()
        logo_path = self._logo_path(logo_file)
        if not logo_path.exists() or not logo_path.is_file():
            raise web.HTTPNotFound()
        mime_type = mimetypes.guess_type(str(logo_path.name))[0] or "application/octet-stream"
        return web.FileResponse(logo_path, headers={"Content-Type": mime_type, "Cache-Control": "no-cache"})

    async def handle_get_uploaded_asset(self, request: web.Request) -> web.StreamResponse:
        asset_name = Path(str(request.match_info.get("file_name") or "")).name
        if not asset_name:
            raise web.HTTPNotFound()
        asset_path = self._asset_path(asset_name)
        if not asset_path.exists() or not asset_path.is_file():
            raise web.HTTPNotFound()
        mime_type = mimetypes.guess_type(str(asset_path.name))[0] or "application/octet-stream"
        return web.FileResponse(asset_path, headers={"Content-Type": mime_type, "Cache-Control": "no-cache"})

    async def handle_reverse_geocode(self, request: web.Request) -> web.Response:
        raw_lat = str(request.query.get("lat") or "").strip()
        raw_lng = str(request.query.get("lng") or "").strip()
        try:
            lat = float(raw_lat)
            lng = float(raw_lng)
        except ValueError:
            return web.json_response({"resolved": False, "address": "", "error": "invalid_coordinates"}, status=400)
        if not (-90.0 <= lat <= 90.0) or not (-180.0 <= lng <= 180.0):
            return web.json_response({"resolved": False, "address": "", "error": "invalid_coordinates"}, status=400)

        query = urlencode(
            {
                "format": "jsonv2",
                "lat": f"{lat:.6f}",
                "lon": f"{lng:.6f}",
                "zoom": "18",
                "addressdetails": "1",
            }
        )
        url = f"https://nominatim.openstreetmap.org/reverse?{query}"
        timeout = ClientTimeout(total=12.0)
        try:
            async with ClientSession(
                timeout=timeout,
                headers={"User-Agent": "Hashop/1.0 (+https://hashop.in)"},
            ) as session:
                async with session.get(url) as response:
                    if response.status != 200:
                        return web.json_response({"resolved": False, "address": ""})
                    payload = await response.json()
        except Exception:
            return web.json_response({"resolved": False, "address": ""})

        address = str(payload.get("display_name") or "").strip()[:4000]
        return web.json_response(
            {
                "resolved": bool(address),
                "address": address,
                "lat": f"{lat:.6f}",
                "lng": f"{lng:.6f}",
            }
        )

    async def handle_list_shops(self, request: web.Request) -> web.Response:
        raw_limit = request.query.get("limit", "100")
        try:
            limit = int(raw_limit)
        except ValueError:
            limit = 100
        shops = [self._normalized_shop_record(shop) for shop in await self.store.list_shops(limit=limit)]
        return web.json_response({"shops": shops})

    async def handle_tunnel(self, request: web.Request) -> web.StreamResponse:
        shop_id = request.match_info["shop_id"]
        websocket = web.WebSocketResponse(heartbeat=20.0)
        await websocket.prepare(request)

        previous = self.sessions.get(shop_id)
        if previous is not None and previous.websocket is not websocket:
            await previous.websocket.close(code=1012, message=b"replaced")

        session = TunnelSession(shop_id=shop_id, websocket=websocket)
        self.sessions[shop_id] = session

        try:
            async for message in websocket:
                if message.type != WSMsgType.TEXT:
                    if message.type == WSMsgType.ERROR:
                        break
                    continue
                await self._handle_tunnel_message(session, message.data)
        finally:
            current = self.sessions.get(shop_id)
            if current is session:
                self.sessions.pop(shop_id, None)
            for request_id in list(session.pending_ids):
                future = self.pending.pop(request_id, None)
                if future is not None and not future.done():
                    future.set_exception(ConnectionError(f"tunnel_closed:{shop_id}"))
            session.pending_ids.clear()

        return websocket

    async def _handle_tunnel_message(self, session: TunnelSession, raw_text: str) -> None:
        try:
            message = json.loads(raw_text)
        except json.JSONDecodeError:
            return
        if message.get("type") != "response":
            return
        request_id = str(message.get("request_id", "")).strip()
        if not request_id:
            return
        future = self.pending.pop(request_id, None)
        session.pending_ids.discard(request_id)
        if future is not None and not future.done():
            future.set_result(message)

    async def _proxy_shop_request(
        self,
        request: web.Request,
        debug_page: str = "",
    ) -> web.Response:
        shop_id = request.match_info["shop_id"]
        session = self.sessions.get(shop_id)
        if session is None or session.websocket.closed:
            return web.json_response({"error": "shop_offline", "shop_id": shop_id}, status=503)

        path = "/" + request.match_info.get("tail", "")
        if not request.match_info.get("tail"):
            path = "/"
        if request.query_string:
            path = f"{path}?{request.query_string}"

        request_id = uuid.uuid4().hex
        future: asyncio.Future = asyncio.get_running_loop().create_future()
        self.pending[request_id] = future
        session.pending_ids.add(request_id)

        outgoing = {
            "type": "request",
            "request_id": request_id,
            "method": request.method,
            "path": path,
            "headers": self._request_headers(request),
            "body_base64": base64.b64encode(await request.read()).decode("ascii"),
        }

        try:
            async with session.send_lock:
                if session.websocket.closed:
                    raise ConnectionError("tunnel_closed")
                await session.websocket.send_str(json.dumps(outgoing))
            incoming = await asyncio.wait_for(future, timeout=self.request_timeout)
        except asyncio.TimeoutError:
            self.pending.pop(request_id, None)
            session.pending_ids.discard(request_id)
            return web.json_response({"error": "upstream_timeout"}, status=504)
        except ConnectionError:
            self.pending.pop(request_id, None)
            session.pending_ids.discard(request_id)
            return web.json_response({"error": "shop_offline", "shop_id": shop_id}, status=503)

        response = self._build_response(incoming)
        if not debug_page:
            return response

        content_type = response.headers.get("Content-Type", "")
        if "text/html" not in content_type.lower():
            return response

        try:
            html = response.body.decode(response.charset or "utf-8", errors="replace")
        except Exception:
            html = response.text if isinstance(response.text, str) else ""
        if not html:
            return response

        html = self._inject_debug_overlay(html, debug_page)
        debug_response = web.Response(
            status=response.status,
            text=html,
            content_type="text/html",
            charset="utf-8",
        )
        for name, value in response.headers.items():
            lowered = str(name).lower()
            if lowered in {"content-type", "content-length"}:
                continue
            debug_response.headers[name] = value
        return debug_response

    async def handle_shop_request(self, request: web.Request) -> web.Response:
        return await self._proxy_shop_request(request)

    def _request_headers(self, request: web.Request) -> Dict[str, list]:
        headers: Dict[str, list] = {}
        for name, value in request.headers.items():
            if name.lower() in HOP_BY_HOP_HEADERS or name.lower() == "host":
                continue
            headers.setdefault(name, []).append(value)
        return headers

    def _build_response(self, incoming: Dict[str, object]) -> web.Response:
        status = int(incoming.get("status", 502))
        body_base64 = str(incoming.get("body_base64", "") or "")
        try:
            body = base64.b64decode(body_base64) if body_base64 else b""
        except Exception:
            body = b""

        response = web.Response(status=status, body=body)
        headers = incoming.get("headers")
        if isinstance(headers, dict):
            for name, values in headers.items():
                if not name or str(name).lower() in HOP_BY_HOP_HEADERS:
                    continue
                if isinstance(values, list):
                    for value in values:
                        if value is not None:
                            response.headers.add(str(name), str(value))
                elif values is not None:
                    response.headers.add(str(name), str(values))
        return response

    @classmethod
    def normalize_shop_id(cls, value: str) -> str:
        shop_id = cls.SHOP_ID_PATTERN.sub("-", value.strip().lower()).strip("-")
        return shop_id[:63]

    def _asset_path(self, file_name: str) -> Path:
        return self.uploads_dir / Path(file_name).name

    def _logo_path(self, logo_file: str) -> Path:
        return self._asset_path(logo_file)

    def _serve_site_html(
        self,
        file_name: str,
        bootstrap: Optional[Dict[str, object]] = None,
        debug_page: str = "",
    ) -> web.Response:
        page_file = self.site_dir / file_name
        if not page_file.exists():
            raise web.HTTPNotFound()

        html = page_file.read_text(encoding="utf-8")
        if bootstrap is not None:
            html = html.replace(
                "__HASHOP_BOOTSTRAP__",
                json.dumps(bootstrap, separators=(",", ":")),
            )
        if debug_page:
            html = self._inject_debug_overlay(html, debug_page)
        return web.Response(
            text=html,
            content_type="text/html",
            headers={"Cache-Control": "no-cache"},
        )

    def _serve_site_asset(self, file_name: str, content_type: str = "") -> web.FileResponse:
        asset_file = self.site_dir / Path(file_name).name
        if not asset_file.exists() or not asset_file.is_file():
            raise web.HTTPNotFound()
        headers = {"Cache-Control": "public, max-age=86400"}
        response = web.FileResponse(asset_file, headers=headers)
        if content_type:
            response.content_type = content_type
        return response

    async def handle_favicon(self, request: web.Request) -> web.FileResponse:
        return self._serve_site_asset("favicon.ico", "image/x-icon")

    @staticmethod
    def _inject_debug_overlay(html: str, debug_page: str) -> str:
        head_snippet = (
            '\n  <link rel="stylesheet" href="/site/debug.css?v=debug-20260506a">'
            f'\n  <script>window.__HASHOP_DEBUG_PAGE__ = {json.dumps(debug_page)};</script>'
        )
        body_snippet = '\n  <script src="/site/debug.js?v=debug-20260506a" defer></script>'
        if "</head>" in html:
            html = html.replace("</head>", head_snippet + "\n</head>", 1)
        if "</body>" in html:
            html = html.replace("</body>", body_snippet + "\n</body>", 1)
        return html

    @staticmethod
    def _logo_extension(filename: Optional[str], content_type: str) -> str:
        allowed = {
            "image/png": ".png",
            "image/jpeg": ".jpg",
            "image/jpg": ".jpg",
            "image/webp": ".webp",
            "image/gif": ".gif",
        }
        if content_type in allowed:
            return allowed[content_type]
        guessed = ""
        if filename:
            guessed = Path(filename).suffix.lower()
        if guessed in {".png", ".jpg", ".jpeg", ".webp", ".gif"}:
            return ".jpg" if guessed == ".jpeg" else guessed
        return ""


def build_app(
    public_base_url: str,
    request_timeout: float,
    site_dir: Path,
    shop_db: Path,
    uploads_dir: Path,
    public_shop_create_enabled: bool = True,
    owner_reset_code: str = "",
    smtp_config: Optional[SmtpConfig] = None,
    expose_reset_codes: Optional[bool] = None,
) -> web.Application:
    store = ShopStore(db_path=shop_db)
    hub = HashopHub(
        public_base_url=public_base_url,
        request_timeout=request_timeout,
        site_dir=site_dir,
        store=store,
        uploads_dir=uploads_dir,
        public_shop_create_enabled=public_shop_create_enabled,
        owner_reset_code=owner_reset_code,
        smtp_config=smtp_config,
        expose_reset_codes=expose_reset_codes,
    )
    app = web.Application()
    app.on_startup.append(lambda _app: store.initialize())
    app.router.add_get("/", hub.handle_index)
    app.router.add_get("/home-debug", hub.handle_index_debug)
    app.router.add_get("/login", hub.handle_login_page)
    app.router.add_get("/account", hub.handle_account_page)
    app.router.add_get("/account/{tail:.*}", hub.handle_account_page)
    app.router.add_get("/orders", hub.handle_orders_page)
    app.router.add_get("/cart", hub.handle_orders_page)
    app.router.add_get("/home", hub.handle_index)
    app.router.add_get("/shops", hub.handle_index)
    app.router.add_get("/items", hub.handle_index)
    app.router.add_get("/search", hub.handle_index)
    app.router.add_get("/contact", hub.handle_index)
    app.router.add_get("/call", hub.handle_index)
    app.router.add_get("/setup", hub.handle_setup_page)
    app.router.add_get("/concept", hub.handle_concept_page)
    app.router.add_get("/concept/{tail:.*}", hub.handle_concept_page)
    app.router.add_get("/exp", hub.handle_exp_page)
    app.router.add_get("/about", hub.handle_about_page)
    app.router.add_get("/privacy", hub.handle_privacy_page)
    app.router.add_get("/policies", hub.handle_privacy_page)
    app.router.add_get("/login-debug", hub.handle_login_page_debug)
    app.router.add_get("/cloud", hub.handle_cloud)
    app.router.add_get("/cloud-debug", hub.handle_cloud_debug)
    app.router.add_get("/debug-dropdown", hub.handle_debug_dropdown_removed)
    app.router.add_get("/api/debug/codex/status", hub.handle_debug_codex_status)
    app.router.add_post("/api/debug/codex/process", hub.handle_debug_codex_process)
    app.router.add_get("/hashop", hub.handle_hashop)
    app.router.add_get("/hashop-debug", hub.handle_hashop_debug)
    app.router.add_get("/healthz", hub.handle_health)
    app.router.add_get("/favicon.ico", hub.handle_favicon)
    app.router.add_get("/api/meta", hub.handle_meta)
    app.router.add_get("/api/orders", hub.handle_list_buyer_orders)
    app.router.add_get("/api/items/library", hub.handle_list_item_library)
    app.router.add_get("/api/payment-options", hub.handle_payment_options)
    app.router.add_get("/api/shops", hub.handle_list_shops)
    app.router.add_post("/api/shops", hub.handle_create_shop)
    app.router.add_post("/api/auth/login", hub.handle_login)
    app.router.add_post("/api/shops/{shop_id}/recovery-contacts", hub.handle_link_shop_recovery_contact)
    app.router.add_post("/api/auth/request-password-reset", hub.handle_request_shop_password_reset)
    app.router.add_post("/api/auth/reset-password", hub.handle_reset_shop_password)
    app.router.add_post("/api/buyer/signup", hub.handle_buyer_signup)
    app.router.add_post("/api/buyer/login", hub.handle_buyer_login)
    app.router.add_post("/api/buyer/request-contact-verification", hub.handle_buyer_request_contact_verification)
    app.router.add_post("/api/buyer/verify-contact", hub.handle_buyer_verify_contact)
    app.router.add_post("/api/account/help", hub.handle_account_help_request)
    app.router.add_post("/api/buyer/request-password-reset", hub.handle_buyer_request_password_reset)
    app.router.add_post("/api/buyer/reset-password", hub.handle_buyer_reset_password)
    app.router.add_post("/api/shops/register", hub.handle_register)
    app.router.add_get("/api/shops/{shop_id}", hub.handle_get_shop)
    app.router.add_get("/api/shops/{shop_id}/console", hub.handle_get_shop_console)
    app.router.add_put("/api/shops/{shop_id}/console", hub.handle_put_shop_console)
    app.router.add_post("/api/shops/{shop_id}/orders", hub.handle_create_shop_order)
    app.router.add_post("/api/shops/{shop_id}/orders/{order_id}/cancel", hub.handle_cancel_shop_order)
    app.router.add_post("/api/shops/{shop_id}/billing/map", hub.handle_update_map_unlock)
    app.router.add_post("/api/shops/{shop_id}/items/{item_id}/image", hub.handle_upload_item_image)
    app.router.add_post("/api/shops/{shop_id}/logo", hub.handle_upload_shop_logo)
    app.router.add_get("/api/assets/{file_name}", hub.handle_get_uploaded_asset)
    app.router.add_get("/api/shops/{shop_id}/logo", hub.handle_get_shop_logo)
    app.router.add_get("/api/geocode/reverse", hub.handle_reverse_geocode)
    app.router.add_get("/api/tunnel/{shop_id}", hub.handle_tunnel)
    app.router.add_route("*", "/shop-debug/{shop_id}", hub.handle_shop_debug_request)
    app.router.add_route("*", "/shop-debug/{shop_id}/{tail:.*}", hub.handle_shop_debug_request)
    app.router.add_route("*", "/shop/{shop_id}", hub.handle_shop_request)
    app.router.add_route("*", "/shop/{shop_id}/{tail:.*}", hub.handle_shop_request)
    if site_dir.exists():
        app.router.add_static("/site/", str(site_dir), show_index=False)
    app.router.add_get(r"/{shop_id:[a-z0-9][a-z0-9-]{0,62}}", hub.handle_discovery_shop_page)
    app.router.add_get(r"/{shop_id:[a-z0-9][a-z0-9-]{0,62}}/{tail:.*}", hub.handle_discovery_shop_page)
    return app


def main() -> None:
    parser = argparse.ArgumentParser(description="Lightweight Hashop relay hub")
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--port", type=int, default=8080)
    parser.add_argument("--public-base-url", required=True)
    parser.add_argument("--request-timeout", type=float, default=30.0)
    parser.add_argument("--site-dir", default=str(Path(__file__).resolve().with_name("hashop_site")))
    parser.add_argument("--shop-db", default=str(Path(__file__).resolve().with_name("hashop.sqlite3")))
    parser.add_argument("--uploads-dir", default=str(Path(__file__).resolve().with_name("hashop_uploads")))
    parser.set_defaults(public_shop_create_enabled=True)
    parser.add_argument("--allow-public-shop-create", dest="public_shop_create_enabled", action="store_true")
    parser.add_argument("--restrict-public-shop-create", dest="public_shop_create_enabled", action="store_false")
    parser.add_argument("--owner-reset-code", default=os.environ.get("HASHOP_OWNER_RESET_CODE", ""))
    args = parser.parse_args()

    app = build_app(
        public_base_url=args.public_base_url,
        request_timeout=args.request_timeout,
        site_dir=Path(args.site_dir).resolve(),
        shop_db=Path(args.shop_db).resolve(),
        uploads_dir=Path(args.uploads_dir).resolve(),
        public_shop_create_enabled=args.public_shop_create_enabled,
        owner_reset_code=args.owner_reset_code,
    )
    web.run_app(app, host=args.host, port=args.port, access_log=None)


if __name__ == "__main__":
    main()
