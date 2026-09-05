# -*- coding: utf-8 -*-
"""星屿 SQLite 数据层。

当前阶段使用“结构化文档表”：
- `records` 保存课程 / 任务 / 笔记 / 记录等数组实体；
- `profile` 与 `settings` 保存单对象；
- `payload` 是前端 Store 兼容的数据字段；
- `updated_at / deleted_at / version / device_id` 为后续多设备同步准备。

这个方案的好处是迁移零字段丢失；后续如果某个实体查询变复杂，
可以在不改前端协议的前提下，为它增加专用索引或视图。
"""

from __future__ import annotations

import json
import os
import sqlite3
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Any, Dict, Iterable, List, Optional

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(ROOT_DIR, "data")
DB_PATH = os.path.join(DATA_DIR, "platform.db")
STATE_PATH = os.path.join(DATA_DIR, "platform-state.json")

SCHEMA_VERSION = 4
ARRAY_KEYS = [
    "courses", "tasks", "notes", "cards", "pomodoros", "exams",
    "grades", "skills", "projects", "literature", "running", "trash",
]
SINGLE_KEYS = ["profile", "settings"]

_SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS platform_meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS profile (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    payload TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    device_id TEXT
);

CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    payload TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    device_id TEXT
);

CREATE TABLE IF NOT EXISTS records (
    entity TEXT NOT NULL,
    id TEXT NOT NULL,
    payload TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT,
    version INTEGER NOT NULL DEFAULT 1,
    device_id TEXT,
    PRIMARY KEY (entity, id)
);

