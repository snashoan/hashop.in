#!/usr/bin/env python3
import argparse
import asyncio
import base64
import hashlib
import hmac
import json
import mimetypes
import re
import secrets
import sqlite3
import threading
import time
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple
from urllib.parse import quote, urlencode

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


class ShopStore:
    GPS_PATTERN = re.compile(r"GPS:\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)", re.IGNORECASE)
    GPS_COORDS_PATTERN = re.compile(r"^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$")
    VALID_MAP_UNLOCK_METHODS = {"", "manual", "upi", "btc", "eth"}
    VALID_MAP_UNLOCK_STATUSES = {"not_required", "locked", "pending", "unlocked"}
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

    async def list_orders_for_buyer(self, buyer_key: str, limit: int = 50) -> List[Dict[str, Any]]:
        safe_buyer_key = str(buyer_key or "").strip()[:160]
        safe_limit = max(1, min(limit, 200))
        if not safe_buyer_key:
            return []
        return await asyncio.to_thread(self._list_orders_for_buyer_threadsafe, safe_buyer_key, safe_limit)

    def _list_orders_for_buyer_threadsafe(self, buyer_key: str, limit: int) -> List[Dict[str, Any]]:
        with self._lock:
            return self._list_orders_for_buyer_sync(buyer_key, limit)

    def _list_orders_for_buyer_sync(self, buyer_key: str, limit: int) -> List[Dict[str, Any]]:
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
                if str(order.get("buyerKey") or "").strip() != buyer_key:
                    continue
                items: List[Dict[str, Any]] = []
                items_raw = order.get("items")
                if isinstance(items_raw, list):
                    for item in items_raw[:80]:
                        if not isinstance(item, dict):
                            continue
                        items.append(
                            {
                                "id": str(item.get("id") or "").strip()[:64],
                                "title": str(item.get("title") or "").strip()[:160],
                                "quantity": self._safe_int(item.get("quantity"), minimum=0, maximum=999999),
                                "price": str(item.get("price") or "").strip()[:80],
                            }
                        )
                matches.append(
                    {
                        "id": str(order.get("id") or "").strip()[:64],
                        "timestamp": self._safe_int(order.get("timestamp"), minimum=0, maximum=9999999999999),
                        "itemId": str(order.get("itemId") or "").strip()[:64],
                        "title": str(order.get("title") or "").strip()[:160],
                        "quantity": self._safe_int(order.get("quantity"), minimum=0, maximum=999999),
                        "price": str(order.get("price") or "").strip()[:80],
                        "total": str(order.get("total") or "").strip()[:80],
                        "status": str(order.get("status") or "").strip()[:80],
                        "paymentPaid": bool(order.get("paymentPaid")),
                        "paymentReceived": bool(order.get("paymentReceived")),
                        "orderSent": bool(order.get("orderSent")),
                        "orderReceived": bool(order.get("orderReceived")),
                        "clientNonce": str(order.get("clientNonce") or "").strip()[:160],
                        "buyerKey": buyer_key,
                        "buyerName": str(order.get("buyerName") or "").strip()[:160],
                        "buyerContact": str(order.get("buyerContact") or "").strip()[:255],
                        "paymentLabel": str(order.get("paymentLabel") or "").strip()[:80],
                        "paymentValue": str(order.get("paymentValue") or "").strip()[:255],
                        "paymentMode": str(order.get("paymentMode") or "").strip()[:80],
                        "address": str(order.get("address") or "").strip()[:4000],
                        "notes": str(order.get("notes") or "").strip()[:4000],
                        "items": items,
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

    def _normalize_order_status(self, status: Any, payment_mode: Any) -> str:
        raw_status = str(status or "").strip().lower()
        raw_payment_mode = str(payment_mode or "").strip().lower()
        mode = "before_delivery" if raw_payment_mode == "before_delivery" else "on_receive"
        if raw_status in {"", "new"}:
            return "payment_pending" if mode == "before_delivery" else "created"
        if raw_status == "pending":
            return "payment_pending" if mode == "before_delivery" else "created"
        if raw_status in {"created", "payment_pending", "accepted", "ready", "paid", "completed", "cancelled"}:
            return raw_status
        return "payment_pending" if mode == "before_delivery" else "created"

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
                items_raw = order.get("items")
                normalized_items: List[Dict[str, Any]] = []
                if isinstance(items_raw, list):
                    for item in items_raw[:80]:
                        if not isinstance(item, dict):
                            continue
                        normalized_items.append(
                            {
                                "id": str(item.get("id") or "").strip()[:64],
                                "title": str(item.get("title") or "").strip()[:160],
                                "quantity": self._safe_int(item.get("quantity"), minimum=0, maximum=999999),
                                "price": str(item.get("price") or "").strip()[:80],
                            }
                        )
                normalized_orders.append(
                    {
                        "id": str(order.get("id") or uuid.uuid4().hex[:12]).strip()[:64],
                        "timestamp": self._safe_int(order.get("timestamp"), minimum=0, maximum=9999999999999),
                        "itemId": str(order.get("itemId") or "").strip()[:64],
                        "title": str(order.get("title") or "").strip()[:160],
                        "quantity": self._safe_int(order.get("quantity"), minimum=0, maximum=999999),
                        "price": str(order.get("price") or "").strip()[:80],
                        "total": str(order.get("total") or "").strip()[:80],
                        "status": self._normalize_order_status(order.get("status"), order.get("paymentMode")),
                        "paymentPaid": bool(order.get("paymentPaid")),
                        "paymentReceived": bool(order.get("paymentReceived")),
                        "orderSent": bool(order.get("orderSent")),
                        "orderReceived": bool(order.get("orderReceived")),
                        "clientNonce": str(order.get("clientNonce") or "").strip()[:160],
                        "buyerKey": str(order.get("buyerKey") or "").strip()[:160],
                        "buyerName": str(order.get("buyerName") or "").strip()[:160],
                        "buyerContact": str(order.get("buyerContact") or "").strip()[:255],
                        "paymentLabel": str(order.get("paymentLabel") or "").strip()[:80],
                        "paymentValue": str(order.get("paymentValue") or "").strip()[:255],
                        "paymentMode": str(order.get("paymentMode") or "").strip()[:80],
                        "address": str(order.get("address") or "").strip()[:4000],
                        "notes": str(order.get("notes") or "").strip()[:4000],
                        "items": normalized_items,
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
        hub_base_url = public_url
        if "/shop/" in public_url:
            hub_base_url = public_url.split("/shop/", 1)[0]
        hub_base_url = hub_base_url.rstrip("/")
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


class HashopHub:
    SHOP_ID_PATTERN = re.compile(r"[^a-z0-9]+")
    VALID_REACH_PLANS = {"free", "map"}
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
            "public_url": f"{self.public_base_url}/shop/{escaped}/",
            "tunnel_ws_url": f"{self.ws_base_url}/api/tunnel/{escaped}",
        }

    def registration_restricted_payload(self) -> Dict[str, str]:
        return {
            "error": "registration_restricted",
            "message": "Production registration is handled explicitly.",
        }

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
        index_file = self.site_dir / "index.html"
        if index_file.exists():
            bootstrap = await self.discovery_bootstrap()
            return self._serve_site_html(
                "index.html",
                bootstrap=bootstrap,
            )
        return web.json_response(self.meta_payload())

    async def handle_hashop(self, request: web.Request) -> web.Response:
        return self._serve_site_html("hashop.html")

    async def handle_cloud(self, request: web.Request) -> web.Response:
        raise web.HTTPFound("/?pane=login")

    async def handle_login_page(self, request: web.Request) -> web.Response:
        raise web.HTTPFound("/?pane=login")

    async def handle_index_debug(self, request: web.Request) -> web.Response:
        return self._serve_site_html(
            "index.html",
            bootstrap=self.debug_discovery_bootstrap(),
            debug_page="home",
        )

    async def handle_cloud_debug(self, request: web.Request) -> web.Response:
        raise web.HTTPFound("/home-debug?pane=login")

    async def handle_login_page_debug(self, request: web.Request) -> web.Response:
        raise web.HTTPFound("/home-debug?pane=login")

    async def handle_debug_dropdown_removed(self, request: web.Request) -> web.Response:
        raise web.HTTPNotFound()

    async def handle_hashop_debug(self, request: web.Request) -> web.Response:
        return self._serve_site_html("hashop.html", debug_page="hashop")

    async def handle_shop_debug_request(self, request: web.Request) -> web.Response:
        response = await self._proxy_shop_request(request, debug_page="shop")
        return response

    async def handle_meta(self, request: web.Request) -> web.Response:
        return web.json_response(
            {
                **self.meta_payload(),
                "stored_shop_count": await self.store.count_shops(),
                "recent_shops": await self.store.list_shops(limit=12),
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
        existing_console_record = await self.store.get_shop_console(shop_id)
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
        console_record = await self.store.get_shop_console(shop_id)
        if console_record is not None:
            console_payload = console_record.get("console", {})
            if not isinstance(console_payload, dict):
                console_payload = {}
            console_payload.setdefault("billing", {})["mapUnlock"] = map_unlock
            updated_console = await self.store.save_shop_console(shop_id, console_payload)
            if updated_console is not None:
                record = updated_console
        return web.json_response(
            {
                "created": created,
                "shop": record,
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
        record = await self.store.verify_shop_password(shop_id, password)
        if record is None:
            return web.json_response({"error": "invalid_login"}, status=401)
        return web.json_response(
            {
                "shop": record,
                "launch_url": f"/hashop?shop={quote(shop_id, safe='')}",
            }
        )

    async def handle_get_shop(self, request: web.Request) -> web.Response:
        shop_id = self.normalize_shop_id(request.match_info["shop_id"])
        if not shop_id:
            raise web.HTTPNotFound()
        record = await self.store.get_shop(shop_id)
        if record is None:
            raise web.HTTPNotFound(text=json.dumps({"error": "shop_not_found"}), content_type="application/json")
        return web.json_response(record)

    async def handle_get_shop_console(self, request: web.Request) -> web.Response:
        shop_id = self.normalize_shop_id(request.match_info["shop_id"])
        if not shop_id:
            raise web.HTTPNotFound()
        record = await self.store.get_shop_console(shop_id)
        if record is None:
            raise web.HTTPNotFound(text=json.dumps({"error": "shop_not_found"}), content_type="application/json")
        return web.json_response(record)

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
        return web.json_response(record)

    async def handle_list_buyer_orders(self, request: web.Request) -> web.Response:
        buyer_key = str(request.query.get("buyer_key") or "").strip()[:160]
        if not buyer_key:
            return web.json_response({"error": "buyer_key_required"}, status=400)
        limit = self.store._safe_int(request.query.get("limit"), minimum=1, maximum=100)
        orders = await self.store.list_orders_for_buyer(buyer_key, limit=limit)
        return web.json_response(
            {"buyer_key": buyer_key, "orders": orders},
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
        buyer_name = str(payload.get("buyer_name") or "").strip()[:160]
        buyer_contact = str(payload.get("buyer_contact") or "").strip()[:255]
        payment_label = str(payload.get("payment_label") or "").strip()[:80]
        payment_value = str(payload.get("payment_value") or "").strip()[:255]
        payment_mode = str(payload.get("payment_mode") or "").strip().lower()
        if payment_mode not in {"on_receive", "before_delivery"}:
            payment_mode = "on_receive"
        notes = str(payload.get("notes") or "").strip()[:4000]
        address = str(payload.get("address") or "").strip()[:4000]
        item_id = str(payload.get("item_id") or "").strip()[:64]
        title = str(payload.get("title") or "").strip()[:160]
        total = str(payload.get("total") or "").strip()[:80]
        price = str(payload.get("price") or "").strip()[:80]
        quantity = self.store._safe_int(payload.get("quantity"), minimum=0, maximum=999999)
        client_nonce = str(payload.get("client_nonce") or "").strip()[:160]

        items_raw = payload.get("items")
        items: List[Dict[str, Any]] = []
        if isinstance(items_raw, list):
            for item in items_raw[:80]:
                if not isinstance(item, dict):
                    continue
                items.append(
                    {
                        "id": str(item.get("id") or "").strip()[:64],
                        "title": str(item.get("title") or "").strip()[:160],
                        "quantity": self.store._safe_int(item.get("quantity"), minimum=0, maximum=999999),
                        "price": str(item.get("price") or "").strip()[:80],
                    }
                )

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
            "paymentPaid": False,
            "paymentReceived": False,
            "orderSent": False,
            "orderReceived": False,
            "clientNonce": client_nonce,
            "buyerKey": buyer_key,
            "buyerName": buyer_name,
            "buyerContact": buyer_contact,
            "paymentLabel": payment_label,
            "paymentValue": payment_value,
            "paymentMode": payment_mode,
            "address": address,
            "notes": notes,
            "items": items,
        }
        if debug_order_only:
            return web.json_response(
                {"ok": True, "order": created_order, "buyer_key": buyer_key, "debug": True},
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
        return web.json_response(
            {"ok": True, "order": created_order, "buyer_key": buyer_key},
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
        return web.json_response({"shops": await self.store.list_shops(limit=limit)})

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

    @staticmethod
    def _inject_debug_overlay(html: str, debug_page: str) -> str:
        head_snippet = (
            '\n  <link rel="stylesheet" href="/site/debug.css?v=debug-20260402y">'
            f'\n  <script>window.__HASHOP_DEBUG_PAGE__ = {json.dumps(debug_page)};</script>'
        )
        body_snippet = '\n  <script src="/site/debug.js?v=debug-20260402y" defer></script>'
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
) -> web.Application:
    store = ShopStore(db_path=shop_db)
    hub = HashopHub(
        public_base_url=public_base_url,
        request_timeout=request_timeout,
        site_dir=site_dir,
        store=store,
        uploads_dir=uploads_dir,
        public_shop_create_enabled=public_shop_create_enabled,
    )
    app = web.Application()
    app.on_startup.append(lambda _app: store.initialize())
    app.router.add_get("/", hub.handle_index)
    app.router.add_get("/home-debug", hub.handle_index_debug)
    app.router.add_get("/login", hub.handle_login_page)
    app.router.add_get("/login-debug", hub.handle_login_page_debug)
    app.router.add_get("/cloud", hub.handle_cloud)
    app.router.add_get("/cloud-debug", hub.handle_cloud_debug)
    app.router.add_get("/debug-dropdown", hub.handle_debug_dropdown_removed)
    app.router.add_get("/hashop", hub.handle_hashop)
    app.router.add_get("/hashop-debug", hub.handle_hashop_debug)
    app.router.add_get("/healthz", hub.handle_health)
    app.router.add_get("/api/meta", hub.handle_meta)
    app.router.add_get("/api/orders", hub.handle_list_buyer_orders)
    app.router.add_get("/api/items/library", hub.handle_list_item_library)
    app.router.add_get("/api/payment-options", hub.handle_payment_options)
    app.router.add_get("/api/shops", hub.handle_list_shops)
    app.router.add_post("/api/shops", hub.handle_create_shop)
    app.router.add_post("/api/auth/login", hub.handle_login)
    app.router.add_post("/api/shops/register", hub.handle_register)
    app.router.add_get("/api/shops/{shop_id}", hub.handle_get_shop)
    app.router.add_get("/api/shops/{shop_id}/console", hub.handle_get_shop_console)
    app.router.add_put("/api/shops/{shop_id}/console", hub.handle_put_shop_console)
    app.router.add_post("/api/shops/{shop_id}/orders", hub.handle_create_shop_order)
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
    args = parser.parse_args()

    app = build_app(
        public_base_url=args.public_base_url,
        request_timeout=args.request_timeout,
        site_dir=Path(args.site_dir).resolve(),
        shop_db=Path(args.shop_db).resolve(),
        uploads_dir=Path(args.uploads_dir).resolve(),
        public_shop_create_enabled=args.public_shop_create_enabled,
    )
    web.run_app(app, host=args.host, port=args.port, access_log=None)


if __name__ == "__main__":
    main()