CREATE INDEX IF NOT EXISTS idx_records_entity_updated
    ON records (entity, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_records_updated
    ON records (updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_records_deleted
    ON records (entity, deleted_at);
"""


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def _ensure_parent(path: str) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)


@contextmanager
def connect(db_path: str = DB_PATH):
    _ensure_parent(db_path)
    conn = sqlite3.connect(db_path, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA busy_timeout = 5000")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db(db_path: str = DB_PATH) -> None:
    """初始化数据库结构。SQLite 使用 WAL，提升多线程读取和崩溃恢复能力。"""
    with connect(db_path) as conn:
        conn.executescript(_SCHEMA_SQL)
        conn.execute("PRAGMA journal_mode = WAL")
        conn.execute(
            "INSERT INTO platform_meta(key, value) VALUES('schemaVersion', ?) "
            "ON CONFLICT(key) DO UPDATE SET value=excluded.value",
            (str(SCHEMA_VERSION),),
        )


def _decode_payload(raw: str) -> Dict[str, Any]:
    value = json.loads(raw)
    return value if isinstance(value, dict) else {}


def _read_single(conn: sqlite3.Connection, table: str) -> Optional[Dict[str, Any]]:
    row = conn.execute(f"SELECT payload FROM {table} WHERE id = 1").fetchone()
    return _decode_payload(row["payload"]) if row else None


def _upsert_single(
    conn: sqlite3.Connection,
    table: str,
    value: Dict[str, Any],
    device_id: Optional[str] = None,
) -> Dict[str, Any]:
    row = conn.execute(f"SELECT payload, version FROM {table} WHERE id = 1").fetchone()
    version = (row["version"] if row else 0) + 1
    conn.execute(
        f"""
        INSERT INTO {table}(id, payload, updated_at, version, device_id)
        VALUES(1, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            payload = excluded.payload,
            updated_at = excluded.updated_at,
            version = excluded.version,
            device_id = excluded.device_id
        """,
        (json.dumps(value, ensure_ascii=False, separators=(",", ":")), _utc_now(), version, device_id),
    )
    return value


def _new_id() -> str:
    return uuid.uuid4().hex


def list_items(
    entity: str,
    include_deleted: bool = False,
    db_path: str = DB_PATH,
) -> List[Dict[str, Any]]:
    if entity not in ARRAY_KEYS:
        raise ValueError(f"unknown entity: {entity}")
    with connect(db_path) as conn:
        if include_deleted:
            rows = conn.execute(
                "SELECT payload FROM records WHERE entity = ? ORDER BY created_at, id",
                (entity,),
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT payload FROM records WHERE entity = ? AND deleted_at IS NULL ORDER BY created_at, id",
                (entity,),
            ).fetchall()
        return [_decode_payload(row["payload"]) for row in rows]


def upsert_item(
    entity: str,
    item: Dict[str, Any],
    device_id: Optional[str] = None,
    db_path: str = DB_PATH,
) -> Dict[str, Any]:
    if entity not in ARRAY_KEYS:
        raise ValueError(f"unknown entity: {entity}")
    if not isinstance(item, dict):
        raise ValueError("item must be an object")

    item = dict(item)
    item_id = str(item.get("id") or _new_id())
    item["id"] = item_id
    now = _utc_now()

    with connect(db_path) as conn:
        row = conn.execute(
            "SELECT created_at, version FROM records WHERE entity = ? AND id = ?",
            (entity, item_id),
        ).fetchone()
        version = (row["version"] if row else 0) + 1
        created_at = row["created_at"] if row else now
        conn.execute(
            """
            INSERT INTO records(entity, id, payload, created_at, updated_at, deleted_at, version, device_id)
            VALUES(?, ?, ?, ?, ?, NULL, ?, ?)
            ON CONFLICT(entity, id) DO UPDATE SET
                payload = excluded.payload,
                updated_at = excluded.updated_at,
                deleted_at = NULL,
                version = excluded.version,
                device_id = excluded.device_id
            """,
            (
                entity,
                item_id,
                json.dumps(item, ensure_ascii=False, separators=(",", ":")),
                created_at,
                now,
                version,
                device_id,
            ),
        )
    return item


def patch_item(
    entity: str,
    item_id: str,
    patch: Dict[str, Any],
    device_id: Optional[str] = None,
    db_path: str = DB_PATH,
) -> Optional[Dict[str, Any]]:
    if entity not in ARRAY_KEYS:
        raise ValueError(f"unknown entity: {entity}")
    if not isinstance(patch, dict):
        raise ValueError("patch must be an object")

    with connect(db_path) as conn:
        row = conn.execute(
            "SELECT payload, created_at, version FROM records WHERE entity = ? AND id = ?",
            (entity, str(item_id)),
        ).fetchone()
        if not row:
            return None
        item = _decode_payload(row["payload"])
        item.update(patch)
        item["id"] = str(item_id)
        version = row["version"] + 1
        conn.execute(
            """
            UPDATE records
            SET payload = ?, updated_at = ?, deleted_at = NULL, version = ?, device_id = ?
            WHERE entity = ? AND id = ?
            """,
            (
                json.dumps(item, ensure_ascii=False, separators=(",", ":")),
                _utc_now(),
                version,
                device_id,
                entity,
                str(item_id),
            ),
        )
        return item


def delete_item(
    entity: str,
    item_id: str,
    hard: bool = False,
    device_id: Optional[str] = None,
    db_path: str = DB_PATH,
) -> bool:
    if entity not in ARRAY_KEYS:
        raise ValueError(f"unknown entity: {entity}")
    with connect(db_path) as conn:
        if hard:
            cursor = conn.execute(
                "DELETE FROM records WHERE entity = ? AND id = ?",
                (entity, str(item_id)),
            )
            return cursor.rowcount > 0

        cursor = conn.execute(
            """
            UPDATE records
            SET deleted_at = ?, updated_at = ?, version = version + 1, device_id = ?
            WHERE entity = ? AND id = ? AND deleted_at IS NULL
            """,
            (_utc_now(), _utc_now(), device_id, entity, str(item_id)),
        )
        return cursor.rowcount > 0


def upsert_items(
    entity: str,
    items: Iterable[Dict[str, Any]],
    device_id: Optional[str] = None,
    db_path: str = DB_PATH,
) -> List[Dict[str, Any]]:
    result: List[Dict[str, Any]] = []
    for item in items:
        result.append(upsert_item(entity, item, device_id=device_id, db_path=db_path))
    return result


def get_profile(db_path: str = DB_PATH) -> Dict[str, Any]:
    with connect(db_path) as conn:
        return _read_single(conn, "profile") or {}


def set_profile(value: Dict[str, Any], device_id: Optional[str] = None, db_path: str = DB_PATH) -> Dict[str, Any]:
    if not isinstance(value, dict):
        raise ValueError("profile must be an object")
    with connect(db_path) as conn:
        return _upsert_single(conn, "profile", value, device_id=device_id)


def get_settings(db_path: str = DB_PATH) -> Dict[str, Any]:
    with connect(db_path) as conn:
        return _read_single(conn, "settings") or {}


def set_settings(value: Dict[str, Any], device_id: Optional[str] = None, db_path: str = DB_PATH) -> Dict[str, Any]:
    if not isinstance(value, dict):
        raise ValueError("settings must be an object")
    with connect(db_path) as conn:
        return _upsert_single(conn, "settings", value, device_id=device_id)


def bootstrap(db_path: str = DB_PATH) -> Dict[str, Any]:
    """返回前端 Store 当前兼容的完整快照。"""
    return {
        "schemaVersion": SCHEMA_VERSION,
        "profile": get_profile(db_path),
        "settings": get_settings(db_path),
        **{key: list_items(key, db_path=db_path) for key in ARRAY_KEYS},
        **state_info(db_path),
    }


def import_snapshot(
    snapshot: Dict[str, Any],
    replace: bool = False,
    device_id: Optional[str] = None,
    db_path: str = DB_PATH,
    prune_missing: bool = False,
) -> Dict[str, Any]:
    """导入旧 Store 快照。默认合并；replace=True 会清空业务记录。"""
    if not isinstance(snapshot, dict):
        raise ValueError("snapshot must be an object")

    init_db(db_path)
    counts: Dict[str, int] = {}

    with connect(db_path) as conn:
        if replace:
            conn.execute("DELETE FROM records")

        profile = snapshot.get("profile")
        if isinstance(profile, dict):
            _upsert_single(conn, "profile", profile, device_id=device_id)
            counts["profile"] = 1

        settings = snapshot.get("settings")
        if isinstance(settings, dict):
            existing_settings = _read_single(conn, "settings")
            if existing_settings and not settings.get("apiKey") and existing_settings.get("apiKey"):
                settings = dict(settings)
                settings["apiKey"] = existing_settings.get("apiKey", "")
            _upsert_single(conn, "settings", settings, device_id=device_id)
            counts["settings"] = 1

        for entity in ARRAY_KEYS:
            items = snapshot.get(entity)
            if not isinstance(items, list):
                continue
            count = 0
            snapshot_ids = set()
            for item in items:
                if not isinstance(item, dict):
                    continue
                item_id = str(item.get("id") or _new_id())
                payload = dict(item)
                payload["id"] = item_id
                row = conn.execute(
                    "SELECT created_at, version FROM records WHERE entity = ? AND id = ?",
                    (entity, item_id),
                ).fetchone()
                version = (row["version"] if row else 0) + 1
                created_at = row["created_at"] if row else _utc_now()
                conn.execute(
                    """
                    INSERT INTO records(entity, id, payload, created_at, updated_at, deleted_at, version, device_id)
                    VALUES(?, ?, ?, ?, ?, NULL, ?, ?)
                    ON CONFLICT(entity, id) DO UPDATE SET
                        payload = excluded.payload,
                        updated_at = excluded.updated_at,
                        deleted_at = NULL,
                        version = excluded.version,
                        device_id = excluded.device_id
                    """,
                    (
                        entity,
                        item_id,
                        json.dumps(payload, ensure_ascii=False, separators=(",", ":")),
                        created_at,
                        _utc_now(),
                        version,
                        device_id,
                    ),
                )
                snapshot_ids.add(item_id)
                count += 1

            if prune_missing and snapshot_ids:
                current_rows = conn.execute(
                    "SELECT id FROM records WHERE entity = ? AND deleted_at IS NULL",
                    (entity,),
                ).fetchall()
                missing_ids = [row["id"] for row in current_rows if row["id"] not in snapshot_ids]
                now = _utc_now()
                for item_id in missing_ids:
                    conn.execute(
                        """
                        UPDATE records
                        SET deleted_at = ?, updated_at = ?, version = version + 1, device_id = ?
                        WHERE entity = ? AND id = ? AND deleted_at IS NULL
                        """,
                        (now, now, device_id, entity, item_id),
                    )

            if count:
                counts[entity] = count

    return {"ok": True, "counts": counts}


def state_info(db_path: str = DB_PATH) -> Dict[str, Any]:
    """返回服务器数据的最近更新时间，用于多设备增量拉取。"""
    with connect(db_path) as conn:
        stamps: List[str] = []
        row = conn.execute(
            "SELECT updated_at FROM records ORDER BY updated_at DESC LIMIT 1"
        ).fetchone()
        if row and row["updated_at"]:
            stamps.append(row["updated_at"])
        for table in ("profile", "settings"):
            row = conn.execute(
                f"SELECT updated_at FROM {table} WHERE id = 1"
            ).fetchone()
            if row and row["updated_at"]:
                stamps.append(row["updated_at"])
        latest = max(stamps) if stamps else ""
        has_data = False
        try:
            has_data = bool(stamps)
        except Exception:
            has_data = False
        return {"updatedAt": latest, "hasData": has_data}


def changes_since(
    since: str,
    include_deleted: bool = True,
    db_path: str = DB_PATH,
) -> List[Dict[str, Any]]:
    """给未来同步协议使用：返回 since 之后变化过的记录。"""
    with connect(db_path) as conn:
        if include_deleted:
            rows = conn.execute(
                "SELECT entity, id, payload, created_at, updated_at, deleted_at, version, device_id "
                "FROM records WHERE updated_at > ? ORDER BY updated_at, entity, id",
                (since,),
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT entity, id, payload, created_at, updated_at, deleted_at, version, device_id "
                "FROM records WHERE updated_at > ? AND deleted_at IS NULL ORDER BY updated_at, entity, id",
                (since,),
            ).fetchall()

        result: List[Dict[str, Any]] = []
        for row in rows:
            result.append({
                "entity": row["entity"],
                "id": row["id"],
                "item": _decode_payload(row["payload"]),
                "createdAt": row["created_at"],
                "updatedAt": row["updated_at"],
                "deletedAt": row["deleted_at"],
                "version": row["version"],
                "deviceId": row["device_id"],
            })
        return result


def stats(db_path: str = DB_PATH) -> Dict[str, Any]:
    with connect(db_path) as conn:
        counts: Dict[str, Any] = {}
        for entity in ARRAY_KEYS:
            row = conn.execute(
                "SELECT COUNT(*) AS total, SUM(CASE WHEN deleted_at IS NULL THEN 1 ELSE 0 END) AS active "
                "FROM records WHERE entity = ?",
                (entity,),
            ).fetchone()
            counts[entity] = {
                "total": int(row["total"] or 0),
                "active": int(row["active"] or 0),
            }
        return {"schemaVersion": SCHEMA_VERSION, "dbPath": db_path, "counts": counts}


def migrate_from_state_file(db_path: str = DB_PATH, force: bool = False) -> Dict[str, Any]:
    """从现有 platform-state.json 导入一次；force=True 时清空后重建。"""
    if not os.path.exists(STATE_PATH):
        return {"ok": False, "error": "state file not found", "statePath": STATE_PATH}

    with open(STATE_PATH, "r", encoding="utf-8") as f:
        snapshot = json.load(f)

    if isinstance(snapshot, dict) and isinstance(snapshot.get("data"), dict):
        snapshot = snapshot["data"]

    if not force:
        with connect(db_path) as conn:
            row = conn.execute("SELECT COUNT(*) AS total FROM records").fetchone()
            if int(row["total"] or 0) > 0:
                return {"ok": True, "skipped": True, "reason": "database already has records"}

    return import_snapshot(snapshot, replace=force, db_path=db_path)
